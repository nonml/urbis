// What a failing lot hangs on itself, so it reads from the pavement before it
// loses a floor: letting boards on every face at first-floor height as it
// empties, roller shutters down over the ground floor once it is mostly gone,
// and demolition notices on the hoarding when it comes down. Driven by the
// parcel's vacancy (sim/decline.js), which moves only while the market does, so
// none of it flickers when demand wobbles across a threshold.
//
// One InstancedMesh of painted panels on one canvas atlas: 1 draw, and 0 while
// no lot is failing. Nothing here is lit — a letting board is paint — so it
// needs no power-zone twin; it goes as dark as the street around it. A stalled
// site hangs none of it: stopped is not failing.
import * as THREE from 'three';
import { hasFloors } from '../sim/decline.js';
import { HOARDING_THICK, PAD_RISE, SETBACK } from './zoning.js';

const CELL_W = 256;
const CELL_H = 128;
const COLS = 2;
const ROWS = 4;
const CELL = { com: 0, res: 1, ind: 2, notice: 3, shutter: 4 };
const LETTING = { com: 'OFFICES', res: 'FLATS', ind: 'WORKSHOPS' };

// Painted in the colours a real agent and a real contractor use: brick red,
// navy, warm white, galvanised steel. No light of their own (VGA-083).
const INK = {
  board: '#f1ede3', agent: '#a8322a', navy: '#1f2d4a', frame: '#2b2b2b',
  danger: '#b3262b', notice: '#f4f2ec', black: '#161616',
  steel: '#8b8f92', slatHi: '#a7abad', slatLo: '#6a6e71', rail: '#44484b',
};

// Vacancy at which each piece goes up. Boards early, so the warning comes
// well before the building gives anything back; shutters once most have left.
const BOARD_AT = 0.15;
const SHUTTER_AT = 0.5;

const BOARD_W = 3.2;
const BOARD_H = 1.6;
const BOARD_Y = 4.6;           // first-floor level, above a shopfront
const BOARD_OUT = 0.06;
const SHUTTER_BOTTOM = PAD_RISE + 0.12;  // on the plinth
const SHUTTER_TOP = 3.4;
const SHUTTER_INSET = 0.3;     // each side, inside the shell's corners
const SHUTTER_OUT = 0.12;      // clear of the plinth's lip
const NOTICE_W = 2.2;
const NOTICE_H = 1.1;
const NOTICE_Y = 1.35;         // inside the 2.4 m hoarding
const NOTICE_OUT = HOARDING_THICK / 2 + 0.04;
const EDGE_CLEAR = 0.4;        // a board stops short of the corner it hangs by
const PANELS_PER_PARCEL = 8;   // four faces of shutters, and of boards or notices

// The four faces of a box, each with the yaw that turns a plane's +z to it.
const FACES = [
  { nx: 1, nz: 0, yaw: Math.PI / 2 },
  { nx: -1, nz: 0, yaw: -Math.PI / 2 },
  { nx: 0, nz: 1, yaw: 0 },
  { nx: 0, nz: -1, yaw: Math.PI },
];

function frame(g, ox, oy, fill) {
  g.fillStyle = INK.frame;
  g.fillRect(ox, oy, CELL_W, CELL_H);
  g.fillStyle = fill;
  g.fillRect(ox + 6, oy + 6, CELL_W - 12, CELL_H - 12);
}

function letter(g, text, x, y, font, color) {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y, CELL_W - 24);   // squeezed, never cropped, by the frame
}

function paintBoard(g, ox, oy, use) {
  frame(g, ox, oy, INK.board);
  g.fillStyle = INK.agent;
  g.fillRect(ox + 6, oy + 6, CELL_W - 12, 66);
  letter(g, 'TO LET', ox + CELL_W / 2, oy + 41, 'bold 50px sans-serif', INK.board);
  letter(g, LETTING[use], ox + CELL_W / 2, oy + 96, 'bold 30px sans-serif', INK.navy);
}

function paintNotice(g, ox, oy) {
  frame(g, ox, oy, INK.notice);
  g.fillStyle = INK.danger;
  g.fillRect(ox + 6, oy + 6, CELL_W - 12, 40);
  letter(g, 'DANGER', ox + CELL_W / 2, oy + 27, 'bold 30px sans-serif', INK.notice);
  letter(g, 'DEMOLITION', ox + CELL_W / 2, oy + 70, 'bold 34px sans-serif', INK.black);
  letter(g, 'KEEP OUT', ox + CELL_W / 2, oy + 102, 'bold 20px sans-serif', INK.danger);
}

