// Places a person can stand that are not the pavement: the floor of a shop, the
// top of a tower. One world, no loading screen — a space is a volume inside the
// city's own buildings, and a door is two spots that swap the player between
// spaces. Pure data and pure maths (law 5): render reads SPACES to build what it
// draws, main ticks the state and asks where the camera may go.
//
// The pattern every later interior copies is docs/INTERIORS.md.
import { zoneAt } from './street.js';
import { PINNED_TOWERS, towerCentreX } from './landmarks.js';
import { STAGE, SETBACK } from './zoning.js';
import { nearestEdge } from './world.js';

export const STREET = 'street';

// A person is a circle this wide when it comes to walls.
export const BODY_RADIUS = 0.28;
// How far from a door's spot E still opens it.
export const DOOR_REACH = 1.2;
// The camera keeps this far off every wall, ceiling and shelf, so the near plane
// (0.1) never slices through one.
const CAMERA_MARGIN = 0.2;
// Closer to the head than this and the camera gives up on the follow line and
// looks down over the shoulder from this pitch instead.
const CAMERA_SQUEEZE = 1.0;
const STEEP_PITCH = 1.2;

// A space is authored in a facade frame, not in world coordinates, so the same
// template can be hung on any face of any building. `a` runs across the face —
// to the right of someone walking in — and `d` runs into the building from the
// face line. `out` is the face's outward normal, and the city is axis-aligned,
// so it is always one of the four cardinals.
function toWorld(fr, a, d) {
  const [fx, fz] = fr.out;
  return { x: fr.x + a * fz - d * fx, z: fr.z - a * fx - d * fz };
}

function rectToWorld(fr, [a0, a1], [d0, d1]) {
  const p = toWorld(fr, a0, d0);
  const q = toWorld(fr, a1, d1);
  return {
    minX: Math.min(p.x, q.x), maxX: Math.max(p.x, q.x),
    minZ: Math.min(p.z, q.z), maxZ: Math.max(p.z, q.z),
  };
}

// Headings in the frame, as the yaw tickPlayer and the follow cam use:
// forward is (sin yaw, cos yaw).
const HEADINGS = { in: 0, right: -Math.PI / 2, out: Math.PI, left: Math.PI / 2 };

export function frameYaw(fr) {
  const [fx, fz] = fr.out;
  return Math.atan2(fx, fz);
}

function yawIn(fr, heading) {
  return frameYaw(fr) + Math.PI + HEADINGS[heading];
}

// ---------------------------------------------------------------------------
// The spaces.
//
// RAMEN is the noodle bar behind the RAMEN fascia on the main avenue: the
// 44 m tower on the west side at z = -14 (landmarks.js PINNED_TOWERS 'ramen').
// Its podium face and the noodle-bar bay of its glazing are derived below; the
// door is hung in that bay. The room stops 0.65 m short of the face on purpose
// — that is where the tower's shaft begins, and a camera inside the shaft sees
// none of the city's single-sided boxes from behind.
//
// ROOF is the crown of the neighbouring tower to the south (PINNED_TOWERS
// 'roof', 34 m with a setback crown to 44.2 m). It is the roof on this side of
// the avenue with a clear line to the growth lots: the south-west pair below
// it, the one in the gap in the east row across the avenue, the two past the
// east avenue. Its walking surface is the crown's lip plate, 12.9 x 10.9 m at
// y 44.475.

// How far the podium and the crown lip stand proud of the shaft face, and which
// bay of the noodle bar's glazing the door is hung in. The frames below and the
// render's own placement both read these, so the numbers cannot drift apart.
const PODIUM_LIP = 1.2;
const CROWN_LIP = 0.9;
const RAMEN_BAY_DZ = 3.23;

const RAMEN_TOWER = PINNED_TOWERS.find((t) => t.id === 'ramen');
const ROOF_TOWER = PINNED_TOWERS.find((t) => t.id === 'roof');

