// Bootstrap: sim ticks, render reads. HUD shows measured numbers only.
import { SEED, GENERATE, SAVING } from './boot.js';
import * as THREE from 'three';
import { createClock, tickClock, toggleDay } from './sim/clock.js';
import { createStreet, tickStreet, hackBlackout, hackCooldownLeft, isDark, zoneAt, profilerTarget, zonePhase, zoneGlow, blink } from './sim/street.js';
import { createPlayer, tickPlayer } from './sim/player.js';
import { WALK_BOUNDS, clampToBounds, heightAt } from './sim/world.js';
import { createPlayerCar, tickPlayerCar } from './sim/vehicle.js';
import { createMission, missionOnBlackout, missionOnEnterCar, missionOnHeatZero, missionOnProfile, missionReset, missionNote } from './sim/mission.js';
import {
  createWanted, wantedOnBlackout, tickWanted, isBusted, drainEvents, forceTier, forceSearch,
} from './sim/wanted.js';
import { createDispatch, tickDispatch } from './sim/dispatch.js';
import { createCity, tickZoning, builtHeight, STAGES } from './sim/zoning.js';
import { createPeople, tickPeople, census, describe } from './sim/people.js';
import { tickCommute, commuteLabel } from './sim/commute.js';
import { createNews, tickNews, liveNews } from './sim/news.js';
import { districtReport } from './sim/economy.js';
import {
  STREET, createInterior, tickInterior, useDoor, isIndoors, currentPlace, frameCamera,
  occupiedParcel, syncInterior, doorEnds,
} from './sim/interior.js';
import { serialize, deserialize } from './sim/save.js';
import { loadSave, writeSave, clearSave } from './savestore.js';
import { buildGround, buildTowers, buildSkyline } from './render/block.js';
import { buildSigns, buildPools } from './render/signs.js';
import { buildLamps } from './render/lamps.js';
import { buildNPCs, updateNPCs } from './render/npcs.js';
import { buildTraffic, updateTraffic, updateCarPools, buildPlayerCar, updatePlayerCar } from './render/traffic.js';
import { buildPolice, updatePolice } from './render/police.js';
import { buildDispatchHud, updateDispatchHud } from './ui/dispatch.js';
import { buildPlayer, updatePlayer } from './render/player.js';
import {
  buildShops, buildPuddles, setPuddleGlow, buildCityMirror, showInMirror, onlyInMirror,
  cityMirrorStale, requestCityMirror, tickCityMirror, buildSteam, tickSteam, buildBeacons, buildStars,
} from './render/setdress.js';
import { buildHackFx, firePulse, fireSparks, tickHackFx, setSlit } from './render/hackfx.js';
import { SUBSTATIONS } from './sim/anchors.js';
import { buildStreaks, buildCarStreaks, updateCarStreaks } from './render/streaks.js';
import { loadPropInstances, buildTrees } from './render/props.js';
import { buildProfiler, updateProfiler } from './render/profiler.js';
import { buildBlobs, updateBlobs } from './render/blobs.js';
import { buildRain, tickRain } from './render/rain.js';
import { captureFrame } from './render/capture.js';
import { createRenderer, buildAtmosphere, updateDaylight, createComposer, fitRenderer } from './render/atmosphere.js';
import { buildGrassGround, buildGrassTufts, buildMountains } from './render/landscape.js';
import { createChunkManager } from './render/chunks.js';
import { buildOutskirts } from './render/outskirts.js';
import { buildZoning } from './render/zoning.js';
import { drawLedger } from './render/ledger.js';
import { hideFaded } from './render/faded.js';
import { buildEconomyPanel, updateEconomyPanel } from './render/economy.js';
import { buildDecline } from './render/decline.js';
import { buildLotNote, showLotNote } from './render/lotnote.js';
import { buildNews, showNews } from './render/news.js';
import { focusParcel, pinDemand } from './sim/decline.js';
import { createCityView, cityKey, tickCityView } from './sim/cityview.js';
import { buildCityView } from './render/cityview.js';
import { bindCityView } from './ui/cityview.js';
import { buildInteriors, updateInteriors } from './render/interior.js';
import { buildDoorHud, updateDoorHud, fadeThroughDoor } from './render/doorhud.js';
import { ARC, createArc, tickArc, arcChoose, arcTarget, arcSigns, arcSnapshot, arcSkipStep } from './sim/arc.js';
import { buildArcMarker, updateArcMarker } from './render/arc.js';
import { buildArcUI, updateArcUI, toggleJournal } from './render/arcui.js';

