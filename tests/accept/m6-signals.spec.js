// M6.T7 / M6-4 (docs/ROADMAP.md M6, "Traffic signals"): the ALL-GREEN hack on a
// junction's lights, and the sim it works on.
//
// What this file proves, all of it in src/sim/traffic.js:
//   1. the state the hack leaves, and the junctions it touches and does not;
//   2. cars brake, nobody gets into the crossing's box, and the queue does not
//      clear while the lights are jammed — the runs differ in the jam and in
//      nothing else (hand-placed queues, the shape tests/traffic.test.js and
//      m5-junctions.test.js place theirs in);
//   3. what the jam costs the junction, against what the same queue pays at
//      working lights;
//   4. the A/B the criterion names, over the live fleet on a generated town
//      (tests/accept/lib/ab.js, one seed per worker): the commuters whose trips
//      run over the junction are late, the block's shops lose the trade they
//      bring, and every district outside that reach is bit-identical (M4-5).
//
// What it does not prove, and why: firing the hack by aim and key, a unit that
// watches it raising heat, and a cruiser stuck in it are the applier's and the
// police's (src/game/input.js's onFire, src/sim/wanted.js's drive) — files this
// task does not own. EVERY-M6-hack's firing line is `dispatch`'s own, already
// green in tests/accept/m6-t6.spec.js, which names ALL-GREEN for a witnessed
// hack of every kind; the radio line is therefore not re-proved here.
//
// Nothing from src/sim/ is imported at the top of the file: the A/B worker sets
// the world seed its generated town is built from first (lib/ab.js's own guard,
// and m4-local's rule), so every reader goes through load().
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const SEED = 7;
const DT = 0.05;
// How fast a car drives up to the line on its own speed limit: the jam is what
// has to stop it (traffic.js VMAX).
const VMAX = 13.5;
const QUEUE = 5;                 // cars behind the line on every way
const QUEUE_GAP = 4.5 + 2.5;     // CAR_LEN + GAP_MIN, the closest a car follows
const TAIL = 40;                 // after the jam: the lights come back and it clears
const steps = (secs) => Math.round(secs / DT);
const lenOf = (by, e) => Math.hypot(by.get(e.b).x - by.get(e.a).x, by.get(e.b).z - by.get(e.a).z);

let mods = null;
const load = async () => mods ??= {
  map: await import('../../src/sim/map.js'),
  traffic: await import('../../src/sim/traffic.js'),
};

