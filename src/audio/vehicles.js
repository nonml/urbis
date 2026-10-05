// Engines and the horn (M7.T4): the player's car and the traffic around it.
//
// The sounds the set M7.T2 pinned:
//
//   engine_loop  — the hero car. Pitch and level rise with speed; flat, because
//                  the listener rides inside the car and a panner would only
//                  subtract it as the follow camera pulls back
//   traffic_pass — one for a moving car that is about to sweep past the
//                  listener, positional so it crosses the frame's stereo field
//   siren_police — a loop on every on-duty cruiser in earshot (M7.T5)
//   horn         — E behind the wheel, flat on the effects bus with the engine
//
// `vehicleSounds(pose)` is the whole decision as pure data, so a check can list
// what plays per pose with no browser and no AudioContext (M7-1's "lists playing
// sounds per pose"). `createVehicles(audio, buffers)` turns that list into one
// engine loop plus a one-shot per pass, and `honk()` is the horn; the E key is
// the input layer's one line (`if (k === 'e' && driving) vehicles.honk()`).
// Missing buffers decode on demand (music.js's offline pattern) and are listed
// but unheard until they land, so the frame never blocks on a fetch.
import { CAR_TOP } from '../sim/vehicle.js';

export const ENGINE = 'engine_loop';
export const PASS = 'traffic_pass';
export const SIREN = 'siren_police';
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

// Siren gain falls with the square of the distance still inside the earshot.
export const SIREN_EARSHOT = 140;
export const SIREN_GAIN = 0.7;
const SIREN_Y = 1.5;

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

// One looping siren per on-duty cruiser in earshot; a `leaving` unit is silent.
export function sirenSounds(pose = {}) {
  const px = pose.px ?? pose.x ?? 0, pz = pose.pz ?? pose.z ?? 0;
  const units = pose.units ?? pose.pursuit ?? [];
  const out = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.active || u.leaving) continue;
    const x = u.x ?? 0, z = u.z ?? 0;
    const d2 = square(x - px) + square(z - pz);
    if (d2 > SIREN_EARSHOT * SIREN_EARSHOT) continue;
    const gain = round3(SIREN_GAIN * square(1 - Math.sqrt(d2) / SIREN_EARSHOT));
    out.push({
      key: i, name: SIREN, bus: EFFECTS_BUS, loop: true, flat: false, rate: 1,
      x: round2(x), y: SIREN_Y, z: round2(z), gain,
    });
  }
  return out;
}

// What plays at this pose: engine, passes, sirens, horn.
export function vehicleSounds(pose = {}) {
  const list = passSounds(pose);
  const engine = engineSound(pose);
  if (engine) list.unshift(engine);
  if (pose.horn) list.push(hornSound());
  return [...list, ...sirenSounds(pose)];
}

// The files the set needs, for whoever owns the AudioContext.
export const VEHICLE_FILES = {
  [ENGINE]: 'assets/sounds/engine_loop.mp3',
  [PASS]: 'assets/sounds/traffic_pass.mp3',
  [SIREN]: 'assets/sounds/siren_police.mp3',
  [HORN]: 'assets/sounds/horn.mp3',
};

export async function loadVehicles(context, base = '', names = Object.keys(VEHICLE_FILES)) {
  const buffers = {};
  await Promise.all(names.map(async (name) => {
    const path = VEHICLE_FILES[name];
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    buffers[name] = await context.decodeAudioData(await res.arrayBuffer());
  }));
  return buffers;
}

// A decode context that never reaches the speakers (engine.js owns the live
// one), so a sound can be decoded without a second audible graph.
let decoder = null;
function offlineContext() {
  if (decoder) return decoder;
  const Ctor = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
  if (!Ctor) throw new Error('no Web Audio to decode the vehicles');
  decoder = new Ctor(1, 1, 44100);
  return decoder;
}

// One engine loop, a one-shot per pass, a siren loop per on-duty unit; pose
// { driving, speed|car, cars, units, px, pz, horn } (`units` = wanted.pursuit).
// `buffers` is name -> decoded AudioBuffer; a missing one is decoded on demand
// and listed but unheard until it lands — a voice is claimed only with a real
// sound, since engine.js materialises a voice once and never again.
export function createVehicles(audio, buffers = {}) {
  let engine = null;
  let hornHeld = false;
  let hornQueued = false;
  const passing = new Set();
  const sirens = new Map();
  const loading = new Set();
  let error = null;

  async function ensure(name) {
    if (buffers[name] || loading.has(name) || !VEHICLE_FILES[name]) return;
    if (typeof audio.silent === 'function' && audio.silent()) return;
    loading.add(name);
    try {
      Object.assign(buffers, await loadVehicles(offlineContext(), '', [name]));
    } catch (err) {
      error = String((err && err.message) || err);
    }
    loading.delete(name);
  }

  function update(pose = {}) {
    const plan = vehicleSounds(pose);
    const spec = plan.find((s) => s.name === ENGINE) ?? null;
    if (spec) {
      if (engine) audio.update(engine, { gain: spec.gain, rate: spec.rate });
      else if (buffers[spec.name]) engine = audio.play(spec.name, buffers[spec.name], {
        bus: spec.bus, loop: true, flat: true, gain: spec.gain, rate: spec.rate,
      });
      else ensure(spec.name);
    } else if (engine) {
      audio.stop(engine);
      engine = null;
    }
    const live = new Set();
    for (const p of plan) {
      if (p.name !== PASS) continue;
      live.add(p.key);
      if (passing.has(p.key)) continue;
      if (buffers[p.name]) audio.play(p.name, buffers[p.name], {
        bus: p.bus, gain: p.gain, rate: p.rate, x: p.x, y: p.y, z: p.z,
      });
      else ensure(p.name);
    }
    passing.clear();
    for (const key of live) passing.add(key);
    for (const s of plan) {
      if (s.name !== SIREN) continue;
      const held = sirens.get(s.key);
      if (held) audio.update(held, { gain: s.gain, x: s.x, y: s.y, z: s.z });
      else if (buffers[s.name]) sirens.set(s.key, audio.play(s.name, buffers[s.name], {
        bus: s.bus, loop: true, gain: s.gain, x: s.x, y: s.y, z: s.z,
      }));
    }
    for (const [key, held] of sirens) {
      if (plan.some((p) => p.name === SIREN && p.key === key)) continue;
      audio.stop(held);
      sirens.delete(key);
    }
    // A held E honks once per press — but not into the void: if the buffer is
    // still decoding on the first drive, the press stays queued and fires the
    // moment the sound exists, so a captain's first tap is never swallowed.
    if (pose.horn && !hornHeld) hornQueued = true;
    if (hornQueued) {
      const s = hornSound();
      if (buffers[s.name]) {
        audio.play(s.name, buffers[s.name], {
          bus: s.bus, flat: s.flat, gain: s.gain, rate: s.rate,
        });
        hornQueued = false;
      } else ensure(s.name);
    }
    hornHeld = !!pose.horn;
    return plan;
  }

  function horn() {
    const s = hornSound();
    if (!buffers[s.name]) { ensure(s.name); return null; }
    return audio.play(s.name, buffers[s.name], {
      bus: s.bus, flat: s.flat, gain: s.gain, rate: s.rate,
    });
  }

  function stop() {
    if (engine) audio.stop(engine);
    engine = null;
    passing.clear();
    for (const held of sirens.values()) audio.stop(held);
    sirens.clear();
    hornHeld = false;
    hornQueued = false;
  }

  return { update, honk: horn, stop, plan: vehicleSounds, buffers, error: () => error };
}
