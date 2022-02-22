const express = require('express')
const fullApp = express()
const app = express.Router();
const port = 3008

let idSeed = 0;
const newId = () => idSeed++;

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

let inv = [
  "seeds.bractus",
  "seeds.coffea",
  "seeds.hacker"
];

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
      return { level: lvlI, prog: xp / lvlXp, has: xp, needs: lvlXp };
    xp -= lvlXp;
  }
  return { level: levels.length, prog: NaN, has: xp, needs: NaN };
};


let shouldReload = true;
let plants = [];
for (let x = 0; x < 3; x++)
  for (let y = 0; y < 3; y++)
    if (x != y || x == 1)
      plants.push({ x, y, age: 0, id: newId() });


function absPosStyle([x, y]) {
  return `position:absolute;` +
         `left:${x}px;top:${y}px;`;
}

function imageHTML({ size, href, art, pos }) {
  let style = `width:${size}px;height:${size}px;`;
  if (pos) style += absPosStyle(pos);

  let img = `<img src="${art}" style="${style}"></img>`;
  return`<a href="${href}"> ${img} </a>`;
}

const axialHexToPixel = (x, y) => [
    80 * (Math.sqrt(3) * x + Math.sqrt(3)/2 * y),
    80 * (                             3 /2 * y)
];

app.get('/', (req, res) => {
  let grid = '<div style="position:relative;">';
  for (let plant of plants) {
    let { x, y, id } = plant;
    [x, y] = axialHexToPixel(x, y);
    grid += imageHTML({
      pos: [x, y],
      size: 120,
      href: '/farm/plant/' + id,
      art: ART[plant.kind ? plant.kind : 'dirt']
    });

    let outer = absPosStyle([x + 16, y + 128]);
    outer += "width:100px;height:20px;";
    outer += "border-radius:5px;";
    outer += "background-color:skyblue;";
    grid += `<div style="${outer}"></div>`;

    grid += `<style>
      @keyframes xpbar_${id} {
        from {
          width: 0px;
        }
        to {
          width: 90px;
        }
      }
    </style>`;
    let inner = absPosStyle([x + 16 + 5, y + 128 + 5]);
    inner += "width:90px;height:10px;";
    inner += "border-radius:5px;";
    inner += "background-color:blue;";
    inner += "animation-duration:3s;";
    inner += `animation-name:xpbar_${id};`;
    grid += `<div style="${inner}"></div>`;
  }
  grid += "</div>";

  res.send(`
    <h1> You have ${inv.length} seeds. </h1>
    ${grid}
    <script>
    setInterval(async () => {
      let res = await fetch("/farm/shouldreload");
      let { reload } = await res.json();

      if (reload)
        window.location.reload();
    }, 1000/5);
    </script>
  `);
})

app.get('/shouldreload', (req, res) => {
  res.send({ reload: shouldReload });
  shouldReload = false;
});

app.get('/plant/:id', (req, res) => {
  const { id } = req.params;

  if (inv.length >= 1) {
    let page = '<h2>';
    page += 'These are the seeds you have in your inventory:';
    page += '</h2>';
    page += '<div style="width:400px;">';
    let x = 0;
    for (let item of inv)
      page += imageHTML({
        size: 120,
        href: `/farm/plant/${id}/${item}`,
        art: ART[item]
      });
    page += '</div>';

    res.send(page);

    return;
  }
  res.redirect("/farm");
});

app.get('/plant/:id/:seed', (req, res) => {
  const { id, seed } = req.params;

  let seedI = inv.indexOf(seed);
  if (seedI >= 0) {
    inv.splice(seedI, 1);
    let plant = plants.find(p => p.id == id); 
    plant.kind = evolve(seed);
    res.redirect("/farm");
    return;
  }
  throw new Error("you don't have that kind of seed!");
});

setInterval(() => {
  for (let plant of plants)
    if (plant.kind) {
      plant.age++;
      plant.xp++;
      if (plant.age % 49 == 0) {
        shouldReload = true;
        plant.xp += 5;
        inv.push(devolve(plant.kind));
      }
    }
}, 1000/5);

fullApp.use('/farm', app);
fullApp.listen(port, () => console.log(`Example app listening on port ${port}`))
