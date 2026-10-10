// M6.T8 / M6-4 (docs/ROADMAP.md M6, "Bollards"): posts rise across a junction;
// a car that hits them stops dead; traffic reroutes; a chasing cruiser stops.
//
// What this file proves, all of it in src/sim/traffic.js and src/sim/wanted.js:
//   1. the state the hack leaves: one junction, for BOLLARD_SECS on the sim's own
//      clock, and a node that is not a junction refuses it;
//   2. a car stops dead on the posts and nothing crosses, while the same car on
//      the same clock drives through them;
//   3. the traffic reroutes: a route planned with posts up never runs over the
//      junction, and a car already routed through it takes the way round;
//   4. a chasing cruiser stands off the posts the way a car does;
//   5. a unit watching them raising the tier on cause `hack`, tagged `bollards`
//      so dispatch names them (dispatch.js HACK_LINES);
//   6. the A/B the criterion names, over the live fleet on a generated town
//      (tests/accept/lib/ab.js, one seed per worker): the commuters whose trips
//      run over the junction are late, the block's shops lose the trade they
//      bring, and every district outside that reach is bit-identical (M4-5).
//
// The page half fires it the way a player does: __game.pose stands the body
// where the sim itself says a junction is aimed, the real H key throws the
// junction's BOLLARDS, and the sim's own cars, the tier and the dispatch radio
// say what happened. The drawn posts are src/render/bollards.js's half — one
// InstancedMesh whatever the map does — proved Node-side at the foot of this file.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { waitGame } from './lib/input.js';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11];
const SEED = 7;
const DT = 0.05;
const VMAX = 13.5;
// How close to the junction a car stands at the posts on: the queue the posts
// leave, the reach a jam's queue takes.
const POST_HOLD = 12;
const steps = (secs) => Math.round(secs / DT);
const lenOf = (by, e) => Math.hypot(by.get(e.b).x - by.get(e.a).x, by.get(e.b).z - by.get(e.a).z);

let mods = null;
const load = async () => mods ??= {
  map: await import('../../src/sim/map.js'),
  traffic: await import('../../src/sim/traffic.js'),
  wanted: await import('../../src/sim/wanted.js'),
  dispatch: await import('../../src/sim/dispatch.js'),
};

// ---------------------------------------------------------------------------
// The A/B worker, one seed per process on the A/B runner (lib/ab.js, M0.T4):
// the same fleet and the same seconds in every run, only the junction's posts
// differing. The seed is set before src/sim/ is evaluated, which is why this
// file imports nothing from src/sim/ at its top.
if (process.argv[2] === '--ab') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { runAB } = await import('./lib/ab.js');
  const { districtReport } = await import('../../src/sim/economy.js');
  const { hackBollards, bollardPosts, BOLLARD_SECS } = await import('../../src/sim/traffic.js');

  const AT = 95, SECS = AT + 120;
  let fired = null, seen = null, firedAt = 0, bucket = -1;
  await runAB({
    seed, at: AT, secs: SECS, checkpoints: [AT + 20, SECS],
    sample: ({ base, poked }, t) => {
      const traffic = poked.street.traffic, flow = traffic.flow;
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
          firedAt = t;
          bucket = flow.bucket;
          hackBollards(traffic, best.node);
        }
      }
      // The last reading inside the hour the flow was laid with the junction on
      // it: the flow re-lays on every game hour and routes round the posts, so
      // the reach the commuters began the hour with is the one the shut makes
      // late. The economy is read well inside that hour, on the tick the shut
      // has had time to land on, with the posts still up and the flow in force.
      if (!fired || t < firedAt + 15) return;
      if (!flow || flow.stage !== 'ready' || flow.bucket !== bucket) return;
      if (!bollardPosts(traffic, traffic.time).some((p) => p.node === fired.node)) return;
      seen = {
        base: districtReport(base.city), poked: districtReport(poked.city),
        reach: Object.keys(flow.jam[fired.node] ?? {}).map(Number),
      };
    },
  });
  if (!fired) throw new Error(`seed ${seed}: no junction commuters drive through`);
  const reached = [], outside = [];
  for (let z = 0; z < seen.base.length; z++) {
    const a = seen.base[z], b = seen.poked[z];
    const row = {
      zone: z, late: +(b.commute.late - a.commute.late).toFixed(4),
      wealth: +(b.wealth - a.wealth).toFixed(4), com: +(b.demand.com - a.demand.com).toFixed(4),
      same: JSON.stringify(a) === JSON.stringify(b),
    };
    (seen.reach.includes(z) ? reached : outside).push(row);
  }
  process.stdout.write(`${JSON.stringify({ seed, fired, reach: seen.reach, reached, outside })}\n`);
  process.exit(0);
}

