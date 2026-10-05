// The settings screen (M7.T10, criterion M7-4): the controls the title's
// Settings panel shows. Every control writes through settingsstore.js the
// moment it changes, and the panel reads the store when it is built, so a
// reload shows the last session's choices — the store is the only copy. M7.T11
// adds the key bindings grid and its own small store, read by game/input.js.
// Later slices extend this file: M7.T15 the pad, M29 the graphics and
// accessibility tabs.
import { SETTING_RANGES, loadSettings, setSetting } from '../settingsstore.js';

const GRID = 'display:grid;grid-template-columns:1fr 88px;gap:6px 8px;align-items:center;'
  + 'margin:10px 0;font:11px ui-monospace,Menlo,monospace;letter-spacing:0.08em';
const FIELD = 'width:100%;box-sizing:border-box;padding:3px 5px;font:11px ui-monospace,Menlo,monospace;'
  + 'color:#fff;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);border-radius:3px';
const BIND_BUTTON = 'width:100%;box-sizing:border-box;padding:3px 5px;font:11px ui-monospace,Menlo,monospace;'
  + 'color:#fff;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);border-radius:3px;'
  + 'cursor:pointer;text-align:left';

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
  buildBindingsPanel(host);
  return host;
}

// ---- Key bindings (M7.T11) ------------------------------------------------
// One action, one key (docs/ROADMAP.md, "One key, one meaning"): binding a key
// another action holds swaps the two, so no press fires twice and no action is
// left without a key. Bindings live under their own localStorage key, written
// the wrapped way settingsstore.js writes the settings — a denied or full
// store costs the player a key, never the game. game/input.js reads them at
// bind time and again on every change, so a rebind lands at once and survives
// the reload.
const BINDINGS_KEY = 'urbis.bindings';

export const DEFAULT_BINDINGS = Object.freeze({
  forward: 'w', back: 's', left: 'a', right: 'd', run: 'shift',
  door: 'e', vehicle: 'f', hack: 'h', journal: 'j', dayNight: 't',
  newGame: 'n', radio: 'b', choice1: '1', choice2: '2',
  cityView: 'z', brushRes: 'r', brushCom: 'c', brushInd: 'i', brushErase: 'x',
});

// action, the label the rebinding screen shows it under.
const BINDING_LABELS = [
  ['forward', 'MOVE FORWARD'], ['back', 'MOVE BACK'], ['left', 'MOVE LEFT'],
  ['right', 'MOVE RIGHT'], ['run', 'RUN'], ['door', 'ENTER A DOOR'],
  ['vehicle', 'CAR IN / OUT'], ['hack', 'BLACKOUT'], ['journal', 'JOURNAL'],
  ['dayNight', 'DAY / NIGHT'], ['newGame', 'NEW GAME'], ['radio', 'RADIO'],
  ['choice1', 'ARC CHOICE 1'], ['choice2', 'ARC CHOICE 2'], ['cityView', 'CITY VIEW'],
  ['brushRes', 'ZONE RESIDENTIAL'], ['brushCom', 'ZONE COMMERCIAL'],
  ['brushInd', 'ZONE INDUSTRIAL'], ['brushErase', 'ZONE ERASER'],
];
const NOT_A_KEY = new Set(['control', 'alt', 'meta', 'capslock', 'tab', 'escape']);
const KEY_LABELS = {
  ' ': 'SPACE', arrowup: 'UP', arrowdown: 'DOWN', arrowleft: 'LEFT', arrowright: 'RIGHT',
};

function cleanKey(value) {
  const key = String(value).toLowerCase();
  return key.length > 0 && key.length <= 16 ? key : '';
}

export function sanitizeBindings(raw) {
  const out = { ...DEFAULT_BINDINGS };
  if (!raw || typeof raw !== 'object') return out;
  for (const action of Object.keys(DEFAULT_BINDINGS)) {
    const key = cleanKey(raw[action]);
    if (key) out[action] = key;
  }
  return out;
}

export function loadBindings() {
  try {
    return sanitizeBindings(JSON.parse(localStorage.getItem(BINDINGS_KEY)));
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function writeBindings(data) {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(sanitizeBindings(data)));
    return true;
  } catch {
    return false;
  }
}

export function clearBindings() {
  try {
    localStorage.removeItem(BINDINGS_KEY);
    return true;
  } catch {
    return false;
  }
}

const bindingWatchers = new Set();

// input.js subscribes at bind time; setBinding tells it the new table so the
// action moves without a reload. Returns the unsubscribe.
export function onBindingsChange(fn) {
  bindingWatchers.add(fn);
  return () => bindingWatchers.delete(fn);
}

export function setBinding(action, key) {
  if (!(action in DEFAULT_BINDINGS)) return false;
  const next = cleanKey(key);
  if (!next) return false;
  const binds = loadBindings();
  const old = binds[action];
  if (old === next) return true;
  for (const other of Object.keys(binds)) if (other !== action && binds[other] === next) binds[other] = old;
  binds[action] = next;
  if (!writeBindings(binds)) return false;
  for (const fn of bindingWatchers) fn(binds);
  return true;
}

function keyLabel(key) {
  return KEY_LABELS[key] ?? key.toUpperCase();
}

// Waiting for the next key: the button says so, that one press rebinds the
// action, and Esc or a modifier alone leaves the binding alone.
let stopCapture = null;

function captureKey(action, button, buttons) {
  if (stopCapture) stopCapture();
  const idle = button.textContent;
  button.textContent = 'PRESS A KEY';
  const finish = () => {
    document.removeEventListener('keydown', onKey, true);
    stopCapture = null;
  };
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const key = cleanKey(e.key);
    finish();
    if (!key || NOT_A_KEY.has(key)) {
      button.textContent = idle;
      return;
    }
    setBinding(action, key);
    for (const [each, el] of buttons) el.textContent = keyLabel(loadBindings()[each]);
  };
  stopCapture = finish;
  document.addEventListener('keydown', onKey, true);
}

// The rebinding grid: one row per action, its key the button. Exported because
// the pause menu (M7.T14) and the pad tab (M7.T15) mount it beside their own.
export function buildBindingsPanel(host) {
  const values = loadBindings();
  const grid = document.createElement('div');
  grid.style.cssText = GRID;
  const buttons = new Map();
  for (const [action, label] of BINDING_LABELS) {
    const name = document.createElement('label');
    name.textContent = label;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `bind-${action}`;
    button.style.cssText = BIND_BUTTON;
    button.textContent = keyLabel(values[action]);
    buttons.set(action, button);
    button.addEventListener('click', () => captureKey(action, button, buttons));
    grid.append(name, button);
  }
  host.appendChild(grid);
  return host;
}
