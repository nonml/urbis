// Bootstrap: sim ticks, render reads. HUD shows measured numbers only.
import { SEED, GENERATE, SAVING } from './boot.js';
import { createFixedStep, advance, setSpeed, snap, blend, STEP } from './game/loop.js';
import { createRecorder, bindRecorder, loadReplay, createReplay } from './game/replay.js';
import { bindProbe } from './game/probe.js';
import { bindInput } from './game/input.js';
import { createFollowRig, CAM_PIVOT } from './game/camera.js';
import * as THREE from 'three';
import { createClock, tickClock } from './sim/clock.js';
import { createStreet, tickStreet, hackBlackout, hackCooldownLeft, isDark, zoneAt, profilerTarget } from './sim/street.js';
import { createPlayer, tickPlayer } from './sim/player.js';
import { WALK_BOUNDS, clampToBounds } from './sim/world.js';
import { createPlayerCar, tickPlayerCar } from './sim/vehicle.js';
import { createMission, missionOnBlackout, missionOnEnterCar, missionOnHeatZero, missionOnProfile, missionReset, missionNote } from './sim/mission.js';
import {
  createWanted, wantedOnBlackout, tickWanted, isBusted, drainEvents,
} from './sim/wanted.js';
import { createDispatch, tickDispatch } from './sim/dispatch.js';
import { createCity, tickZoning } from './sim/zoning.js';
import { createPeople, tickPeople } from './sim/people.js';
import { tickCommute, commuteLabel } from './sim/commute.js';
import { createNews, tickNews, liveNews } from './sim/news.js';
import { chaseIn } from './sim/economy.js';
import {
  STREET, createInterior, tickInterior, useDoor, occupiedParcel, doorEnds,
} from './sim/interior.js';
import { serialize, deserialize } from './sim/save.js';
import { loadSave, writeSave, clearSave } from './savestore.js';
import { buildScene, updateScene } from './game/scene.js';
import { buildDispatchHud, updateDispatchHud } from './ui/dispatch.js';
import { cityMirrorStale, requestCityMirror, tickCityMirror, tickSteam } from './render/setdress.js';
import { firePulse, fireSparks, tickHackFx } from './render/hackfx.js';
import { SUBSTATIONS } from './sim/anchors.js';
import { buildProfiler, updateProfiler } from './render/profiler.js';
import { createRenderer, createComposer, fitRenderer } from './render/atmosphere.js';
import { buildEconomyPanel, updateEconomyPanel } from './render/economy.js';
import { buildLotNote, showLotNote } from './render/lotnote.js';
import { buildNews, showNews } from './render/news.js';
import { focusParcel } from './sim/decline.js';
import { createCityView, tickCityView } from './sim/cityview.js';
import { buildDoorHud, updateDoorHud, fadeThroughDoor } from './render/doorhud.js';
import { createArc, tickArc } from './sim/arc.js';
import { buildArcUI, updateArcUI } from './render/arcui.js';

const DRAW_BUDGET = 175;
// One cube face of the reflection world, measured; the margin is the room a
// spawn needs to land in the same frame without the probe pushing it over.
const MIRROR_FACE_DRAWS = 4;
const MIRROR_MARGIN = 10;
let lastDraws = 0;
const bootStart = performance.now();

const canvas = document.getElementById('scene');
const CAPTURE = new URLSearchParams(location.search).has('capture');
const RECORD = new URLSearchParams(location.search).has('record');
const REPLAY = new URLSearchParams(location.search).get('replay');
const renderer = createRenderer(canvas, { preserveDrawingBuffer: CAPTURE });
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const texLoader = new THREE.TextureLoader();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);

