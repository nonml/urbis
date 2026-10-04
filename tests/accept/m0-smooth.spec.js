// M0-9 (docs/ROADMAP.md): smooth at any step. The world advances in 50 ms sim
// steps while the screen refreshes at ~60 fps, so a mover drawn straight from
// the sim stands still for two or three frames and then jumps. The fix this
// checks: every sim mover keeps its last step's pose, and the draw lerps between
// the two.
//
// Node-only, and that is deliberate. The page's own pick probe rounds its hit
// point to a tenth of a metre, and a 60 fps blend moves a walker two
// centimetres a frame: the one instrument a browser test has cannot see the
// thing being checked. Here the sim is ticked by the game's own fixed-step
// advance() for 300 frames at 60 fps, and the four renderers are driven for
// real — updateNPCs, updateTraffic, updatePolice and updateHeli — against
// rigs that record the matrices and body poses they would draw, at full
// precision. A mover whose last step was a normal one must have a different
// drawn pose every frame; blend() snaps a wrap or a spawn, so those are
// skipped. Cars, walkers, police and the helicopter are covered; the player,
// car and camera are M0.T1's.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { advance, blend, createFixedStep, STEP } from '../../src/game/loop.js';
import { createStreet, tickStreet } from '../../src/sim/street.js';
import { createWanted, forceTier, tickWanted } from '../../src/sim/wanted.js';
import { buildHeli, updateHeli } from '../../src/render/heli.js';
import { updateNPCs } from '../../src/render/npcs.js';

const SEED = 7;
const FPS = 60;
const FRAMES = 300;
// A held draw is bit-identical; interpolation moves the fastest thing in the
// city (the helicopter, 20 m/s) about 10 cm a frame. 1e-4 m is a held pose.
const HELD = 1e-4;
// blend() snaps a step that moved a body past this: a wrap at the street's end
// or a unit entering at distance. Those are drawn where they land.
const TELEPORT = 5;

function stepLen(m) {
  return Math.hypot(m.x - m.prev.x, m.z - m.prev.z, (m.y ?? 0) - (m.prev.y ?? 0));
}

function suspect() {
  return {
    x: 2.5, z: 26, yaw: Math.PI, inCar: false, cover: false, night: 0.5,
    car: { speed: 0, flat: 0 },
    body: { x: 2.5, z: 26, speed: 0 },
  };
}

// A stand-in for an InstancedMesh: records the matrices a renderer writes. The
// matrix is copied because the updaters reuse one Object3D for every part.
function recorder() {
  return {
    mats: [],
    setMatrixAt(i, m) { this.mats[i] = m.elements.slice(); },
    instanceMatrix: {},
  };
}

// render/signs.js imports content/signs.json bare, which Vite folds and Node's
// loader refuses. This registers the bundler's behaviour for that one import,
// so the test can load the real traffic and police renderers; the app build is
// untouched. Everything else passes through.
async function loadRender() {
  const { register } = await import('node:module');
  const hooks = `
    import { readFile } from 'node:fs/promises';
    export async function resolve(s, c, next) { return next(s, c); }
    export async function load(url, c, next) {
      if (url.endsWith('.json')) {
        return { format: 'json', source: await readFile(new URL(url), 'utf8'), shortCircuit: true };
      }
      return next(url, c);
    }`;
  register(`data:text/javascript,${encodeURIComponent(hooks)}`);
  return {
    ...(await import('../../src/render/traffic.js')),
    ...(await import('../../src/render/police.js')),
  };
}

