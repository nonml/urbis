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

import { toggleDay } from '../sim/clock.js';
import { STREET } from '../sim/interior.js';
import { cityKey } from '../sim/cityview.js';
import { arcChoose } from '../sim/arc.js';
import { bindCityView } from '../ui/cityview.js';
import { toggleJournal } from '../render/arcui.js';
import { cycleRadio } from '../audio/music.js';
import { loadBindings, onBindingsChange } from '../ui/settings.js';
import { askNewGame } from '../ui/title.js';

// The reads the sim step gets while the overview owns the input: no movement.
const HELD_FOOT = { mx: 0, mz: 0, hurry: false };
const HELD_CAR = { throttle: 0, steer: 0 };

// The name the sim's pan asks a movement action by (sim/cityview.js), and the
// canonical letter sim/cityview.js's cityKey expects per city action.
const MOVE_TOKEN = { forward: 'w', back: 's', left: 'a', right: 'd', run: 'shift' };
const CITY_CANON = { cityView: 'z', brushRes: 'r', brushCom: 'c', brushInd: 'i', brushErase: 'x' };

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

  // The action keys; WASD/Shift are read by footInput/driveInput through
  // `down`, the city view's own keys through CITY_CANON. One key, one action:
  // setBinding swaps on a clash, so two of these can never match one press.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const action = byKey.get(e.key.toLowerCase());
    if (action === 'hack') fireHack();
    if (action === 'vehicle') toggleVehicle();
    if (action === 'dayNight') toggleDay(clock);
    // N (M7-7): the ask comes first, in the page, whenever a save exists.
    if (action === 'newGame') askNewGame(newGame);
    if (action === 'radio' && driving) radio = cycleRadio(radio);
    if (action === 'journal') toggleJournal(arcUI);
    if (action === 'choice1') arcChoose(arc, 1, street.time);
    if (action === 'choice2') arcChoose(arc, 2, street.time);
    // The overview lifts off the street, never out of a shop or off a roof, and a
    // door is used at street scale, never from the overview.
    if (action === 'door' && cityView.mode === 'street') enterDoor();
    if (CITY_CANON[action] && interior.space === STREET) cityKey(cityView, CITY_CANON[action], cam.yaw);
  });

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
    const lx = Math.sin(cam.yaw);
    const lz = Math.cos(cam.yaw);
    const rx = -lz;
    const rz = lx;
    let mx = 0;
    let mz = 0;
    if (down('forward')) { mx += lx; mz += lz; }
    if (down('back')) { mx -= lx; mz -= lz; }
    if (down('left')) { mx -= rx; mz -= rz; }
    if (down('right')) { mx += rx; mz += rz; }
    const len = Math.hypot(mx, mz) || 1;
    return { mx: mx / len, mz: mz / len, hurry: down('run') };
  }

  function driveInput() {
    driving = true;
    if (cityView.mode === 'city') return HELD_CAR;
    return {
      throttle: (down('forward') ? 1 : 0) + (down('back') ? -1 : 0),
      steer: (down('left') ? -1 : 0) + (down('right') ? 1 : 0),
    };
  }

  return {
    keys, footInput, driveInput, cityUi,
    get radio() { return radio; },
    get dragging() { return dragging; },
    get lastDragT() { return lastDragT; },
  };
}