// Sim state (restored or generated) is created before the scene: assembly reads
// it, and the save is the source of truth for what city this is.
const restored = SAVING ? deserialize(loadSave()) : null;
const street = restored?.street ?? createStreet(SEED);
const city = restored?.city ?? createCity(SEED);
const people = restored?.people ?? createPeople(SEED);
const player = restored?.player ?? createPlayer();
player.mode ??= 'foot';
const heroCar = restored?.car ?? createPlayerCar();
const mission = restored?.mission ?? createMission();
const arc = createArc();
const wanted = createWanted();
let lastWantedStatus = 'clean';
const dispatch = createDispatch(20260916);
const news = createNews();
const clock = restored?.clock ?? createClock();
// Verticality: the noodle bar behind the RAMEN board and the roof next door,
// plus a street door and a room on every grown lot (sim/interior.js).
const interior = restored?.interior ?? createInterior(city);
interior.city = city;
const cityView = createCityView(city);

// Scene assembly (M3.T4a) lives in game/scene.js; it takes the sim state and
// returns every handle the frame loop, probe and city view read.
const renderParts = buildScene({ scene, renderer, texLoader, maxAniso, city, street, heroCar, cityView });
const {
  env, spots, groundMats, markingMats, towers, skyline, stars, outskirts, chunks,
  beacons, signs, signPoolMeshes, lamps, streakMeshes, carStreaks, lampPoolMeshes,
  fadedDraws, growth, vacant, decline, arcMarker, npcRig, traffic, heroRig, police,
  avatar, shops, interiors, puddles, mirror, blobs, steam, fx, rain, heroKey, cityRig,
} = renderParts;
// The probe can pin the streamer's origin; null follows the camera.
let streamOrigin = null;

// The HUD's own builders stay in main.js until M3.T5 moves them to game/hud.js.
const economyPanel = buildEconomyPanel();
const lotNote = buildLotNote();
const newsLine = buildNews();
const arcUI = buildArcUI();
const radio = buildDispatchHud();
let policeHold = false;
const doorHud = buildDoorHud();
buildProfiler();

const prompt = document.createElement('div');
prompt.id = 'prompt';
prompt.style.cssText = [
  'position:fixed', 'bottom:44px', 'left:50%', 'transform:translateX(-50%)',
  'display:none', 'font:600 13px ui-monospace,Menlo,monospace', 'letter-spacing:0.12em',
  'color:#fff', 'background:rgba(3,10,18,0.8)', 'border:1px solid rgba(84,240,255,0.6)',
  'padding:8px 18px', 'border-radius:20px', 'text-shadow:0 0 8px rgba(84,240,255,0.7)',
].join(';');
prompt.textContent = 'F · DRIVE';
document.body.appendChild(prompt);

const missionPanel = document.createElement('div');
missionPanel.id = 'mission';
missionPanel.style.cssText = [
  'position:fixed', 'top:12px', 'right:12px', 'pointer-events:none', 'z-index:5',
  'font:11px/1.7 ui-monospace,Menlo,monospace', 'letter-spacing:0.05em',
  'color:#ffd9a0', 'background:rgba(12,8,3,0.72)',
  'border:1px solid rgba(255,177,78,0.4)', 'border-left:3px solid #ffb14e',
  'padding:7px 12px', 'border-radius:4px',
  'text-shadow:0 0 6px rgba(255,177,78,0.5)',
].join(';');
document.body.appendChild(missionPanel);

const banner = document.createElement('div');
banner.id = 'banner';
banner.style.cssText = [
  'position:fixed', 'top:34%', 'left:50%', 'transform:translateX(-50%)',
  'display:none', 'pointer-events:none', 'z-index:6',
  'font:600 26px ui-monospace,Menlo,monospace', 'letter-spacing:0.2em',
  'color:#fff', 'text-shadow:0 0 18px rgba(84,240,255,0.9),0 0 46px rgba(84,240,255,0.5)',
].join(';');
document.body.appendChild(banner);

const { composer, bloom, grade } = createComposer(renderer, scene, camera);
window.addEventListener('resize', () => fitRenderer(renderer, composer, camera, grade));

// The one context the per-frame scene update reads (M3.T4b): sim state, every
// render handle from buildScene, and the composer passes it drives.
const sceneCtx = {
  ...renderParts, scene, renderer, camera, bloom, grade,
  city, street, clock, interior, wanted, arc, heroCar, player, cityView,
};

