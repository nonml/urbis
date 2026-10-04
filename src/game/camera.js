// Camera (M3.T3, criterion M3-1): the follow rig, its per-frame placement, the
// interior rigs and the drag-to-orbit/dolly reads, out of main.js. It reads sim
// state and writes the THREE camera; it never mutates the sim. Pointer events
// stay in game/input.js, which hands the deltas to look() and dolly().
import * as THREE from 'three';
import { currentPlace, frameCamera, STREET } from '../sim/interior.js';
import { heightAt } from '../sim/world.js';
import { builtHeight } from '../sim/zoning.js';

// The follow cam's street framing, put back when the player comes out.
export const STREET_RIG = { dist: 4.5, pitch: 0.18 };
// Driving: further back and a touch higher, so the car body reads.
const DRIVE_RIG = { dist: 7, pitch: 0.22 };
// Where the camera pivots in a space: the player's head.
export const CAM_PIVOT = 1.6;
// How far the rain box reaches below a player up on a roof.
export const ROOF_RAIN_BELOW = 12;

// Drag-to-orbit: radians per pixel, and the ranges the mouse can reach.
const ORBIT_PER_PX = 0.005;
const PITCH_PER_PX = 0.004;
const PITCH_MIN = 0.08;
const PITCH_MAX = 1.2;
const DOLLY_PER_WHEEL = 0.001;
const DOLLY_MIN = 3;
const DOLLY_MAX = 14;
// The eye at pitch zero; the look height on foot; driving looks further ahead,
// lower, down the road.
const EYE_LIFT = 0.6;
const LOOK_HEIGHT = 1.7;
const DRIVE_LOOK_AHEAD = 3;
const DRIVE_LOOK_HEIGHT = 1.2;
// The camera rides the higher of two grounds, eased: a kerb is a step function
// and the whole frame would jump.
const GROUND_EASE = 6;
// Driving swings the camera to the car's heading once the drag has settled, on
// the fixed step so a replay reproduces the same frame (M0-1).
const DRIVE_EASE = 2.2;
const DRIVE_SETTLE = 2;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// The camera keeps this much off a wall it would enter, and never pulls closer
// than this share of its arm to the pivot (or it would sit in the player's head).
const CAM_SOLID_PAD = 0.35;
const CAM_SOLID_MIN = 0.15;
// An obstacle no taller than this above the pivot is stepped over, not pulled
// out of: the hero car parked at the spawn is right behind the player when they
// turn around, and a camera yanked to the player's skull is worse than one that
// rides the car's roof.
const CAM_HOP = 1.4;

// A footprint carries its height; a sim parcel derives it from its stage.
function solidHeight(b) {
  return b.h ?? builtHeight(b);
}

// Does the arm cross this box's footprint, in plan?
function crossesPlan(px, pz, ex, ez, lo, hi) {
  let t0 = 0, t1 = 1;
  const o = [px, pz], d = [ex - px, ez - pz];
  for (let a = 0; a < 2 && t0 <= t1; a++) {
    if (Math.abs(d[a]) < 1e-6) {
      if (o[a] < lo[a] || o[a] > hi[a]) { t0 = 1; t1 = 0; }
      continue;
    }
    let near = (lo[a] - o[a]) / d[a], far = (hi[a] - o[a]) / d[a];
    if (near > far) { const s = near; near = far; far = s; }
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
  }
  return t0 <= t1 && t1 > 0;
}

// Keep the street arm out of the blocks. The first-minutes sweep found the
// follow cam inside the block east of the spawn on seeds 7 and 22, where a west
// heading opens on the inside of a facade. Low obstacles are hopped over, tall
// ones shorten the arm. Returns null when the arm needs nothing.
function clearStreetArm(px, py, pz, ex, ey, ez, boxes) {
  let top = ey;
  for (const b of boxes) {
    const h = solidHeight(b);
    if (h < 1 || h + CAM_SOLID_PAD > py + CAM_HOP) continue;
    const lo = [b.x - b.w / 2 - CAM_SOLID_PAD, b.z - b.d / 2 - CAM_SOLID_PAD];
    const hi = [b.x + b.w / 2 + CAM_SOLID_PAD, b.z + b.d / 2 + CAM_SOLID_PAD];
    if (crossesPlan(px, pz, ex, ez, lo, hi)) top = Math.max(top, h + CAM_SOLID_PAD);
  }
  const dx = ex - px, dy = top - py, dz = ez - pz;
  let t = 1;
  for (const b of boxes) {
    const h = solidHeight(b);
    if (h < 1 || h + CAM_SOLID_PAD <= top) continue;
    const lo = [b.x - b.w / 2 - CAM_SOLID_PAD, -1, b.z - b.d / 2 - CAM_SOLID_PAD];
    const hi = [b.x + b.w / 2 + CAM_SOLID_PAD, h + CAM_SOLID_PAD, b.z + b.d / 2 + CAM_SOLID_PAD];
    const o = [px, py, pz], d = [dx, dy, dz];
    let t0 = 0, t1 = 1;
    for (let a = 0; a < 3 && t0 <= t1; a++) {
      if (Math.abs(d[a]) < 1e-6) {
        if (o[a] < lo[a] || o[a] > hi[a]) { t0 = 1; t1 = 0; }
        continue;
      }
      let near = (lo[a] - o[a]) / d[a], far = (hi[a] - o[a]) / d[a];
      if (near > far) { const s = near; near = far; far = s; }
      t0 = Math.max(t0, near);
      t1 = Math.min(t1, far);
    }
    if (t0 <= t1 && t0 > 0 && t0 < t) t = t0;
  }
  if (t >= 1 && top === ey) return null;
  t = Math.max(t, CAM_SOLID_MIN);
  return { x: px + dx * t, y: py + dy * t, z: pz + dz * t };
}

