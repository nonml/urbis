// Bootstrap: sim ticks, render reads. HUD shows measured numbers only.
import { SEED, GENERATE, SAVING } from './boot.js';
import { createFixedStep, advance, setSpeed, snap, blend, STEP } from './game/loop.js';
import { createRecorder, bindRecorder, loadReplay, createReplay } from './game/replay.js';
import { bindProbe } from './game/probe.js';
import { bindInput } from './game/input.js';
import { createFollowRig, CAM_PIVOT } from './game/camera.js';
import { buildHud, updateHud, tickHud, applySpawn } from './game/hud.js';
import * as THREE from 'three';
import { createClock, tickClock } from './sim/clock.js';
import { createStreet, tickStreet, hackBlackout, isDark, districtAt } from './sim/street.js';
import { createPlayer, tickPlayer } from './sim/player.js';
import { clampToBounds } from './sim/world.js';
import { worldMap } from './sim/patrol.js';
import { createPlayerCar, tickPlayerCar } from './sim/vehicle.js';
import { createMission, missionOnBlackout, missionOnEnterCar, missionOnHeatZero, missionOnProfile, missionReset, missionNote } from './sim/mission.js';
import { createWanted, wantedOnBlackout, tickWanted, drainEvents } from './sim/wanted.js';
import { createDispatch, tickDispatch } from './sim/dispatch.js';
import { createCity, tickZoning } from './sim/zoning.js';
import { createHackables, syncHackables, aimTarget } from './sim/hackables.js';
import { createPeople, tickPeople } from './sim/people.js';
import { tickCommute, commuteLabel } from './sim/commute.js';
import { createNews, tickNews, liveNews } from './sim/news.js';
// On its own line, not folded into the one above: news-wire.spec.js greps that
// import verbatim.
import { pushNews } from './sim/news.js';
import { chaseIn } from './sim/economy.js';
import { STREET, createInterior, tickInterior, useDoor, occupiedParcel } from './sim/interior.js';
import { serialize, deserialize } from './sim/save.js';
import { loadSave, writeSave, clearSave } from './savestore.js';
import { buildScene, updateScene } from './game/scene.js';
import {
  cityMirrorStale, requestCityMirror, tickCityMirror, tickSteam, refreshLampDressing,
} from './render/setdress.js';
import { firePulse, fireSparks, tickHackFx } from './render/hackfx.js';
import { SUBSTATIONS } from './sim/anchors.js';
import { createRenderer, createComposer, fitRenderer } from './render/atmosphere.js';
import { buildNews, showNews } from './render/news.js';
import { createCityView, tickCityView, cityKey, easeLift } from './sim/cityview.js';
import { createArc, tickArc } from './sim/arc.js';
import { buildHistoryPanel } from './ui/history.js';
import { placeHudPanels } from './ui/hudlayout.js';

const DRAW_BUDGET = 175;
// Fields a keypress typed into is text, never a command (game/input.js isTyping).
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
// One cube face of the reflection world, measured; the margin is the room a
// spawn needs to land in the same frame without the probe pushing it over.
const MIRROR_FACE_DRAWS = 4, MIRROR_MARGIN = 10;
let lastDraws = 0;

const canvas = document.getElementById('scene');
const query = new URLSearchParams(location.search);
const CAPTURE = query.has('capture');
const RECORD = query.has('record');
const REPLAY = query.get('replay');
const renderer = createRenderer(canvas, { preserveDrawingBuffer: CAPTURE });
const maxAniso = renderer.capabilities.getMaxAnisotropy(), texLoader = new THREE.TextureLoader();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);

// Sim state (restored or generated) is created before the scene: assembly reads
// it, and the save is the source of truth for what city this is.
const restored = SAVING ? deserialize(loadSave()) : null, map = worldMap();
const street = restored?.street ?? createStreet(SEED);
const city = restored?.city ?? createCity(SEED);
const people = restored?.people ?? createPeople(SEED);
const player = restored?.player ?? createPlayer(map);
player.mode ??= 'foot'; const heroCar = restored?.car ?? createPlayerCar(map);
const mission = restored?.mission ?? createMission();
const arc = createArc(), wanted = createWanted(map);
let lastWantedStatus = 'clean';
const dispatch = createDispatch(20260916, map), news = createNews();
const clock = restored?.clock ?? createClock();
// Every grown lot carries a street door and a room (sim/interior.js).
const interior = restored?.interior ?? createInterior(city);
interior.city = city;
const cityView = createCityView(city);
// Every hackable thing on this map (M6.T1), synced each sim step; the frame's
// aim pick comes from it, and the HUD highlights that pick.
const hackables = createHackables({ map, city, street });

