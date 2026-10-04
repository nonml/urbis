// The fixed sim step (M0-1). The world advances in whole STEP seconds wherever
// the display frame lands, and the renderer blends the last two steps so 60 fps
// play stays smooth on a 20 Hz simulation. A frame runs at most MAX_STEPS; any
// backlog past that is dropped rather than queued, so a stalled tab resumes at
// the present instead of fast-forwarding through the time it was away.
//
// `?speed=N` (M0.T3, 1 to 8) is a test flag: above 1 the frame is pinned to
// exactly N fixed steps and dt is ignored, so a replay fed in by step ends in a
// frame count a check can predict; 1 is the real-time accumulator M0-1 built,
// and the value a game sets when it is not testing (M5.T35). Every step still
// runs — the sim is never skipped forward.
//
// This module is game-side, not sim: it holds no state of its own beyond an
// accumulator, the whole-step count (a replay stops on it), and the poses it
// snapshots onto movers for the renderer.
import { weatherPin } from '../sim/weather.js';
import { installPause } from '../ui/pause.js';

export const STEP = 0.05;
export const MAX_STEPS = 5;
export const MAX_SPEED = 8;

// The fastest a body can be in one step is a metre (the helicopter); a wrap at
// the street's end or a unit entering at distance is tens. Past this, blend()
// draws the new pose instead of sweeping across the map between the two.
const TELEPORT = 5;

// The alpha of the frame currently being drawn, published by advance() so the
// render layers outside main.js (traffic, npcs, police, heli) blend the same
// frame that main.js blends the player, the car and the camera.
let frameAlpha = 0;

export function drawAlpha() {
  return frameAlpha;
}

const TAU = Math.PI * 2;

function clampSpeed(speed) {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(MAX_SPEED, Math.max(0, speed));
}

// Read once at boot. 1 when absent, unreadable, or below the flag's 1-8 range.
function readSpeed() {
  const search = globalThis.location?.search;
  if (!search) return 1;
  const raw = new URLSearchParams(search).get('speed');
  if (raw === null) return 1;
  return Math.min(MAX_SPEED, Math.max(1, Math.floor(Number(raw) || 0)));
}

// `?weather=clear|overcast|rain` pins the sweep's state, as `?speed=` pins the
// step rate. Null when absent or not a state.
export function readWeather() {
  return weatherPin(globalThis.location?.search ?? '');
}

// Pause (M7.T9, criterion M7-3): while the menu is up no step runs, so every
// clock and entity holds where it was; advance() drops the frame's dt instead
// of banking it, so resume continues at the present rather than fast-forwarding
// through the pause. The key and the menu are the DOM side (ui/pause.js); this
// module stays importable in Node and owns only the state.
let paused = false;
export function setPaused(on) { paused = !!on; return paused; }
export function isPaused() { return paused; }
// Wire the menu once there is a DOM; a Node import (tests) gets the state only.
if (typeof document !== 'undefined') installPause({ setPaused, isPaused });

export function createFixedStep(speed = readSpeed()) {
  return { acc: 0, alpha: 0, steps: 0, speed: clampSpeed(speed), total: 0 };
}

// The city view's pause (0) and its 1x/2x/4x buttons set speed through here.
export function setSpeed(step, speed) {
  step.speed = clampSpeed(speed);
  return step.speed;
}

// Add one frame's elapsed seconds. Sets step.steps to how many whole steps to
// run now and step.alpha to where this frame sits between the step that just
// ran and the next one. Returns the step count.
//
// `end` (M0.T2) is the step count a replay stops on: a frame that would run
// past it runs only the steps left, and a frame at or past it runs none. So a
// replay and its recording can hold the same world at the same step however
// the frames fell. Without a replay it is Infinity and nothing changes; the
// caller sees the cap on the next frame, which is where the sim freezes.
export function advance(step, dt, end = Infinity) {
  if (paused) {
    step.acc = 0;
    step.steps = 0;
    frameAlpha = step.alpha = 0;
    return 0;
  }
  const left = end - step.total;
  if (left <= 0) {
    step.acc = 0;
    step.alpha = 0;
    step.steps = 0;
    frameAlpha = 0;
    return 0;
  }
  const speed = step.speed ?? 1;
  if (speed > 1) {
    step.acc = 0;
    step.alpha = 0;
    step.steps = Math.min(Math.floor(speed), left);
    frameAlpha = 0;
    return step.steps;
  }
  step.acc += dt * speed;
  step.steps = 0;
  while (step.acc >= STEP && step.steps < MAX_STEPS) {
    step.acc -= STEP;
    step.steps += 1;
  }
  if (step.acc >= STEP) step.acc %= STEP;
  if (step.steps >= left) {
    // The cap bit: drop the leftover accumulator and draw the last whole step,
    // not half a step toward one that will never run.
    step.steps = left;
    step.acc = 0;
    step.alpha = 0;
  } else {
    step.alpha = step.acc / STEP;
  }
  frameAlpha = step.alpha;
  return step.steps;
}

// Remember a mover's numbers before a step runs, on the mover itself as `prev`,
// so the snapshot travels with what it describes. Only numbers are copied; the
// save (src/sim/save.js) picks named fields, so this never leaks into a save.
export function snap(entity) {
  const prev = entity.prev ?? (entity.prev = {});
  for (const k of Object.keys(entity)) {
    if (k !== 'prev' && typeof entity[k] === 'number') prev[k] = entity[k];
  }
  return prev;
}

// Shortest signed turn from one yaw to another, so a car or a walker crossing
// the +/-PI seam is drawn turning the way it turned, not all the way round.
function shortTurn(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// The pose to draw for `entity` between its previous and current step. Every
// numeric field blends; yaw takes the short way. A position that teleported
// past TELEPORT is drawn where it landed, not lerped across the map. `out` is
// reused by the caller to keep the frame allocation-free. With no snapshot yet
// it is the live pose.
export function blend(entity, alpha, out = {}) {
  const prev = entity.prev ?? entity;
  let teleport = false;
  for (const k of Object.keys(entity)) {
    const now = entity[k];
    if (k === 'prev' || k === 'yaw' || typeof now !== 'number') continue;
    const was = typeof prev[k] === 'number' ? prev[k] : now;
    const jumped = (k === 'x' || k === 'y' || k === 'z') && Math.abs(now - was) > TELEPORT;
    if (jumped) teleport = true;
    out[k] = jumped ? now : was + (now - was) * alpha;
  }
  if (typeof entity.yaw !== 'number') {
    out.yaw = undefined;
    return out;
  }
  const wasYaw = typeof prev.yaw === 'number' ? prev.yaw : entity.yaw;
  out.yaw = teleport ? entity.yaw : wasYaw + shortTurn(wasYaw, entity.yaw) * alpha;
  return out;
}
