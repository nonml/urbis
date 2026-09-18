#!/usr/bin/env node
// Differential check for the src/sim/world.js migration (plank 1, wave 1).
//
// The migration moved four hardcoded copies of the world bounds box onto one
// authority. It was supposed to change nothing about how the player, the car
// or the pursuit cars move. This proves that, by running the live sim against
// frozen copies of the pre-refactor code and asserting they agree to 1e-12.
//
// Run:  node tests/migration/world-bounds-diff.mjs
// No build, no preview, no port 4173, no Playwright. Exits non-zero on drift.
//
// ---------------------------------------------------------------------------
// READ THIS BEFORE "TIDYING" THE FROZEN SECTION BELOW.
//
// The functions under FROZEN REFERENCE are deliberate verbatim copies of
// src/sim/player.js, src/sim/vehicle.js and src/sim/wanted.js as they stood
// *before* the world.js migration, literal bounds numbers and all. They are
// duplication on purpose.
//
// Do not "helpfully" replace them with imports from src/sim/. The moment they
// import the live code, both sides of every comparison become the same code
// and the test silently becomes a tautology that passes no matter what breaks.
// If the sim's intended behaviour ever legitimately changes, this file should
// be deleted or rewritten against a new frozen snapshot — never resynced.
// ---------------------------------------------------------------------------

import { createPlayer, tickPlayer } from '../../src/sim/player.js';
import { createPlayerCar, tickPlayerCar } from '../../src/sim/vehicle.js';
import { createWanted, tickWanted, MAX_HEAT } from '../../src/sim/wanted.js';
import { WALK_BOUNDS, DRIVE_BOUNDS } from '../../src/sim/world.js';

// ======================= FROZEN REFERENCE — DO NOT REFACTOR =================

const OLD_BOUNDS = { minX: -52, maxX: 70, minZ: -68, maxZ: 100 };
const WALK_SPEED = 3.4;
const HURRY_SPEED = 6.0;

function oldTickPlayer(player, input, dt) {
  const want = Math.hypot(input.mx, input.mz) > 0.01;
  const targetSpeed = want ? (input.hurry ? HURRY_SPEED : WALK_SPEED) : 0;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 8);
  if (player.speed > 0.05) {
    player.x += input.mx * player.speed * dt;
    player.z += input.mz * player.speed * dt;
    player.x = Math.max(OLD_BOUNDS.minX, Math.min(OLD_BOUNDS.maxX, player.x));
    player.z = Math.max(OLD_BOUNDS.minZ, Math.min(OLD_BOUNDS.maxZ, player.z));
    if (want) {
      const targetYaw = Math.atan2(input.mx, input.mz);
      let d = targetYaw - player.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      player.yaw += d * Math.min(1, dt * 10);
    }
    player.walkPhase += dt * player.speed * 2.6;
  }
}

const CAR_TOP = 12;
const CAR_REVERSE = 4;
const ACCEL = 9;
const BRAKE = 17;
const TURN = 1.9;

function oldTickPlayerCar(car, input, dt) {
  let braking = false;
  if (input.throttle > 0) {
    car.speed = Math.min(CAR_TOP, car.speed + ACCEL * input.throttle * dt);
  } else if (input.throttle < 0) {
    if (car.speed > 0.5) {
      car.speed = Math.max(0, car.speed - BRAKE * dt);
      braking = true;
    } else {
      car.speed = Math.max(-CAR_REVERSE, car.speed + ACCEL * 0.6 * input.throttle * dt);
    }
  }
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 0.02 && input.throttle === 0) car.speed = 0;
  const grip = Math.max(-1, Math.min(1, car.speed / 4));
  car.yaw += input.steer * TURN * grip * dt;
  car.x += Math.sin(car.yaw) * car.speed * dt;
  car.z += Math.cos(car.yaw) * car.speed * dt;
  if (car.x < -52 || car.x > 52) { car.x = Math.max(-52, Math.min(52, car.x)); car.speed = 0; }
  if (car.z < -68 || car.z > 100) { car.z = Math.max(-68, Math.min(100, car.z)); car.speed = 0; }
  return { braking };
}

const PURSUIT_SPEED = 10;

