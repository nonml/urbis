// Save and continue: a running game as plain data (law 5). The state schema is
// version 2 (the people and the hour); M3.T38 adds the op log, and with it the
// version-3 save format, marked by `format`. deserialize() rebuilds the map
// from the seed, replays the log and lays the snapshot over it, so a save holds
// the edits and not just the lots. A save this thin cannot resurrect a stale
// derived value: heights, floors and demand are recomputed on the first tick.
//
// The log is compacted at save time — a run of zone edits on one parcel is one
// decision, not fifty — and the shorter log is kept only when a replay on the
// seed proves it rebuilds the same map.
//
// deserialize() takes the JSON string the store hands back or the plain object
// itself, and returns the live state or null. An older save starts a new game
// and leaves one line in takeNotice(); any garbage, any unknown version — null.
// It must never throw: a corrupt save is a missing save. localStorage and the
// autosave clock are not here (src/savestore.js and main.js own them).
import { createClock } from './clock.js';
import { createInterior, currentPlace, placeOf, STREET } from './interior.js';
import { createMap, mapHash } from './map.js';
import { createMission, missionRestore } from './mission.js';
import { addRoad, bulldoze, place, removeRoad, zone } from './ops.js';
import { worldMap } from './patrol.js';
import { createPeople } from './people.js';
import { createPlayer } from './player.js';
import { createStreet } from './street.js';
import { createPlayerCar } from './vehicle.js';
import { heightAt } from './world.js';
import { createCity, STAGE, USES } from './zoning.js';

export const SAVE_VERSION = 2;
export const SAVE_FORMAT = 3;

// ---------------------------------------------------------------------------
// The op log. Every edit the player makes is one plain descriptor, applied
// through applyOp() so the map and its log cannot drift apart. The log is keyed
// weakly by map, like ops.js's own undo stack, so mapHash never sees it.
const LOG = new WeakMap();

function logOf(map) {
  let log = LOG.get(map);
  if (!log) { log = []; LOG.set(map, log); }
  return log;
}

function copyOp(op) {
  return op.op === 'addRoad' ? { ...op, a: [...op.a], b: [...op.b] } : { ...op };
}

// A saved op, applied by name. Anything else is not a save.
const APPLIERS = {
  zone: (map, op) => zone(map, op.id, op.use),
  bulldoze: (map, op) => bulldoze(map, op.id),
  place: (map, op) => place(map, op.kind, op.id),
  addRoad: (map, op) => addRoad(map, op.a, op.b),
  removeRoad: (map, op) => removeRoad(map, op.id),
};

const point = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n));

function validOp(op) {
  if (!isPlain(op) || !Object.hasOwn(APPLIERS, op.op)) return false;
  if (op.op === 'addRoad') return point(op.a) && point(op.b);
  if (op.op === 'place') return typeof op.id === 'string' && typeof op.kind === 'string';
  if (op.op === 'zone') return typeof op.id === 'string' && (op.use === null || USES.includes(op.use));
  return typeof op.id === 'string';
}

// Apply one edit and keep it. The op itself is ops.js's (pure, law 5); an edit
// that changed nothing is not logged. The returned closure is the op's undo.
export function applyOp(map, op) {
  const version = map.version;
  const undo = APPLIERS[op.op](map, op);
  if (map.version !== version) logOf(map).push(copyOp(op));
  return undo;
}

// The log as the store will write it.
export function opsOf(map) {
  return logOf(map).map(copyOp);
}

// Replay a saved log on the map it was written against. Every stored op was
// effective when it was made, so one that does not move the version means the
// log and the map have drifted: reject the save.
function replay(map, ops) {
  for (const op of ops) {
    const version = map.version;
    APPLIERS[op.op](map, op);
    if (map.version === version) throw new Error('save: op did not apply');
  }
}