// ---------------------------------------------------------------------------
// The A/B worker, one seed per process on the A/B runner (lib/ab.js, M0.T4):
// the same fleet and the same seconds in every run, only the junction's lights
// differing. The seed is set before src/sim/ is evaluated, which is why this
// file imports nothing from src/sim/ at its top.
if (process.argv[2] === '--ab') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { runAB } = await import('./lib/ab.js');
  const { districtReport } = await import('../../src/sim/economy.js');
  const { hackSignals, ALL_GREEN_SECS } = await import('../../src/sim/traffic.js');

  const AT = 90, MEASURE = AT + 60, SECS = AT + ALL_GREEN_SECS + 20;
  let fired = null, seen = null;
  await runAB({
    seed, at: AT, secs: SECS, checkpoints: [MEASURE, SECS],
    sample: ({ base, poked }, t) => {
      const flow = poked.street.traffic.flow;
      if (!fired && t >= AT && flow?.stage === 'ready' && Object.keys(flow.jam).length > 0) {
        // The junction the most commuters drive through, among the ones the
        // fewest districts drive through: the block's own, as the task names it.
        let best = null;
        for (const [node, by] of Object.entries(flow.jam)) {
          const through = Object.values(by).reduce((a, b) => a + b, 0);
          const zones = Object.keys(by).length;
          if (!best || zones < best.zones || (zones === best.zones && through > best.through)) {
            best = { node, through, zones };
          }
        }
        if (best && best.through > 0) {
          fired = best;
          hackSignals(poked.street.traffic, best.node);
        }
      }
      // The last reading while the jam is still running, on a flow in force:
      // the very map tickJam weighs when it makes those commuters late. The
      // flow is re-laid on every game hour, so a reading is taken each tick it
      // is in force and the last one stands.
      if (t < MEASURE || poked.street.traffic.flow?.stage !== 'ready') return;
      const until = poked.street.traffic.greenUntil.get(fired.node);
      if (until !== undefined && poked.street.traffic.time >= until) return;
      const by = poked.street.traffic.flow.jam[fired.node];
      seen = {
        base: districtReport(base.city), poked: districtReport(poked.city),
        reach: by ? Object.keys(by).map(Number) : [],
      };
    },
  });
  if (!fired) throw new Error(`seed ${seed}: no junction commuters drive through`);
  const reached = [], outside = [];
  for (let z = 0; z < seen.base.length; z++) {
    const a = seen.base[z], b = seen.poked[z];
    const row = {
      zone: z, name: a.name, late: +(b.commute.late - a.commute.late).toFixed(4),
      wealth: +(b.wealth - a.wealth).toFixed(4), com: +(b.demand.com - a.demand.com).toFixed(4),
      same: JSON.stringify(a) === JSON.stringify(b),
    };
    (seen.reach.includes(z) ? reached : outside).push(row);
  }
  process.stdout.write(`${JSON.stringify({ seed, fired, reach: seen.reach, reached, outside })}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// A junction with all four legs: two ways meeting, each with a way out the
// other side long enough to take the cars the crossing discharges. The jam
// needs traffic coming in on both ways, so this is the junction the task names.
async function junctionOf(map, minLeg = 60) {
  const { traffic } = await load();
  const by = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const probe = traffic.createTraffic(map, map.seed, 0);
  let best = null;
  for (const j of probe.signals) {
    const edges = map.graph.edges.filter((e) => e.a === j || e.b === j);
    const near = (e) => (e.a === j ? e.b : e.a);
    const twoWays = ['x', 'z'].every((axis) => edges.filter((e) => e.axis === axis).length >= 2);
    const exits = edges.every((e) => map.graph.edges.some((g) => g !== e && g.axis === e.axis
      && (g.a === j || g.b === j) && g.a !== near(e) && g.b !== near(e)));
    if (!twoWays || !exits || !edges.every((e) => lenOf(by, e) >= minLeg)) continue;
    const score = Math.min(...edges.map((e) => lenOf(by, e)));
    if (!best || score > best.score) best = { j, edges, score, by };
  }
  return best;
}

// The queues standing behind the line on every way, nose to tail from it back,
// driving at the speed limit: the demand, and it is the same queue in every run.
async function queuesOf(map, setup) {
  const { traffic } = await load();
  const { edges, j, by } = setup;
  const cars = [];
  for (const e of edges) {
    const dir = e.b === j ? 1 : -1;
    const near = dir > 0 ? e.a : e.b;
    const exit = map.graph.edges.find((g) => g !== e && g.axis === e.axis && (g.a === j || g.b === j)
      && g.a !== near && g.b !== near);
    if (!exit) continue;
    const stop = lenOf(by, e) - traffic.STOP_LINE;
    for (let i = 0; i < QUEUE; i++) {
      const s = stop - 8 - i * QUEUE_GAP;
      if (s < 2) break;
      const at = traffic.lanePoint(map, e, dir, s);
      cars.push({
        id: `${e.id}:${dir}:${i}`, route: [e.id, exit.id], leg: 0, lane: 0, dir, s, v: VMAX,
        turn: null, prev: { x: at.x, z: at.z }, axis: e.axis, speed: VMAX, ...at,
      });
    }
  }
  return cars;
}

// One run of the queues: the lights jammed or not, and the same clock in every
// run. What is measured, inside the jam's own window: the cars that got into
// the junction's box, the cars that crossed it, the seconds its ways sat green
// while held, the lowest speed any car held, and what the crossing cost.
async function runQueue(map, setup, jam) {
  const { traffic } = await load();
  const state = traffic.createTraffic(map, map.seed, 0);
  if (jam) expect(traffic.hackSignals(state, setup.j)).toBe(traffic.ALL_GREEN_SECS);
  state.cars = (await queuesOf(map, setup)).map((c) => ({ ...c, prev: { ...c.prev } }));
  const until = jam ? state.greenUntil.get(setup.j) : traffic.ALL_GREEN_SECS;
  const inBox = new Set(), crossed = [];
  let greenSecs = 0, minV = Infinity, braked = false;
  for (let i = 0; i < steps(traffic.ALL_GREEN_SECS + TAIL); i++) {
    traffic.tick(state, DT);
    // The window both runs report over: the jam's own for the jammed run (the
    // tick the lights come back is its release, and a car let off the line on
    // that tick is not something the jam held back), the same span for the
    // lights, so the two runs measure the same stretch of the same queue.
    const window = state.time <= until;
    for (const c of state.cars) {
      const line = lenOf(state.byId, state.edgeById.get(c.route[0])) - traffic.STOP_LINE;
      if (c.leg === 0) {
        if (c.v < VMAX - 1) braked = true;
        if (window) {
          minV = Math.min(minV, c.v);
          if (c.s > line + 1e-6) inBox.add(c.id);
          if (traffic.signalGreen(c.axis, state.time)) greenSecs += DT;
        }
      } else if (window && !crossed.includes(c.id)) crossed.push(c.id);
    }
  }
  return { inBox: inBox.size, crossed: crossed.length, greenSecs, minV, braked,
    wait: traffic.junctionWait(state, setup.j) };
}

test('the hack jams one junction green and touches no other', async () => {
  const { map: mapMod, traffic } = await load();
  const map = mapMod.createMap(SEED);
  const state = traffic.createTraffic(map, SEED, 0);
  const setup = await junctionOf(map);
  expect(setup, 'a junction with all four legs').toBeTruthy();
  const other = [...state.signals].find((id) => id !== setup.j);
  expect(other, 'another junction to leave alone').toBeTruthy();
  const node = state.byId.get(setup.j);
  expect(traffic.hackSignals(state, setup.j)).toBe(traffic.ALL_GREEN_SECS);
  // Only the junction it was thrown at is jammed: the others keep the two-phase
  // light they ran, so every other junction's cars behave exactly as before.
  expect(traffic.allGreen(state, setup.j)).toBe(true);
  expect(traffic.allGreen(state, other)).toBe(false);
  // A junction that is not a junction at all refuses, so nothing is jammed by
  // a call that has no light to jam.
  const stray = map.graph.nodes.find((n) => !state.signals.has(n.id));
  expect(stray, 'a node that is not a junction').toBeTruthy();
  expect(traffic.hackSignals(state, stray.id)).toBe(0);
  expect(state.greenUntil.size, 'the refusal jammed nothing').toBe(1);
  // The jam stands back from the junction by a car and its gap — the queue it
  // leaves behind — and no further.
  expect(traffic.jamAt(state, node.x, node.z)).toBe(setup.j);
  expect(traffic.jamAt(state, node.x + traffic.JAM_REACH, node.z)).toBe(setup.j);
  expect(traffic.jamAt(state, node.x + traffic.JAM_REACH + 2, node.z)).toBe(null);
  expect(traffic.jamAt(null, node.x, node.z), 'no running sim, no jam').toBe(null);
});

test('cars brake, the box fills and the queue does not clear while the lights are jammed', async () => {
  const { map: mapMod } = await load();
  for (const seed of SEEDS) {
    const map = mapMod.createMap(seed);
    const setup = await junctionOf(map);
    expect(setup, `seed ${seed}: a junction with all four legs`).toBeTruthy();
    const jam = await runQueue(map, setup, true);
    const lights = await runQueue(map, setup, false);
    const note = `seed ${seed}: jam ${jam.crossed} crossed / ${jam.greenSecs.toFixed(0)}s green`
      + ` / box ${jam.inBox} · lights ${lights.crossed} crossed / box ${lights.inBox}`;
    // The lights are green on every way at once: its ways sit green for seconds
    // at a time and not one car crosses, because the box is what holds them,
    // not the light.
    expect(jam.greenSecs, `${note}: green seconds the jam was held through`).toBeGreaterThan(5);
    expect(jam.crossed, `${note}: cars that crossed while the lights were jammed`).toBe(0);
    expect(jam.inBox, `${note}: cars that got into the box`).toBe(0);
    // They brake from the speed limit to a stand, and stay standing.
    expect(jam.braked, `${note}: cars braked`).toBe(true);
    expect(jam.minV, `${note}: the lowest speed held behind the line`).toBe(0);
    // The same queue on the same clock with the lights working does clear, so
    // the jam is what stops it and not the queue or the clock.
    expect(lights.crossed, `${note}: the same queue on working lights`).toBeGreaterThanOrEqual(4);
    expect(lights.inBox, `${note}: cars the lights sent into the box`).toBeGreaterThan(0);
  }
});

test('the jam is what costs the junction: A/B the mean wait at one junction', async () => {
  const { map: mapMod, traffic } = await load();
  const map = mapMod.createMap(SEED);
  const setup = await junctionOf(map);
  const jam = await runQueue(map, setup, true);
  const lights = await runQueue(map, setup, false);
  const note = `jam ${jam.wait.mean.toFixed(1)}s over ${jam.wait.cars} cars`
    + ` · lights ${lights.wait.mean.toFixed(1)}s over ${lights.wait.cars} cars`;
  // Every car the jam held waited out the jam: the lights come back, the queue
  // clears, and what it cost is the jam itself.
  expect(jam.wait.cars, `${note}: cars the jam held`).toBeGreaterThanOrEqual(8);
  expect(jam.wait.mean, `${note}: the jam's mean wait`).toBeGreaterThan(traffic.ALL_GREEN_SECS * 0.8);
  expect(lights.crossed, `${note}: the lights cleared the same queue`).toBeGreaterThanOrEqual(4);
});

