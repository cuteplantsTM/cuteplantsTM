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

const ART = {
    seeds: {
        bractus: "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/bractus_seed.png?raw=true",
        coffea: "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/coffea_cyl_seed.png?raw=true",
        hacker: "https://github.com/hackagotchi/hackagotchi/blob/master/img/misc/hacker_vibes_vine_seed.png?raw=true",
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

let flat = {};
function flatten(path, obj) {
  for (const [key, val] of Object.entries(obj)) {
    let valpath = (path.length) ? (path + "." + key) : key;
    if (typeof val == "string")
      flat[valpath] = val;
    else
      flatten(valpath, val);
  }
}

let online = 0;
let tickClock = 0;
let playerID = 0;
let seedID = 0;
let playerDatArr = [];

/* takes seed, returns plant */
const evolve = item => "plant." + item.split('.')[1];
/* takes plant, returns seed */
const devolve = item => "seeds." + item.split('.')[2];

let shouldReload = true;


function imageHTML(x, y, size, href, art) {
    console.log(x + " : " + y + " : " + size + " : " + href + " : "  + art);
    let style = `position:absolute;`;
    style += `left:${x*120}px;top:${y*120}px;`;
    style += `width:120px;height:120px;`;

    let img = `<img src="${art}" style="${style}"></img>`;

    return `<a href="${href}"> ${img} </a>`;
}

app.get('/', (req, res) => {
    //on no save
    if (typeof req.session.sav == "undefined") {
        req.session.sav = {};
        //populate inventory with default items
        req.session.sav.inv = [
            "seeds.bractus",
            "seeds.coffea",
            "seeds.hacker"
        ] 
        req.session.sav.farm = [];

        for (let x = 0; x < 3; x++)
            for (let y = 0; y < 3; y++)
                req.session.sav.farm.push({
                    x,
                    y,
                    age: 0,
                    id: seedID++
                });
        req.session.playerID = playerID++;
    }

    let grid = '<div style="position:relative;">';
    for (let plant of req.session.sav.farm) {
        let {
            x,
            y,
            id
        } = plant;
        let art = (plant.kind) ? ART[plant.kind] : ART.dirt;
        grid += imageHTML(x, y, 120, '/farm/plant/' + id, art);
    }
    grid += "</div>";

    res.send(`
        <title>cuteplantsTM ${online} Online</title>
        <h1> You have ${req.session.sav.inv.length} seeds. </h1>
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
    let globDat = playerDatArr.find((player) => player.playerID === req.session.sav.playerID);
    globDat = req.session.sav;

})

app.get('/shouldreload', (req, res) => {
    res.send({
        reload: shouldReload
    });
    shouldReload = false;
});

app.get('/plant/:id', (req, res) => {
    const {
        id
    } = req.params;

    if (req.session.sav.inv.length >= 1) {
        let page = '<h2>';
        page += 'These are the seeds you have in your inventory:';
        page += '</h2>';
        page += '<div style="position:relative;">';
        let x = 0;
        for (let item of req.session.sav.inv ) {
            let link = `/farm/plant/${id}/${item}`;
            page += imageHTML(x++, 0, 30, link, ART[item]);
        }
        page += '</div>';

        res.send(page);

        return;
    }
    res.redirect("/farm");
});

app.get('/plant/:id/:seed', (req, res) => {
    const {
        id,
        seed
    } = req.params;

    let seedI = req.session.sav.inv.indexOf(seed);

    if (seedI >= 0) {
        req.session.sav.inv.splice(seedI, 1);
        let plant = req.session.sav.farm.find(p => p.id == id);
        plant.kind = evolve(seed);
        res.redirect("/farm");
        return;
    }
    throw new Error("you don't have that kind of seed!");
});

setInterval(() => {
    tickClock++
    for (let player of playerDatArr) {
        for (let plant of player.farm) {
            if (plant.kind) {
                plant.age++;
                if (plant.age % 49 == 0) {
                    shouldReload = true;
                    req.session.sav.inv.push(devolve(plant.kind));
                }
            }
        }
    }
}, 1000 / 5);

fullApp.use('/farm', app);
fullApp.listen(port, () => console.log(`Example app listening on port ${port}`))