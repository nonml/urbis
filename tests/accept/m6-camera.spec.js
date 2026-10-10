// M6.T12 / M6-4 (docs/ROADMAP.md M6, "Street camera, the hack"): cut a street
// camera and the police are blind in the street it watches (patrol.js canSee).
//
// What this file proves, all of it in src/sim/hackables.js and src/sim/patrol.js:
//   1. the registry: a camera on the wall of every building that fronts a road,
//      carrying the street (the map's way) it watches and the CUT CAMERA hack;
//   2. the cut: one camera down takes its street out of the police's sight rule
//      in both directions, a look from arm's reach away still finds them, and
//      every other street sees exactly as it did (M4-5's rule — the reach is
//      the one street, and nothing outside it changes);
//   3. the police it blinds, on the game's own wanted sim: the same unit on the
//      same street and the same clock holds the suspect before the cut and
//      loses them after it, and the units search the last known position;
//   4. the street comes back: the cut runs off the street sim's own clock.
//
// What it does not prove, and why: firing the cut by aim and key is the
// applier's (src/game/input.js's onFire, which refuses every hack the crew has
// not wired) and the view into the camera is M6.T13's — files this task does
// not own. The dispatch line naming a witnessed CUT CAMERA is its own line in
// dispatch.js HACK_LINES, already green in tests/accept/m6-t6.spec.js.
//
// The blind streets are the game's own module state and the street sim's clock
// is the only thing that clears them, so every test runs its clock out past the
// cut when it is done with it: the wall of cameras is whole for the next one.
import { test, expect } from '@playwright/test';
import { createMap, frontageRoad, districtAt, projectOnSegment } from '../../src/sim/map.js';
import { createCity } from '../../src/sim/zoning.js';
import { createStreet, tickStreet } from '../../src/sim/street.js';
import { createHackables, hackablesOfKind, hackCamera, cameraDown } from '../../src/sim/hackables.js';
import { canSee, blindWays, BLIND_SECS, CLOSE_SIGHT } from '../../src/sim/patrol.js';
import { createWanted, forceTier, tickWanted, drainEvents, CONTACT_GRACE } from '../../src/sim/wanted.js';
import { isAvenue } from '../../src/sim/world.js';

const SEEDS = [7, 11, 22];
// How far apart the two points down one street stand: further than a close look
// and nearer than the fog, so street sight is the only thing joining them.
const DOWN = 30;

function scene(seed) {
  const map = createMap(seed);
  const city = createCity(seed, map);
  const street = createStreet(seed, map);
  return { map, city, street, reg: createHackables({ map, city, street }) };
}

const byIdOf = (map) => new Map(map.graph.nodes.map((n) => [n.id, n]));
const wayLen = (w) => (isAvenue(w) ? w.z1 - w.z0 : w.x1 - w.x0);

// Every street with a camera on it, longest first — the ones the cut can reach.
function watchedWays(map, reg) {
  const byId = byIdOf(map);
  const watched = new Set();
  for (const c of hackablesOfKind(reg, 'camera')) watched.add(frontageRoad(map, c.ref, byId).edge.way);
  return [...map.district.avenues, ...map.district.crossings]
    .filter((w) => watched.has(w.id))
    .sort((a, b) => wayLen(b) - wayLen(a));
}

// Two points `sep` metres down one street, both inside it.
function along(way, sep) {
  const lo = (isAvenue(way) ? way.z0 : way.x0) + 8;
  const at = (v) => (isAvenue(way) ? { x: way.x, z: v } : { x: v, z: way.z });
  return [at(lo), at(lo + sep)];
}

// The camera watching one street: the registry's own entry for it.
function cameraOn(reg, way) {
  return hackablesOfKind(reg, 'camera').find((c) => c.way === way);
}

test('a camera is registered on the wall of every building that fronts a road', () => {
  for (const seed of SEEDS) {
    const { map, reg } = scene(seed);
    const byId = byIdOf(map);
    const cameras = hackablesOfKind(reg, 'camera');
    const fronted = map.buildings.filter((b) => frontageRoad(map, b, byId));
    expect(fronted.length, `seed ${seed}: buildings with a street to watch`).toBeGreaterThan(0);
    expect(cameras.length, `seed ${seed}: one camera per building that fronts a road`).toBe(fronted.length);
    for (const c of cameras) {
      const road = frontageRoad(map, c.ref, byId);
      expect(road, `seed ${seed}: ${c.id} still has its road`).toBeTruthy();
      const at = projectOnSegment(c.x, c.z, byId.get(road.edge.a), byId.get(road.edge.b));
      // Off the wall its building presents to the road, never further out than
      // that wall and never more than a metre away from it.
      expect(at.dist, `seed ${seed}: ${c.id} hangs off the wall, not out in the road`)
        .toBeLessThanOrEqual(road.gap);
      expect(road.gap - at.dist, `seed ${seed}: ${c.id} is at that wall, not metres off it`)
        .toBeLessThanOrEqual(1);
      expect(c.way, `seed ${seed}: ${c.id} watches the street it fronts`).toBe(road.edge.way);
      expect(c.hacks.map((h) => h.id), `seed ${seed}: ${c.id}'s hacks`).toEqual(['camera_cut', 'camera_view']);
      expect(c.cost, `seed ${seed}: ${c.id}'s default cost`).toBe(1);
      expect(c.district, `seed ${seed}: ${c.id}'s district`).toBe(districtAt(map, c.x, c.z)?.id ?? null);
    }
  }
});