// Follow cam (M3.T3) lives in game/camera.js: the rig, its drag-to-orbit and
// dolly, the interior rigs and the per-frame placement. Lower and closer than
// before — towers loom, street glow fills the frame (oracle camera note).
const camRig = createFollowRig({ camera, interior });
const cam = camRig.cam;

// Input (M3.T2) lives in game/input.js: keys, mouse, the city-view binding and
// the foot/car reads. Its drag and wheel deltas go to the follow rig's own
// look/dolly (game/camera.js), so this file only wires the two together.
// A capture holds the clock so the same seed, pose and hour reproduce: a shot
// must not drift through the day while the rasteriser crawls.
if (CAPTURE) clock.rate = 0;
const input = bindInput({
  canvas, cam, camera, city, cityRig, cityView, street, clock, interior, arc, arcUI,
  look: camRig.look, dolly: camRig.dolly, fireHack, toggleVehicle, enterDoor, newGame,
});
// Dev spawn presets for scripted verification (?spawn=east). A continued game
// stands where the save left it, so the preset never overrides a load.
const spawnPreset = restored ? null : new URLSearchParams(location.search).get('spawn');
if (spawnPreset === 'east') {
  player.x = 49.5;
  player.z = 16;
} else if (spawnPreset === 'shop') {
  player.x = 3.5;
  player.z = 7;
} else if (spawnPreset === 'promenade') {
  player.x = -6;
  player.z = -32;
  cam.yaw = -Math.PI / 2;
} else if (spawnPreset === 'west') {
  player.x = -42;
  player.z = 0;
  cam.yaw = Math.PI;
} else if (spawnPreset === 'north') {
  player.x = 2;
  player.z = 70;
  cam.yaw = Math.PI;
} else if (spawnPreset === 'westflank') {
  // The ground the river channel used to cut, looking across it: verge swell
  // now, no trench, nothing to fall into.
  player.x = -36.5;
  player.z = -60;
  cam.yaw = Math.PI / 2;
} else if (spawnPreset === 'mound') {
  // The crest of the pocket park, the highest ground a person can stand on.
  player.x = 67;
  player.z = 17;
  cam.yaw = -Math.PI / 2;
} else if (spawnPreset === 'cross') {
  // Middle of the z=40 intersection, looking east down the E-W canyon
  // (cross traffic + lamps + both road axes in one frame).
  player.x = 0;
  player.z = 40;
  cam.yaw = Math.PI / 2;
} else if (spawnPreset === 'edge') {
  // The two corners of the walk box that look out of town: the south-east
  // limit facing east, and the south edge of the connector facing south. Both
  // are ordinary play positions with the ordinary follow cam — the outskirts
  // have to survive being looked at from where the player can actually stand,
  // not from a staged lab angle (AGENTS.md step 5).
  player.x = 70;
  player.z = -66;
  cam.yaw = Math.PI / 2;
  cam.pitch = 0.32;
  cam.dist = 8;
} else if (spawnPreset === 'edge-s') {
  player.x = -20;
  player.z = -66;
  cam.yaw = Math.PI;
  cam.pitch = 0.32;
  cam.dist = 8;
} else if (spawnPreset === 'site') {
  // The west edge of the walk box, looking east across the flank verge at the
  // two south-west growth lots: the one long open view onto a site, so the crane
  // and the building it raises fit in one frame. Wheeled all the way out and
  // looking level, the way a player stops to watch something go up.
  player.x = -52;
  player.z = -60;
  cam.yaw = Math.PI / 2;
  cam.pitch = 0.08;
  cam.dist = 14;
} else if (spawnPreset?.startsWith('door-')) {
  // Where leaving a street door puts you (?spawn=door-ramen-front), turned back
  // to face it: frames the door on any world, wherever its tower stands.
  const end = doorEnds().find((e) => e.door === spawnPreset.slice(5) && e.space === STREET);
  if (end) {
    player.x = end.arrive.x;
    player.z = end.arrive.z;
    player.yaw = end.arrive.yaw + Math.PI;
    cam.yaw = player.yaw;
  }
}

