// Day/night atmosphere: gradient sky dome, shadowed afternoon sun, moon,
// image-based wet reflections. updateDaylight drives every look parameter
// from the sim's nightFactor — one number, whole world.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getGlowTex } from './signs.js';

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
        // Light pollution: warm amber glow on the horizon band at night.
        float horizonBand = exp(-pow((h - 0.08) * 6.0, 2.0));
        col += vec3(0.18, 0.10, 0.04) * horizonBand * uNight * 0.6;
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

export function updateDaylight(env, scene, bloom, n, renderer) {
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
  scene.fog.density = 0.012 - 0.0055 * day;
  scene.background = null; // sky dome owns the background
  env.moonGlowMat.opacity = 0.5 * n;
  bloom.threshold = 0.92 + 0.05 * day;
  bloom.strength = 0.45 - 0.1 * day;
  // Animate exposure: brighter at night (neon blooms), dimmer at day.
  renderer.toneMappingExposure = 0.75 + 0.35 * day;
}

const VOL_FOG_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    fogDensity: { value: 0.006 },
    fogColor: { value: new THREE.Color(0x070b16) },
    sunDirection: { value: new THREE.Vector3(-0.55, 0.52, -0.42) },
    lightIntensity: { value: 0.2 },
    uTime: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float fogDensity;
    uniform vec3 fogColor;
    uniform vec3 sunDirection;
    uniform float lightIntensity;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    float noise2d(vec2 p){
      vec2 i=floor(p); vec2 f=fract(p);
      float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
      return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
    }
    float godRays(vec2 uv, vec3 sunDir, float intensity){
      vec2 dir=uv-vec2(0.5);
      float sunDot=dot(dir, normalize(sunDir.xy));
      float lowSun=1.0-abs(sunDir.y);
      float shaft=max(0.0,sunDot)*intensity*(0.5+lowSun*1.5);
      shaft*=noise2d(uv*4.0+vec2(sin(uTime*0.15),cos(uTime*0.12)));
      shaft*=exp(-length(dir)*1.5);
      return shaft;
    }
    float lightCones(vec2 uv, vec4 color){
      float bright=dot(color.rgb,vec3(0.299,0.587,0.114));
      float cone=smoothstep(0.3,0.8,bright);
      return cone*noise2d(uv*6.0+vec2(sin(uTime*0.2),cos(uTime*0.15)))*0.2;
    }
    void main(){
      vec4 col=texture2D(tDiffuse,vUv);
      vec2 noiseUV=vUv*3.0+vec2(sin(uTime*0.3),cos(uTime*0.2))*0.5;
      float fogNoise=noise2d(noiseUV);
      float density=fogDensity*(1.0+fogNoise*0.3);
      float dist=length(vUv-vec2(0.5));
      float fogFactor=1.0-exp(-density*dist*80.0);
      float shafts=godRays(vUv,sunDirection,lightIntensity);
      float cones=lightCones(vUv,col);
      vec3 fogContrib=fogColor*(fogFactor+shafts+cones);
      col.rgb=mix(col.rgb,fogContrib,fogFactor*0.5+shafts*0.3+cones*0.2);
      gl_FragColor=col;
    }
  `,
};

const SSR_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    wetness: { value: 0.0 },
    maxTrace: { value: 96.0 },
    stepSize: { value: 0.02 },
    fadePower: { value: 0.5 },
    temporalAlpha: { value: 0.3 },
    prevSSR: { value: null },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float wetness;
    uniform float maxTrace;
    uniform float stepSize;
    uniform float fadePower;
    uniform float temporalAlpha;
    uniform sampler2D prevSSR;
    varying vec2 vUv;
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float depth = texture2D(tDepth, vUv).r;
      if (wetness < 0.01 || depth > 0.99) { gl_FragColor = col; return; }
      vec2 texelSize = vec2(1.0) / vec2(textureSize(tDepth, 0));
      float dL = texture2D(tDepth, vUv - vec2(texelSize.x, 0.0)).r;
      float dR = texture2D(tDepth, vUv + vec2(texelSize.x, 0.0)).r;
      float dD = texture2D(tDepth, vUv - vec2(0.0, texelSize.y)).r;
      float dU = texture2D(tDepth, vUv + vec2(0.0, texelSize.y)).r;
      vec3 normal = normalize(vec3(dR - dL, 2.0 * depth, dU - dD));
      vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
      vec3 reflectDir = reflect(-viewDir, normal);
      float reflectStrength = abs(normal.y);
      if (reflectStrength < 0.3) { gl_FragColor = col; return; }
      vec2 rayStep = reflectDir.xz * stepSize / max(0.001, abs(reflectDir.y));
      vec2 uv = vUv;
      vec3 reflection = vec3(0.0);
      float traceDist = 0.0;
      float reflectionWeight = 0.0;
      for (float i = 0.0; i < maxTrace; i++) {
        uv += rayStep * 0.01;
        traceDist += stepSize;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
        float sampleDepth = texture2D(tDepth, uv).r;
        vec3 sampleCol = texture2D(tDiffuse, uv).rgb;
        float heightDiff = abs(sampleDepth - depth);
        if (heightDiff < 0.1 * traceDist) {
          reflection = sampleCol;
          reflectionWeight = 1.0 / (1.0 + traceDist * 0.5);
          break;
        }
      }
      if (reflectionWeight < 0.1) {
        reflection = mix(col.rgb, vec3(0.1, 0.12, 0.15), 0.3);
        reflectionWeight = 0.1;
      }
      float reflectionAmount = wetness * reflectionWeight * reflectStrength;
      vec3 finalCol = mix(col.rgb, reflection, reflectionAmount * fadePower);
      vec4 prev = texture2D(prevSSR, vUv);
      finalCol = mix(finalCol, prev.rgb, temporalAlpha * 0.5);
      gl_FragColor = vec4(finalCol, col.a);
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // SSAO: half-res ambient occlusion — grounds everything, kills the floating feeling.
  const ssaoW = Math.round(window.innerWidth * 0.5);
  const ssaoH = Math.round(window.innerHeight * 0.5);
  const ssaoPass = new SSAOPass(scene, camera, ssaoW, ssaoH);
  ssaoPass.kernelRadius = 4;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.15;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);
  // Volumetric fog: god rays + streetlight cones + noise haze.
  const volFogPass = new ShaderPass(VOL_FOG_SHADER);
  composer.addPass(volFogPass);
  // SSR: screen-space reflections for wet roads.
  const ssrPass = new ShaderPass(SSR_SHADER);
  composer.addPass(ssrPass);
  const ssrPrevRT = new THREE.WebGLRenderTarget(size.x, size.y, THREE.RGBAFormat);
  ssrPass.uniforms.prevSSR.value = ssrPrevRT.texture;
  const bloom = new UnrealBloomPass(size, 0.45, 0.55, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer._ssrPrevRT = ssrPrevRT;
  composer._volFogPass = volFogPass;
  composer._ssaoPass = ssaoPass;
  return { composer, bloom, ssrPass, ssrPrevRT, volFogPass, ssaoPass };
}

export function fitRenderer(renderer, composer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Resize SSR temporal buffer if present.
  if (composer._ssrPrevRT) composer._ssrPrevRT.setSize(w, h);
  // Resize SSAO to half-res.
  if (composer._ssaoPass) {
    const ssaoW = Math.round(w * 0.5);
    const ssaoH = Math.round(h * 0.5);
    composer._ssaoPass.setSize(ssaoW, ssaoH);
  }
}
