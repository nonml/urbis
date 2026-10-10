// Wanted: heat is the tier, and the tier is the size of the response. A small
// crime draws one cruiser; each crime on top of it adds a kind of response, not
// just a bigger number (pillar 4). TIERS below is the whole table, and
// docs/WANTED.md is its prose.
//
// The police hunt what they saw. While a unit can see the suspect (patrol.js:
// same street, or close) they chase them; once nobody can, they search the last
// known position, and the search area widens as the trail cools. Staying unseen
// for a tier's search time drops one tier, and the units it no longer needs
// drive off. Busted is still two and a half seconds within reach of a unit.
import { clampToBounds, heightAt } from './world.js';
import { canSee, nextWaypoint, spawnNode, worldMap } from './patrol.js';
import { bollardsAt, bollardPosts, liveTraffic } from './traffic.js';
// The player's police stations are service parcels on the map (M5.T11), each
// with its own catchment (M5.T13).
import { SERVICES, servicesOf } from './ops.js';
import { createResponse, heliSees, placeRoadblock, tickObstacles, tickResponse } from './response.js';
// Pure numbers, no DOM and no three: the game loop's snapshot (M0-9) is taken
// here so every cruiser and the helicopter carries the pose the step started
// from. blend() draws a spawn or a wrap where it landed.
import { snap } from '../game/loop.js';

export const MAX_HEAT = 3;
export const PURSUIT_SPEED = 10;

// The ground under a mover (M4.T10): the map's own field when it has one
// (M4.T2, the field the render draws); the load-time world field is the hand
// preset's fallback.
const groundAt = (map, x, z) => (map.terrain?.heightAt ?? heightAt)(x, z);

const SEARCH_SPEED = 7;
const CATCH_DIST_FOOT = 3.5;
const CATCH_DIST_CAR = 4.5;
const BUSTED_SECS = 2.5;
// Fleeing flat out in sight of a unit for this long is another offence; so is
// being clocked doing it with no heat at all.
const SPEEDING = 9.5;
const SPEEDING_SECS = 8;
// Out of sight this long before the units admit they have lost you.
export const CONTACT_GRACE = 1.5;
// The search area: starts tight on the last known position and widens.
const SEARCH_R0 = 8;
const SEARCH_R_MAX = 30;
const SEARCH_GROW = 1.4;
const SEARCH_CIRCLE_RATE = 0.25;
// A hack a unit stands within this of is one the player threw where they are:
// the reach of the hack key itself (hackables.js HACK_RANGE). A unit watching
// posts a hundred metres down a road is watching traffic kit, not a crime.
const HACK_WATCH_RANGE = 40;
// Units called in turn up this far from the suspect; units stood down drive
// off and are gone once this far, or after this long.
const SPAWN_DIST = 70;
// A cruiser for a call inside a station's catchment starts from the station's
// own street (M5.T13), not the stand-in; the radius is the station's service
// catchment, so a station never answers past its own ground.
function startPoint(map, x, z, taken) {
  const r2 = SERVICES.police.radius * SERVICES.police.radius;
  let best = null;
  let bestD2 = Infinity;
  for (const s of servicesOf(map.parcels, 'police')) {
    const d2 = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d2 <= r2 && d2 < bestD2) {
      best = s;
      bestD2 = d2;
    }
  }
  return best
    ? spawnNode(best.x, best.z, 0, taken, map)
    : spawnNode(x, z, SPAWN_DIST, taken, map);
}
const LEAVE_GONE = 55;
const LEAVE_SECS = 12;
const CLOSE_IN = 6;
const EVENT_KEEP = 32;

// What each tier adds. `searchSecs` is how long the suspect must stay unseen
// to drop out of it.
export const TIERS = [
  { chase: 0, spikes: false, roadblock: false, heli: false, searchSecs: Infinity },
  { chase: 1, spikes: false, roadblock: false, heli: false, searchSecs: 14 },
  { chase: 2, spikes: true, roadblock: false, heli: false, searchSecs: 20 },
  { chase: 2, spikes: true, roadblock: true, heli: true, searchSecs: 25 },
];

function makeUnit(x, z, yaw, map) {
  return { active: false, leaving: false, leaveT: 0, exit: null, x, y: groundAt(map, x, z), z, yaw, speed: 0 };
}

