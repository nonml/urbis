// The save on disk: localStorage, and the only file that touches it. Every call
// is wrapped, because a denied or full store must cost the player a save, never
// the game. The format is src/sim/save.js's; this file only carries it.
const KEY = 'urbis.save';

export function loadSave() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