// Scene assembly (M3.T4a) lives in game/scene.js, returning every handle.
const renderParts = buildScene({ scene, renderer, texLoader, maxAniso, city, street, heroCar, cityView });
const {
  env, spots, groundMats, markingMats, towers, skyline, stars, outskirts, chunks,
  beacons, signs, signPoolMeshes, lamps, streakMeshes, carStreaks, lampPoolMeshes,
  fadedDraws, growth, vacant, decline, arcMarker, npcRig, traffic, heroRig, police,
  avatar, shops, interiors, puddles, mirror, blobs, steam, fx, rain, heroKey, cityRig,
  overlayRig,
} = renderParts;
// The lamp light pools are additive glow, not world: a pick under one names the
// asphalt it lies on, never the quad (M5.T4b; the city view's kerbs take the
// same route).
for (const m of lampPoolMeshes) m.raycast = () => {};
let streamOrigin = null, policeHold = false;
// The furniture plan the lamp rig was last built from (M5.T4b): a road op
// replaces it, and the frame that sees the new object redraws the street kit.
const lampPlan = { furniture: map.furniture };
const newsLine = buildNews();
const hud = buildHud(newsLine);
const { lotNote } = hud;
// The city's history panel (M5.T32b): DOM and a 2D canvas, so it costs no
// WebGL draw. The city view's key opens it; the frame loop paints it while it
// is open (render(), beside the other panels' updates).
const historyPanel = buildHistoryPanel(document.body);

const { composer, bloom, grade } = createComposer(renderer, scene, camera);
window.addEventListener('resize', () => fitRenderer(renderer, composer, camera, grade));
const sceneCtx = {
  ...renderParts, scene, renderer, camera, bloom, grade,
  city, street, clock, interior, wanted, arc, heroCar, player, cityView,
};
const camRig = createFollowRig({ camera, interior }), cam = camRig.cam;
// The follow camera stops at these: the street wall's fixed footprints (their
// height rides on the record from block.js) and the grown lots. The hero car
// joins them on foot, so turning around at the spawn rides its roof instead of
// opening inside it.
const CAM_BLOCKERS = [...towers.footprints, ...city.parcels];
const HERO_BOX = { x: 0, z: 0, w: 2.6, d: 5.2, h: 1.7 };
const WALK_BLOCKERS = [...CAM_BLOCKERS, HERO_BOX];
const hudCtx = {
  city, street, dispatch, arc, interior, cam, camera, clock, wanted, mission, player, heroCar,
  // One truth per power district the street sim runs (its own map's areas, or
  // the two halves it falls back to).
  dark: street.zones.map(() => false),
};

// A capture holds the clock so the same seed, pose and hour reproduce: a shot
// must not drift through the day while the rasteriser crawls.
if (CAPTURE) clock.rate = 0;
const input = bindInput({
  canvas, cam, camera, city, cityRig, cityView, street, clock, interior, arc, arcUI: hud.arcUI,
  look: camRig.look, dolly: camRig.dolly, fireHack, toggleVehicle, enterDoor, newGame,
  toggleHistory: () => historyPanel.toggle(),
});
applySpawn(player, cam, restored ? null : query.get('spawn'));
const DARK = hudCtx.dark;

// The help line's look token (M4.R1): a bare mouse under the pointer lock names
// what looks on the street, the drag names what looks in the overview. The rest
// of the line stays in index.html; only this token follows the view.
const HINT_LOOK = { street: 'mouse · look', city: 'drag · look' };
const hintLine = document.getElementById('hint');
let hintView = null;
function syncHintLine() {
  const view = cityView.mode === 'city' ? 'city' : 'street';
  if (!hintLine || hintView === view) return;
  hintView = view;
  hintLine.textContent = hintLine.textContent.replace(/(?:mouse|drag) · look/, HINT_LOOK[view]);
}