// `camera` is the THREE camera to place; `interior` is sim/interior.js's state,
// read for the space's rig and its frame clamp. Returns the rig and the reads
// the frame loop, input and the city view make.
export function createFollowRig({ camera, interior }) {
  const cam = { yaw: Math.PI, pitch: STREET_RIG.pitch, dist: STREET_RIG.dist, ground: 0 };
  const lookAt = new THREE.Vector3();

  // Drag looks, wheel dollies.
  function look(dx, dy) {
    cam.yaw -= dx * ORBIT_PER_PX;
    cam.pitch = clamp(cam.pitch + dy * PITCH_PER_PX, PITCH_MIN, PITCH_MAX);
  }
  function dolly(dy) {
    cam.dist = clamp(cam.dist * (1 + dy * DOLLY_PER_WHEEL), DOLLY_MIN, DOLLY_MAX);
  }

  // Through a door: the cut is immediate, so the camera snaps to the space's rig
  // behind the player — yaw to theirs, no ground ease across the teleport.
  function enterSpace(player) {
    const rig = currentPlace(interior)?.rig ?? STREET_RIG;
    cam.yaw = player.yaw;
    cam.dist = rig.dist;
    cam.pitch = rig.pitch;
    cam.ground = player.y;
  }

  // In the car, out of it: the two framings.
  function enterDrive() {
    cam.dist = DRIVE_RIG.dist;
    cam.pitch = DRIVE_RIG.pitch;
  }
  function exitDrive() {
    cam.dist = STREET_RIG.dist;
    cam.pitch = STREET_RIG.pitch;
  }

  // The fixed step's drive easing; `input` is game/input.js's readings.
  function easeDrive(carYaw, elapsed, input, step) {
    if (!input.dragging && elapsed - input.lastDragT > DRIVE_SETTLE) {
      cam.yaw += angDiff(carYaw, cam.yaw) * Math.min(1, step * DRIVE_EASE);
    }
  }

  // Place the eye behind the drawn actor (the blended pose) and aim it. `dt` is
  // the clamped frame delta; `boxes` are the street's solid footprints, so the
  // arm can stop at a wall instead of entering the block. Returns the look point
  // the city view frames against.
  function placeFollowCamera(actor, driving, dt, boxes = null) {
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const cx = actor.x - Math.sin(cam.yaw) * cam.dist * cp;
    const cz = actor.z - Math.cos(cam.yaw) * cam.dist * cp;
    // The camera rides the higher of two grounds — the one under the actor and
    // the one under itself — so a bank standing between them cannot swallow it.
    cam.ground += (Math.max(actor.y, heightAt(cx, cz)) - cam.ground) * Math.min(1, dt * GROUND_EASE);
    const pivot = { x: actor.x, y: actor.y + CAM_PIVOT, z: actor.z };
    const eye = { x: cx, y: sp * cam.dist + EYE_LIFT + cam.ground, z: cz };
    const clear = boxes && interior.space === STREET
      ? clearStreetArm(pivot.x, pivot.y, pivot.z, eye.x, eye.y, eye.z, boxes)
      : null;
    camera.position.set(clear?.x ?? eye.x, clear?.y ?? eye.y, clear?.z ?? eye.z);
    if (!driving) {
      camera.position.copy(frameCamera(interior, pivot, camera.position));
    }
    lookAt.set(
      actor.x + (driving ? Math.sin(actor.yaw) * DRIVE_LOOK_AHEAD : 0),
      actor.y + (driving ? DRIVE_LOOK_HEIGHT : LOOK_HEIGHT),
      actor.z + (driving ? Math.cos(actor.yaw) * DRIVE_LOOK_AHEAD : 0),
    );
    camera.lookAt(lookAt);
    return lookAt;
  }

  return { cam, look, dolly, enterSpace, enterDrive, exitDrive, easeDrive, placeFollowCamera };
}