// The pursuit block lifted out of the old tickWanted, unchanged. Returns the
// nearest distance *before* the step, exactly as the old catch test read it.
function oldPursuitLoop(w, tx, tz, dt) {
  let nearest = Infinity;
  for (const p of w.pursuit) {
    if (!p.active) continue;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    nearest = Math.min(nearest, d);
    const want = Math.atan2(dx, dz);
    let diff = want - p.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.yaw += Math.max(-1, Math.min(1, diff * 3)) * 1.8 * dt;
    p.speed += ((d > 6 ? PURSUIT_SPEED : PURSUIT_SPEED * 0.4) - p.speed) * Math.min(1, dt * 2);
    p.x += Math.sin(p.yaw) * p.speed * dt;
    p.z += Math.cos(p.yaw) * p.speed * dt;
    p.x = Math.max(-52, Math.min(52, p.x));
    p.z = Math.max(-68, Math.min(100, p.z));
  }
  return nearest;
}

// ===================== END FROZEN REFERENCE =================================

const EPS = 1e-12;
let failures = 0;

function fail(what, a, b) {
  failures++;
  console.error(`  DRIFT ${what}: live=${a} frozen=${b}`);
}

function same(what, a, b) {
  if (Math.abs(a - b) > EPS) fail(what, a, b);
}

function sameFields(what, live, frozen, fields) {
  for (const f of fields) same(`${what}.${f}`, live[f], frozen[f]);
}

function report(label) {
  const mark = failures === 0 ? 'OK' : 'FAIL';
  console.log(`  [${mark}] ${label}`);
}

console.log('world.js migration — differential check');
console.log('======================================');
console.log('part 1  behaviour parity vs frozen pre-refactor code');

// --- player: circling input, every wall approached obliquely ---------------
{
  const before = failures;
  const live = createPlayer();
  const frozen = createPlayer();
  for (let i = 0; i < 4000; i++) {
    const ang = i * 0.017;
    const input = { mx: Math.sin(ang), mz: Math.cos(ang * 0.7), hurry: i % 13 === 0 };
    tickPlayer(live, input, 0.03);
    oldTickPlayer(frozen, input, 0.03);
  }
  sameFields('player', live, frozen, ['x', 'z', 'yaw', 'speed', 'walkPhase']);
  console.log(`  [${failures === before ? 'OK' : 'FAIL'}] player  — circling input, 4000 steps`);
}

// --- player: pinned flat into the +x and -x walls --------------------------
{
  const before = failures;
  for (const mx of [1, -1]) {
    const live = createPlayer();
    const frozen = createPlayer();
    for (let i = 0; i < 3000; i++) {
      const input = { mx, mz: 0, hurry: true };
      tickPlayer(live, input, 0.05);
      oldTickPlayer(frozen, input, 0.05);
    }
    sameFields(`player pinned mx=${mx}`, live, frozen, ['x', 'z', 'yaw', 'speed']);
  }
  console.log(`  [${failures === before ? 'OK' : 'FAIL'}] player  — pinned into +x and -x walls`);
}

// --- car: throttle and steer sweep, braking flag checked every step --------
{
  const before = failures;
  const live = createPlayerCar();
  const frozen = createPlayerCar();
  for (let i = 0; i < 6000; i++) {
    const input = { throttle: i % 400 < 330 ? 1 : -1, steer: Math.sin(i * 0.004) };
    const a = tickPlayerCar(live, input, 0.03);
    const b = oldTickPlayerCar(frozen, input, 0.03);
    if (a.braking !== b.braking) fail(`car.braking@${i}`, a.braking, b.braking);
  }
  sameFields('car', live, frozen, ['x', 'z', 'yaw', 'speed']);
  console.log(`  [${failures === before ? 'OK' : 'FAIL'}] car     — throttle/steer sweep, 6000 steps`);
}

// --- car: coast, so the throttle===0 dead-stop branch is covered too -------
{
  const before = failures;
  const live = createPlayerCar();
  const frozen = createPlayerCar();
  for (let i = 0; i < 1200; i++) {
    const phase = i % 300;
    const input = { throttle: phase < 120 ? 1 : phase < 160 ? -1 : 0, steer: Math.cos(i * 0.01) };
    const a = tickPlayerCar(live, input, 0.04);
    const b = oldTickPlayerCar(frozen, input, 0.04);
    if (a.braking !== b.braking) fail(`car coast.braking@${i}`, a.braking, b.braking);
  }
  sameFields('car coast', live, frozen, ['x', 'z', 'yaw', 'speed']);
  console.log(`  [${failures === before ? 'OK' : 'FAIL'}] car     — coast cycle, 1200 steps`);
}

