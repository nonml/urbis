// Texture loading discipline (mined from fable-cities, enforced here):
// albedo + emissive in sRGB, data maps (normal/rough/metal) linear,
// RepeatWrapping everywhere, renderer-max anisotropy.
import * as THREE from 'three';

const BASE = 'assets/';

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
  };
  mat.customProgramCacheKey = () => 'daynight-facade';
  return mat;
}

export function standardFromMaps(maps, opts) {
  return new THREE.MeshStandardMaterial({
    map: maps.albedo,
    normalMap: maps.normal,
    roughnessMap: maps.rough,
    metalnessMap: maps.metal ?? null,
    roughness: opts.roughness ?? 1.0,
    metalness: opts.metalness ?? 0.0,
    envMapIntensity: opts.envMapIntensity ?? 1.0,
    color: opts.color ?? 0xffffff,
  });
}