// Compaction. A run of zone edits on one parcel is one decision repainted, so
// only its net effect is kept: the last use, and the passing non-null use plus
// an unzone pass when the run ends unzoned (so `painted` survives). A non-zone
// op on that parcel closes its run; a road op closes every run, because
// replanning can take a parcel away. The shorter log is only trusted when a
// replay on the seed proves it rebuilds the same map (mapHash).
function collapseZones(ops) {
  const out = [];
  const open = new Map();
  const close = (id) => {
    const run = open.get(id);
    if (!run) return;
    open.delete(id);
    if (run.last !== null) out.push({ op: 'zone', id, use: run.last });
    else if (run.mark !== null) out.push({ op: 'zone', id, use: run.mark }, { op: 'zone', id, use: null });
    else out.push({ op: 'zone', id, use: null });
  };
  for (const op of ops) {
    if (op.op === 'zone') {
      const run = open.get(op.id) ?? { last: op.use, mark: op.use };
      run.last = op.use;
      if (op.use !== null) run.mark = op.use;
      open.set(op.id, run);
      continue;
    }
    if (op.op === 'addRoad' || op.op === 'removeRoad') for (const id of [...open.keys()]) close(id);
    else close(op.id);
    out.push(op);
  }
  for (const id of [...open.keys()]) close(id);
  return out;
}

function compactOps(map, ops) {
  if (ops.length < 2) return ops;
  const kept = collapseZones(ops);
  if (kept.length === ops.length) return ops;
  // Prove it: the full log and the shorter one, replayed on the seed's own
  // map, must land on the same map. The live map cannot be the reference here
  // — ticks have moved its parcels since the last op — so the full replay is.
  try {
    const full = createMap(map.seed);
    createCity(map.seed, full);
    replay(full, ops);
    const proof = createMap(map.seed);
    createCity(map.seed, proof);
    replay(proof, kept);
    proof.version = full.version;
    return mapHash(proof) === mapHash(full) ? kept : ops;
  } catch {
    return ops;
  }
}

// ---------------------------------------------------------------------------
// serialize: live state in, plain object out.

// A JSON copy of a list of plain sim records (walkers, cars). The save is plain
// data; this keeps any future render-only object from leaking into it.
const copyList = (list) => list.map((q) => JSON.parse(JSON.stringify(q)));

function snapshotStreet(street) {
  return {
    time: street.time,
    hurryUntil: street.hurryUntil,
    zones: street.zones.map((z) => ({ ...z })),
    lastHack: street.lastHack && { ...street.lastHack },
    // The street's own life is sim state: a save that dropped the walkers and
    // the traffic would come back to a different street.
    npcs: copyList(street.npcs ?? []),
    cars: copyList(street.cars ?? []),
  };
}

function snapshotParcel(p) {
  return {
    use: p.use, zoned: p.zoned, painted: p.painted, stage: p.stage, progress: p.progress,
    building: p.building, trend: p.trend, why: p.why, vacancy: p.vacancy,
  };
}

function snapshotDistrict(d) {
  return {
    firms: { ...d.firms }, wealth: d.wealth, nextMove: d.nextMove,
    demand: { ...d.demand }, last: d.last && { ...d.last },
  };
}

function snapshotCity(city) {
  return {
    time: city.time,
    parcels: city.parcels.map(snapshotParcel),
    economy: {
      time: city.economy.time,
      // The stream's whole state: without it a firm move after the load draws
      // different rolls than the run it interrupted, and the districts drift.
      rand: city.economy.rand.dump(),
      districts: city.economy.districts.map(snapshotDistrict),
    },
  };
}

function snapshotPlayer(player) {
  return {
    x: player.x, z: player.z, yaw: player.yaw,
    speed: player.speed, walkPhase: player.walkPhase, mode: player.mode,
  };
}

function snapshotMission(m) {
  return {
    idx: m.idx, balance: m.balance, done: [...m.done], seen: { ...m.seen },
    complete: m.complete, bannerUntil: m.bannerUntil, bannerText: m.bannerText,
  };
}

function snapshotPeople(people) {
  return {
    list: people.list.map((q) => ({ id: q.id, name: q.name, age: q.age, home: q.home, job: q.job })),
    nextId: people.nextId,
    rand: people.rand.dump(),
  };
}

export function serialize(game) {
  const map = game.map ?? worldMap();
  const log = logOf(map);
  const ops = compactOps(map, log);
  // The compaction is not only for the file: the log held in memory shrinks
  // too, so a save cannot outgrow the store (ROADMAP risk R7).
  if (ops.length !== log.length) LOG.set(map, ops);
  return {
    version: SAVE_VERSION,
    format: SAVE_FORMAT,
    seed: game.seed,
    generate: game.generate === true,
    ops: ops.map(copyOp),
    mapVersion: map.version ?? 0,
    clock: { ...game.clock },
    street: snapshotStreet(game.street),
    city: snapshotCity(game.city),
    player: snapshotPlayer(game.player),
    car: { x: game.car.x, z: game.car.z, yaw: game.car.yaw, speed: game.car.speed },
    interior: { space: game.interior.space, lastX: game.interior.lastX, lastZ: game.interior.lastZ },
    mission: snapshotMission(game.mission),
    people: snapshotPeople(game.people),
  };
}