const DARK = [false, false];

function fireHack() {
  const driving = player.mode === 'drive';
  const px = driving ? heroCar.x : player.x;
  const pz = driving ? heroCar.z : player.z;
  const zone = zoneAt(pz);
  if (hackBlackout(street, zone) === 0) return;
  wantedOnBlackout(wanted, px, pz, street.time);
  firePulse(fx, px, pz);
  const sub = SUBSTATIONS.find((s) => s.zone === zone);
  fireSparks(fx, sub.x, 1.6, sub.z, street.time, 0, 12);
  // Companion burst at the lamp head nearest the player — the visible one.
  let best = null;
  let bestD = 1e9;
  for (const h of lamps.heads) {
    const d = Math.hypot(h.x - px, h.z - pz);
    if (d < bestD) { bestD = d; best = h; }
  }
  if (best) fireSparks(fx, best.x, 0.5, best.z, street.time, 12, 12);
  steam.erupt[zone] = 1;
  missionOnBlackout(mission, DARK, street.time);
}

// Per-frame zone power driver: DARK follows sim truth; every light answers.

function nearHero() {
  return interior.space === STREET && Math.hypot(heroCar.x - player.x, heroCar.z - player.z) < 3.4;
}

// E: through the door in reach, if there is one. The cut is immediate; the
// camera snaps to the new space's rig behind the player (game/camera.js) and a
// short fade covers the jump.
function enterDoor() {
  if (player.mode !== 'foot' || !useDoor(interior, player)) return;
  // The door teleports; snap the draw pose to it so no frame blends the walk
  // from the far side of the threshold.
  snap(player);
  camRig.enterSpace(player);
  lockedNpc = null;
  fadeThroughDoor(doorHud);
}

function toggleVehicle() {
  if (player.mode === 'foot' && nearHero()) {
    player.mode = 'drive';
    avatar.group.visible = false;
    missionOnEnterCar(mission);
    camRig.enterDrive();
  } else if (player.mode === 'drive') {
    player.mode = 'foot';
    ({ x: player.x, z: player.z } = clampToBounds(WALK_BOUNDS, heroCar.x + 1.8, heroCar.z));
    player.speed = 0;
    // A step snap, not a step: without it the drawn avatar would blend from
    // where it last stood on foot, possibly across the map.
    snap(player);
    avatar.group.visible = true;
    camRig.exitDrive();
  }
}

const hud = document.getElementById('hud');
let lastProfile = null;
let lockedNpc = null;

// Save and continue: the sim serializes itself (src/sim/save.js) and this
// decides when — every 30 s of play, and the moment the tab goes away.
// Writing is never worth crashing over (src/savestore.js).
const AUTOSAVE_SECS = 30;
let autosaveIn = AUTOSAVE_SECS;
// Set while a new game wipes the save: the document going down fires
// visibilitychange one last time, and without this it would write the old game
// straight back after newGame cleared it.
let wiping = false;

function doSave() {
  if (!SAVING || wiping) return false;
  return writeSave(serialize({ seed: SEED, generate: GENERATE, clock, street, city, player, car: heroCar, interior, mission, people }));
}

// N: a new game is a new city (AGENTS.md). The save goes, and so does any
// ?seed replay URL, so boot draws a fresh seed.
function newGame() {
  wiping = true;
  clearSave();
  const url = new URL(location.href);
  url.searchParams.delete('seed');
  location.href = url.toString();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) doSave();
});

// M0-1 record/replay: the recorder and the loaded replay are assigned with the
// fixed step below; the probe takes them as live readings.
let recorder = null;
let replay = null;
let replayErr = null;

chunks.warm(player.x, player.z);

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fpsShown = 0;
let hudTimer = 0;
let firstFrame = true;
let bootMs = 0;
let braking = false;

