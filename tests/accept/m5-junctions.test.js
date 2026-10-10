// M5-14 (docs/ROADMAP.md): junction control. In the city view the player sets
// any junction to lights, stop signs or yield; the traffic M3 drives obeys the
// control it finds — no car passes a stop line without stopping — and A/B, the
// mean wait at that junction differs from B.
//
// The check is three parts:
//   1. the running game — the palette's junction control tools, a click on a
//      junction in the overview, and the mean wait the city view reads at it;
//   2. Node, with a queue placed by hand in the shape this module reads and
//      writes (tests/traffic.test.js and m5-roadtypes.test.js place theirs the
//      same way), where the runs differ in the junction's control and in
//      nothing else;
//   3. Node, over M3's own fleet on a generated town, which is the A/B the
//      criterion names.
import { test, expect } from '@playwright/test';
import { createMap } from '../../src/sim/map.js';
import {
  JUNCTION_CONTROLS, STOP_HOLD, STOP_LINE, createTraffic, junctionControl, junctionControlOf,
  junctionWait, lanePoint, setJunctionControl, signalGreen, tick,
} from '../../src/sim/traffic.js';

const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const CARS = 60;              // the fleet the live A/B drives
const QUEUE = 12;             // cars standing behind the line
const QUEUE_GAP = 7;          // CAR_LEN + GAP_MIN, the closest a car follows
const COUNT_SECS = 40;        // the window the hand-placed queue is counted over
const WARM_SECS = 60;         // the fleet reaching the town's own rhythm
const MEASURE_SECS = 120;     // the window the fleet's mean wait is measured over
const DIFFER = 0.5;           // seconds: the smallest difference that is one
const PLATOON = 1.1;          // a signal releases a queue in one platoon; a
// stop sign or a yield releases it a car at a time, so the same traffic pays
// more at the junction. The live A/B's ratios run from 1.3 to 5.
const nodesOf = (map) => new Map(map.graph.nodes.map((n) => [n.id, n]));
const lenOf = (by, e) => Math.hypot(by.get(e.b).x - by.get(e.a).x, by.get(e.b).z - by.get(e.a).z);
const steps = (secs) => Math.round(secs / DT);

// A junction to drive at: the longest approach running into one where two ways
// meet, with a road leaving it by the same axis long enough to take the cars
// the junction discharges — m5-roadtypes.test.js's own pick, so the two checks
// measure the same town.
function junctionOf(map, minExit = 100) {
  const by = nodesOf(map);
  const probe = createTraffic(map, map.seed, 0);
  let best = null;
  for (const p of map.graph.edges) {
    if (p.axis !== 'x') continue;
    for (const end of [p.a, p.b]) {
      if (junctionControl(probe, end) === null) continue;
      const g = map.graph.edges.find((e) => e !== p && e.axis === 'x'
        && (e.a === end || e.b === end) && lenOf(by, e) >= minExit);
      if (!g) continue;
      if (!best || lenOf(by, p) > lenOf(by, best.p)) best = { j: end, p, g, by };
    }
  }
  return best;
}

// The queue standing behind the junction's line, nose to tail from it back:
// the demand, and it is the same queue in every run.
function queueOf(map, setup) {
  const { by, j, p, g } = setup;
  const dir = j === p.b ? 1 : -1;
  const line = lenOf(by, p) - STOP_LINE;
  const queue = [];
  for (let i = 0; queue.length < QUEUE; i++) {
    const s = line - i * QUEUE_GAP;
    if (s < 2) break;
    const at = lanePoint(map, p, dir, s);
    queue.push({
      id: i + 1, route: [p.id, g.id], leg: 0, lane: 0, dir, s, v: 0, turn: null,
      prev: { x: at.x, z: at.z }, ...at,
    });
  }
  return { queue, line };
}

// One run of a hand-placed queue: the control is set on the map the city view
// edits before the first tick, and every car is watched for how low its speed
// fell behind the line and when it crossed the junction.
function runQueue(map, setup, control, queue) {
  const state = createTraffic(map, map.seed, 0);
  setJunctionControl(map, setup.j, control);
  state.cars = queue.map((c) => ({ ...c, prev: { ...c.prev } }));
  const stood = new Map();          // car -> the lowest speed it held behind the line
  const crossed = new Map();        // car -> the sim time it crossed the junction
  for (let i = 0; i < steps(COUNT_SECS); i++) {
    tick(state, DT);
    for (const c of state.cars) {
      if (c.leg === 0) stood.set(c.id, Math.min(stood.get(c.id) ?? Infinity, c.v));
      else if (!crossed.has(c.id)) crossed.set(c.id, state.time);
    }
  }
  return { state, stood, crossed, wait: junctionWait(state, setup.j) };
}

