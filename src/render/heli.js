// Search language (VGA-068): the helicopter's searchlight and the search ring
// the ground units work when they have lost the suspect. Together they are how
// the player sees the machine hunting — where it thinks you are, and whether
// its light has found you. Render only; the wanted sim owns where.
//
// The helicopter's body rides the police kit mesh and the ring rides the
// police light mesh, so neither costs a draw of its own; the beam is one draw,
// at night only. The searchlight pool is a real spot light, so it lights the
// road, the cars and the player it finds for no draw at all.
import * as THREE from 'three';
import { blend, drawAlpha } from '../game/loop.js';
import { heightAt } from '../sim/world.js';
import { HELI_POOL } from '../sim/response.js';

const BEAM_CLEAR_NEAR = 4;
const BEAM_CLEAR_FAR = 16;
const BEAM_STRENGTH = 0.14;
// The shaft is the light scattering in the rain around the core of the beam,
// narrower than the pool it throws.
const BEAM_CORE = 0.6;

// A searchlight shaft in rain: bright at the lamp, thinning toward the ground,
// soft at its edges. Additive, and shaded by how square-on the surface faces
// the eye so the cone reads as a volume, not as a hollow tube.
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xf4f0e6) }, uStrength: { value: 0 } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vView;
      varying float vAlong;
      void main() {
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vN;
      varying vec3 vView;
      varying float vAlong;
      void main() {
        float square = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
        float fall = mix(0.18, 1.0, pow(vAlong, 1.4));
        // The chase camera sits a few metres behind the suspect the light is
        // on, so it is often inside the cone; the shaft thins out around it
        // instead of washing the whole frame.
        float clear = smoothstep(${BEAM_CLEAR_NEAR.toFixed(1)}, ${BEAM_CLEAR_FAR.toFixed(1)}, length(vView));
        gl_FragColor = vec4(uColor * uStrength * square * fall * clear, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// --- The search ring: a dashed circle on the street around the last known
// position, with a brighter sweep running round it. Amber, the game's own UI
// colour, because it is a readout of the police's knowledge laid on the
// ground, not a lamp in the world. Each dash is a flat slot in the police
// light mesh, so the ring costs no draw of its own.
const RING_DASHES = 40;
const RING_FILL = 0.6;
// Wide enough to read from a chase camera a couple of metres off the ground,
// which sees a flat ring almost edge-on.
const RING_WIDTH = 0.7;
const RING_THICK = 0.02;
const RING_LIFT = 0.06;
const RING_ROTATE = 0.12;
const RING_SWEEP = 1.3;
const RING_FADE_IN = 0.6;
const RING_BASE = [1.2, 0.62, 0.18];
const _dash = new THREE.Color();

function pushRing(search, fade, t, push) {
  const slot = (Math.PI * 2) / RING_DASHES;
  const turn = t * RING_ROTATE;
  const head = (t * RING_SWEEP) % (Math.PI * 2);
  const length = search.r * slot * RING_FILL * fade;
  for (let d = 0; d < RING_DASHES; d++) {
    const a = turn + (d + RING_FILL / 2) * slot;
    const behind = (((head - d * slot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const glow = 0.35 + 0.65 * Math.exp(-behind * 1.6);
    const x = search.x + Math.cos(a) * (search.r - RING_WIDTH / 2);
    const z = search.z + Math.sin(a) * (search.r - RING_WIDTH / 2);
    _dash.setRGB(RING_BASE[0] * glow, RING_BASE[1] * glow, RING_BASE[2] * glow);
    // Yaw -a turns the slot's length onto the circle's tangent.
    push(x, heightAt(x, z) + RING_LIFT, z, -a, [0, 0, 0, RING_WIDTH, RING_THICK, length], _dash);
  }
}

export function buildHeli() {
  const group = new THREE.Group();
  const beamGeo = new THREE.CylinderGeometry(0.06, 1, 1, 20, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamGeo, beamMaterial());
  beam.visible = false;
  // In the scene from boot at zero, for the same reason as the police wash:
  // adding a light later recompiles every lit material in the frame.
  const spot = new THREE.SpotLight(0xf2f0ea, 0, 0, 0.2, 0.5, 2);
  spot.position.set(0, -50, 0);
  spot.target.position.set(0, -60, 0);
  group.add(beam, spot, spot.target);
  return { group, beam, spot };
}

// Where the lens is, below the nose, in world space.
const LENS = [0, -0.8, 1.45];
const NAV = [
  { at: [-0.86, -0.1, 0.25, 0.1, 0.1, 0.1], color: new THREE.Color().setRGB(5, 0.15, 0.1) },
  { at: [0.86, -0.1, 0.25, 0.1, 0.1, 0.1], color: new THREE.Color().setRGB(0.15, 5, 0.6) },
];
const STROBE = { at: [0, 1.15, -5.6, 0.12, 0.12, 0.12], color: new THREE.Color().setRGB(9, 9, 9) };
const LENS_LAMP = { at: [...LENS, 0.3, 0.3, 0.1], color: new THREE.Color().setRGB(10, 9.6, 8.8) };
const STROBE_PERIOD = 1.1;
const STROBE_ON = 0.08;
// A glossy roof straight under it must not blow out to white.
const SEARCHLIGHT = 220;
const NIGHT = 0.5;

const _lens = new THREE.Vector3();
function lensWorld(h) {
  const c = Math.cos(h.yaw);
  const s = Math.sin(h.yaw);
  return _lens.set(h.x + LENS[0] * c + LENS[2] * s, h.y + LENS[1], h.z - LENS[0] * s + LENS[2] * c);
}

const _down = new THREE.Vector3(0, -1, 0);
const _dir = new THREE.Vector3();
const _aim = new THREE.Vector3();

function aimBeam(rig, h, on) {
  rig.beam.visible = on;
  if (!on) {
    rig.spot.intensity = 0;
    return;
  }
  const lens = lensWorld(h);
  _aim.set(h.aimX, heightAt(h.aimX, h.aimZ), h.aimZ);
  _dir.subVectors(_aim, lens);
  const length = _dir.length();
  rig.beam.position.copy(lens);
  rig.beam.quaternion.setFromUnitVectors(_down, _dir.normalize());
  rig.beam.scale.set(HELI_POOL * BEAM_CORE, length, HELI_POOL * BEAM_CORE);
  rig.beam.material.uniforms.uStrength.value = BEAM_STRENGTH;
  rig.spot.position.copy(lens);
  rig.spot.target.position.copy(_aim);
  rig.spot.angle = Math.atan(HELI_POOL / length);
  rig.spot.intensity = SEARCHLIGHT;
}

// One blended pose for the helicopter, reused every frame (M0-9).
const _pose = {};

// h: the sim's heli. draw.body(x, y, z, yaw) places the helicopter in the
// police kit; draw.light(x, y, z, yaw, [lx, ly, lz, w, h, d], color) adds a
// lamp to the police light mesh.
export function updateHeli(rig, h, wanted, ctx, t, draw) {
  // Enters and exits are teleports; they are snapped by the blend, so the
  // machine is drawn where it is and not swept across the sky.
  blend(h, drawAlpha(), _pose);
  _pose.active = h.active;
  _pose.leaving = h.leaving;
  h = _pose;
  if (wanted.search.active && wanted.heat > 0) {
    pushRing(wanted.search, Math.min(1, (ctx.time - wanted.search.since) / RING_FADE_IN), t, draw.light);
  }
  if (!h.active) {
    aimBeam(rig, h, false);
    return;
  }
  draw.body(h.x, h.y, h.z, h.yaw);
  const lit = ctx.night >= NIGHT && !h.leaving;
  aimBeam(rig, h, lit);
  for (const n of NAV) draw.light(h.x, h.y, h.z, h.yaw, n.at, n.color);
  if (t % STROBE_PERIOD < STROBE_ON) draw.light(h.x, h.y, h.z, h.yaw, STROBE.at, STROBE.color);
  if (lit) draw.light(h.x, h.y, h.z, h.yaw, LENS_LAMP.at, LENS_LAMP.color);
}
