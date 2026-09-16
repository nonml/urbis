// re-004 bootstrap: sim ticks, render reads. HUD shows measured numbers only.
import * as THREE from 'three';
import { createClock, tickClock, toggleDay } from './sim/clock.js';
import { createStreet, tickStreet, hackBlackout, hackCooldownLeft, isDark, zoneAt, profilerTarget } from './sim/street.js';
import { createPlayer, tickPlayer } from './sim/player.js';
import { createPlayerCar, tickPlayerCar } from './sim/vehicle.js';
import { createMission, missionOnBlackout, missionOnEnterCar, missionOnHeatZero, missionReset, missionNote } from './sim/mission.js';
import { createWanted, wantedOnBlackout, tickWanted, isBusted } from './sim/wanted.js';
import { buildGround, buildTowers } from './render/block.js';
import { buildSigns, buildPools } from './render/signs.js';
import { buildLamps } from './render/lamps.js';
import { buildNPCs, updateNPCs } from './render/npcs.js';
import { buildTraffic, updateTraffic, buildPlayerCar, updatePlayerCar } from './render/traffic.js';
import { buildPursuitCar, updatePursuit } from './render/police.js';
import { buildPlayer, updatePlayer } from './render/player.js';
import { buildShops, buildPuddles, buildSteam, tickSteam, buildBeacons, buildStars } from './render/setdress.js';
import { loadPropInstances, buildTrees } from './render/props.js';
import { buildProfiler, updateProfiler } from './render/profiler.js';
import { buildRain, tickRain } from './render/rain.js';
import { createRenderer, buildAtmosphere, updateDaylight, createComposer, fitRenderer } from './render/atmosphere.js';
import { buildRiver, tickRiver, buildGrassGround, buildGrassTufts, buildMountains } from './render/landscape.js';

const DRAW_BUDGET = 175;
const bootStart = performance.now();

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const texLoader = new THREE.TextureLoader();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);

const env = buildAtmosphere(scene, renderer);
const spots = env.spots;
const ground = buildGround(texLoader, maxAniso);
scene.add(ground.group);
const groundMats = ground.mats;
const towers = buildTowers(texLoader, maxAniso);
scene.add(towers.group);
const stars = buildStars();
scene.add(stars);
const river = buildRiver(texLoader, maxAniso);
scene.add(river.mesh);
scene.add(buildGrassGround());
scene.add(buildGrassTufts());
scene.add(buildMountains());
const beacons = buildBeacons(towers.beacons);
scene.add(beacons.mesh);
scene.add(buildTrees());
// Props resolve a frame or two after boot — the loop never touches them.
Promise.all([
  loadPropInstances('re-assets/models/fire_hydrant/fire_hydrant_1k.gltf', [
    [-6.9, -50], [6.9, -15], [-6.9, 20], [6.9, 45], [37.1, -40],
    [50.9, -5], [37.1, 25], [50.9, 48], [-2, -69.5], [30, -69.5],
  ]),
  loadPropInstances('re-assets/models/metal_trash_can/metal_trash_can_1k.gltf', [
    [-5.9, -44], [-5.9, -26], [5.9, -8], [5.9, 10], [-5.9, 28], [-5.9, 46],
    [38.1, -44], [49.9, -8], [38.1, 28], [49.9, 46], [8, -69], [36, -69],
  ]),
]).then(([hydrants, trash]) => scene.add(hydrants, trash));
const signs = buildSigns();
scene.add(signs.group);
const signPools = buildPools(signs.pools);
scene.add(signPools);
const lamps = buildLamps();
scene.add(lamps.group);
const lampPoolMeshes = lamps.poolsByZone.map((quads) => {
  const m = buildPools(quads);
  scene.add(m);
  return m;
});

