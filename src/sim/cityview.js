// City view: the builder's hand. Z lifts the camera off the street to an oblique
// overview of the district, Z brings it back down to the player, and up there
// the player zones lots. One world, two scales, no loading screen: the sim
// never stops and the player's body stays where it stood.
//
// This file is the tool's state and nothing else — where the camera is heading,
// how far through the move it is, where the overview looks, what is in the
// brush, which lot is under the cursor and what each lot is doing. Pure data
// and pure maths (law 5). The camera and the lot outlines are
// render/cityview.js; the pointer, the palette and the readout are
// ui/cityview.js. What zoning does to a lot is sim/zoning.js (zoneParcel).
import { STAGE, zoneParcel } from './zoning.js';
import { worldMap } from './patrol.js';

// Seconds for the whole rise, and for the whole descent.
const LIFT_SECS = 1.6;
// The overview is oblique — a Cities: Skylines distance, never a flat map and
// never the horizon. Radians above the ground; the drag moves inside the band.
export const TILT = { start: 1, min: 0.9, max: 1.25 };
// Metres from the camera to the point it looks at. It starts where all ten lots
// fit on screen from most headings; the wheel moves inside the band, whose far
// end keeps the top of the frame inside the camera's 400 m reach.
export const REACH = { start: 200, min: 60, max: 220 };
// Metres a second the overview pans at its start distance. It pans faster the
// further out it stands, so a keypress always crosses the same share of screen.
const PAN_SPEED = 60;
const HURRY_PAN = 2.2;

// The palette, keyed R C I X: three uses and the eraser.
export const BRUSH_KEYS = { r: 'res', c: 'com', i: 'ind', x: null };

// The rise frames the lots, whichever corner of the district it starts from.
function lotCentre(city) {
  const xs = city.parcels.flatMap((p) => [p.x - p.w / 2, p.x + p.w / 2]);
  const zs = city.parcels.flatMap((p) => [p.z - p.d / 2, p.z + p.d / 2]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
}

// Where a lot is on its way from empty to tower, as one number. Its change
// from one frame to the next is the only honest answer to "is it growing?":
// the rules that move it belong to sim/zoning.js and are not repeated here.
const levelOf = (p) => p.stage + p.progress;

export function createCityView(city, map = worldMap()) {
  const home = lotCentre(city);
  return {
    mode: 'street',        // where the camera is heading: 'street' or 'city'
    lift: 0,               // 0 on the street rig, 1 at the overview
    home,
    x: home.x,             // the overview's pivot on the ground
    z: home.z,
    // The map's own district floor: the pan stays over it, whatever the seed.
    bounds: map.district.walk,
    yaw: 0,
    tilt: TILT.start,
    reach: REACH.start,
    brush: 'res',
    hover: -1,
    level: city.parcels.map(levelOf),
    trend: city.parcels.map(() => 0),
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Z. Going up starts a fresh overview over the lots, facing the way the street
// camera faced, so the rise is one continuous move. Reversing mid-move keeps
// the overview it had.
export function toggleCityView(view, streetYaw) {
  if (view.mode === 'city') {
    view.mode = 'street';
    view.hover = -1;
    return;
  }
  view.mode = 'city';
  if (view.lift > 0) return;
  view.x = view.home.x;
  view.z = view.home.z;
  view.yaw = streetYaw;
  view.tilt = TILT.start;
  view.reach = REACH.start;
}

// Every key this track owns. Returns whether the key was city view's.
export function cityKey(view, key, streetYaw) {
  if (key === 'z') {
    toggleCityView(view, streetYaw);
    return true;
  }
  if (view.mode !== 'city' || !(key in BRUSH_KEYS)) return false;
  view.brush = BRUSH_KEYS[key];
  return true;
}

export function chooseBrush(view, use) {
  if (use === null || Object.values(BRUSH_KEYS).includes(use)) view.brush = use;
}

// A drag in the overview: sideways orbits, up and down tilts inside the band.
export function orbitCityView(view, dYaw, dTilt) {
  view.yaw += dYaw;
  view.tilt = clamp(view.tilt + dTilt, TILT.min, TILT.max);
}

export function zoomCityView(view, factor) {
  view.reach = clamp(view.reach * factor, REACH.min, REACH.max);
}

export function hoverLot(view, index) {
  view.hover = view.mode === 'city' ? index : -1;
}

// A click: the brush goes on the lot under the cursor. Returns whether the
// lot's zoning changed.
export function paintLot(view, city) {
  if (view.mode !== 'city' || view.lift < 1 || view.hover < 0) return false;
  return zoneParcel(city, view.hover, view.brush);
}

// WASD pans the overview, relative to the way it faces, the same axes the
// player walks on. The pivot stays over the district floor.
function pan(view, keys, dt) {
  const ahead = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  const right = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  if (!ahead && !right) return;
  const len = Math.hypot(ahead, right);
  const step = (PAN_SPEED * (view.reach / REACH.start) * (keys.has('shift') ? HURRY_PAN : 1) * dt) / len;
  const fx = Math.sin(view.yaw);
  const fz = Math.cos(view.yaw);
  view.x = clamp(view.x + (fx * ahead - fz * right) * step, view.bounds.minX, view.bounds.maxX);
  view.z = clamp(view.z + (fz * ahead + fx * right) * step, view.bounds.minZ, view.bounds.maxZ);
}

// After tickZoning, every frame. `keys` is the set of held keys, lower-case.
export function tickCityView(view, city, dt, keys) {
  const goal = view.mode === 'city' ? 1 : 0;
  const step = dt / LIFT_SECS;
  view.lift = goal > view.lift ? Math.min(goal, view.lift + step) : Math.max(goal, view.lift - step);
  if (view.mode === 'city') pan(view, keys, dt);
  city.parcels.forEach((p, i) => {
    const level = levelOf(p);
    view.trend[i] = Math.sign(level - view.level[i]);
    view.level[i] = level;
  });
}

// What a lot is doing, in the terms the readout shows (pillar 5): one of
// 'clearing' (its building does not match its zoning and is coming down),
// 'stalled' (no power: the zone is blacked out), 'growing', 'declining',
// 'complete', 'waiting' (zoned, but the market is not there yet) or 'unzoned'.
export function lotStatus(view, city, index, dark) {
  const p = city.parcels[index];
  const settled = p.use === p.zoned;
  if (settled && p.zoned === null) return 'unzoned';
  if (settled && p.stage === STAGE.HIGH && view.trend[index] === 0) return 'complete';
  if (dark) return 'stalled';
  if (!settled) return 'clearing';
  if (view.trend[index] > 0) return 'growing';
  if (view.trend[index] < 0) return 'declining';
  return 'waiting';
}
