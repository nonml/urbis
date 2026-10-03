// The arc on the street (VGA-065): one InstancedMesh, one draw, for everything
// the story puts into the world — a column of light over the place in hand, a
// ring on the ground at its foot, and the signs a choice has hung on the city.
// All of them are quads cut from one canvas atlas; each instance carries the
// atlas cell it shows, so a new sign is data (arc.json), not a new mesh.
import * as THREE from 'three';
import { heightAt } from '../sim/world.js';
import { zoneAt } from '../sim/street.js';

// The story boards stack below the beam, and two of them do not fit under it in a square 1024.
const ATLAS_W = 1024;
const ATLAS_H = 2048;
const CELL_PAD = 8;              // px between cells, so mip levels don't bleed
// The marker: a column tall enough to clear a tower from a block away, with a
// ring at its foot. Warm amber, the objective line's colour — not a hologram.
const BEAM_CELL = [0, 0, 64, 512];
const RING_CELL = [72, 0, 256, 256];
const BEAM_W = 2.2;
const BEAM_H = 60;
const RING_R = 2.4;
const RING_LIFT = 0.06;
const MARKER_HEX = 0xffb14e;
const PULSE_HZ = 0.6;
const PULSE_DEPTH = 0.18;
// Fog scale per instance: the column keeps most of its reach through the haze,
// or it could not guide anyone further than the next corner.
const BEAM_FOG = 0.3;
// A painted sign is lit by the street: full by day, by the lamps at night,
// barely at all when its block is blacked out.
const NIGHT_LIT = 0.5;
const DARK_LIT = 0.12;
// Beam faces: two crossed planes, each doubled back to back, so from any side
// two of them face the camera and the column never thins to an edge.
const BEAM_YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const RING_SLOT = BEAM_YAWS.length;
const FIRST_SIGN = RING_SLOT + 1;
// Sign cells in px per metre of sign: sharp at the play camera, small in the atlas.
const SIGN_PX_PER_M = 112;

function fitFont(g, text, weight, maxPx, maxW) {
  let px = maxPx;
  g.font = `${weight} ${px}px sans-serif`;
  while (px > 8 && g.measureText(text).width > maxW) {
    px -= 2;
    g.font = `${weight} ${px}px sans-serif`;
  }
}

function paintBeam(g, [x, y, w, h]) {
  const across = g.createLinearGradient(x, 0, x + w, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = across;
  g.fillRect(x, y, w, h);
  // Fade out toward the sky: strongest at the street, gone at the top.
  const up = g.createLinearGradient(0, y + h, 0, y);
  up.addColorStop(0, 'rgba(0,0,0,0.9)');
  up.addColorStop(0.4, 'rgba(0,0,0,0.6)');
  up.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = up;
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = 'source-over';
}

function paintRing(g, [x, y, w]) {
  const c = w / 2;
  const ring = g.createRadialGradient(x + c, y + c, 0, x + c, y + c, c);
  ring.addColorStop(0, 'rgba(255,255,255,0)');
  ring.addColorStop(0.62, 'rgba(255,255,255,0)');
  ring.addColorStop(0.78, 'rgba(255,255,255,0.9)');
  ring.addColorStop(0.86, 'rgba(255,255,255,0.35)');
  ring.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = ring;
  g.fillRect(x, y, w, w);
}

// A cloth banner tied across a shopfront: painted letters, a fold or two, and
// the eyelets it hangs from.
function paintBanner(g, s, [x, y, w, h]) {
  g.fillStyle = s.color;
  g.fillRect(x, y, w, h);
  for (let k = 1; k < 4; k++) {
    g.fillStyle = `rgba(0,0,0,${k % 2 ? 0.07 : 0.04})`;
    g.fillRect(x + (w * k) / 4 - 6, y, 12, h);
  }
  g.fillStyle = s.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, s.text, 'bold', Math.round(h * 0.52), w * 0.9);
  g.fillText(s.text, x + w / 2, y + h * 0.4);
  fitFont(g, s.sub, 'bold', Math.round(h * 0.17), w * 0.86);
  g.fillText(s.sub, x + w / 2, y + h * 0.82);
  g.fillStyle = 'rgba(40,40,40,0.9)';
  for (const ex of [x + 10, x + w - 10]) for (const ey of [y + 10, y + h - 10]) g.fillRect(ex - 4, ey - 4, 8, 8);
}

// A site board on two posts: the panel on top, the legs down to the pavement,
// and nothing between them — the city shows through.
const BOARD_PANEL = 0.6;
const POST_W = 0.07;
function paintBoard(g, s, [x, y, w, h]) {
  const panelH = h * BOARD_PANEL;
  g.fillStyle = '#2b2d30';
  for (const px of [x + w * 0.14, x + w * (0.86 - POST_W)]) g.fillRect(px, y + panelH - 4, w * POST_W, h - panelH + 4);
  g.fillStyle = s.color;
  g.fillRect(x, y, w, panelH);
  g.strokeStyle = s.ink;
  g.lineWidth = 4;
  g.strokeRect(x + 10, y + 10, w - 20, panelH - 20);
  g.fillStyle = s.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, s.text, 'bold', Math.round(panelH * 0.3), w * 0.84);
  g.fillText(s.text, x + w / 2, y + panelH * 0.4);
  fitFont(g, s.sub, 'bold', Math.round(panelH * 0.1), w * 0.8);
  g.fillText(s.sub, x + w / 2, y + panelH * 0.72);
}