for (const control of JUNCTION_CONTROLS) {
  test(`the city view sets a junction to ${control} and M3's cars obey it`, async () => {
    const seed = 7;
    const setup = junctionOf(createMap(seed));
    expect(setup, 'a junction with a road running into it').toBeTruthy();
    const place = createMap(seed);
    const { queue } = queueOf(place, setup);
    expect(queue.length, 'a queue behind the line').toBe(QUEUE);
    // The control is written to the map the city view edits, and the traffic
    // reads the very same record.
    expect(setJunctionControl(place, setup.j, control)).toBe(true);
    expect(junctionControlOf(place, setup.j)).toBe(control);
    const { state, stood, crossed, wait } = runQueue(place, setup, control, queue);
    expect(junctionControl(state, setup.j)).toBe(control);
    expect(crossed.size, 'the queue crossed the junction').toBeGreaterThanOrEqual(6);
    if (control === 'lights') {
      // Nobody crosses while its own axis is not green.
      expect(wait.cars).toBeGreaterThan(0);
      for (const [id, at] of crossed) {
        expect(signalGreen(setup.p.axis, at), `car ${id} crossed on the red`).toBe(true);
      }
    } else if (control === 'stop') {
      // No car passes a stop line without stopping: every car that crossed
      // stood still at the line, for the stop sign's own dwell.
      for (const [id, low] of stood) {
        if (!crossed.has(id)) continue;
        expect(low, `car ${id} passed the stop line without stopping`).toBe(0);
      }
      expect(wait.secs / wait.cars).toBeGreaterThanOrEqual(STOP_HOLD);
    } else {
      // A yield holds a car only for traffic it would cross: with the crossing
      // clear nobody is held for a dwell, and the mean is the queue's own.
      expect(wait.cars).toBeGreaterThan(0);
    }
  });
}

test('a yield holds a car for traffic in the junction and lets it go when clear', async () => {
  const seed = 11;
  const setup = junctionOf(createMap(seed));
  const map = createMap(seed);
  const { queue, line } = queueOf(map, setup);
  const { j } = setup;
  // A car standing in the junction on the crossing way, the one thing a yield
  // gives way to: it stands at the node, at the end of its own route.
  const cross = map.graph.edges.find((e) => e.axis === 'z' && (e.a === j || e.b === j));
  expect(cross, 'a crossing way at that junction').toBeTruthy();
  const dir = cross.b === j ? 1 : -1;
  const at = lanePoint(map, cross, dir, lenOf(setup.by, cross));
  setJunctionControl(map, j, 'yield');
  const state = createTraffic(map, seed, 0);
  state.cars = queue.map((c) => ({ ...c, prev: { ...c.prev } }));
  const blocker = {
    id: 99, route: [cross.id], leg: 0, lane: 0, dir, s: lenOf(setup.by, cross), v: 0,
    turn: null, prev: { x: at.x, z: at.z }, ...at, outside: false, fresh: false,
    axis: cross.axis, speed: 0,
  };
  state.cars.push(blocker);
  const leader = state.cars[0];
  for (let i = 0; i < steps(20); i++) {
    tick(state, DT);
    expect(leader.leg, 'a car passed a junction another car was standing in').toBe(0);
  }
  expect(leader.s).toBeLessThanOrEqual(line);
  // The crossing clears: the same car goes, without having stood for a stop
  // sign's dwell.
  state.cars.splice(state.cars.indexOf(blocker), 1);
  for (let i = 0; i < steps(20) && leader.leg === 0; i++) tick(state, DT);
  expect(leader.leg, 'a yield let the car go once the junction was clear').toBeGreaterThan(0);
});

// The criterion's A/B (M5-14): one junction, one queue standing behind its
// line, the same clock in every run — only the control the junction runs
// differs. The mean wait is what that control costs the cars that cross it.
test('A/B: the mean wait at one junction differs between lights, stop and yield', async () => {
  const seed = 11;
  const setup = junctionOf(createMap(seed));
  const means = {};
  for (const control of JUNCTION_CONTROLS) {
    const map = createMap(seed);
    const { queue } = queueOf(map, setup);
    const { wait, crossed } = runQueue(map, setup, control, queue);
    expect(crossed.size, `${control}: the queue crossed`).toBeGreaterThanOrEqual(6);
    means[control] = wait.secs / wait.cars;
  }
  const note = `lights ${means.lights.toFixed(2)}s · stop ${means.stop.toFixed(2)}s`
    + ` · yield ${means.yield.toFixed(2)}s`;
  expect(Math.abs(means.stop - means.lights), `stop against lights: ${note}`).toBeGreaterThan(DIFFER);
  expect(Math.abs(means.yield - means.lights), `yield against lights: ${note}`).toBeGreaterThan(DIFFER);
  // A stop sign costs every car its dwell, on top of the red this queue is
  // counted over.
  expect(means.stop, `stop costs the dwell: ${note}`).toBeGreaterThan(means.lights);
});

