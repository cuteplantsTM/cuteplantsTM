const express = require('express')
const app = express()
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

/* EXAMPLE:
     input: index(NAMES, "plants.0.bractus"),
     output: "bractus loaf"
*/
const index = (obj, string) => string.split('.').reduce((o, x) => o[x], obj);

let plants = [];
for (let x = 0; x < 3; x++)
    for (let y = 0; y < 3; y++)
        plants.push({ x, y, occupied: false, age: 0, id: newId() });


function imageHTML(x, y, size, href, art) {
    let style = `position:absolute;`
    style += `left:${x*120}px;top:${y*120}px;`;
    style += `width:120px;height:120px;`;

    let img = `<img src="${art}" style="${style}"></img>`;

    return`<a href="${href}"> ${img} </a>`;
}

app.get('/data', (req, res) => {
  res.send({ plants, seeds });
});

app.get('/', (req, res) => {
    let grid = '<div style="position:relative;">';
    for (let plant of plants) {
        let { x, y, id } = plant;
        let art = (plant.occupied) ? ART.icon : ART.dirt;
        grid += imageHTML(x, y, 120, '/farm/plant/' + id, art);
    }
    grid += "</div>";

    res.send(`
      <h1> You have ${inv.length} seeds. </h1>
      ${grid}
    `);
})

app.get('/plant/:id', (req, res) => {
    if (seeds >= 1) {
        seeds -= 1;
        let current = plants.find(p => p.id == req.params.id); 
        current.occupied = true;

        res.send(`
          These are the seeds you have in your inventory:
        `);

        return;
    }
    res.redirect("/farm");
});

setInterval(() => {
  for (let plant of plants)
    if (plant.occupied) {
      plant.age++;
      if (plant.age % 49 == 0)
        seeds++;
    }
}, 1000/5);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
