// Input (M3.T2, criterion M3-1): every key and pointer listener the game
// installs, the foot/car reads the fixed sim step takes, and the city-view
// pointer binding, out of main.js. DOM is allowed here (src/game/, not
// src/sim/): the listeners read game state and call the action callbacks main
// passes; only main steps the sim.
//
// The camera stays the caller's: drag and wheel deltas are handed to `look` and
// `dolly`, so the follow rig can move to game/camera.js (M3.T3) without this
// file changing.
//
// M7.T11: every action answers to its binding (ui/settings.js), not a literal
// key. A rebind in the settings screen lands here at once through
// onBindingsChange and survives the reload through the bindings store.
//
// M7.T15: a standard gamepad plays the street too (M7-8). It is read once a
// fixed step, inside footInput/driveInput — the only reads the sim makes — and
// those return before it in the city view, so D13 holds: overview stays keys.

import { toggleDay } from '../sim/clock.js';
import { STREET } from '../sim/interior.js';
import { cityKey } from '../sim/cityview.js';
import { arcChoose } from '../sim/arc.js';
import { bindCityView } from '../ui/cityview.js';
import { toggleJournal } from '../render/arcui.js';
import { cycleRadio } from '../audio/music.js';
import { loadBindings, onBindingsChange } from '../ui/settings.js';
import { askNewGame, titleShowing } from '../ui/title.js';

// The reads the sim step gets while the overview owns the input: no movement.
const HELD_FOOT = { mx: 0, mz: 0, hurry: false };
const HELD_CAR = { throttle: 0, steer: 0 };

// The name the sim's pan asks a movement action by (sim/cityview.js), and the
// canonical letter sim/cityview.js's cityKey expects per city action.
const MOVE_TOKEN = { forward: 'w', back: 's', left: 'a', right: 'd', run: 'shift' };
const CITY_CANON = { cityView: 'z', brushRes: 'r', brushCom: 'c', brushInd: 'i', brushErase: 'x' };

// The pad's standard mapping (W3C): left stick moves and steers, right stick
// looks, RT runs, A enters, X hacks, Y opens the journal. M29 adds layouts.
const PAD = { enter: 0, hack: 2, journal: 3, run: 7 };
const PAD_DEADZONE = 0.18, PAD_TRIGGER = 0.5;
// Pixel-equivalents per step for the camera's own look; ~1.8 rad/s of yaw.
const PAD_LOOK_PX = 18;
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

// A key typed into a field — the seed and city-name boxes up front, the
// settings number fields — is text, never a bound action: without this, naming
// a city "Northgate" would toggle the day, hack and open the new-game ask
// behind the title (M7.T11).
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const isTyping = (e) => {
  const t = e.target;
  return !!t && (TYPING_TAGS.has(t.tagName) || t.isContentEditable === true);
};