export function createWanted(map = worldMap()) {
  return {
    heat: 0,
    catchT: 0,
    searchT: 0,
    speedT: 0,
    bustedUntil: 0,
    bustedFlashUntil: 0,
    contact: false,
    seenAt: -Infinity,
    lkp: { x: 0, z: 0, yaw: 0 },
    search: { active: false, x: 0, z: 0, r: 0, since: 0 },
    pursuit: map.anchors.pursuitHomes.map((h, i) => makeUnit(h.x, h.z, i === 0 ? 0 : Math.PI, map)),
    response: createResponse(),
    events: [],
  };
}

function emit(w, e) {
  w.events.push(e);
  if (w.events.length > EVENT_KEEP) w.events.shift();
}

// Everything the police said happened since the last drain, oldest first.
export function drainEvents(w) {
  const out = w.events;
  w.events = [];
  return out;
}

function searchRadius(age) {
  return Math.min(SEARCH_R_MAX, SEARCH_R0 + age * SEARCH_GROW);
}

function startSearch(w, x, z, time) {
  w.search.active = true;
  w.search.x = x;
  w.search.z = z;
  w.search.since = time;
  w.search.r = SEARCH_R0;
}

function syncUnits(w, x, z, map) {
  const want = TIERS[w.heat].chase;
  const taken = [];
  w.pursuit.forEach((u, i) => {
    if (i < want) {
      if (!u.active) {
        const at = startPoint(map, x, z, taken);
        taken.push(at);
        Object.assign(u, { x: at.x, z: at.z, y: groundAt(map, at.x, at.z), yaw: Math.atan2(x - at.x, z - at.z), speed: 0 });
      }
      u.active = true;
      u.leaving = false;
    } else if (u.active && !u.leaving) {
      u.leaving = true;
      u.leaveT = 0;
      u.exit = spawnNode(x, z, SPAWN_DIST * 1.4, [], map);
    }
  });
}

function setHeat(w, heat, x, z, map) {
  w.heat = Math.max(0, Math.min(MAX_HEAT, heat));
  w.searchT = 0;
  syncUnits(w, x, z, map);
  if (w.heat === 0) {
    w.contact = false;
    w.search.active = false;
  }
}

function raise(w, cause, hero, time, map, hack = null) {
  if (w.heat >= MAX_HEAT) return;
  setHeat(w, w.heat + 1, hero.x, hero.z, map);
  emit(w, {
    type: `tier_up_${w.heat}`, cause, hack, x: hero.x, z: hero.z, yaw: hero.yaw, inCar: hero.inCar, time,
  });
}

// M6.T6: the police see hacks. A hack thrown while a unit has eyes on it is a
// witnessed crime — the tier rises on cause `hack`, tagged with the hack kind
// so dispatch names what it watched (dispatch.js HACK_LINES) — and the sight is
// the very rule the suspect is read by (judgeSight's canSee), so a hack watched
// is a suspect watched. Watched or not, a blackout is a blackout on the grid:
// nobody watching, it is reported as the tampering it is, as it always was.
// Either way the units answer the spot unless they already have the suspect.
export function wantedOnBlackout(w, x = w.lkp.x, z = w.lkp.z, time = 0, map = worldMap()) {
  const seen = onDuty(w).some((u) => canSee(u.x, u.z, x, z, false, map));
  if (!w.contact) {
    w.lkp = { x, z, yaw: w.lkp.yaw };
    startSearch(w, x, z, time);
  }
  // Watched, the crime is the hack itself and the radio names its kind;
  // unwatched, it is the grid's own blackout, reported as it always was.
  const kind = seen ? 'blackout' : null;
  raise(w, seen ? 'hack' : 'blackout', { x, z, yaw: w.lkp.yaw, inCar: false }, time, map, kind);
  w.searchT = 0;
}

export function wantedOnBusted(w, time, map = worldMap()) {
  setHeat(w, 0, w.lkp.x, w.lkp.z, map);
  w.catchT = 0;
  w.speedT = 0;
  w.bustedUntil = time + 3;
  w.bustedFlashUntil = time + 3;
  emit(w, { type: 'busted', x: w.lkp.x, z: w.lkp.z, time });
}

export function isBusted(w, time) {
  return time < w.bustedUntil;
}

