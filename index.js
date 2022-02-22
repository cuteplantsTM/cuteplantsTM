const express = require('express')
var cookieSession = require('cookie-session')
const fullApp = express()
const app = express.Router();
fullApp.set('trust proxy', 1) // trust first proxy
const port = 3008

app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2']
}))

app.use(function (req, res, next) {
  req.sessionOptions.maxAge = req.session.maxAge || req.sessionOptions.maxAge
  next()
})

const TICK_SECS = 1/5;
const TICK_MS = 1000 * TICK_SECS;

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
    if (typeof val == "string")
      out[valpath] = val;
    else
      flatten(val, valpath, out);
  }
  return out;
}

const ART = flatten({
  seeds: {
    bractus: "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/bractus_seed.png?raw=true",
    coffea: "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/coffea_cyl_seed.png?raw=true"
,
    hacker: "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/hacker_vibes_vine_seed.png?raw=true"
,
  },
  plants: [{
    bractus: "https://github.com/hackagotchi/hackagotchi/blob/master/img/plant/bractus_loaf.gif?raw=true",
    coffea: "https://github.com/hackagotchi/hackagotchi/blob/master/img/plant/coffea_cyl_baby.gif?raw=true",
    hacker: "https://github.com/hackagotchi/hackagotchi/blob/master/img/plant/hacker_vibes_vine_baby.gif?raw=true",
  }],
  dirt: "https://github.com/hackagotchi/hackagotchi/blob/master/img/icon/dirt.png?raw=true",
  icon: "https://github.com/hackagotchi/hackagotchi/blob/master/img/icon/seedlet.png?raw=true"
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
    }
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
    }
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
    }
  ],
});

let online = 0;
let tickClock = 0;
let idPlayer = 0;
const playerID = () => idPlayer++;
let playerDatArr = [];

function getPlayer(getID) {
    console.log("player id to get: " + getID)
    console.log("players ids ")
    for (let player in playerDatArr) {
        console.log(player.playerID)
    }
    if (playerDatArr.find((player) => player.playerID == getID)) {
        return playerDatArr.find((player) => player.playerID == getID);
    } else {
        console.log("new player data")
        newPlayer = {};

        newPlayer.idSeed = 0;
        newPlayer.seedID = () => newPlayer.idSeed++;

        newPlayer.playerID = getID;
        //populate inventory with default items
        newPlayer.inv = [
            "seeds.bractus",
            "seeds.coffea",
            "seeds.hacker"
        ] 
        newPlayer.farm = [];
        newPlayer.ground = [];

        for (let x = 0; x < 3; x++)
            for (let y = 0; y < 3; y++)
                newPlayer.farm.push({
                    x: x,
                    y: y,
                    age: 0,
                    id: newPlayer.seedID()
                });
        playerDatArr.push(newPlayer);
        return newPlayer;
    }
}

/* takes seed, returns plant */
const evolve = item => "plants.0." + item.split('.')[1];
/* takes plant, returns seed */
const devolve = item => "seeds." + item.split('.')[2];

const levels = [
  0,
  120,
  280,
  480,
  720,
  1400,
  1700,
  2100,
  2700,
  3500,
  6800,
  7700,
  8800,
  10100,
  11600,
  22000,
  24000,
  26500,
  29500,
  33000,
  37000,
  41500,
  46500,
  52000,
  99991,
];

const xpLevel = xp => {
  for (const lvlI in levels) {
    const lvlXp = levels[lvlI];
    if (xp < lvlXp)
      return { level: lvlI, has: xp, needs: lvlXp };
    xp -= lvlXp;
  }
  return { level: levels.length, has: xp, needs: NaN };
};

const absPosStyle = ([x, y]) => `position:absolute;left:${x}px;top:${y}px;`;

function imageHTML({ size, href, art, pos, zIndex }) {
  let style = `width:${size}px;height:${size}px;`;
  if (pos) style += absPosStyle(pos);
  if (zIndex) style += `z-index:${zIndex};`;

  let img = `<img src="${art}" style="${style}"></img>`;
  return`<a href="${href}"> ${img} </a>`;
}

const axialHexToPixel = ([x, y]) => [
    90 * (Math.sqrt(3) * x + Math.sqrt(3)/2 * y),
    90 * (                             3 /2 * y)
];