const DRAW_BUDGET = 175;
// One cube face of the reflection world, measured; the margin is the room a
// spawn needs to land in the same frame without the probe pushing it over.
const MIRROR_FACE_DRAWS = 4;
const MIRROR_MARGIN = 10;
let lastDraws = 0;
const bootStart = performance.now();

const canvas = document.getElementById('scene');
const CAPTURE = new URLSearchParams(location.search).has('capture');
const renderer = createRenderer(canvas, { preserveDrawingBuffer: CAPTURE });
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const texLoader = new THREE.TextureLoader();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);

const env = buildAtmosphere(scene, renderer);
const spots = env.spots;
const ground = buildGround(texLoader, maxAniso);
scene.add(ground.group);
const groundMats = ground.mats;
const markingMats = ground.markings;
const towers = buildTowers(texLoader, maxAniso);
scene.add(towers.group);
const skyline = buildSkyline(texLoader, maxAniso);
scene.add(skyline.mesh);
const stars = buildStars();
scene.add(stars);
scene.add(buildGrassGround());
scene.add(buildGrassTufts());
scene.add(buildMountains());
// Streamed world. The outskirts own their meshes for the whole game — a tile
// borrows instance slots in them, so residency changes cost zero draws — and
// the manager only decides which tiles have claimed any. Two tiles a frame and
// 1.5 ms is the whole build allowance; boot warms the spawn's ring up front so
// frame one is not a half-built world.
const outskirts = buildOutskirts();
for (const m of outskirts.meshes) scene.add(m);
const chunks = createChunkManager({ scene, budgetTiles: 2, budgetMs: 1.5 });
chunks.register('outskirts', outskirts.build);
let streamOrigin = null;
const beacons = buildBeacons(towers.beacons);
scene.add(beacons.mesh);
scene.add(buildTrees());
// Props resolve a frame or two after boot — the loop never touches them.
Promise.all([
  loadPropInstances('assets/models/fire_hydrant/fire_hydrant_1k.gltf', [
    [-6.9, -50], [6.9, -15], [-6.9, 20], [6.9, 45], [37.1, -40],
    [50.9, -5], [37.1, 25], [50.9, 48], [-2, -69.5], [30, -69.5],
  ]),
  loadPropInstances('assets/models/metal_trash_can/metal_trash_can_1k.gltf', [
    [-5.9, -44], [-5.9, -26], [5.9, -8], [5.9, 10], [-5.9, 28], [-5.9, 46],
    [38.1, -44], [49.9, -8], [38.1, 28], [49.9, 46], [8, -69], [36, -69],
  ]),
]).then(([hydrants, trash]) => scene.add(hydrants, trash));
const signs = buildSigns();
scene.add(signs.group);
const signPoolMeshes = [0, 1].map((zone) => {
  const m = buildPools([...signs.pools, ...towers.shopPools].filter((q) => q.zone === zone));
  scene.add(m);
  return m;
});
const lamps = buildLamps();
scene.add(lamps.group);
const streakMeshes = buildStreaks([
  ...signs.streakSources,
  ...lamps.heads.map((h) => ({ x: h.x, z: h.z, color: '#c98a4a', len: 9, width: 1.3 })),
]);
for (const m of streakMeshes) scene.add(m);
const carStreaks = buildCarStreaks();
scene.add(carStreaks.mesh);
const lampPoolMeshes = lamps.poolsByZone.map((quads) => {
  const m = buildPools(quads);
  scene.add(m);
  return m;
});
// Faded to nothing by day, and per zone in a blackout: skipped, not drawn clear.
const fadedDraws = [...lampPoolMeshes, ...signPoolMeshes, ...streakMeshes, stars, lamps.cones, env.moonGlow];

