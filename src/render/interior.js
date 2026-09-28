// Interiors and roofs (sim/interior.js). Three meshes and a sprite, whatever is
// inside them:
//
//   room      the noodle bar, one merged mesh with its light baked into the
//             vertices. A blackout does not switch a light off here — it
//             turns a uniform down, and every bulb, pool and glow in the room
//             answers at once. The gas under the stock pots does not.
//   outside   the shopfront door, the stair door and the roof, one merged mesh
//             lit by the city's own sun and moon, glowing where it is a lamp.
//   steam     one sprite over the pots.
//
// Only what the player's space can see is drawn: the room is hidden unless the
// player is in it, and the outside mesh is hidden while they are. The rain is
// main's to hide indoors.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STREET, doorEnds, frameYaw, isIndoors, placeOf } from '../sim/interior.js';
import { blink } from '../sim/street.js';
import { getGlowTex } from './signs.js';
import { buildAtlas } from './interiorkit.js';
import { RAMEN_LIGHTS, ramenFront, ramenRoom, roofTop, stairDoor } from './interiorsets.js';

// ---------------------------------------------------------------------------
// Baked light. Each vertex stores how much of each light reaches it — the
// shop's lamps, the gas flame, the street through the frosted glass, and the
// battery emergency lamp over the door — and the shader weighs those by what
// each light is doing now.

// Light that has bounced off the plaster: a floor under every lamp's own share.
const BOUNCE = 0.2;
// Wrapped Lambert: a face turned away from a lamp still catches a little of it.
const WRAP = 0.35;

function pointLight(p, n, lights) {
  let sum = 0;
  for (const [a, y, d, strength, reach] of lights) {
    const lx = a - p.x;
    const ly = y - p.y;
    const lz = -d - p.z;
    const dist = Math.hypot(lx, ly, lz) || 1;
    const facing = Math.max(0, ((n.x * lx + n.y * ly + n.z * lz) / dist + WRAP) / (1 + WRAP));
    sum += strength * facing / (1 + (dist / reach) ** 2);
  }
  return sum;
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

function bake(geo, rig) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const out = new Float32Array(pos.count * 4);
  const fixed = geo.userData.glow;
  for (let i = 0; i < pos.count; i += 1) {
    if (fixed) {
      out.set(fixed, i * 4);
      continue;
    }
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    const depth = -_p.z - rig.window.d;
    const toGlass = Math.max(0, _n.z) * 0.65 + 0.35;
    out[i * 4] = BOUNCE + pointLight(_p, _n, rig.lamp);
    out[i * 4 + 1] = pointLight(_p, _n, rig.flame);
    out[i * 4 + 2] = 0.5 * Math.exp(-depth / rig.window.falloff) * toGlass;
    out[i * 4 + 3] = pointLight(_p, _n, rig.emergency);
  }
  geo.setAttribute('aLight', new THREE.BufferAttribute(out, 4));
  return geo;
}

// MeshBasicMaterial, so none of the city's lights reach in, patched so its
// colour is the vertex albedo times the four baked channels. The same patch
// shape as materials.js: miss guard, cache key, every uniform bound.
function bakedMaterial(atlas) {
  const mat = new THREE.MeshBasicMaterial({ map: atlas.albedo, vertexColors: true, fog: false });
  mat.userData.uniforms = {
    uLamp: { value: new THREE.Color() },
    uFlame: { value: new THREE.Color() },
    uWindow: { value: new THREE.Color() },
    uEmergency: { value: new THREE.Color() },
    uAmbient: { value: new THREE.Color(0.012, 0.012, 0.016) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <color_pars_vertex>', [
        '#include <color_pars_vertex>',
        'attribute vec4 aLight;',
        'varying vec4 vLight;',
      ].join('\n'))
      .replace('#include <color_vertex>', '#include <color_vertex>\nvLight = aLight;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_pars_fragment>', [
        '#include <color_pars_fragment>',
        'varying vec4 vLight;',
        'uniform vec3 uLamp, uFlame, uWindow, uEmergency, uAmbient;',
      ].join('\n'))
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        'diffuseColor.rgb *= uAmbient + vLight.x * uLamp + vLight.y * uFlame',
        '  + vLight.z * uWindow + vLight.w * uEmergency;',
      ].join('\n'));
    if (!sh.fragmentShader.includes('vLight.x * uLamp') || !sh.vertexShader.includes('vLight = aLight')) {
      console.error('[interior] baked-light patch missed');
    }
  };
  mat.customProgramCacheKey = () => 'interior-baked';
  return mat;
}

// ---------------------------------------------------------------------------
// Placement: a frame's parts into the world.

function frameMatrix(frame, y) {
  return new THREE.Matrix4().makeRotationY(frameYaw(frame)).setPosition(frame.x, y, frame.z);
}

function placed(parts, frame, y) {
  const m = frameMatrix(frame, y);
  return parts.map((g) => g.applyMatrix4(m));
}

