// The A/B runner (docs/plan/TASKS.md M0.T5, criterion M0-4).
//
// Boots the pure sim in Node from one seed, then steps two worlds from the same
// seed in main.js's tick order — tickClock, tickStreet, tickZoning, tickPeople —
// in the frame loop's own 50 ms step. A is the untouched control; B gets
// `poke(poked, base, t)` every step at or after `at`. `diff` is B minus A,
// per district, at every checkpoint. `sample(worlds, t)` is the per-step hook
// the economy probe classifies demand with.
//
// One seed per process: src/sim/layout.js and world.js build the map at module
// evaluation from the world seed (seedstore.js), so a second seed in one process
// would silently reuse the first map. scripts/economy-probe.mjs spawns one worker
// per seed; a test that wants several seeds must spawn too.
//
// Pure Node: no three.js, no DOM, no browser.
//
//   node tests/accept/lib/ab.js    # self-check: unpoked B equals A; a poke
//                                  # leaves the other district untouched
import { pathToFileURL } from 'node:url';
import { setWorldSeed } from '../../../src/sim/seedstore.js';

export const DT = 0.05;
const ZONES = 2;
const HEIGHT_EPS = 1e-6;

let sim = null;
let simSeed = null;

// Import src/sim/ after the seed is set. Dynamic on purpose: a static import of
// layout.js would evaluate the map before setWorldSeed runs.
async function loadSim(seed) {
  if (sim) {
    if (simSeed !== seed) {
      throw new Error(`ab: sim booted for seed ${simSeed}; one seed per process`);
    }
    return sim;
  }
  setWorldSeed(seed, true);
  const loaded = {
    clock: await import('../../../src/sim/clock.js'),
    street: await import('../../../src/sim/street.js'),
    zoning: await import('../../../src/sim/zoning.js'),
    economy: await import('../../../src/sim/economy.js'),
    people: await import('../../../src/sim/people.js'),
    layout: await import('../../../src/sim/layout.js'),
  };
  if (!loaded.layout.WORLD_PLAN) {
    throw new Error('ab: src/sim/ was evaluated before the seed was set; import it through ab.js');
  }
  sim = loaded;
  simSeed = seed;
  return sim;
}

function floorsIn(city, zone, heightOf, storey) {
  return city.parcels
    .filter((p) => p.powerZone === zone)
    .reduce((sum, p) => sum + Math.floor(heightOf(p) / storey + HEIGHT_EPS), 0);
}

function makeWorld(s, seed) {
  const city = s.zoning.createCity(seed);
  const street = s.street.createStreet(seed);
  const clock = s.clock.createClock();
  const people = s.people.createPeople(seed);
  const thresholds = s.zoning.probeThresholds();
  return {
    seed, city, street, clock, people,
    thresholds,
    market: s.economy.probeConstants(),
    // main.js's order, its 50 ms step.
    tick() {
      s.clock.tickClock(clock, DT);
      s.street.tickStreet(street, DT);
      s.zoning.tickZoning(city, DT, street);
      s.people.tickPeople(people, city);
    },
    heightOf: s.zoning.builtHeight,
    isLow: (p) => p.stage >= s.zoning.STAGE.LOW,
    zone: (index, use) => s.zoning.zoneParcel(city, index, use),
    hack: (zone) => s.street.hackBlackout(street, zone),
    chase: (zone, tier) => s.economy.chaseIn(city.economy, zone, tier),
    snapshot() {
      return city.economy.districts.map((d, z) => ({
        floors: floorsIn(city, z, s.zoning.builtHeight, thresholds.storey),
        jobs: Math.round(d.jobs),
        homes: Math.round(d.homes),
        demand: { res: d.demand.res, com: d.demand.com, ind: d.demand.ind },
      }));
    },
  };
}

// `secs` is how long both worlds run. `checkpoints` are the game seconds a
// per-district snapshot is recorded at (default: the end). Returns
// series.base[z] / series.poked[z] / diff[z], each a list of
// { t, floors, jobs, homes, demand } points per district.
export async function runAB({
  seed, poke = null, at = 0, secs, sample = null, checkpoints = null,
}) {
  const s = await loadSim(seed);
  const ticks = Math.round(secs / DT);
  const cpAt = new Map((checkpoints ?? [secs]).map((t) => [Math.round(t / DT), t]));
  const base = makeWorld(s, seed);
  const poked = makeWorld(s, seed);
  const series = { base: [[], []], poked: [[], []] };
  const diff = [[], []];
  for (let i = 0; i < ticks; i++) {
    base.tick();
    poked.tick();
    const t = (i + 1) * DT;
    if (sample) sample({ base, poked }, t);
    if (poke && t >= at) poke(poked, base, t);
    const cp = cpAt.get(i + 1);
    if (cp === undefined) continue;
    const a = base.snapshot();
    const b = poked.snapshot();
    for (let z = 0; z < ZONES; z++) {
      series.base[z].push({ t: cp, ...a[z] });
      series.poked[z].push({ t: cp, ...b[z] });
      diff[z].push({
        t: cp,
        floors: b[z].floors - a[z].floors,
        jobs: b[z].jobs - a[z].jobs,
        homes: b[z].homes - a[z].homes,
        demand: {
          res: b[z].demand.res - a[z].demand.res,
          com: b[z].demand.com - a[z].demand.com,
          ind: b[z].demand.ind - a[z].demand.ind,
        },
      });
    }
  }
  return {
    seed, at, secs, dt: DT, ticks,
    checkpoints: [...cpAt.values()],
    thresholds: base.thresholds,
    market: base.market,
    series, diff,
  };
}

function selfCheckDiff(name, rows) {
  for (const point of rows) {
    for (const metric of ['floors', 'jobs', 'homes']) {
      if (point[metric] !== 0) {
        throw new Error(`ab self-check (${name}): ${metric} ${point[metric]} at t=${point.t}`);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const noPoke = await runAB({ seed: 1, secs: 120, checkpoints: [60, 120] });
  selfCheckDiff('no poke', noPoke.diff.flat());
  let done = false;
  const poked = await runAB({
    seed: 1, at: 60, secs: 240, checkpoints: [120, 240],
    poke: (b) => {
      if (done) return;
      const idx = b.city.parcels.findIndex((p) => p.powerZone === 1 && p.zoned === null);
      if (idx >= 0) { b.zone(idx, 'ind'); done = true; }
    },
  });
  selfCheckDiff('poke leaves district 0', poked.diff[0]);
  console.log(`ab OK — ${noPoke.checkpoints.length + poked.checkpoints.length} checkpoints, no cross-district leak`);
}