// Capture and test hook: put the city at a tier with the suspect in sight.
export function forceTier(w, tier, hero, time, map = worldMap()) {
  w.lkp = { x: hero.x, z: hero.z, yaw: hero.yaw };
  w.contact = tier > 0;
  w.seenAt = time;
  w.search.active = false;
  setHeat(w, tier, hero.x, hero.z, map);
  if (TIERS[w.heat].roadblock && !w.response.roadblock.active) placeRoadblock(w, hero, time);
}

// Capture and test hook: the suspect was last seen at (x, z) on `yaw`, and
// nobody has had them for `age` seconds.
export function forceSearch(w, x, z, yaw, time, age = 0) {
  w.lkp = { x, z, yaw };
  w.contact = false;
  w.seenAt = time - CONTACT_GRACE - age;
  startSearch(w, x, z, time - age);
  w.search.r = searchRadius(age);
}

// M6.T8: police who see the posts going up raise the tier on cause `hack`,
// tagged with the kind so dispatch names them (dispatch.js HACK_LINES) — the
// blackout's own entry is wantedOnBlackout above; every other M6 hack reads
// the posts here, because the applier has no wanted state to call. One set of
// posts raises one tier, whichever unit watches, and the watching unit is the
// suspect-watching rule (judgeSight's canSee), so a hack watched is a suspect
// watched. The clock is the street sim's own, which traffic.js keeps the posts
// on, and the one live street is the one liveTraffic() names.
const WATCHED_POSTS = new Set();

function watchBollards(w, hero, time, map) {
  if (w.heat >= MAX_HEAT) return;
  const traffic = liveTraffic();
  if (!traffic) return;
  for (const post of bollardPosts(traffic, traffic.time)) {
    if (WATCHED_POSTS.has(post)) continue;
    if (Math.hypot(hero.x - post.x, hero.z - post.z) > HACK_WATCH_RANGE) continue;
    if (!onDuty(w).some((u) => canSee(u.x, u.z, post.x, post.z, false, map))) continue;
    WATCHED_POSTS.add(post);
    if (!w.contact) {
      w.lkp = { x: hero.x, z: hero.z, yaw: w.lkp.yaw };
      startSearch(w, hero.x, hero.z, time);
    }
    raise(w, 'hack', { x: hero.x, z: hero.z, yaw: w.lkp.yaw, inCar: hero.inCar }, time, map, 'bollards');
    return;
  }
}

function judgeSpeed(w, dt, hero, time, map) {
  const fast = hero.inCar && Math.abs(hero.car.speed) > SPEEDING;
  if (!fast || (w.heat > 0 && !w.contact)) {
    w.speedT = 0;
    return;
  }
  w.speedT += dt;
  if (w.speedT <= SPEEDING_SECS) return;
  w.speedT = 0;
  const cause = w.heat === 0 ? 'speeding' : 'evading';
  if (w.heat === 0) {
    w.contact = true;
    w.seenAt = time;
    w.lkp = { x: hero.x, z: hero.z, yaw: hero.yaw };
  }
  raise(w, cause, hero, time, map);
}

function watching(u) {
  return u.active && !u.leaving;
}

function onDuty(w) {
  return [...w.pursuit.filter(watching), ...w.response.roadblock.cars];
}

function judgeSight(w, hero, time, map) {
  if (w.heat === 0) return;
  const seen = onDuty(w).some((u) => canSee(u.x, u.z, hero.x, hero.z, hero.cover, map))
    || heliSees(w.response.heli, hero);
  if (seen) {
    if (!w.contact) emit(w, { type: 'spotted', x: hero.x, z: hero.z, yaw: hero.yaw, inCar: hero.inCar, time });
    w.contact = true;
    w.seenAt = time;
    w.lkp = { x: hero.x, z: hero.z, yaw: hero.yaw };
    w.search.active = false;
  } else if (w.contact && time - w.seenAt > CONTACT_GRACE) {
    w.contact = false;
    startSearch(w, w.lkp.x, w.lkp.z, time);
    emit(w, { type: 'lost', x: w.lkp.x, z: w.lkp.z, yaw: w.lkp.yaw, time });
  }
  if (w.search.active) w.search.r = searchRadius(time - w.search.since);
}

