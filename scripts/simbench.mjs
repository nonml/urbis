// Sim bench (M3-9): on a 2,000-building map with 60 cars, 150 walkers and the
// full commute flow, one 50 ms sim step takes at most 4 ms.
//   node scripts/simbench.mjs [--seed 7] [--steps 1000]
// Times STEPS fixed steps in main.js's tick order after a warmup that converges
// the commute flow and settles the JIT; the hourly flow rebuilds stay inside the
// timed section. PASS when the slowest step is within budget. Pure Node.
import { mulberry32 } from '../src/sim/rng.js';
import { STAGE } from '../src/sim/map.js';
import { createClock, tickClock } from '../src/sim/clock.js';
import { createCity, tickZoning } from '../src/sim/zoning.js';
import { createPeople, tickPeople } from '../src/sim/people.js';
import { createTraffic } from '../src/sim/traffic.js';
import { createWalkers } from '../src/sim/walkers.js';
import { tickCommute } from '../src/sim/commute.js';
import { tickStreet } from '../src/sim/street.js';

const DT = 0.05, BUDGET_MS = 4;
const BUILDINGS = 2000, CARS = 60, WALKERS = 150;
const WARMUP = 200; // flow match (60/tick) + routes (8/tick) converge before timing
const GRID = 12, GAP = 60;
const LINE = 7.5; // landmarks.js BUILD_LINE: a frontage's stand-off from its road

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};

// A connected grid graph with every building fronting an edge, from the seed.
function buildMap(seed) {
  const rng = mulberry32(seed);
  const half = ((GRID - 1) * GAP) / 2;
  const nodes = [];
  for (let ix = 0; ix < GRID; ix++) for (let iz = 0; iz < GRID; iz++)
    nodes.push({ id: `n${ix},${iz}`, x: ix * GAP - half, z: iz * GAP - half, y: 0 });
  const edges = [];
  for (let ix = 0; ix < GRID; ix++) for (let iz = 0; iz < GRID; iz++) {
    if (ix + 1 < GRID) edges.push({ id: `ex${ix},${iz}`, a: `n${ix},${iz}`, b: `n${ix + 1},${iz}`, axis: 'x' });
    if (iz + 1 < GRID) edges.push({ id: `ez${ix},${iz}`, a: `n${ix},${iz}`, b: `n${ix},${iz + 1}`, axis: 'z' });
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const per = Math.ceil(BUILDINGS / edges.length);
  const parcels = [];
  for (let k = 0; k < BUILDINGS; k++) {
    const edge = edges[k % edges.length];
    const a = byId.get(edge.a), b = byId.get(edge.b);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const t = ((Math.floor(k / edges.length) + 0.5) / per) * len;
    const w = 8 + rng() * 6, d = 8 + rng() * 4, h = 6 + rng() * 14;
    const side = k % 2 === 0 ? 1 : -1, use = ['res', 'com', 'ind'][k % 3];
    const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len, off = LINE + d / 2;
    const x = a.x + ux * t + uz * side * off, z = a.z + uz * t - ux * side * off;
    parcels.push({ id: `b:${k}`, kind: ['row', 'tower', 'cap'][k % 3], x, z, w, d, h, use, zoned: use,
      powerZone: z < 0 ? 0 : 1, stage: STAGE.HIGH, heights: [h, h, h, h, h], vacancy: 0 });
  }
  const lots = [];
  for (let i = 0; i < 20; i++) lots.push([-95 + i * 10, 45, 8, 10]);
  return { seed, version: 0, dirty: new Set(), graph: { nodes, edges }, parcels, lots,
    furniture: { parked: [] }, spawn: { player: { x: 0, z: 0, yaw: 0 } } };
}

const seed = arg('--seed', 7), steps = arg('--steps', 1000);
const map = buildMap(seed);
const city = createCity(seed, map);
const spread = mulberry32(seed ^ 0x51ed);
const bodies = Array.from({ length: WALKERS }, () => ({ speed: 0.9 + spread() * 0.8, phase: spread() * 6.28 }));
const traffic = createTraffic(map, seed, CARS);
const walkers = createWalkers(map, seed, bodies);
const street = { time: 0, npcs: walkers.walkers, cars: traffic.cars, traffic, walkers, hurryUntil: 0, lastHack: null,
  zones: [0, 1].map(() => ({ darkUntil: 0, coolUntil: 0, collapseUntil: 0, restoreUntil: 0 })) };
const clock = createClock(), people = createPeople(seed);
const tick = () => {
  tickClock(clock, DT);
  tickStreet(street, DT);
  tickZoning(city, DT, street);
  tickPeople(people, city);
  tickCommute(street, people, city, clock.hour, 0, 0);
};
for (let i = 0; i < WARMUP; i++) tick();
const times = [];
for (let i = 0; i < steps; i++) {
  const t0 = performance.now();
  tick();
  times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
const mean = times.reduce((s, v) => s + v, 0) / times.length;
const max = times[times.length - 1];
const buildings = map.parcels.filter((p) => p.kind !== 'lot').length;
console.log(`simbench seed=${seed} buildings=${buildings} cars=${street.cars.length} walkers=${street.npcs.length} flow=${traffic.flow?.stage ?? 'none'}`);
console.log(`steps=${steps} mean=${mean.toFixed(3)}ms p95=${times[Math.floor(times.length * 0.95)].toFixed(3)}ms max=${max.toFixed(3)}ms budget=${BUDGET_MS}ms`);
const pass = buildings >= BUILDINGS && street.cars.length >= CARS && street.npcs.length >= WALKERS && max <= BUDGET_MS;
console.log(pass ? 'PASS simbench' : 'FAIL simbench');
process.exit(pass ? 0 : 1);