function progBar({ size: [w, h], pos: [x, y], colors, pad, has, needs, id}) {
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

app.get('/', (req, res) => {
  //on no save
  if (req.session.isNew || typeof req.session.playerID == "undefined") {
      console.log("new session")
      req.session.playerID = playerID();
      getPlayer(req.session.playerID);
  }
  let grid = '<div style="position:relative;">';
  for (let plant of getPlayer(req.session.playerID).farm) {
    let { x, y, id, xp } = plant;
    [x, y] = axialHexToPixel([x, y]);
    grid += imageHTML({
      pos: [x, y],
      size: 120,
      href: '/farm/plant/' + id,
      art: ART[plant.kind ? plant.kind : 'dirt']
    });

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
        ${absPosStyle([x + 128*0.35, y + 138])}
        z-index:1;
        font-family: monospace;
      ">lvl ${level}</p>`;
    }
  }
  for (let item of getPlayer(req.session.playerID).ground) {
    let { x, y, id } = item;
    grid += imageHTML({
      pos: [x, y],
      size: 30,
      zIndex: 2,
      href: '/farm/grab/' + id,
      art: ART[item.kind]
    });
  }
  grid += "</div>";

  res.send(`
    <h1> You have ${getPlayer(req.session.playerID).inv.length} seeds. </h1>
    ${grid}
    <script>
    setInterval(async () => {
      let res = await fetch("/farm/shouldreload");
      let { reload } = await res.json();

      if (reload)
        window.location.reload();
    }, ${TICK_MS});
    </script>
  `);
})

app.get('/shouldreload', (req, res) => {
  res.send({ reload: getPlayer(req.session.playerID).shouldReload });
  getPlayer(req.session.playerID).shouldReload = false;
});

app.get('/plant/:id', (req, res) => {
    const {
        id
    } = req.params;

    if (getPlayer(req.session.playerID).inv.length >= 1) {
        let page = '<h2>';
        page += 'These are the seeds you have in your inventory:';
        page += '</h2>';
        page += '<div style="position:relative;">';
        let x = 0;
        for (let item of getPlayer(req.session.playerID).inv ) {
            page += imageHTML({
              size: 120,
              href: `/farm/plant/${id}/${item}`,
              art: ART[item]
            });
        }
        page += '</div>';


        res.send(page);

        return;
    }
    res.redirect("/farm");
});

app.get('/grab/:id', (req, res) => {
  const { id } = req.params;

  let itemI = getPlayer(req.session.playerID).ground.findIndex(i => i.id == id); 
  console.log(itemI);
  if (itemI > -1)
    getPlayer(req.session.playerID).inv.push(getPlayer(req.session.playerID).ground.splice(itemI, 1)[0].kind);
  res.redirect("/farm");
});

app.get('/plant/:id/:seed', (req, res) => {
    const {
        id,
        seed
    } = req.params;

    let seedI = getPlayer(req.session.playerID).inv.indexOf(seed);

    if (seedI >= 0) {
        getPlayer(req.session.playerID).inv.splice(seedI, 1);
        let plant = getPlayer(req.session.playerID).farm.find(p => p.id == id);
        plant.xp = 0;
        plant.age = 0;
        plant.kind = evolve(seed);
        res.redirect("/farm");
        return;
    }
    throw new Error("you don't have that kind of seed!");
});

setInterval(() => {
  for (let player of playerDatArr) {
    for (let plant of player.farm)
    if (plant.kind) {
      plant.age++;
      plant.xp++;
      if (xpLevel(plant.xp).level != xpLevel(plant.xp-1).level)
        player.shouldReload = true;
      if (plant.age % 158 == 0) {
        player.shouldReload = true;
        plant.xp += 5;
        let [x, y] = axialHexToPixel([plant.x, plant.y]);
        player.ground.push({
          kind: devolve(plant.kind),
          x: x + 120 * (Math.random()),
          y: y + 120 * (Math.random() * 0.25 + 0.8),
          id: player.seedID(),
        });
      }
    }
  }
}, TICK_MS);

fullApp.use('/farm', app);
fullApp.listen(port, () => console.log(`Example app listening on port ${port}`))