// ---------------------------------------------------------------------------
// deserialize: plain object in, live state out, or null.

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function isSnapshot(s) {
  return isPlain(s)
    && s.version === SAVE_VERSION
    && s.format === SAVE_FORMAT
    && Number.isInteger(s.seed) && s.seed > 0 && s.seed < 2 ** 31
    && typeof s.generate === 'boolean'
    && Number.isInteger(s.mapVersion) && s.mapVersion >= 0
    && Array.isArray(s.ops) && s.ops.every(validOp)
    && [s.clock, s.street, s.city, s.player, s.car, s.interior, s.mission, s.people].every(isPlain)
    && Array.isArray(s.street.zones)
    && Array.isArray(s.city.parcels)
    && isPlain(s.city.economy) && Array.isArray(s.city.economy.districts);
}

const num = (v) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('save: not a number');
  return v;
};
const bool = (v) => {
  if (typeof v !== 'boolean') throw new Error('save: not a boolean');
  return v;
};
const str = (v) => {
  if (typeof v !== 'string') throw new Error('save: not a string');
  return v;
};
const maybe = (fn) => (v) => (v === null ? null : fn(v));

function applyClock(clock, s) {
  clock.elapsed = num(s.elapsed);
  clock.hour = num(s.hour);
  clock.day = num(s.day);
  clock.rate = num(s.rate);
  clock.nightFactor = num(s.nightFactor);
  clock.nightTarget = num(s.nightTarget);
  clock.rainFactor = num(s.rainFactor);
  return clock;
}

function restoreList(list, what) {
  if (!Array.isArray(list)) throw new Error(`save: ${what}s`);
  for (const q of list) if (!isPlain(q)) throw new Error(`save: bad ${what}`);
  return copyList(list);
}

function applyStreet(street, s) {
  street.time = num(s.time);
  street.hurryUntil = num(s.hurryUntil);
  street.zones.forEach((z, i) => {
    const q = s.zones[i] ?? {};
    z.darkUntil = num(q.darkUntil);
    z.coolUntil = num(q.coolUntil);
    z.collapseUntil = num(q.collapseUntil);
    z.restoreUntil = num(q.restoreUntil);
  });
  street.lastHack = s.lastHack === null ? null : { zone: num(s.lastHack?.zone), at: num(s.lastHack?.at) };
  street.npcs = restoreList(s.npcs, 'npc');
  street.cars = restoreList(s.cars, 'car');
  return street;
}

function applyParcel(p, s) {
  const use = s.use === null ? null : str(s.use);
  const zoned = s.zoned === null ? null : str(s.zoned);
  if ((use !== null && !USES.includes(use)) || (zoned !== null && !USES.includes(zoned))) {
    throw new Error('save: unknown use');
  }
  p.use = use;
  p.zoned = zoned;
  p.painted = bool(s.painted);
  p.stage = num(s.stage);
  if (!Number.isInteger(p.stage) || p.stage < 0 || p.stage > STAGE.HIGH) throw new Error('save: bad stage');
  p.progress = num(s.progress);
  p.building = bool(s.building);
  p.trend = str(s.trend);
  p.why = s.why === null ? null : str(s.why);
  p.vacancy = num(s.vacancy);
}

function applyDistrict(d, s) {
  d.firms.com = num(s.firms?.com);
  d.firms.ind = num(s.firms?.ind);
  d.wealth = num(s.wealth);
  d.nextMove = num(s.nextMove);
  d.demand.res = num(s.demand?.res);
  d.demand.com = num(s.demand?.com);
  d.demand.ind = num(s.demand?.ind);
  d.last = s.last === null ? null : { at: num(s.last?.at), use: str(s.last?.use), jobs: num(s.last?.jobs) };
}

function applyCity(city, s) {
  if (s.parcels.length !== city.parcels.length) throw new Error('save: parcel count');
  if (s.economy.districts.length !== city.economy.districts.length) throw new Error('save: district count');
  city.time = num(s.time);
  city.parcels.forEach((p, i) => applyParcel(p, s.parcels[i]));
  city.economy.time = num(s.economy.time);
  city.economy.rand.load(num(s.economy.rand));
  city.economy.districts.forEach((d, i) => applyDistrict(d, s.economy.districts[i]));
  return city;
}