const street = createStreet(20260916);
const player = createPlayer();
player.mode = 'foot';
const heroCar = createPlayerCar();
const mission = createMission();
const wanted = createWanted();
let lastWantedStatus = 'clean';
const npcRig = buildNPCs(street);
scene.add(npcRig.group);
const traffic = buildTraffic(street);
scene.add(traffic.group);
const heroRig = buildPlayerCar(scene, heroCar);
scene.add(heroRig.group);
const pursuitRigs = [buildPursuitCar(), buildPursuitCar()];
for (const r of pursuitRigs) scene.add(r.group);
const avatar = buildPlayer();
scene.add(avatar.group);
scene.add(buildShops());
scene.add(buildPuddles());
const steam = buildSteam();
scene.add(steam.group);
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

const { composer, bloom } = createComposer(renderer, scene, camera);
window.addEventListener('resize', () => fitRenderer(renderer, composer, camera));

// Follow cam: drag looks, wheel dollies. WASD moves player / drives car.
const cam = { yaw: Math.PI, pitch: 0.34, dist: 7 };
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

const keys = new Set();
// Dev spawn presets for scripted verification (?spawn=east).
const spawnPreset = new URLSearchParams(location.search).get('spawn');
if (spawnPreset === 'east') {
  player.x = 49.5;
  player.z = 16;
} else if (spawnPreset === 'shop') {
  player.x = 3.5;
  player.z = 7;
} else if (spawnPreset === 'river') {
  player.x = -6;
  player.z = -32;
  cam.yaw = -Math.PI / 2;
}
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const DARK = [false, false];

function fireHack() {
  const zone = zoneAt(player.mode === 'drive' ? heroCar.z : player.z);
  if (hackBlackout(street, zone) === 0) return;
  wantedOnBlackout(wanted);
  applyZone(zone, true);
  missionOnBlackout(mission, DARK, street.time);
}

function applyZone(zone, dark) {
  DARK[zone] = dark;
  lamps.setZoneDark(zone, dark);
  spots[zone].visible = !dark;
  lampPoolMeshes[zone].visible = !dark;
  missionOnBlackout(mission, DARK, street.time);
}

function nearHero() {
  return Math.hypot(heroCar.x - player.x, heroCar.z - player.z) < 3.4;
}

function toggleVehicle() {
  if (player.mode === 'foot' && nearHero()) {
    player.mode = 'drive';
    avatar.group.visible = false;
    missionOnEnterCar(mission);
    cam.dist = 9;
    cam.pitch = 0.3;
  } else if (player.mode === 'drive') {
    player.mode = 'foot';
    player.x = Math.max(-7, Math.min(51, heroCar.x + 1.8));
    player.z = Math.max(-68, Math.min(58, heroCar.z));
    player.speed = 0;
    avatar.group.visible = true;
    cam.dist = 7;
    cam.pitch = 0.34;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'h') fireHack();
  if (k === 'f') toggleVehicle();
  if (k === 't') toggleDay(clock);
});

const clock = createClock();
const hud = document.getElementById('hud');
let lastProfile = null;
let lockedNpc = null;
// Minimal probe for scripted verification (screenshots, control checks).
window.__re = {
  cam: () => camera.position.toArray().map((v) => +v.toFixed(2)),
  draws: () => renderer.info.render.calls,
  hack: () => fireHack(),
  dark: () => [...DARK],
  cooldown: () => +hackCooldownLeft(street).toFixed(1),
  player: () => ({ x: +player.x.toFixed(2), z: +player.z.toFixed(2), mode: player.mode }),
  car: () => ({ x: +heroCar.x.toFixed(2), z: +heroCar.z.toFixed(2), speed: +heroCar.speed.toFixed(1) }),
  enter: () => toggleVehicle(),
  profile: () => lastProfile,
  heat: () => wanted.heat,
  pursuit: () => wanted.pursuit.map((p) => ({ active: p.active, x: +p.x.toFixed(1), z: +p.z.toFixed(1) })),
  mission: () => ({ done: [...mission.done], balance: mission.balance, status: lastWantedStatus }),
};

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fpsShown = 0;
let hudTimer = 0;
let firstFrame = true;
let bootMs = 0;
let braking = false;
const lookAt = new THREE.Vector3();