// The live fleet, on a generated town, at the junction its own traffic uses
// most: the same fleet and the same seconds in every run, only the control
// differing. This is the A/B the criterion names, over M3's own traffic.
test('A/B: the fleet\'s mean wait at one junction differs between the controls', async () => {
  for (const seed of SEEDS) {
    const probe = createMap(seed);
    const setup = junctionOf(probe);
    expect(setup, `seed ${seed}: a junction with a road running into it`).toBeTruthy();
    // The junction the fleet itself uses most, read off the lights it runs
    // today: the busiest crossing on the town's own traffic.
    const live = createTraffic(probe, seed, CARS);
    for (let i = 0; i < steps(WARM_SECS); i++) tick(live, DT);
    let j = null;
    let most = 0;
    for (const id of live.signals) {
      const cars = junctionWait(live, id).cars;
      if (cars > most) { most = cars; j = id; }
    }
    expect(j, `seed ${seed}: a junction the fleet uses`).toBeTruthy();
    expect(most, `seed ${seed}: cars held at that junction`).toBeGreaterThan(8);

    const runs = {};
    for (const control of JUNCTION_CONTROLS) {
      const map = createMap(seed);
      const state = createTraffic(map, seed, CARS);
      setJunctionControl(map, j, control);
      for (let i = 0; i < steps(WARM_SECS); i++) tick(state, DT);
      const before = junctionWait(state, j);
      for (let i = 0; i < steps(MEASURE_SECS); i++) tick(state, DT);
      const after = junctionWait(state, j);
      const cars = after.cars - before.cars;
      runs[control] = (after.secs - before.secs) / Math.max(1, cars);
      expect(cars, `seed ${seed}: ${control} held cars at it`).toBeGreaterThan(4);
    }
    const note = `lights ${runs.lights.toFixed(2)}s · stop ${runs.stop.toFixed(2)}s`
      + ` · yield ${runs.yield.toFixed(2)}s`;
    // A signal releases the approach in one platoon of green; a stop sign and a
    // yield release it a car at a time, so the same traffic pays more at a
    // junction that is not lit.
    expect(runs.stop, `stop against lights: ${note}`).toBeGreaterThan(runs.lights * PLATOON);
    expect(runs.yield, `yield against lights: ${note}`).toBeGreaterThan(runs.lights * PLATOON);
  }
});

// ---------------------------------------------------------------------------
// The city view's own hand: the tool, the cursor and the click, on the city the
// page is showing. The three control tools are palette rows, a click on a
// junction sets it, and the traffic reads the same control.
test('the overview\'s junction control tools set the junction under the cursor', async () => {
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet } = await import('../../src/sim/street.js');
  const {
    TOOLS, chooseTool, cityKey, createCityView, hoverJunction, paintLot, tickCityView,
  } = await import('../../src/sim/cityview.js');
  const city = createCity(20260916);
  const street = createStreet(20260916);
  const view = createCityView(city);
  expect(cityKey(view, 'z', 0)).toBe(true);
  for (let i = 0; i < 40; i++) tickCityView(view, city, DT, new Set());
  expect(view.lift).toBe(1);

  const id = [...street.traffic.signals][0];
  expect(id, 'a junction the lights run at').toBeTruthy();
  const node = street.traffic.byId.get(id);
  // No control tool held: the cursor names nothing.
  hoverJunction(view, city, { x: node.x, z: node.z }, street.traffic);
  expect(view.junction).toBe(null);

  for (const control of JUNCTION_CONTROLS) {
    const tool = TOOLS[control];
    expect(tool, `the ${control} tool is in the palette`).toBeTruthy();
    chooseTool(view, tool);
    expect(view.junction).toBe(null);      // choosing a tool drops the cursor
    hoverJunction(view, city, { x: node.x, z: node.z }, street.traffic);
    expect(view.junction?.id).toBe(id);
    expect(view.junction.control).toBe(junctionControl(street.traffic, id));
    expect(paintLot(view, city), `a click set the junction to ${control}`).toBe(true);
    expect(junctionControl(street.traffic, id)).toBe(control);
  }
  // A click with no junction under the cursor does nothing.
  hoverJunction(view, city, null, street.traffic);
  expect(paintLot(view, city)).toBe(false);
});

// ---------------------------------------------------------------------------
// The running game. ?capture=1 boots the built city for one seed, the overview
// is opened the way a player opens it, and the click is the pointer's own.
const PAGE_SEED = 7;