// One cruiser's step toward a point: by road until it is close, then straight.
function drive(map, u, gx, gz, cruise, dt) {
  const wp = nextWaypoint(u.x, u.z, gx, gz, map);
  let diff = Math.atan2(wp.x - u.x, wp.z - u.z) - u.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  u.yaw += Math.max(-1, Math.min(1, diff * 3)) * 1.8 * dt;
  const close = Math.hypot(gx - u.x, gz - u.z) <= CLOSE_IN;
  // Slow for the corner: a car does not take a junction at chase speed.
  const want = (close ? cruise * 0.4 : cruise) * (0.45 + 0.55 * Math.max(0, Math.cos(diff)));
  // M6.T8: posts across a junction stop a cruiser the way they stop a car — it
  // stands off them, brake lights on, until they retract.
  const traffic = liveTraffic();
  const held = !!traffic && bollardsAt(traffic, u.x, u.z) !== null;
  u.speed += ((held ? 0 : want) - u.speed) * Math.min(1, dt * 2);
  if (held) u.speed = Math.max(0, u.speed - 10 * dt);
  const inside = clampToBounds(
    map.district.drive, u.x + Math.sin(u.yaw) * u.speed * dt, u.z + Math.cos(u.yaw) * u.speed * dt
  );
  u.x = inside.x;
  u.z = inside.z;
  u.y = groundAt(map, u.x, u.z);
}

function steerUnits(w, dt, hero, time, map) {
  w.pursuit.forEach((u, i) => {
    if (!u.active) return;
    if (u.leaving) {
      u.leaveT += dt;
      drive(map, u, u.exit.x, u.exit.z, SEARCH_SPEED, dt);
      if (u.leaveT > LEAVE_SECS || Math.hypot(u.x - hero.x, u.z - hero.z) > LEAVE_GONE) u.active = false;
      return;
    }
    if (w.contact || !w.search.active) {
      drive(map, u, hero.x, hero.z, PURSUIT_SPEED, dt);
      return;
    }
    // Searching: each unit works its own side of the area.
    const a = i * Math.PI + time * SEARCH_CIRCLE_RATE;
    const r = w.search.r * 0.8;
    drive(map, u, w.search.x + Math.sin(a) * r, w.search.z + Math.cos(a) * r, SEARCH_SPEED, dt);
  });
}

function nearestUnit(w, hero) {
  let nearest = Infinity;
  for (const u of onDuty(w)) nearest = Math.min(nearest, Math.hypot(u.x - hero.x, u.z - hero.z));
  return nearest;
}

function searchOn(w, dt, time, map) {
  w.searchT += dt;
  if (w.searchT < TIERS[w.heat].searchSecs) return;
  setHeat(w, w.heat - 1, w.search.x, w.search.z, map);
  emit(w, { type: w.heat === 0 ? 'clear' : `tier_down_${w.heat}`, x: w.search.x, z: w.search.z, time });
}

// hero: { x, z, yaw, inCar, car, body, cover, night }. `car` is the player's
// car whether or not they are in it (spikes and flats live on it); `body` is
// whatever is moving them — the car, or the player on foot.
export function tickWanted(w, dt, hero, time, map = worldMap()) {
  watchBollards(w, hero, time, map);
  for (const u of w.pursuit) snap(u);
  snap(w.response.heli);
  tickObstacles(w, hero, dt, time);
  if (isBusted(w, time)) return 'busted';
  judgeSpeed(w, dt, hero, time, map);
  judgeSight(w, hero, time, map);
  steerUnits(w, dt, hero, time, map);
  tickResponse(w, TIERS[w.heat], hero, dt, time);
  if (w.heat === 0) {
    w.catchT = 0;
    if (hero.car.flat) hero.car.flat = 0;
    return 'clean';
  }
  if (nearestUnit(w, hero) < (hero.inCar ? CATCH_DIST_CAR : CATCH_DIST_FOOT)) {
    w.catchT += dt;
    if (w.catchT >= BUSTED_SECS) {
      wantedOnBusted(w, time, map);
      return 'busted';
    }
    return 'closing';
  }
  w.catchT = Math.max(0, w.catchT - dt * 2);
  if (w.contact) {
    w.searchT = 0;
    return 'pursued';
  }
  searchOn(w, dt, time);
  return 'searching';
}