// The seed (and whether this is a saved game) was settled in boot.js, before the
// world was built from it; here the saved city and street are restored on top.
const restored = SAVING ? deserialize(loadSave()) : null;
const street = restored?.street ?? createStreet(SEED);
const city = restored?.city ?? createCity(SEED);
const people = restored?.people ?? createPeople(SEED);
const growth = buildZoning(city, towers.kinds, towers.footprints);
scene.add(growth.group);
const economyPanel = buildEconomyPanel();
const decline = buildDecline(city, maxAniso);
scene.add(decline.mesh);
const lotNote = buildLotNote();
const news = createNews();
const newsLine = buildNews();
const player = restored?.player ?? createPlayer();
player.mode ??= 'foot';
const heroCar = restored?.car ?? createPlayerCar();
const mission = restored?.mission ?? createMission();
const arc = createArc();
const arcMarker = buildArcMarker(ARC.signs);
scene.add(arcMarker.mesh);
const arcUI = buildArcUI();
const wanted = createWanted();
let lastWantedStatus = 'clean';
const npcRig = buildNPCs(street);
scene.add(npcRig.group);
const traffic = buildTraffic(street);
scene.add(traffic.group);
const heroRig = buildPlayerCar(scene, heroCar);
scene.add(heroRig.group);
const police = buildPolice(scene);
const dispatch = createDispatch(20260916);
const radio = buildDispatchHud();
let policeHold = false;
const avatar = buildPlayer();
scene.add(avatar.group);
const shops = buildShops(texLoader, maxAniso);
scene.add(shops.group);
// Verticality: the noodle bar behind the RAMEN board and the roof next door,
// plus a street door and a room on every grown lot (sim/interior.js).
const interior = restored?.interior ?? createInterior(city);
interior.city = city;
const interiors = buildInteriors(city);
scene.add(interiors.group);
const doorHud = buildDoorHud();
const puddles = buildPuddles();
scene.add(puddles.group);
const mirror = buildCityMirror();
for (const m of puddles.mats) m.envMap = mirror.texture;
// The reflection world (VGA-002): sky, skyline, the two merged tower proxies
// and the alley washes — what a near-horizontal mirror ray off road water can
// actually hit. Sign faces sit too high to land in a puddle; their road read is
// the VGA-001 streaks. Lights ride along at +0 draws, or the probe renders
// unlit facades and every mirror comes back black but for the emissive windows.
showInMirror(env.skyMesh, skyline.mesh);
onlyInMirror(...towers.mirrorProxies);
for (const proxy of towers.mirrorProxies) scene.add(proxy);
showInMirror(env.sun, env.moon, env.bounce, env.hemi, ...spots);
signs.group.traverse((o) => { if (o.isMesh && o.userData.mirror) showInMirror(o); });
const blobs = buildBlobs(street);
scene.add(blobs);
const steam = buildSteam();
scene.add(steam.group);
const fx = buildHackFx();
scene.add(fx.group);
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

const rain = buildRain();
scene.add(rain);
// Hero key: a small warm light riding the player so the closest object in
// every frame never dissolves into the dark. Scaled by night, +0 draws.
const heroKey = new THREE.PointLight(0xffe0c0, 0, 11, 2);
heroKey.layers.enable(1);
scene.add(heroKey);

const { composer, bloom, grade } = createComposer(renderer, scene, camera);
window.addEventListener('resize', () => fitRenderer(renderer, composer, camera, grade));

// Follow cam: lower and closer than before — towers loom, street glow fills
// the frame (oracle camera note). Drag looks, wheel dollies. WASD moves.
const cam = { yaw: Math.PI, pitch: 0.18, dist: 4.5, ground: 0 };
let dragging = false;
let lastDragT = -10;
let lastPX = 0;
let lastPY = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastPX = e.clientX; lastPY = e.clientY; });
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  cam.yaw -= (e.clientX - lastPX) * 0.005;
  cam.pitch = Math.max(0.08, Math.min(1.2, cam.pitch + (e.clientY - lastPY) * 0.004));
  lastPX = e.clientX;
  lastPY = e.clientY;
  lastDragT = clock.elapsed;
});
window.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  cam.dist = Math.max(3, Math.min(14, cam.dist * (1 + e.deltaY * 0.001)));
}, { passive: true });

// City view (Z): the same world from above, where the player zones the lots.
const cityView = createCityView(city);
const cityRig = buildCityView(city, cityView);
scene.add(cityRig.mesh);
const cityUi = bindCityView({ canvas, cam, camera, city, street, view: cityView, rig: cityRig });

const keys = new Set();
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
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const DARK = [false, false];
// The zone light the city mirror was last shot under, 1 lit or 0 dead.
const MIRRORED = [1, 1];

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

// The follow cam's street framing, put back when the player comes out.
const STREET_RIG = { dist: 4.5, pitch: 0.18 };
// Where the camera pivots in a space: the player's head.
const CAM_PIVOT = 1.6;
// How far the rain box reaches below a player up on a roof.
const ROOF_RAIN_BELOW = 12;