async function bootCity(page) {
  await page.goto(`/?capture=1&gen=1&seed=${PAGE_SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 60000 });
}

// The junction the town's own traffic uses most, and the pixel it stands on:
// the overview is aimed at it the way a player pans, and the click lands where
// the game draws it. The control tool is picked up first, the way a player
// picks one up, so the cursor under it is the junction cursor's.
async function aimJunction(page, control) {
  await page.click(`#tool-${control}`);
  await page.waitForFunction((c) => window.__game.cityview.state().brush === c, control,
    { polling: 'raf', timeout: 30000 });
  const spot = await page.evaluate(() => {
    const v = window.__game.cityview.state();
    const js = window.__game.city().furniture.junctions;
    return js.map((j) => ({ ...j, d: Math.hypot(j.x - v.home.x, j.z - v.home.z) }))
      .sort((a, b) => a.d - b.d).slice(0, 4);
  });
  for (const j of spot) {
    await page.evaluate((p) => window.__game.cityview.aim(p), { x: j.x, z: j.z, reach: 90 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const pt = await page.evaluate(([x, z]) => window.__game.screenOf(x, 0, z), [j.x, j.z]);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForFunction(() => window.__game.cityview.state().junction !== null,
      null, { polling: 'raf', timeout: 30000 });
    return { j, pt };
  }
  return null;
}

// Set the junction under the cursor to `control`: the palette's row for it, the
// cursor back on the junction, and the click.
async function setControl(page, pt, control) {
  await page.click(`#tool-${control}`);
  await page.waitForFunction((c) => window.__game.cityview.state().brush === c, control,
    { polling: 'raf', timeout: 30000 });
  await page.mouse.move(pt.x, pt.y);
  await page.waitForFunction(() => window.__game.cityview.state().junction !== null,
    null, { polling: 'raf', timeout: 30000 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction((c) => window.__game.cityview.state().junction.control === c, control,
    { polling: 'raf', timeout: 30000 });
}

// What the city view's card says about the junction under the cursor: the
// control it runs and what it has cost the cars that crossed it.
const cardOf = (page) => page.evaluate(() => {
  const el = document.querySelector('#lotcard');
  return {
    control: el.dataset.control,
    cars: Number(el.dataset.cars ?? '0'),
    secs: Number(el.dataset.secs ?? '0'),
    text: el.textContent,
  };
});

// The mean wait a control costs at the junction over a window of the frame
// loop's own steps: the span the sim ran, and the card's own two numbers
// either side of it.
async function window(page, pt, secs) {
  const before = await cardOf(page);
  await page.evaluate((s) => window.__game.cityview.advance(s), secs);
  await page.mouse.move(pt.x, pt.y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await cardOf(page);
  const cars = after.cars - before.cars;
  return { cars, mean: (after.secs - before.secs) / Math.max(1, cars) };
}

test('the city view sets a junction\'s control and M3\'s traffic obeys it', async ({ page }) => {
  test.setTimeout(300000);
  await bootCity(page);
  const at = await aimJunction(page, 'stop');
  expect(at, 'a junction under the cursor in the overview').toBeTruthy();
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => window.__game.cityview.state().junction.control === 'stop',
    null, { polling: 'raf', timeout: 30000 });
  const set = await cardOf(page);
  expect(set.control).toBe('stop');
  expect(set.text.toLowerCase()).toContain('junction');

  // The traffic obeys it: the street runs ahead on the frame loop's own steps,
  // and the junction counts every car it held at its line.
  const ran = await window(page, at.pt, 120);
  expect(ran.cars, 'cars the junction held at its stop line').toBeGreaterThan(2);
  // No car passes a stop line without stopping: each one stood for the sign's
  // own dwell, so the mean can be nothing less.
  expect(ran.mean, `stop sign mean wait, ${ran.cars} cars`).toBeGreaterThanOrEqual(STOP_HOLD);
});

test('A/B: in the running game the mean wait at that junction differs between the controls', async ({ page }) => {
  test.setTimeout(300000);
  await bootCity(page);
  const at = await aimJunction(page, 'stop');
  expect(at, 'a junction under the cursor in the overview').toBeTruthy();
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => window.__game.cityview.state().junction.control === 'stop',
    null, { polling: 'raf', timeout: 30000 });
  const means = { stop: await window(page, at.pt, 150) };
  await setControl(page, at.pt, 'lights');
  means.lights = await window(page, at.pt, 150);
  for (const control of ['stop', 'lights']) {
    expect(means[control].cars, `${control}: cars the junction held`).toBeGreaterThan(2);
  }
  const note = `stop ${means.stop.mean.toFixed(2)}s/${means.stop.cars} cars`
    + ` · lights ${means.lights.mean.toFixed(2)}s/${means.lights.cars} cars`;
  expect(Math.abs(means.stop.mean - means.lights.mean), `the mean wait differs: ${note}`)
    .toBeGreaterThan(DIFFER);
});
