// Interiors, proven without a browser. The sim is pure (law 5), so the player is
// walked into walls for whole seconds of Node, ticked the way main.js ticks it:
// tickPlayer moves, tickInterior settles. The browser half — that the shop and
// the roof are there to be seen, under budget — is interior-gate.spec.js.
import { test, expect } from '@playwright/test';
import { createPlayer, tickPlayer } from '../src/sim/player.js';
import { createStreet, tickStreet } from '../src/sim/street.js';
import { STAGE, USES, createCity, tickZoning, zoneParcel } from '../src/sim/zoning.js';
import { pinDemand } from '../src/sim/decline.js';
import {
  BODY_RADIUS, SPACES, STREET, createInterior, currentPlace, doorEnds, frameCamera, occupiedParcel,
  isIndoors, placeOf, standable, syncInterior, tickInterior, useDoor,
} from '../src/sim/interior.js';

const DT = 0.05;
const COMPASS = Array.from({ length: 16 }, (_, k) => (k / 16) * Math.PI * 2);

function standAt(player, x, z) {
  player.x = x;
  player.z = z;
  player.speed = 0;
}

// Hold one heading for `secs`, sprinting, and report every position visited.
function walk(state, player, yaw, secs, each = () => {}) {
  const input = { mx: Math.sin(yaw), mz: Math.cos(yaw), hurry: true };
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    tickPlayer(player, input, DT);
    tickInterior(state, player);
    each();
  }
}

function end(door, space) {
  return doorEnds().find((e) => e.door === door && e.space === space);
}

function enter(door, space) {
  const state = createInterior();
  const player = createPlayer();
  const outside = end(door, STREET);
  standAt(player, outside.x, outside.z);
  tickInterior(state, player);
  expect(useDoor(state, player)).not.toBeNull();
  expect(state.space).toBe(space);
  return { state, player };
}

function inSolid(place, x, z) {
  return place.solids.some((s) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ);
}

test('E at the shop door goes in, and E at its inside goes back out', () => {
  const { state, player } = enter('ramen-front', 'ramen');
  const place = currentPlace(state);
  expect(player.y).toBe(place.floor);
  expect(standable(place, player.x, player.z)).toBe(true);
  // Arriving is a step clear of the door: a second press does nothing.
  expect(state.near).toBeNull();
  expect(useDoor(state, player)).toBeNull();

  const inside = end('ramen-front', 'ramen');
  standAt(player, inside.x, inside.z);
  tickInterior(state, player);
  expect(state.near?.label).toBe('LEAVE');
  expect(useDoor(state, player)).not.toBeNull();
  expect(state.space).toBe(STREET);
  const out = end('ramen-front', STREET).arrive;
  expect([player.x, player.z]).toEqual([out.x, out.z]);
});

test('every door spot and every arrival is somewhere a person can stand', () => {
  for (const e of doorEnds()) {
    if (e.space === STREET) continue;
    const place = placeOf(e.space);
    expect(standable(place, e.x, e.z)).toBe(true);
    expect(standable(place, e.arrive.x, e.arrive.z)).toBe(true);
  }
});

test('the shop walls hold: sprinting at them from anywhere never gets out', () => {
  const { state, player } = enter('ramen-front', 'ramen');
  const place = currentPlace(state);
  const b = place.bounds;
  const starts = [[0.6, 2.7], [2.0, 5.0], [1.2, 7.4], [3.0, 2.4]];
  const escapes = [];
  for (const yaw of COMPASS) {
    for (const [a, d] of starts) {
      standAt(player, place.frame.x - d, place.frame.z - a);
      tickInterior(state, player);
      walk(state, player, yaw, 4, () => {
        const inRoom = player.x >= b.minX + BODY_RADIUS - 1e-9 && player.x <= b.maxX - BODY_RADIUS + 1e-9
          && player.z >= b.minZ + BODY_RADIUS - 1e-9 && player.z <= b.maxZ - BODY_RADIUS + 1e-9;
        if (state.space !== 'ramen' || !inRoom || inSolid(place, player.x, player.z)) escapes.push([player.x, player.z]);
      });
    }
  }
  expect(escapes).toEqual([]);
});