// The worker that derives the page half's stand from the same map, city and
// street the game boots: a junction with the most commuters over it, and a
// stand the sim's own aim picks it from, on foot, with nothing else in the
// cone that could take the aim.
if (process.argv[2] === '--stand') {
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  const { WALK_BOUNDS } = await import('../../src/sim/world.js');
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet, tickStreet, districtAt } = await import('../../src/sim/street.js');
  const { createHackables, hackablesNear, aimTarget, AIM_COS } = await import('../../src/sim/hackables.js');

  const map = createMap(SEED), city = createCity(SEED, map), street = createStreet(SEED, map);
  for (let t = 0; t < 120; t += 0.05) tickStreet(street, 0.05);
  const reg = createHackables({ map, city, street });
  const inWalk = (x, z) => x > WALK_BOUNDS.minX + 2 && x < WALK_BOUNDS.maxX - 2
    && z > WALK_BOUNDS.minZ + 2 && z < WALK_BOUNDS.maxZ - 2;
  const solid = (x, z) => map.parcels.some((p) => p.stage >= STAGE.LOW
    && Math.abs(x - p.x) <= p.w / 2 + 0.7 && Math.abs(z - p.z) <= p.d / 2 + 0.7);

  function stand(target) {
    for (const r of [5, 6, 8, 10, 13, 16, 20]) {
      for (let a = 0; a < 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        const px = target.x + Math.cos(ang) * r, pz = target.z + Math.sin(ang) * r;
        if (!inWalk(px, pz) || solid(px, pz)) continue;
        const yaw = Math.atan2(target.x - px, target.z - pz);
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const pick = (ox, oz) => aimTarget(reg, ox, oz, fx, fz)?.entry ?? null;
        if (pick(px, pz) !== target) continue;
        if ([0, 1.5, 3, 4.4].some((fwd) => pick(px + fx * fwd, pz + fz * fwd) !== target)) continue;
        if ([1.5, 3].some((fwd) => !inWalk(px + fx * fwd, pz + fz * fwd) || solid(px + fx * fwd, pz + fz * fwd))) continue;
        if (districtAt(street, px, pz) !== districtAt(street, px + fx * 1.5, pz + fz * 1.5)) continue;
        const other = hackablesNear(reg, px, pz, 40).some(({ entry }) => entry !== target
          && ((entry.x - px) * fx + (entry.z - pz) * fz)
          / Math.max(Math.hypot(entry.x - px, entry.z - pz), 0.01) >= AIM_COS);
        if (other) continue;
        return { px: +px.toFixed(2), pz: +pz.toFixed(2), yaw: +yaw.toFixed(3), r };
      }
    }
    return null;
  }

  const by = street.traffic.flow?.jam ?? {};
  const junctions = reg.list.filter((e) => e.kind === 'junction')
    .map((e) => ({ e, through: Object.values(by[e.ref.id] ?? {}).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.through - a.through)
    .map((c) => ({ e: c.e, at: stand(c.e) })).filter((c) => c.at);
  const hit = junctions[0];
  if (!hit) throw new Error(`seed ${SEED}: no junction with a stand`);
  process.stdout.write(`${JSON.stringify({
    node: hit.e.ref.id, x: hit.e.x, z: hit.e.z, cost: hit.e.cost, stand: hit.at,
  })}\n`);
  process.exit(0);
}

const WORLD = JSON.parse(
  execFileSync(process.execPath, [FILE, '--stand'], { encoding: 'utf8' }).trim());

const menuOf = (page) => page.evaluate(() => {
  const el = document.getElementById('hackmenu');
  return {
    open: el?.style.display === 'block',
    text: el?.textContent ?? '',
    rows: [...(el?.querySelectorAll('[data-row]') ?? [])].map((r) => ({
      text: r.textContent, sel: r.dataset.sel === '1',
    })),
  };
});
const menuShown = (page) => page.waitForFunction(
  () => document.getElementById('hackmenu')?.style.display === 'block',
  null, { polling: 'raf', timeout: 20000 });

// A junction with all four legs: two ways meeting, each with a way out the
// other side long enough to take the cars the crossing discharges. `through`
// is one edge the car drives in by, `out` the one it would leave by. `state` is
// the caller's own, since the police read the live one.
function junctionOf(traffic, map, state, minLeg = 60) {
  const by = new Map(map.graph.nodes.map((n) => [n.id, n]));
  // A junction a cruiser can reach: inside the drive box the police are kept to.
  const { minX, maxX, minZ, maxZ } = map.district.drive;
  const drivable = (p) => p.x > minX + 25 && p.x < maxX - 25 && p.z > minZ + 25 && p.z < maxZ - 25;
  let best = null;
  for (const j of state.signals) {
    const at = by.get(j);
    if (!at || !drivable(at)) continue;
    const edges = map.graph.edges.filter((e) => e.a === j || e.b === j);
    const near = (e) => (e.a === j ? e.b : e.a);
    const twoWays = ['x', 'z'].every((axis) => edges.filter((e) => e.axis === axis).length >= 2);
    const exits = edges.every((e) => map.graph.edges.some((g) => g !== e && g.axis === e.axis
      && (g.a === j || g.b === j) && g.a !== near(e) && g.b !== near(e)));
    if (!twoWays || !exits || !edges.every((e) => lenOf(by, e) >= minLeg)) continue;
    const score = Math.min(...edges.map((e) => lenOf(by, e)));
    if (!best || score > best.score) best = { j, edges, score, by };
  }
  if (!best) return null;
  const through = best.edges.find((e) => lenOf(best.by, e) > minLeg);
  const out = best.edges.find((e) => e !== through && lenOf(best.by, e) > 30);
  return { ...best, through, out };
}

// A page-side read of the live fleet's nearest car to the junction, with the
// frame loop's own advance() running the street between samples.
const fleet = (page) => page.evaluate(() => window.__game.scorecard.cars());
const skip = (page, secs) => page.evaluate((s) => window.__game.advance(s), secs);

test('the hack posts one junction for BOLLARD_SECS and refuses a node that is not one', async () => {
  const { map: mapMod, traffic } = await load();
  const map = mapMod.createMap(SEED);
  const state = traffic.createTraffic(map, SEED, 0);
  const setup = junctionOf(traffic, map, state);
  expect(setup, 'a junction with all four legs').toBeTruthy();
  const other = [...state.signals].find((id) => id !== setup.j);
  expect(other, 'another junction to leave alone').toBeTruthy();
  const node = state.byId.get(setup.j);
  expect(traffic.hackBollards(state, setup.j)).toBe(traffic.BOLLARD_SECS);
  expect(traffic.bollardsUp(state, setup.j), 'the posts are up at it').toBe(true);
  expect(traffic.bollardsUp(state, other), 'and nowhere else').toBe(false);
  expect(traffic.bollardsAt(state, node.x, node.z)).toBe(setup.j);
  expect(traffic.bollardsAt(state, node.x + traffic.JAM_REACH, node.z)).toBe(setup.j);
  expect(traffic.bollardsAt(state, node.x + traffic.JAM_REACH + 2, node.z)).toBe(null);
  expect(traffic.bollardsAt(null, node.x, node.z), 'no running sim, no posts').toBe(null);
  // The posts retract on the sim's own clock, like every other deadline.
  for (let i = 0; i < steps(traffic.BOLLARD_SECS + 1); i++) traffic.tick(state, DT);
  expect(traffic.bollardsUp(state, setup.j), 'the posts retract').toBe(false);
  // A node that is not a junction refuses, and posts nothing.
  const stray = map.graph.nodes.find((n) => !state.signals.has(n.id));
  expect(stray, 'a node that is not a junction').toBeTruthy();
  expect(traffic.hackBollards(state, stray.id)).toBe(0);
  expect(traffic.bollardsAt(state, stray.x, stray.z)).toBe(null);
});

test('a car stops dead on the posts and the same car drives through without them', async () => {
  const { map: mapMod, traffic } = await load();
  for (const seed of SEEDS) {
    const map = mapMod.createMap(seed);
    const setup = junctionOf(traffic, map, traffic.createTraffic(map, seed, 0));
    expect(setup, `seed ${seed}: a junction with all four legs`).toBeTruthy();
    const run = (post) => {
      const state = traffic.createTraffic(map, seed, 0);
      const edge = map.graph.edges.find((e) => (e.a === setup.j || e.b === setup.j)
        && lenOf(setup.by, e) > 60);
      const exit = map.graph.edges.find((e) => e !== edge && e.axis === edge.axis
        && (e.a === setup.j || e.b === setup.j) && e.a !== (edge.b === setup.j ? edge.a : edge.b)
        && e.b !== (edge.b === setup.j ? edge.a : edge.b) && lenOf(setup.by, e) > 30);
      const dir = edge.b === setup.j ? 1 : -1;
      const s0 = lenOf(setup.by, edge) - traffic.STOP_LINE - 20;
      const at = traffic.lanePoint(map, edge, dir, s0);
      const goal = exit.b === setup.j ? exit.a : exit.b;
      const car = {
        id: 'approach', route: [edge.id, exit.id], leg: 0, lane: 0, dir, s: s0, v: VMAX,
        turn: null, prev: { x: at.x, z: at.z }, axis: edge.axis, speed: VMAX, goal, ...at,
      };
      if (post) expect(traffic.hackBollards(state, setup.j)).toBe(traffic.BOLLARD_SECS);
      state.cars.push(car);
      let minGap = Infinity, stopped = false, crossed = false;
      for (let i = 0; i < steps(post ? traffic.BOLLARD_SECS + 5 : 12); i++) {
        traffic.tick(state, DT);
        minGap = Math.min(minGap, Math.hypot(car.x - setup.by.get(setup.j).x, car.z - setup.by.get(setup.j).z));
        if (car.v === 0) stopped = true;
        if (car.leg > 0) crossed = true;
      }
      return { minGap, stopped, crossed };
    };
    const posts = run(true);
    const open = run(false);
    // It drives up to the line and stops dead there: nothing crosses the posts,
    // and its nose never gets past the line.
    expect(posts.stopped, `seed ${seed}: the car that hits them stops`).toBe(true);
    expect(posts.crossed, `seed ${seed}: nothing crosses the junction`).toBe(false);
    expect(posts.minGap, `seed ${seed}: it stops at the line, not in the box`)
      .toBeGreaterThan(traffic.STOP_LINE - 0.5);
    // The same car on the same clock with no posts drives through, so the posts
    // are what stopped it and not the car or the clock.
    expect(open.crossed, `seed ${seed}: the same car drives straight through`).toBe(true);
  }
});

test('traffic reroutes round the posts, and never routes a trip through them', async () => {
  const { map: mapMod, traffic } = await load();
  const map = mapMod.createMap(SEED);
  const state = traffic.createTraffic(map, SEED, 0);
  const setup = junctionOf(traffic, map, state);
  const { through, out } = setup;
  const far = through.b === setup.j ? through.a : through.b;
  // An edge into `far` the car is driving now, with a route that runs over the
  // junction two legs out — the car that has not reached them yet.
  const onto = map.graph.edges.find((e) => e !== through && (e.a === far || e.b === far)
    && lenOf(setup.by, e) > 40);
  const goal = out.b === setup.j ? out.a : out.b;
  const dir = onto.b === far ? 1 : -1;
  const s0 = lenOf(setup.by, onto) - traffic.STOP_LINE - 12;
  const at = traffic.lanePoint(map, onto, dir, s0);
  const car = {
    id: 'reroute', route: [onto.id, through.id, out.id], leg: 0, lane: 0, dir, s: s0, v: VMAX,
    turn: null, prev: { x: at.x, z: at.z }, axis: onto.axis, speed: VMAX, goal, ...at,
  };
  expect(traffic.hackBollards(state, setup.j)).toBe(traffic.BOLLARD_SECS);
  state.cars.push(car);
  const touches = (route) => route.some((id) => {
    const e = state.edgeById.get(id);
    return !!e && (e.a === setup.j || e.b === setup.j);
  });
  // No trip is ever planned over the posts: the way round is the only way, so
  // the cars the town rolls after this never aim at the junction at all.
  const round = traffic.findRoute(state, far, goal);
  expect(round, 'the junction still has a way round it').toBeTruthy();
  expect(touches(round), 'and no planned route runs over the posts').toBe(false);
  expect(touches(car.route), 'the car starts routed through them').toBe(true);
  for (let i = 0; i < steps(6); i++) traffic.tick(state, DT);
  expect(touches(car.route), 'the car takes the way round').toBe(false);
  expect(car.goal, 'and keeps the destination it had').toBe(goal);
});

test('a chasing cruiser stands off the posts, and reaches the suspect without them', async () => {
  const { map: mapMod, traffic, wanted: wantedMod } = await load();
  for (const seed of SEEDS) {
    // A fresh map for each run: the posts are the map's own, so the run without
    // them must not be standing on the run with.
    const chase = (post) => {
      const map = mapMod.createMap(seed);
      const state = traffic.createTraffic(map, seed, 0);
      // The state is this run's own: liveTraffic() names the last one made, so
      // the cruiser reads the posts this run puts up.
      const setup = junctionOf(traffic, map, state);
      const node = state.byId.get(setup.j);
      const back = setup.through.b === setup.j ? setup.through.a : setup.through.b;
      const from = state.byId.get(back);
      const hero = {
        x: node.x, z: node.z, yaw: 0, inCar: true, car: { speed: 0 }, body: {}, cover: false, night: false,
      };
      const w = wantedMod.createWanted(map);
      wantedMod.forceTier(w, 1, hero, 0, map);
      // A unit on the approach, 18 m back, driving at the suspect across the posts.
      const dx = node.x - from.x, dz = node.z - from.z;
      const len = Math.hypot(dx, dz);
      Object.assign(w.pursuit[0], {
        x: node.x - (dx / len) * 18, z: node.z - (dz / len) * 18,
        yaw: Math.atan2(dx, dz), speed: 0, active: true, leaving: false,
      });
      if (post) expect(traffic.hackBollards(state, setup.j)).toBe(traffic.BOLLARD_SECS);
      let minGap = Infinity, stood = false;
      for (let i = 0; i < steps(12); i++) {
        wantedMod.tickWanted(w, DT, hero, (i + 1) * DT, map);
        minGap = Math.min(minGap, Math.hypot(w.pursuit[0].x - node.x, w.pursuit[0].z - node.z));
        if (w.pursuit[0].speed === 0) stood = true;
      }
      return { minGap, stood };
    };
    const held = chase(true);
    const open = chase(false);
    expect(held.stood, `seed ${seed}: the cruiser stops on them`).toBe(true);
    expect(held.minGap, `seed ${seed}: and stops short of the junction`).toBeGreaterThan(3);
    expect(open.minGap, `seed ${seed}: without posts the same cruiser reaches across it`)
      .toBeLessThan(held.minGap - 3);
  }
});

test('a unit watching the posts raising the tier, and dispatch naming them', async () => {
  const { map: mapMod, traffic, wanted: wantedMod, dispatch: dispatchMod } = await load();
  const map = mapMod.createMap(SEED);
  const state = traffic.createTraffic(map, SEED, 0);
  const setup = junctionOf(traffic, map, state);
  const node = state.byId.get(setup.j);
  const hero = {
    x: node.x + 8, z: node.z + 8, yaw: 0, inCar: false, car: { speed: 0 }, body: {}, cover: false, night: false,
  };
  const throwAt = (watch) => {
    const w = wantedMod.createWanted(map);
    wantedMod.forceTier(w, 1, hero, 0, map);
    const at = watch
      ? { x: node.x + 6, z: node.z + 6 }
      : { x: node.x + 300, z: node.z + 300 };
    Object.assign(w.pursuit[0], { x: at.x, z: at.z, yaw: 0, y: 0, speed: 0, active: true, leaving: false });
    traffic.hackBollards(state, setup.j);
    for (let i = 0; i < steps(0.5); i++) wantedMod.tickWanted(w, DT, hero, (i + 1) * DT, map);
    const event = wantedMod.drainEvents(w)[0];
    const d = dispatchMod.createDispatch(20260916, map);
    if (event) dispatchMod.tickDispatch(d, [event], event.time);
    return { heat: w.heat, event, radio: d.lines.map((l) => `${l.speaker}: ${l.text}`) };
  };
  const watched = throwAt(true);
  expect(watched.heat, 'the unit watching them raises the tier').toBe(2);
  expect(watched.event?.cause).toBe('hack');
  expect(watched.event?.hack).toBe('bollards');
  expect(watched.radio.join(' '), 'dispatch names the bollards across the street')
    .toContain('BOLLARDS up across');
  const unseen = throwAt(false);
  expect(unseen.heat, 'no unit watching, the tier stands where it was').toBe(1);
});

test('A/B: the commuters through the posts are late and the block\'s shops lose trade', async () => {
  test.setTimeout(240000);
  for (const seed of SEEDS) {
    const r = JSON.parse(execFileSync(process.execPath, [FILE, '--ab', String(seed)],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim());
    const note = `seed ${seed}: junction ${r.fired.node} through ${r.fired.through} residents,`
      + ` reach ${JSON.stringify(r.reach)}, ` + r.reached.map((d) =>
        `z${d.zone} late ${d.late} wealth ${d.wealth} com ${d.com}`).join(' · ');
    expect(r.reached.length, `${note}: districts the posts reach`).toBeGreaterThan(0);
    for (const d of r.reached) {
      expect(d.late, `${note}: z${d.zone} commuters late`).toBeGreaterThan(0.05);
      expect(d.wealth, `${note}: z${d.zone} wealth`).toBeLessThan(-0.05);
      expect(d.com, `${note}: z${d.zone} commerce demand`).toBeLessThan(-0.02);
    }
    expect(r.outside.filter((d) => !d.same).map((d) => d.zone),
      `${note}: districts outside reach ${JSON.stringify(r.reach)} changed`).toEqual([]);
  }
});

// The drawn posts: one InstancedMesh whatever the map does (law 4), rising out
// of the road while the posts are up and retracting on the same clock.
test('the posts are one instanced mesh that rises out of the road', async () => {
  const THREE = await import('three');
  const { buildBollards, updateBollards, bollardRise, POSTS_PER_JUNCTION, MAX_JUNCTIONS, POST_H, RISE_SECS }
    = await import('../../src/render/bollards.js');
  const scene = new THREE.Scene();
  const rig = buildBollards(scene);
  expect(scene.children, 'the posts are in the scene the player looks at').toContain(rig.mesh);
  expect(rig.mesh.isInstancedMesh).toBe(true);
  expect(rig.mesh.count).toBe(MAX_JUNCTIONS * POSTS_PER_JUNCTION);
  expect(rig.mesh.castShadow).toBe(true);
  const posts = [
    { node: 1, x: 10, z: 10, at: 0, until: 100 },
    { node: 2, x: -40, z: 60, at: 1000, until: 4000 },
  ];
  // Nothing is drawn before the fire.
  updateBollards(rig, posts, -1);
  expect(sizeOf(rig, THREE).every((s) => s === 0), 'no post stands before the hack').toBe(true);
  // Rising: the fired junction's posts stand up out of the road, and the
  // junction that has not been thrown at yet carries nothing.
  updateBollards(rig, posts, RISE_SECS);
  expect(sizeOf(rig, THREE).filter((s) => s > 0.5).length, 'one junction of posts at full height')
    .toBe(POSTS_PER_JUNCTION);
  // The pool draws a post of POST_H standing out of the road: the instance
  // scales the geometry from its foot, so full rise is the whole post.
  expect(rig.mesh.geometry.parameters.height, 'the post is POST_H tall').toBe(POST_H);
  // Standing while they are up, and gone again once they have retracted.
  updateBollards(rig, posts, 50);
  expect(sizeOf(rig, THREE)[0], 'they stand until the posts retract').toBeCloseTo(1, 5);
  updateBollards(rig, posts, 100 + RISE_SECS * 2);
  expect(sizeOf(rig, THREE).every((s) => s === 0), 'and retract on the same clock').toBe(true);
  // The rise is its own curve: none before the fire, all of it after RISE_SECS,
  // standing until they retract, and gone again once they have.
  expect(bollardRise(posts[0], -1)).toBe(0);
  expect(bollardRise(posts[0], RISE_SECS / 2)).toBeCloseTo(0.5, 5);
  expect(bollardRise(posts[0], RISE_SECS * 2)).toBe(1);
  expect(bollardRise(posts[0], 100 + RISE_SECS / 2)).toBeCloseTo(0.5, 5);
  expect(bollardRise(posts[0], 100 + RISE_SECS * 2)).toBe(0);
});

// The drawn height of every instance in the posts' pool.
function sizeOf(rig, THREE) {
  const out = [];
  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), size = new THREE.Vector3();
  for (let i = 0; i < rig.mesh.count; i++) {
    m4.fromArray(rig.mesh.instanceMatrix.array, i * 16).decompose(pos, quat, size);
    out.push(+size.y.toFixed(4));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The page half: fired by aim and key, the way a player does.
async function boot(page, errors) {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
}

async function stand(page) {
  const { px, pz, yaw } = WORLD.stand;
  await page.evaluate(([x, z, y]) => window.__game.pose(x, z, y), [px, pz, yaw]);
  await page.evaluate(([fx, fz]) => window.__game.scorecard.simWalk(0.35, fx, fz),
    [Math.sin(yaw), Math.cos(yaw)]);
  await page.waitForFunction(
    (want) => document.getElementById('aim')?.textContent === want,
    `JUNCTION · ₡${WORLD.cost}`, { polling: 'raf', timeout: 20000 });
}

test('M6.T8: the real H key posts the aimed junction, a car stops dead on the posts, and the radio names them', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  await stand(page);
  // A unit standing where it can see the junction the player is aiming at.
  await page.evaluate(([x, z]) => {
    const g = window.__game;
    g.police.reset();
    g.police.tier(1);
    g.police.unit(0, x + 6, z + 6, Math.PI);
  }, [WORLD.x, WORLD.z]);

  // The junction carries two hacks and ALL-GREEN is not built: the key is the
  // hold menu, the way a player reaches the second row (M6.T3).
  await page.keyboard.down('h');
  await menuShown(page);
  await page.keyboard.up('h');
  const menu = await menuOf(page);
  expect(menu.rows.map((r) => r.text),
    'the menu lists the junction\'s hacks').toEqual([`ALL-GREEN · ₡2`, `BOLLARDS · ₡${WORLD.cost}`]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitGame(page, 0.3);
  expect((await menuOf(page)).open, 'the hack the menu fires closes the menu').toBe(false);
  const fired = await page.evaluate(() => ({
    at: window.__game.player(), heat: window.__game.heat(),
    radio: window.__game.wanted().radio, dark: window.__game.dark(),
  }));
  expect(Math.hypot(fired.at.x - WORLD.x, fired.at.z - WORLD.z),
    'the player stands at the junction the stand aimed at').toBeLessThan(20);
  expect(fired.dark, 'the bollards black out no district').toEqual([false, false]);
  expect(fired.heat, 'the unit watching the posts raising the tier').toBe(2);
  expect(fired.radio.join(' '), 'dispatch names the bollards').toContain('BOLLARDS up across');

  // The street's own fleet, watched over the posts' own window: nothing crosses
  // the junction, and a car that drives up to them stops dead there. Only the
  // moving fleet counts: a parked car stands at a kerb either way.
  let minGap = Infinity, heldFor = 0, last = [];
  for (let i = 0; i < 30; i++) {
    const cars = (await fleet(page)).filter((c) => !c.parked);
    await skip(page, 2);
    const now = cars.map((c) => Math.hypot(c.x - WORLD.x, c.z - WORLD.z));
    minGap = Math.min(minGap, ...now);
    // A car the next sample finds on the same spot is a car standing at them.
    const held = now.some((d, k) => d < POST_HOLD
      && last.some((p) => Math.hypot(p[0] - cars[k].x, p[1] - cars[k].z) < 0.05));
    if (held) heldFor += 1;
    last = cars.map((c) => [c.x, c.z]);
  }
  expect(heldFor, 'a car stands at the posts for seconds at a time').toBeGreaterThan(2);
  expect(minGap, 'and nothing crosses them').toBeGreaterThan(3.5);
  expect(errors, 'no page error on the way').toEqual([]);
});
