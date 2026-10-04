// M7-4 (docs/ROADMAP.md): settings for mouse, volume, quality, field of view,
// full screen and subtitle size survive a reload. M7.T10 stores them the way
// savestore.js stores the save: one localStorage key, every call wrapped, so a
// denied or full store costs a preference and never the game.
//
// Node-only: the store and the screen are the whole of this slice, and the
// browser's storage is stubbed here exactly as it behaves. A real page reload
// re-evaluates the module and reads the key; the store keeps no cache, so the
// fresh read below is that same read. The screen runs against the smallest DOM
// it touches, so "a control writes the store" is exercised, not asserted.
import { test, expect } from '@playwright/test';
import {
  DEFAULT_SETTINGS, SETTING_RANGES, SETTINGS_KEY,
  loadSettings, writeSettings, clearSettings, setSetting,
} from '../../src/settingsstore.js';
import { buildSettingsPanel } from '../../src/ui/settings.js';

// Every group M7.T10 names, with a value no default uses.
const CHANGED = {
  mouseSpeed: 2.5, invertY: true,
  volumeMaster: 0.4, volumeEffects: 0.9, volumeAmbience: 0.3,
  shadowDistance: 1.8, resolutionScale: 0.75,
  fov: 88, fullscreen: true, subtitleSize: 1.5,
};
const NUMBER_CONTROLS = [
  ['set-mousespeed', 'mouseSpeed', '2.5'], ['set-vol-master', 'volumeMaster', '0.4'],
  ['set-vol-effects', 'volumeEffects', '0.9'], ['set-vol-ambience', 'volumeAmbience', '0.3'],
  ['set-shadowdist', 'shadowDistance', '1.8'], ['set-resscale', 'resolutionScale', '0.75'],
  ['set-fov', 'fov', '88'], ['set-subsize', 'subtitleSize', '1.5'],
];
const CHECK_CONTROLS = [['set-inverty', 'invertY'], ['set-fullscreen', 'fullscreen']];

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// The smallest DOM ui/settings.js touches: elements with style, listeners and a
// parent, and a documentElement whose fullscreen call is absent (as a headless
// browser refuses it) and must therefore not crash the screen.
function fakeDom() {
  const el = () => ({
    children: [], listeners: {}, style: {},
    textContent: '',
    append(...kids) { this.children.push(...kids); },
    appendChild(kid) { this.children.push(kid); return kid; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    fire(type) { if (this.listeners[type]) this.listeners[type]({ target: this }); },
  });
  globalThis.document = { createElement: el, documentElement: {} };
  return el();
}

function control(host, id) {
  if (host.id === id) return host;
  for (const kid of host.children ?? []) {
    const hit = control(kid, id);
    if (hit) return hit;
  }
  return null;
}

test('M7.T10: the store carries every M7-4 group with a sane default', () => {
  globalThis.localStorage = memoryStorage();
  const loaded = loadSettings();
  expect(Object.keys(CHANGED).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  for (const key of Object.keys(CHANGED)) expect(loaded[key], `default for ${key}`).toBe(DEFAULT_SETTINGS[key]);
  for (const [min, max] of Object.values(SETTING_RANGES)) expect(min).toBeLessThan(max);
});

test('M7.T10: write then load is a reload — no memory of the last session', () => {
  globalThis.localStorage = memoryStorage();
  expect(writeSettings(CHANGED), 'the store accepted the write').toBe(true);
  expect(JSON.parse(globalThis.localStorage.getItem(SETTINGS_KEY)), 'one key holds the store JSON')
    .toMatchObject(CHANGED);
  expect(loadSettings()).toEqual(CHANGED);

  // A reload reads the disk, not a cache: change storage behind the module's
  // back and the next load must see it.
  globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...CHANGED, fov: 90 }));
  expect(loadSettings().fov, 'load reads the store, not a cached copy').toBe(90);

  expect(setSetting('fov', 60), 'setSetting writes one key').toBe(true);
  const after = loadSettings();
  expect(after.fov).toBe(60);
  for (const key of Object.keys(CHANGED)) if (key !== 'fov') expect(after[key]).toBe(CHANGED[key]);

  expect(clearSettings()).toBe(true);
  expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
});

test('M7.T10: corrupt storage falls back, missing keys fill, junk is clamped', () => {
  globalThis.localStorage = memoryStorage();
  globalThis.localStorage.setItem(SETTINGS_KEY, '{ not json');
  expect(loadSettings(), 'corrupt JSON is the defaults, not a crash').toEqual(DEFAULT_SETTINGS);
  globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fov: 90, bogus: 1 }));
  expect(loadSettings(), 'a partial store keeps what it has and fills the rest')
    .toEqual({ ...DEFAULT_SETTINGS, fov: 90 });
  globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fov: 500, mouseSpeed: -3, invertY: 1 }));
  const clamped = loadSettings();
  expect(clamped.fov).toBe(110);
  expect(clamped.mouseSpeed).toBe(0.2);
  expect(clamped.invertY).toBe(false);
});

test('M7.T10: every screen control writes the store, and a fresh screen reads it back', () => {
  globalThis.localStorage = memoryStorage();
  let host = fakeDom();
  buildSettingsPanel(host);
  for (const [id, key, value] of NUMBER_CONTROLS) {
    const input = control(host, id);
    expect(input, `${id} exists`).toBeTruthy();
    input.value = value;
    input.fire('input');
    expect(loadSettings()[key], `${key} wrote on input`).toBe(Number(value));
  }
  for (const [id, key] of CHECK_CONTROLS) {
    const input = control(host, id);
    expect(input, `${id} exists`).toBeTruthy();
    input.checked = true;
    input.fire('change');
    expect(loadSettings()[key], `${key} wrote on change`).toBe(true);
  }
  expect(loadSettings()).toEqual(CHANGED);

  // The reload: a fresh document and a fresh panel show the stored choices.
  host = fakeDom();
  buildSettingsPanel(host);
  for (const [id, key, value] of NUMBER_CONTROLS) {
    expect(control(host, id).value, `${id} reads the store on build`).toBe(String(Number(value)));
  }
  for (const [id] of CHECK_CONTROLS) expect(control(host, id).checked).toBe(true);
});
