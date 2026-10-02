// Save and continue: a running game as plain data (law 5). serialize() writes
// down only what the seed cannot rebuild — the drift of the economy's market,
// the lot stages, the wallet, where the player stands — and deserialize()
// rebuilds everything else from the same factories main.js boots with and lays
// the snapshot over it. A save this thin cannot resurrect a stale derived
// value: heights, floors and demand are recomputed on the first tick.
//
// deserialize() takes the JSON string the store hands back or the plain object
// itself, and returns the live state or null. Any garbage, any unknown version
// — null, and the game starts new. It must never throw: a corrupt save is a
// missing save. localStorage and the autosave clock are not here (src/savestore.js
// and main.js own them).
import { createClock } from './clock.js';
import { createInterior, currentPlace, placeOf, STREET } from './interior.js';
import { createMission, missionRestore } from './mission.js';
import { createPlayer } from './player.js';
import { createStreet } from './street.js';
import { createPlayerCar } from './vehicle.js';
import { heightAt } from './world.js';
import { createCity, STAGE, USES } from './zoning.js';

export const SAVE_VERSION = 1;

// ---------------------------------------------------------------------------
// serialize: live state in, plain object out.

function snapshotStreet(street) {
  return {
    time: street.time,
    hurryUntil: street.hurryUntil,
    zones: street.zones.map((z) => ({ ...z })),
    lastHack: street.lastHack && { ...street.lastHack },
  };
}

function snapshotParcel(p) {
  return {
    use: p.use, zoned: p.zoned, stage: p.stage, progress: p.progress,
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

export function serialize(game) {
  return {
    version: SAVE_VERSION,
    seed: game.seed,
    clock: { ...game.clock },
    street: snapshotStreet(game.street),
    city: snapshotCity(game.city),
    player: snapshotPlayer(game.player),
    car: { x: game.car.x, z: game.car.z, yaw: game.car.yaw, speed: game.car.speed },
    interior: { space: game.interior.space, lastX: game.interior.lastX, lastZ: game.interior.lastZ },
    mission: snapshotMission(game.mission),
  };
}

// ---------------------------------------------------------------------------
// deserialize: plain object in, live state out, or null.

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function isSnapshot(s) {
  return isPlain(s)
    && s.version === SAVE_VERSION
    && Number.isInteger(s.seed) && s.seed > 0 && s.seed < 2 ** 31
    && [s.clock, s.street, s.city, s.player, s.car, s.interior, s.mission].every(isPlain)
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
  clock.nightFactor = num(s.nightFactor);
  clock.nightTarget = num(s.nightTarget);
  clock.rainFactor = num(s.rainFactor);
  return clock;
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

function rebuild(saved) {
  const street = createStreet(saved.seed);
  const city = createCity(saved.seed);
  if (saved.street.zones.length !== street.zones.length) throw new Error('save: zone count');
  const interior = applyInterior(createInterior(), saved.interior);
  return {
    seed: saved.seed,
    clock: applyClock(createClock(), saved.clock),
    street: applyStreet(street, saved.street),
    city: applyCity(city, saved.city),
    player: applyPlayer(createPlayer(), saved.player, interior),
    car: applyCar(createPlayerCar(), saved.car),
    interior,
    mission: missionRestore(createMission(), saved.mission),
  };
}

export function deserialize(data) {
  try {
    const saved = typeof data === 'string' ? JSON.parse(data) : data;
    if (!isSnapshot(saved)) return null;
    const game = rebuild(saved);
    return game.mission ? game : null;
  } catch {
    return null;
  }
}
