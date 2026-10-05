// Street ambience (M7.T3): the city's own voice, under everything else.
//
// Two looping beds ride the ambience bus, flat and unpanned — one for the
// street the player stands on and one for the district around it. Both files
// are pinned in CREDITS.md (M7.T2); this module only decides how loud each sits:
//
//   ambience_street — the crowd: rises with the walkers out near the player
//   hum_district    — the traffic: rises with the commute flow and nearby cars
//
// An M7.T7 blackout kills both beds for the listener's zone: the district's
// voice dies with its lamps and comes back when street.js restores them. The
// other zone keeps humming — one hack, one side of the avenue (`zonePower`).
//
// `ambienceSounds(pose)` is the whole decision as pure data, so a check can
// list what plays per pose with no browser and no AudioContext (the criterion's
// "lists playing sounds per pose"). `createAmbience(audio)` turns that list into
// two voices on engine.js and moves only their gain and rate after.
import { nightOf } from '../sim/clock.js';
import { shareOut } from '../sim/commute.js';
import { zoneAt } from '../sim/street.js';

export const BEDS = { street: 'ambience_street', hum: 'hum_district' };
export const AMBIENCE_BUS = 'ambience';

// Both beds sit under the effects; ambience is the floor, not a feature.
const STREET_LEVEL = 0.5;
const HUM_LEVEL = 0.34;

// District kind changes the mix, not the set of sounds. Residential is crowds
// over a little hum; industrial is mostly hum; downtown is the fallback where
// the city says nothing — open ground and unzoned lots.
export const KIND_MIX = {
  res: { street: 1, hum: 0.6, rate: 1 },
  com: { street: 0.9, hum: 1, rate: 1.02 },
  ind: { street: 0.55, hum: 1.35, rate: 0.92 },
  downtown: { street: 0.85, hum: 0.85, rate: 1 },
};

// A walker is heard this close, a moving car this close; the count that fills
// each bed is the most the sim could put in earshot. The floors keep the bed
// alive in the gaps between passers-by, so the street never sounds switched off.
export const CROWD_RADIUS = 24;
export const CROWD_FULL = 7;
export const CROWD_FLOOR = 0.3;
export const TRAFFIC_RADIUS = 60;
export const CARS_FULL = 6;
const FLOW_FLOOR = 0.25;
// Night is quieter but not silent: the city keeps breathing after dark.
const NIGHT_FLOOR = 0.45;

// What a zone's power does to its beds: the same 0.5 street.js's zoneGlow gives
// the lamps mid-collapse, so sound and light cross the threshold together.
const PHASE_POWER = { lit: 1, dying: 0.5, dark: 0, restoring: 0.5 };

const square = (v) => v * v;
const frac01 = (n, full) => Math.min(1, n / full);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round3 = (v) => Math.round(v * 1000) / 1000;

