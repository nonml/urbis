// Real-input helpers (docs/plan/TASKS.md M0.T4, criterion M0-3).
//
// Every helper drives the page the way a player does — through the game's own
// key and pointer listeners — and counts game time in fixed sim steps, never
// wall time, so a run at ?speed=4 costs a quarter of the seconds and a paused
// tab cannot make a hold silently shorter. `__game.step()` only advances when
// the sim actually ran a whole 50 ms step, so it is the clock these helpers
// measure.
import { STEP } from '../../../src/game/loop.js';

const WAIT_TIMEOUT = 120000;
// sim/vehicle.js's own brake, and the metre of slack a stop is aimed with: the
// helper brakes exactly as hard as the game does, so a target is reached and
// not merely approached.
const BRAKE_RATE = 17, STOP_MARGIN = 1;
// How far a car may wander and still count as standing where it stood.
const PINNED_M = 2;
// Heading error the wheel is left alone inside: 0.3 rad is about 17 degrees,
// and holding the wheel tighter than that just weaves.
const STEER_DEADBAND = 0.3;

// Hold every key in `keys` (a string, e.g. 'w', or a list, e.g. ['w', 'd'])
// for `gameSecs` of game time, then release them.
export async function hold(page, keys, gameSecs) {
  const list = typeof keys === 'string' ? [keys] : keys;
  for (const key of list) await page.keyboard.down(key);
  await waitGame(page, gameSecs);
  for (const key of list) await page.keyboard.up(key);
}

// Wait until the sim has run `secs` of game time from now on.
export async function waitGame(page, secs) {
  const target = await page.evaluate((steps) => window.__game.step() + steps, Math.ceil(secs / STEP));
  await page.waitForFunction((n) => window.__game.step() >= n, target, {
    polling: 'raf', timeout: WAIT_TIMEOUT,
  });
}

