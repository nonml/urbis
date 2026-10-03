// Golden maps (M0-7): the five seeds' maps, frozen so a placement change is a
// diff a commit has to declare. `node scripts/map-golden.mjs` rewrites
// tests/golden/map-<seed>.json; `--seed N --print` prints one seed's map, which
// is how tests/golden.test.js checks the live derivations against the files.
// Every golden seed is generated, and the five are 7, 11, 22, 33, 73 — the
// roadmap's standing meaning of "five seeds" (docs/ROADMAP.md).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setWorldSeed } from '../src/sim/seedstore.js';

const SEEDS = [7, 11, 22, 33, 73];
const DIR = 'tests/golden';

// render/signs.js's own guard, kept in step: a content error degrades to a
// missing sign, never a dead boot. `npm run validate` proves the shipped defs
// pass, so this only catches a hand edit the validator was not run on.
const validSign = (s) => s && typeof s.text === 'string' && typeof s.sub === 'string'
  && /^#[0-9a-fA-F]{6}$/.test(s.color || '') && [-1, 0, 1].includes(s.side)
  && typeof s.z === 'number' && typeof s.y === 'number';

// One generated seed's map: the district and road graph, the lots, the pinned
// towers, the street furniture, the signs, the story places and the spawn —
// the same shape M3.T8's createMap(seed) returns. Sim modules read the world
// seed when they are first evaluated, so a map is built in a fresh process:
// the parent below spawns itself once per seed.
async function buildMap(seed) {
  setWorldSeed(seed, true);
  const { DISTRICTS, NODES, EDGES } = await import('../src/sim/world.js');
  const { WORLD_PLAN } = await import('../src/sim/layout.js');
  const { PINNED_TOWERS } = await import('../src/sim/landmarks.js');
  const { WORLD_FURNITURE } = await import('../src/sim/furniture.js');
  const { WORLD_DRESSING } = await import('../src/sim/dressing.js');
  const { SPAWN } = await import('../src/sim/spawn.js');
  const { SUBSTATIONS, PURSUIT_HOMES } = await import('../src/sim/anchors.js');
  const { ARC } = await import('../src/sim/arc.js');
  const { worldSigns } = await import('../src/sim/streetscape.js');
  const defs = JSON.parse(readFileSync('src/content/signs.json', 'utf8'));

  const district = DISTRICTS[0];
  return {
    seed,
    district: {
      id: district.id,
      avenues: district.avenues,
      crossings: district.crossings,
      walk: district.walk,
      drive: district.drive,
    },
    graph: { nodes: NODES, edges: EDGES },
    lots: WORLD_PLAN.lots,
    pinned: PINNED_TOWERS,
    lamps: WORLD_FURNITURE.lamps,
    signs: worldSigns(defs.filter(validSign)),
    shops: WORLD_DRESSING.shops,
    parked: WORLD_FURNITURE.parked,
    story: {
      places: ARC.places,
      signs: ARC.signs,
      substations: SUBSTATIONS,
      pursuitHomes: PURSUIT_HOMES,
    },
    spawn: SPAWN,
  };
}

// The child's whole stdout is the map; warnings belong on stderr.
const childMap = (seed) => execFileSync(
  process.execPath,
  [import.meta.filename, '--seed', String(seed), '--print'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

const args = process.argv.slice(2);
const seedArg = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : null;

if (seedArg !== null && args.includes('--print')) {
  process.stdout.write(`${JSON.stringify(await buildMap(seedArg), null, 2)}\n`);
} else if (seedArg !== null) {
  writeFileSync(`${DIR}/map-${seedArg}.json`, childMap(seedArg));
  console.log(`wrote ${DIR}/map-${seedArg}.json`);
} else {
  mkdirSync(DIR, { recursive: true });
  for (const seed of SEEDS) {
    writeFileSync(`${DIR}/map-${seed}.json`, childMap(seed));
    console.log(`wrote ${DIR}/map-${seed}.json`);
  }
}