test('the counter is a counter: nobody walks round it into the kitchen', () => {
  const { state, player } = enter('ramen-front', 'ramen');
  const place = currentPlace(state);
  const kitchen = place.solids[0];
  let closest = Infinity;
  for (const yaw of COMPASS) {
    walk(state, player, yaw, 3, () => {
      const dx = Math.max(kitchen.minX - player.x, 0, player.x - kitchen.maxX);
      const dz = Math.max(kitchen.minZ - player.z, 0, player.z - kitchen.maxZ);
      closest = Math.min(closest, Math.hypot(dx, dz));
    });
  }
  expect(closest).toBeGreaterThanOrEqual(BODY_RADIUS - 1e-9);
});

test('walls slide rather than stick: walking diagonally into one still moves you along it', () => {
  const { state, player } = enter('ramen-front', 'ramen');
  const place = currentPlace(state);
  // Head for the back wall and a little to the right: the wall stops the first
  // component, the second carries on along it until the beer crates.
  standAt(player, place.frame.x - 6.5, place.frame.z - 0.6);
  tickInterior(state, player);
  const z0 = player.z;
  walk(state, player, Math.atan2(-0.94, -0.34), 1.5);
  expect(player.x).toBeCloseTo(place.bounds.minX + BODY_RADIUS, 6);
  expect(player.z).toBeLessThan(z0 - 1);
});

test('the roof holds: no walking into air off any edge', () => {
  const { state, player } = enter('roof-stair', 'roof');
  const place = currentPlace(state);
  const b = place.bounds;
  const falls = [];
  for (const yaw of COMPASS) {
    walk(state, player, yaw, 6, () => {
      const onRoof = player.x > b.minX && player.x < b.maxX && player.z > b.minZ && player.z < b.maxZ;
      if (state.space !== 'roof' || player.y !== place.floor || !onRoof || inSolid(place, player.x, player.z)) {
        falls.push([player.x, player.y, player.z]);
      }
    });
  }
  expect(falls).toEqual([]);
  // And the stair takes you back down to the street, by the door you came in.
  const stair = end('roof-stair', 'roof');
  standAt(player, stair.x, stair.z);
  tickInterior(state, player);
  expect(state.near?.label).toBe('STAIRS DOWN');
  useDoor(state, player);
  expect(state.space).toBe(STREET);
});

test('the shop camera never leaves the room or enters a shelf', () => {
  const { state, player } = enter('ramen-front', 'ramen');
  const place = currentPlace(state);
  const b = place.bounds;
  const bad = [];
  for (const yaw of COMPASS) {
    walk(state, player, yaw, 1.5);
    for (const camYaw of COMPASS) {
      for (const [pitch, dist] of [[0.08, 14], [0.5, 2.7], [1.2, 6]]) {
        const pivot = { x: player.x, y: player.y + 1.6, z: player.z };
        const want = {
          x: player.x - Math.sin(camYaw) * dist * Math.cos(pitch),
          y: player.y + Math.sin(pitch) * dist + 0.6,
          z: player.z - Math.cos(camYaw) * dist * Math.cos(pitch),
        };
        const eye = frameCamera(state, pivot, want);
        const inRoom = eye.x > b.minX && eye.x < b.maxX && eye.z > b.minZ && eye.z < b.maxZ
          && eye.y > place.floor && eye.y < place.ceiling;
        const inShelf = place.solids.some((s) => eye.x > s.minX && eye.x < s.maxX
          && eye.z > s.minZ && eye.z < s.maxZ && eye.y < s.top);
        if (!inRoom || inShelf) bad.push([eye.x, eye.y, eye.z]);
      }
    }
  }
  expect(bad).toEqual([]);
});

test('the interior frames derive from the pinned towers, not hand-copied numbers', () => {
  const ramen = SPACES.find((s) => s.id === 'ramen').frame;
  const roof = SPACES.find((s) => s.id === 'roof').frame;
  // Podium face of the ramen tower and its glazing bay, and the roof crown lip.
  expect(ramen.x).toBeCloseTo(-6.9, 2);
  expect(ramen.z).toBeCloseTo(-10.77, 2);
  expect(roof.x).toBeCloseTo(-7.05, 2);
  expect(roof.z).toBeCloseTo(-48, 2);
});

test('on the street the sim leaves the player and the camera alone', () => {
  const state = createInterior();
  const player = createPlayer();
  standAt(player, 2.5, 26);
  walk(state, player, Math.PI, 2);
  expect(state.space).toBe(STREET);
  expect(player.z).toBeLessThan(26 - 5);
  const eye = { x: 1, y: 2, z: 3 };
  expect(frameCamera(state, { x: 0, y: 1, z: 0 }, eye)).toBe(eye);
});