// E: through the door in reach, if there is one. The cut is immediate; the
// camera snaps to the new space's rig behind the player and a short fade
// covers the jump.
function enterDoor() {
  if (player.mode !== 'foot' || !useDoor(interior, player)) return;
  const rig = currentPlace(interior)?.rig ?? STREET_RIG;
  cam.yaw = player.yaw;
  cam.dist = rig.dist;
  cam.pitch = rig.pitch;
  cam.ground = player.y;
  lockedNpc = null;
  fadeThroughDoor(doorHud);
}

function toggleVehicle() {
  if (player.mode === 'foot' && nearHero()) {
    player.mode = 'drive';
    avatar.group.visible = false;
    missionOnEnterCar(mission);
    cam.dist = 7;
    cam.pitch = 0.22;
  } else if (player.mode === 'drive') {
    player.mode = 'foot';
    ({ x: player.x, z: player.z } = clampToBounds(WALK_BOUNDS, heroCar.x + 1.8, heroCar.z));
    player.speed = 0;
    avatar.group.visible = true;
    cam.dist = 4.5;
    cam.pitch = 0.18;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'h') fireHack();
  if (k === 'f') toggleVehicle();
  if (k === 't') toggleDay(clock);
  if (k === 'n') newGame();
  // The overview lifts off the street, never out of a shop or off a roof, and a
  // door is used at street scale, never from the overview.
  if (interior.space === STREET) cityKey(cityView, k, cam.yaw);
  if (k === 'e' && cityView.mode === 'street') enterDoor();
  if (k === 'j') toggleJournal(arcUI);
  if (k === '1' || k === '2') arcChoose(arc, Number(k), street.time);
});

const clock = restored?.clock ?? createClock();
// A capture holds the clock so the same seed, pose and hour reproduce: a shot
// must not drift through the day while the rasteriser crawls.
if (CAPTURE) clock.rate = 0;
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

// Minimal probe for scripted verification (screenshots, control checks).
window.__game = {
  seed: SEED,
  generated: GENERATE,
  saveNow: doSave,
  cam: () => camera.position.toArray().map((v) => +v.toFixed(2)),
  draws: () => renderer.info.render.calls,
  hack: () => fireHack(),
  dark: () => [...DARK],
  cooldown: () => +hackCooldownLeft(street).toFixed(1),
  player: () => ({ x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), mode: player.mode }),
  car: () => ({ x: +heroCar.x.toFixed(2), y: +heroCar.y.toFixed(2), z: +heroCar.z.toFixed(2), speed: +heroCar.speed.toFixed(1) }),
  enter: () => toggleVehicle(),
  profile: () => lastProfile,
  heat: () => wanted.heat,
  wanted: () => ({
    tier: wanted.heat, contact: wanted.contact, status: lastWantedStatus,
    units: wanted.pursuit.filter((u) => u.active && !u.leaving).length,
    roadblock: wanted.response.roadblock.active,
    strip: wanted.response.strip.active ? { x: wanted.response.strip.x, z: wanted.response.strip.z } : null,
    heli: wanted.response.heli.active, flat: heroCar.flat ?? 0,
    search: wanted.search.active ? { x: wanted.search.x, z: wanted.search.z, r: +wanted.search.r.toFixed(1) } : null,
    radio: dispatch.lines.map((l) => `${l.speaker}: ${l.text}`),
  }),
  tod: () => +clock.nightFactor.toFixed(3),
  hour: () => clock.hour,
  census: () => census(people),
  news: () => liveNews(news, street.time),
  walkersOut: () => street.npcs.filter((n) => n.out !== false).length,
  person: (k) => {
    if (people.list.length === 0) return null;
    return describe(people.list[k % people.list.length]);
  },
  pursuit: () => wanted.pursuit.map((p) => ({ active: p.active, x: +p.x.toFixed(1), z: +p.z.toFixed(1) })),
  mission: () => ({ id: mission.id, done: [...mission.done], balance: mission.balance, status: lastWantedStatus }),
  space: () => interior.space,
  door: () => interior.near?.label ?? null,
  useDoor: () => enterDoor(),
  arc: () => {
    const at = player.mode === 'drive' ? heroCar : player;
    return arcSnapshot(arc, city.parcels, at.x, at.z);
  },
  choose: (key) => arcChoose(arc, key, street.time),
  city: () => ({
    time: +city.time.toFixed(2),
    demand: { ...city.demand },
    parcels: city.parcels.map((p) => ({
      x: p.x, z: p.z, use: p.use, zone: p.powerZone, stage: STAGES[p.stage],
      progress: +p.progress.toFixed(4), height: +builtHeight(p).toFixed(2), building: p.building,
      trend: p.trend, why: p.why, vacancy: +p.vacancy.toFixed(3),
    })),
  }),
  economy: () => districtReport(city),
  shot: () => {
    composer.render();
    return captureFrame(renderer);
  },
};
window.__game.cityview = {
  state: () => ({ ...cityView, level: undefined, trend: [...cityView.trend] }),
  lots: () => city.parcels.map((p) => ({ use: p.use, zoned: p.zoned, stage: STAGES[p.stage], building: p.building })),
  screen: (i) => cityRig.screenOf(camera, i),
  pick: (x, y) => cityRig.pick(camera, x, y),
};
if (CAPTURE) {
  // Capture-only: run the district's sim ahead by `secs`, in the frame loop's own
  // steps and functions, without drawing them. SwiftShader draws about a frame a
  // second, so the half-minute a zoned lot takes to break ground is ten minutes
  // of frames; this lets evidence show "later" without the wait.
  window.__game.cityview.advance = (secs) => {
    for (let t = 0; t < secs; t += 0.05) {
      tickStreet(street, 0.05);
      tickZoning(city, 0.05, street);
      tickCityView(cityView, city, 0.05, new Set());
    }
  };
}

