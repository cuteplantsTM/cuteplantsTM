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
let playerID = 0;
let seedID = 0;
let playerDatArr = [];

function updateDat(player) {
    let globDat = playerDatArr.find((dat) => dat.playerID == player.playerID);
    globDat = player;
}

function getPl(playerID) {
    return playerDatArr.find((player) => player.playerID == playerID);
}

/* takes seed, returns plant */
const evolve = item => "plants.0." + item.split('.')[1];
/* takes plant, returns seed */
const devolve = item => "seeds." + item.split('.')[2];


function imageHTML(x, y, size, href, art) {
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
        updateDat(req.session.sav);
        req.session.sav.shouldReload = true;
    } else /* if theres a cookie save, grab the global updates*/ {
        req.session.sav = getPl(req.session.sav.playerID);
    }

    let grid = '<div style="position:relative;">';
    //console.log(req.session.sav.farm);
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

    updateDat(req.session.sav);

    console.log("farm: " + req.session.sav.farm)

    res.send(`
        <title>cuteplantsTM ${online} Online</title>
        <h1> You have ${req.session.sav.inv.length} seeds. </h1>
        ${grid}
        <script>
        setInterval(async () => {
          let res = await fetch("/farm/shouldreload");
          let { reload } = await res.json();

          console.log(reload);

          if (reload)
            window.location.reload();
        }, 1000/10);
        </script>
    `);

})

app.get('/shouldreload', (req, res) => {
    if (req.session.sav.shouldReload)
        req.session.sav.shouldReload = !req.session.sav.shouldReload;
    res.send({
        reload: req.session.sav.shouldReload
    });
});

app.get('/plant/:id', (req, res) => {
    req.session.sav = getPl(req.session.sav.playerID);
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
    updateDat(req.session.sav);
});

setInterval(() => {
    tickClock++
    for (let player of playerDatArr) {
        console.log("player: " + player)
        for (let plant of player.farm) {
            if (plant.kind) {
                plant.age++;
                if (plant.age % 49 == 0) {
                    console.log("tick plant")
                    player.shouldReload = true;
                    player.inv.push(devolve(plant.kind));
                }
            }
        }
    }
}, 1000 / 5);

fullApp.use('/farm', app);
fullApp.listen(port, () => console.log(`Example app listening on port ${port}`))