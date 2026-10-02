// What each tier sends beyond the chase cars: spike strips, a roadblock laid
// across the road ahead, and the helicopter. Pure state — render reads it, and
// the only things it writes outside itself are the hero's car and body, because
// a stinger that does not flatten a tyre and a barricade you can drive through
// are set dressing, not police.
import { CAR_TOP } from './vehicle.js';
import { HURRY_SPEED } from './player.js';
import { LANE_OFFSET, heightAt } from './world.js';
import { aheadOnRoad } from './patrol.js';

// --- Roadblock --------------------------------------------------------------
// Far enough ahead to see it lit up and choose: turn off, or thread the gap and
// take the strip. Nearer than MIN it would drop into the player's face.
export const ROADBLOCK_AHEAD = 55;
const ROADBLOCK_MIN_AHEAD = 30;
// Once the suspect is this far from it, it has been driven round; it packs up
// and goes up again ahead of them.
const ROADBLOCK_RETIRE = 75;
const ROADBLOCK_COOLDOWN = 8;
// Nothing packs up or appears while the suspect is closer than this.
const OUT_OF_SIGHT = 45;
// The layout in the road's own frame: u across (metres right of the centre
// line), v along the suspect's direction of travel. Two cruisers nose-in make a
// V with a car-width gap in the middle; the strip covers the approach to it;
// lit barricades close both pavements.
const BLOCK_CARS = [{ u: -3.4, v: 0, turn: -0.42 }, { u: 3.4, v: 0.9, turn: 0.42 }];
const BLOCK_BARRIERS = [{ u: -5.4, v: 3 }, { u: 5.4, v: 3 }];
const BLOCK_STRIP = { u: 0, v: -6, half: 1.4 };
// What stops you is the whole line, not the props on it: from the noses of the
// cars out past the building line on both sides, bar the gap between the noses.
// Nothing in this city stops a car at a facade yet, so a block that ended at
// the barricades would be driven round through the shopfronts.
const BLOCK_BAND = { v0: -1.6, v1: 3.6, gapHalf: 1.2, reach: 10 };
const HERO_CAR_R = 0.9;
const HERO_FOOT_R = 0.35;
const BOUNCE = -0.15;
const RAM_SPEED = 3;
const RAM_REPEAT_SECS = 3;

// --- Spike strips -----------------------------------------------------------
const SPIKE_AHEAD = 38;
const SPIKE_MIN_AHEAD = 20;
const SPIKE_RETIRE = 60;
const SPIKE_COOLDOWN = 7;
const STRIP_HALF_WIDTH = 1.8;
const STRIP_HALF_DEPTH = 0.25;
const CAR_HALF_LENGTH = 2.0;
const CAR_HALF_WIDTH = 0.8;
// On the rims: under half the top speed, a pull to the flat side and a
// shimmy on top of it, both of which the player has to steer against.
export const FLAT_TOP = CAR_TOP * 0.45;
// Rims on tarmac: how hard the car sheds speed above FLAT_TOP. Stronger than
// full throttle, so the cap holds with the pedal down.
const FLAT_BLEED = 14;
const FLAT_PULL = 0.1;
const FLAT_SHIMMY = 0.35;
const FLAT_SHIMMY_HZ = 1.3;
const FLAT_FULL_EFFECT_SPEED = 6;

// --- Helicopter -------------------------------------------------------------
export const HELI_ALT = 24;
const HELI_ORBIT = 30;
const HELI_ORBIT_RATE = 0.22;
const HELI_SPEED = 20;
const HELI_ENTRY = { x: -70, z: 60, climb: 10 };
// Where the helicopter is looking moves just slower than a sprint, on
// purpose: walk and it holds you, sprint or drive and you slip out of it. At
// night that spot is the searchlight's pool; by day it is the observer's eye,
// wider because it needs no light.
const HELI_AIM_SPEED = HURRY_SPEED * 0.9;
export const HELI_POOL = 5;
const HELI_DAY_GAZE = 10;
const HELI_LEAVE_SECS = 8;
const HELI_LEAVE_SPEED = 18;
const HELI_LEAVE_CLIMB = 4;
const NIGHT = 0.5;

