// Police tiers, proven without a browser. The wanted sim is pure (law 5), so a
// whole pursuit — escalation, search, de-escalation, spikes, a roadblock, a
// contract paying out — runs in milliseconds of Node, ticked the way main.js
// ticks it. The browser half is the evidence in docs/shots/wave2-wanted-*.png.
import { test, expect } from '@playwright/test';
import {
  TIERS, createWanted, drainEvents, forceTier, tickWanted, wantedOnBlackout,
} from '../src/sim/wanted.js';
import { FLAT_TOP, ROADBLOCK_AHEAD } from '../src/sim/response.js';
import { createDispatch, tickDispatch } from '../src/sim/dispatch.js';
import { createPlayerCar, tickPlayerCar } from '../src/sim/vehicle.js';
import { HURRY_SPEED, createPlayer } from '../src/sim/player.js';
import {
  MISSION_DEFS, createMission, missionOnBlackout, missionOnEnterCar, missionOnHeatZero,
} from '../src/sim/mission.js';

const DT = 0.05;
const SEED = 20260916;
// The east park: walkable, off every street and far enough outside the drive
// box that no cruiser can see into it from the road or get close enough to look.
const HIDEOUT = { x: 66, z: -40 };
// Where the blackouts in these tests are thrown: Main Street, zone 1.
const SITE = { x: 2, z: 26 };

function boot() {
  return { w: createWanted(), car: createPlayerCar(), foot: createPlayer(), time: 0, inCar: false, events: [] };
}

function heroOf(s, { cover = false, night = 1 } = {}) {
  const body = s.inCar ? s.car : s.foot;
  return { x: body.x, z: body.z, yaw: body.yaw, inCar: s.inCar, car: s.car, body, cover, night };
}

// Ticks `secs` of game time. `drive` holds the throttle down; `each` sees the
// world after every tick.
function run(s, secs, { drive = false, each = () => {}, ...opts } = {}) {
  let status = null;
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    s.time += DT;
    if (drive) tickPlayerCar(s.car, { throttle: 1, steer: 0 }, DT);
    status = tickWanted(s.w, DT, heroOf(s, opts), s.time);
    s.events.push(...drainEvents(s.w));
    each(status);
  }
  return status;
}

function stand(s, x, z, yaw = Math.PI) {
  Object.assign(s.foot, { x, z, yaw });
}

function sitIn(s, x, z, yaw) {
  Object.assign(s.car, { x, z, yaw, speed: 0 });
  s.inCar = true;
}

function snapshot(w) {
  const r = w.response;
  return {
    heat: w.heat,
    units: w.pursuit.filter((u) => u.active && !u.leaving).length,
    cars: w.pursuit.map((u) => [+u.x.toFixed(3), +u.z.toFixed(3)]),
    roadblock: r.roadblock.active,
    heli: r.heli.active && !r.heli.leaving,
    contact: w.contact,
    search: w.search.active ? +w.search.r.toFixed(2) : 0,
  };
}

// Three crimes, one after another: the blackout that starts it and two more,
// all at the same substation, with the suspect already gone to ground.
function escalate() {
  const s = boot();
  stand(s, HIDEOUT.x, HIDEOUT.z);
  const trace = [];
  const record = () => trace.push(snapshot(s.w));
  for (let crime = 0; crime < 3; crime++) {
    wantedOnBlackout(s.w, SITE.x, SITE.z, s.time);
    s.events.push(...drainEvents(s.w));
    run(s, 4, { each: record });
  }
  return { s, trace };
}

test('each tier adds its own response, and the same crimes escalate the same way', () => {
  const a = escalate();
  const b = escalate();
  expect(a.trace).toEqual(b.trace);
  expect(a.trace.length).toBe(240);

  const [one, two, three] = [a.trace[79], a.trace[159], a.trace[239]];
  expect(one).toMatchObject({ heat: 1, units: 1, roadblock: false, heli: false });
  expect(two).toMatchObject({ heat: 2, units: 2, roadblock: false, heli: false });
  expect(three).toMatchObject({ heat: 3, units: TIERS[3].chase, roadblock: true, heli: true });
  expect(a.s.events.map((e) => e.type)).toEqual(expect.arrayContaining([
    'tier_up_1', 'tier_up_2', 'tier_up_3', 'roadblock_up', 'heli_on_night',
  ]));
});

