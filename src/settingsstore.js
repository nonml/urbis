// The settings on disk: localStorage, the same shape as savestore.js — one key,
// every call wrapped, because a denied or full store must cost the player a
// preference, never the game. This file owns the format: DEFAULT_SETTINGS is
// the contract the settings screen and, later, the renderer read. loadSettings()
// always returns a complete, sanitized object and never a cached copy, so every
// call is as honest as a relaunch.
const KEY = 'urbis.settings';

export const DEFAULT_SETTINGS = Object.freeze({
  mouseSpeed: 1,
  invertY: false,
  volumeMaster: 0.8,
  volumeEffects: 0.8,
  volumeAmbience: 0.7,
  shadowDistance: 1,
  resolutionScale: 1,
  fov: 52,
  fullscreen: false,
  subtitleSize: 1,
});

// Numbers only; [min, max]. Controls set these as their bounds and the store
// clamps to them, so a hand-edited or stale store cannot feed the game a value
// the screen could never produce.
export const SETTING_RANGES = Object.freeze({
  mouseSpeed: [0.2, 4],
  volumeMaster: [0, 1],
  volumeEffects: [0, 1],
  volumeAmbience: [0, 1],
  shadowDistance: [0, 2],
  resolutionScale: [0.5, 1],
  fov: [50, 110],
  subtitleSize: [0.8, 2],
});

export const SETTINGS_KEY = KEY;

function cleanValue(key, value) {
  if (typeof DEFAULT_SETTINGS[key] === 'boolean') return value === true;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS[key];
  const [min, max] = SETTING_RANGES[key];
  return Math.min(max, Math.max(min, n));
}

export function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in raw) out[key] = cleanValue(key, raw[key]);
  }
  return out;
}

export function loadSettings() {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeSettings(data)));
    return true;
  } catch {
    return false;
  }
}

export function setSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) return false;
  return writeSettings({ ...loadSettings(), [key]: value });
}

export function clearSettings() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
