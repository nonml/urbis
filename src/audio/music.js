// Music (M7.T17, criterion M7-10): the title theme and the score under the arc.
//
// Every track is CC0, pinned to its sha256 in tools/sounds/fetch.sh and listed
// in CREDITS.md (M7.T2's rule): `m7-music.spec.js` hashes the committed bytes.
// The title theme plays at the front door. Under an arc mission the score plays
// — calm, and urgent while wanted.js has the suspect in contact; losing the
// trail settles it back to calm. The two radio beds are fetched here for
// M7.T18's car radio.
//
// `musicPlan(pose)` is the whole decision as pure data, so a check can list the
// playing tracks per pose with no browser and no AudioContext (M7-10). The pose
// carries the sim's own objects:
//
//   { scene: 'title' }                      the title theme, looping
//   { mission }                             calm score under the arc's mission
//   { mission, wanted: { heat, contact } }  urgent while the chase holds
//   { scene: 'play' }                       silence
//
// `createMusic(audio)` turns that list into one looping bed; `isChase(pose)` is
// the wanted.js reading — heat above zero *and* a unit in contact.
export const TITLE = 'music_title';
export const SCORE_CALM = 'music_calm';
export const SCORE_URGENT = 'music_urgent';
export const RADIO_A = 'music_radio_a';
export const RADIO_B = 'music_radio_b';

// Music is not an effect: it rides the ambience bus, under the street.
export const MUSIC_BUS = 'ambience';
export const STATIONS = [RADIO_A, RADIO_B];

// The title sits over the front door, the score under a mission. Both are beds,
// not features; urgency lifts the score, it does not push the mix.
export const TITLE_GAIN = 0.5;
export const CALM_GAIN = 0.34;
export const URGENT_GAIN = 0.5;

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

// What plays at this pose: the title theme, the mission score (urgent while
// wanted.js holds contact), or nothing.
export function musicPlan(pose = {}) {
  if (pose.scene === 'title' || pose.title) return [track(TITLE, TITLE_GAIN)];
  if (!missionOf(pose)) return [];
  const urgent = isChase(pose);
  return [track(urgent ? SCORE_URGENT : SCORE_CALM, urgent ? URGENT_GAIN : CALM_GAIN)];
}

// The files the set needs, for whoever owns the AudioContext.
export const MUSIC_FILES = {
  [TITLE]: 'assets/music/music_title.mp3',
  [SCORE_CALM]: 'assets/music/music_calm.mp3',
  [SCORE_URGENT]: 'assets/music/music_urgent.mp3',
  [RADIO_A]: 'assets/music/music_radio_a.mp3',
  [RADIO_B]: 'assets/music/music_radio_b.mp3',
};

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
// listed but unheard until it lands, so no frame ever blocks on a fetch.
export function createMusic(audio, buffers = {}) {
  const decoded = { ...buffers };
  const loading = new Set();
  let current = null, error = null;

  async function ensure(name) {
    if (decoded[name] || loading.has(name) || !MUSIC_FILES[name]) return;
    loading.add(name);
    try {
      Object.assign(decoded, await loadMusic(offlineContext(), [name]));
    } catch (err) {
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
