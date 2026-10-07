// M4-3 (docs/ROADMAP.md): the ground off the roads has relief, and the player,
// the hero car, traffic, walkers and police stand on it — never sunk into it
// and never floating. Every mover samples the map's own terrain (M4.T2), so at
// its own (x, z) its `y` is the ground there: map.terrain.heightAt, the field
// the render draws. Traffic and walkers ride the graded carriageways and
// walkways, where the field is exactly zero by design; the player and the hero
// car are probed across their whole boxes, off the roads and onto the relief.
//
// The check fails if a mover has no y at all, if its y is the world.js field
// instead of the map's (they part by metres wherever a parcel pad holds the
// drawn ground flat), or if its y drifts from the ground under it. Node only:
// no browser opens.
import { test, expect } from '@playwright/test';
import { createMap } from '../../src/sim/map.js';
import { createPlayer, tickPlayer } from '../../src/sim/player.js';
import { createPlayerCar, tickPlayerCar } from '../../src/sim/vehicle.js';
import { createTraffic, tick as tickTraffic } from '../../src/sim/traffic.js';
import { createWalkers, tick as tickWalkers } from '../../src/sim/walkers.js';
import { createWanted, forceTier, tickWanted } from '../../src/sim/wanted.js';

const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
// Five centimetres: "standing on it", not "within sight of it". The sim and
// the check read the same field, so the honest number after the fix is 0.
const TOL = 0.05;
const STILL = { mx: 0, mz: 0 };
const PARKED = { throttle: 0, steer: 0 };
// The town window the hero car and the police are probed across; the drive box
// itself is a whole region, and this is where the pads and hills are.
const TOWN = { minX: -300, maxX: 300, minZ: -300, maxZ: 300 };

function grid(box, step) {
  const out = [];
  for (let x = box.minX; x <= box.maxX; x += step) {
    for (let z = box.minZ; z <= box.maxZ; z += step) out.push([x, z]);
  }
  return out;
}

function clip(box, bounds) {
  return {
    minX: Math.max(box.minX, bounds.minX), maxX: Math.min(box.maxX, bounds.maxX),
    minZ: Math.max(box.minZ, bounds.minZ), maxZ: Math.min(box.maxZ, bounds.maxZ),
  };
}

function ground(map, x, z) {
  return map.terrain.heightAt(x, z);
}

function onGround(map, e, what, seed, where = '') {
  const g = ground(map, e.x, e.z);
  expect(Number.isFinite(e.y), `seed ${seed}: ${what} has no y${where}`).toBe(true);
  expect(Math.abs(e.y - g), `seed ${seed}: ${what} at ${e.x.toFixed(1)},${e.z.toFixed(1)} y ${e.y} vs ground ${g}${where}`)
    .toBeLessThanOrEqual(TOL);
}

function checkPlayer(map, seed) {
  const player = createPlayer(map);
  onGround(map, player, 'player at spawn', seed);
  for (const [x, z] of grid(map.district.walk, 6)) {
    player.x = x;
    player.z = z;
    tickPlayer(player, STILL, DT, map);
    onGround(map, player, 'player', seed);
  }
}

function checkHeroCar(map, seed) {
  const car = createPlayerCar(map);
  onGround(map, car, 'hero car at spawn', seed);
  for (const [x, z] of grid(clip(TOWN, map.district.drive), 24)) {
    car.x = x;
    car.z = z;
    tickPlayerCar(car, PARKED, DT, map);
    onGround(map, car, 'hero car', seed);
  }
}

function checkTraffic(map, seed) {
  const state = createTraffic(map, seed, 16);
  for (const c of state.cars) onGround(map, c, 'traffic car at spawn', seed);
  const was = state.cars.map((c) => ({ x: c.x, z: c.z }));
  for (let t = 0; t < 60; t += DT) tickTraffic(state, DT);
  let moved = 0;
  state.cars.forEach((c, i) => {
    onGround(map, c, `traffic car ${i}`, seed);
    if (Math.hypot(c.x - was[i].x, c.z - was[i].z) > 1) moved += 1;
  });
  expect(moved, `seed ${seed}: traffic must actually drive`).toBeGreaterThan(0);
}

function checkWalkers(map, seed) {
  const bodies = Array.from({ length: 24 }, (_, i) => ({ speed: 1.1 + (i % 4) * 0.15, phase: i }));
  const state = createWalkers(map, seed, bodies);
  for (const w of state.walkers) onGround(map, w, 'walker at spawn', seed);
  const was = state.walkers.map((w) => ({ x: w.x, z: w.z }));
  // street.js sets each walker's per-step speed before the tick; a bare
  // walkers state starts held, so the check drives it the same way.
  for (let t = 0; t < 60; t += DT) {
    for (const w of state.walkers) w.v = w.speed;
    tickWalkers(state, DT);
  }
  let moved = 0;
  state.walkers.forEach((w, i) => {
    onGround(map, w, `walker ${i}`, seed);
    if (Math.hypot(w.x - was[i].x, w.z - was[i].z) > 1) moved += 1;
  });
  expect(moved, `seed ${seed}: walkers must actually walk`).toBeGreaterThan(0);
}

function checkPolice(map, seed) {
  const w = createWanted(map);
  const spawn = map.spawn.player;
  const hero = { x: spawn.x, z: spawn.z, yaw: 0, inCar: false, car: { speed: 0, flat: 0 }, cover: 0, night: 0 };
  forceTier(w, 1, hero, 0, map);
  const u = w.pursuit[0];
  onGround(map, u, 'police unit at spawn', seed);
  let time = 0;
  for (const [x, z] of grid(clip(TOWN, map.district.drive), 24)) {
    // Put the unit on the probe; the step then drives it off that spot and
    // lands its y on the ground there. Keep it on duty across the sweep: a
    // busted or stood-down unit stops stepping and would go stale.
    u.x = x;
    u.z = z;
    time += DT;
    tickWanted(w, DT, hero, time, map);
    w.catchT = 0;
    w.searchT = 0;
    onGround(map, u, 'police unit', seed);
  }
}

for (const seed of SEEDS) {
  test(`M4-3 seed ${seed}: every mover stands on the map's terrain`, () => {
    const map = createMap(seed);
    checkPlayer(map, seed);
    checkHeroCar(map, seed);
    checkTraffic(map, seed);
    checkWalkers(map, seed);
    checkPolice(map, seed);
  });
}
