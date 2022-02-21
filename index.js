const express = require('express')
const fullApp = express()
const app = express.Router();
const port = 3008

let idSeed = 0;
const newId = () => idSeed++;

const ART = {
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
};

const NAMES = {
  seeds: {
    bractus: "bractus seed",
    coffea: "coffea cyl seed",
    hacker: "hacker vibes vine seed",
  },
  plants: [{
    bractus: "bractus loaf",
    coffea: "coffea cyl baby",
    hacker: "hacker vibes vine sprout",
  }],
};

let inv = [
  "seeds.bractus",
  "seeds.coffea",
  "seeds.hacker"
];

/* takes seed, returns plant */
const evolve = item => "plants.0." + item.split('.')[1];
/* takes plant, returns seed */
const devolve = item => "seeds." + item.split('.')[2];

/* EXAMPLE:
     input: index(NAMES, "plants.0.bractus"),
     output: "bractus loaf"
*/
const index = (obj, string) => string.split('.').reduce((o, x) => o[x], obj);

let shouldReload = true;
let plants = [];
for (let x = 0; x < 3; x++)
  for (let y = 0; y < 3; y++)
    if (x != y || x == 1)
      plants.push({ x, y, age: 0, id: newId() });


function imageHTML({ size, href, art, pos }) {
  let style = `width:${size}px;height:${size}px;`;
  if (pos) {
    const [x, y] = pos;
    style += `position:absolute;`;
    style += `left:${x}px;top:${y}px;`;
  }

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
    let art = (plant.kind) ? index(ART, plant.kind) : ART.dirt;
    grid += imageHTML({
      pos: axialHexToPixel(x, y),
      size: 120,
      href: '/farm/plant/' + id,
      art
    });
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
        art: index(ART, item)
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
      if (plant.age % 49 == 0) {
        shouldReload = true;
        inv.push(devolve(plant.kind));
      }
    }
}, 1000/5);

fullApp.use('/farm', app);
fullApp.listen(port, () => console.log(`Example app listening on port ${port}`))