const RAMEN_FRAME = {
  x: towerCentreX(RAMEN_TOWER) - RAMEN_TOWER.side * (RAMEN_TOWER.w + PODIUM_LIP) / 2,
  z: RAMEN_TOWER.z + RAMEN_BAY_DZ,
  out: [-RAMEN_TOWER.side, 0],
};
const ROOF_FRAME = {
  x: towerCentreX(ROOF_TOWER) - ROOF_TOWER.side * (ROOF_TOWER.w + CROWN_LIP) / 2,
  z: ROOF_TOWER.z,
  out: [-ROOF_TOWER.side, 0],
};

// Everything in a space is a footprint in the frame plus a top above the floor.
// `solid: false` is dressing a person can walk through (it stands inside a
// solid already, or it is on a wall). The render builds each kind; the sim only
// needs the solids.
const RAMEN_ITEMS = [
  { kind: 'kitchen', a: [-2.1, -0.4], d: [2.2, 8.0], top: 1.28 },
  { kind: 'keeper', a: [-1.45, -1.0], d: [4.35, 4.85], top: 1.72, solid: false },
  { kind: 'diner', a: [-0.35, 0.25], d: [5.0, 5.4], top: 1.4, solid: false },
  ...[2.8, 3.6, 4.4, 5.2, 6.0].map((d) => ({ kind: 'stool', a: [-0.18, 0.18], d: [d - 0.18, d + 0.18], top: 0.72 })),
  { kind: 'ticket', a: [-2.05, -1.35], d: [0.7, 1.3], top: 1.75 },
  { kind: 'cooler', a: [-1.2, -0.84], d: [0.72, 1.06], top: 1.15 },
  { kind: 'ledge', a: [1.9, 4.6], d: [0.65, 1.05], top: 1.02 },
  ...[2.45, 3.25, 4.05].map((a) => ({ kind: 'highstool', a: [a - 0.17, a + 0.17], d: [1.28, 1.62], top: 0.8 })),
  { kind: 'shelf', a: [4.18, 4.6], d: [2.9, 6.2], top: 2.15 },
  { kind: 'fridge', a: [3.85, 4.6], d: [6.9, 7.95], top: 1.95 },
  { kind: 'crates', a: [2.7, 3.55], d: [7.35, 7.95], top: 0.92 },
];

const ROOF_ITEMS = [
  // Already on the crown (block.js emitTower): two plant boxes and the beacon.
  { kind: 'existing', a: [-0.9, 0.9], d: [7.99, 10.19], top: 1.43 },
  { kind: 'existing', a: [-0.6, 0.6], d: [2.75, 4.15], top: 1.03 },
  { kind: 'beacon', a: [-0.3, 0.3], d: [6.15, 6.75], top: 0.8 },
  { kind: 'bulkhead', a: [-5.2, -2.7], d: [4.9, 7.9], top: 2.7 },
  { kind: 'tank', a: [2.2, 4.4], d: [7.6, 9.8], top: 3.3 },
  { kind: 'condenser', a: [4.35, 5.2], d: [2.0, 2.95], top: 0.95 },
  { kind: 'condenser', a: [4.35, 5.2], d: [3.35, 4.3], top: 0.95 },
  { kind: 'vent', a: [4.7, 5.1], d: [10.6, 11.0], top: 1.5 },
  { kind: 'vent', a: [-5.1, -4.7], d: [10.9, 11.3], top: 1.2 },
  { kind: 'dish', a: [-5.2, -4.2], d: [8.6, 9.6], top: 1.5 },
  { kind: 'smokers', a: [-5.0, -3.4], d: [0.45, 1.6], top: 0.9 },
];

