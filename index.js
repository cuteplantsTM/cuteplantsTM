const express = require("express");
var cookieSession = require("cookie-session");
const fullApp = express();
const app = express.Router();
fullApp.set("trust proxy", 1); // trust first proxy
const port = 3008;

const hackstead = require("./hackstead.js");

app.use(
  cookieSession({
    name: "session",
    keys: ["key1", "key2"],
  })
);

app.use(function (req, res, next) {
  const { sessionOptions, session } = req;
  sessionOptions.maxAge = session.maxAge || sessionOptions.maxAge;
  next();
});

/* Net Constants */

const TICK_SECS = 1 / 5;
const TICK_MS = 1000 * TICK_SECS;
const TIMEOUT = 9000;

/* EXAMPLE:
 * in:
 *  flatten({
 *     plants: [
 *       { a:  "hi", b: "heyo" },
 *       { a: "bye", b:  "cya" },
 *     ]
 *   })
 * out:
 *  {
 *    "plants.0.a": "hi",
 *    "plants.0.b": "heyo",
 *    "plants.1.a": "bye",
 *    "plants.1.b": "cya",
 *  }
 */
function flatten(obj, path, out = {}) {
  for (const [key, val] of Object.entries(obj)) {
    let valpath = path ? `${path}.${key}` : key;
    if (typeof val == "string") out[valpath] = val;
    else flatten(val, valpath, out);
  }
  return out;
}

/* conf/data */

const ART = flatten({
  seeds: {
    bractus:
      "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/bractus_seed.png?raw=true",
    coffea:
      "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/coffea_cyl_seed.png?raw=true",
    hacker:
      "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/hacker_vibes_vine_seed.png?raw=true",
  },
  plants: [
    {
      bractus:
        "https://github.com/hackagotchi/hackagotchi/blob/master/img/plant/bractus_loaf.gif?raw=true",
      coffea:
        "https://github.com/hackagotchi/hackagotchi/blob/master/img/plant/coffea_cyl_baby.gif?raw=true",
      hacker:
        "https://github.com/hackagotchi/hackagotchi/blob/master/img/plant/hacker_vibes_vine_baby.gif?raw=true",
    },
  ],
  dirt: "https://github.com/hackagotchi/hackagotchi/blob/master/img/icon/dirt.png?raw=true",
  icon: "https://github.com/hackagotchi/hackagotchi/blob/master/img/icon/seedlet.png?raw=true",
});

const NAMES = flatten({
  seeds: {
    bractus: "bractus seed",
    coffea: "coffea cyl seed",
    hacker: "hacker vibes vine seed",
  },
  essence: [
    {
      /* raw essences, plants drop these directly */
      bractus: "bread essence",
      coffea: "cyl crystal",
      hacker: "hacker spirit",
    },
    {
      /* compressed forms plants craft from raw */
      bractus: "bressence",
      coffea: "crystcyl",
      hacker: "hacksprit",
    },
  ],
  items: [
    {
      bractus: "rolling pin",
      coffea: "cyl wand",
      hacker: "vine keyboard",
    },
    {
      bractus: "kingpin",
      coffea: "cytrus staff",
      hacker: "jungleboard",
    },
  ],
  plants: [
    {
      bractus: "bractus loaf",
      coffea: "coffea cyl baby",
      hacker: "hacker vibes vine sprout",
    },
    {
      bractus: "bractus kid",
      coffea: "coffea cyl kid",
      hacker: "hacker vibes kid",
    },
  ],
});

let online = 0;
let tickClock = 0;
let players = [];
const newId = (() => {
  let idGenerator = 0;
  return () => idGenerator++;
})();

/* Gameplay/Net Helpers */

function getPlayer(p_id) {
  if (players.find((player) => player.playerId == p_id)) {
    return players.find((player) => player.playerId == p_id);
  } else {
    newPlayer = {};

    newPlayer.playerId = p_id;

    //populate inventory with default items
    newPlayer.stats = {
        xp : 0
    }
    newPlayer.lastUpdate = 0;
    newPlayer.inv = ["seeds.bractus", "seeds.coffea", "seeds.hacker"];
    newPlayer.farm = [];
    newPlayer.ground = [];
    /* ghosts are items that were on the ground that linger for a bit
       so that they can be animated as they move to the inventory */
    newPlayer.ghosts = [];

    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        if (x != y || x == 1)
          newPlayer.farm.push({
            x: x,
            y: y,
            age: 0,
            id: newId(),
          });
    players.push(newPlayer);
    return newPlayer;
  }
}