// The kind of district at a point: the nearest grown lot's use, or `downtown`
// while the lots around a point are unzoned or absent.
export function kindAt(city, x = 0, z = 0) {
  let best = null;
  let bestD = Infinity;
  for (const p of city?.parcels ?? []) {
    const d = square(p.x - x) + square(p.z - z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best && KIND_MIX[best.use] ? best.use : 'downtown';
}

// How much of the district's voice survives at the listener's zone (M7.T7).
// `dark` is the [zone0, zone1] pair `__game.dark()` returns and sites.js reads;
// `phase` is street.js's zonePhase, so a caller that has the live collapse lets
// the hum fade through it; `glow` is zoneGlow per zone — the light the lamps
// actually show — and wins, so sound crosses the threshold with the light. Any
// of the three may sit in a probe's `lights` object. `zone` picks the zone
// outright; a pose with none of them is lit.
export function zonePower(pose = {}, pz = 0) {
  const zone = pose.zone ?? zoneAt(pz);
  const lights = pose.lights ?? {};
  const at = (v) => (Array.isArray(v) ? v[zone] : v);
  const glow = at(pose.glow ?? lights.glow);
  if (typeof glow === 'number') return clamp01(glow);
  const phase = at(pose.phase ?? pose.phases ?? lights.phase);
  if (PHASE_POWER[phase] !== undefined) return PHASE_POWER[phase];
  const dark = pose.dark ?? pose.darkZones ?? lights.dark;
  if (dark === undefined || dark === null) return 1;
  return at(dark) ? 0 : 1;
}

function countNear(list, x, z, r2, keep) {
  let n = 0;
  for (const o of list ?? []) {
    if (keep(o) && square(o.x - x) + square(o.z - z) <= r2) n += 1;
  }
  return n;
}

// What plays at this pose, as two loops with a gain each. `pose` may carry:
//   hour 0..24; walkers street.npcs; cars street.cars; px/pz the listener;
//   kind 'res' | 'com' | 'ind' | 'downtown' (or city/px/pz to derive it);
//   commute the flow 0..1, defaulting to the sim's own shareOut(hour);
//   dark [zone0, zone1] out, or phase/glow per zone (M7.T7).
export function ambienceSounds(pose = {}) {
  const hour = (((pose.hour ?? pose.clock?.hour ?? 12) % 24) + 24) % 24;
  const px = pose.px ?? pose.x ?? 0;
  const pz = pose.pz ?? pose.z ?? 0;
  const named = pose.kind ?? pose.districtKind;
  const mix = KIND_MIX[named] ?? KIND_MIX[kindAt(pose.city, px, pz)];
  const flow = pose.commute ?? shareOut(hour);
  const crowd = frac01(countNear(pose.walkers, px, pz, square(CROWD_RADIUS), (n) => n.out !== false), CROWD_FULL);
  const traffic = frac01(countNear(pose.cars, px, pz, square(TRAFFIC_RADIUS), (c) => !c.parked), CARS_FULL);
  const hourMix = NIGHT_FLOOR + (1 - NIGHT_FLOOR) * (1 - nightOf(hour));
  const power = zonePower(pose, pz);
  return [
    {
      name: BEDS.street, bus: AMBIENCE_BUS, loop: true, flat: true, rate: mix.rate,
      gain: round3(power * STREET_LEVEL * mix.street * hourMix * (CROWD_FLOOR + (1 - CROWD_FLOOR) * crowd)),
    },
    {
      name: BEDS.hum, bus: AMBIENCE_BUS, loop: true, flat: true, rate: 1,
      gain: round3(power * HUM_LEVEL * mix.hum * flow * (FLOW_FLOOR + (1 - FLOW_FLOOR) * traffic)),
    },
  ];
}

// The two files the beds need: for a caller that owns an AudioContext, or for
// createAmbience's own decode below.
export const AMBIENCE_FILES = {
  [BEDS.street]: 'assets/sounds/ambience_street.mp3',
  [BEDS.hum]: 'assets/sounds/hum_district.mp3',
};

export async function loadAmbience(context, base = '') {
  const buffers = {};
  await Promise.all(Object.entries(AMBIENCE_FILES).map(async ([name, path]) => {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    buffers[name] = await context.decodeAudioData(await res.arrayBuffer());
  }));
  return buffers;
}

// A decode context that never reaches the speakers. engine.js owns the live
// context and hands out no way to decode against it, and an AudioBuffer is not
// bound to the context that decoded it, so this is how the beds load without a
// second audible graph.
let decoder = null;
function offlineContext() {
  if (decoder) return decoder;
  const Ctor = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
  if (!Ctor) throw new Error('no Web Audio to decode the ambience');
  decoder = new Ctor(1, 1, 44100);
  return decoder;
}

// Two voices for the life of the game: the beds are created the first update
// after their buffers land, and only their gain and rate move after. `buffers`
// lets a caller or a test hand over decoded AudioBuffers; left out, the module
// decodes its own files, and a pose still lists what would play while they load.
// Nothing loads under `?capture=1`: the crew's screenshots never pay for a fetch.
export function createAmbience(audio, buffers = {}) {
  const decoded = { ...buffers };
  let beds = null, loading = false, error = null;

  async function load() {
    if (loading || (decoded[BEDS.street] && decoded[BEDS.hum])) return;
    if (typeof audio.silent === 'function' && audio.silent()) return;
    loading = true;
    try {
      Object.assign(decoded, await loadAmbience(offlineContext()));
    } catch (err) {
      error = String((err && err.message) || err);
    }
    loading = false;
  }

  function update(pose = {}) {
    const plan = ambienceSounds(pose);
    if (!beds && decoded[BEDS.street] && decoded[BEDS.hum]) {
      beds = plan.map((s) => audio.play(s.name, decoded[s.name], {
        bus: s.bus, loop: s.loop, flat: s.flat, gain: s.gain, rate: s.rate,
      }));
      return plan;
    }
    if (beds) plan.forEach((s, i) => audio.update(beds[i], { gain: s.gain, rate: s.rate }));
    return plan;
  }

  function stop() {
    if (!beds) return;
    for (const bed of beds) audio.stop(bed);
    beds = null;
  }

  load();
  return { update, stop, plan: ambienceSounds, state: () => ({ beds: !!beds, loading, error }) };
}