function footInput() {
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
  if (driving) {
    const res = tickPlayerCar(heroCar, driveInput(), dt);
    braking = res.braking;
    updatePlayerCar(heroRig, heroCar, braking);
    if (!dragging && clock.elapsed - lastDragT > 2) {
      cam.yaw += angDiff(heroCar.yaw, cam.yaw) * Math.min(1, dt * 2.2);
    }
  } else {
    tickPlayer(player, footInput(), dt);
    updatePlayer(avatar, player);
  }
  for (let z = 0; z < 2; z++) {
    if (DARK[z] && !isDark(street, z)) applyZone(z, false);
  }
  missionOnHeatZero(mission, wanted.heat, street.time);
  tickRain(rain, clock.elapsed);
  tickSteam(steam, clock.elapsed);
  tickRiver(river, dt);
  const night = clock.nightFactor;
  updateDaylight(env, scene, bloom, night);
  for (const m of towers.facadeMats) {
    m.emissiveIntensity = 0.75 * night;
    m.userData.uNight.value = night;
    m.envMapIntensity = 1.1 + 1.4 * (1 - night);
  }
  groundMats.road.envMapIntensity = 1.4 - 0.9 * (1 - night);
  groundMats.walk.envMapIntensity = 0.7 - 0.35 * (1 - night);
  lamps.setDaylight(night);
  for (const m of signs.mats) m.color.setScalar(0.3 + 0.7 * night);
  for (const m of signs.spriteMats) m.opacity = m.userData.baseOp * night;
  for (const p of lampPoolMeshes) p.material.opacity = 0.5 * night;
  signPools.material.opacity = 0.5 * night;
  stars.material.opacity = 0.75 * night;
  for (const s of env.spots) s.intensity = 45 * night;
  const pulse = 0.55 + 0.45 * Math.sin(clock.elapsed * 5);
  beacons.mat.color.setRGB(0.4 + 0.6 * pulse, 0.05, 0.05);
  updateNPCs(npcRig, street);
  updateTraffic(traffic.rig, street);
  const tx = driving ? heroCar.x : player.x;
  const tz = driving ? heroCar.z : player.z;
  lastWantedStatus = tickWanted(wanted, dt, tx, tz, driving, heroCar.speed, isDark(street, zoneAt(tz)), street.time);
  if (lastWantedStatus === 'busted' && !mission.complete) {
    missionReset(mission);
    missionNote(mission, 'BUSTED — contract reset', street.time, 3);
  }
  wanted.pursuit.forEach((p, i) => updatePursuit(pursuitRigs[i], p, clock.elapsed));

  const ax = driving ? heroCar.x : player.x;
  const az = driving ? heroCar.z : player.z;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  camera.position.set(
    ax - Math.sin(cam.yaw) * cam.dist * cp,
    sp * cam.dist + 0.6,
    az - Math.cos(cam.yaw) * cam.dist * cp
  );
  lookAt.set(ax + (driving ? Math.sin(heroCar.yaw) * 3 : 0), driving ? 1.2 : 1.7, az + (driving ? Math.cos(heroCar.yaw) * 3 : 0));
  camera.lookAt(lookAt);

  lastProfile = driving ? null : updateProfiler(camera, acquireTarget());
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

  renderer.info.reset();
  composer.render();
  if (firstFrame) {
    firstFrame = false;
    bootMs = Math.round(now - bootStart);
    console.log(`[re-004] boot ${bootMs}ms, draws ${renderer.info.render.calls}`);
  }
  fpsAcc += dt;
  fpsN++;
  hudTimer += dt;
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
    hud.innerHTML =
      `<b>NEON BLOCK 009</b> · ${clock.nightFactor > 0.5 ? '☾ night' : '☀ day'} · rain<br>` +
      `draws <b class="${over ? 'warn' : ''}">${draws}</b> / ${DRAW_BUDGET} · ` +
      `${fpsShown} fps · ${tris}M tris<br>` +
      `H · blackout [${hackStatus()}]${speedLine}<br>` +
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
