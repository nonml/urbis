// GPU rain: one draw, zero per-frame CPU. Streaks fall, wrap, fade with distance.
import * as THREE from 'three';

const COUNT = 2600;
const AREA = { x: 34, y: 26, z: 66 };

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
      varying float vFade;
      varying float vSeed;
      void main() {
        vec2 pc = gl_PointCoord - vec2(0.5);
        float streak = pow(max(0.0, 1.0 - abs(pc.x) * 7.0), 1.6);
        float ends = smoothstep(0.5, 0.28, abs(pc.y));
        float a = streak * ends * vFade * 0.7;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export function tickRain(points, elapsed) {
  points.material.uniforms.uTime.value = elapsed;
}
