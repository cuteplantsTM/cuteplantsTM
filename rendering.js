const gameplay = require("./gameplay");
const { RECIPES, NAMES } = gameplay;

const TICK_SECS = 1 / 5 / 5;
const TICK_MS = 1000 * TICK_SECS;

const absPosStyle = ([x, y]) => `position:absolute;left:${x}px;top:${y}px;`;

const invMap = (inv) =>
  inv.reduce((map, i) => map.set(i, 1 + (map.get(i) ?? 0)), new Map());

const plantClass = (item) => item.split(".").slice(-1)[0];

const hasEnough = ({ needs, inv }) => {
  inv = JSON.parse(JSON.stringify(inv));
  for (const item of needs) {
    let i = inv.indexOf(item);
    if (i >= 0) inv.splice(i, 1);
    else return { enough: false };
  }
  return { enough: true, invWithout: inv };
};

const xpLevel = (() => {
  const levels = [
    0, 120, 280, 480, 720, 1400, 1700, 2100, 2700, 3500, 6800, 7700, 8800,
    10100, 11600, 22000, 24000, 26500, 29500, 33000, 37000, 41500, 46500, 52000,
    99991,
  ];

  return (xp) => {
    for (const lvlI in levels) {
      const lvlXp = levels[lvlI];
      if (xp < lvlXp) return { level: lvlI, has: xp, needs: lvlXp };
      xp -= lvlXp;
    }
    return { level: levels.length, has: xp, needs: NaN };
  };
})();

function imageHTML(opts) {
  const { size, href, art, pos, inline = "" } = opts;

  let style = `width:${size}px;height:${size}px;${inline}`;
  if (pos) style += absPosStyle(pos);
  if (opts.style) style += opts.style;

  let img = `<img src="/farm/${art}.png" style="${style}"></img>`;

  if (href) return `<a href="${href}"> ${img} </a>`;
  else return img;
}

const axialHexToPixel = ([x, y]) => [
  90 * (Math.sqrt(3) * x + (Math.sqrt(3) / 2) * y),
  90 * ((3 / 2) * y),
];

function progBar({
  size: [w, h],
  pos: [x, y],
  colors,
  pad,
  has,
  needs,
  id = "defaultBar",
}) {
  const width = 90;
  const duration = (needs - has) * TICK_SECS;
  const prog = has / needs;
  return `
    <div style="
      ${absPosStyle([x, y])}
      z-index:1;
      padding:${pad}px;
      width:${w}px;height:${h}px;
      border-radius:${h / 2}px;
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
      border-radius:${h / 2}px;
      background-color:${colors[1]};
      animation-duration:${duration}s;
      animation-name:xpbar_${id};
      animation-timing-function:linear;
    "></div>`;
}

const neighbors = (() => {
  const offsets = [
    [+1, 0],
    [+1, -1],
    [0, -1],
    [-1, 0],
    [-1, +1],
    [0, +1],
  ];
  return (x, y) => offsets.map(([ox, oy]) => [x + ox, y + oy]);
})();

const INV_GRID_POS = [30, 550];
const PLANT_FOCUS_GRID_POS = [650, 40];

