// Engines and the horn (M7.T4): the player's car and the traffic around it.
//
// Three sounds from the set M7.T2 pinned:
//
//   engine_loop  — the hero car. Pitch and level rise with speed; flat, because
//                  the listener rides inside the car and a panner would only
//                  subtract it as the follow camera pulls back
//   traffic_pass — one for a moving car that is about to sweep past the
//                  listener, positional so it crosses the frame's stereo field
//   horn         — E behind the wheel, flat on the effects bus with the engine
//
// `vehicleSounds(pose)` is the whole decision as pure data, so a check can list
// what plays per pose with no browser and no AudioContext (M7-1's "lists playing
// sounds per pose"). `createVehicles(audio, buffers)` turns that list into one
// engine loop plus a one-shot per pass, and `honk()` is the horn; the E key is
// the input layer's one line (`if (k === 'e' && driving) vehicles.honk()`).
import { CAR_TOP } from '../sim/vehicle.js';

export const ENGINE = 'engine_loop';
export const PASS = 'traffic_pass';
export const HORN = 'horn';

export const EFFECTS_BUS = 'effects';

// Idle to flat out. The hero tops out at CAR_TOP, so the whole rise is audible
// in normal play; reverse follows |speed|, so it idles its way back down.
export const ENGINE_IDLE_RATE = 0.62;
export const ENGINE_TOP_RATE = 1.75;
export const ENGINE_IDLE_GAIN = 0.16;
export const ENGINE_TOP_GAIN = 0.4;
export const HORN_GAIN = 0.85;

// A closing car is considered at this range, but the pass one-shot waits until
// it is PASS_LEAD seconds from its closest approach and that approach is within
// PASS_NEAR of the listener — so the sample covers the whoosh, not the approach.
export const PASS_EARSHOT = 30;
export const PASS_NEAR = 16;
export const PASS_LEAD = 2;
export const PASS_LEVEL = 0.8;
const PASS_Y = 1;
// The pass sample's pitch tracks how fast the car is going, within a step.
const PASS_RATE_BASE = 0.9;
const PASS_RATE_PER_SPEED = 0.015;

const square = (v) => v * v;
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function engineRate(speed) {
  const load = clamp01(Math.abs(speed ?? 0) / CAR_TOP);
  return round3(ENGINE_IDLE_RATE + (ENGINE_TOP_RATE - ENGINE_IDLE_RATE) * load);
}

export function engineGain(speed) {
  const load = clamp01(Math.abs(speed ?? 0) / CAR_TOP);
  return round3(ENGINE_IDLE_GAIN + (ENGINE_TOP_GAIN - ENGINE_IDLE_GAIN) * load);
}

// The hero's engine while `driving`; the pose may carry speed on the car or
// flat. Null on foot: a parked hero is an engine off.
export function engineSound(pose = {}) {
  if (!pose.driving) return null;
  const car = pose.car ?? {};
  const speed = pose.speed ?? car.speed ?? 0;
  return {
    name: ENGINE, bus: EFFECTS_BUS, loop: true, flat: true,
    gain: engineGain(speed), rate: engineRate(speed),
  };
}

// The horn is an act, not a pose; a pose that carries `horn` lists it so the
// criterion can be read off the same table. Flat for the same reason the engine
// is: the player's own car, right under the lens.
export function hornSound() {
  return { name: HORN, bus: EFFECTS_BUS, loop: false, flat: true, gain: HORN_GAIN, rate: 1 };
}