// O cycles the planner's overlays (M5.T20/M5.T21). The action table in
// game/input.js is the key bindings' own list and no binding names the overlay
// ring, so the key sim/cityview.js's cityKey answers to is installed here at the
// bootstrap, beside the others. It is gated the way every city key is: the
// overview lifts off the street, never out of a shop, and text typed into a
// field is never a command.
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  const on = e.target;
  const typing = on && (on.isContentEditable || TYPING_TAGS.has(on.tagName));
  if (typing) return;
  if (e.key.toLowerCase() !== 'o' || interior.space !== STREET) return;
  cityKey(cityView, 'o', cam.yaw);
});

function fireHack() {
  const driving = player.mode === 'drive';
  const px = driving ? heroCar.x : player.x, pz = driving ? heroCar.z : player.z;
  // The district the player stands in, as the street sim reads it: the lights
  // that go out are the ones it puts out, on any number of districts.
  const zone = districtAt(street, px, pz);
  if (hackBlackout(street, zone) === 0) return;
  wantedOnBlackout(wanted, px, pz, street.time, map);
  firePulse(fx, px, pz);
  // A district the hand substation table has no cabinet for still sparks at
  // its lamps: the lights are the hack, the cabinet is the decoration.
  const sub = (map.anchors.substations ?? SUBSTATIONS).find((s) => s.zone === zone);
  if (sub) fireSparks(fx, sub.x, 1.6, sub.z, street.time, 0, 12);
  // Companion burst at the lamp head nearest the player — the visible one.
  let best = null, bestD = 1e9;
  for (const h of lamps.heads) {
    const d = Math.hypot(h.x - px, h.z - pz);
    if (d < bestD) { bestD = d; best = h; }
  }
  if (best) fireSparks(fx, best.x, 0.5, best.z, street.time, 12, 12);
  steam.erupt[zone] = 1;
  missionOnBlackout(mission, DARK, street.time);
}

function nearHero() {
  return interior.space === STREET && Math.hypot(heroCar.x - player.x, heroCar.z - player.z) < 3.4;
}

// E: through the door in reach. The cut is immediate; a short fade covers it.
function enterDoor() {
  if (player.mode !== 'foot' || !useDoor(interior, player)) return;
  snap(player); camRig.enterSpace(player);
  hud.fadeDoor();
}

function toggleVehicle() {
  if (player.mode === 'foot' && nearHero()) {
    player.mode = 'drive'; avatar.group.visible = false;
    missionOnEnterCar(mission); camRig.enterDrive();
  } else if (player.mode === 'drive') {
    player.mode = 'foot';
    ({ x: player.x, z: player.z } = clampToBounds(map.district.walk, heroCar.x + 1.8, heroCar.z));
    player.speed = 0;
    // A step snap, not a step: without it the drawn avatar would blend from
    // where it last stood on foot, possibly across the map.
    snap(player); avatar.group.visible = true; camRig.exitDrive();
  }
}

// Save and continue: every 30 s of play, and the moment the tab goes away.
// Writing is never worth crashing over (src/savestore.js).
const AUTOSAVE_SECS = 30; let autosaveIn = AUTOSAVE_SECS;
// Set while a new game wipes the save: visibilitychange fires once more on the way down.
let wiping = false;

function doSave() {
  if (!SAVING || wiping) return false;
  return writeSave(serialize({ seed: SEED, generate: GENERATE, clock, street, city, player, car: heroCar, interior, mission, people }));
}

// N: a new game is a new city. The save goes, and so does any ?seed replay URL.
function newGame() {
  wiping = true; clearSave();
  const url = new URL(location.href); url.searchParams.delete('seed');
  location.href = url.toString();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });

// M0-1 record/replay; the probe takes them as live readings.
let recorder = null, replay = null, replayErr = null;
chunks.warm(player.x, player.z);
let last = performance.now(), braking = false, lastProfile = null;
const fixed = createFixedStep(), bootSpeed = fixed.speed;
if (RECORD) {
  recorder = createRecorder(() => fixed.total);
  bindRecorder(recorder, canvas);
}
if (REPLAY) {
  setSpeed(fixed, 0); loadReplay(REPLAY)
    .then((log) => { replay = createReplay(log, canvas); setSpeed(fixed, bootSpeed); })
    .catch((e) => { replayErr = String(e); setSpeed(fixed, bootSpeed); });
}

