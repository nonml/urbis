// The police on the ground: every cruiser (chasing or parked across a
// roadblock), their lights, the roadblock's barricades and the spike strips,
// and the red/blue wash they throw on the street. Render only — it reads the
// wanted sim and never writes it.
//
// Law 4, and the top tier's budget: every police body in the street is one
// instanced draw (policekit.js) and every police lamp another, at any tier,
// and neither draws while the city is clean. The two per-car pursuit meshes
// this replaced cost eight draws a cruiser.
import * as THREE from 'three';
import { blend, drawAlpha } from '../game/loop.js';
import { fireSparks } from './hackfx.js';
import { heightAt } from '../sim/world.js';
import { buildHeli, updateHeli } from './heli.js';
import { BARRICADE_POSTS, KIT, STINGER_HALF, beginKit, buildKit, endKit, placeKit } from './policekit.js';

// Two chasing, two across a roadblock.
const MAX_CRUISERS = 4;
// One blended pose per cruiser, reused every frame (M0-9).
const CRUISER_POSES = Array.from({ length: MAX_CRUISERS }, () => ({}));
// Four cruisers' lamps, the roadblock's, the strips' reflectors, the
// helicopter's and forty search-ring dashes.
const MAX_LIGHTS = 96;
// Past this the sun is down and a shadow pass would draw nothing anyone sees.
const SHADOWLESS_NIGHT = 0.5;
const ROTOR_SPIN = 2 * Math.PI * 1.7;

// Where a cruiser's lamps sit, in its own frame: [x, y, z, w, h, d].
const HEAD = [[-0.55, 0.7, 2.12, 0.34, 0.16, 0.03], [0.55, 0.7, 2.12, 0.34, 0.16, 0.03]];
const TAIL = [[-0.55, 0.75, -2.12, 0.3, 0.12, 0.03], [0.55, 0.75, -2.12, 0.3, 0.12, 0.03]];
const BAR = [[-0.3, 1.55, -0.2, 0.5, 0.13, 0.26], [0.3, 1.55, -0.2, 0.5, 0.13, 0.26]];

// Linear, a little over 1 so the lamps read as sources. Not much over: ACES
// bleaches a saturated colour toward white as it climbs, and a light bar that
// renders white has stopped saying police.
const rgb = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const LAMP = {
  head: rgb(1.5, 1.65, 1.8), tail: rgb(0.9, 0.06, 0.04),
  redOn: rgb(3, 0.05, 0.04), blueOn: rgb(0.06, 0.25, 4.5), barOff: rgb(0.12, 0.03, 0.03),
  amberOn: rgb(3.2, 1.3, 0.12), amberOff: rgb(0.25, 0.1, 0.02), reflector: rgb(0.55, 0.28, 0.05),
};
// Red half, then blue half, each broken by one short blink — a real bar's
// wig-wag. Long on-times, because a bar that is dark most of the time reads
// as broken in any single frame. Each car is offset so a pair of them does not
// flash in lockstep.
const FLASH_PERIOD = 0.6;
const FLASH_WINDOWS = [[0, 0.2], [0.24, 0.44]];
const CAR_PHASE = 0.17;
const AMBER_HZ = 1.1;

function flashOn(t) {
  const p = (t % FLASH_PERIOD) / FLASH_PERIOD;
  return {
    red: FLASH_WINDOWS.some(([a, b]) => p >= a && p < b),
    blue: FLASH_WINDOWS.some(([a, b]) => p >= a + 0.5 && p < b + 0.5),
  };
}

// A strip lies across its road: along x on an avenue, along z on a crossing.
function stripYaw(axis) {
  return axis === 'z' ? 0 : Math.PI / 2;
}

function activeStrips(r) {
  return [r.strip.active && r.strip, r.roadblock.active && r.roadblock.strip].filter(Boolean);
}

