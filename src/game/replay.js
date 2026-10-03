// Record and replay (M0.T2, criterion M0-1). The fixed step (loop.js) gives the
// sim a whole-step timeline; these tools ride it without touching the sim.
//
// ?record=1 stamps every key and mouse event with the step count it landed on
// and hands the log to __game.inputLog(). ?replay=<name> loads
// tests/replays/<name>.json and dispatches each event just before the step it
// was recorded at. Both runs therefore feed the same input on the same world,
// whatever the frame rate did — a move event between two frames is stamped with
// the steps already run, and replay puts it back in the same place.
//
// DOM is allowed here (src/game/, not src/sim/): a replay goes through the same
// window listeners play uses, never by poking the key set or the sim.
//
// The log is JSON: { seed, steps, events: [{ step, type, target, ... }] }, where
// `steps` is how many fixed steps had run when it was captured. A replay stops
// at that step, so two runs can compare state at the same point in game time.

const REPLAY_DIR = 'tests/replays/';
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

// ---- record ----

// `stepOf()` is how many fixed steps have run. `record` is called from capture
// listeners, so an event is stored even if a game listener stops propagation.
export function createRecorder(stepOf) {
  const events = [];
  return {
    record(type, props, target) {
      events.push({ step: stepOf(), type, target, ...props });
    },
    log(seed) {
      return { seed, steps: stepOf(), events: events.map((e) => ({ ...e })) };
    },
  };
}

// One listener per event kind the game reads. Keys land on window, pointer and
// wheel on the canvas: those are the targets play listens to, and the target is
// kept so a replay can put the event back where it was.
export function bindRecorder(recorder, canvas) {
  const key = (type) => (e) => recorder.record(type, { key: e.key }, 'window');
  const point = (type) => (e) => recorder.record(type, { x: e.clientX, y: e.clientY, button: e.button }, 'window');
  window.addEventListener('keydown', key('keydown'), true);
  window.addEventListener('keyup', key('keyup'), true);
  window.addEventListener('pointermove', point('pointermove'), true);
  window.addEventListener('pointerup', point('pointerup'), true);
  canvas.addEventListener('pointerdown', (e) => {
    recorder.record('pointerdown', { x: e.clientX, y: e.clientY, button: e.button }, 'canvas');
  }, true);
  canvas.addEventListener('wheel', (e) => {
    recorder.record('wheel', { x: e.clientX, y: e.clientY, deltaY: e.deltaY }, 'canvas');
  }, true);
}

// ---- replay ----

export async function loadReplay(name) {
  const res = await fetch(`${REPLAY_DIR}${encodeURIComponent(name)}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`replay ${name}: HTTP ${res.status}`);
  return res.json();
}

// Events are fed by step, not by frame: `feed(step)` dispatches everything
// stamped at or before `step` and is called just before the step at that index
// runs — the moment the event landed in the record. `end` is the step the run
// must stop on, so a replay and its recording can be hashed at the same point
// in game time.
export function createReplay(log, canvas) {
  const events = [...(log.events ?? [])].sort((a, b) => a.step - b.step);
  let i = 0;
  return {
    end: Number.isFinite(log.steps) ? log.steps : Infinity,
    feed(step) {
      while (i < events.length && events[i].step <= step) {
        dispatch(events[i], canvas);
        i += 1;
      }
    },
  };
}

const BASE = { bubbles: true, cancelable: true, composed: true };

function dispatch(e, canvas) {
  const target = e.target === 'canvas' ? canvas : window;
  if (e.type === 'keydown' || e.type === 'keyup') {
    target.dispatchEvent(new KeyboardEvent(e.type, { ...BASE, key: e.key }));
  } else if (e.type === 'wheel') {
    target.dispatchEvent(new WheelEvent('wheel', { ...BASE, clientX: e.x, clientY: e.y, deltaY: e.deltaY }));
  } else {
    target.dispatchEvent(new PointerEvent(e.type, {
      ...BASE, clientX: e.x, clientY: e.y, button: e.button ?? 0,
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
    }));
  }
}

// ---- state hash ----

// A canonical scalar walk of the sim state, folded with FNV-1a. Keys are sorted
// so object construction order cannot change the hash; `prev` snapshots are
// render-only (loop.js) and skipped; functions (an RNG stream handle) are not
// state a comparison can hold.
function walk(value, out, depth) {
  if (depth > 6) return;
  if (value === null || value === undefined) { out.push('n'); return; }
  const type = typeof value;
  if (type === 'number') { out.push(value === 0 ? '0' : String(value)); return; }
  if (type === 'string') { out.push(`${value.length}:${value}`); return; }
  if (type === 'boolean') { out.push(`${value}`); return; }
  if (type === 'function') return;
  if (Array.isArray(value)) {
    out.push('[');
    for (const item of value) { walk(item, out, depth + 1); out.push(','); }
    out.push(']');
    return;
  }
  out.push('{');
  for (const key of Object.keys(value).sort()) {
    if (key === 'prev') continue;
    out.push(`${key}=`);
    walk(value[key], out, depth + 1);
    out.push(';');
  }
  out.push('}');
}

// `state` is { player, car, street, city, economy, people, wanted }: every part
// the M0-1 check names. Same shape and same sim steps give the same hex.
export function hashState(state) {
  const parts = [];
  for (const key of Object.keys(state).sort()) {
    parts.push(`${key}:`);
    walk(state[key], parts, 0);
  }
  let h = FNV_OFFSET;
  for (const ch of parts.join('')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, FNV_PRIME);
  }
  return (h >>> 0).toString(16);
}