export function createResponse() {
  return {
    roadblock: {
      active: false, id: 0, x: 0, z: 0, axis: 'z', sign: 1, nextAt: 0, rammedAt: -Infinity,
      cars: [], barriers: [], strip: null, frame: null,
    },
    strip: { active: false, id: 0, x: 0, z: 0, axis: 'z', half: STRIP_HALF_WIDTH, spent: false, nextAt: 0 },
    heli: {
      active: false, leaving: false, leaveT: 0, x: 0, y: HELI_ALT, z: 0, yaw: 0, theta: 0, aimX: 0, aimZ: 0,
    },
  };
}

// The road's own frame at a placement: `along` points the way the suspect is
// travelling, `across` to their right.
function frameOf(axis, sign) {
  return axis === 'z'
    ? { ax: 0, az: sign, cx: -sign, cz: 0 }
    : { ax: sign, az: 0, cx: 0, cz: sign };
}

function place(spot, f, u, v) {
  const x = spot.x + f.cx * u + f.ax * v;
  const z = spot.z + f.cz * u + f.az * v;
  return { x, y: heightAt(x, z), z };
}

function layRoadblock(rb, spot) {
  const f = frameOf(spot.axis, spot.sign);
  const across = Math.atan2(f.cx, f.cz);
  rb.active = true;
  rb.id++;
  Object.assign(rb, { x: spot.x, z: spot.z, axis: spot.axis, sign: spot.sign, way: spot.way });
  // Each car noses in toward the centre line, turned back toward the approach.
  rb.cars = BLOCK_CARS.map((c) => ({
    ...place(spot, f, c.u, c.v), yaw: across + (c.u < 0 ? 0 : Math.PI) + c.turn, active: true,
  }));
  // A barricade's face turns to the approach; its boards run across the road.
  const facing = Math.atan2(-f.ax, -f.az);
  rb.barriers = BLOCK_BARRIERS.map((b) => ({ ...place(spot, f, b.u, b.v), yaw: facing }));
  const s = place(spot, f, BLOCK_STRIP.u, BLOCK_STRIP.v);
  rb.strip = { active: true, id: rb.id, x: s.x, z: s.z, axis: spot.axis, half: BLOCK_STRIP.half, spent: false };
  rb.frame = f;
}

function clearRoadblock(rb, time) {
  rb.active = false;
  rb.cars = [];
  rb.barriers = [];
  rb.strip = null;
  rb.nextAt = time + ROADBLOCK_COOLDOWN;
}

// Ahead of where the suspect was last seen, on the heading they were last seen
// on — the police do not know where you are going, only where you were going.
export function placeRoadblock(w, hero, time) {
  const rb = w.response.roadblock;
  const spot = aheadOnRoad(w.lkp.x, w.lkp.z, w.lkp.yaw, ROADBLOCK_AHEAD);
  const near = Math.min(Math.hypot(spot.x - w.lkp.x, spot.z - w.lkp.z), Math.hypot(spot.x - hero.x, spot.z - hero.z));
  if (near < ROADBLOCK_MIN_AHEAD) return false;
  layRoadblock(rb, spot);
  w.events.push({ type: 'roadblock_up', x: spot.x, z: spot.z, yaw: w.lkp.yaw, time });
  return true;
}

// Where it stands is the police's call, made from what they know (the last
// known position); when it may appear or vanish is the suspect's, so it never
// pops in or out in front of them.
function tickRoadblock(w, wanted, hero, time) {
  const rb = w.response.roadblock;
  if (rb.active) {
    const stale = !wanted || Math.hypot(w.lkp.x - rb.x, w.lkp.z - rb.z) > ROADBLOCK_RETIRE;
    if (stale && Math.hypot(hero.x - rb.x, hero.z - rb.z) > OUT_OF_SIGHT) clearRoadblock(rb, time);
    return;
  }
  if (wanted && time >= rb.nextAt && !placeRoadblock(w, hero, time)) rb.nextAt = time + 1;
}

