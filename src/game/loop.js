// The fixed sim step (M0-1). The world advances in whole STEP seconds wherever
// the display frame lands, and the renderer blends the last two steps so 60 fps
// play stays smooth on a 20 Hz simulation. A frame runs at most MAX_STEPS; any
// backlog past that is dropped rather than queued, so a stalled tab resumes at
// the present instead of fast-forwarding through the time it was away.
//
// This module is game-side, not sim: it holds no state of its own beyond an
// accumulator and the poses it snapshots onto movers for the renderer.

export const STEP = 0.05;
export const MAX_STEPS = 5;

const TAU = Math.PI * 2;

export function createFixedStep() {
  return { acc: 0, alpha: 0, steps: 0 };
}

// Add one frame's elapsed seconds. Sets step.steps to how many whole steps to
// run now and step.alpha to where this frame sits between the step that just
// ran and the next one. Returns the step count.
export function advance(step, dt) {
  step.acc += dt;
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
