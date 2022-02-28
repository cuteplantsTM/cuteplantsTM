const express = require("express");
var cookieSession = require("cookie-session");
const fullApp = express();
const app = express.Router();
fullApp.set("trust proxy", 1); // trust first proxy
const port = 3008;

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
 *     plant: [
 *       { a:  "hi", b: "heyo" },
 *       { a: "bye", b:  "cya" },
 *     ]
 *   })
 * out:
 *  {
 *    "plant.0.a": "hi",
 *    "plant.0.b": "heyo",
 *    "plant.1.a": "bye",
 *    "plant.1.b": "cya",
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

const NAMES = flatten({
  seed: {
    bractus: "bractus seed",
    coffea: "coffea cyl seed",
    hacker: "hacker vibes vine seed",
  },
  egg: {
    bractus: "bread egg",
    coffea: "cyl egg",
    hacker: "hacker egg",
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
  plant: [
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

const sum = list => list.reduce((a, x) => a + x, 0);
const otherPlants = (plant) => ["bractus", "hacker", "coffea"].filter(x => x != plant);

const hasEnough = ({ needs, inv }) => {
  inv = JSON.parse(JSON.stringify(inv));
  for (const item of needs) {
    let i = inv.indexOf(item);
    if (i >= 0) inv.splice(i, 1);
    else return { enough: false };
  }
  return { enough: true, invWithout: inv };
}

/* EXAMPLE:
 input: chooseWeighted({ a: 4, b: 1 })
 output: "b" 1/5 of the time
*/
const chooseWeighted = opts => {
  let r = Math.random() * sum(Object.values(opts));
  return Object.keys(opts).find(k => (r -= opts[k]) < 0);
};

const RECIPES = [
  (() => {
    const tooltips = {
      bractus: {
        tooltip: 
          "Ever get yelled at as a kid for smushing your bread into tiny little balls?" +
          " No? Well that's what your Bractus has been up to," +
          " except these compressed bread things seem exceptionally useful.",
        explanation: "compres bred = moar crafty",
      },
      hacker: {
        tooltip: 
          "Hacker spirit seems to fit together into a cube-like shape when combined" +
          " with duct tape. These cubes seem to be especially useful for more" +
          " advanced crafting!",
        explanation: "compres hak = moar crafty"
      },
      coffea: {
        tooltip:
          "Your Coffea Cyl has found that if it focuses all of its electromagnetic " +
          " intensity on just a handful of Cyl Crystals, it can concentrate all of " +
          " them into one extremely compressed crystcyl.",
        explanation: "compres cofe = moar crafty"
      },
    };

    return Object.fromEntries(Object
      .entries(tooltips)
      .map(([key, { tooltip, explanation }]) => [key, {
        tooltip,
        explanation,
        needs: Array(5).fill(`essence.0.${key}`),
        makes: () => ({
          items: [`essence.1.${key}`],
          xp: 144,
        }),
        time: 240,
      }]))
  })(),
  (() => {
    const tooltips = {
      bractus: {
        tooltip: 
          "With some resources from far outside of the desert," +
          " you can sacrifice your plant in exchange for an egg of an unpredictable" +
          " variety, filled with luxurious goods, if you're lucky!",
      },
      hacker: {
        tooltip: 
          "With some resources from far outside of the jungle," +
          " you can sacrifice your plant in exchange for an egg of an unpredictable" +
          " variety, filled with luxurious goods, if you're lucky!",
      },
      coffea: {
        tooltip: 
          "With some resources from far outside of the Cyl Dimension," +
          " you can sacrifice your plant in exchange for an egg of an unpredictable" +
          " variety, filled with luxurious goods, if you're lucky!",
      },
    };

    return Object.fromEntries(Object
      .entries(tooltips)
      .map(([key, { tooltip }]) => [key, {
        tooltip,
        explanation: "got gud stuf n it, u die tho",
        needs: otherPlants(key).map(p => Array(5).fill(`essence.1.${p}`)).flat(),
        makes: () => {
          const [a, b] = otherPlants(key);
          return {
            items: [chooseWeighted({
              [`egg.${key}`]: 2,
              [`egg.${a}`]  : 99,
              [`egg.${b}`]  : 99,
            })]
          };
        },
        destroysPlant: true,
        time: 600,
      }]))
  })(),
];

let online = 0;
let tickClock = 0;
let players = [];
const newId = (() => {
  let idGenerator = 0;
  return () => idGenerator++;
})();

function getPlayer(pId) {
  if (players.find((player) => player.playerId == pId)) {
    return players.find((player) => player.playerId == pId);
  } else {
    newPlayer = {};

    newPlayer.playerId = pId;

    //populate inventory with default items
    newPlayer.inv = ["seed.bractus", "seed.coffea", "seed.hacker"];
    newPlayer.xp = 0;
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


const plantClass = item => item.split(".").slice(-1)[0];

const xpLevel = (() => {
  const levels = [
    0, 120, 280, 480, 720, 1400, 1700, 2100, 2700, 3500, 6800, 7700, 8800, 10100,
    11600, 22000, 24000, 26500, 29500, 33000, 37000, 41500, 46500, 52000, 99991,
  ];

  return xp => {
    for (const lvlI in levels) {
      const lvlXp = levels[lvlI];
      if (xp < lvlXp) return { level: lvlI, has: xp, needs: lvlXp };
      xp -= lvlXp;
    }
    return { level: levels.length, has: xp, needs: NaN };
  }
})();

/* Rendering Helpers */

const absPosStyle = ([x, y]) => `position:absolute;left:${x}px;top:${y}px;`;

function imageHTML(opts) {
  const { size, href, art, pos } = opts;

  let style = `width:${size}px;height:${size}px;`;
  if (pos) style += absPosStyle(pos);
  if (opts.style) style += opts.style;

  let img = `<img src="/farm/${art}.png" style="${style}"></img>`;

  if (href)
    return `<a href="${href}"> ${img} </a>`;
  else
    return img;
}

const axialHexToPixel = ([x, y]) => [
  90 * (Math.sqrt(3) * x + (Math.sqrt(3) / 2) * y),
  90 * ((3 / 2) * y),
];

function progBar({ size: [w, h], pos: [x, y], colors, pad, has, needs, id = "defaultBar" }) {
  const width = 90;
  const duration = (needs - has) * TICK_SECS;
  const prog = has / needs;
  return `
    <div style="
      ${absPosStyle([x, y])}
      z-index:1;
      padding:${pad}px;
      width:${w}px;height:${h}px;
      border-radius:${h/2}px;
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
      height:${h}px;
      border-radius:${h/2}px;
      background-color:${colors[1]};
      animation-duration:${duration}s;
      animation-name:xpbar_${id};
      animation-timing-function:linear;
    "></div>`;
}

const INV_GRID_POS = [30, 550];
const PLANT_FOCUS_GRID_POS = [650, 40];
function farmGridHTML({ ground, farm, ghosts, focus }) {
  let grid = '<div style="position:relative;">';

  for (let plant of farm) {
    let { x, y, id, xp } = plant;
    [x, y] = axialHexToPixel([x, y]);
    grid += imageHTML({
      pos: [x, y],
      size: 120,
      href: "/farm/plant/" + id,
      art: (plant.kind ? plant.kind : "dirt"),
    });

    if (plant == focus) {
      const center = [x + 120 * 0.45, y + 120 * 0.25];
      for (let deg = 0; deg < 360; deg += 90) {
        grid += `<style>
          @keyframes focus_pointer_${deg} {
            from { transform:rotate(${deg}deg) translate(58px); }
            to { transform:rotate(${deg}deg) translate(62px); }
          }
        </style>`;
        grid += `<h1 style="
          animation-name: focus_pointer_${deg};
          animation-duration: 0.3s;
          animation-iteration-count: infinite;
          animation-direction: alternate;
          color:crimson;
          ${absPosStyle(center)}"
        ><</h1>`;
      }
    }

    /* xp bar */
    if (plant.kind) {
      const { level, has, needs } = xpLevel(xp);
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
      ">lvl ${level}</p>`;
    }

    if (plant.craft) {
      grid += imageHTML({
        pos: [x + 120, y + 14],
        size: 40,
        art: plant.craft.makes.items[0],
        style: "opacity:20%;"
      });
    }
  }

  /* ground items */
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
      art: item.kind,
    });
  }
  grid += "</div>";

  return grid;
}

function invGridHTML({ inv, href = () => undefined, pos }) {
  let grid = `<div style="display:flex;${absPosStyle(pos)}">`;

  for (const [item, count] of invMap(inv)) {
    grid += `<div style="padding:10px;">`;
    grid += imageHTML({ size: 50, art: item, href: href(item) });
    grid += `<p style="
      z-index:1;
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

function plantFocusHTML({ plant, inv }) {
  let box = `<div style="${absPosStyle(PLANT_FOCUS_GRID_POS)}">`;
  box += `<h2 style="color:crimson;"><u>${NAMES[plant.kind]}</u></h2>`;
  box += `<style>
    .recipe {
      padding: 5px;
      border-radius:20px;
    }
    .recipe-active {
      background: white;
    }
    .recipe-active:hover {
      cursor: pointer;
      background: #ffebeb; 
    }
    .recipe-na {
      cursor: not-allowed;
      opacity: 40%;
    }
  </style>`;

  for (const recipe of RECIPES.map(r => r[plantClass(plant.kind)])) {
    let makes = recipe.makes();
    let [iconItem] = makes.items;

    let { enough } = hasEnough({needs: recipe.needs, inv});
    box += `<div
      class="recipe ${enough ? "recipe-active" : "recipe-na"}"
      style="display:flex;align-items:center;margin:20px;"
    >`;
      box += `<img
        style="width:40px;height:40px;margin-right:10px;"
        src="/farm/${iconItem}.png"
      ></img>`;
      box += `<div style="width:250px;overflow:hidden;">
        <h3 style="margin:0px;padding:5px;">${NAMES[iconItem]}</h3>
        <p style="margin:0px;padding:5px;">${recipe.explanation}</p>
      </div>`;

      let mins = recipe.time * TICK_SECS / 60;
      box += "<div>";
        box += `<h3 style="margin:0px;padding:0px;">${mins.toFixed(1)} min</h3>`;

        const invmap = invMap(inv);
        const needsmap = invMap(recipe.needs);
        for (const [item, amount] of needsmap) {
          const has = invmap.get(item) ?? 0;
          box += `<p style="margin:0px;${(has < amount) ? "color:red;" : ""}">`;
          box += `x${amount} `;
          box += `<img
            style="width:1.25em;height:1.25em;position:relative;top:0.3em;"
            src="/farm/${item}.png"
          ></img>`;
          box += ` ${NAMES[item]} <br>`;
          box += '</p>';
        }
      box += "</div>";

    box += "</div>"
  }
  box += `</div>`;
  return box;
}

app.use(express.static('img'))

const GLOBAL_STYLE = `
  <style>
    body { font-family: monospace; }
  </style>
`;
app.get("/", (req, res) => {
  //on no save
  if (req.session.isNew || typeof req.session.playerId == "undefined") {
    req.session.playerId = newId();
    getPlayer(req.session.playerId);
  }

  const { farm, ground, ghosts, inv, selected, xp } = getPlayer(req.session.playerId);
  let focus = farm.find(p => p.id == selected);

  const { level, has, needs } = xpLevel(xp);

  res.send(`
    ${GLOBAL_STYLE}
    ${progBar({
        size: [380, 30],
        pad: 8,
        pos: [110, 30],
        colors: ["skyblue", "blue"],
        has,
        needs,
      })}
    <h2 style="${absPosStyle([515, 26])}">lvl ${level}</h2>
    <br><br><br><br><br>
    ${farmGridHTML({ ground, farm, ghosts, focus })}
    ${invGridHTML({ inv, pos: INV_GRID_POS })}
    ${selected ? plantFocusHTML({ plant: focus, inv }) : ''}
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

app.get("/craft/:plantId/:recipeIndex", (req, res) => {
  const { plantId, recipeIndex } = req.params;
  const player = getPlayer(req.session.playerId);
  const { farm, inv } = player;

  const plant = farm.find((p) => p.id == id);
  if (!plant.kind || plant.craft) return res.redirect("/farm");

  const recipe = RECIPES.map(r => r[plantClass(plant.kind)])[recipeIndex];
  if (!recipe) return res.redirect("/farm");

  const { invAfter, enough } = hasEnough({ needs: recipe.needs, inv });
  if (!enough) return res.redirect("/farm");

  player.inv = invWithout;
  plant.craft = {
    ageStarted: plant.age,
    ageFinished: plant.age + recipe.time,
    makes: recipe.makes(),
  };
  res.redirect("/farm");
});

app.get("/plant/:id", (req, res) => {
  const { id } = req.params;
  const player = getPlayer(req.session.playerId);
  const { farm, inv } = player;
  const seeds = inv.filter(i => /^seed/.test(i));

  const plot = farm.find((p) => p.id == id);
  if (!plot) {
  } else if (plot.kind) {
    player.selected = id;
  } else if (seeds.length >= 1) {
    let page = GLOBAL_STYLE + "<h2>";
    page += "These are the seeds you have in your inventory:";
    page += "</h2>";
    page += invGridHTML({
      inv: seeds,
      pos: [50, 50],
      href: item => `/farm/plant/${id}/${item}`
    });
    res.send(page);

    return;
  }

  res.redirect("/farm");
});

app.get("/plant/:id/:seed", (req, res) => {
  const { id, seed } = req.params;
  const player = getPlayer(req.session.playerId);
  const { inv, farm } = player;

  player.xp += 50;

  let seedI = inv.indexOf(seed);

  if (seedI >= 0) {
    inv.splice(seedI, 1);
    let plant = farm.find((p) => p.id == id);
    plant.xp = 0;
    plant.age = 0;
    plant.kind = "plant.0." + plantClass(seed);
    res.redirect("/farm");
    return;
  }
  throw new Error("you don't have that kind of seed!");
});

/* Game Tick Loop */

setInterval(() => {
  tickClock++;

  for (let player of players) {
    for (let plant of player.farm) if (plant.kind) {
      const dropItem = kind => {
          player.shouldReload = true;
          let [x, y] = axialHexToPixel([plant.x, plant.y]);
          x += 128*0.4;
          y += 128*0.6;
          let rot = Math.random() * Math.PI;
          player.ground.push({
            spawnTick: tickClock,
            spawnPos: [x, y],
            kind,
            x: x + 70 * Math.cos(rot),
            y: y + 20 * Math.sin(rot),
            id: newId(),
          });
      };

      plant.age++;
      plant.xp++;
      const { level } = xpLevel(plant.xp);
      if (level != xpLevel(plant.xp - 1).level)
        player.shouldReload = true;
      
      let speedNow = 10;
      for (let i = 0; i < level; i++)
        speedNow /= 1.1;

      if (plant.age % Math.round(speedNow) == 0) {
        plant.xp += 5;
        dropItem("essence.0." + plantClass(plant.kind));
      }

      if (plant.craft && plant.age >= plant.craft.ageFinished) {
        plant.xp += plant.craft.makes.xp;
        for (const item of plant.craft.makes.items)
          dropItem(item);
        delete plant.craft;
      }
    }
  }
}, TICK_MS);

fullApp.use(
  process.env.PROD ? "/" : "/farm",
  app
);
fullApp.listen(port, () =>
  console.log(`Example app listening on port ${port}`)
);
