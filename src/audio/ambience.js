// Street ambience (M7.T3): the city's own voice, under everything else.
//
// Two looping beds ride the ambience bus, flat and unpanned — one for the
// street the player stands on and one for the district around it. Both files
// are pinned in CREDITS.md (M7.T2); this module only decides how loud each sits:
//
//   ambience_street — the crowd: rises with the walkers out near the player
//   hum_district    — the traffic: rises with the commute flow and nearby cars
//
// `ambienceSounds(pose)` is the whole decision as pure data, so a check can
// list what plays per pose with no browser and no AudioContext (the criterion's
// "lists playing sounds per pose"). `createAmbience(audio)` turns that list into
// two voices on engine.js and moves only their gain and rate after.
import { nightOf } from '../sim/clock.js';
import { shareOut } from '../sim/commute.js';

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

const square = (v) => v * v;
const frac01 = (n, full) => Math.min(1, n / full);
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
//   commute the flow 0..1, defaulting to the sim's own shareOut(hour).
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
  return [
    {
      name: BEDS.street, bus: AMBIENCE_BUS, loop: true, flat: true, rate: mix.rate,
      gain: round3(STREET_LEVEL * mix.street * hourMix * (CROWD_FLOOR + (1 - CROWD_FLOOR) * crowd)),
    },
    {
      name: BEDS.hum, bus: AMBIENCE_BUS, loop: true, flat: true, rate: 1,
      gain: round3(HUM_LEVEL * mix.hum * flow * (FLOW_FLOOR + (1 - FLOW_FLOOR) * traffic)),
    },
  ];
}

// The two files the beds need, for whoever owns the AudioContext.
export const AMBIENCE_FILES = {
  [BEDS.street]: 'assets/sounds/ambience_street.mp3',
  [BEDS.hum]: 'assets/sounds/hum_district.mp3',
};

export async function loadAmbience(context, base = '') {
  const buffers = {};
  await Promise.all(Object.entries(AMBIENCE_FILES).map(async ([name, path]) => {
    const res = await fetch(base + path);
    buffers[name] = await context.decodeAudioData(await res.arrayBuffer());
  }));
  return buffers;
}

// Two voices for the life of the game: the beds are created on the first
// update and only their gain and rate move after. `buffers` is name -> decoded
// AudioBuffer (see loadAmbience); a missing buffer still lists, it just cannot
// be heard until the caller loads the set.
export function createAmbience(audio, buffers = {}) {
  let beds = null;

  function update(pose = {}) {
    const plan = ambienceSounds(pose);
    if (!beds) {
      beds = plan.map((s) => audio.play(s.name, buffers[s.name] ?? null, {
        bus: s.bus, loop: s.loop, flat: s.flat, gain: s.gain, rate: s.rate,
      }));
      return plan;
    }
    plan.forEach((s, i) => audio.update(beds[i], { gain: s.gain, rate: s.rate }));
    return plan;
  }

  function stop() {
    if (!beds) return;
    for (const bed of beds) audio.stop(bed);
    beds = null;
  }

  return { update, stop, plan: ambienceSounds };
}
