// Input (M3.T2, criterion M3-1): every key and pointer listener the game
// installs, the foot/car reads the fixed sim step takes, and the city-view
// pointer binding, out of main.js. DOM is allowed here (src/game/, not
// src/sim/): the listeners read game state and call the action callbacks main
// passes; only main steps the sim.
//
// The camera stays the caller's: drag and wheel deltas are handed to `look` and
// `dolly`, so the follow rig can move to game/camera.js (M3.T3) without this
// file changing.

import { toggleDay } from '../sim/clock.js';
import { STREET } from '../sim/interior.js';
import { cityKey } from '../sim/cityview.js';
import { arcChoose } from '../sim/arc.js';
import { bindCityView } from '../ui/cityview.js';
import { toggleJournal } from '../render/arcui.js';
import { cycleRadio } from '../audio/music.js';

// The reads the sim step gets while the overview owns the input: no movement.
const HELD_FOOT = { mx: 0, mz: 0, hurry: false };
const HELD_CAR = { throttle: 0, steer: 0 };

// parts: canvas, cam, camera, city, cityRig, cityView, street, clock, interior,
// arc, arcUI, look(dx, dy), dolly(deltaY), fireHack, toggleVehicle, enterDoor,
// newGame. Installs every listener once, in play's order, and returns the
// readings the frame loop makes.
export function bindInput(parts) {
  const {
    canvas, cam, camera, city, cityRig, cityView, street, clock, interior,
    arc, arcUI, look, dolly, fireHack, toggleVehicle, enterDoor, newGame,
  } = parts;

  const keys = new Set();
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // The car radio (M7.T18): B steps off -> station A -> station B -> off while
  // the sim is asking for driveInput, so it tunes from the wheel only. The
  // tuned station outlives the car; musicPlan holds it for the re-entry.
  let radio = null;
  let driving = false;

  // The action keys; WASD/Shift are read by footInput/driveInput.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'h') fireHack();
    if (k === 'f') toggleVehicle();
    if (k === 't') toggleDay(clock);
    if (k === 'n') newGame();
    if (k === 'b' && driving) radio = cycleRadio(radio);
    // The overview lifts off the street, never out of a shop or off a roof, and a
    // door is used at street scale, never from the overview.
    if (interior.space === STREET) cityKey(cityView, k, cam.yaw);
    if (k === 'e' && cityView.mode === 'street') enterDoor();
    if (k === 'j') toggleJournal(arcUI);
    if (k === '1' || k === '2') arcChoose(arc, Number(k), street.time);
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
    if (keys.has('w')) { mx += lx; mz += lz; }
    if (keys.has('s')) { mx -= lx; mz -= lz; }
    if (keys.has('a')) { mx -= rx; mz -= rz; }
    if (keys.has('d')) { mx += rx; mz += rz; }
    const len = Math.hypot(mx, mz) || 1;
    return { mx: mx / len, mz: mz / len, hurry: keys.has('shift') };
  }

  function driveInput() {
    driving = true;
    if (cityView.mode === 'city') return HELD_CAR;
    return {
      throttle: (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0),
      steer: (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0),
    };
  }

  return {
    keys, footInput, driveInput, cityUi,
    get radio() { return radio; },
    get dragging() { return dragging; },
    get lastDragT() { return lastDragT; },
  };
}