export const SPACES = [
  {
    id: 'ramen',
    name: 'RAMEN',
    indoor: true,
    frame: RAMEN_FRAME,
    // Floor datum, the way heightAt() is the street's: the render lays the
    // boards a pavement-slab's rise above it. It clears the podium's plinth
    // (a solid block to 0.5 m whose top would otherwise show through the floor)
    // and it is the shopfront's sill height, so the door opens onto it.
    floor: 0.56,
    height: 2.95,
    room: { a: [-2.1, 4.6], d: [0.65, 8.0] },
    items: RAMEN_ITEMS,
    // Closer and higher than the street rig: a room is small, so the camera
    // sits over the shoulder and looks down into it.
    rig: { dist: 2.7, pitch: 0.5 },
  },
  {
    id: 'roof',
    name: 'ROOF',
    indoor: false,
    frame: ROOF_FRAME,
    floor: 44.375,
    height: Infinity,
    // Inside the parapet, which stands on the lip plate's edge.
    room: { a: [-5.23, 5.23], d: [0.22, 12.68] },
    items: ROOF_ITEMS,
    rig: { dist: 6, pitch: 0.5 },
  },
];

// Each end of a door: which space it is in, the spot E works from, and where
// someone coming through it arrives and which way they face. Arrival is a step
// clear of the door, not on it, so the camera has room behind them and a
// second press of E does not bounce them straight back.
//
// A street end names the face its door is hung on — the render hangs the door
// there — and its spot is a step out from that face onto the pavement.
const DOOR_STEP = 1.0;
export const DOORS = [
  {
    id: 'ramen-front',
    ends: [
      { space: STREET, face: RAMEN_FRAME, arrive: { x: -5.8, z: -9.0, yaw: 0 }, label: 'ENTER RAMEN' },
      { space: 'ramen', at: [0, 1.25], arrive: { at: [0.6, 2.7], heading: 'in' }, label: 'LEAVE' },
    ],
  },
  {
    // The neighbouring tower's own door on its north face (block.js puts a
    // door recess on every tower's +Z face), off the promenade.
    id: 'roof-stair',
    ends: [
      {
        space: STREET, face: { x: -13.5, z: -42.4, out: [0, 1] },
        arrive: { x: -12.0, z: -40.9, yaw: Math.PI / 2 }, label: 'STAIRS TO ROOF',
      },
      { space: 'roof', at: [-2.0, 6.4], arrive: { at: [-0.9, 5.2], heading: 'out' }, label: 'STAIRS DOWN' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived, once: every footprint in world coordinates.

function worldSpace(s) {
  const solids = s.items.filter((it) => it.solid !== false).map((it) => ({
    ...rectToWorld(s.frame, it.a, it.d), top: s.floor + it.top,
  }));
  return {
    ...s,
    zone: zoneAt(s.frame.z),
    bounds: rectToWorld(s.frame, s.room.a, s.room.d),
    solids,
    ceiling: s.floor + s.height,
  };
}

const PLACES = new Map(SPACES.map((s) => [s.id, worldSpace(s)]));

function endToWorld(end) {
  if (end.space === STREET) {
    const [fx, fz] = end.face.out;
    return { ...end, x: end.face.x + fx * DOOR_STEP, z: end.face.z + fz * DOOR_STEP };
  }
  const s = PLACES.get(end.space);
  const spot = toWorld(s.frame, ...end.at);
  const arrive = toWorld(s.frame, ...end.arrive.at);
  return {
    ...end, x: spot.x, z: spot.z,
    arrive: { x: arrive.x, z: arrive.z, yaw: yawIn(s.frame, end.arrive.heading) },
  };
}

const LINKS = DOORS.map((door) => ({ id: door.id, ends: door.ends.map(endToWorld) }));

export function placeOf(id) {
  return PLACES.get(id) ?? null;
}

// Every door end in world coordinates, for the render to hang things on.
export function doorEnds() {
  return LINKS.flatMap((link) => link.ends.map((end) => ({ door: link.id, ...end })));
}

// ---------------------------------------------------------------------------
// Grown lots. Every parcel at LOW or higher has a street door. Its face is the
// shell side standing nearest a road, so placement is derived from the lot and
// the world's own road graph (docs/PROCGEN.md), never a typed coordinate. The
// room behind it is authored in the same facade frame the hand-placed spaces
// use, so what a player bumps into is what render builds.

// The room's floor datum sits on the lot's plinth (render/zoning.js raises a
// PAD_RISE + 0.12 plinth under every shell), a slab's rise below the boards.
const PARCEL_FLOOR = 0.62;
// The room's clear height above its floor. A climbing crane stands its mast on
// the ground floor's ceiling, so this is where the mast starts.
const PARCEL_ROOM_HEIGHT = 3.0;
// The room never reaches the shell's own faces: the camera must not sit between
// the room and the wall behind it.
const PARCEL_WALL = 0.4;
// The face already stands SETBACK inside the hoarding, so the street spot and
// arrival add that back and clear the fence.
const PARCEL_OUT = SETBACK + 0.5;
const PARCEL_ARRIVE_OUT = PARCEL_OUT + 1.0;
// How far inside the face the door spot and the arrival stand.
const PARCEL_IN = 1.3;
const PARCEL_ARRIVE_IN = 2.6;

const PARCEL_SIDES = [
  { out: [1, 0], spanZ: true },
  { out: [-1, 0], spanZ: true },
  { out: [0, 1], spanZ: false },
  { out: [0, -1], spanZ: false },
];

const itemMid = (r) => (r[0] + r[1]) / 2;

function parcelSide(p, s) {
  const hw = Math.max(1.6, p.w / 2 - SETBACK);
  const hd = Math.max(1.6, p.d / 2 - SETBACK);
  const [fx, fz] = s.out;
  return {
    out: s.out,
    x: p.x + fx * hw,
    z: p.z + fz * hd,
    faceLen: s.spanZ ? hd * 2 : hw * 2,
    depth: s.spanZ ? hw * 2 : hd * 2,
  };
}

// Which of the four shell faces stands nearest a road. Ties break in table
// order, so the choice is deterministic.
function streetFace(p) {
  let best = parcelSide(p, PARCEL_SIDES[0]);
  let bestD = nearestEdge(best.x, best.z).dist;
  for (const s of PARCEL_SIDES.slice(1)) {
    const side = parcelSide(p, s);
    const d = nearestEdge(side.x, side.z).dist;
    if (d < bestD) { best = side; bestD = d; }
  }
  return best;
}

// Fixtures along the walls, leaving the entry corridor clear: everything sits
// outside a ∈ [-0.7, 0.8] or deeper than the arrival at d = PARCEL_ARRIVE_IN.
// A shop, a residential lobby, a workshop — bigger at MID and above.
function parcelItems(use, stage, a, d) {
  const [a0, a1] = a;
  const [d0, d1] = d;
  const big = stage >= STAGE.MID;
  if (use === 'res') {
    const items = [
      { kind: 'mailboxes', a: [a0, a0 + 0.4], d: [d0 + 0.6, d0 + 2.4], top: 1.6 },
      { kind: 'flatdoor', a: [-0.6, 0.6], d: [d1 - 0.1, d1 - 0.04], top: 2.15, solid: false },
      { kind: 'plant', a: [a1 - 0.95, a1 - 0.35], d: [d0 + 0.5, d0 + 1.0], top: 1.2 },
    ];
    // The stair core backs onto the rear wall so it never covers the arrival or
    // the follow cam's line behind the player. A room too narrow across, or too
    // shallow to give the core a metre of depth, goes without one.
    const back = [Math.max(d0 + 3.2, d1 - 3.2), d1 - 0.5];
    if (a1 >= 2.3 && back[1] - back[0] >= 1.0) {
      items.push({ kind: 'stair', a: [a1 - 1.5, a1 - 0.15], d: back, top: 3.0 });
    }
    return items;
  }
  if (use === 'ind') {
    return [
      { kind: 'shelf', a: [a0, a0 + 0.45], d: [d0 + 0.7, d1 - 0.8], top: 3.0 },
      { kind: 'shelf', a: [a1 - 0.45, a1], d: [d0 + 0.7, d1 - 1.6], top: 3.0 },
      { kind: 'forklift', a: [0.2, 1.4], d: [Math.max(d0 + 2.3, d1 - 2.0), d1 - 0.8], top: 1.9 },
      { kind: 'crates', a: [a0 + 0.7, a0 + 1.5], d: [d0 + 0.7, d0 + 1.25], top: 0.9 },
      { kind: 'roller', a: [-1.3, 1.3], d: [d1 - 0.1, d1 - 0.04], top: 2.6, solid: false },
    ];
  }
  const items = [
    { kind: 'counter', a: [a0, a0 + 0.6], d: [d0 + 0.7, d1 - 0.6], top: 1.05 },
    { kind: 'shelf', a: [a1 - 0.45, a1 - 0.05], d: [d0 + 0.7, d1 - 1.3], top: 2.05 },
    { kind: 'fridge', a: [a1 - 1.8, a1 - 0.7], d: [d1 - 0.8, d1 - 0.2], top: 1.95 },
    { kind: 'crates', a: [a0 + 0.2, a0 + 1.0], d: [d0 + 0.7, d0 + 1.25], top: 0.9 },
  ];
  if (big) items.push({ kind: 'cafe', a: [a0 + 1.1, a0 + 2.6], d: [d1 - 2.6, d1 - 1.3], top: 0.95 });
  return items;
}

// Where a room's light comes from, in its frame: [a, y, d, strength, reach].
// No gas here — the flame channel belongs to the noodle bar.
function parcelLights(a, d) {
  const A = Math.max(1, a[1]);
  const [d0, d1] = d;
  const midD = itemMid(d);
  return {
    lamp: [
      [-A * 0.55, 2.7, midD, 0.85, 2.6],
      [A * 0.55, 2.7, midD, 0.85, 2.6],
      [0, 2.7, d0 + 1.0, 0.7, 2.2],
      [0, 2.7, d1 - 1.0, 0.7, 2.2],
    ],
    flame: [],
    window: { d: d0, falloff: 2.2 },
    emergency: [[0, 2.35, d0 + 0.7, 0.55, 2.4]],
  };
}

export function parcelSpace(p, i) {
  const side = streetFace(p);
  const halfA = Math.max(1.2, side.faceLen / 2 - PARCEL_WALL);
  const a = [-halfA, halfA];
  const d = [0.65, Math.max(3.4, side.depth - PARCEL_WALL)];
  return {
    id: `lot:${i}`,
    name: `LOT ${i}`,
    indoor: true,
    parcel: i,
    use: p.use,
    stage: p.stage,
    frame: { x: side.x, z: side.z, out: side.out },
    floor: PARCEL_FLOOR,
    height: PARCEL_ROOM_HEIGHT,
    room: { a, d },
    items: parcelItems(p.use, p.stage, a, d),
    rig: { dist: 2.7, pitch: 0.5 },
    lights: parcelLights(a, d),
  };
}

export function parcelPlace(p, i) {
  return worldSpace(parcelSpace(p, i));
}

// Where a lot's tower crane stands its mast. On a bare site it stands on the
// ground; from LOW up the lot has a room, so it climbs onto that room's ceiling.
// The mast stands on the slab above the ceiling, not on the ceiling's own plane,
// where its foot would z-fight the plaster and show as a dark patch in the room.
const CRANE_SLAB = 0.3;

export function craneBase(p) {
  return p.stage < STAGE.LOW ? 0 : PARCEL_FLOOR + PARCEL_ROOM_HEIGHT + CRANE_SLAB;
}

// The link between the lot's street face and its room, in world coordinates.
function parcelEnds(place) {
  const fr = place.frame;
  const doorIn = toWorld(fr, 0, PARCEL_IN);
  const arriveIn = toWorld(fr, 0.6, PARCEL_ARRIVE_IN);
  const spot = toWorld(fr, 0, -PARCEL_OUT);
  const arrive = toWorld(fr, 0, -PARCEL_ARRIVE_OUT);
  return [
    {
      space: STREET, x: spot.x, z: spot.z,
      arrive: { x: arrive.x, z: arrive.z, yaw: frameYaw(fr) }, label: 'ENTER',
    },
    {
      space: place.id, x: doorIn.x, z: doorIn.z,
      arrive: { x: arriveIn.x, z: arriveIn.z, yaw: yawIn(fr, 'in') }, label: 'LEAVE',
    },
  ];
}

// ---------------------------------------------------------------------------
// State.

export function createInterior(city = null) {
  const state = { space: STREET, near: null, lastX: null, lastZ: null, places: null, links: null, hold: -1 };
  if (city) state.city = city;
  return state;
}

// Rebuild what the city currently offers: a place and a door for every grown
// lot. Called every tick, after the city moved. `hold` is the parcel the player
// is standing in — sim/zoning.js defers its decline while they are inside.
export function syncInterior(state) {
  if (!state.city) return;
  const places = new Map(PLACES);
  const links = LINKS.slice();
  let hold = -1;
  state.city.parcels.forEach((p, i) => {
    if (p.use === null || p.stage < STAGE.LOW) return;
    const place = parcelPlace(p, i);
    places.set(place.id, place);
    links.push({ id: `${place.id}-door`, parcelUse: p.use, ends: parcelEnds(place) });
    if (state.space === place.id) hold = i;
  });
  state.places = places;
  state.links = links;
  state.hold = hold;
}

export function isIndoors(state) {
  return currentPlace(state)?.indoor ?? false;
}

export function currentPlace(state) {
  return state.places?.get(state.space) ?? PLACES.get(state.space) ?? null;
}

// The parcel whose room the player is standing in, or -1 on the street and in
// the hand-placed spaces. sim/zoning.js defers this parcel's decline.
export function occupiedParcel(state) {
  const id = state.space;
  return id.startsWith('lot:') ? Number(id.slice(4)) : -1;
}

// The door end this spot can use, and the end it leads to.
export function doorAt(state, x, z) {
  for (const link of state.links ?? LINKS) {
    const [p, q] = link.ends;
    for (const [from, to] of [[p, q], [q, p]]) {
      if (from.space !== state.space) continue;
      if (Math.hypot(x - from.x, z - from.z) <= DOOR_REACH) return { id: link.id, from, to, label: from.label };
    }
  }
  return null;
}

// Per tick, after tickPlayer: keep the player inside the space they are in and
// note which door, if any, they can reach.
export function tickInterior(state, player) {
  syncInterior(state);
  settle(state, player);
  state.near = doorAt(state, player.x, player.z);
}

// Walk through the reachable door. Returns what was used, or null.
export function useDoor(state, player) {
  const door = doorAt(state, player.x, player.z);
  if (!door) return null;
  state.space = door.to.space;
  player.x = door.to.arrive.x;
  player.z = door.to.arrive.z;
  player.yaw = door.to.arrive.yaw;
  player.speed = 0;
  const place = currentPlace(state);
  if (place) player.y = place.floor;
  state.lastX = player.x;
  state.lastZ = player.z;
  state.near = doorAt(state, player.x, player.z);
  return door;
}

// ---------------------------------------------------------------------------
// Collision. A space is a rectangle with solid rectangles in it, and a person is
// a circle. tickPlayer has already moved them; this keeps what it can of that
// move. Sliding along a wall is the point — revert only the axis that hit.

function hitsSolid(place, x, z) {
  for (const s of place.solids) {
    const dx = Math.max(s.minX - x, 0, x - s.maxX);
    const dz = Math.max(s.minZ - z, 0, z - s.maxZ);
    if (dx * dx + dz * dz < BODY_RADIUS * BODY_RADIUS) return true;
  }
  return false;
}

function insideRoom(place, x, z) {
  const b = place.bounds;
  return x >= b.minX + BODY_RADIUS && x <= b.maxX - BODY_RADIUS
    && z >= b.minZ + BODY_RADIUS && z <= b.maxZ - BODY_RADIUS;
}

export function standable(place, x, z) {
  return insideRoom(place, x, z) && !hitsSolid(place, x, z);
}

function clampToRoom(place, x, z) {
  const b = place.bounds;
  return {
    x: Math.max(b.minX + BODY_RADIUS, Math.min(b.maxX - BODY_RADIUS, x)),
    z: Math.max(b.minZ + BODY_RADIUS, Math.min(b.maxZ - BODY_RADIUS, z)),
  };
}

function settle(state, player) {
  const place = currentPlace(state);
  if (!place) {
    state.lastX = player.x;
    state.lastZ = player.z;
    return;
  }
  const fromX = state.lastX ?? player.x;
  const fromZ = state.lastZ ?? player.z;
  const want = clampToRoom(place, player.x, player.z);
  let x = want.x;
  let z = want.z;
  if (hitsSolid(place, x, z)) {
    if (!hitsSolid(place, x, fromZ)) z = fromZ;
    else if (!hitsSolid(place, fromX, z)) x = fromX;
    else { x = fromX; z = fromZ; }
  }
  player.x = x;
  player.z = z;
  player.y = place.floor;
  state.lastX = x;
  state.lastZ = z;
}

// ---------------------------------------------------------------------------
// The camera. The follow cam asks for an eye; in a space it gets the nearest
// point on the line from the player's head to that eye that is inside the
// room, under the ceiling and outside every solid. On the roof only the floor
// and the solids bind — the camera may hang out past the parapet over the
// street, which is exactly where a person would look from.

// Where along pivot + t * dir the ray leaves the box [lo, hi] (the pivot is
// inside it). Infinity when it never does.
function exitT(p, dir, lo, hi) {
  let t = Infinity;
  for (let k = 0; k < 3; k++) {
    if (dir[k] > 0) t = Math.min(t, (hi[k] - p[k]) / dir[k]);
    else if (dir[k] < 0) t = Math.min(t, (lo[k] - p[k]) / dir[k]);
  }
  return t;
}

// Where the ray first enters the box, or Infinity when it misses.
function enterT(p, dir, lo, hi) {
  let near = 0;
  let far = Infinity;
  for (let k = 0; k < 3; k++) {
    if (dir[k] === 0) {
      if (p[k] < lo[k] || p[k] > hi[k]) return Infinity;
      continue;
    }
    const t0 = (lo[k] - p[k]) / dir[k];
    const t1 = (hi[k] - p[k]) / dir[k];
    near = Math.max(near, Math.min(t0, t1));
    far = Math.min(far, Math.max(t0, t1));
  }
  return near <= far ? near : Infinity;
}

function cameraBox(place) {
  const m = CAMERA_MARGIN;
  if (!place.indoor) return { lo: [-Infinity, place.floor + m * 2, -Infinity], hi: [Infinity, Infinity, Infinity] };
  const b = place.bounds;
  return { lo: [b.minX + m, place.floor + m, b.minZ + m], hi: [b.maxX - m, place.ceiling - m, b.maxZ - m] };
}

function clipRay(place, p, dir) {
  const box = cameraBox(place);
  let t = Math.min(1, exitT(p, dir, box.lo, box.hi));
  const m = CAMERA_MARGIN;
  for (const s of place.solids) {
    t = Math.min(t, enterT(p, dir, [s.minX - m, place.floor - 1, s.minZ - m], [s.maxX + m, s.top + m, s.maxZ + m]));
  }
  return Math.max(0, t);
}

function along(p, dir, t) {
  return { x: p[0] + dir[0] * t, y: p[1] + dir[1] * t, z: p[2] + dir[2] * t };
}

export function frameCamera(state, pivot, eye) {
  const place = currentPlace(state);
  if (!place) return eye;
  const p = [pivot.x, pivot.y, pivot.z];
  const dir = [eye.x - pivot.x, eye.y - pivot.y, eye.z - pivot.z];
  const len = Math.hypot(...dir);
  if (len < 1e-6) return eye;
  const t = clipRay(place, p, dir);
  if (t * len >= CAMERA_SQUEEZE || !place.indoor) return along(p, dir, t);
  // Backed into a wall: look down over the shoulder rather than into the back
  // of the player's skull. Same heading, steeper, and whichever has more room.
  const flat = Math.hypot(dir[0], dir[2]) || 1;
  const reach = Math.cos(STEEP_PITCH) * len / flat;
  const steep = [dir[0] * reach, Math.sin(STEEP_PITCH) * len, dir[2] * reach];
  const t2 = clipRay(place, p, steep);
  return t2 > t ? along(p, steep, t2) : along(p, dir, t);
}
