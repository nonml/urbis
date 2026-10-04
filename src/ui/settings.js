// The settings screen (M7.T10, criterion M7-4): the controls the title's
// Settings panel shows. Every control writes through settingsstore.js the
// moment it changes, and the panel reads the store when it is built, so a
// reload shows the last session's choices — the store is the only copy. Later
// slices extend this file: M7.T11 the key bindings, M7.T15 the pad, M29 the
// graphics and accessibility tabs.
import { SETTING_RANGES, loadSettings, setSetting } from '../settingsstore.js';

const GRID = 'display:grid;grid-template-columns:1fr 88px;gap:6px 8px;align-items:center;'
  + 'margin:10px 0;font:11px ui-monospace,Menlo,monospace;letter-spacing:0.08em';
const FIELD = 'width:100%;box-sizing:border-box;padding:3px 5px;font:11px ui-monospace,Menlo,monospace;'
  + 'color:#fff;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);border-radius:3px';

// key, label, control id, in the order the screen reads. Numbers take their
// bounds from the store's ranges; the two checks are the booleans.
const CONTROLS = [
  ['mouseSpeed', 'MOUSE SPEED', 'set-mousespeed'],
  ['invertY', 'INVERT LOOK', 'set-inverty'],
  ['volumeMaster', 'MASTER VOLUME', 'set-vol-master'],
  ['volumeEffects', 'EFFECTS VOLUME', 'set-vol-effects'],
  ['volumeAmbience', 'AMBIENCE VOLUME', 'set-vol-ambience'],
  ['shadowDistance', 'SHADOW DISTANCE', 'set-shadowdist'],
  ['resolutionScale', 'RESOLUTION SCALE', 'set-resscale'],
  ['fov', 'FIELD OF VIEW', 'set-fov'],
  ['subtitleSize', 'SUBTITLE SIZE', 'set-subsize'],
  ['fullscreen', 'FULL SCREEN', 'set-fullscreen'],
];
const CHECKS = new Set(['invertY', 'fullscreen']);

// The browser may refuse without a gesture (a test, an iframe); the preference
// is written either way, so the choice survives the refusal and holds next time
// the player has a gesture to give.
function toggleFullscreen(on) {
  const done = on ? document.documentElement.requestFullscreen?.() : document.exitFullscreen?.();
  if (done && typeof done.catch === 'function') done.catch(() => {});
}

function control(key, id) {
  const input = document.createElement('input');
  input.id = id;
  input.style.cssText = CHECKS.has(key) ? '' : FIELD;
  if (CHECKS.has(key)) {
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      setSetting(key, input.checked);
      if (key === 'fullscreen') toggleFullscreen(input.checked);
    });
  } else {
    const [min, max] = SETTING_RANGES[key];
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(key === 'fov' ? 1 : 0.05);
    input.addEventListener('input', () => setSetting(key, Number(input.value)));
  }
  return input;
}

// Fills `host` with the controls, each showing the stored value. Exported so
// the pause menu (M7.T14) and later settings tabs (M29) mount the same screen.
export function buildSettingsPanel(host) {
  const values = loadSettings();
  const grid = document.createElement('div');
  grid.style.cssText = GRID;
  for (const [key, label, id] of CONTROLS) {
    const name = document.createElement('label');
    name.textContent = label;
    name.htmlFor = id;
    const input = control(key, id);
    if (CHECKS.has(key)) input.checked = values[key];
    else input.value = String(values[key]);
    grid.append(name, input);
  }
  host.appendChild(grid);
  return host;
}