// Lost in the park from a top-tier pursuit: the heat has to come down one tier
// at a time, each tier after its own search time, and the units it stops
// needing have to leave.
function deescalate() {
  const s = boot();
  stand(s, 2, 10, 0);
  forceTier(s.w, 3, heroOf(s), s.time);
  run(s, 1);
  stand(s, HIDEOUT.x, HIDEOUT.z);
  const drops = [];
  let last = s.w.heat;
  run(s, 90, {
    each: () => {
      if (s.w.heat !== last) drops.push({ at: +s.time.toFixed(2), ...snapshot(s.w) });
      last = s.w.heat;
    },
  });
  return { s, drops };
}

test('losing them drops one tier at a time, on the same clock every time', () => {
  const a = deescalate();
  const b = deescalate();
  expect(a.drops).toEqual(b.drops);
  expect(a.drops.map((d) => d.heat)).toEqual([2, 1, 0]);
  expect(a.drops.map((d) => d.units)).toEqual([TIERS[2].chase, TIERS[1].chase, 0]);

  // Each tier holds for its own search time once the suspect is out of sight.
  const gaps = a.drops.slice(1).map((d, i) => d.at - a.drops[i].at);
  expect(gaps[0]).toBeCloseTo(TIERS[2].searchSecs, 0);
  expect(gaps[1]).toBeCloseTo(TIERS[1].searchSecs, 0);

  const w = a.s.w;
  expect(w.pursuit.some((u) => u.active)).toBe(false);
  expect(w.response.heli.active).toBe(false);
  expect(w.response.roadblock.active).toBe(false);
  expect(a.s.events.map((e) => e.type)).toEqual(expect.arrayContaining([
    'lost', 'tier_down_2', 'tier_down_1', 'clear', 'heli_off',
  ]));
});

test('the search starts at the last known position and widens', () => {
  const s = boot();
  stand(s, 2, 10, 0);
  forceTier(s.w, 1, heroOf(s), s.time);
  run(s, 0.5);
  stand(s, HIDEOUT.x, HIDEOUT.z);
  run(s, 2);
  const { search } = s.w;
  expect(s.w.contact).toBe(false);
  expect(search.active).toBe(true);
  expect(Math.hypot(search.x - 2, search.z - 10)).toBeLessThan(1);
  const r0 = search.r;
  run(s, 6);
  expect(s.w.search.r).toBeGreaterThan(r0);
});

test('at night the light holds a suspect no cruiser can reach, and a sprint slips it', () => {
  const s = boot();
  stand(s, HIDEOUT.x, HIDEOUT.z);
  forceTier(s.w, 3, heroOf(s), s.time);
  run(s, 12);
  expect(s.w.response.heli.active).toBe(true);
  expect(s.w.contact).toBe(true);
  expect(s.events.map((e) => e.type)).not.toContain('lost');

  // Flat out along the park, away from where the light is.
  for (let i = 0; i < 12 / DT && s.w.contact; i++) {
    s.foot.z += HURRY_SPEED * DT;
    run(s, DT);
  }
  expect(s.w.contact).toBe(false);
  expect(s.events.map((e) => e.type)).toContain('lost');
});