function tickStrip(w, wanted, hero, time) {
  const s = w.response.strip;
  if (s.active) {
    const d = Math.hypot(hero.x - s.x, hero.z - s.z);
    const done = s.spent || !wanted || d > SPIKE_RETIRE;
    if (done && d > (s.spent ? SPIKE_MIN_AHEAD : OUT_OF_SIGHT)) {
      s.active = false;
      s.nextAt = time + SPIKE_COOLDOWN;
    }
    return;
  }
  if (!wanted || !hero.inCar || !w.contact || time < s.nextAt) return;
  const spot = aheadOnRoad(hero.x, hero.z, hero.yaw, SPIKE_AHEAD);
  if (Math.hypot(spot.x - hero.x, spot.z - hero.z) < SPIKE_MIN_AHEAD) return;
  // Laid across the lane the suspect is actually in; the other lane is the dodge.
  const off = spot.axis === 'z' ? hero.x - spot.x : hero.z - spot.z;
  const lane = Math.max(-LANE_OFFSET, Math.min(LANE_OFFSET, off));
  Object.assign(s, {
    active: true, id: s.id + 1, spent: false, axis: spot.axis,
    x: spot.axis === 'z' ? spot.x + lane : spot.x, z: spot.axis === 'x' ? spot.z + lane : spot.z,
  });
  w.events.push({ type: 'spikes_down', x: s.x, z: s.z, yaw: hero.yaw, time });
}

function overStrip(s, car) {
  const dx = car.x - s.x;
  const dz = car.z - s.z;
  const along = s.axis === 'z' ? dz : dx;
  const across = s.axis === 'z' ? dx : dz;
  return Math.abs(along) < STRIP_HALF_DEPTH + CAR_HALF_LENGTH && Math.abs(across) < s.half + CAR_HALF_WIDTH;
}

function spikeHits(w, hero, time) {
  if (!hero.inCar || Math.abs(hero.car.speed) < 0.5) return;
  for (const s of [w.response.strip, w.response.roadblock.strip]) {
    if (!s || !s.active || s.spent || !overStrip(s, hero.car)) continue;
    s.spent = true;
    hero.car.flat = 1;
    w.events.push({ type: 'spikes_hit', x: hero.x, z: hero.z, yaw: hero.yaw, time });
  }
}

// Flat tyres: the car keeps going, badly. The rims bleed it down to FLAT_TOP
// and hold it there, and it pulls and shimmies harder the faster it is pushed.
export function applyFlats(car, dt, time) {
  if (!car.flat) return;
  if (car.speed > FLAT_TOP) car.speed = Math.max(FLAT_TOP, car.speed - FLAT_BLEED * dt);
  const shimmy = Math.sin(time * FLAT_SHIMMY_HZ * Math.PI * 2) * FLAT_SHIMMY;
  car.yaw += (FLAT_PULL + shimmy) * dt * Math.min(1, Math.abs(car.speed) / FLAT_FULL_EFFECT_SPEED);
}

// Push a body out of the block line by the shallowest way out: back, through,
// or sideways into the gap. A car that hits it stops dead.
function collide(w, hero, time) {
  const rb = w.response.roadblock;
  if (!rb.active) return;
  const { ax, az, cx, cz } = rb.frame;
  const body = hero.body;
  const r = hero.inCar ? HERO_CAR_R : HERO_FOOT_R;
  const dx = body.x - rb.x;
  const dz = body.z - rb.z;
  const u = dx * cx + dz * cz;
  const v = dx * ax + dz * az;
  const b = BLOCK_BAND;
  const side = Math.abs(u);
  if (v <= b.v0 - r || v >= b.v1 + r || side <= b.gapHalf - r || side >= b.reach) return;
  const outs = [
    { u, v: b.v0 - r, depth: v - (b.v0 - r) },
    { u, v: b.v1 + r, depth: b.v1 + r - v },
    { u: Math.sign(u) * (b.gapHalf - r), v, depth: side - (b.gapHalf - r) },
  ];
  const out = outs.reduce((p, q) => (q.depth < p.depth ? q : p));
  body.x = rb.x + cx * out.u + ax * out.v;
  body.z = rb.z + cz * out.u + az * out.v;
  if (!hero.inCar) return;
  if (Math.abs(body.speed) > RAM_SPEED && time - rb.rammedAt > RAM_REPEAT_SECS) {
    rb.rammedAt = time;
    w.events.push({ type: 'rammed', x: body.x, z: body.z, yaw: hero.yaw, time });
  }
  body.speed *= BOUNCE;
}

