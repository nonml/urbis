// Texture loading discipline (mined from fable-cities, enforced here):
// albedo + emissive in sRGB, data maps (normal/rough/metal) linear,
// RepeatWrapping everywhere, renderer-max anisotropy.
import * as THREE from 'three';

const BASE = 'assets/';
// Metres of facade one repeat of a window map covers, on every tower in the city.
export const FACADE_TILE = 11;

// Wet grade (VGA-005, drawn for M2-7): one 0-1 wetness every standard surface
// reads without a draw. uWet is one shared uniform, so the whole city costs a
// single write whatever the material count, and the rain rig (render/rain.js)
// sets it from the sim's wetness; roughness falls, albedo darkens and the
// environment read lifts, which is what wet asphalt, paving and concrete do.
const WET = { value: 0 };
const WET_ROUGH = 0.55, WET_DARK = 0.24, WET_ENV = 1.5;

export function setWetness(w) {
  WET.value = Math.max(0, Math.min(1, w));
}

export function wetness() {
  return WET.value;
}

// Compose the wet patch into whatever onBeforeCompile the material already
// carries, so concrete keeps its window mask and the wet grade lands under it.
export function wetGrade(mat) {
  const own = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, renderer) => {
    own.call(mat, sh, renderer);
    sh.uniforms.uWet = WET;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\nroughnessFactor *= 1.0 - ${WET_ROUGH.toFixed(2)} * uWet;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>\ndiffuseColor.rgb *= 1.0 - ${WET_DARK.toFixed(2)} * uWet;`
      )
      .replaceAll(
        'return envMapColor.rgb * envMapIntensity;',
        `return envMapColor.rgb * envMapIntensity * (1.0 + ${WET_ENV.toFixed(1)} * uWet);`
      );
    if (!sh.fragmentShader.includes('uWet')) console.error('[wet] patch missed');
  };
  return mat;
}

function load(texLoader, maxAniso, path, srgb, rx, ry) {
  const tex = texLoader.load(BASE + path);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = maxAniso;
  return tex;
}

// Map filenames vary by vendor: ambientCG ships normal.jpg, Poly Haven normalgl.jpg.
// `names` overrides the stems; pass metal to pick up a metalness map.
export function loadPBRMaps(texLoader, maxAniso, dir, fileStem, rx, ry, names = {}) {
  const maps = {
    albedo: load(texLoader, maxAniso, `${dir}/${fileStem}.jpg`, true, rx, ry),
    normal: load(texLoader, maxAniso, `${dir}/${names.normal ?? 'normal'}.jpg`, false, rx, ry),
    rough: load(texLoader, maxAniso, `${dir}/${names.rough ?? 'roughness'}.jpg`, false, rx, ry),
  };
  if (names.metal) maps.metal = load(texLoader, maxAniso, `${dir}/${names.metal}.jpg`, false, rx, ry);
  return maps;
}

// Poly Haven packs ambient occlusion, roughness and metalness into one arm.jpg.
// three reads roughness from green and metalness from blue, so the one texture
// fills both slots and the whole library loads without repacking.
export function loadPolyHavenMaps(texLoader, maxAniso, dir, rx, ry) {
  const arm = load(texLoader, maxAniso, `${dir}/arm.jpg`, false, rx, ry);
  return {
    albedo: load(texLoader, maxAniso, `${dir}/Diffuse.jpg`, true, rx, ry),
    normal: load(texLoader, maxAniso, `${dir}/nor_gl.jpg`, false, rx, ry),
    rough: arm,
    metal: arm,
  };
}

// A shell grown on a lot (render/zoning.js) is one unit box instanced at any size,
// so its UVs run 0..1 across a face however big the building is. Rescale them by
// the instance's own size so it tiles the same FACADE_TILE window grid the merged
// towers bake in with worldUVs(). Redefining `uv` for the length of the stock
// chunk reaches every map's UV at once. Behind USE_INSTANCING: the merged towers
// compile without it and never run a line of it.
function instancedFacadeUVs(sh, name) {
  sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `
#ifdef USE_INSTANCING
  vec3 shellSize = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ),
    length( instanceMatrix[ 2 ].xyz ) );
  vec2 faceSize = abs( normal.x ) > 0.5 ? shellSize.zy : abs( normal.y ) > 0.5 ? shellSize.xz : shellSize.xy;
  vec2 shellUv = uv * faceSize / ${FACADE_TILE.toFixed(1)};
  #define uv shellUv
#endif
#include <uv_vertex>
#ifdef USE_INSTANCING
  #undef uv
#endif`);
  if (!sh.vertexShader.includes('shellUv')) console.error(`[${name}] instanced UV patch missed`);
}

// Day/night facade: one material, two albedos mixed in-shader by uNight.
// The emissive windows fade separately via emissiveIntensity (0 by day).
// Same merged geometry, same draw count, no pop — the whole wall crossfades.
export function facadeMaterial(nightMaps, dayColorTex, tint) {
  const mat = new THREE.MeshStandardMaterial({
    map: nightMaps.color,
    emissiveMap: nightMaps.emission,
    emissive: 0xffffff,
    emissiveIntensity: 0.75,
    normalMap: nightMaps.normal,
    roughnessMap: nightMaps.rough,
    roughness: 1.0,
    metalnessMap: nightMaps.metal,
    metalness: 1.0,
    color: tint,
    envMapIntensity: 1.1,
  });
  mat.userData.uNight = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = mat.userData.uNight;
    sh.uniforms.dayMap = { value: dayColorTex };
    const before = sh.fragmentShader;
    sh.fragmentShader = before
      .replace(
        '#include <map_pars_fragment>',
        '#include <map_pars_fragment>\nuniform sampler2D dayMap;\nuniform float uNight;'
      )
      .replace(
        '#include <map_fragment>',
        'vec4 dayTexel = texture2D( dayMap, vMapUv );\nvec4 nightTexel = texture2D( map, vMapUv );\ndiffuseColor *= mix( dayTexel, nightTexel, uNight );'
      );
    if (!sh.fragmentShader.includes('dayTexel')) console.error('[facade] patch missed');
    instancedFacadeUVs(sh, 'facade');
  };
  return zoneLit(mat, 'daynight-facade');
}

