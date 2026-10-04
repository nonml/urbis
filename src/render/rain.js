// GPU rain: one draw, zero per-frame CPU. Streaks fall, wrap, fade with distance.
//
// The same rig owns the drawn weather (M2-7). sim/weather.js is the schedule —
// a day's clear/overcast/rain states and the 0-1 wetness — and it is a pure
// function of the seed and the clock, so this reads it back from the elapsed
// seconds the frame already passes and ?weather= pins a state for the sweep.
// Nothing new is drawn: clear and overcast hide the one cloud rain always was,
// and the wetness rides the shared material uniform (materials.js setWetness).
import * as THREE from 'three';
import { createWeather, tickWeather, weatherPin } from '../sim/weather.js';
import { worldSeed } from '../sim/seedstore.js';
import { START_HOUR, DAY_SECS } from '../sim/clock.js';
import { setWetness } from './materials.js';

const COUNT = 2600;
const AREA = { x: 34, y: 26, z: 66 };
const RAIN_FADE = 3; // seconds for the cloud to come and go with the state

// Seeded scatter — rain placement must not depend on Math.random (save/load determinism).
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The sim's weather, reconstructed where the frame can see it: the seed it was
// rolled from and the ?weather= pin, then ticked from clock.elapsed. hour and
// day are views of elapsed, exactly as sim/clock.js makes them.
function buildWeather() {
  const pinned = weatherPin(globalThis.location?.search ?? '');
  const weather = createWeather(worldSeed().seed, pinned);
  return {
    weather, view: { day: 0, hour: START_HOUR }, last: 0,
    state: weather.state, wetness: weather.wetness,
    amount: weather.state === 'rain' ? 1 : 0,
  };
}

let rig = null;

// What atmosphere.js greys the sky by: clear is the only state with a sun.
export function weatherState() {
  return rig?.state ?? 'clear';
}

export function buildRain() {
  const rand = mulberry32(1337);
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rand() - 0.5) * AREA.x * 2;
    pos[i * 3 + 1] = rand() * AREA.y;
    pos[i * 3 + 2] = (rand() - 0.5) * AREA.z * 2;
    seed[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: AREA.y },
      uColor: { value: new THREE.Color(0x8fa8c8) },
      uAmount: { value: 1 },
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      uniform float uHeight;
      varying float vFade;
      varying float vSeed;
      void main() {
        vec3 p = position;
        float fall = uTime * (14.0 + aSeed * 7.0);
        p.y = mod(p.y - fall, uHeight);
        p.x += p.y * 0.06; // wind slant
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        vFade = smoothstep(55.0, 12.0, dist) * smoothstep(0.0, 1.5, p.y + 1.0);
        vSeed = aSeed;
        gl_PointSize = (140.0 / dist) * (0.7 + aSeed * 0.6);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uAmount;
      varying float vFade;
      varying float vSeed;
      void main() {
        vec2 pc = gl_PointCoord - vec2(0.5);
        float streak = pow(max(0.0, 1.0 - abs(pc.x) * 7.0), 1.6);
        float ends = smoothstep(0.5, 0.28, abs(pc.y));
        float a = streak * ends * vFade * 0.7 * uAmount;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  rig = buildWeather();
  points.userData.weather = rig;
  points.visible = rig.state === 'rain';
  return points;
}

export function tickRain(points, elapsed) {
  points.material.uniforms.uTime.value = elapsed;
  const weather = points.userData.weather;
  const dt = Math.min(Math.max(elapsed - weather.last, 0), 0.5);
  weather.last = elapsed;
  const total = START_HOUR + (elapsed * 24) / DAY_SECS;
  weather.view.day = Math.floor(total / 24);
  weather.view.hour = total % 24;
  tickWeather(weather.weather, dt, weather.view);
  weather.state = weather.weather.state;
  weather.wetness = weather.weather.wetness;
  const want = weather.state === 'rain' ? 1 : 0;
  weather.amount += (want - weather.amount) * Math.min(1, dt * RAIN_FADE);
  points.material.uniforms.uAmount.value = weather.amount;
  // The frame's own visibility (indoors, roofs) passes through: the weather
  // only ever hides the cloud, never shows it where the scene said not to.
  points.visible = points.visible && weather.amount > 0.02;
  setWetness(weather.wetness);
}