function applyInterior(interior, s) {
  interior.space = str(s.space);
  // A grown lot's room is `lot:<index>`; its geometry is rebuilt from the city
  // on the next tick, so the save only has to name a space the sim can offer.
  const known = interior.space === STREET || placeOf(interior.space) || /^lot:\d+$/.test(interior.space);
  if (!known) throw new Error('save: unknown space');
  interior.lastX = maybe(num)(s.lastX);
  interior.lastZ = maybe(num)(s.lastZ);
  return interior;
}

function applyPlayer(player, s, interior) {
  player.x = num(s.x);
  player.z = num(s.z);
  player.yaw = num(s.yaw);
  player.speed = num(s.speed);
  player.walkPhase = num(s.walkPhase);
  player.mode = s.mode === 'drive' ? 'drive' : 'foot';
  // Height is the ground's answer, never the save's (world.js heightAt).
  const place = currentPlace(interior);
  player.y = place ? place.floor : heightAt(player.x, player.z);
  return player;
}

function applyCar(car, s) {
  car.x = num(s.x);
  car.z = num(s.z);
  car.yaw = num(s.yaw);
  car.speed = num(s.speed);
  car.y = heightAt(car.x, car.z);
  return car;
}

function applyPeople(people, s, city) {
  if (!Array.isArray(s.list)) throw new Error('save: people list');
  const parcel = (v) => Number.isInteger(v) && v >= 0 && v < city.parcels.length;
  people.list = s.list.map((q) => {
    if (!Number.isInteger(q.id)) throw new Error('save: bad person id');
    if (typeof q.name !== 'string') throw new Error('save: bad person name');
    if (!Number.isInteger(q.age)) throw new Error('save: bad person age');
    if (!parcel(q.home)) throw new Error('save: bad person home');
    if (q.job !== null && !parcel(q.job)) throw new Error('save: bad person job');
    return { id: q.id, name: q.name, age: q.age, home: q.home, job: q.job };
  });
  if (!Number.isInteger(s.nextId)) throw new Error('save: bad person next id');
  people.nextId = s.nextId;
  people.rand.load(num(s.rand));
  return people;
}

function rebuild(saved) {
  // The city an op runs on: the seed's own map with the city's parcels already
  // laid in (zoning.js createCity), because that is the map the log was
  // written against. A preset save has no ops and keeps the preset's own map.
  const map = saved.generate ? createMap(saved.seed) : worldMap();
  const street = createStreet(saved.seed, map);
  const city = createCity(saved.seed, map);
  if (saved.street.zones.length !== street.zones.length) throw new Error('save: zone count');
  replay(map, saved.ops);
  map.version = saved.mapVersion;
  const interior = applyInterior(createInterior(), saved.interior);
  return {
    seed: saved.seed,
    generate: saved.generate,
    map,
    clock: applyClock(createClock(), saved.clock),
    street: applyStreet(street, saved.street),
    city: applyCity(city, saved.city),
    player: applyPlayer(createPlayer(map), saved.player, interior),
    car: applyCar(createPlayerCar(map), saved.car),
    interior,
    mission: missionRestore(createMission(), saved.mission),
    people: applyPeople(createPeople(saved.seed), saved.people, city),
  };
}

// An older save starts a new game, and the player is told why in one line.
// takeNotice() hands the line over once; deserialize() itself only ever
// returns live state or null.
let notice = null;

export function takeNotice() {
  const line = notice;
  notice = null;
  return line;
}

export function deserialize(data) {
  try {
    const saved = typeof data === 'string' ? JSON.parse(data) : data;
    // A save from before this format: its version is lower, or it is the same
    // state schema without the op log the format-3 save carries.
    if (isPlain(saved) && Number.isInteger(saved.version) && saved.version > 0
      && (saved.version < SAVE_VERSION
        || (saved.version === SAVE_VERSION && saved.format !== SAVE_FORMAT))) {
      notice = `Save version ${saved.version} is from an older release — a new city has started.`;
      return null;
    }
    if (!isSnapshot(saved)) return null;
    const game = rebuild(saved);
    return game.mission ? game : null;
  } catch {
    return null;
  }
}