// The scripted-verification surface (M3.T1) lives in game/probe.js.
bindProbe({
  capture: CAPTURE, seed: SEED, generate: GENERATE, save: doSave,
  camera, cam, renderer, scene, fireHack, toggleVehicle, enterDoor,
  dark: DARK, camPivot: CAM_PIVOT, street, city, map, lamps, people, player, car: heroCar,
  mission, wanted, dispatch, interior, clock, news, arc, cityView, cityRig, fixed,
  composer, avatar, towers, skyline, growth, decline, lotNote, police, chunks, outskirts,
  overlayRig,
  getProfile: () => lastProfile, getWantedStatus: () => lastWantedStatus,
  getInputLog: () => (recorder ? recorder.log(SEED) : null),
  isReplayDone: () => !!replay && fixed.total >= replay.end,
  getReplayError: () => replayErr, setPoliceHold: (on) => { policeHold = on; },
  setStreamOrigin: (x, z) => { streamOrigin = x === null ? null : { x, z }; },
});
// The economy's own series (M5-15), which the history panel draws: read back
// here so a check compares the painted pixels with the live rows. The base
// probe's economy() is the district report, which does not hold them.
window.__game.history = () => city.economy.history;
// The news feed's own push (M5.R1), capture-only like the rest of the probes
// that move the world: a check makes the city repeat a line and reads the feed
// fold it into one line with a count.
if (CAPTURE) window.__game.pushNews = (text) => pushNews(news, text, street.time);
const playerDraw = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, walkPhase: 0, mode: 'foot' };
const carDraw = { x: 0, y: 0, z: 0, yaw: 0, speed: 0 };

