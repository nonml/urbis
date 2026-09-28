// An emptying building goes dark from the top down, a row of windows at a time,
// before it loses a floor (sim/decline.js). The shells on the growth lots share
// the shipped tower materials, so this is a patch on those materials rather than
// a material of its own: the power zones still own every window's light, and a
// blackout still kills the floors that are left (VGA-007). +0 draws.
//
// Per shell instance, an attribute carries how high the lights still reach. The
// merged towers wear the same materials without instancing; for them the patch
// compiles to "every floor is lit" and changes nothing.
import * as THREE from 'three';
import { FACADE_TILE } from './materials.js';

// The window map is sixteen rows to a repeat. A row is the unit a building goes
// dark in, so the line between lit and empty never cuts a window in half.
const WINDOW_ROWS = 16;
const WINDOW_ROW = FACADE_TILE / WINDOW_ROWS;

// The height, in metres, below which a shell of height h is still lit.
export function litTop(p, h) {
  return Math.ceil((h * (1 - p.vacancy)) / WINDOW_ROW) * WINDOW_ROW;
}

// A shell geometry with a slot per instance for litTop().
export function withLitTop(geo, count) {
  geo.setAttribute('litTop', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
  return geo;
}

const VARYINGS = 'varying float vShellY;\nvarying float vLitTop;';

// Chained after the material's own patch, which already handles the window grid.
export function emptyFloorsGoDark(mat) {
  if (mat.userData.emptyFloors) return mat;
  mat.userData.emptyFloors = true;
  const ownPatch = mat.onBeforeCompile;
  const ownKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, renderer) => {
    ownPatch.call(mat, sh, renderer);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float litTop;\n${VARYINGS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vShellY = position.y * length( instanceMatrix[ 1 ].xyz );
  vLitTop = litTop;
#else
  vShellY = 0.0;
  vLitTop = 1.0;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance *= step( vShellY, vLitTop );`);
    const patched = sh.vertexShader.includes('vLitTop = litTop') && sh.fragmentShader.includes('step( vShellY');
    if (!patched) console.error('[vacancy] patch missed');
  };
  mat.customProgramCacheKey = () => `${ownKey}+empty-floors`;
  return mat;
}