function moveToward(h, tx, tz, step) {
  const dx = tx - h.x;
  const dz = tz - h.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return;
  const k = Math.min(1, step / d);
  h.x += dx * k;
  h.z += dz * k;
  if (d > 0.5) h.yaw = Math.atan2(dx, dz);
}

// Orbit whoever it is watching; the light chases the suspect when they are in
// contact and sweeps the search area when they are not.
function flyHeli(h, w, hero, dt, time) {
  const cx = w.contact ? hero.x : w.lkp.x;
  const cz = w.contact ? hero.z : w.lkp.z;
  h.theta += HELI_ORBIT_RATE * dt;
  moveToward(h, cx + Math.cos(h.theta) * HELI_ORBIT, cz + Math.sin(h.theta) * HELI_ORBIT, HELI_SPEED * dt);
  h.y += (HELI_ALT - h.y) * Math.min(1, dt);
  const r = w.search.active ? w.search.r * 0.8 : 0;
  const tx = w.contact ? hero.x : w.lkp.x + Math.sin(time * 0.9) * r;
  const tz = w.contact ? hero.z : w.lkp.z + Math.cos(time * 0.63) * r;
  const dx = tx - h.aimX;
  const dz = tz - h.aimZ;
  const d = Math.hypot(dx, dz);
  const k = d > 1e-6 ? Math.min(1, (HELI_AIM_SPEED * dt) / d) : 0;
  h.aimX += dx * k;
  h.aimZ += dz * k;
}

function tickHeli(w, wanted, hero, dt, time) {
  const h = w.response.heli;
  if (wanted && (!h.active || h.leaving)) {
    if (!h.active) {
      Object.assign(h, {
        x: w.lkp.x + HELI_ENTRY.x, z: w.lkp.z + HELI_ENTRY.z, y: HELI_ALT + HELI_ENTRY.climb,
        aimX: w.lkp.x, aimZ: w.lkp.z, theta: Math.atan2(HELI_ENTRY.z, HELI_ENTRY.x),
      });
      w.events.push({ type: hero.night >= NIGHT ? 'heli_on_night' : 'heli_on_day', x: w.lkp.x, z: w.lkp.z, time });
    }
    h.active = true;
    h.leaving = false;
  } else if (!wanted && h.active && !h.leaving) {
    h.leaving = true;
    h.leaveT = 0;
    w.events.push({ type: 'heli_off', x: h.x, z: h.z, time });
  }
  if (!h.active) return;
  if (!h.leaving) {
    flyHeli(h, w, hero, dt, time);
    return;
  }
  h.leaveT += dt;
  h.x += Math.sin(h.yaw) * HELI_LEAVE_SPEED * dt;
  h.z += Math.cos(h.yaw) * HELI_LEAVE_SPEED * dt;
  h.y += HELI_LEAVE_CLIMB * dt;
  if (h.leaveT >= HELI_LEAVE_SECS) h.active = false;
}

// The helicopter sees what it is looking at: the light's pool at night, a
// wider patch by day.
export function heliSees(h, hero) {
  if (!h.active || h.leaving) return false;
  const reach = hero.night >= NIGHT ? HELI_POOL : HELI_DAY_GAZE;
  return Math.hypot(hero.x - h.aimX, hero.z - h.aimZ) <= reach;
}

// What the tier has deployed, and where.
export function tickResponse(w, tier, hero, dt, time) {
  tickRoadblock(w, tier.roadblock, hero, time);
  tickStrip(w, tier.spikes, hero, time);
  tickHeli(w, tier.heli, hero, dt, time);
}

// What is physically on the road, which stays solid whatever the police are
// doing — including while the suspect is being cuffed.
export function tickObstacles(w, hero, dt, time) {
  collide(w, hero, time);
  spikeHits(w, hero, time);
  applyFlats(hero.car, dt, time);
}
