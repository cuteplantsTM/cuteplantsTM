const TIMEOUT = 9000;

const sum = (list) => list.reduce((a, x) => a + x, 0);

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

const otherPlants = (plant) =>
  ["bractus", "hacker", "coffea"].filter((x) => x != plant);

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
        explanation: "compres hak = moar crafty",
      },
      coffea: {
        tooltip:
          "Your Coffea Cyl has found that if it focuses all of its electromagnetic " +
          " intensity on just a handful of Cyl Crystals, it can concentrate all of " +
          " them into one extremely compressed crystcyl.",
        explanation: "compres cofe = moar crafty",
      },
    };

    return Object.fromEntries(
      Object.entries(tooltips).map(([key, { tooltip, explanation }]) => [
        key,
        {
          tooltip,
          explanation,
          needs: Array(5).fill(`essence.0.${key}`),
          makes: () => ({
            items: [`essence.1.${key}`],
            xp: 144,
          }),
          time: 240,
        },
      ])
    );
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

    return Object.fromEntries(
      Object.entries(tooltips).map(([key, { tooltip }]) => [
        key,
        {
          tooltip,
          explanation: "got gud stuf n it, u die tho",
          needs: otherPlants(key)
            .map((p) => Array(5).fill(`essence.1.${p}`))
            .flat(),
          makes: () => {
            const [a, b] = otherPlants(key);
            return {
              items: [
                chooseWeighted({
                  [`egg.${key}`]: 2,
                  [`egg.${a}`]: 99,
                  [`egg.${b}`]: 99,
                }),
              ],
            };
          },
          destroysPlant: true,
          time: 600,
        },
      ])
    );
  })(),
];

module.exports = {
  NAMES,
  RECIPES,
  TIMEOUT,
  online,
  tickClock,
  getPlayer,
  newId,
};