test('M0-9: every mover is drawn between its last two sim steps, every frame', async () => {
  const { updateTraffic, buildPolice, updatePolice } = await loadRender();
  const street = createStreet(SEED);
  const wanted = createWanted();
  const hero = suspect();
  forceTier(wanted, 3, { x: hero.x, z: hero.z, yaw: hero.yaw }, 0);
  const fixed = createFixedStep(1);

  const npcRig = {
    bodies: recorder(), heads: recorder(), legL: recorder(), legR: recorder(),
    armL: recorder(), armR: recorder(), hats: recorder(), faces: recorder(),
    glasses: recorder(), dummy: new THREE.Object3D(), poses: street.npcs.map(() => ({})),
  };
  const carRig = {
    bodies: recorder(), wheels: recorder(), beams: recorder(), tails: recorder(),
    glass: recorder(), trim: recorder(), pools: recorder(), glows: recorder(),
    dummy: new THREE.Object3D(), poses: street.cars.map(() => ({})),
  };
  const police = buildPolice({ add() {} });
  const heroRig = { group: new THREE.Object3D(), wheels: new THREE.Object3D() };
  const heroCar = { x: hero.x, y: 0, z: hero.z, yaw: 0, speed: 0, flat: 0 };
  const ctx = {
    time: 0, elapsed: 0, night: 1, camera: { position: new THREE.Vector3(0, 5, 0) },
    heroRig, heroCar, fx: null,
  };
  const heliRig = buildHeli();
  const kitAt = new THREE.Matrix4();
  const last = { blend: new Map(), npc: new Map(), car: new Map(), police: new Map() };
  const heliWas = { body: null, settled: false };
  const missing = [];
  const held = [];
  const checked = { blend: 0, npc: 0, car: 0, police: 0, heli: 0 };

  const warps = { npc: new Set(), car: new Set(), police: new Set() };
  const drawCheck = (kind, i, key, m, entity, frame) => {
    const was = last[kind].get(i);
    const step = entity.prev ? stepLen(entity) : 0;
    // fixed.total > 1 skips the first step's alpha-0 frame; warps skip the
    // frame a wrap or a spawn landed on and the one it settles on.
    if (was && fixed.total > 1 && step > 0 && step <= TELEPORT && !warps[kind].has(i)) {
      checked[kind] += 1;
      const d = Math.hypot(m[12] - was[0], m[14] - was[1]);
      if (d < HELD) held.push(`${key} frame ${frame} d ${d} at ${was}->${[m[12], m[14]]}`);
    }
    if (step > TELEPORT) warps[kind].add(i);
    else warps[kind].delete(i);
    last[kind].set(i, [m[12], m[14]]);
  };

  for (let f = 0; f < FRAMES; f++) {
    advance(fixed, 1 / FPS);
    for (let s = 0; s < fixed.steps; s++) {
      tickStreet(street, STEP);
      tickWanted(wanted, STEP, hero, street.time);
      fixed.total += 1;
    }
    const movers = [];
    street.npcs.forEach((n, i) => movers.push([`npc:${i}`, n]));
    street.cars.forEach((c, i) => { if (!c.parked) movers.push([`car:${i}`, c]); });
    wanted.pursuit.forEach((u, i) => { if (u.active) movers.push([`police:${i}`, u]); });
    const heli = wanted.response.heli;
    if (heli.active) movers.push(['heli', heli]);

    const present = new Set(movers.map(([k]) => k));
    for (const key of last.blend.keys()) if (!present.has(key)) last.blend.delete(key);

    for (const [key, m] of movers) {
      // The first one or two frames at 60 fps hold no whole step yet; there is
      // nothing to draw between until fixed.total has advanced.
      if (fixed.total === 0) continue;
      if (!m.prev) { missing.push(`${key} frame ${f}`); continue; }
      const moved = stepLen(m);
      if (moved === 0 || moved > TELEPORT) continue;
      const pose = blend(m, fixed.alpha, {});
      const was = last.blend.get(key);
      if (was) {
        checked.blend += 1;
        if (Math.hypot(pose.x - was.x, pose.z - was.z) < HELD) held.push(`blend ${key} frame ${f}`);
      }
      last.blend.set(key, pose);
    }

    // The renderers, on the same sim, with alpha published by advance().
    updateNPCs(npcRig, street);
    updateTraffic(carRig, street);
    ctx.time = street.time;
    ctx.elapsed = f / FPS;
    updatePolice(police, wanted, ctx);

    street.npcs.forEach((n, i) => drawCheck('npc', i, `npc draw ${i}`, npcRig.bodies.mats[i], n, f));
    street.cars.forEach((c, i) => {
      if (!c.parked) drawCheck('car', i, `car draw ${i}`, carRig.bodies.mats[i], c, f);
    });
    wanted.pursuit.forEach((u, i) => {
      if (!u.active) return;
      police.kit.mesh.getMatrixAt(i, kitAt);
      drawCheck('police', i, `police draw ${i}`, kitAt.elements, u, f);
    });

    if (heli.active) {
      const hmoved = heli.prev ? stepLen(heli) : 0;
      let body = null;
      updateHeli(heliRig, heli, wanted, ctx, f / FPS, {
        light: () => {}, body: (x, y, z, yaw) => { body = [x, y, z, yaw]; },
      });
      if (body) {
        if (heliWas.body && heliWas.settled && hmoved > 0 && hmoved <= TELEPORT) {
          checked.heli += 1;
          if (Math.hypot(body[0] - heliWas.body[0], body[2] - heliWas.body[2]) < HELD) {
            held.push(`heli draw frame ${f}`);
          }
        }
        if (hmoved > TELEPORT) heliWas.settled = false;
        else if (hmoved > 0) heliWas.settled = true;
        heliWas.body = body;
      }
    }
  }

  expect(missing.slice(0, 6), 'every mover keeps the pose it stepped from').toEqual([]);
  expect(checked.blend, 'movers blended across consecutive frames').toBeGreaterThan(1000);
  expect(checked.npc, 'walkers drawn across consecutive frames').toBeGreaterThan(1000);
  expect(checked.car, 'cars drawn across consecutive frames').toBeGreaterThan(1000);
  expect(checked.police, 'police drawn across consecutive frames').toBeGreaterThan(100);
  expect(checked.heli, 'helicopter body drawn across consecutive frames').toBeGreaterThan(150);
  expect(held.slice(0, 6), 'no mover held its drawn pose for two frames').toEqual([]);
});
