// re-002 bootstrap: sim ticks, render reads. HUD shows measured numbers only.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createClock, tickClock } from './sim/clock.js';
import { createStreet, tickStreet, hackBlackout, hackCooldownLeft, isDark, zoneAt } from './sim/street.js';
import { buildGround, buildTowers } from './render/block.js';
import { buildSigns, buildPools } from './render/signs.js';
import { buildLamps } from './render/lamps.js';
import { buildNPCs, updateNPCs } from './render/npcs.js';
import { buildTraffic, updateTraffic } from './render/traffic.js';
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
camera.position.set(2.5, 4.2, 26);

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
const npcRig = buildNPCs(street);
scene.add(npcRig.group);
const traffic = buildTraffic(street);
scene.add(traffic.group);

const rain = buildRain();
scene.add(rain);

const composer = createComposer(renderer, scene, camera);
window.addEventListener('resize', () => fitRenderer(renderer, composer, camera));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.5, 5, -10);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = 1.53;
controls.minDistance = 3;
controls.maxDistance = 70;

const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const DARK = [false, false];

function fireHack() {
  const zone = zoneAt(controls.target.z);
  if (hackBlackout(street, zone) === 0) return;
  applyZone(zone, true);
}

function applyZone(zone, dark) {
  DARK[zone] = dark;
  lamps.setZoneDark(zone, dark);
  spots[zone].visible = !dark;
  lampPoolMeshes[zone].visible = !dark;
}

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'h' && !e.repeat) fireHack();
});

const clock = createClock();
const hud = document.getElementById('hud');
// Minimal probe for scripted verification (screenshots, control checks).
window.__re = {
  cam: () => camera.position.toArray().map((v) => +v.toFixed(2)),
  draws: () => renderer.info.render.calls,
  hack: () => fireHack(),
  dark: () => [...DARK],
  cooldown: () => +hackCooldownLeft(street).toFixed(1),
};

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fpsShown = 0;
let hudTimer = 0;
let firstFrame = true;
let bootMs = 0;
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();

function glide(dt) {
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).negate();
  const speed = (keys.has('shift') ? 18 : 8) * dt;
  const move = new THREE.Vector3();
  if (keys.has('w')) move.add(fwd);
  if (keys.has('s')) move.sub(fwd);
  if (keys.has('a')) move.add(right);
  if (keys.has('d')) move.sub(right);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    camera.position.add(move);
    controls.target.add(move);
  }
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

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  tickClock(clock, dt);
  tickStreet(street, dt);
  for (let z = 0; z < 2; z++) {
    if (DARK[z] && !isDark(street, z)) applyZone(z, false);
  }
  tickRain(rain, clock.elapsed);
  updateNPCs(npcRig, street);
  updateTraffic(traffic.rig, street);
  glide(dt);
  controls.update();
  renderer.info.reset();
  composer.render();
  if (firstFrame) {
    firstFrame = false;
    bootMs = Math.round(now - bootStart);
    console.log(`[re-002] boot ${bootMs}ms, draws ${renderer.info.render.calls}`);
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
    hud.innerHTML =
      `<b>NEON BLOCK 002</b> · night · rain<br>` +
      `draws <b class="${over ? 'warn' : ''}">${draws}</b> / ${DRAW_BUDGET} · ` +
      `${fpsShown} fps · ${tris}M tris<br>` +
      `H · blackout [${hackStatus()}]`;
  }
}
render();
