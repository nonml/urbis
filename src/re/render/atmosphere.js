// Day/night atmosphere: gradient sky dome, shadowed afternoon sun, moon,
// image-based wet reflections. updateDaylight drives every look parameter
// from the sim's nightFactor — one number, whole world.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getGlowTex } from './signs.js';

const SUN_DIR = new THREE.Vector3(-0.55, 0.52, -0.42).normalize();
const DAY_TOP = new THREE.Color(0x2f66a8);
const DAY_HOR = new THREE.Color(0xc3cfdd);
const NIGHT_TOP = new THREE.Color(0x020409);
const NIGHT_HOR = new THREE.Color(0x0a1020);
const DAY_FOG = new THREE.Color(0x9fb4cc);
const NIGHT_FOG = new THREE.Color(0x070b16);
const DAY_SKY = new THREE.Color(0xbdd3e8);
const NIGHT_SKY = new THREE.Color(0x24314d);
const DAY_GND = new THREE.Color(0x5a6068);
const NIGHT_GND = new THREE.Color(0x05070a);
const SUN_WARM = new THREE.Color(0xfff0d8);

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
        col += uSunColor * (pow(s, 700.0) * 3.0 + pow(s, 10.0) * 0.22) * (1.0 - uNight);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
  scene.fog = new THREE.FogExp2(0x070b16, 0.016);
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
  return { spots, skyMat: sky.mat, sun, moon, bounce, hemi, moonGlowMat: moonGlow.material };
}

const _fog = new THREE.Color();

export function updateDaylight(env, scene, bloom, n) {
  const day = 1 - n;
  env.skyMat.uniforms.uNight.value = n;
  env.sun.intensity = 2.3 * day;
  env.moon.intensity = 0.25 * n;
  env.bounce.intensity = 0.5 * day;
  env.hemi.intensity = 0.25 + 0.5 * day;
  env.hemi.color.copy(NIGHT_SKY).lerp(DAY_SKY, day);
  env.hemi.groundColor.copy(NIGHT_GND).lerp(DAY_GND, day);
  _fog.copy(NIGHT_FOG).lerp(DAY_FOG, day);
  scene.fog.color.copy(_fog);
  scene.fog.density = 0.016 - 0.0085 * day;
  scene.background = null; // sky dome owns the background
  env.moonGlowMat.opacity = 0.5 * n;
  bloom.threshold = 0.85 + 0.07 * day;
  bloom.strength = 0.45 - 0.1 * day;
}

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.55, 0.85
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}

export function fitRenderer(renderer, composer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
