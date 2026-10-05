// Sites (M7.T6): the crane at every working lot near enough to hear.
//
// `crane_site` (M7.T2) loops at each lot the sim calls under construction —
// `p.building`, the flag render/zoning.js draws the crane from — so sound and
// jib rise, climb and stop together, and a blacked-out zone's site goes silent.
// One positional voice per lot, gain falling with the square of the distance
// inside earshot. `siteSounds(pose)` is the whole decision as pure data: a
// check can list what plays per pose with no browser and no AudioContext
// (M7-1); `createSites` makes that list one loop per site and decodes its own
// file (ambience.js's pattern), so a working lot is heard without the caller
// loading anything. A pose still lists what would play while the file lands.
export const CRANE = 'crane_site';
export const SITE_BUS = 'effects';

// Metres. A site across the block is a sound to notice, not one that follows.
export const SITE_EARSHOT = 80;
// Full level at the fence, silence at the earshot's edge.
export const SITE_GAIN = 0.55;
const SITE_Y = 1.2;
// Each lot's loop is detuned by its index: several loops of one short sample
// sharing a phase read as one broken voice, not as many cranes.
const RATE_SPREAD = 0.012;

const square = (v) => v * v;
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;

function working(p, dark) {
  if (!p.building) return false;
  if (!Array.isArray(dark)) return true;
  return !dark[p.powerZone];
}

// One crane loop per working lot in earshot. `pose`: parcels (or lots, or city)
// with x/z/powerZone/building; px/pz the listener; dark = [zone0, zone1] out,
// the list `__game.dark()` and a mission snapshot both return.
export function siteSounds(pose = {}) {
  const px = pose.px ?? pose.x ?? 0;
  const pz = pose.pz ?? pose.z ?? 0;
  const lots = pose.parcels ?? pose.lots ?? pose.city?.parcels ?? [];
  const dark = pose.dark ?? pose.darkZones ?? null;
  const out = [];
  for (let i = 0; i < lots.length; i++) {
    const p = lots[i];
    if (!working(p, dark)) continue;
    const x = p.x ?? 0, z = p.z ?? 0;
    const d2 = square(x - px) + square(z - pz);
    if (d2 > SITE_EARSHOT * SITE_EARSHOT) continue;
    const d = Math.sqrt(d2);
    out.push({
      key: i, name: CRANE, bus: SITE_BUS, loop: true, flat: false,
      x: round2(x), y: SITE_Y, z: round2(z),
      gain: round3(SITE_GAIN * square(1 - d / SITE_EARSHOT)),
      rate: round3(1 + ((i % 5) - 2) * RATE_SPREAD),
    });
  }
  return out;
}

// The file the set needs, for whoever owns the AudioContext.
export const SITE_FILES = { [CRANE]: 'assets/sounds/crane_site.mp3' };

export async function loadSites(context, base = '') {
  const buffers = {};
  await Promise.all(Object.entries(SITE_FILES).map(async ([name, path]) => {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    buffers[name] = await context.decodeAudioData(await res.arrayBuffer());
  }));
  return buffers;
}

// A decode context that never reaches the speakers (engine.js owns the live
// one), so the crane's file loads without a second audible graph.
let decoder = null;
function offlineContext() {
  if (decoder) return decoder;
  const Ctor = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
  if (!Ctor) throw new Error('no Web Audio to decode the sites');
  decoder = new Ctor(1, 1, 44100);
  return decoder;
}

// One loop per working lot in earshot; pose { parcels, px, pz, dark }.
// `buffers` is name -> decoded AudioBuffer; missing ones are decoded on demand,
// so a pose lists a site before its file lands and the first update after it
// arrives claims the voice. Nothing loads under `?capture=1`: the crew's
// screenshots never pay for a fetch.
export function createSites(audio, buffers = {}) {
  const decoded = { ...buffers };
  const held = new Map();
  let loading = false, error = null;

  async function load() {
    if (loading || decoded[CRANE]) return;
    if (typeof audio.silent === 'function' && audio.silent()) return;
    loading = true;
    try {
      Object.assign(decoded, await loadSites(offlineContext()));
    } catch (err) {
      error = String((err && err.message) || err);
    }
    loading = false;
  }

  function update(pose = {}) {
    const plan = siteSounds(pose);
    const live = new Set();
    for (const s of plan) {
      live.add(s.key);
      const voice = held.get(s.key);
      if (voice) audio.update(voice, { gain: s.gain, rate: s.rate, x: s.x, y: s.y, z: s.z });
      else if (decoded[s.name]) held.set(s.key, audio.play(s.name, decoded[s.name], {
        bus: s.bus, loop: true, gain: s.gain, rate: s.rate, x: s.x, y: s.y, z: s.z,
      }));
      else load();
    }
    for (const [key, voice] of held) {
      if (live.has(key)) continue;
      audio.stop(voice);
      held.delete(key);
    }
    return plan;
  }

  function stop() {
    for (const voice of held.values()) audio.stop(voice);
    held.clear();
  }

  return { update, stop, plan: siteSounds, buffers: decoded, error: () => error };
}