// Capture-only police probe, bound behind ?capture=1 below. It calls the same
// sim entry points play does (a tier, a lost suspect) and can hold the pursuit
// still, so evidence is framed at the play camera instead of chased for.
function policeProbe() {
  const suspect = () => {
    const b = player.mode === 'drive' ? heroCar : player;
    return { x: b.x, z: b.z, yaw: b.yaw };
  };
  return {
    tier: (n) => forceTier(wanted, n, suspect(), street.time),
    search: (x, z, yaw = 0, age = 0) => forceSearch(wanted, x, z, yaw, street.time, age),
    hold: (on) => { policeHold = on; },
    flash: (t) => { police.flashFreeze = t; },
    drive: (x, z, yaw, speed = 0) => {
      Object.assign(heroCar, { x, z, yaw, speed, y: heightAt(x, z) });
      Object.assign(player, { x, z });
      if (player.mode !== 'drive') toggleVehicle();
      cam.yaw = yaw;
    },
    unit: (i, x, z, yaw) => Object.assign(wanted.pursuit[i], { x, z, yaw, y: heightAt(x, z), speed: 0 }),
    heli: (x, z, aimX, aimZ, y = 24) => Object.assign(wanted.response.heli, { x, y, z, aimX, aimZ }),
    view: (pitch, dist) => Object.assign(cam, { pitch, dist }),
    flat: (v) => { heroCar.flat = v; },
    reset: () => Object.assign(wanted, createWanted()),
  };
}

