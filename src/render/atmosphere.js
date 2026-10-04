// Day/night atmosphere: gradient sky dome, shadowed afternoon sun, moon,
// image-based wet reflections. updateDaylight drives every look parameter
// from the sim's nightFactor — one number, whole world.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getGlowTex } from './signs.js';
import { weatherState } from './rain.js';

const SUN_DIR = new THREE.Vector3(-0.55, 0.52, -0.42).normalize();
const DAY_TOP = new THREE.Color(0x2f66a8);
const DAY_HOR = new THREE.Color(0xc3cfdd);
const NIGHT_TOP = new THREE.Color(0x020409);
const NIGHT_HOR = new THREE.Color(0x201a24);
const DAY_FOG = new THREE.Color(0x9fb4cc);
const NIGHT_FOG = new THREE.Color(0x070b16);
const DAY_SKY = new THREE.Color(0xbdd3e8);
const NIGHT_SKY = new THREE.Color(0x24314d);
const DAY_GND = new THREE.Color(0x5a6068);
const NIGHT_GND = new THREE.Color(0x05070a);
const SUN_WARM = new THREE.Color(0xfff0d8);
// Overcast and rain kill the sun disc and lay a grey lid on the sky; the fog,
// the dome fill and the lid all take the same neutral grey, near-black at night.
const OVERCAST_FOG = new THREE.Color(0x92969a);
const OVERCAST_SKY = new THREE.Color(0x9aa0a5);

function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uNight: { value: 1 },
      uSunDir: { value: SUN_DIR.clone() },
      uDayTop: { value: DAY_TOP.clone() },
      uDayHor: { value: DAY_HOR.clone() },
      uNightTop: { value: NIGHT_TOP.clone() },
      uNightHor: { value: NIGHT_HOR.clone() },
      uSunColor: { value: SUN_WARM.clone() },
      uGloom: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uNight;
      uniform float uGloom;
      uniform vec3 uSunDir, uDayTop, uDayHor, uNightTop, uNightHor, uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 day = mix(uDayHor, uDayTop, pow(h, 0.55));
        vec3 night = mix(uNightHor, uNightTop, pow(h, 0.55));
        vec3 col = mix(day, night, uNight);
        if (d.y < 0.0) col = mix(col, mix(uDayHor, uNightHor, uNight) * 0.35, min(1.0, -d.y * 4.0));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 700.0) * 3.0 + pow(s, 10.0) * 0.22) * (1.0 - uNight) * (1.0 - 0.9 * uGloom);
        // Light pollution: warm amber glow on the horizon band at night.
        float horizonBand = exp(-pow((h - 0.08) * 6.0, 2.0));
        col += vec3(0.18, 0.10, 0.04) * horizonBand * uNight * 0.6 * (1.0 - 0.7 * uGloom);
        // Overcast and rain: one grey lid, brighter by day, near-black at night.
        vec3 grey = mix(vec3(0.035, 0.038, 0.045), vec3(0.42, 0.45, 0.52), 1.0 - uNight);
        col = mix(col, grey * (0.85 + 0.3 * h), uGloom);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// preserveDrawingBuffer costs a copy every frame, so it is opt-in: only the