// One fixed sim step (M0-1): every advance of game state happens here, in the
// order render() used to run it. Render only draws.
function tickSim() {
  snap(player); snap(heroCar);
  const driving = player.mode === 'drive';
  tickClock(clock, STEP); tickStreet(street, STEP);
  tickZoning(city, STEP, street, occupiedParcel(interior));
  tickPeople(people, city);
  tickCommute(street, people, city, clock.hour, player.x, player.z);
  tickNews(news, city, people, street);
  tickCityView(cityView, city, STEP, input.keys);
  syncHackables(hackables, { map, street, city });
  if (driving) {
    braking = tickPlayerCar(heroCar, input.driveInput(), STEP, map).braking;
    camRig.easeDrive(heroCar.yaw, clock.elapsed, input, STEP);
  } else {
    tickPlayer(player, input.footInput(), STEP, map); tickInterior(interior, player);
  }
  tickSteam(steam, clock.elapsed, STEP); tickHackFx(fx, STEP);
  // DARK is sim truth about every power district, so it settles on the step.
  for (let z = 0; z < street.zones.length; z++) {
    const dark = isDark(street, z);
    if (DARK[z] !== dark) {
      DARK[z] = dark;
      missionOnBlackout(mission, DARK, street.time);
    }
  }
  const hx = driving ? heroCar.x : player.x, hz = driving ? heroCar.z : player.z;
  const suspect = {
    x: hx, z: hz, yaw: driving ? heroCar.yaw : player.yaw, inCar: driving, car: heroCar,
    body: driving ? heroCar : player, cover: isDark(street, districtAt(street, hx, hz)), night: clock.nightFactor,
  };
  if (!policeHold) lastWantedStatus = tickWanted(wanted, STEP, suspect, street.time, map);
  missionOnHeatZero(mission, wanted.heat, street.time);
  // A chase scares trade off the district it runs through (economy.js flee).
  chaseIn(city.economy, districtAt(street, hx, hz), wanted.heat);
  tickDispatch(dispatch, drainEvents(wanted), street.time);
  if (lastWantedStatus === 'busted' && !mission.complete) {
    missionReset(mission); missionNote(mission, 'BUSTED — contract reset', street.time, 3);
  }
  mission.balance += tickArc(arc, {
    x: hx, z: hz, inCar: driving, dark: DARK, heat: wanted.heat, profile: lastProfile?.name ?? null,
    parcels: city.parcels, busted: lastWantedStatus === 'busted',
  }, street.time);
}

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  // The sim sees the real frame delta and catches up in whole steps; the
  // render-side smoothing uses the clamped one so a stalled frame cannot jump.
  const frame = (now - last) / 1000, dt = Math.min(frame, 0.05);
  last = now;
  const driving = player.mode === 'drive';
  // A replay's log ends on a step, not a frame: advance caps the batch there.
  advance(fixed, frame, replay ? replay.end : Infinity);
  for (let i = 0; i < fixed.steps; i++) {
    if (replay) replay.feed(fixed.total);
    tickSim();
    fixed.total += 1;
  }
  // Stream against the camera; one frame of lag is nothing next to the gap.
  const eye = streamOrigin ?? camera.position;
  chunks.update(eye.x, eye.z);
  // Draw the actor between the last two fixed steps (M0-1), `alpha` of the way.
  blend(player, fixed.alpha, playerDraw); playerDraw.mode = player.mode;
  blend(heroCar, fixed.alpha, carDraw);
  // A road op replans the map's furniture (M5.T4b): rebuild the lamp rig and
  // the pools and smears merged from the old plan, so the street the player
  // just laid is lit like one the world was born with. The rebuild seats the
  // added lamps in the pools it already draws, so no extra draw lands (law 3).
  if (map.furniture !== lampPlan.furniture) {
    const wasCones = lamps.cones;
    lampPlan.furniture = map.furniture;
    lamps.rebuild(map);
    if (lamps.cones !== wasCones) {
      const at = fadedDraws.indexOf(wasCones);
      if (at >= 0) fadedDraws[at] = lamps.cones;
    }
    refreshLampDressing(lamps, lampPoolMeshes, streakMeshes, signs.streakSources);
  }
  // The frame's scene updates (M3.T4b) live in game/scene.js.
  updateScene(sceneCtx, { driving, braking, playerDraw, carDraw });
  const hx = driving ? carDraw.x : playerDraw.x, hz = driving ? carDraw.z : playerDraw.z;

  // Follow rig (M3.T3): the eye behind the drawn actor, aimed by the rig.
  HERO_BOX.x = carDraw.x;
  HERO_BOX.z = carDraw.z;
  const lookAt = camRig.placeFollowCamera(
    driving ? carDraw : playerDraw, driving, dt, driving ? CAM_BLOCKERS : WALK_BLOCKERS);
  // The registry aim (M6.T2): on the street the nearest registered thing in
  // the view cone and in sight is the pick the HUD highlights.
  const target = driving || interior.space !== STREET ? null
    : aimTarget(hackables, player.x, player.z, Math.sin(player.yaw), Math.cos(player.yaw));
  const person = target?.entry.kind === 'person' ? target.entry.ref : null;
  const targetPerson = person && people.list.length > 0
    ? people.list[street.npcs.indexOf(person) % people.list.length]
    : null;
  const doing = targetPerson ? commuteLabel(targetPerson, clock.hour) : null;
  // HUD (M3.T5): every panel writes here; the profile it returns feeds the mission.
  lastProfile = updateHud(hud, hudCtx, {
    driving, hx, hz, target, targetPerson, doing, nearHero: !driving && nearHero(),
  });
  showNews(newsLine, liveNews(news, street.time));
  if (lastProfile && lastProfile.name) missionOnProfile(mission, lastProfile.name);
  cityRig.frame(camera, lookAt, scene);
  // The planner's lot tint (M5.T21), after the overview has placed its camera,
  // on the same eased lift the camera blends by.
  overlayRig.frame(easeLift(cityView.lift));
  input.cityUi.update();
  syncHintLine();
  // The city's history panel (M5.T32b): the overview's own, painted from the
  // live economy every frame it is open, and put away the moment it closes.
  if (historyPanel.open) {
    if (cityView.mode === 'city') historyPanel.frame(city.economy);
    else historyPanel.toggle();
  }

  renderer.info.reset();
  // The city mirror re-shoots one cube face per frame, and only when stale — five
  // frames after a blackout, a flip or a block of travel; law 3 is the whole frame.
  if (cityMirrorStale(mirror, street.time, camera.position.x, camera.position.z)) {
    requestCityMirror(mirror, street.time, camera.position.x, camera.position.z);
  }
  if (lastDraws + MIRROR_FACE_DRAWS + MIRROR_MARGIN <= DRAW_BUDGET) tickCityMirror(renderer, scene, mirror);
  composer.render();
  lastDraws = renderer.info.render.calls;
  autosaveIn -= dt;
  if (autosaveIn <= 0) { autosaveIn = AUTOSAVE_SECS; doSave(); }
  tickHud(hud, hudCtx, {
    draws: lastDraws, tris: (renderer.info.render.triangles / 1e6).toFixed(2), dt, driving,
  });
  // The HUD's corners (M5.R1): which column each panel stands in, laid out
  // after tickHud has stacked the bottom-left ones upward.
  placeHudPanels(hud, historyPanel);
}
render();