test('a spike strip laid in your lane flattens the car and caps its speed', () => {
  const s = boot();
  sitIn(s, 2, -40, 0);
  forceTier(s.w, 2, heroOf(s), s.time);
  let top = 0;
  run(s, 2.5, { drive: true, each: () => { top = Math.max(top, s.car.speed); } });
  const strip = s.w.response.strip;
  expect(strip.active).toBe(true);
  expect(strip.axis).toBe('z');
  expect(Math.abs(strip.x - 2)).toBeLessThan(0.01);
  expect(s.car.flat ?? 0).toBe(0);

  run(s, 4, { drive: true });
  expect(strip.spent).toBe(true);
  expect(s.car.flat).toBe(1);
  expect(s.events.map((e) => e.type)).toContain('spikes_hit');

  let flatTop = 0;
  run(s, 3, { drive: true, each: () => { flatTop = Math.max(flatTop, s.car.speed); } });
  expect(top).toBeGreaterThan(10);
  expect(flatTop).toBeLessThan(FLAT_TOP + 0.5);
});

test('the roadblock goes up ahead on the road, stops the car, and busts it', () => {
  const s = boot();
  sitIn(s, 2, -40, 0);
  forceTier(s.w, 3, heroOf(s), s.time);
  const rb = s.w.response.roadblock;
  expect(rb.active).toBe(true);
  expect(rb.axis).toBe('z');
  expect(rb.x).toBe(0);
  expect(rb.z).toBeCloseTo(-40 + ROADBLOCK_AHEAD, 5);

  // Throttle held down the whole way, cuffs included: the line stays solid.
  let furthest = -Infinity;
  const seen = new Set();
  run(s, 12, {
    drive: true,
    each: (st) => {
      furthest = Math.max(furthest, s.car.z);
      seen.add(st);
    },
  });
  expect(furthest).toBeLessThan(rb.z);
  expect(s.events.map((e) => e.type)).toEqual(expect.arrayContaining(['rammed', 'busted']));
  expect(seen.has('busted')).toBe(true);
  expect(s.w.heat).toBe(0);
});

test('a cruiser that reaches you on foot still busts you', () => {
  const s = boot();
  stand(s, 2, 0);
  forceTier(s.w, 1, heroOf(s), s.time);
  let status = null;
  for (let t = 0; t < 40 && status !== 'busted'; t++) status = run(s, 1);
  expect(status).toBe('busted');
  expect(s.w.heat).toBe(0);
});

test('going clean still completes a lose_heat step and pays the contract', () => {
  const s = boot();
  const m = createMission(MISSION_DEFS);
  expect(m.id).toBe('GRID RUN');
  sitIn(s, 2, 24, Math.PI);
  missionOnEnterCar(m);
  // Zone 1, then zone 0 while zone 1 still burns — the contract's chain.
  wantedOnBlackout(s.w, s.car.x, s.car.z, s.time);
  missionOnBlackout(m, [false, true]);
  run(s, 1);
  wantedOnBlackout(s.w, s.car.x, s.car.z, s.time);
  missionOnBlackout(m, [true, true]);
  expect(s.w.heat).toBe(2);

  s.inCar = false;
  stand(s, HIDEOUT.x, HIDEOUT.z);
  run(s, 60, { each: () => missionOnHeatZero(m, s.w.heat, s.time) });
  expect(s.w.heat).toBe(0);
  expect(m.balance).toBe(500);
  expect(m.id).toBe('DARK MARKET');
});

test('dispatch says the same lines for the same pursuit, one voice at a time', () => {
  const talk = () => {
    const { s } = escalate();
    const d = createDispatch(SEED);
    const heard = [];
    let said = 0;
    for (let t = 0; t < 20; t += DT) {
      tickDispatch(d, s.events.filter((e) => e.time > t - DT && e.time <= t), t);
      if (d.said !== said) heard.push({ ...d.lines.at(-1) });
      said = d.said;
    }
    return heard;
  };
  const a = talk();
  expect(a).toEqual(talk());
  expect(a.length).toBeGreaterThanOrEqual(4);
  expect(a[0].speaker).toBe('DISPATCH');
  expect(a[0].text).toMatch(/Main Street/);
  a.slice(1).forEach((l, i) => expect(l.at - a[i].at).toBeGreaterThanOrEqual(1.5));
});
