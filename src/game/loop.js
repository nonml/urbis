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
// accumulator and the poses it snapshots onto movers for the renderer.

export const STEP = 0.05;
export const MAX_STEPS = 5;
export const MAX_SPEED = 8;

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

export function createFixedStep(speed = readSpeed()) {
  return { acc: 0, alpha: 0, steps: 0, speed: clampSpeed(speed) };
}

// The city view's pause (0) and its 1x/2x/4x buttons set speed through here.
export function setSpeed(step, speed) {
  step.speed = clampSpeed(speed);
  return step.speed;
}

// Add one frame's elapsed seconds. Sets step.steps to how many whole steps to
// run now and step.alpha to where this frame sits between the step that just
// ran and the next one. Returns the step count.
export function advance(step, dt) {
  const speed = step.speed ?? 1;
  if (speed > 1) {
    step.acc = 0;
    step.alpha = 0;
    step.steps = Math.floor(speed);
    return step.steps;
  }
  step.acc += dt * speed;
  step.steps = 0;
  while (step.acc >= STEP && step.steps < MAX_STEPS) {
    step.acc -= STEP;
    step.steps += 1;
  }
  if (step.acc >= STEP) step.acc %= STEP;
  step.alpha = step.acc / STEP;
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
// numeric field blends; yaw takes the short way. `out` is reused by the caller
// to keep the frame allocation-free. With no snapshot yet it is the live pose.
export function blend(entity, alpha, out = {}) {
  const prev = entity.prev ?? entity;
  for (const k of Object.keys(entity)) {
    const now = entity[k];
    if (k === 'prev' || k === 'yaw' || typeof now !== 'number') continue;
    const was = typeof prev[k] === 'number' ? prev[k] : now;
    out[k] = was + (now - was) * alpha;
  }
  const wasYaw = typeof prev.yaw === 'number' ? prev.yaw : entity.yaw;
  out.yaw = wasYaw + shortTurn(wasYaw, entity.yaw) * alpha;
  return out;
}