// evidence harness (?capture=1) needs a readable buffer. Play never pays for it.
export function createRenderer(canvas, { preserveDrawingBuffer = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Accumulate the whole frame (scene + bloom quads) for the honest HUD counter.
  renderer.info.autoReset = false;
  return renderer;
}

export function buildAtmosphere(scene, renderer) {
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.FogExp2(0x070b16, 0.012);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const sky = buildSky();
  scene.add(sky.mesh);
  const hemi = new THREE.HemisphereLight(0x24314d, 0x05070a, 0.3);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fb0ff, 0.25);
  moon.position.set(30, 50, -20);
  scene.add(moon);
  // Day sky-bounce: cool fill from the east so shade faces never go pure black.
  // Costs no draws (lights aren't draws), scaled to zero at night.
  const bounce = new THREE.DirectionalLight(0xbdd3e8, 0);
  bounce.position.set(80, 40, 20);
  scene.add(bounce);
  const sun = new THREE.DirectionalLight(0xfff0d8, 0);
  sun.position.set(-70, 66, -48);
  sun.target.position.set(15, 0, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -85;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 85;
  sun.shadow.camera.bottom = -85;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.8;
  // Drawn once at boot even if the city wakes at night, so the map the shaders
  // sample is never one nothing has written to. updateDaylight owns it after.
  sun.shadow.needsUpdate = true;
  scene.add(sun, sun.target);
  const spots = [];
  for (const z of [-9, 9]) {
    const spot = new THREE.SpotLight(0xffc98a, 45, 45, 0.5, 0.55, 2);
    spot.position.set(0, 7, z);
    spot.target.position.set(0, 0, z);
    scene.add(spot, spot.target);
    spots.push(spot);
  }
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTex(), color: 0x5f7fb8, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  moonGlow.position.set(45, 60, -90);
  moonGlow.scale.set(40, 40, 1);
  scene.add(moonGlow);
  return { spots, skyMat: sky.mat, skyMesh: sky.mesh, sun, moon, bounce, hemi, moonGlow, moonGlowMat: moonGlow.material };
}

const _fog = new THREE.Color();

export function updateDaylight(env, scene, bloom, n, renderer) {
  const day = 1 - n;
  // Overcast and rain are one gloom: the sun disc goes, the sky greys and the
  // direct light falls to the dome fill. Clear is the only state that keeps sun.
  const gloom = weatherState() === 'clear' ? 0 : 1;
  env.skyMat.uniforms.uNight.value = n;
  env.skyMat.uniforms.uGloom.value = gloom;
  env.sun.intensity = 2.3 * day * (1 - 0.6 * gloom);
  // The sun is the only light that casts, and at full night it is at zero, so
  // the shadow it would draw multiplies nothing: re-rendering the map is every
  // caster's second draw for no pixel. It holds still instead, and redraws on
  // the first frame the sun is back, before anything samples it lit.
  env.sun.shadow.autoUpdate = day > 0;
  env.moon.intensity = 0.25 * n * (1 - 0.7 * gloom);
  env.bounce.intensity = 0.5 * day * (1 - 0.35 * gloom);
  env.hemi.intensity = 0.25 + 0.15 * gloom + (0.5 + 0.05 * gloom) * day;
  env.hemi.color.copy(NIGHT_SKY).lerp(DAY_SKY, day);
  if (gloom) env.hemi.color.lerp(OVERCAST_SKY, 0.35 + 0.5 * day);
  env.hemi.groundColor.copy(NIGHT_GND).lerp(DAY_GND, day);
  _fog.copy(NIGHT_FOG).lerp(DAY_FOG, day);
  _fog.lerp(OVERCAST_FOG, 0.85 * gloom * day);
  scene.fog.color.copy(_fog);
  scene.fog.density = 0.012 - 0.0055 * day;
  scene.background = null; // sky dome owns the background
  env.moonGlowMat.opacity = 0.5 * n * (1 - 0.7 * gloom);
  bloom.threshold = 0.92 + 0.05 * day;
  bloom.strength = 0.45 - 0.1 * day;
  // Exposure sits lower at night so the street stays dark and its signs,
  // windows and lamps carry the frame; day opens it back up.
  renderer.toneMappingExposure = 0.75 + 0.35 * day;
}

// Film grade (VGA-080). Runs after OutputPass, so it works on display-referred
// pixels the way a colourist does, not on linear HDR where lift/gamma/gain are
// meaningless. Four things, each earning its place in the frame:
//   contrast   — the untouched day frame was grey soup, every value crowded
//                around 0.5 with nothing anchoring black
//   split tone — cool shadows against warm highlights, the pressure that makes
//                a lit street read as photographed rather than rendered
//   vignette   — quiet, just enough to stop the corners competing with the
//                middle; heavier at night when the middle is the only lit part
//   grain      — the single cheapest thing that stops a frame looking like CG,
//                because nothing in the real world is noise-free
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uNight: { value: 1 },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uNight;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float day = 1.0 - uNight;
      float pivot = mix(0.50, 0.43, day);
      c = (c - pivot) * mix(1.07, 1.16, day) + pivot;
      float l = dot(c, LUMA);
      vec3 cool = vec3(0.90, 0.985, 1.13);
      vec3 warm = vec3(1.075, 1.005, 0.905);
      c *= mix(cool, warm, smoothstep(0.12, 0.72, l));
      c = mix(vec3(l), c, mix(1.10, 1.20, day));
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * mix(0.62, 0.40, day);
      float g = fract(sin(dot(vUv * uRes + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      c += (g - 0.5) * mix(0.032, 0.020, day);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createComposer(renderer, scene, camera) {
  const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(size, 0.45, 0.55, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE_SHADER);
  grade.uniforms.uRes.value.copy(size);
  composer.addPass(grade);
  return { composer, bloom, grade };
}

export function fitRenderer(renderer, composer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