// M0-1 fixed step: the accumulator, and the reusable poses render() blends the
// hero between the last two steps into.
const fixed = createFixedStep();
const bootSpeed = fixed.speed;
// ?record=1 keeps every input with the step it landed on; ?replay=<name> feeds
// tests/replays/<name>.json back by step. A replay boots frozen until its log
// is in, so no step can run without its events.
if (RECORD) {
  recorder = createRecorder(() => fixed.total);
  bindRecorder(recorder, canvas);
}
if (REPLAY) {
  setSpeed(fixed, 0);
  loadReplay(REPLAY)
    .then((log) => { replay = createReplay(log, canvas); setSpeed(fixed, bootSpeed); })
    .catch((e) => { replayErr = String(e); setSpeed(fixed, bootSpeed); });
}

// The scripted-verification surface (M3.T1) lives in game/probe.js; this is the
// one object it takes — game state, render handles, and the live readings and
// writes it cannot get by value (a probe sets the police hold and the stream
// origin, and reads the profile, the pursuit status and the record/replay log).
bindProbe({
  capture: CAPTURE,
  seed: SEED,
  generate: GENERATE,
  save: doSave,
  camera,
  cam,
  renderer,
  scene,
  fireHack,
  toggleVehicle,
  enterDoor,
  dark: DARK,
  camPivot: CAM_PIVOT,
  street,
  city,
  people,
  player,
  car: heroCar,
  mission,
  wanted,
  dispatch,
  interior,
  clock,
  news,
  arc,
  cityView,
  cityRig,
  fixed,
  composer,
  avatar,
  towers,
  skyline,
  growth,
  decline,
  lotNote,
  police,
  chunks,
  outskirts,
  getProfile: () => lastProfile,
  getWantedStatus: () => lastWantedStatus,
  getInputLog: () => (recorder ? recorder.log(SEED) : null),
  isReplayDone: () => !!replay && fixed.total >= replay.end,
  getReplayError: () => replayErr,
  setPoliceHold: (on) => { policeHold = on; },
  setStreamOrigin: (x, z) => { streamOrigin = x === null ? null : { x, z }; },
});
const playerDraw = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, walkPhase: 0, mode: 'foot' };
const carDraw = { x: 0, y: 0, z: 0, yaw: 0, speed: 0 };

// Sticky profiler lock: acquire by facing cone, hold while within 14m.
function acquireTarget() {
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  if (lockedNpc) {
    const d = Math.hypot(lockedNpc.x - player.x, lockedNpc.z - player.z);
    if (d <= 14 && d >= 0.4) return { npc: lockedNpc, dist: d };
    lockedNpc = null;
  }
  const t = profilerTarget(street, player.x, player.z, fx, fz);
  if (t) lockedNpc = t.npc;
  return t;
}

function hackStatus() {
  const zone = zoneAt(player.mode === 'drive' ? heroCar.z : player.z);
  const left = hackCooldownLeft(street, zone);
  if (DARK[0] || DARK[1]) {
    const z = DARK[0] ? 0 : 1;
    const s = Math.max(0, street.zones[z].darkUntil - street.time);
    return `BLACKOUT Z${z} ${s.toFixed(0)}s`;
  }
  if (left > 0) return `recharge ${left.toFixed(0)}s`;
  return 'READY';
}

