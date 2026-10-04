// The audio engine (M7.T1). One Web Audio graph per page:
//
//   source -> voice gain -> voice panner -> (effects | ambience) -> master -> out
//
// Voices are a fixed pool, so a street full of sounds costs the same as one.
// The listener follows the game camera; the context is created and resumed on
// the player's first input (the browser's autoplay rule), and sounds asked for
// before that wait for it. `?capture=1` builds nothing audible unless the page
// asks with `?audio=1`; either way `sounds()` reports the logical list, so a
// probe can read what would play from a silent screenshot run.
//
// No three.js and no sim state in here: the caller hands over a camera whose
// matrixWorld is read, and buffers it loaded itself.

export const VOICE_POOL = 24;
const FIRST_INPUT = ['pointerdown', 'keydown', 'touchstart'];
const BUS_LEVELS = { effects: 0.85, ambience: 0.6 };
const FADE = 0.03;
const SMOOTH = 0.04;
const SILENT_RAMP = 0.08;
const REF_DISTANCE = 7;
const MAX_DISTANCE = 180;
const ROLLOFF = 1.15;

export function createAudioEngine({ silent = false } = {}) {
  const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  const buses = new Map();
  const voices = [];
  const active = [];
  const pending = [];
  let ctx = null, master = null, started = false, muted = silent, nextId = 1;

  function build() {
    if (ctx || !Ctor) return ctx;
    try { ctx = new Ctor(); } catch { return null; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    for (const [name, level] of Object.entries(BUS_LEVELS)) {
      const bus = ctx.createGain();
      bus.gain.value = level;
      bus.connect(master);
      buses.set(name, bus);
    }
    for (let i = 0; i < VOICE_POOL; i++) voices.push(newVoice());
    return ctx;
  }

  function newVoice() {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = REF_DISTANCE;
    panner.maxDistance = MAX_DISTANCE;
    panner.rolloffFactor = ROLLOFF;
    gain.connect(panner);
    return { gain, panner, src: null, entry: null };
  }

  // Created here, but resumed only by the first input: the autoplay rule can
  // leave a context built at load suspended forever, and a city that starts
  // itself is starting muted.
  function start() {
    started = true;
    const c = build();
    if (!c) return 'unavailable';
    c.resume().catch(() => {});
    while (pending.length) materialize(pending.shift());
    return c.state;
  }

  if (Ctor && !muted) {
    const first = () => {
      for (const type of FIRST_INPUT) window.removeEventListener(type, first);
      start();
    };
    for (const type of FIRST_INPUT) window.addEventListener(type, first, { passive: true });
  }

  function setSilent(on) {
    muted = !!on;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, SILENT_RAMP);
    return muted;
  }

  function setBus(name, value) {
    const bus = buses.get(name);
    if (bus) bus.gain.setTargetAtTime(value, ctx.currentTime, SILENT_RAMP);
    return !!bus;
  }

  // Everything a caller can hear and update. `flat` skips the panner for UI
  // sounds that belong to no place; the rest attenuate with listener distance.
  function play(name, buffer, opts = {}) {
    expire();
    const entry = {
      id: nextId++, name, buffer,
      bus: opts.bus === 'ambience' ? 'ambience' : 'effects',
      gain: opts.gain ?? 1, rate: opts.rate ?? 1, loop: !!opts.loop, flat: !!opts.flat,
      x: 0, y: 0, z: 0, voice: null, src: null, startedAt: null, endsAt: Infinity,
    };
    place(entry, opts);
    active.push(entry);
    if (started) materialize(entry);
    else pending.push(entry);
    return entry;
  }

  function materialize(entry) {
    if (entry.src) return;
    const c = build();
    if (!c) return;
    const voice = claim();
    if (!voice) return;
    entry.voice = voice;
    voice.entry = entry;
    voice.gain.disconnect();
    voice.panner.disconnect();
    voice.gain.connect(entry.flat ? buses.get(entry.bus) : voice.panner);
    if (!entry.flat) voice.panner.connect(buses.get(entry.bus));
    const src = c.createBufferSource();
    src.buffer = entry.buffer;
    src.loop = entry.loop;
    src.playbackRate.value = entry.rate;
    src.connect(voice.gain);
    entry.src = src;
    const t = c.currentTime;
    entry.startedAt = t;
    if (!entry.loop && entry.buffer?.duration) entry.endsAt = t + entry.buffer.duration / entry.rate;
    src.onended = () => { if (entry.src === src) release(entry); };
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(0, t);
    voice.gain.gain.linearRampToValueAtTime(entry.gain, t + FADE);
    src.start(t);
    setPanner(voice.panner, entry.x, entry.y, entry.z);
  }

  function release(entry) {
    for (const list of [active, pending]) {
      const i = list.indexOf(entry);
      if (i >= 0) list.splice(i, 1);
    }
    const voice = entry.voice;
    entry.voice = null;
    if (!voice || voice.entry !== entry) return;
    voice.entry = null;
    const src = entry.src;
    entry.src = null;
    if (!ctx) return;
    const t = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setTargetAtTime(0, t, FADE);
    if (src) try { src.stop(t + FADE * 4); } catch { src.disconnect(); }
  }

  // The pool is bounded; the oldest one-shot yields first, then the oldest
  // loop. A pending entry can be claimed too — it has no sound to cut.
  function claim() {
    const free = voices.find((v) => !v.entry);
    if (free) return free;
    const victim = active.find((e) => !e.loop) ?? active[0] ?? pending[0];
    if (victim) release(victim);
    return voices.find((v) => !v.entry) ?? null;
  }

  function expire() {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const e of [...active]) if (now >= e.endsAt) release(e);
    for (const e of [...pending]) if (now >= e.endsAt) release(e);
  }

  function update(entry, patch = {}) {
    if (patch.gain !== undefined) entry.gain = patch.gain;
    if (patch.rate !== undefined) entry.rate = patch.rate;
    place(entry, patch);
    if (!entry.voice || !ctx) return entry;
    const t = ctx.currentTime;
    if (patch.gain !== undefined) entry.voice.gain.gain.setTargetAtTime(entry.gain, t, SMOOTH);
    if (patch.rate !== undefined && entry.src) entry.src.playbackRate.setTargetAtTime(entry.rate, t, SMOOTH);
    return entry;
  }

  function place(entry, p) {
    entry.x = p.x ?? entry.x;
    entry.y = p.y ?? entry.y;
    entry.z = p.z ?? entry.z;
    if (entry.voice) setPanner(entry.voice.panner, entry.x, entry.y, entry.z);
  }

  // The camera's world matrix: columns are right, up and back, so forward is
  // -back. One frame of lag is inaudible; the follow cam is written after the
  // scene update in the loop.
  function follow(camera) {
    expire();
    if (!ctx) return;
    const m = camera.matrixWorld.elements;
    const l = ctx.listener;
    if (l.positionX) {
      l.positionX.value = m[12]; l.positionY.value = m[13]; l.positionZ.value = m[14];
      l.forwardX.value = -m[8]; l.forwardY.value = -m[9]; l.forwardZ.value = -m[10];
      l.upX.value = m[4]; l.upY.value = m[5]; l.upZ.value = m[6];
    } else {
      l.setPosition(m[12], m[13], m[14]);
      l.setOrientation(-m[8], -m[9], -m[10], m[4], m[5], m[6]);
    }
  }

  function setPanner(panner, x, y, z) {
    if (panner.positionX) {
      panner.positionX.value = x; panner.positionY.value = y; panner.positionZ.value = z;
    } else {
      panner.setPosition(x, y, z);
    }
  }

  function sounds() {
    expire();
    return active.map((e) => ({
      name: e.name, bus: e.bus, gain: +e.gain.toFixed(3), rate: +e.rate.toFixed(3),
      loop: e.loop, pos: e.flat ? null : [+e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)],
    }));
  }

  function stopAll() {
    for (const e of [...active]) release(e);
    pending.length = 0;
  }

  return {
    start, setSilent, setBus, follow, play, update, stop: release, stopAll, sounds,
    silent: () => muted,
    state: () => (ctx ? ctx.state : started ? 'unavailable' : 'waiting'),
  };
}