// Concrete tower: the same window map the glass towers glow with, read as geometry
// instead of light. A window punched in concrete is a hole — dark and glassy by day,
// lit at night — so the map darkens and polishes the diffuse as well as feeding
// emissive. One texture, two readings, no second map to ship.
export function concreteFacadeMaterial(maps, windowMap, tint) {
  const mat = standardFromMaps(maps, {
    emissiveMap: windowMap,
    emissiveIntensity: 0.75,
    roughness: 0.95,
    envMapIntensity: 0.4,
    color: tint,
  });
  const wet = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, renderer) => {
    wet.call(mat, sh, renderer);
    const before = sh.fragmentShader;
    sh.fragmentShader = before
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nvec3 windowTexel = texture2D( emissiveMap, vEmissiveMapUv ).rgb;\nfloat windowMask = max( max( windowTexel.r, windowTexel.g ), windowTexel.b );\nroughnessFactor *= 1.0 - 0.6 * windowMask;'
      )
      .replace(
        '#include <emissivemap_fragment>',
        'diffuseColor.rgb *= 1.0 - 0.85 * windowMask;\n#include <emissivemap_fragment>'
      );
    if (!sh.fragmentShader.includes('windowMask')) console.error('[concrete] patch missed');
    instancedFacadeUVs(sh, 'concrete');
  };
  return zoneLit(mat, 'concrete-facade');
}

// One material lights every power district. A blackout kills one district's
// windows and leaves the rest burning, which used to take a twin of every lit
// material, one per zone, and a draw for each twin. Now each vertex (or
// instance) carries its district id in a `zone` attribute, and the colour and
// emissive strength the frame loop writes per district arrive as 16-entry
// uniforms the shader indexes by that id. Emissive intensity moves wholly
// into the per-district value, so the stock `emissive` uniform is the plain
// emissive colour and the product is unchanged.
//
// A mesh wearing one of these must carry the attribute (withZone, or an
// InstancedBufferAttribute for instances): without it WebGL reads 0, and the
// whole mesh quietly follows district 0 through every blackout.
export const MAX_DISTRICTS = 16;
export function zoneLit(mat, key) {
  const own = mat.onBeforeCompile;
  mat.userData.zoneDiffuse = {
    value: Array.from({ length: MAX_DISTRICTS }, () => mat.color.clone()),
  };
  mat.userData.zoneEmissive = {
    value: Array(MAX_DISTRICTS).fill(mat.emissiveIntensity),
  };
  mat.emissiveIntensity = 1;
  mat.onBeforeCompile = (sh, renderer) => {
    own.call(mat, sh, renderer);
    sh.uniforms.zoneDiffuse = mat.userData.zoneDiffuse;
    sh.uniforms.zoneEmissive = mat.userData.zoneEmissive;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float zone;\nvarying float vZone;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvZone = zone;');
    const idx = `int( clamp( vZone + 0.5, 0.0, ${MAX_DISTRICTS - 1}.0 ) )`;
    const decl = `#include <common>\nuniform vec3 zoneDiffuse[ ${MAX_DISTRICTS} ];\n`;
    const decl2 = `uniform float zoneEmissive[ ${MAX_DISTRICTS} ];\nvarying float vZone;`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', decl + decl2)
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec4 diffuseColor = vec4( zoneDiffuse[ ${idx} ], opacity );`
      )
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `vec3 totalEmissiveRadiance = emissive * zoneEmissive[ ${idx} ];`
      );
    const patched = sh.vertexShader.includes('vZone = zone;')
      && sh.fragmentShader.includes('zoneDiffuse[ int(')
      && sh.fragmentShader.includes('zoneEmissive[ int(');
    if (!patched) console.error(`[${key}] zone patch missed`);
  };
  mat.customProgramCacheKey = () => `${key}-zoned`;
  return mat;
}

// What the frame loop drives per district, shaped like the twin material it
// replaces: it writes `emissiveIntensity` and `color` and reads `userData`,
// and each write lands in that district's slot of the shared uniforms.
export function zoneView(mat, zone) {
  const { zoneDiffuse, zoneEmissive } = mat.userData;
  return {
    userData: mat.userData,
    color: zoneDiffuse.value[zone],
    set emissiveIntensity(v) { zoneEmissive.value[zone] = v; },
  };
}

// Stamp a merged part with the power district it belongs to.
export function withZone(geo, zone) {
  const n = geo.attributes.position.count;
  geo.setAttribute('zone', new THREE.BufferAttribute(new Float32Array(n).fill(zone), 1));
  return geo;
}

export function standardFromMaps(maps, opts) {
  return wetGrade(new THREE.MeshStandardMaterial({
    map: maps.albedo,
    normalMap: maps.normal,
    roughnessMap: maps.rough,
    metalnessMap: maps.metal ?? null,
    emissiveMap: opts.emissiveMap ?? null,
    emissive: opts.emissiveMap ? 0xffffff : 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1.0,
    roughness: opts.roughness ?? 1.0,
    metalness: opts.metalness ?? 0.0,
    envMapIntensity: opts.envMapIntensity ?? 1.0,
    color: opts.color ?? 0xffffff,
  }));
}