test('one camera down and the police are blind in the street it watches', () => {
  for (const seed of SEEDS) {
    const { map, street, reg } = scene(seed);
    const ways = watchedWays(map, reg);
    expect(ways.length, `seed ${seed}: at least two streets with cameras on them`).toBeGreaterThan(1);
    const camera = cameraOn(reg, ways[0].id);
    const [unit, suspect] = along(ways[0], DOWN);
    expect(cameraDown(camera), 'the camera is up before the cut').toBe(false);
    // The street is the sight line it has always been, both ways down it: that
    // is the rule the cut takes.
    expect(canSee(unit.x, unit.z, suspect.x, suspect.z, false, map), 'looking down it').toBe(true);
    expect(canSee(suspect.x, suspect.z, unit.x, unit.z, false, map), 'looking back up it').toBe(true);

    expect(hackCamera(reg, camera), 'the seconds the street is blind').toBe(BLIND_SECS);
    expect(cameraDown(camera), 'the camera is down').toBe(true);
    expect([...blindWays()], 'the street the police are blind in').toEqual([camera.way]);
    expect(canSee(unit.x, unit.z, suspect.x, suspect.z, false, map),
      'the unit down the blind street sees nothing').toBe(false);
    expect(canSee(suspect.x, suspect.z, unit.x, unit.z, false, map),
      'and neither does the suspect down it').toBe(false);
    // A look from arm's reach away still finds them: the cut takes the street,
    // not the ground the two of them stand on.
    expect(canSee(unit.x, unit.z, unit.x, unit.z + CLOSE_SIGHT - 1, false, map),
      'a close look still finds them').toBe(true);
    // M4-5: every street beside the blind one sees exactly as it did, and one
    // street is one cut — a second camera on it has nothing left to take.
    for (const w of ways.slice(1)) {
      const [from, to] = along(w, DOWN);
      expect(canSee(from.x, from.z, to.x, to.z, false, map),
        `seed ${seed}: ${w.id} is outside the cut's reach and still sees`).toBe(true);
    }
    const more = hackablesOfKind(reg, 'camera').filter((c) => c.way === camera.way);
    expect(hackCamera(reg, more[1] ?? camera), 'one street, one cut').toBe(0);

    // The cut runs off the street sim's own clock, and the sight comes back.
    for (let t = 0; t < BLIND_SECS + 1; t += 0.05) tickStreet(street, 0.05);
    expect(blindWays().size, 'the cut has run out').toBe(0);
    expect(cameraDown(camera), 'the camera is back up').toBe(false);
    expect(canSee(unit.x, unit.z, suspect.x, suspect.z, false, map), 'the street sees again').toBe(true);
  }
});

test('the police lose the suspect on the street whose camera is cut', () => {
  for (const seed of SEEDS) {
    const { map, street, reg } = scene(seed);
    const ways = watchedWays(map, reg);
    const camera = cameraOn(reg, ways[0].id);
    const [unit, suspect] = along(ways[0], DOWN);
    const hero = { x: suspect.x, z: suspect.z, yaw: 0, inCar: false, car: { speed: 0, flat: 0 }, cover: false };
    const wanted = createWanted(map);
    forceTier(wanted, 1, hero, 0, map);
    // One unit, stood on the street the camera watches and held there: what sees
    // the suspect is where the unit stands, not how fast it could drive.
    Object.assign(wanted.pursuit[0], { x: unit.x, z: unit.z, speed: 0 });
    for (let i = 1; i < wanted.pursuit.length; i++) wanted.pursuit[i].active = false;
    const step = (t) => {
      Object.assign(wanted.pursuit[0], { x: unit.x, z: unit.z, speed: 0 });
      tickWanted(wanted, 0.05, hero, t, map);
    };

    // A: the street's own sight line — the unit holds the suspect through it.
    for (let t = 0; t <= CONTACT_GRACE + 1; t += 0.05) step(t);
    expect(wanted.contact, 'before the cut the unit holds them').toBe(true);
    expect(drainEvents(wanted).map((e) => e.type), 'nobody has lost them').not.toContain('lost');

    // B: the cut. The same unit, the same street, the same clock, and the
    // suspect is gone — the units search the last place they were seen.
    expect(hackCamera(reg, camera)).toBe(BLIND_SECS);
    for (let t = CONTACT_GRACE + 1.05; t <= CONTACT_GRACE + 3; t += 0.05) step(t);
    const events = drainEvents(wanted);
    expect(wanted.contact, 'after the cut nobody can see them').toBe(false);
    const lost = events.find((e) => e.type === 'lost');
    expect(lost, 'the units say they lost them').toBeTruthy();
    expect(Math.hypot(lost.x - suspect.x, lost.z - suspect.z), 'where they were last seen').toBeLessThan(1);
    expect(wanted.search.active, 'they search the last known position').toBe(true);
    expect(Math.hypot(wanted.search.x - suspect.x, wanted.search.z - suspect.z),
      'the search opens on that spot').toBeLessThan(1);

    for (let t = 0; t < BLIND_SECS + 1; t += 0.05) tickStreet(street, 0.05);
    expect(blindWays().size, 'the cut has run out').toBe(0);
  }
});