function farmGridHTML({ ground, farm, ghosts, farmXp, focus }) {
  let grid = '<div style="position:relative;top:150px;left:200px;">';

  for (let plant of farm) {
    let { x, y, id, xp, age } = plant;
    [x, y] = axialHexToPixel([x, y]);
    grid += imageHTML({
      pos: [x, y],
      size: 120,
      href: "/farm/plant/" + id,
      art: plant.kind ? plant.kind : "dirt",
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
      const { ageFinished, ageStarted } = plant.craft;
      const have = age - ageStarted;
      const need = ageFinished - ageStarted;
      const prog = have / need;

      const pos = [x + 100, y + 14];
      grid += imageHTML({
        pos,
        size: 40,
        art: plant.craft.makes.items[0],
        style: "opacity:20%;",
      });

      grid += `
      <style>
        @keyframes craft_anim_${id} {
          from { width: 0px; }
          to { width: 40px; }
        }
      </style>
      <div style="
        overflow:hidden;
        animation-name: craft_anim_${id};
        animation-delay:${-TICK_SECS * have}s;
        animation-duration:${TICK_SECS * need}s;
        height:40px;
        ${absPosStyle(pos)}
      ">${imageHTML({
        size: 40,
        art: plant.craft.makes.items[0],
      })}</div>`;
    }
  }

  /* a Set here filters out unnecessary duplicates */
  const surroundings = new Set(
    farm.flatMap((p) => neighbors(p.x, p.y)).map((x) => x.join(","))
  );

  if (farm.length < xpLevel(farmXp).level) {
    for (let neighbor of surroundings) {
      const [nx, ny] = neighbor.split(",");
      if (farm.some((p) => p.x == nx && p.y == ny)) continue;
      grid += imageHTML({
        pos: axialHexToPixel([nx, ny]),
        size: 120,
        href: `/farm/expand/${nx}/${ny}`,
        art: "dirt",
        style: "opacity:0.5;z-index:-0;",
      });
    }
  }

  /* ground items */
  for (let item of ground.concat(ghosts)) {
    let { x, y, id, spawned } = item;

    let style = `z-index:2;`;

    if (gameplay.tickClock - item.spawnTick < 5) {
      style += `animation:item_${id} 0.6s ease-in;`;
      const [from_x, from_y] = item.spawnPos;
      grid += `<style>
        @keyframes item_${id} {
          from {
            left: ${from_x}px;
            top: ${from_y}px;
          }
          50% {
            left: ${(item.x + from_x) / 2}px;
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

    //console.log(x, y);
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

function recipesHTML({ plant, inv }) {
  let box = "";

  for (const [index, recipe] of Object.entries(
    RECIPES.map((r) => r[plantClass(plant.kind)])
  )) {
    let makes = recipe.makes();
    let [iconItem] = makes.items;

    let { enough } = hasEnough({ needs: recipe.needs, inv });
    box += `
      <a
        href="/farm/craft/${plant.id}/${index}"
        style="text-decoration:none;color:black;"
      >
        <div
          class="recipe ${enough ? "recipe-active" : "recipe-na"}"
          style="display:flex;align-items:center;margin:20px;"
        >
          <img
            style="width:40px;height:40px;margin-right:10px;"
            src="/farm/${iconItem}.png"
          ></img>
          <div style="width:250px;overflow:hidden;">
            <h3 style="margin:0px;padding:5px;">${NAMES[iconItem]}</h3>
            <p style="margin:0px;padding:5px;">${recipe.explanation}</p>
          </div>
      `;

    let mins = (recipe.time * TICK_SECS) / 60;
    box += "<div>";
    box += `<h3 style="margin:0px;padding:0px;">${mins.toFixed(1)} min</h3>`;

    const invmap = invMap(inv);
    const needsmap = invMap(recipe.needs);
    for (const [item, amount] of needsmap) {
      const has = invmap.get(item) ?? 0;
      box += `<p style="margin:0px;${has < amount ? "color:red;" : ""}">`;
      box += `x${amount} `;
      box += `<img
            style="width:1.25em;height:1.25em;position:relative;top:0.3em;"
            src="/farm/${item}.png"
          ></img>`;
      box += ` ${NAMES[item]} <br>`;
      box += "</p>";
    }
    box += "</div>";

    box += "</div></a>";
  }

  return box;
}

function plantFocusHTML({ plant, inv, activeTabIndex }) {
  let box = `<div style="${absPosStyle(PLANT_FOCUS_GRID_POS)}width:500px;">`;
  box += `<h1 style="margin:0px 0px 8px 0px;">${NAMES[
    plant.kind
  ].toUpperCase()}</h1>`;
  box += `<hr style="border-color:black;margin:0px;" />`;

  const tabs = [
    ["craft", () => recipesHTML({ plant, inv })],
    ["skills", () => "<h1>uh</h1>"],
  ];
  const [activeTab, activeTabHTML] = tabs[activeTabIndex];

  const tabTitles = tabs.map(([tab], i) => {
    let style = "text-decoration:none;";
    if (tab == activeTab) style += `color:crimson;`;
    else style += "color:black;";
    return `<a href="/farm/switchtab/${i}" style="${style}">${tab}</a>`;
  });
  box += `<h2 style="margin:0px;"> ${tabTitles.join(" | ")} </h2>`;
  box += `<hr style="border-color:black;margin:0px;" />`;

  box += activeTabHTML();

  box += `</div>`;
  return box;
}

module.exports = {
  xpLevel,
  plantClass,
  hasEnough,
  progBar,
  farmGridHTML,
  invGridHTML,
  INV_GRID_POS,
  plantFocusHTML,
  absPosStyle,
  TICK_MS,
  axialHexToPixel,
};