// Capture-only streaming probe, bound behind ?capture=1 and nowhere else. It
// moves the position the STREAMER reads, not the player and not the camera —
// DRIVE_BOUNDS is untouched and the game plays identically with it bound. It
// exists because the road graph does not reach the outskirts yet, so proving a
// tile builds and disposes out there cannot be done by driving to it.
if (CAPTURE) {
  window.__game.chunks = {
    stats: () => ({ ...chunks.stats(), ms: chunks.cost(), pools: outskirts.stats() }),
    cost: () => chunks.cost(),
    resident: () => chunks.resident(),
    origin: (x, z) => { streamOrigin = x === null ? null : { x, z }; },
    budget: (tiles, ms) => chunks.budget(tiles, ms),
    visible: (on) => { for (const m of outskirts.meshes) m.visible = on; },
  };
  // What each draw was spent on, per frame: docs/DRAWS.md is built from it.
  window.__game.ledger = drawLedger(renderer);
  // The end of the day/night glide, reached at once: a probe measuring the day
  // frame should not have to render 140 frames of dusk to get there.
  window.__game.night = (n) => { clock.nightFactor = n; clock.nightTarget = n; clock.rate = 0; };
  window.__game.setHour = (h) => { clock.hour = h; clock.rate = 0; };
  // Runs the street and the city ahead by `secs` of game time in the frame loop's
  // own 50 ms steps, so evidence of a minutes-long economic swing does not need
  // minutes of a software rasteriser. Nothing else is ticked; nothing is skipped.
  window.__game.advance = (secs) => {
    for (let t = 0; t < secs; t += 0.05) {
      tickStreet(street, 0.05);
      tickZoning(city, 0.05, street);
    }
  };
  // Stand the player somewhere inside the walk box it could have walked to, and
  // let the ordinary follow cam frame it. Clamped to WALK_BOUNDS on purpose: a
  // shot from a place the player cannot reach proves nothing (AGENTS.md step 5).
  window.__game.pose = (x, z, yaw) => {
    ({ x: player.x, z: player.z } = clampToBounds(WALK_BOUNDS, x, z));
    cam.yaw = yaw;
  };
  // Walk into a grown lot by use, the way the door would: pose the body on the
  // street spot, then use the door. Capture-only so nothing in play moves a
  // player behind the camera. Returns the space id, or null when no grown lot
  // of that use exists yet.
  window.__game.enterLot = (use) => {
    interior.space = STREET;
    syncInterior(interior);
    const link = interior.links.find((l) => l.parcelUse === use);
    if (!link) return null;
    const from = link.ends[0];
    player.mode = 'foot';
    avatar.group.visible = true;
    player.x = from.x;
    player.z = from.z;
    player.speed = 0;
    tickInterior(interior, player);
    enterDoor();
    return interior.space === STREET ? null : interior.space;
  };
  // The door ends the sim currently offers, for a test to aim at.
  window.__game.doorList = () => interior.links.map((l) => ({
    id: l.id, use: l.parcelUse ?? null,
    ends: l.ends.map((e) => ({ space: e.space, x: +e.x.toFixed(3), z: +e.z.toFixed(3), label: e.label })),
  }));
  // Decline on demand: hold a market where it is needed and run the world on
  // ahead — clock, street and city, in the frame loop's longest step, so it is
  // the same sim — instead of waiting minutes for the swell to slump. Software
  // rendering runs a frame a second, and a blackout is nine seconds of sim.
  window.__game.zoning = {
    pin: (use, level) => pinDemand(city, use, level),
    skip: (secs) => {
      for (let t = 0; t < secs; t += 0.05) {
        tickClock(clock, 0.05);
        tickStreet(street, 0.05);
        tickZoning(city, 0.05, street);
      }
    },
    note: () => lotNote.textContent,
    // A/B for the draw count: the same frame with and without the boards.
    dressing: (on) => { decline.mesh.visible = on; },
  };
  // The mouse's drag and wheel as numbers, clamped to the ranges the mouse has:
  // a framing any player can reach by hand, not a lab angle.
  window.__game.look = (pitch, dist = cam.dist) => {
    cam.pitch = Math.max(0.08, Math.min(1.2, pitch));
    cam.dist = Math.max(3, Math.min(14, dist));
  };
  window.__game.arcSkip = () => arcSkipStep(arc);
  window.__game.police = policeProbe();
}

chunks.warm(player.x, player.z);

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fpsShown = 0;
let hudTimer = 0;
let firstFrame = true;
let bootMs = 0;
let braking = false;
const lookAt = new THREE.Vector3();

const HELD_FOOT = { mx: 0, mz: 0, hurry: false };
const HELD_CAR = { throttle: 0, steer: 0 };

