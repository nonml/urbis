// M6.T1 (M6-1, docs/ROADMAP.md): the registry of everything hackable.
//
// One place answers "what can be hacked, where, for how much": junctions, cars,
// cameras, pipes, cranes, buildings, people, bridges, control boxes and
// planning offices, each { id, kind, name, x, z, hacks, cost, district, ref }.
// Static entries derive from the map and rebuild when map.version moves; live
// ones (cars, walkers, growing lots) update in place through syncHackables().
// Deterministic and pure (law 5): map data only, no RNG, no three.js, no DOM.
// Aim (M6.T2) reads it through aimTarget(): nearest, in the view cone, in sight.
import { STAGE, districtAt as areaAt, frontageRoad, projectOnSegment } from './map.js';
import { blindStreet, BLIND_SECS, blindWays } from './patrol.js';
import { ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';

// The aim range M6-1 names.
export const HACK_RANGE = 40;

// The ten kinds, in the plan's order; a kind with nothing on the map today (a
// bridge before M4.T7) has no entries until the map grows one.
export const KINDS = ['junction', 'car', 'camera', 'pipe', 'crane',
  'building', 'person', 'bridge', 'control', 'planning'];

// Names, battery costs, reach. M6.T4 moves the numbers to docs/HACKING.md.
export const HACKS = {
  blackout: { id: 'blackout', name: 'BLACKOUT', cost: 6, reach: 'district' },
  profiler: { id: 'profiler', name: 'PROFILE', cost: 1, reach: 'person' },
  signals: { id: 'signals', name: 'ALL-GREEN', cost: 2, reach: 'junction' },
  bollards: { id: 'bollards', name: 'BOLLARDS', cost: 2, reach: 'junction' },
  pipe_burst: { id: 'pipe_burst', name: 'BURST PIPE', cost: 2, reach: 'street' },
  hijack: { id: 'hijack', name: 'HIJACK', cost: 2, reach: 'car' },
  camera_cut: { id: 'camera_cut', name: 'CUT CAMERA', cost: 1, reach: 'street' },
  camera_view: { id: 'camera_view', name: 'CAMERA VIEW', cost: 1, reach: 'street' },
  eavesdrop: { id: 'eavesdrop', name: 'EAVESDROP', cost: 1, reach: 'person' },
  bank: { id: 'bank', name: 'BANK TRANSFER', cost: 2, reach: 'person' },
  crane_stop: { id: 'crane_stop', name: 'STOP CRANE', cost: 1, reach: 'lot' },
  crane_drop: { id: 'crane_drop', name: 'DROP LOAD', cost: 2, reach: 'lot' },
  fire_alarm: { id: 'fire_alarm', name: 'FIRE ALARM', cost: 1, reach: 'building' },
  bridge_raise: { id: 'bridge_raise', name: 'RAISE SPAN', cost: 3, reach: 'bridge' },
  permit_fast: { id: 'permit_fast', name: 'FAST-TRACK', cost: 2, reach: 'lot' },
  permit_freeze: { id: 'permit_freeze', name: 'FREEZE', cost: 2, reach: 'lot' },
};

// What a kind carries, default hack first; the order is the menu order.
const KIND_HACKS = {
  junction: ['signals', 'bollards'], car: ['hijack'], pipe: ['pipe_burst'],
  camera: ['camera_cut', 'camera_view'], crane: ['crane_stop', 'crane_drop'],
  building: ['fire_alarm'], person: ['profiler', 'eavesdrop', 'bank'],
  bridge: ['bridge_raise'], control: ['blackout'], planning: ['permit_fast', 'permit_freeze'],
};
const KIND_NAMES = {
  junction: 'JUNCTION', car: 'CAR', camera: 'CAMERA', pipe: 'STEAM PIPE', crane: 'CRANE',
  building: 'BUILDING', person: 'PERSON', bridge: 'BRIDGE', control: 'CONTROL BOX', planning: 'PLANNING OFFICE',
};
const USE_NAMES = { res: 'APARTMENTS', com: 'OFFICES', ind: 'WORKS' };

const BOX_OUT = ROAD_HALF_WIDTH + 2.7; // furniture's own box stand-off (BOX_OUT)
const BOX_CLEAR = ROAD_HALF_WIDTH + WALKWAY_WIDTH + 1.5; // clear of a crossing band
const CAM_OUT = 0.4;
const EDGE_CLEAR = 2;

function entry(kind, id, x, z, ref, name, district = null) {
  const hacks = KIND_HACKS[kind].map((h) => HACKS[h]);
  return { id, kind, name: name ?? KIND_NAMES[kind], x, z, hacks, cost: hacks[0].cost, district, ref };
}

// The areas a control box and a planning office belong to: the map's districts,
// or the whole district as one area when it has none (the hand preset).
function areasOf(map) {
  return map.districts ?? [{ id: 0, name: 'city', walk: map.district.walk, drive: map.district.drive }];
}

// A junction is a node where both axes meet — the test traffic runs signals by
// (traffic.js signalNodes), so the registry never names one no car obeys.
function junctionNodes(map) {
  const axes = new Map();
  for (const e of map.graph.edges) {
    for (const end of [e.a, e.b]) {
      const set = axes.get(end) ?? new Set();
      set.add(e.axis);
      axes.set(end, set);
    }
  }
  return map.graph.nodes.filter((n) => (axes.get(n.id)?.size ?? 0) >= 2);
}

// A camera hangs on a building's wall facing the road it fronts, CAM_OUT off
// the footprint, and watches that road's street (the way id the game names
// streets by — M6.T12 cuts it).
function cameraSpot(map, byId, b) {
  const road = frontageRoad(map, b, byId);
  if (!road) return null;
  const hit = projectOnSegment(b.x, b.z, byId.get(road.edge.a), byId.get(road.edge.b));
  const dx = b.x - hit.x;
  const dz = b.z - hit.z;
  const d = Math.hypot(dx, dz) || 1;
  const out = Math.max(0, road.gap - CAM_OUT);
  return { x: hit.x + (dx / d) * out, z: hit.z + (dz / d) * out, way: road.edge.way };
}

// The z a control box stands at: the area's middle z, then the nearest z on a
// 2 m grid clear of crossings, inside the avenue and the area.
function boxZ(avenue, crossings, walk, zc) {
  const near = crossings.filter((c) => c.x0 <= avenue.x && avenue.x <= c.x1);
  const lo = Math.max(avenue.z0 + EDGE_CLEAR, walk.minZ + EDGE_CLEAR);
  const hi = Math.min(avenue.z1 - EDGE_CLEAR, walk.maxZ - EDGE_CLEAR);
  for (let n = 0; n <= 200; n++) {
    const step = Math.ceil(n / 2) * 2;
    const z = zc + (n % 2 === 1 ? -step : step);
    if (z >= lo && z <= hi && near.every((c) => Math.abs(z - c.z) >= BOX_CLEAR)) return z;
  }
  return Math.max(lo, Math.min(hi, zc));
}

// A district's control box: on the avenue nearest its middle, on the pavement
// side toward that middle.
function controlSpot(map, area) {
  const { walk } = area;
  const cx = (walk.minX + walk.maxX) / 2;
  const pool = map.district.avenues.filter((a) => a.x >= walk.minX && a.x <= walk.maxX);
  const avenue = [...(pool.length > 0 ? pool : map.district.avenues)]
    .sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
  const zc = (walk.minZ + walk.maxZ) / 2;
  return { x: avenue.x + (cx >= avenue.x ? 1 : -1) * BOX_OUT, z: boxZ(avenue, map.district.crossings, walk, zc) };
}

// The district's planning office: the standing building nearest its middle.
function officeSpot(map, area) {
  const { walk } = area;
  const cx = (walk.minX + walk.maxX) / 2;
  const cz = (walk.minZ + walk.maxZ) / 2;
  let best = null;
  for (const b of map.buildings ?? []) {
    if (b.x < walk.minX || b.x > walk.maxX || b.z < walk.minZ || b.z > walk.maxZ) continue;
    const d = Math.hypot(b.x - cx, b.z - cz);
    if (!best || d < best.d) best = { b, d };
  }
  return best?.b ?? null;
}

function buildPlaces(reg) {
  const map = reg.map;
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const places = [];
  for (const n of junctionNodes(map)) {
    places.push(entry('junction', `junction:${n.id}`, n.x, n.z, n, undefined, areaAt(map, n.x, n.z)?.id ?? null));
  }
  for (const e of map.graph.edges) {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    const x = (a.x + b.x) / 2;
    const z = (a.z + b.z) / 2;
    if (e.kind === 'avenue') {
      places.push(entry('pipe', `pipe:${e.id}`, x, z, e, undefined, areaAt(map, x, z)?.id ?? null));
    }
    if (e.kind === 'bridge') places.push(entry('bridge', `bridge:${e.id}`, x, z, e));
  }
  for (const b of map.buildings ?? []) {
    const spot = cameraSpot(map, byId, b);
    if (!spot) continue;
    const district = areaAt(map, spot.x, spot.z)?.id ?? null;
    const camera = entry('camera', `camera:${b.id}`, spot.x, spot.z, b, undefined, district);
    // The street it watches, and the one its cut blinds (M6.T12).
    camera.way = spot.way;
    places.push(camera);
  }
  for (const area of areasOf(map)) {
    const spot = controlSpot(map, area);
    if (spot) places.push(entry('control', `control:${area.id}`, spot.x, spot.z, area, undefined, area.id));
    const office = officeSpot(map, area);
    if (office) places.push(entry('planning', `planning:${area.id}`, office.x, office.z, office, undefined, area.id));
  }
  reg.places = places;
  reg.dirty = true;
}

// A parcel is hackable while something stands on it: a crane on a site, a
// building once it reaches the low block. A standing row, tower or cap is a
// building from the first frame; only a lot grows into one.
function parcelKind(p) {
  if (p.stage === STAGE.SITE) return 'crane';
  if (p.kind !== 'lot' || p.stage >= STAGE.LOW) return 'building';
  return null;
}

function upsert(units, ref, make, reg) {
  let e = units.get(ref);
  if (!e) {
    e = make();
    units.set(ref, e);
    reg.dirty = true;
  }
  return e;
}

function drop(reg, units, live) {
  for (const ref of units.keys()) {
    if (!live.has(ref)) {
      units.delete(ref);
      reg.dirty = true;
    }
  }
}

function syncCars(reg) {
  const cars = reg.street?.cars ?? [];
  const live = new Set();
  cars.forEach((c, i) => {
    live.add(c);
    // A parked car carries its kerb x on `lane` and no id of its own
    // (sim/street.js); its slot in the fixed fleet is the stable id.
    const id = c.parked ? `car:parked:${i}` : `car:${c.id}`;
    const e = upsert(reg.cars, c, () => entry('car', id, 0, 0, c), reg);
    if (e.id !== id) { e.id = id; reg.dirty = true; }
    e.name = c.parked ? 'PARKED CAR' : KIND_NAMES.car;
    e.x = c.parked ? c.lane : c.x;
    e.z = c.z;
  });
  drop(reg, reg.cars, live);
}

function syncPeople(reg) {
  const npcs = reg.street?.npcs ?? [];
  const live = new Set();
  npcs.forEach((n, i) => {
    if (n.out === false) return; // indoors: not on the street to hack
    live.add(n);
    const id = `person:${i}`;
    const e = upsert(reg.npcs, n, () => entry('person', id, n.x, n.z, n, n.profile?.name ?? KIND_NAMES.person), reg);
    if (e.id !== id) { e.id = id; reg.dirty = true; }
    e.x = n.x;
    e.z = n.z;
  });
  drop(reg, reg.npcs, live);
}

function syncParcels(reg) {
  // map.parcels is the map's own record (live lots + standing buildings); city.parcels holds only the lots.
  const parcels = reg.map?.parcels ?? reg.city?.parcels ?? [];
  const live = new Set();
  for (const p of parcels) {
    const kind = parcelKind(p);
    if (!kind) continue;
    live.add(p);
    let e = reg.parcels.get(p);
    if (e && e.kind !== kind) {
      reg.parcels.delete(p);
      e = null;
    }
    if (!e) e = upsert(reg.parcels, p, () => entry(kind, '', p.x, p.z, p), reg);
    const id = `${kind}:${p.id}`;
    if (e.id !== id) { e.id = id; reg.dirty = true; }
    e.name = kind === 'crane' ? KIND_NAMES.crane : (USE_NAMES[p.use] ?? KIND_NAMES.building);
    e.x = p.x;
    e.z = p.z;
    e.district = p.powerZone ?? null;
  }
  drop(reg, reg.parcels, live);
}

export function createHackables(world = {}) {
  return syncHackables({
    map: null, street: null, city: null, version: null, places: [],
    cars: new Map(), npcs: new Map(), parcels: new Map(), list: [], byId: new Map(), dirty: true,
  }, world);
}

// Bring the registry up to the world behind it: dynamic things refresh cheaply,
// and the map shelf is rebuilt only when the map or its edit revision moves.
export function syncHackables(reg, world = {}) {
  const map = world.map ?? reg.map;
  if (!map) return reg;
  reg.street = world.street ?? reg.street;
  reg.city = world.city ?? reg.city;
  // Rebuild on a moved revision or a different map (a new game starts at version 0).
  if (reg.map !== map || reg.version !== map.version) { reg.map = map; reg.version = map.version; buildPlaces(reg); }
  syncCars(reg);
  syncPeople(reg);
  syncParcels(reg);
  if (reg.dirty) {
    reg.list = [...reg.places, ...reg.cars.values(), ...reg.npcs.values(), ...reg.parcels.values()];
    reg.byId = new Map(reg.list.map((e) => [e.id, e]));
    reg.dirty = false;
  }
  return reg;
}

// Every registered thing within `range` of a point, nearest first, as
// { entry, dist } — the list M6.T2's aim scans.
export function hackablesNear(reg, x, z, range = HACK_RANGE) {
  const out = [];
  for (const e of reg.list) {
    const dist = Math.hypot(e.x - x, e.z - z);
    if (dist <= range) out.push({ entry: e, dist });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

// Aim (M6.T2, M6-1): the nearest registered thing inside the view cone and in
// sight, at most HACK_RANGE away — the one pick the HUD's highlight names, every
// kind aiming through the registry. A 2D ray over the parcel footprints blocks a
// wall; an empty lot is open ground.

// ~30° off the view axis, the cone the profiler always used.
export const AIM_COS = 0.86;
// A thing on the lens has no heading, so it cannot be aimed.
const AIM_MIN_DIST = 0.5;

// The t-range of the segment inside [lo, hi], or null when it misses entirely.
function axisRange(s, d, lo, hi) {
  if (Math.abs(d) < 1e-9) return s >= lo && s <= hi ? [0, 1] : null;
  const a = (lo - s) / d;
  const b = (hi - s) / d;
  return a < b ? [a, b] : [b, a];
}

// True when the segment crosses the footprint's box, t within [0, 1].
function crossesBox(x0, z0, x1, z1, p) {
  const tx = axisRange(x0, x1 - x0, p.x - p.w / 2, p.x + p.w / 2);
  const tz = axisRange(z0, z1 - z0, p.z - p.d / 2, p.z + p.d / 2);
  if (!tx || !tz) return false;
  return Math.max(tx[0], tz[0], 0) <= Math.min(tx[1], tz[1], 1);
}

// Is the segment clear of walls? `skipId` is the target's own parcel, since a
// building's aim point sits inside its own footprint.
export function sightClear(map, x0, z0, x1, z1, skipId = null) {
  for (const p of map.parcels ?? []) {
    if (p.id === skipId) continue;
    if (p.kind === 'lot' && p.stage < STAGE.LOW) continue;
    if (crossesBox(x0, z0, x1, z1, p)) return false;
  }
  return true;
}

// The aim pick: down (fx, fz) from (px, pz), nearest in the cone with a clear
// line, or null — the render half is src/render/aim.js.
export function aimTarget(reg, px, pz, fx, fz, range = HACK_RANGE) {
  const len = Math.hypot(fx, fz) || 1;
  const ux = fx / len;
  const uz = fz / len;
  for (const { entry, dist } of hackablesNear(reg, px, pz, range)) {
    if (dist < AIM_MIN_DIST) continue;
    if (((entry.x - px) * ux + (entry.z - pz) * uz) / dist < AIM_COS) continue;
    if (!sightClear(reg.map, px, pz, entry.x, entry.z, entry.ref?.id ?? null)) continue;
    return { entry, dist };
  }
  return null;
}

export function hackableById(reg, id) {
  return reg.byId.get(id) ?? null;
}

// Every registered thing of one kind, for M6-2's access counts.
export function hackablesOfKind(reg, kind) {
  return reg.list.filter((e) => e.kind === kind);
}

// M6.T12 (M6-4): cut a camera out of the wall. The street it watches goes blind
// for the police — patrol.js's canSee refuses for BLIND_SECS of the street sim's
// own clock, and the sight comes back on its own. Reach is the one street, so a
// second camera on it has nothing left to take: it refuses and says so with 0.
export function hackCamera(reg, camera) {
  if (!camera || camera.kind !== 'camera' || !camera.way || !reg.street) return 0;
  if (blindWays().has(camera.way)) return 0;
  blindStreet(camera.way, reg.street);
  return BLIND_SECS;
}

// Is this camera down? Read off the wall (patrol.js), not off the entry, so every
// registry on the map — main's, input's — tells the same story about one camera.
export function cameraDown(camera) {
  return !!camera?.way && blindWays().has(camera.way);
}
