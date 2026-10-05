// Music (M7.T17-M7.T18, criterion M7-10): the title theme, the score under the
// arc, and the car's radio.
//
// Every track is CC0, pinned to its sha256 in tools/sounds/fetch.sh and listed
// in CREDITS.md (M7.T2's rule): `m7-music.spec.js` hashes the committed bytes.
// The title theme plays at the front door. Under an arc mission the score plays
// — calm, and urgent while wanted.js has the suspect in contact; losing the
// trail settles it back to calm. B in a car steps the radio off -> station A ->
// station B -> off; a tuned station is a live bed, so it keeps its place while
// the player is on foot and getting back in finds it later in the track.
//
// `musicPlan(pose)` is the whole decision as pure data, so a check can list the
// playing tracks per pose with no browser and no AudioContext (M7-10). The pose
// carries the sim's own objects:
//
//   { scene: 'title' }                      the title theme, looping
//   { mission }                             calm score under the arc's mission
//   { mission, wanted: { heat, contact } }  urgent while the chase holds
//   { driving, radio }                      the car's station (silent on foot)
//   { scene: 'play' }                       silence
//
// `createMusic(audio)` turns that list into one looping bed; `isChase(pose)` is
// the wanted.js reading — heat above zero *and* a unit in contact.
export const TITLE = 'music_title';
export const SCORE_CALM = 'music_calm';
export const SCORE_URGENT = 'music_urgent';
export const RADIO_A = 'music_radio_a';
export const RADIO_B = 'music_radio_b';

// The files the set needs, for whoever owns the AudioContext.
export const MUSIC_FILES = {
  [TITLE]: 'assets/music/music_title.mp3',
  [SCORE_CALM]: 'assets/music/music_calm.mp3',
  [SCORE_URGENT]: 'assets/music/music_urgent.mp3',
  [RADIO_A]: 'assets/music/music_radio_a.mp3',
  [RADIO_B]: 'assets/music/music_radio_b.mp3',
};

// Music is not an effect: it rides the ambience bus, under the street.
export const MUSIC_BUS = 'ambience';
// The stations the set actually ships (M7.T18): two when CC0 filled two, one
// when it could only fill one.
export const STATIONS = [RADIO_A, RADIO_B].filter((name) => MUSIC_FILES[name]);

// B's one line (input.js): off -> the first station -> the next -> off. The
// step is built from the stations handed in, so a set CC0 only filled with one
// station cycles that one and off (M7.T18).
export function cycleRadio(station = null, stations = STATIONS) {
  const i = stations.indexOf(station);
  return i + 1 < stations.length ? stations[i + 1] : null;
}

// The title sits over the front door, the score under a mission. Both are beds,
// not features; urgency lifts the score, it does not push the mix.
export const TITLE_GAIN = 0.5;
export const CALM_GAIN = 0.34;
export const URGENT_GAIN = 0.5;
// The radio is the car's own bed, a touch under the story's score.
export const RADIO_GAIN = 0.4;

// The score is what plays under the arc; a mission object is the whole switch.
export function missionOf(pose = {}) {
  return pose.mission ?? pose.arc?.mission ?? null;
}

// A chase is wanted.js's own pair: heat above zero and a unit in contact. Heat
// with no contact is a search; a lost trail is not urgency.
export function isChase(pose = {}) {
  const w = pose.wanted;
  if (w && typeof w === 'object') return w.heat > 0 && !!w.contact;
  return !!pose.chase;
}

function track(name, gain) {
  return { name, bus: MUSIC_BUS, loop: true, flat: true, gain, rate: 1 };
}

// The station a pose's radio is tuned to: a station name, its index in
// STATIONS, or `{ station }`, the shape input.js keeps. Anything else is off.
function stationOf(radio) {
  const value = radio !== null && typeof radio === 'object' ? radio.station : radio;
  if (STATIONS.includes(value)) return value;
  return Number.isInteger(value) ? STATIONS[value] ?? null : null;
}

// The car radio (M7.T18): a tuned station is the car's bed while driving. On
// foot the same loop is listed at silence, so its place in the track carries
// across getting out and back in; the title and the mission score cut it.
function radioTrack(pose) {
  const name = stationOf(pose.radio);
  if (!name) return null;
  const inCar = !!(pose.driving ?? pose.inCar);
  return track(name, inCar ? RADIO_GAIN : 0);
}

// What plays at this pose: the title theme, the mission score (urgent while
// wanted.js holds contact), the car's radio, or nothing. The score outranks the
// radio — a mission cuts the station, and it comes back after (M7.T17's score
// is the arc's; M28-3 settles scenes and radio) — and the title outranks both.
export function musicPlan(pose = {}) {
  if (pose.scene === 'title' || pose.title) return [track(TITLE, TITLE_GAIN)];
  if (missionOf(pose)) {
    const urgent = isChase(pose);
    return [track(urgent ? SCORE_URGENT : SCORE_CALM, urgent ? URGENT_GAIN : CALM_GAIN)];
  }
  const radio = radioTrack(pose);
  return radio ? [radio] : [];
}

export async function loadMusic(context, names = Object.keys(MUSIC_FILES), base = '') {
  const buffers = {};
  await Promise.all(names.map(async (name) => {
    const path = MUSIC_FILES[name];
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    buffers[name] = await context.decodeAudioData(await res.arrayBuffer());
  }));
  return buffers;
}

// A decode context that never reaches the speakers (engine.js owns the live
// one), so a track can be decoded without a second audible graph.
let decoder = null;
function offlineContext() {
  if (decoder) return decoder;
  const Ctor = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
  if (!Ctor) throw new Error('no Web Audio to decode the music');
  decoder = new Ctor(1, 1, 44100);
  return decoder;
}

// One looping bed at a time: the first update a pose asks for a track it is
// decoded, and a later pose that wants another swaps it — start the new voice,
// release the old, both fades owning in engine.js. A track not decoded yet is
// listed but unheard until it lands, so no frame ever blocks on a fetch; a
// track that fails to decode is not fetched again this run.
export function createMusic(audio, buffers = {}) {
  const decoded = { ...buffers };
  const loading = new Set();
  const failed = new Set();
  let current = null, error = null;

  async function ensure(name) {
    if (decoded[name] || loading.has(name) || failed.has(name) || !MUSIC_FILES[name]) return;
    loading.add(name);
    try {
      Object.assign(decoded, await loadMusic(offlineContext(), [name]));
    } catch (err) {
      failed.add(name);
      error = String((err && err.message) || err);
    }
    loading.delete(name);
  }

  function stop() {
    if (!current) return;
    audio.stop(current);
    current = null;
  }

  function update(pose = {}) {
    const plan = musicPlan(pose);
    const spec = plan[0] ?? null;
    if (!spec) { stop(); return plan; }
    if (current && current.name !== spec.name) stop();
    if (current) audio.update(current, { gain: spec.gain, rate: spec.rate });
    else if (decoded[spec.name]) current = audio.play(spec.name, decoded[spec.name], {
      bus: spec.bus, loop: spec.loop, flat: spec.flat, gain: spec.gain, rate: spec.rate,
    });
    else ensure(spec.name);
    return plan;
  }

  return {
    update, stop, plan: musicPlan,
    state: () => ({ playing: current?.name ?? null, loading: [...loading], error }),
  };
}
