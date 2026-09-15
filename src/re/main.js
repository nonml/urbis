// re-004 bootstrap: sim ticks, render reads. HUD shows measured numbers only.
import * as THREE from 'three';
import { createClock, tickClock } from './sim/clock.js';
import { createStreet, tickStreet, hackBlackout, hackCooldownLeft, isDark, zoneAt, profilerTarget } from './sim/street.js';
import { createPlayer, tickPlayer } from './sim/player.js';
import { createPlayerCar, tickPlayerCar } from './sim/vehicle.js';
import { buildGround, buildTowers } from './render/block.js';
import { buildSigns, buildPools } from './render/signs.js';
import { buildLamps } from './render/lamps.js';
import { buildNPCs, updateNPCs } from './render/npcs.js';
import { buildTraffic, updateTraffic, buildPlayerCar, updatePlayerCar } from './render/traffic.js';
import { buildPlayer, updatePlayer } from './render/player.js';
import { buildProfiler, updateProfiler } from './render/profiler.js';
import { buildRain, tickRain } from './render/rain.js';
import { createRenderer, buildAtmosphere, createComposer, fitRenderer } from './render/atmosphere.js';

const DRAW_BUDGET = 150;
const bootStart = performance.now();

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const texLoader = new THREE.TextureLoader();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);

const { spots } = buildAtmosphere(scene, renderer);
scene.add(buildGround(texLoader, maxAniso));
scene.add(buildTowers(texLoader, maxAniso));
const signs = buildSigns();
scene.add(signs.group);
scene.add(buildPools(signs.pools));
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
const npcRig = buildNPCs(street);
scene.add(npcRig.group);
const traffic = buildTraffic(street);
scene.add(traffic.group);
const heroRig = buildPlayerCar(scene, heroCar);
scene.add(heroRig.group);
const avatar = buildPlayer();
scene.add(avatar.group);
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

const rain = buildRain();
scene.add(rain);

const composer = createComposer(renderer, scene, camera);
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
}
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const DARK = [false, false];

function fireHack() {
  const zone = zoneAt(player.mode === 'drive' ? heroCar.z : player.z);
  if (hackBlackout(street, zone) === 0) return;
  applyZone(zone, true);
}

function applyZone(zone, dark) {
  DARK[zone] = dark;
  lamps.setZoneDark(zone, dark);
  spots[zone].visible = !dark;
  lampPoolMeshes[zone].visible = !dark;
}

function nearHero() {
  return Math.hypot(heroCar.x - player.x, heroCar.z - player.z) < 3.4;
}

function toggleVehicle() {
  if (player.mode === 'foot' && nearHero()) {
    player.mode = 'drive';
    avatar.group.visible = false;
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
  const left = hackCooldownLeft(street);
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
  tickRain(rain, clock.elapsed);
  updateNPCs(npcRig, street);
  updateTraffic(traffic.rig, street);

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
    hud.innerHTML =
      `<b>NEON BLOCK 004</b> · night · rain<br>` +
      `draws <b class="${over ? 'warn' : ''}">${draws}</b> / ${DRAW_BUDGET} · ` +
      `${fpsShown} fps · ${tris}M tris<br>` +
      `H · blackout [${hackStatus()}]${speedLine}`;
  }
}
render();