// A galvanised roller shutter: slats, a bottom rail, and the grime a street
// throws up the lower third of anything left closed.
function paintShutter(g, ox, oy) {
  g.fillStyle = INK.steel;
  g.fillRect(ox, oy, CELL_W, CELL_H);
  for (let y = 4; y < CELL_H - 12; y += 7) {
    g.fillStyle = INK.slatHi;
    g.fillRect(ox, oy + y, CELL_W, 2);
    g.fillStyle = INK.slatLo;
    g.fillRect(ox, oy + y + 5, CELL_W, 1);
  }
  g.fillStyle = INK.rail;
  g.fillRect(ox, oy + CELL_H - 12, CELL_W, 12);
  const grime = g.createLinearGradient(0, oy + CELL_H * 0.6, 0, oy + CELL_H);
  grime.addColorStop(0, 'rgba(40,34,26,0)');
  grime.addColorStop(1, 'rgba(40,34,26,0.45)');
  g.fillStyle = grime;
  g.fillRect(ox, oy + CELL_H * 0.6, CELL_W, CELL_H * 0.4);
}

function paintAtlas(maxAniso) {
  const c = document.createElement('canvas');
  c.width = CELL_W * COLS;
  c.height = CELL_H * ROWS;
  const g = c.getContext('2d');
  const at = (cell) => [(cell % COLS) * CELL_W, Math.floor(cell / COLS) * CELL_H];
  for (const use of Object.keys(LETTING)) paintBoard(g, ...at(CELL[use]), use);
  paintNotice(g, ...at(CELL.notice));
  paintShutter(g, ...at(CELL.shutter));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

// Where a cell starts in UV space. A CanvasTexture flips Y, so canvas row 0 is
// the top of UV space.
function cellOrigin(cell) {
  return [(cell % COLS) / COLS, 1 - (Math.floor(cell / COLS) + 1) / ROWS];
}

function panelMaterial(maxAniso) {
  const mat = new THREE.MeshStandardMaterial({
    map: paintAtlas(maxAniso), roughness: 0.72, metalness: 0.04, envMapIntensity: 0.3,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 cell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vMapUv = cell + vMapUv * vec2( ${(1 / COLS).toFixed(4)}, ${(1 / ROWS).toFixed(4)} );`);
    if (!sh.vertexShader.includes('cell + vMapUv')) console.error('[decline] atlas patch missed');
  };
  mat.customProgramCacheKey = () => 'decline-atlas';
  return mat;
}

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function panel(rig, cell, x, y, z, w, h, yaw) {
  const i = rig.count++;
  pos.set(x, y, z);
  quat.setFromAxisAngle(UP, yaw);
  scale.set(w, h, 1);
  rig.mesh.setMatrixAt(i, matrix.compose(pos, quat, scale));
  rig.cells.setXY(i, ...cellOrigin(cell));
}

// One panel on each face of a box of half-extents hx, hz around the lot, as
// wide as `fit` allows on that face.
function onFaces(rig, p, [hx, hz], out, cell, y, h, fit) {
  for (const f of FACES) {
    const w = fit(f.nx ? hz * 2 : hx * 2);
    panel(rig, cell, p.x + f.nx * (hx + out), y, p.z + f.nz * (hz + out), w, h, f.yaw);
  }
}

const boardFit = (span) => Math.min(BOARD_W, span - EDGE_CLEAR);
const noticeFit = (span) => Math.min(NOTICE_W, span - EDGE_CLEAR);
const shutterFit = (span) => span - SHUTTER_INSET * 2;

function dressParcel(rig, p) {
  if (!(p.use in LETTING)) return;
  const floors = hasFloors(p);
  const comingDown = p.building && p.vacancy >= 1;
  const shell = [p.w / 2 - SETBACK, p.d / 2 - SETBACK];
  if (floors && p.vacancy >= BOARD_AT && !comingDown) {
    onFaces(rig, p, shell, BOARD_OUT, CELL[p.use], BOARD_Y, BOARD_H, boardFit);
  }
  if (floors && p.vacancy >= SHUTTER_AT) {
    onFaces(rig, p, shell, SHUTTER_OUT, CELL.shutter, (SHUTTER_BOTTOM + SHUTTER_TOP) / 2,
      SHUTTER_TOP - SHUTTER_BOTTOM, shutterFit);
  }
  if (comingDown) onFaces(rig, p, [p.w / 2, p.d / 2], NOTICE_OUT, CELL.notice, NOTICE_Y, NOTICE_H, noticeFit);
}

export function buildDecline(city, maxAniso) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const capacity = city.parcels.length * PANELS_PER_PARCEL;
  const cells = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  geo.setAttribute('cell', cells);
  const mesh = new THREE.InstancedMesh(geo, panelMaterial(maxAniso), capacity);
  mesh.receiveShadow = true;
  mesh.count = 0;
  const rig = { mesh, cells, count: 0 };
  function update() {
    rig.count = 0;
    for (const p of city.parcels) dressParcel(rig, p);
    mesh.count = rig.count;
    mesh.instanceMatrix.needsUpdate = true;
    cells.needsUpdate = true;
    if (rig.count) mesh.computeBoundingSphere();
  }
  update();
  return { mesh, update };
}
