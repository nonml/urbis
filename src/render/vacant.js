// Free land the player can zone (sim/zoning.js freeLand): a roughed-up ground
// plate, a low construction fence along the street side with a gap, and a
// real-estate board on posts at the lot frontage, lettered LAND FOR LEASE. The
// same board stands in the overview and every lot carries a pale, dashed
// boundary, so the land the district left open reads at a glance from above.
//
// One merged mesh per scale, so the whole programme is two draws whatever the
// count of lots. A lot leaves the programme the moment it is zoned: the set is
// keyed on the sim's own `zed === null`, never on a geometry edit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AVENUES } from '../sim/world.js';

// Grounded, unlit-looking paint: gravel plate, galvanised fence, dark posts,
// pale board frame. The board face is plate white so the atlas letters show.
const PLATE_COLOR = 0x3b382f;
const FENCE_COLOR = 0x74796f;
const POST_COLOR = 0x45483f;
const PANEL_COLOR = 0xe9e7df;
const OUTLINE_COLOR = 0xf3f1e8;

const PLATE_H = 0.06;
const PLATE_TOP = 0.56;          // just above the zoning pad it covers (0.5)
const FENCE_H = 1.1;
const FENCE_T = 0.09;
const FENCE_GAP = 3.2;           // the way into the lot
const BOARD_W = 2.4;             // real-estate board, metres
const BOARD_H = 1.2;
const BOARD_MID = 2.0;           // centre height, so it reads "2 m up"
const BOARD_T = 0.08;
const POST_T = 0.12;
const BOARD_OUT = 0.55;          // board's street-side offset from the lot edge
const OUTLINE_W = 1.3;           // metres wide, ~5 px from the overview
const OUTLINE_Y = 0.62;
const DASHES = 3;
const DASH_GAP = 1.4;
const BOARD_INK = '#1f2d4d';     // navy on white: a plain sign colour
const CELL = 256;
const BOARD_CELL_H = 128;        // the atlas' top half is the board face

// Free land is land nobody has zoned. A lot mid-demolition keeps its `use`
// until it is empty, so it does not read as land for sale while it comes down.
export function isFree(p) {
  return p.zoned === null && p.use === null;
}

function nearestAvenue(x) {
  let best = AVENUES[0].x;
  for (const av of AVENUES) if (Math.abs(av.x - x) < Math.abs(best - x)) best = av.x;
  return best;
}

// Where a player stands on the pavement to face the lot: the walkway's centre,
// turned to look at the land. The test and a shot pose read it from here.
export function streetPose(p) {
  const dir = Math.sign(nearestAvenue(p.x) - p.x) || 1;
  return { x: p.x + dir * (p.w / 2 + 2.5), z: p.z, yaw: -dir * Math.PI / 2 };
}

function tinted(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// A white point in the atlas, so a coloured part never samples the letters.
function whiteUV(geo) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, 0.5, 0.2);
  return geo;
}

// The board face samples the atlas' top half, upright once CanvasTexture flips Y.
function boardUV(geo) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i), 0.5 + uv.getY(i) * 0.5);
  return geo;
}

// One canvas: the top half is the board face, the rest plain white. Signs are
// painted, never modelled (docs/ASSETS.md), and a real-estate board is painted.
function boardTexture() {
  const c = document.createElement('canvas');
  c.width = CELL;
  c.height = CELL;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, CELL, CELL);
  g.fillStyle = BOARD_INK;
  g.fillRect(6, 6, CELL - 12, BOARD_CELL_H - 12);
  g.fillStyle = '#ffffff';
  g.fillRect(12, 12, CELL - 24, BOARD_CELL_H - 24);
  g.fillStyle = BOARD_INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 34px sans-serif';
  g.fillText('LAND', CELL / 2, 42);
  g.font = 'bold 30px sans-serif';
  g.fillText('FOR LEASE', CELL / 2, 90);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A dashed strip of OUTLINE_W boxes along one side of the lot, at the boundary.
function dashes(parts, x, z, len, alongZ, color) {
  const dash = (len - (DASHES - 1) * DASH_GAP) / DASHES;
  if (dash <= 0.2) return;
  for (let i = 0; i < DASHES; i += 1) {
    const at = -len / 2 + dash / 2 + i * (dash + DASH_GAP);
    const g = alongZ
      ? new THREE.BoxGeometry(OUTLINE_W, 0.04, dash)
      : new THREE.BoxGeometry(dash, 0.04, OUTLINE_W);
    g.translate(alongZ ? x : x + at, OUTLINE_Y, alongZ ? z + at : z);
    parts.push(whiteUV(tinted(g, color)));
  }
}

