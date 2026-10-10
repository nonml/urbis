// Input (M3.T2, criterion M3-1): every key and pointer listener the game
// installs, the foot/car reads the fixed sim step takes, and the city-view
// pointer binding, out of main.js. DOM is allowed here (src/game/, not
// src/sim/): the listeners read game state and call the action callbacks main
// passes; only main steps the sim.
//
// The camera stays the caller's: drag, lock and wheel deltas are handed to
// `look` and `dolly`, so the follow rig can move to game/camera.js (M3.T3)
// without this file changing.
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
import { worldMap } from '../sim/patrol.js';
import { hackFireAlarm } from '../sim/alarms.js';
import { createHackables, syncHackables, aimTarget } from '../sim/hackables.js';
import { cityKey, undoAct } from '../sim/cityview.js';
import { hackCrane } from '../sim/zoning.js';
import { arcChoose } from '../sim/arc.js';
import { bindCityView } from '../ui/cityview.js';
import { buildHackMenu } from '../ui/hackmenu.js';
import { setPaused } from './loop.js';
import { PANEL_KEY } from '../ui/history.js';
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

// The hack key held this long opens the menu of the aimed thing's hacks instead
// of firing its default one (M6.T3). A press shorter than this is a tap.
const HACK_HOLD_MS = 260;

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
// newGame, toggleHistory. Installs every listener once, in play's order, and
// returns the readings the frame loop makes.
export function bindInput(parts) {
  const {
    canvas, cam, camera, city, cityRig, cityView, street, clock, interior,
    arc, arcUI, look, dolly, fireHack, toggleVehicle, enterDoor, newGame, toggleHistory,
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

  // The registry (M6.T1) and the aim pick (M6.T2) the hack key fires from: a
  // shelf of input's own, synced on the press from the same map, city and street
  // the frame loop syncs every step, so the pick is the one the game holds. The
  // follow rig puts the eye one arm behind the player along the look axis, so the
  // player is that arm back from the eye — the point and heading the lot note
  // asks about, never a spot behind the player's own back. A wall that shortens
  // the arm can leave the recovered point up to one arm ahead of the body, which
  // only ever aims the pick further down the street. The HUD hides the highlight
  // in the car; the key and the menu still read the aim from the driving camera.
  const hacks = createHackables({ map: worldMap(), city, street });
  const arm = () => cam.dist * Math.cos(cam.pitch);
  const aim = () => {
    if (cityView.mode !== 'street' || interior.space !== STREET) return null;
    syncHackables(hacks, { map: worldMap(), street, city });
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    return aimTarget(hacks, camera.position.x + fx * arm(), camera.position.z + fz * arm(), fx, fz);
  };

  // One hack, one applier. The blackout is the one the sim fires today, and it
  // goes through the entry point play has always used: main's fireHack owns its
  // visible effects — the sparks, the steam, the heat and the mission line — and
  // kills the district the player stands in, the box's own whenever the box is
  // in reach on foot. The profiler's effect is the aim panel itself, so its fire
  // has nothing to spend. A hack M6 has not built yet refuses and says why, so
  // the menu never pretends to work.
  const onFire = (hack, entry) => {
    if (hack.id === 'blackout') { fireHack(); return null; }
    if (hack.id === 'profiler') return null;
    // The fire alarm (M6.T19, alarms.js hackFireAlarm): the aimed building
    // empties onto the pavement and its shop shuts for the alarm's life. The
    // menu hands the thing it was opened on; a tap has none, so it reads the
    // aim the frame holds.
    if (hack.id === 'fire_alarm') {
      const t = entry ?? aim()?.entry ?? null;
      if (!t || t.kind !== 'building') return 'no building in reach';
      return hackFireAlarm(worldMap().parcels, t.ref, street.time).why;
    }
    // M6.T18: the crane hacks are the zoning sim's own, thrown at the lot the
    // registry entry stands over (hackables.js registers a crane per site).
    if (hack.id === 'crane_stop' || hack.id === 'crane_drop') {
      return entry ? hackCrane(city, entry, hack) : 'no site in reach';
    }
    return 'not built yet';
  };
  const hackMenu = buildHackMenu(onFire);

  // The hack key: a tap fires the aimed thing's default hack, a hold opens the
  // menu of its hacks — and the release that ends the hold is never a second
  // press. With nothing in reach there is no menu and nothing to aim at, and the
  // key is the district's own blackout, which is what it has always been.
  let hackHold = 0;
  function openHackMenu() {
    hackHold = 0;
    const t = aim();
    if (!t) { fireHack(); return; }
    hackMenu.open(t.entry);
  }
  function hackDown() {
    if (hackMenu.isOpen) { hackMenu.close(); return; }
    if (hackHold) return;
    hackHold = setTimeout(openHackMenu, HACK_HOLD_MS);
  }
  function hackUp() {
    if (!hackHold) return;
    clearTimeout(hackHold);
    hackHold = 0;
    const t = aim();
    // The thing's own hack fires, or it does not. When it does not, M6-2's rule
    // holds: the blackout works in every district, so the key never stops being
    // holds: the blackout works in every district, so the key never stops being
    // the blackout. The aimed entry rides with the hack, so one thrown at a
    // site lands on that site (M6.T18).
    if (t && !onFire(t.entry.hacks[0], t.entry)) return;
    fireHack();
  }

  // The pointer lock (M4.R1) the street view takes on a click: while the canvas
  // holds it a bare mousemove looks, GTA and Watch Dogs on PC, and Esc releases
  // it as the browser already does. The overview never takes one — its own drag
  // orbits its own camera — and going up hands the mouse back to it.
  const onStreet = () => cityView.mode === 'street';
  const lockHeld = () => document.pointerLockElement === canvas;
  const locked = () => onStreet() && lockHeld();
  function takeLock() {
    // Chrome hands back a promise and may refuse the lock; an older browser
    // throws. Either way the drag look stands, so play never notices.
    try {
      const ask = canvas.requestPointerLock();
      if (ask && ask.catch) ask.catch(() => {});
    } catch { /* a browser without the API keeps the drag look */ }
  }
  function releaseLock() {
    if (lockHeld()) document.exitPointerLock();
  }

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
    // The tap that ends before the hold: the hack key's own machine (M6.T3).
    if (k === bindings.hack) hackUp();
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
  // two of these can never match one press. The hack key is its own machine — a
  // tap fires, a hold opens the menu — and never passes through here.
  const fire = (action) => {
    // The hack menu is modal (M6.T3): while it is open no other action answers.
    if (hackMenu.isOpen) return;
    if (action === 'vehicle') toggleVehicle();
    else if (action === 'dayNight') toggleDay(clock);
    // N (M7-7): the ask comes first, in the page, whenever a save exists — but
    // only in play; on the title the front door's own button asks.
    else if (action === 'newGame' && !titleShowing()) askNewGame(newGame);
    else if (action === 'radio' && driving) radio = cycleRadio(radio);
    else if (action === 'journal') toggleJournal(arcUI);
    else if (action === 'history') toggleHistory();
    // Ctrl+Z in the overview (M5.T26, M5-7): the last act undone, its cost
    // refunded, while the act is still inside ten game seconds.
    else if (action === 'undo') undoAct(cityView, city);
    else if (action === 'choice1') arcChoose(arc, 1, street.time);
    else if (action === 'choice2') arcChoose(arc, 2, street.time);
    // The overview lifts off the street, never out of a shop or off a roof, and a
    // door is used at street scale, never from the overview.
    else if (action === 'door' && cityView.mode === 'street') enterDoor();
    else if (CITY_CANON[action] && interior.space === STREET) {
      cityKey(cityView, CITY_CANON[action], cam.yaw);
      if (!onStreet()) releaseLock();
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat || isTyping(e)) return;
    const k = e.key.toLowerCase();
    // A keypress with Ctrl, Alt or the meta key held is the browser's or the
    // page's, never a game action: without this, Ctrl+Z on the street would take
    // the city view up as its own Z.
    const modified = e.ctrlKey || e.metaKey || e.altKey;
    // Ctrl+Z is the overview's undo (M5.T26). Like O and the history panel it
    // answers to a key no binding names, and the modifier is what tells it apart
    // from the overview's own Z — so the bound action is skipped for the press.
    const undoKey = e.ctrlKey && k === 'z' && cityView.mode === 'city';
    const action = modified ? null : byKey.get(k);
    // The hack menu's own keys: the arrows move the selection, Enter fires the
    // chosen hack, Escape puts the menu away. ui/pause.js answers to Escape in
    // the capture phase and has already paused the game with this press, so the
    // pause goes back the way the player left it — running, and its overlay with
    // it. The menu can never have been opened while the game was paused (pause
    // eats every other key), so this only ever undoes the pause this press made.
    if (hackMenu.isOpen) {
      if (k === 'arrowup') hackMenu.move(-1);
      else if (k === 'arrowdown') hackMenu.move(1);
      else if (k === 'enter') hackMenu.choose();
      else if (k === 'escape') {
        hackMenu.close();
        setPaused(false);
        const pause = document.getElementById('pause');
        if (pause) pause.style.display = 'none';
      }
    }
    // The hack key starts its own machine: a tap fires, a hold opens the menu.
    if (k === bindings.hack) hackDown();
    // The city's history panel (M5.T32b) answers to a letter no binding names,
    // so the key sits beside the action it fires, the way O cycles the planner's
    // overlays from main.js. Only in the overview, like every city key. A
    // binding that ever claims the letter wins: the press is theirs then.
    if (!action && k === PANEL_KEY && cityView.mode === 'city') fire('history');
    if (undoKey) fire('undo');
    fire(action);
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
    // X is the hack key (M6.T3): a tap fires the aimed thing's default hack, a
    // hold opens its menu, exactly as the keyboard's own key does.
    if (padDown(p, PAD.hack) && !heldPad[PAD.hack]) hackDown();
    if (!padDown(p, PAD.hack) && heldPad[PAD.hack]) hackUp();
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
  // A click on the canvas takes the lock: from then on the mouse looks with no
  // button held, and the drag it came from hands over without a break. Only a
  // real press counts — a replayed or scripted event must never grab the cursor
  // (M0-1's log feeds this listener back through the game).
  canvas.addEventListener('pointerup', (e) => {
    if (e.isTrusted && onStreet()) takeLock();
  });
  window.addEventListener('pointermove', (e) => {
    // A locked mouse reaches the page as a mousemove too; the listener below
    // owns the look there, so one movement is never counted twice.
    if (lockHeld() || !dragging) return;
    look(e.clientX - lastPX, e.clientY - lastPY);
    lastPX = e.clientX;
    lastPY = e.clientY;
    lastDragT = clock.elapsed;
  });
  // Under the lock the cursor does not move, so there are no client deltas: the
  // raw movement is the look, and it marks the drag clock the same way, so the
  // driving camera does not swing back to the car's heading behind it.
  window.addEventListener('mousemove', (e) => {
    if (!locked()) return;
    look(e.movementX, e.movementY);
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
    // The menu is modal (M6.T3): nobody walks with it open.
    if (hackMenu.isOpen) return HELD_FOOT;
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
    if (hackMenu.isOpen) return HELD_CAR;
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
