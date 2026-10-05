// The saves on disk: localStorage, and the only file that touches them. Three
// slots; every call is wrapped, because a denied or full store must cost the
// player a save, never the game. The game JSON in a slot is src/sim/save.js's
// format; the time it was written lives beside it.
//
// Slot 1 is the old 'urbis.save' key, so a save written before slots is
// already in slot 1. 'urbis.slot' names the active slot: loadSave() reads it
// and writeSave() writes it, so an autosave lands in the city that made it.
// The title's Continue hands a slot to the next boot ('urbis.nextslot') rather
// than switching before the reload, so the outgoing page's last autosave still
// lands in the slot it came from.
export const SLOT_COUNT = 3;

const KEY = 'urbis.save';
const ACTIVE_KEY = 'urbis.slot';
const NEXT_KEY = 'urbis.nextslot';
const slotKey = (slot) => (slot === 1 ? KEY : `${KEY}.${slot}`);
const savedAtKey = (slot) => `urbis.savedat.${slot}`;

const clampSlot = (n) => (Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT ? n : 1);

export function activeSlot() {
  try {
    return clampSlot(Number(localStorage.getItem(ACTIVE_KEY)));
  } catch {
    return 1;
  }
}

export function setActiveSlot(slot) {
  const n = clampSlot(slot);
  try {
    localStorage.setItem(ACTIVE_KEY, String(n));
  } catch { /* a named slot costs nothing */ }
  return n;
}

// The slot the next boot should load, left by the title screen's Continue when
// it points at another slot. readSlot handoff consumes it; the outgoing page's
// autosave never sees it, so it cannot write this city over that slot's save.
export function handoffSlot(slot) {
  const n = clampSlot(slot);
  try {
    localStorage.setItem(NEXT_KEY, String(n));
  } catch { /* the handoff is optional; a failed one just reloads the same slot */ }
  return n;
}

function takeHandoff() {
  try {
    const raw = localStorage.getItem(NEXT_KEY);
    if (raw === null) return null;
    localStorage.removeItem(NEXT_KEY);
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT ? n : null;
  } catch {
    return null;
  }
}

function readRaw(slot) {
  try {
    return localStorage.getItem(slotKey(slot));
  } catch {
    return null;
  }
}

// The active slot's game JSON, or null. boot.js and main.js only ever ask for
// this, so the other slots stay behind the menus.
export function loadSave() {
  const handed = takeHandoff();
  if (handed === null) return readRaw(activeSlot());
  setActiveSlot(handed);
  return readRaw(handed);
}

// One slot as the menus read it: seed and population come from the save
// itself, savedAt is the time writeSave() wrote it, 0 for a save that predates
// slots. The city name is not here: it is ui/title.js's rename map.
export function slotInfo(slot) {
  const n = clampSlot(slot);
  const raw = readRaw(n);
  if (!raw) return { slot: n, hasSave: false, seed: null, population: 0, savedAt: 0 };
  let saved = null;
  try { saved = JSON.parse(raw); } catch { saved = null; }
  const seed = Number.isInteger(saved?.seed) && saved.seed > 0 ? saved.seed : null;
  const list = saved?.people?.list;
  let savedAt = 0;
  try { savedAt = Number(localStorage.getItem(savedAtKey(n))) || 0; } catch { savedAt = 0; }
  return {
    slot: n, hasSave: true, seed,
    population: Array.isArray(list) ? list.length : 0,
    savedAt,
  };
}

export function slotInfos() {
  return Array.from({ length: SLOT_COUNT }, (_, i) => slotInfo(i + 1));
}

export function writeSave(data) {
  try {
    const slot = activeSlot();
    localStorage.setItem(slotKey(slot), JSON.stringify(data));
    localStorage.setItem(savedAtKey(slot), String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    const slot = activeSlot();
    localStorage.removeItem(slotKey(slot));
    localStorage.removeItem(savedAtKey(slot));
    return true;
  } catch {
    return false;
  }
}