// --- wanted: two pursuit cars chasing a target that leaves the bounds ------
// The heat state machine is pinned inert every step on purpose. This case
// tests chase kinematics and the pursuit bounds clamp — the only part the
// migration touched. Leaving heat live would let a decay tick deactivate a
// pursuit car on one side only, which would read as drift that isn't drift.
{
  const before = failures;
  const live = createWanted();
  const frozen = createWanted();
  for (const w of [live, frozen]) w.pursuit.forEach((p) => { p.active = true; });
  const dt = 0.03;
  for (let i = 0; i < 3000; i++) {
    live.heat = MAX_HEAT;
    live.catchT = 0;
    live.decayT = 0;
    live.speedT = 0;
    live.bustedUntil = 0;
    const tx = 60 * Math.sin(i * 0.01);
    const tz = 90 * Math.cos(i * 0.013);
    tickWanted(live, dt, tx, tz, false, 0, false, i * dt);
    oldPursuitLoop(frozen, tx, tz, dt);
    live.pursuit.forEach((p, k) => {
      sameFields(`pursuit${k}@${i}`, p, frozen.pursuit[k], ['x', 'z', 'yaw', 'speed']);
    });
    if (failures > before) break;
  }
  console.log(`  [${failures === before ? 'OK' : 'FAIL'}] wanted  — 2 pursuit cars, 3000 steps`);
}

// --- part 2: every wall, both movement modes, contact counts printed -------
console.log('');
console.log('part 2  bounds coverage — every wall, both movement modes');

function tallyContacts(tally, bounds, x, z) {
  for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) {
    if (Math.abs((k.endsWith('X') ? x : z) - bounds[k]) < 1e-9) tally[k]++;
  }
}

const carWalls = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
{
  const before = failures;
  // Yaw is forced every step so the car drives dead straight at one wall.
  for (const yaw of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const live = createPlayerCar();
    const frozen = createPlayerCar();
    for (let i = 0; i < 1500; i++) {
      live.yaw = yaw;
      frozen.yaw = yaw;
      tickPlayerCar(live, { throttle: 1, steer: 0 }, 0.05);
      oldTickPlayerCar(frozen, { throttle: 1, steer: 0 }, 0.05);
      sameFields(`car wall yaw=${yaw.toFixed(3)}@${i}`, live, frozen, ['x', 'z', 'speed']);
      tallyContacts(carWalls, DRIVE_BOUNDS, live.x, live.z);
      if (failures > before) break;
    }
  }
}

const footWalls = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
{
  const before = failures;
  for (const [mx, mz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const live = createPlayer();
    const frozen = createPlayer();
    for (let i = 0; i < 2000; i++) {
      tickPlayer(live, { mx, mz, hurry: true }, 0.05);
      oldTickPlayer(frozen, { mx, mz, hurry: true }, 0.05);
    }
    sameFields(`foot wall mx=${mx} mz=${mz}`, live, frozen, ['x', 'z']);
    // One probe per direction: did this walk finish pinned against that wall?
    tallyContacts(footWalls, WALK_BOUNDS, live.x, live.z);
  }
  console.log(`  car wall contacts : ${JSON.stringify(carWalls)}`);
  console.log(`  foot walls reached: ${JSON.stringify(footWalls)}`);
  report('all four walls, both movement modes');
  void before;
}

const missed = [...Object.values(carWalls), ...Object.values(footWalls)].filter((n) => n === 0).length;
if (missed > 0) {
  failures++;
  console.error(`  COVERAGE GAP: ${missed} of 8 wall/mode combinations were never reached`);
}

console.log('');
if (failures === 0) {
  console.log('PASS — no behavioural drift; all 8 wall/mode combinations exercised');
  process.exit(0);
}
console.error(`FAIL — ${failures} drift or coverage problem(s)`);
process.exit(1);