function merged(parts, material) {
  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// Which street door is which. A door end with a face gets its kind hung on it.
const HANG = { 'ramen-front': ramenFront, 'roof-stair': stairDoor };

function outsideParts() {
  const parts = [];
  for (const end of doorEnds()) {
    if (end.space === STREET && HANG[end.door]) parts.push(...placed(HANG[end.door](), end.face, 0));
  }
  const roof = placeOf('roof');
  parts.push(...placed(roofTop(roof), roof.frame, roof.floor));
  return parts;
}

function outsideMaterial(atlas) {
  return new THREE.MeshStandardMaterial({
    map: atlas.albedo, vertexColors: true, emissiveMap: atlas.glow, emissive: 0xffffff,
    emissiveIntensity: 1, roughness: 0.82, metalness: 0.08, envMapIntensity: 0.5,
  });
}

// Steam off the stock pots, in the frame of the room: [a, y, d].
const STEAM_AT = [-1.82, 1.5, 4.6];
const STEAM_RISE = 0.9;
const STEAM_LOOP = 2.4;

function buildSteamSprite(room) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTex(), color: 0xe8e2d8, transparent: true, opacity: 0.3, depthWrite: false, fog: false,
  }));
  const [a, y, d] = STEAM_AT;
  s.userData.base = new THREE.Vector3(a, y, -d).applyMatrix4(frameMatrix(room.frame, room.floor));
  return s;
}

export function buildInteriors() {
  const atlas = buildAtlas();
  const ramen = placeOf('ramen');
  const roomMat = bakedMaterial(atlas);
  const roomParts = placed(ramenRoom(ramen).map((g) => bake(g, RAMEN_LIGHTS)), ramen.frame, ramen.floor);
  const room = merged(roomParts, roomMat);
  const outside = merged(outsideParts(), outsideMaterial(atlas));
  outside.receiveShadow = true;
  const steam = buildSteamSprite(ramen);
  const group = new THREE.Group();
  group.add(room, outside, steam);
  room.visible = false;
  steam.visible = false;
  return { group, room, roomMat, outside, steam, zone: ramen.zone, key: 0 };
}

// ---------------------------------------------------------------------------
// Per frame.

const LAMP = new THREE.Color(1.0, 0.8, 0.58);
const FLAME = new THREE.Color(1.0, 0.52, 0.2);
const DAYLIGHT = new THREE.Color(0.78, 0.86, 1.0);
const _sky = new THREE.Color();
const STREETLIGHT = new THREE.Color(1.0, 0.72, 0.46);
const MOONLIGHT = new THREE.Color(0.32, 0.42, 0.62);
// A battery lamp: cold, weak, and on only while the mains are off.
const EMERGENCY = new THREE.Color(0.8, 0.88, 1.0);
// The street's lamps put a little light on the frosted glass at night, the
// night sky a trace more, and the day sky a lot. None of it is the room's to
// switch off — though a blackout takes the street's share with it.
const WINDOW_NIGHT = 0.28;
const WINDOW_MOON = 0.08;
// A shop keeps its lights on at noon (block.js shopGlass dayFloor): the glow
// on the outside mesh scales from this floor at noon to full at night.
const DAY_FLOOR = 0.35;
// The hero's key light indoors, per unit of the shop's power: the lamps over
// the counter, not the street's.
const KEY_INDOOR = 9;

// The zone's power as the rest of the street reads it: full, dead, or the
// same sputter the lamps and shopfronts do through the collapse and restore.
function zonePower(glows, zone, time) {
  const v = glows[zone];
  return v >= 1 ? 1 : v <= 0 ? 0 : blink(time, zone * 3.7);
}

function tickSteam(rig, elapsed, power) {
  const k = (elapsed % STEAM_LOOP) / STEAM_LOOP;
  const s = rig.steam;
  s.position.copy(s.userData.base);
  s.position.y += k * STEAM_RISE;
  const size = 0.6 + k * 1.2;
  s.scale.set(size, size * 1.3, 1);
  // Steam is only as visible as the light on it: bright under the lamps, a
  // faint flame-lit ghost in a blackout.
  s.material.opacity = Math.sin(k * Math.PI) * (0.18 + 0.4 * power);
}

export function updateInteriors(rig, state, { glows, night, time, elapsed }) {
  const indoors = isIndoors(state);
  const power = zonePower(glows, rig.zone, time);
  rig.room.visible = indoors;
  rig.steam.visible = indoors;
  rig.outside.visible = !indoors;
  rig.outside.material.emissiveIntensity = power * (DAY_FLOOR + (1 - DAY_FLOOR) * night);
  const flicker = 0.9 + 0.1 * Math.sin(elapsed * 23) * Math.sin(elapsed * 7.3);
  rig.key = indoors ? KEY_INDOOR * power + 1.2 * flicker : 0;
  if (!indoors) return;
  const u = rig.roomMat.userData.uniforms;
  u.uLamp.value.copy(LAMP).multiplyScalar(power);
  u.uFlame.value.copy(FLAME).multiplyScalar(flicker);
  u.uWindow.value.copy(STREETLIGHT).multiplyScalar(WINDOW_NIGHT * power * night)
    .add(_sky.copy(DAYLIGHT).multiplyScalar(1 - night))
    .add(_sky.copy(MOONLIGHT).multiplyScalar(WINDOW_MOON * night));
  u.uEmergency.value.copy(EMERGENCY).multiplyScalar(1 - power);
  tickSteam(rig, elapsed, power);
}