test('A/B: the commuters through the jam are late and the block\'s shops lose trade', async () => {
  test.setTimeout(240000);
  for (const seed of SEEDS) {
    const r = JSON.parse(execFileSync(process.execPath, [FILE, '--ab', String(seed)],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim());
    const note = `seed ${seed}: junction ${r.fired.node} through ${r.fired.through} residents,`
      + ` reach ${JSON.stringify(r.reach)}, ` + r.reached.map((d) =>
        `z${d.zone} late ${d.late} wealth ${d.wealth} com ${d.com}`).join(' · ');
    expect(r.reached.length, `${note}: districts the jam reaches`).toBeGreaterThan(0);
    for (const d of r.reached) {
      expect(d.late, `${note}: z${d.zone} commuters late`).toBeGreaterThan(0.05);
      expect(d.wealth, `${note}: z${d.zone} wealth`).toBeLessThan(-0.05);
      // The shops: the trade the late commuters bring, gone from the district.
      expect(d.com, `${note}: z${d.zone} commerce demand`).toBeLessThan(-0.02);
    }
    // M4-5: nothing outside the reach changes — not a demand, not a wealth
    // figure, not one of the numbers a district is.
    expect(r.outside.filter((d) => !d.same).map((d) => d.zone),
      `${note}: districts outside reach ${JSON.stringify(r.reach)} changed`).toEqual([]);
  }
});