const invMap = inv => inv.reduce((map, i) => map.set(i, 1 + (map.get(i) ?? 0)), new Map());

/* takes seed, returns plant */
const evolve = (item) => "plants.0." + item.split(".")[1];
/* takes plant, returns seed */
const devolve = (item) => "seeds." + item.split(".")[2];

const plantXpLevelGeneric = (levels => {
  return xp => {
    for (const lvlI in levels) {
      const lvlXp = levels[lvlI];
      if (xp < lvlXp) return { level: lvlI, has: xp, needs: lvlXp };
      xp -= lvlXp;
    }
    return { level: levels.length, has: xp, needs: NaN };
  }
});
const plantplantXpLevel = plantXpLevelGeneric([
  0, 120, 280, 480, 720, 1400, 1700, 2100, 2700, 3500, 6800, 7700, 8800, 10100,
  11600, 22000, 24000, 26500, 29500, 33000, 37000, 41500, 46500, 52000, 99991,
]);
const farmplantXpLevel = plantXpLevelGeneric(hackstead.advancements.map(x => x.xp));

/* Rendering Helpers */

const absPosStyle = ([x, y]) => `position:absolute;left:${x}px;top:${y}px;`;

function imageHTML(opts) {
  const { size, href, art, pos } = opts;

  let style = `width:${size}px;height:${size}px;`;
  if (pos) style += absPosStyle(pos);
  if (opts.style) style += opts.style;

  let img = `<img src="${art}" style="${style}"></img>`;

  if (href)
    return `<a href="${href}"> ${img} </a>`;
  else
    return img;
}

const axialHexToPixel = ([x, y]) => [
  90 * (Math.sqrt(3) * x + (Math.sqrt(3) / 2) * y),
  90 * ((3 / 2) * y),
];

function progBar({ size: [w, h], pos: [x, y], colors, pad, has, needs, id }) {
  const width = 90;
  const duration = (needs - has) * TICK_SECS;
  const prog = has / needs;
  return `
    <div style="
      ${absPosStyle([x, y])}
      z-index:1;
      padding:${pad}px;
      width:${w}px;height:${h}px;
      border-radius:5px;
      background-color:${colors[0]};
    "></div>
    <style>
      @keyframes xpbar_${id} {
        from {
          width: ${width * prog}px;
        }
        to {
          width: ${width}px;
        }
      }
    </style>
    <div style="
      ${absPosStyle([x + pad, y + pad])}
      z-index:1;
      height:10px;
      border-radius:5px;
      background-color:${colors[1]};
      animation-duration:${duration}s;
      animation-name:xpbar_${id};
      animation-timing-function:linear;
    "></div>`;
}

const INV_GRID_POS = [650, 40];
function farmGridHTML({ ground, farm, ghosts }) {
  let grid = '<div style="position:relative;">';

  for (let plant of farm) {
    let { x, y, id, xp } = plant;
    [x, y] = axialHexToPixel([x, y]);
    grid += imageHTML({
      pos: [x, y],
      size: 120,
      href: "/farm/plant/" + id,
      art: ART[plant.kind ? plant.kind : "dirt"],
    });

    if (plant.kind) {
      const { level, has, needs } = plantXpLevel(xp);
      grid += progBar({
        size: [90, 10],
        pad: 5,
        pos: [x + 14, y + 128],
        colors: ["skyblue", "blue"],
        has,
        needs,
        id,
      });
      grid += `<p style="
        ${absPosStyle([x + 128 * 0.35, y + 138])}
        z-index:1;
        font-family: monospace;
      ">lvl ${level}</p>`;
    }
  }

  for (let item of ground.concat(ghosts)) {
    let { x, y, id, spawned } = item;

    let style = `z-index:2;`;

    if (tickClock - item.spawnTick < 5) {
      style += `animation:item_${id} 0.6s ease-in;`;
      const [from_x, from_y] = item.spawnPos;
      grid += `<style>
        @keyframes item_${id} {
          from {
            left: ${from_x}px;
            top: ${from_y}px;
          }
          50% {
            left: ${(item.x + from_x)/2}px;
            top: ${from_y - 80}px;
          }
          to {
            left: ${item.x}px;
            top: ${item.y}px;
          }
        }
      </style>`;
    }

    if (ghosts.includes(item)) {
      style += `animation:item_${id} 0.6s ease-in;animation-fill-mode:forwards;`;
      const [to_x, to_y] = INV_GRID_POS;
      grid += `<style>
        @keyframes item_${id} {
          from {
            left: ${item.x}px;
            top: ${item.y}px;
          }
          to {
            left: ${to_x}px;
            top: ${to_y}px;
            transform: scale(0);
          }
        }
      </style>`;
    }

    grid += imageHTML({
      pos: [x, y],
      size: 30,
      style,
      href: "/farm/grab/" + id,
      art: ART[item.kind],
    });
  }
  grid += "</div>";

  return grid;
}