// ---------------------------------------------------------------------------
// Grown lots (docs/handoff/feature-interiors.md). One lot of each use is zoned,
// grown to LOW, and walked into through its own street door; then one is cleared
// and its door has to go with the building.

const SEED = 20260916;
const TICKS_PER_SEC = Math.round(1 / DT);

// Walk from wherever the body stands toward a point, the way a player does.
function walkToward(state, player, x, z, secs) {
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    const yaw = Math.atan2(x - player.x, z - player.z);
    tickPlayer(player, { mx: Math.sin(yaw), mz: Math.cos(yaw), hurry: true }, DT);
    tickInterior(state, player);
  }
}

function untilGrown(city, street, picks) {
  const ready = () => USES.every((use) => city.parcels[picks[use]].stage >= STAGE.LOW);
  for (let i = 0; i < 900 * TICKS_PER_SEC && !ready(); i++) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
  }
  return ready();
}

test('every grown lot of every use has a door, and it goes when the lot is cleared', () => {
  const city = createCity(SEED);
  const street = createStreet(SEED);
  for (const use of USES) pinDemand(city, use, 1);

  // Three empty lots zoned for one use each, so each breaks ground as that use.
  const picks = {};
  USES.forEach((use, k) => {
    const p = city.parcels[k];
    p.use = null; p.zoned = null; p.stage = STAGE.EMPTY; p.progress = 0; p.building = false;
    zoneParcel(city, k, use);
    picks[use] = k;
  });
  expect(untilGrown(city, street, picks)).toBe(true);

  const interior = createInterior(city);
  syncInterior(interior);
  for (const use of USES) expect(interior.links.some((l) => l.parcelUse === use)).toBe(true);

  // Walk the body from the street, through each door, and back out.
  for (const use of USES) {
    const player = createPlayer();
    const link = interior.links.find((l) => l.parcelUse === use);
    const streetEnd = link.ends[0];
    standAt(player, streetEnd.arrive.x, streetEnd.arrive.z);
    walkToward(interior, player, streetEnd.x, streetEnd.z, 2.5);
    tickInterior(interior, player);
    expect(useDoor(interior, player)).not.toBeNull();
    expect(isIndoors(interior)).toBe(true);
    expect(interior.space).toBe(`lot:${picks[use]}`);

    const inside = interior.links.find((l) => l.parcelUse === use).ends[1];
    walkToward(interior, player, inside.x, inside.z, 2.5);
    tickInterior(interior, player);
    expect(useDoor(interior, player)).not.toBeNull();
    expect(interior.space).toBe(STREET);
  }

  // Clear the commercial lot: its building comes down and its door goes with it.
  zoneParcel(city, picks.com, null);
  for (let i = 0; i < 400 * TICKS_PER_SEC && city.parcels[picks.com].stage !== STAGE.EMPTY; i++) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
  }
  expect(city.parcels[picks.com].stage).toBe(STAGE.EMPTY);
  syncInterior(interior);
  expect(interior.links.some((l) => l.id === `lot:${picks.com}-door`)).toBe(false);
});

test('a building the player stands inside does not decline around them', () => {
  const city = createCity(SEED);
  const street = createStreet(SEED);
  const i = 6;                              // res at LOW on this seed
  const interior = createInterior(city);
  syncInterior(interior);
  const player = createPlayer();
  const enterEnd = interior.links.find((l) => l.id === `lot:${i}-door`).ends[0];
  standAt(player, enterEnd.x, enterEnd.z);
  tickInterior(interior, player);
  expect(useDoor(interior, player)).not.toBeNull();
  expect(interior.space).toBe(`lot:${i}`);

  // Every market dead: on its own the lot would empty and shed floors.
  for (const use of USES) pinDemand(city, use, 0);
  const stage = city.parcels[i].stage;
  const run = (secs) => {
    for (let t = 0; t < secs; t += DT) {
      tickStreet(street, DT);
      tickZoning(city, DT, street, occupiedParcel(interior));
    }
  };
  run(180);
  expect(city.parcels[i].stage).toBe(stage);

  // Step back out through the same door; the decline resumes.
  const leaveEnd = interior.links.find((l) => l.id === `lot:${i}-door`).ends[1];
  standAt(player, leaveEnd.x, leaveEnd.z);
  tickInterior(interior, player);
  expect(useDoor(interior, player)).not.toBeNull();
  expect(interior.space).toBe(STREET);
  run(220);
  expect(city.parcels[i].stage).toBeLessThan(stage);
});