function footInput() {
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
  if (cityView.mode === 'city') return HELD_CAR;
  return {
    throttle: (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0),
    steer: (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0),
  };
}

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

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const driving = player.mode === 'drive';
  tickClock(clock, dt);
  tickStreet(street, dt);
  tickZoning(city, dt, street, occupiedParcel(interior));
  tickPeople(people, city);
  tickCommute(street, people, city, clock.hour, player.x, player.z);
  tickNews(news, city, people, street);
  tickCityView(cityView, city, dt, keys);
  // Stream against the camera, because the camera is what the frustum belongs
  // to. It is last frame's position; at a 160 m build radius one frame of lag
  // is 0.2 m of a 224 m hysteresis gap and nothing can see it.
  const eye = streamOrigin ?? camera.position;
  chunks.update(eye.x, eye.z);
  if (driving) {
    const res = tickPlayerCar(heroCar, driveInput(), dt);
    braking = res.braking;
    updatePlayerCar(heroRig, heroCar, braking);
    if (!dragging && clock.elapsed - lastDragT > 2) {
      cam.yaw += angDiff(heroCar.yaw, cam.yaw) * Math.min(1, dt * 2.2);
    }
  } else {
    tickPlayer(player, footInput(), dt);
    tickInterior(interior, player);
    updatePlayer(avatar, player);
  }
  const glows = [zoneGlow(street, 0), zoneGlow(street, 1)];
  const nf = clock.nightFactor;
  for (let z = 0; z < 2; z++) {
    const dark = isDark(street, z);
    if (DARK[z] !== dark) {
      DARK[z] = dark;
      missionOnBlackout(mission, DARK, street.time);
    }
    // Re-shoot the mirror once a zone has settled, dead or lit, not the instant
    // the hack lands: the collapse and the relight both flicker, and a face shot
    // mid-flicker holds a half-lit street in the water until the next re-shoot.
    // The frame used to be too full for the probe to fire during the collapse
    // anyway (VGA-010's dead water was shot in the dark by accident); now it is not.
    if ((glows[z] === 0 || glows[z] === 1) && glows[z] !== MIRRORED[z]) {
      MIRRORED[z] = glows[z];
      requestCityMirror(mirror, street.time, camera.position.x, camera.position.z);
    }
    const b = glows[z] >= 1 ? 1 : glows[z] <= 0 ? 0 : blink(street.time, z * 3.7);
    lamps.setZoneLight(z, glows[z]);
    spots[z].visible = b > 0.02;
    lampPoolMeshes[z].material.opacity = 0.5 * nf * b;
    signPoolMeshes[z].material.opacity = 0.5 * nf * b;
    spots[z].intensity = 45 * nf * b;
    for (const m of towers.zoneMats[z]) {
      // dayFloor: a tower's windows go dark at noon, but a shop keeps its
      // lights on, and without that the glazing reads as a black hole in a
      // sunlit wall. Zero for everything that isn't a shopfront.
      const floor = m.userData.dayFloor ?? 0;
      const lit = floor + (1 - floor) * nf;
      m.emissiveIntensity = 0.75 * lit * b * (m.userData.emissiveScale ?? 1);
      m.color.copy(m.userData.baseTint).multiplyScalar(1 - 0.3 * (1 - b));
    }
    setPuddleGlow(puddles, z, b);
    setSlit(fx, z, b);
    // The grown lots' street doors: their lit fascias and glazing ride their
    // own zone, so a blackout kills one side of the street and not the other.
    interiors.parcel.views[z].emissiveIntensity = (0.3 + 0.7 * nf) * b;
    streakMeshes[z].material.opacity = 0.55 * nf * b;
    const mk = markingMats[z];
    mk.color.setScalar((0.25 + 0.75 * nf) * (0.05 + 0.95 * b));
    mk.envMapIntensity = 0.1 + 0.6 * nf * b;
    mk.emissiveIntensity = 0.015 * nf * b;
  }
  updateCarStreaks(carStreaks, heroCar, driving, wanted.pursuit, nf, street.time);
  signs.tick(signs.zoneMats, signs.zoneSprites, glows, street.time, nf);
  for (const e of shops.mats) {
    const v = glows[e.zone];
    const b = v >= 1 ? 1 : v <= 0 ? 0 : blink(street.time, e.seed);
    e.mat.color.setScalar((0.3 + 0.7 * nf) * (0.06 + 0.94 * b));
  }
  updateInteriors(interiors, interior, { glows, night: nf, time: street.time, elapsed: clock.elapsed, city });
  rain.visible = !isIndoors(interior);
  // Up on a roof it rains on the roof: the rain box rides up with the player.
  rain.position.y = interior.space === STREET ? 0 : player.y - ROOF_RAIN_BELOW;
  lamps.tick(street.time);
  missionOnHeatZero(mission, wanted.heat, street.time);
  tickRain(rain, clock.elapsed);
  tickSteam(steam, clock.elapsed, dt);
  tickHackFx(fx, dt);
  const night = clock.nightFactor;
  updateDaylight(env, scene, bloom, night, renderer);
  grade.uniforms.uNight.value = night;
  grade.uniforms.uTime.value = clock.elapsed;
  for (const m of towers.facadeMats) {
    m.userData.uNight.value = night;
    m.envMapIntensity = 1.1 + 1.4 * (1 - night);
  }
  groundMats.road.envMapIntensity = 0.85 - 0.15 * (1 - night);
  groundMats.walk.envMapIntensity = 0.5 - 0.15 * (1 - night);
  lamps.setDaylight(night);
  stars.material.opacity = 0.75 * night;
  skyline.mat.color.setScalar(0.12 + 0.88 * night);
  for (const s of env.spots) s.intensity = 45 * night;
  const pulse = 0.55 + 0.45 * Math.sin(clock.elapsed * 5);
  beacons.mat.color.setRGB(0.4 + 0.6 * pulse, 0.05, 0.05);
  growth.update();
  updateEconomyPanel(economyPanel, city);
  decline.update();
  updateNPCs(npcRig, street);
  updateTraffic(traffic.rig, street, camera);
  // Hero and pursuit throws ride the traffic pool set (VGA-004): three more
  // instances, no extra draw. The hero keeps its lights on parked — the beacon
  // is the other half of finding the car again.
  updateCarPools(traffic.rig, [
    { x: heroCar.x, z: heroCar.z, yaw: heroCar.yaw, speed: heroCar.speed, on: true },
    ...wanted.pursuit.map((p) => ({ x: p.x, z: p.z, yaw: p.yaw, speed: p.speed, on: p.active })),
  ], camera);
  updateBlobs(blobs, street, player, heroCar);
  const hx = driving ? heroCar.x : player.x;
  const hz = driving ? heroCar.z : player.z;
  heroKey.position.set(hx, (driving ? heroCar.y : player.y) + 2.4, hz);
  heroKey.intensity = 14 * night;
  if (isIndoors(interior)) heroKey.intensity = interiors.key;
  // A hack pulls the units to the scene of it: wantedOnBlackout sets the search there.
  const suspect = {
    x: hx, z: hz, yaw: driving ? heroCar.yaw : player.yaw, inCar: driving, car: heroCar,
    body: driving ? heroCar : player, cover: isDark(street, zoneAt(hz)), night: clock.nightFactor,
  };
  if (!policeHold) lastWantedStatus = tickWanted(wanted, dt, suspect, street.time);
  tickDispatch(dispatch, drainEvents(wanted), street.time);
  if (lastWantedStatus === 'busted' && !mission.complete) {
    missionReset(mission);
    missionNote(mission, 'BUSTED — contract reset', street.time, 3);
  }
  updatePolice(police, wanted, {
    time: street.time, elapsed: clock.elapsed, night: clock.nightFactor, camera, heroRig, heroCar, fx,
  });
  updateDispatchHud(radio, dispatch, street.time);
  mission.balance += tickArc(arc, {
    x: hx, z: hz, inCar: driving, dark: DARK, heat: wanted.heat, profile: lastProfile?.name ?? null,
    parcels: city.parcels, busted: lastWantedStatus === 'busted',
  }, street.time);
  updateArcMarker(arcMarker, arcTarget(arc, city.parcels, hx, hz), arcSigns(arc), clock.elapsed, night, glows);
  updateArcUI(arcUI, arc, hx, hz, street.time);

  const ax = driving ? heroCar.x : player.x;
  const az = driving ? heroCar.z : player.z;
  const ay = driving ? heroCar.y : player.y;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cx = ax - Math.sin(cam.yaw) * cam.dist * cp;
  const cz = az - Math.cos(cam.yaw) * cam.dist * cp;
  // The camera rides the higher of two grounds — the one under the player and
  // the one under itself — so a bank standing between them cannot swallow it.
  // Eased, because a kerb is a step function and the whole frame would jump.
  cam.ground += (Math.max(ay, heightAt(cx, cz)) - cam.ground) * Math.min(1, dt * 6);
  camera.position.set(cx, sp * cam.dist + 0.6 + cam.ground, cz);
  if (!driving) camera.position.copy(frameCamera(interior, { x: ax, y: ay + CAM_PIVOT, z: az }, camera.position));
  lookAt.set(ax + (driving ? Math.sin(heroCar.yaw) * 3 : 0), ay + (driving ? 1.2 : 1.7), az + (driving ? Math.cos(heroCar.yaw) * 3 : 0));
  camera.lookAt(lookAt);

  const target = driving || interior.space !== STREET ? null : acquireTarget();
  const targetPerson = target && people.list.length > 0
    ? people.list[street.npcs.indexOf(target.npc) % people.list.length]
    : null;
  lastProfile = driving ? null : updateProfiler(camera, target, targetPerson, targetPerson ? commuteLabel(targetPerson, clock.hour) : null);
  showLotNote(lotNote, interior.space === STREET
    ? focusParcel(city.parcels, ax, az, Math.sin(cam.yaw), Math.cos(cam.yaw)) : null);
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
  cityUi.update();
  updateDoorHud(doorHud, driving ? null : interior.near);

  hideFaded(fadedDraws);
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