function invGridHTML({ inv, href = () => undefined, pos }) {
  let grid = `<div style="display:flex;${absPosStyle(pos)}">`;

  for (const [item, count] of invMap(inv)) {
    grid += `<div style="padding:10px;">`;
    grid += imageHTML({ size: 50, art: ART[item], href: href(item) });
    grid += `<p style="
      z-index:1;
      font-family: monospace;
      margin: 0px;
      position: relative;
      top: -5px;
      left: 30px;
    ">${count}x</p>`;
    grid += "</div>";
  }

  grid += "</div>";
  return grid;
}

/* Farm Page */

app.get("/", (req, res) => {
  //on no save
  if (req.session.isNew || typeof req.session.playerId == "undefined") {
    req.session.playerId = newId();
    getPlayer(req.session.playerId);
  }

  const { farm, ground, ghosts, inv } = getPlayer(req.session.playerId);

  res.send(`
    ${farmGridHTML({ ground, farm, ghosts })}
    ${invGridHTML({ inv, pos: INV_GRID_POS })}
    <title>${players.filter(p => (tickClock - p.lastUpdate) < 9000).length} Online</title>
    <script>
    setInterval(async () => {
      let res = await fetch("/farm/shouldreload");
      let { reload } = await res.json();

      if (reload)
        window.location.reload();
    }, ${TICK_MS});
    </script>
  `);
});

app.get("/shouldreload", (req, res) => {
  const player = getPlayer(req.session.playerId);
  player.lastUpdate = tickClock;
  res.send({ reload: player.shouldReload });
  player.shouldReload = false;
});

app.get("/plant/:id", (req, res) => {
  const { id } = req.params;
  const { inv } = getPlayer(req.session.playerId);

  if (inv.length >= 1) {
    let page = "<h2>";
    page += "These are the seeds you have in your inventory:";
    page += "</h2>";
    page += invGridHTML({ inv, pos: [50, 50], href: item => `/farm/plant/${id}/${item}` });
    res.send(page);

    return;
  }
  res.redirect("/farm");
});

app.get("/grab/:id", (req, res) => {
  const { id } = req.params;
  const { inv, ground, ghosts } = getPlayer(req.session.playerId);

  let itemI = ground.findIndex((i) => i.id == id);
  if (itemI > -1) {
    const [item] = ground.splice(itemI, 1);
    inv.push(item.kind);
    ghosts.push(item);
    setTimeout(() => ghosts.splice(ghosts.indexOf(item), 1), 500);
  }

  res.redirect("/farm");
});

app.get("/plant/:id/:seed", (req, res) => {
  const { id, seed } = req.params;
  const { inv, farm } = getPlayer(req.session.playerId);

  let seedI = inv.indexOf(seed);

  if (seedI >= 0) {
    inv.splice(seedI, 1);
    let plant = farm.find((p) => p.id == id);
    plant.xp = 0;
    plant.age = 0;
    plant.kind = evolve(seed);
    res.redirect("/farm");
    return;
  }
  throw new Error("you don't have that kind of seed!");
});

/* Game Tick Loop */

setInterval(() => {
  tickClock++;

  for (let player of players) {
    for (let plant of player.farm)
      if (plant.kind) {
        plant.age++;
        plant.xp++;
        if (plantXpLevel(plant.xp).level != plantXpLevel(plant.xp - 1).level)
          player.shouldReload = true;
        if (plant.age % 49 == 0) {
          player.shouldReload = true;
          plant.xp += 5;
          let [x, y] = axialHexToPixel([plant.x, plant.y]);
          x += 128*0.4;
          y += 128*0.6;
          let rot = Math.random() * Math.PI;
          player.ground.push({
            spawnTick: tickClock,
            spawnPos: [x, y],
            kind: devolve(plant.kind),
            x: x + 70 * Math.cos(rot),
            y: y + 20 * Math.sin(rot),
            id: newId(),
          });
        }
      }
  }
}, TICK_MS);

fullApp.use("/farm", app);
fullApp.listen(port, () =>
  console.log(`Example app listening on port ${port}`)
);