// One fixed sim step (M0-1). Everything that advances game state happens here,
// in the order render() used to run it, with the step for a timestep. The
// camera's drive easing and the hero's braking ride the step too so a replay of
// input by step reproduces the same world; render only draws.
function tickSim() {
  snap(player);
  snap(heroCar);
  const driving = player.mode === 'drive';
  tickClock(clock, STEP);
  tickStreet(street, STEP);
  tickZoning(city, STEP, street, occupiedParcel(interior));
  tickPeople(people, city);
  tickCommute(street, people, city, clock.hour, player.x, player.z);
  tickNews(news, city, people, street);
  tickCityView(cityView, city, STEP, input.keys);
  if (driving) {
    braking = tickPlayerCar(heroCar, input.driveInput(), STEP).braking;
    camRig.easeDrive(heroCar.yaw, clock.elapsed, input, STEP);
  } else {
    tickPlayer(player, input.footInput(), STEP);
    tickInterior(interior, player);
  }
  tickSteam(steam, clock.elapsed, STEP);
  tickHackFx(fx, STEP);
  // DARK is sim truth about the two zones, so it settles on the step and the
  // effects of it (mission notes) are step for step reproducible.
  for (let z = 0; z < 2; z++) {
    const dark = isDark(street, z);
    if (DARK[z] !== dark) {
      DARK[z] = dark;
      missionOnBlackout(mission, DARK, street.time);
    }
  }
  const hx = driving ? heroCar.x : player.x;
  const hz = driving ? heroCar.z : player.z;
  // A hack pulls the units to the scene of it: wantedOnBlackout sets the search there.
  const suspect = {
    x: hx, z: hz, yaw: driving ? heroCar.yaw : player.yaw, inCar: driving, car: heroCar,
    body: driving ? heroCar : player, cover: isDark(street, zoneAt(hz)), night: clock.nightFactor,
  };
  if (!policeHold) lastWantedStatus = tickWanted(wanted, STEP, suspect, street.time);
  missionOnHeatZero(mission, wanted.heat, street.time);
  // A chase scares trade off the district it runs through (economy.js flee).
  chaseIn(city.economy, zoneAt(hz), wanted.heat);
  tickDispatch(dispatch, drainEvents(wanted), street.time);
  if (lastWantedStatus === 'busted' && !mission.complete) {
    missionReset(mission);
    missionNote(mission, 'BUSTED — contract reset', street.time, 3);
  }
  mission.balance += tickArc(arc, {
    x: hx, z: hz, inCar: driving, dark: DARK, heat: wanted.heat, profile: lastProfile?.name ?? null,
    parcels: city.parcels, busted: lastWantedStatus === 'busted',
  }, street.time);
}

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  // The sim sees the real frame delta and catches up in whole steps (capped at
  // MAX_STEPS, so a slow frame cannot fast-forward the world); the render-side
  // smoothing below still uses the clamped one, because a stalled frame must
  // not make the follow cam jump.
  const frame = (now - last) / 1000;
  const dt = Math.min(frame, 0.05);
  last = now;
  const driving = player.mode === 'drive';
  // A replay's log ends on a step, not a frame: advance caps the batch there
  // and feed puts each event back just before its step (M0-1).
  advance(fixed, frame, replay ? replay.end : Infinity);
  for (let i = 0; i < fixed.steps; i++) {
    if (replay) replay.feed(fixed.total);
    tickSim();
    fixed.total += 1;
  }
  // Stream against the camera, because the camera is what the frustum belongs
  // to. It is last frame's position; at a 160 m build radius one frame of lag
  // is 0.2 m of a 224 m hysteresis gap and nothing can see it.
  const eye = streamOrigin ?? camera.position;
  chunks.update(eye.x, eye.z);
  // Draw the actor between the last two fixed steps (M0-1): the sim moved in
  // whole 50 ms steps and this frame sits `alpha` of the way to the next.
  blend(player, fixed.alpha, playerDraw);
  playerDraw.mode = player.mode;
  blend(heroCar, fixed.alpha, carDraw);
  // The whole frame's scene updates (M3.T4b) — actors, zone light, street
  // dressing, atmosphere, growth, traffic and pursuit — live in game/scene.js.
  updateScene(sceneCtx, { driving, braking, playerDraw, carDraw });
  const hx = driving ? carDraw.x : playerDraw.x;
  const hz = driving ? carDraw.z : playerDraw.z;
  updateEconomyPanel(economyPanel, city);
  updateDispatchHud(radio, dispatch, street.time);
  updateArcUI(arcUI, arc, hx, hz, street.time);

  // Follow rig (M3.T3): the eye behind the drawn actor, the interior frame and
  // the look point the city view aims with; it owns cam.ground's ease.
  const lookAt = camRig.placeFollowCamera(driving ? carDraw : playerDraw, driving, dt);

  const target = driving || interior.space !== STREET ? null : acquireTarget();
  const targetPerson = target && people.list.length > 0
    ? people.list[street.npcs.indexOf(target.npc) % people.list.length]
    : null;
  lastProfile = driving ? null : updateProfiler(camera, target, targetPerson, targetPerson ? commuteLabel(targetPerson, clock.hour) : null);
  showLotNote(lotNote, interior.space === STREET
    ? focusParcel(city.parcels, hx, hz, Math.sin(cam.yaw), Math.cos(cam.yaw)) : null);
  showNews(newsLine, liveNews(news, street.time));
  if (lastProfile && lastProfile.name) missionOnProfile(mission, lastProfile.name);
  if (driving && lockedNpc) lockedNpc = null;
  if (driving) {
    prompt.textContent = 'F · EXIT CAR';
    prompt.style.display = 'block';
  } else if (nearHero()) {
    prompt.textContent = 'F · DRIVE';
    prompt.style.display = 'block';
  } else {
    prompt.style.display = 'none';
  }
  cityRig.frame(camera, lookAt, scene);
  input.cityUi.update();
  updateDoorHud(doorHud, driving ? null : interior.near);

  renderer.info.reset();
  // The city mirror re-shoots one cube face per frame, and only when it has gone
  // stale: five frames of one extra pass after a blackout, a day/night flip, or a
  // block of travel. Steady state is zero. A face only goes in if the last frame
  // left room for it — law 3 is the whole frame, probe included.
  if (cityMirrorStale(mirror, street.time, camera.position.x, camera.position.z)) {
    requestCityMirror(mirror, street.time, camera.position.x, camera.position.z);
  }
  if (lastDraws + MIRROR_FACE_DRAWS + MIRROR_MARGIN <= DRAW_BUDGET) {
    tickCityMirror(renderer, scene, mirror);
  }
  composer.render();
  if (firstFrame) {
    firstFrame = false;
    bootMs = Math.round(now - bootStart);
  }
  lastDraws = renderer.info.render.calls;
  fpsAcc += dt;
  fpsN++;
  hudTimer += dt;
  autosaveIn -= dt;
  if (autosaveIn <= 0) {
    autosaveIn = AUTOSAVE_SECS;
    doSave();
  }
  if (hudTimer > 0.25) {
    fpsShown = Math.round(fpsN / fpsAcc);
    fpsAcc = 0;
    fpsN = 0;
    hudTimer = 0;
    const draws = renderer.info.render.calls;
    const tris = (renderer.info.render.triangles / 1e6).toFixed(2);
    const over = draws > DRAW_BUDGET;
    const speedLine = driving ? ` · ${Math.abs(heroCar.speed * 3.6).toFixed(0)} km/h` : '';
    const stars = '★'.repeat(wanted.heat) + '☆'.repeat(3 - wanted.heat);
    const busted = isBusted(wanted, street.time);
    const hh = String(Math.floor(clock.hour)).padStart(2, '0');
    const mm = String(Math.floor((clock.hour % 1) * 60)).padStart(2, '0');
    hud.innerHTML =
      `<b>URBIS</b> · ${hh}:${mm} ${clock.nightFactor > 0.5 ? '☾ night' : '☀ day'} · rain<br>` +
      `draws <b class="${over ? 'warn' : ''}">${draws}</b> / ${DRAW_BUDGET} · ` +
      `${fpsShown} fps · ${tris}M tris<br>` +
      `H · blackout [${hackStatus()}]${speedLine} · N · new game<br>` +
      `<span class="${wanted.heat > 0 ? 'warn' : ''}">${stars}</span> · ₡${mission.balance}`;
    const obj = mission.phases.map((p, i) => `${mission.done[i] ? '✓' : '·'} ${p}`).join('<br>');
    missionPanel.innerHTML = `<b>◈ ${mission.id}</b><br>${obj}`;
    missionPanel.style.display = mission.complete && street.time > mission.bannerUntil ? 'none' : 'block';
    if (busted) {
      banner.textContent = 'BUSTED';
      banner.style.display = 'block';
    } else if (street.time < mission.bannerUntil) {
      banner.textContent = mission.bannerText;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }
}
render();