// Every moving car near enough to be heard with its closest approach still
// ahead: the pass one-shot's moment. Pure — the same cars and listener give the
// same list; the create side fires one one-shot per car per approach and re-arms
// when the car drops out heading away.
export function passSounds(pose = {}) {
  const px = pose.px ?? pose.x ?? 0;
  const pz = pose.pz ?? pose.z ?? 0;
  const out = [];
  const cars = pose.cars ?? [];
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (c.parked || !(c.speed > 0)) continue;
    const cx = c.x ?? c.lane, cz = c.z ?? c.lane;
    const dx = cx - px, dz = cz - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 > PASS_EARSHOT * PASS_EARSHOT) continue;
    const vx = c.axis === 'x' ? c.dir * c.speed : 0;
    const vz = c.axis === 'z' ? c.dir * c.speed : 0;
    const v2 = vx * vx + vz * vz;
    const closing = dx * vx + dz * vz;
    if (v2 === 0 || closing >= 0) continue;
    const tca = -closing / v2;
    if (tca > PASS_LEAD) continue;
    const closest2 = d2 - (closing * closing) / v2;
    if (closest2 > PASS_NEAR * PASS_NEAR) continue;
    out.push({
      key: i, name: PASS, bus: EFFECTS_BUS, loop: false, flat: false,
      x: round2(cx), y: PASS_Y, z: round2(cz),
      gain: round3(PASS_LEVEL * square(1 - Math.sqrt(closest2) / PASS_NEAR)),
      rate: round3(PASS_RATE_BASE + c.speed * PASS_RATE_PER_SPEED),
    });
  }
  return out;
}

// What plays at this pose: the engine loop, the pass one-shots, the horn.
export function vehicleSounds(pose = {}) {
  const list = passSounds(pose);
  const engine = engineSound(pose);
  if (engine) list.unshift(engine);
  if (pose.horn) list.push(hornSound());
  return list;
}

// The three files the set needs, for whoever owns the AudioContext.
export const VEHICLE_FILES = {
  [ENGINE]: 'assets/sounds/engine_loop.mp3',
  [PASS]: 'assets/sounds/traffic_pass.mp3',
  [HORN]: 'assets/sounds/horn.mp3',
};

export async function loadVehicles(context, base = '') {
  const buffers = {};
  await Promise.all(Object.entries(VEHICLE_FILES).map(async ([name, path]) => {
    const res = await fetch(base + path);
    buffers[name] = await context.decodeAudioData(await res.arrayBuffer());
  }));
  return buffers;
}

// One engine loop for the life of the game; one one-shot per car per pass. The
// pose: { driving, speed|car, cars, px, pz, horn }. `buffers` is name ->
// decoded AudioBuffer (see loadVehicles); a missing buffer still lists, it just
// cannot be heard until the caller loads the set.
export function createVehicles(audio, buffers = {}) {
  let engine = null;
  let hornHeld = false;
  const passing = new Set();

  function update(pose = {}) {
    const plan = vehicleSounds(pose);
    const spec = plan.find((s) => s.name === ENGINE) ?? null;
    if (spec) {
      if (engine) audio.update(engine, { gain: spec.gain, rate: spec.rate });
      else engine = audio.play(spec.name, buffers[spec.name] ?? null, {
        bus: spec.bus, loop: true, flat: true, gain: spec.gain, rate: spec.rate,
      });
    } else if (engine) {
      audio.stop(engine);
      engine = null;
    }
    const live = new Set();
    for (const p of plan) {
      if (p.name !== PASS) continue;
      live.add(p.key);
      if (passing.has(p.key)) continue;
      audio.play(p.name, buffers[p.name] ?? null, {
        bus: p.bus, gain: p.gain, rate: p.rate, x: p.x, y: p.y, z: p.z,
      });
    }
    passing.clear();
    for (const key of live) passing.add(key);
    if (pose.horn && !hornHeld) honk();
    hornHeld = !!pose.horn;
    return plan;
  }

  function honk() {
    const s = hornSound();
    return audio.play(s.name, buffers[s.name] ?? null, {
      bus: s.bus, flat: s.flat, gain: s.gain, rate: s.rate,
    });
  }

  function stop() {
    if (engine) audio.stop(engine);
    engine = null;
    passing.clear();
    hornHeld = false;
  }

  return { update, honk, stop, plan: vehicleSounds };
}
