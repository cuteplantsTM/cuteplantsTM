const express = require("express");
var cookieSession = require("cookie-session");
const fullApp = express();
const app = express.Router();
fullApp.set("trust proxy", 1); // trust first proxy
const port = 3008;

let {
  TICK_MS,
  evolutionStage,
  hasEnough,
  tickClock,
  players,
  newId,
  getPlayer,
  plantClass,
  xpLevel,
} = require("./utils");
const { RECIPES } = require("./data");
const {
  axialHexToPixel,
  progBar,
  farmGridHTML,
  invGridHTML,
  plantFocusHTML,
  absPosStyle,
  INV_GRID_POS,
} = require("./rendering");

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

app.use(express.static("img"));

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

  const player = getPlayer(req.session.playerId);
  const { activeTabIndex, farm, ground, ghosts, inv, selected, xp } = player;
  let focus = farm.find((p) => p.id == selected);

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
    ${farmGridHTML({ ground, farm, ghosts, farmXp: xp, focus })}
    ${invGridHTML({ inv, pos: INV_GRID_POS })}
    ${selected ? plantFocusHTML({ plant: focus, inv, activeTabIndex }) : ""}
    <h2 style="${absPosStyle([515, 26])}">lvl ${level}</h2>
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

app.get("/expand/:x/:y", (req, res) => {
  getPlayer(req.session.playerId).farm.push({
    x: +req.params.x,
    y: +req.params.y,
    age: 0,
    id: newId(),
  });
  res.redirect("/farm");
});

app.get("/grab/:id", (req, res) => {
  const { id } = req.params;
  const player = getPlayer(req.session.playerId);
  const { inv, ground, ghosts, xp } = player;
  const groundAfter = JSON.parse(JSON.stringify(ground));

  player.xp += 50;

  const pickUp = (item) => {
    ground.splice(ground.indexOf(item), 1);
    inv.push(item.kind);
    ghosts.push(item);
    setTimeout(() => ghosts.splice(ghosts.indexOf(item), 1), 500);
  };

  const dist = (lhs, rhs) => {
    let dx = lhs.x - rhs.x,
      dy = lhs.y - rhs.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  let item = ground.find((i) => i.id == id);
  if (item) ground.filter((o) => dist(o, item) < 5).forEach(pickUp);

  res.redirect("/farm");
});

app.get("/plant/:id", (req, res) => {
  const { id } = req.params;
  const player = getPlayer(req.session.playerId);
  const { farm, inv } = player;

  let plot = farm.find((p) => p.id == id);
  if (!plot) {
  } else if (plot.kind) {
    player.selected = id;
  } else if (inv.length >= 1) {
    let page = GLOBAL_STYLE + "<h2>";
    page += "These are the seeds you have in your inventory:";
    page += "</h2>";
    page += invGridHTML({
      inv,
      pos: [50, 50],
      href: (item) => `/farm/plant/${id}/${item}`,
    });
    return res.send(page);
  }
  res.redirect("/farm");
});

app.get("/switchtab/:tabIndex", (req, res) => {
  getPlayer(req.session.playerId).activeTabIndex = +req.params.tabIndex;
  res.redirect("/farm");
});

app.get("/craft/:plantId/:recipeIndex", (req, res) => {
  const { plantId, recipeIndex } = req.params;
  const player = getPlayer(req.session.playerId);
  const { farm, inv } = player;

  const plant = farm.find((p) => p.id == plantId);
  if (!plant.kind || plant.craft) return res.redirect("/farm");

  const recipe = RECIPES.map((r) => r[plantClass(plant.kind)])[recipeIndex];
  if (!recipe) return res.redirect("/farm");

  const { enough, invWithout } = hasEnough({ needs: recipe.needs, inv });
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
  const seeds = inv.filter((i) => /^seed/.test(i));

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
      href: (item) => `/farm/plant/${id}/${item}`,
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
    for (let plant of player.farm)
      if (plant.kind) {
        /* out of your plant, and onto the ground! */
        const dropItem = (kind) => {
          player.shouldReload = true;
          let [x, y] = axialHexToPixel([plant.x, plant.y]);
          x += 128 * 0.4;
          y += 128 * 0.6;
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

        /* reload if the plant's leveled up */
        const { level } = xpLevel(plant.xp);
        if (level != xpLevel(plant.xp - 1).level) player.shouldReload = true;

        /* reload if the plant's art's switched */
        const pClass = plantClass(plant.kind);
        let newKind = `plant.${evolutionStage(level)}.${pClass}`;
        if (newKind !== plant.kind) plant.kind = newKind;

        /* figure out if this plant is going to yield now */
        let speedNow = 100;
        for (let i = 0; i < level; i++) speedNow /= 1.1;

        if (plant.age % Math.round(speedNow) == 0) {
          plant.xp += 5;
          dropItem("essence.0." + plantClass(plant.kind));
        }

        /* is your craft finished? */
        if (plant.craft && plant.age >= plant.craft.ageFinished) {
          plant.xp += plant.craft.makes.xp;
          for (const item of plant.craft.makes.items) dropItem(item);
          player.shouldReload = true;
          delete plant.craft;
        }
      }
  }
}, TICK_MS);

fullApp.use(process.env.PROD ? "/" : "/farm", app);
fullApp.listen(port, () =>
  console.log(`Example app listening on port ${port}`)
);
