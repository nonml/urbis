// The first hints (M7.T12, criterion M7-5): one line per key from
// content/hints.json, gone the moment the key is used. The list is content: a
// later milestone's close adds its keys to the JSON and this file stays put.
// State is per boot, so a fresh game teaches again and nothing is persisted.
import DEFS from '../../content/hints.json' with { type: 'json' };

const line = (def) => `${def.key.toUpperCase()} · ${def.text}`;

export function hintDefs() {
  return DEFS;
}

// A hint retires when its key is pressed; `retire` is on the returned object
// so a later task can hook the act itself instead of the keydown.
export function createHints() {
  const done = new Set();
  return {
    active: () => DEFS.filter((def) => !done.has(def.key)),
    retire: (key) => {
      const k = String(key).toLowerCase();
      if (done.has(k) || !DEFS.some((def) => def.key === k)) return false;
      done.add(k);
      return true;
    },
  };
}

// Fills `host` with the active lines, one per key not yet used.
export function installHints(host, win = globalThis.window) {
  const hints = createHints();
  const paint = () => { host.textContent = hints.active().map(line).join('    '); };
  win.addEventListener('keydown', (e) => {
    if (!e.repeat && hints.retire(e.key)) paint();
  });
  paint();
  return hints;
}