// The board and its face, at (bx, z), turned to face the street (sign of dir).
function board(parts, bx, z, dir) {
  const top = BOARD_MID + BOARD_H / 2 + 0.05;
  for (const s of [-1, 1]) {
    const post = new THREE.BoxGeometry(POST_T, top, POST_T);
    post.translate(bx, top / 2, z + s * (BOARD_W / 2 - 0.2));
    parts.push(whiteUV(tinted(post, POST_COLOR)));
  }
  const panel = new THREE.BoxGeometry(BOARD_T, BOARD_H, BOARD_W);
  panel.translate(bx, BOARD_MID, z);
  parts.push(whiteUV(tinted(panel, PANEL_COLOR)));
  const face = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
  face.rotateY(dir * Math.PI / 2);
  face.translate(bx + dir * (BOARD_T / 2 + 0.01), BOARD_MID, z);
  parts.push(boardUV(tinted(face, 0xffffff)));
}

// One lot's street dressing: the full lot footprint is known, the street side
// is the nearer avenue. Everything the programme needs is here.
function streetParts(parts, p) {
  const dir = Math.sign(nearestAvenue(p.x) - p.x) || 1;
  const edge = p.x + dir * (p.w / 2);

  const plate = new THREE.BoxGeometry(p.w - 0.3, PLATE_H, p.d - 0.3);
  plate.translate(p.x, PLATE_TOP - PLATE_H / 2, p.z);
  parts.push(whiteUV(tinted(plate, PLATE_COLOR)));

  const seg = (p.d - FENCE_GAP) / 2;
  if (seg > 0.5) {
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(FENCE_T, FENCE_H, seg);
      g.translate(edge + dir * 0.12, FENCE_H / 2, p.z + s * (FENCE_GAP / 2 + seg / 2));
      parts.push(whiteUV(tinted(g, FENCE_COLOR)));
    }
  }
  board(parts, edge + dir * BOARD_OUT, p.z, dir);
}

function outlineParts(parts, p) {
  const dir = Math.sign(nearestAvenue(p.x) - p.x) || 1;
  const edge = p.x + dir * (p.w / 2);
  const back = p.x - dir * (p.w / 2);
  dashes(parts, edge, p.z, p.d, true, OUTLINE_COLOR);
  dashes(parts, back, p.z, p.d, true, OUTLINE_COLOR);
  dashes(parts, p.x, p.z - p.d / 2, p.w, false, OUTLINE_COLOR);
  dashes(parts, p.x, p.z + p.d / 2, p.w, false, OUTLINE_COLOR);
}

function merged(parts) {
  const geo = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
  return geo ?? new THREE.BufferGeometry();
}

export function buildVacant(city) {
  const group = new THREE.Group();
  const street = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({
    map: boardTexture(), vertexColors: true, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.4,
  }));
  street.name = 'vacant-lot';
  const outline = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
    vertexColors: true, fog: false,
  }));
  outline.name = 'vacant-outline';
  outline.visible = false;
  group.add(street, outline);

  let key = null;
  // Rebuild only when the free set changes. The set is small and the geometry
  // is static otherwise; a lot being zoned is the only thing that moves it.
  function rebuild() {
    const free = city.parcels.filter(isFree);
    const next = free.map((p) => city.parcels.indexOf(p)).join(',');
    if (next === key) return;
    key = next;
    const sParts = [];
    const oParts = [];
    for (const p of free) {
      streetParts(sParts, p);
      outlineParts(oParts, p);
    }
    street.geometry.dispose();
    outline.geometry.dispose();
    street.geometry = merged(sParts);
    outline.geometry = merged(oParts);
    street.visible = free.length > 0;
  }
  rebuild();
  return {
    group,
    // `overview` is true while the city camera is up: the boundary only adds
    // pixels there, where it is the whole point.
    update: (overview) => {
      rebuild();
      outline.visible = overview && outline.geometry.attributes.position !== undefined
        && outline.geometry.attributes.position.count > 0;
    },
  };
}