// Row packer: signs fill rows below the marker cells, left to right.
function packSigns(signs) {
  let x = 0;
  let y = BEAM_CELL[3] + CELL_PAD;
  let rowH = 0;
  return signs.map((s) => {
    const w = Math.round(s.w * SIGN_PX_PER_M);
    const h = Math.round(s.h * SIGN_PX_PER_M);
    if (x + w > ATLAS_W) {
      x = 0;
      y += rowH + CELL_PAD;
      rowH = 0;
    }
    const cell = [x, y, w, h];
    x += w + CELL_PAD;
    rowH = Math.max(rowH, h);
    if (y + h > ATLAS_H) console.error(`[arc] sign ${s.id} does not fit the atlas`);
    return cell;
  });
}

function atlasTexture(signs, cells) {
  const c = document.createElement('canvas');
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  const g = c.getContext('2d');
  paintBeam(g, BEAM_CELL);
  paintRing(g, RING_CELL);
  signs.forEach((s, i) => (s.kind === 'board' ? paintBoard : paintBanner)(g, s, cells[i]));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Canvas row 0 is the top and a CanvasTexture flips Y.
function uvRect([x, y, w, h]) {
  return [x / ATLAS_W, 1 - (y + h) / ATLAS_H, w / ATLAS_W, h / ATLAS_H];
}

function markerMaterial(map) {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  const cellUv = '#ifdef USE_MAP\n\tvMapUv = aCell.xy + vMapUv * aCell.zw;\n#endif';
  const fogScale = '#ifdef USE_FOG\n\tvFogDepth *= aFog;\n#endif';
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCell;\nattribute float aFog;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n${cellUv}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${fogScale}`);
    if (!sh.vertexShader.includes('aCell.xy +') || !sh.vertexShader.includes('*= aFog')) {
      console.error('[arc] marker atlas patch missed');
    }
  };
  mat.customProgramCacheKey = () => 'arcMarker';
  return mat;
}

const dummy = new THREE.Object3D();
const color = new THREE.Color();

function place(mesh, i, x, y, z, yaw, sx, sy, flat = false) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(flat ? -Math.PI / 2 : 0, yaw, 0, 'YXZ');
  dummy.scale.set(sx, sy, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

function hide(mesh, i) {
  dummy.scale.set(0, 0, 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

export function buildArcMarker(signs) {
  const cells = packSigns(signs);
  const n = FIRST_SIGN + signs.length;
  const geo = new THREE.PlaneGeometry(1, 1);
  const cell = new Float32Array(n * 4);
  const fog = new Float32Array(n).fill(1);
  BEAM_YAWS.forEach((_, i) => { cell.set(uvRect(BEAM_CELL), i * 4); fog[i] = BEAM_FOG; });
  cell.set(uvRect(RING_CELL), RING_SLOT * 4);
  cells.forEach((c, k) => cell.set(uvRect(c), (FIRST_SIGN + k) * 4));
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 4));
  geo.setAttribute('aFog', new THREE.InstancedBufferAttribute(fog, 1));
  const mesh = new THREE.InstancedMesh(geo, markerMaterial(atlasTexture(signs, cells)), n);
  // The column moves with the story; bounds computed once would cull it.
  mesh.frustumCulled = false;
  mesh.visible = false;
  for (let i = 0; i < n; i++) {
    hide(mesh, i);
    mesh.setColorAt(i, color.set(0xffffff));
  }
  return { mesh, signs, target: null, shown: '' };
}

function placeMarker(rig, target) {
  const { mesh } = rig;
  if (!target) {
    for (let i = 0; i <= RING_SLOT; i++) hide(mesh, i);
    return;
  }
  const y = heightAt(target.x, target.z);
  BEAM_YAWS.forEach((yaw, i) => place(mesh, i, target.x, y + BEAM_H / 2, target.z, yaw, BEAM_W, BEAM_H));
  place(mesh, RING_SLOT, target.x, y + RING_LIFT, target.z, 0, RING_R * 2, RING_R * 2, true);
}

function placeSigns(rig, shown) {
  rig.signs.forEach((s, k) => {
    const i = FIRST_SIGN + k;
    if (!shown.has(s.id)) return hide(rig.mesh, i);
    const yaw = Math.atan2(s.face[0], s.face[1]);
    return place(rig.mesh, i, s.x, heightAt(s.x, s.z) + s.y, s.z, yaw, s.w, s.h);
  });
}

// target: {x, z} or null. shown: the ids of the signs the arc has put up.
// glows: each power zone's light, 0–1, the same the lamps read.
export function updateArcMarker(rig, target, shown, time, night, glows) {
  const moved = target?.x !== rig.target?.x || target?.z !== rig.target?.z;
  if (moved) placeMarker(rig, target);
  const key = shown.map((s) => s.id).join('|');
  if (key !== rig.shown) placeSigns(rig, new Set(shown.map((s) => s.id)));
  if (moved || key !== rig.shown) rig.mesh.instanceMatrix.needsUpdate = true;
  rig.target = target ? { ...target } : null;
  rig.shown = key;
  rig.mesh.visible = !!target || shown.length > 0;
  const pulse = 1 - PULSE_DEPTH * (0.5 + 0.5 * Math.sin(time * PULSE_HZ * Math.PI * 2));
  color.set(MARKER_HEX).multiplyScalar(pulse);
  for (let i = 0; i <= RING_SLOT; i++) rig.mesh.setColorAt(i, color);
  rig.signs.forEach((s, k) => {
    const glow = glows[zoneAt(s.z)];
    const lit = 1 + (NIGHT_LIT * glow + DARK_LIT * (1 - glow) - 1) * night;
    rig.mesh.setColorAt(FIRST_SIGN + k, color.setScalar(lit));
  });
  rig.mesh.instanceColor.needsUpdate = true;
}