// Drive the hero car along `waypoints` (world metres) with the keys alone — W
// for throttle, A/D to steer, S to brake — the way a player does (M4.T14,
// criterion M4-4). Game time is measured in fixed steps through `__game.step()`,
// never wall seconds, so a run at ?speed=8 reports the seconds a player would
// have spent driving and a loaded machine stretches the wall clock only.
//
// The steering is a closed loop on the car's own pose: the heading is read from
// the ground the car actually covered since the last sample (the car poses no
// yaw to the probe), and W is swapped for the brake inside `brake` metres of
// the goal so the car comes to rest where it was aimed rather than coasting a
// car length past it. A corner cut — a waypoint swept past without entering its
// radius — advances the leg anyway, so a fast junction cannot stall the run. A
// car that stops under throttle while it is still short of the goal is reported
// stuck, with the pose that stopped it, instead of being spun on for minutes.
export async function driveAlong(page, waypoints, opts = {}) {
  const arrive = opts.arrive ?? 10;
  const poll = opts.poll ?? 0.15;
  const stallSecs = opts.stallSecs ?? 6;
  const capSecs = opts.capSecs ?? 180;
  if (waypoints.length === 0) throw new Error('input.js: driveAlong needs a route');
  const start = await page.evaluate(() => window.__game.step());
  if ((await page.evaluate(() => window.__game.player().mode)) !== 'drive') {
    await page.keyboard.press('f');
    await page.waitForFunction(() => window.__game.player().mode === 'drive', null,
      { polling: 'raf', timeout: WAIT_TIMEOUT });
  }

  const held = new Set();
  const key = async (name, on) => {
    if (on === held.has(name)) return;
    if (on) await page.keyboard.down(name); else await page.keyboard.up(name);
    if (on) held.add(name); else held.delete(name);
  };

  let leg = 0, yaw = null, moved = 0;
  // The pose the drive started from, held once: the first leg's own "back" (so a
  // car that swings wide cannot talk itself into having passed a waypoint) and
  // the first pose the stall clock measures from.
  const origin = await page.evaluate(() => window.__game.car());
  let stallPose = { x: origin.x, z: origin.z, at: 0 };
  let last = origin;
  await key('w', true);
  try {
    for (;;) {
      await waitGame(page, poll);
      const car = await page.evaluate(() => window.__game.car());
      const secs = (await page.evaluate(() => window.__game.step()) - start) * STEP;
      const goal = waypoints[waypoints.length - 1];
      const gap = Math.hypot(goal.x - car.x, goal.z - car.z);
      const covered = Math.hypot(car.x - last.x, car.z - last.z);
      // A metre of travel is a heading; anything less is a car standing still,
      // and turning the aim on it would spin the run in place.
      if (covered > 1) yaw = Math.atan2(car.x - last.x, car.z - last.z);
      moved += covered;
      last = car;

      // A leg is done when the car is on the waypoint or past it along the leg
      // it came in on. "Past" is the projection onto that leg, never the angle
      // at the car: a route that doubles back through a waypoint it has just
      // swung wide of would read as passed on an angle and skip half the town.
      while (leg < waypoints.length - 1) {
        const wp = waypoints[leg];
        const back = waypoints[leg - 1] ?? origin;
        const bx = wp.x - back.x;
        const bz = wp.z - back.z;
        const span = bx * bx + bz * bz;
        const along = span === 0 ? 1 : ((car.x - back.x) * bx + (car.z - back.z) * bz) / span;
        if (along < 1 && Math.hypot(wp.x - car.x, wp.z - car.z) > arrive) break;
        leg += 1;
      }

      const wp = waypoints[leg];
      const want = Math.atan2(wp.x - car.x, wp.z - car.z);
      const err = yaw === null ? 0 : Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
      await key('a', Math.abs(err) > STEER_DEADBAND && err < 0);
      await key('d', Math.abs(err) > STEER_DEADBAND && err > 0);
      // Brake the last metres: throttle alone coasts a car length past the goal,
      // and the criterion is where the car comes to rest. The brake bites only
      // within the distance this speed actually needs — vehicle.js's own brake
      // rate, plus a metre — so the car holds the throttle to the end instead of
      // pinning itself short and creeping a few centimetres at a time.
      const final = leg === waypoints.length - 1;
      const stopIn = car.speed * car.speed / (2 * BRAKE_RATE) + STOP_MARGIN;
      const stopping = final && gap < Math.max(stopIn, arrive);
      await key('w', !stopping);
      await key('s', stopping);
      const run = {
        secs: +secs.toFixed(1), gap: +gap.toFixed(1), moved: +moved.toFixed(1),
        x: car.x, z: car.z, leg, legs: waypoints.length,
      };
      // The drive ends where the car stops on the goal, not where it first comes
      // inside the radius: a car still rolling through it has not arrived.
      if (final && gap <= arrive && car.speed < 0.5) return { ...run, stuck: false };
      // Pinned: still inside PINNED_M of where it stood `stallSecs` of game ago,
      // past the standing start. A fence or a jam holds it there for good; a car
      // creeping into the last metres covers more than that.
      const pinned = Math.hypot(car.x - stallPose.x, car.z - stallPose.z) <= PINNED_M;
      if (!pinned) stallPose = { x: car.x, z: car.z, at: secs };
      if (moved > 2 && secs - stallPose.at >= stallSecs) return { ...run, stuck: true, why: 'the car stopped moving' };
      if (secs >= capSecs) return { ...run, stuck: true, why: `still ${gap.toFixed(0)} m short` };
    }
  } finally {
    for (const name of [...held]) await key(name, false);
  }
}

// The canvas pixel a world point projects to, via the game's own probe.
export async function screenOf(page, x, y, z) {
  return page.evaluate(([px, py, pz]) => window.__game.screenOf(px, py, pz), [x, y, z]);
}

// Click the canvas pixel a world point projects to. The move lands first and a
// frame passes so the view's hover — read from the pointer once a frame —
// settles on what is under the cursor before the press; down and up on the same
// frame would paint whatever was hovered before the move.
export async function clickWorld(page, x, y, z) {
  const pt = await screenOf(page, x, y, z);
  await page.mouse.move(pt.x, pt.y);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.mouse.down();
  await page.mouse.up();
  return pt;
}

// Palette key per use (sim/cityview.js BRUSH_KEYS); the eraser is X.
const BRUSH_KEY = { res: 'r', com: 'c', ind: 'i' };

// Z into the city view, wait for the rise to finish, then pick `brush` by its
// palette key. `brush` is a use name, 'unzone', or null for the eraser.
export async function cityView(page, brush = 'res') {
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: WAIT_TIMEOUT });
  const use = brush === 'unzone' ? null : brush;
  const key = use === null ? 'x' : BRUSH_KEY[use];
  if (!key) throw new Error(`input.js: unknown brush '${brush}'`);
  await page.keyboard.press(key);
  await page.waitForFunction((u) => window.__game.cityview.state().brush === u, use, {
    polling: 'raf', timeout: WAIT_TIMEOUT,
  });
}