export function buildPolice(scene) {
  const group = new THREE.Group();
  const kit = buildKit();
  kit.mesh.name = 'police-kit';
  const lights = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_LIGHTS
  );
  lights.setColorAt(0, LAMP.head);
  lights.frustumCulled = false;
  lights.visible = false;
  lights.count = 0;
  // The wash: one real light, parked on whichever police light the player is
  // nearest, so the bar paints the facades and the wet road around it. It
  // never leaves the scene — hiding it would change the light count and
  // recompile every material in the city mid-chase; at zero it costs no draw.
  const wash = new THREE.PointLight(0xff2a1c, 0, 32, 2);
  wash.position.set(0, -50, 0);
  const heli = buildHeli();
  group.add(kit.mesh, lights, wash, heli.group);
  scene.add(group);
  return {
    group, kit, lights, wash, heli,
    dummy: new THREE.Object3D(), lightN: 0, sparkT: 0, wasFlat: 0, flashFreeze: null,
  };
}

// Light slots are packed from zero every frame; the mesh draws only `count`.
function pushLight(rig, x, y, z, yaw, [lx, ly, lz, w, h, d], color) {
  if (rig.lightN >= MAX_LIGHTS) return;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const { dummy } = rig;
  dummy.position.set(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
  dummy.rotation.set(0, yaw, 0);
  dummy.scale.set(w, h, d);
  dummy.updateMatrix();
  rig.lights.setMatrixAt(rig.lightN, dummy.matrix);
  rig.lights.setColorAt(rig.lightN, color);
  rig.lightN++;
}

function cruisersOf(wanted) {
  return [
    ...wanted.pursuit.filter((u) => u.active),
    ...wanted.response.roadblock.cars,
  ].slice(0, MAX_CRUISERS);
}

function drawCruisers(rig, cars, t) {
  const alpha = drawAlpha();
  cars.forEach((u, i) => {
    // Body and lamps ride the pose blended between the last two sim steps
    // (M0-9), so a cruiser chasing at 10 m/s does not stutter at 20 Hz.
    const p = blend(u, alpha, CRUISER_POSES[i]);
    placeKit(rig.kit, KIT.CRUISER, p.x, p.y, p.z, p.yaw);
    const f = flashOn(t + i * CAR_PHASE);
    for (const l of HEAD) pushLight(rig, p.x, p.y, p.z, p.yaw, l, LAMP.head);
    for (const l of TAIL) pushLight(rig, p.x, p.y, p.z, p.yaw, l, LAMP.tail);
    pushLight(rig, p.x, p.y, p.z, p.yaw, BAR[0], f.red ? LAMP.redOn : LAMP.barOff);
    pushLight(rig, p.x, p.y, p.z, p.yaw, BAR[1], f.blue ? LAMP.blueOn : LAMP.barOff);
  });
}

const BARRICADE_LAMPS = BARRICADE_POSTS.map((x) => [x, 1.6, 0, 0.14, 0.14, 0.14]);
const REFLECTORS = [-1.2, -0.4, 0.4, 1.2].map((x) => [x, 0.05, 0.12, 0.08, 0.03, 0.02]);

// Barricades and stingers: bodies in the kit, lamps and reflectors in the lights.
function drawProps(rig, r, t) {
  if (r.roadblock.active) {
    r.roadblock.barriers.forEach((b, i) => {
      placeKit(rig.kit, KIT.BARRICADE, b.x, b.y, b.z, b.yaw);
      BARRICADE_LAMPS.forEach((l, k) => {
        const on = Math.floor(t * AMBER_HZ * 2 + i + k) % 2 === 0;
        pushLight(rig, b.x, b.y, b.z, b.yaw, l, on ? LAMP.amberOn : LAMP.amberOff);
      });
    });
  }
  for (const s of activeStrips(r)) {
    const y = heightAt(s.x, s.z);
    const stretch = s.half / STINGER_HALF;
    placeKit(rig.kit, KIT.STINGER, s.x, y, s.z, stripYaw(s.axis), stretch);
    for (const [x, ...rest] of REFLECTORS) {
      pushLight(rig, s.x, y, s.z, stripYaw(s.axis), [x * stretch, ...rest], LAMP.reflector);
    }
  }
}

// The wash sits on the roadblock if the camera is near one, else on the
// nearest chasing car, and takes that car's colour of the moment.
const WASH_REACH = 70;
const WASH_NIGHT = 70;
const WASH_DAY = 12;
const WASH_HEIGHT = 2.2;
const WASH_RED = new THREE.Color(0xff2a1c);
const WASH_BLUE = new THREE.Color(0x2a58ff);

function placeWash(rig, wanted, cars, camera, night, t) {
  const rb = wanted.response.roadblock;
  const eye = camera.position;
  let src = -1;
  let best = WASH_REACH;
  cars.forEach((u, i) => {
    const d = Math.hypot(u.x - eye.x, u.z - eye.z);
    if (d < best) { best = d; src = i; }
  });
  const atBlock = rb.active && Math.hypot(rb.x - eye.x, rb.z - eye.z) < WASH_REACH;
  if (atBlock) src = cars.indexOf(rb.cars[0]);
  const f = src >= 0 ? flashOn(t + src * CAR_PHASE) : null;
  if (!f || (!f.red && !f.blue)) {
    rig.wash.intensity = 0;
    return;
  }
  const at = atBlock ? rb : cars[src];
  rig.wash.position.set(at.x, heightAt(at.x, at.z) + WASH_HEIGHT, at.z);
  rig.wash.color.copy(f.red ? WASH_RED : WASH_BLUE);
  rig.wash.intensity = WASH_DAY + (WASH_NIGHT - WASH_DAY) * night;
}

// Flats read on the car itself: it sits down on its rims, and throws sparks
// from the front wheels when it hits the strip and while it is pushed along.
const FLAT_SAG = 0.08;
const FLAT_SQUASH = 0.2;
const FRONT_AXLE = 1.35;
const TRACK_HALF = 0.85;
const SPARK_EVERY = 0.09;
const SPARK_SLOT = 20;
const SPARK_MIN_SPEED = 2;

function atWheel(car, side) {
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  return { x: car.x + side * c + FRONT_AXLE * s, z: car.z - side * s + FRONT_AXLE * c };
}

function drawFlats(rig, heroRig, car, fx, time) {
  const flat = car.flat ?? 0;
  heroRig.group.position.y = car.y - FLAT_SAG * flat;
  heroRig.wheels.scale.y = 1 - FLAT_SQUASH * flat;
  if (flat && !rig.wasFlat) {
    for (const [side, slot] of [[-TRACK_HALF, 0], [TRACK_HALF, 12]]) {
      const w = atWheel(car, side);
      fireSparks(fx, w.x, 0.2, w.z, time, slot, 12);
    }
  }
  rig.wasFlat = flat;
  if (!flat || Math.abs(car.speed) < SPARK_MIN_SPEED || time - rig.sparkT < SPARK_EVERY) return;
  rig.sparkT = time;
  const w = atWheel(car, Math.floor(time * 7) % 2 ? TRACK_HALF : -TRACK_HALF);
  fireSparks(fx, w.x, 0.12, w.z, time, SPARK_SLOT, 2);
}

// ctx: { time (sim), elapsed (clock), night, camera, heroRig, heroCar, fx }
export function updatePolice(rig, wanted, ctx) {
  const t = rig.flashFreeze ?? ctx.elapsed;
  const r = wanted.response;
  rig.lightN = 0;
  beginKit(rig.kit, (t * ROTOR_SPIN) % (Math.PI * 2));
  const cars = cruisersOf(wanted);
  drawCruisers(rig, cars, t);
  drawProps(rig, r, t);
  updateHeli(rig.heli, r.heli, wanted, ctx, t, {
    light: (...a) => pushLight(rig, ...a),
    body: (x, y, z, yaw) => placeKit(rig.kit, KIT.HELI, x, y, z, yaw),
  });
  endKit(rig.kit, ctx.night < SHADOWLESS_NIGHT);
  // three caches an InstancedMesh's raycast sphere on the first ray. The kit
  // starts empty, so a probe that asked before any cruiser was placed would
  // keep missing these instances; keep the sphere on the placed ones.
  if (rig.kit.n > 0) rig.kit.mesh.computeBoundingSphere();
  rig.lights.count = rig.lightN;
  rig.lights.visible = rig.lightN > 0;
  rig.lights.instanceMatrix.needsUpdate = true;
  rig.lights.instanceColor.needsUpdate = true;
  placeWash(rig, wanted, cars, ctx.camera, ctx.night, t);
  drawFlats(rig, ctx.heroRig, ctx.heroCar, ctx.fx, ctx.time);
}
