// Texture loading discipline (mined from fable-cities, enforced here):
// albedo + emissive in sRGB, data maps (normal/rough/metal) linear,
// RepeatWrapping everywhere, renderer-max anisotropy.
import * as THREE from 'three';

const BASE = 're-assets/';

function load(texLoader, maxAniso, path, srgb, rx, ry) {
  const tex = texLoader.load(BASE + path);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = maxAniso;
  return tex;
}

// kind: 'pbr' (albedo/normal/roughness) or 'facade' (+metal/emission)
export function loadPBRMaps(texLoader, maxAniso, dir, fileStem, rx, ry) {
  const albedo = load(texLoader, maxAniso, `${dir}/${fileStem}.jpg`, true, rx, ry);
  const normal = load(texLoader, maxAniso, `${dir}/normal.jpg`, false, rx, ry);
  const rough = load(texLoader, maxAniso, `${dir}/roughness.jpg`, false, rx, ry);
  return { albedo, normal, rough };
}

export function standardFromMaps(maps, opts) {
  return new THREE.MeshStandardMaterial({
    map: maps.albedo,
    normalMap: maps.normal,
    roughnessMap: maps.rough,
    roughness: opts.roughness ?? 1.0,
    metalness: opts.metalness ?? 0.0,
    envMapIntensity: opts.envMapIntensity ?? 1.0,
    color: opts.color ?? 0xffffff,
  });
}
