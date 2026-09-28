// Texture loading discipline (mined from fable-cities, enforced here):
// albedo + emissive in sRGB, data maps (normal/rough/metal) linear,
// RepeatWrapping everywhere, renderer-max anisotropy.
import * as THREE from 'three';

const BASE = 'assets/';
// Metres of facade one repeat of a window map covers, on every tower in the city.
export const FACADE_TILE = 11;

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
  mat.customProgramCacheKey = () => 'daynight-facade';
  return mat;
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
  mat.onBeforeCompile = (sh) => {
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
  mat.customProgramCacheKey = () => 'concrete-facade';
  return mat;
}

export function standardFromMaps(maps, opts) {
  return new THREE.MeshStandardMaterial({
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
  });
}
