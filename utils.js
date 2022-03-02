/* Net Constants */

const TICK_SECS = 1 / 5 / 5;
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

const sum = (list) => list.reduce((a, x) => a + x, 0);
const otherPlants = (plant) =>
  ["bractus", "hacker", "coffea"].filter((x) => x != plant);

const evolutionStage = (level) => {
  if (level < 5) return 0;
  else if (level < 10) return 1;
  else if (level < 15) return 2;
  else return 3;
};

const hasEnough = ({ needs, inv }) => {
  inv = JSON.parse(JSON.stringify(inv));
  for (const item of needs) {
    let i = inv.indexOf(item);
    if (i >= 0) inv.splice(i, 1);
    else return { enough: false };
  }
  return { enough: true, invWithout: inv };
};

/* EXAMPLE:
 input: chooseWeighted({ a: 4, b: 1 })
 output: "b" 1/5 of the time
*/
const chooseWeighted = (opts) => {
  let r = Math.random() * sum(Object.values(opts));
  return Object.keys(opts).find((k) => (r -= opts[k]) < 0);
};

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
    let newPlayer = {};

    newPlayer.playerId = pId;

    //populate inventory with default items
    newPlayer.inv = ["seed.bractus", "seed.coffea", "seed.hacker"];
    newPlayer.xp = 0;
    newPlayer.farm = [];
    newPlayer.ground = [];
    /* ghosts are items that were on the ground that linger for a bit
       so that they can be animated as they move to the inventory */
    newPlayer.ghosts = [];

    newPlayer.farm.push({
      x: 0,
      y: 0,
      age: 0,
      id: newId(),
    });
    newPlayer.activeTabIndex = 0;

    players.push(newPlayer);
    return newPlayer;
  }
}

const invMap = (inv) =>
  inv.reduce((map, i) => map.set(i, 1 + (map.get(i) ?? 0)), new Map());

const plantClass = (item) => item.split(".").slice(-1)[0];

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

module.exports = {
  TICK_SECS,
  TICK_MS,
  TIMEOUT,
  flatten,
  sum,
  otherPlants,
  evolutionStage,
  hasEnough,
  chooseWeighted,
  online,
  tickClock,
  players,
  newId,
  getPlayer,
  invMap,
  plantClass,
  xpLevel,
};