// parts: canvas, cam, camera, city, cityRig, cityView, street, clock, interior,
// arc, arcUI, look(dx, dy), dolly(deltaY), fireHack, toggleVehicle, enterDoor,
// newGame. Installs every listener once, in play's order, and returns the
// readings the frame loop makes.
export function bindInput(parts) {
  const {
    canvas, cam, camera, city, cityRig, cityView, street, clock, interior,
    arc, arcUI, look, dolly, fireHack, toggleVehicle, enterDoor, newGame,
  } = parts;

  // `held` is every physical key down, lower-case; the bindings say which
  // action each answers to. `keys` is what the frame loop reads
  // (sim/cityview.js pan): the movement actions held under their canonical
  // names, so a rebound WASD still walks and still pans.
  const held = new Set();
  const keys = new Set();
  let bindings = loadBindings();
  const byKey = new Map();
  const sync = () => {
    byKey.clear();
    for (const [action, key] of Object.entries(bindings)) byKey.set(key, action);
    keys.clear();
    for (const physical of held) {
      const token = MOVE_TOKEN[byKey.get(physical)];
      if (token) keys.add(token);
    }
  };
  sync();
  onBindingsChange((next) => { bindings = next; sync(); });
  const down = (action) => held.has(bindings[action]);

  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const k = e.key.toLowerCase();
    held.add(k);
    const token = MOVE_TOKEN[byKey.get(k)];
    if (token) keys.add(token);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    held.delete(k);
    const token = MOVE_TOKEN[byKey.get(k)];
    if (token) keys.delete(token);
  });

  // The car radio (M7.T18): B steps off -> station A -> station B -> off while
  // the sim is asking for driveInput, so it tunes from the wheel only. The
  // tuned station outlives the car; musicPlan holds it for the re-entry.
  let radio = null;
  let driving = false;

  // One action, one effect (M7.T15): the keyboard and the pad both fire through
  // this table, so a rebind and a button can never drift apart. WASD/Shift are
  // read by footInput/driveInput through `down`, the city view's own keys
  // through CITY_CANON. One key, one action: setBinding swaps on a clash, so
  // two of these can never match one press.
  const fire = (action) => {
    if (action === 'hack') fireHack();
    else if (action === 'vehicle') toggleVehicle();
    else if (action === 'dayNight') toggleDay(clock);
    // N (M7-7): the ask comes first, in the page, whenever a save exists — but
    // only in play; on the title the front door's own button asks.
    else if (action === 'newGame' && !titleShowing()) askNewGame(newGame);
    else if (action === 'radio' && driving) radio = cycleRadio(radio);
    else if (action === 'journal') toggleJournal(arcUI);
    else if (action === 'choice1') arcChoose(arc, 1, street.time);
    else if (action === 'choice2') arcChoose(arc, 2, street.time);
    // The overview lifts off the street, never out of a shop or off a roof, and a
    // door is used at street scale, never from the overview.
    else if (action === 'door' && cityView.mode === 'street') enterDoor();
    else if (CITY_CANON[action] && interior.space === STREET) cityKey(cityView, CITY_CANON[action], cam.yaw);
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat || isTyping(e)) return;
    fire(byKey.get(e.key.toLowerCase()));
  });

  // The gamepad, read once a step. Buttons fire on the press edge through the
  // same `fire` table the keys use; the sticks land in `pad` for foot/drive.
  // No pad clears every read, so unplugging mid-stride keeps no last stick.
  const heldPad = new Array(17).fill(false);
  const stick = (v) => {
    const n = clamp1(Number(v) || 0);
    return Math.abs(n) < PAD_DEADZONE ? 0 : clamp1((n - Math.sign(n) * PAD_DEADZONE) / (1 - PAD_DEADZONE));
  };
  const padDown = (p, i) => !!(p.buttons?.[i]?.pressed || (p.buttons?.[i]?.value ?? 0) > PAD_TRIGGER);
  const pad = { x: 0, y: 0, lookX: 0, lookY: 0, run: false };

  function pollPad() {
    let p = null;
    try {
      const pads = globalThis.navigator?.getGamepads?.() ?? [];
      for (const each of pads) if (each && each.connected !== false) { p = each; break; }
    } catch { /* an embed can deny the API; then there is no pad */ }
    if (!p) {
      heldPad.fill(false);
      pad.x = pad.y = pad.lookX = pad.lookY = 0; pad.run = false;
      return;
    }
    if (padDown(p, PAD.enter) && !heldPad[PAD.enter]) { fire('vehicle'); fire('door'); }
    if (padDown(p, PAD.hack) && !heldPad[PAD.hack]) fire('hack');
    if (padDown(p, PAD.journal) && !heldPad[PAD.journal]) fire('journal');
    for (let i = 0; i < heldPad.length; i++) heldPad[i] = padDown(p, i);
    pad.x = stick(p.axes?.[0]);
    pad.y = stick(p.axes?.[1]);
    pad.lookX = stick(p.axes?.[2]);
    pad.lookY = stick(p.axes?.[3]);
    pad.run = padDown(p, PAD.run);
    // Look goes through the camera's own drag path, and marks the drag clock so
    // the driving camera does not snap back to the car's heading behind it.
    if (pad.lookX || pad.lookY) {
      look(pad.lookX * PAD_LOOK_PX, pad.lookY * PAD_LOOK_PX);
      lastDragT = clock.elapsed;
    }
  }

  // Mouse: a press on the canvas starts a drag; its deltas go to the camera's
  // look, the wheel to its dolly. In the overview the city view's own binding
  // takes the same events.
  let dragging = false;
  let lastDragT = -10;
  let lastPX = 0;
  let lastPY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastPX = e.clientX;
    lastPY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    look(e.clientX - lastPX, e.clientY - lastPY);
    lastPX = e.clientX;
    lastPY = e.clientY;
    lastDragT = clock.elapsed;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => dolly(e.deltaY), { passive: true });

  // City view (Z): its pointer, palette and readout (ui/cityview.js), bound
  // after the street drag so both see the events in play's order.
  const cityUi = bindCityView({ canvas, cam, camera, city, street, view: cityView, rig: cityRig });

  function footInput() {
    driving = false;
    if (cityView.mode === 'city') return HELD_FOOT;
    pollPad();
    const lx = Math.sin(cam.yaw);
    const lz = Math.cos(cam.yaw);
    const rx = -lz;
    const rz = lx;
    // Keys and stick add before the normalize: one direction, not two.
    let mx = lx * -pad.y + rx * pad.x;
    let mz = lz * -pad.y + rz * pad.x;
    if (down('forward')) { mx += lx; mz += lz; }
    if (down('back')) { mx -= lx; mz -= lz; }
    if (down('left')) { mx -= rx; mz -= rz; }
    if (down('right')) { mx += rx; mz += rz; }
    const len = Math.hypot(mx, mz) || 1;
    return { mx: mx / len, mz: mz / len, hurry: down('run') || pad.run };
  }

  function driveInput() {
    driving = true;
    if (cityView.mode === 'city') return HELD_CAR;
    pollPad();
    return {
      throttle: clamp1((down('forward') ? 1 : 0) + (down('back') ? -1 : 0) - pad.y),
      steer: clamp1((down('left') ? -1 : 0) + (down('right') ? 1 : 0) + pad.x),
    };
  }

  return {
    keys, footInput, driveInput, cityUi,
    get radio() { return radio; },
    get dragging() { return dragging; },
    get lastDragT() { return lastDragT; },
  };
}
