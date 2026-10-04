// Camera (M3.T3, criterion M3-1): the follow rig, its per-frame placement, the
// interior rigs and the drag-to-orbit/dolly reads, out of main.js. It reads sim
// state and writes the THREE camera; it never mutates the sim. Pointer events
// stay in game/input.js, which hands the deltas to look() and dolly().
import * as THREE from 'three';
import { currentPlace, frameCamera } from '../sim/interior.js';
import { heightAt } from '../sim/world.js';

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
  // the clamped frame delta. Returns the look point the city view frames against.
  function placeFollowCamera(actor, driving, dt) {
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const cx = actor.x - Math.sin(cam.yaw) * cam.dist * cp;
    const cz = actor.z - Math.cos(cam.yaw) * cam.dist * cp;
    // The camera rides the higher of two grounds — the one under the actor and
    // the one under itself — so a bank standing between them cannot swallow it.
    cam.ground += (Math.max(actor.y, heightAt(cx, cz)) - cam.ground) * Math.min(1, dt * GROUND_EASE);
    camera.position.set(cx, sp * cam.dist + EYE_LIFT + cam.ground, cz);
    if (!driving) {
      const pivot = { x: actor.x, y: actor.y + CAM_PIVOT, z: actor.z };
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
