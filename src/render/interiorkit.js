// The parts box for interiors and roofs: one painted atlas, and the helpers that
// turn a box or a plane into a coloured, atlas-mapped part ready to merge. Every
// space is built from these into one mesh, so a room full of stools, bowls and
// bottles costs one draw (law 4).
//
// Parts are authored in a space's own frame: X runs across the face (`a`), Y is
// height above the floor datum, and Z is -d, so walking in is walking toward -Z.
// render/interior.js carries the finished mesh into the world.
import * as THREE from 'three';

const ATLAS = 512;
const CELL_PX = 128;
const CELLS_PER_ROW = ATLAS / CELL_PX;

export const CELL = {
  plain: 0, noren: 1, menu: 2, wood: 3, floor: 4, tile: 5, frost: 6, stock: 7,
  ticket: 8, poster: 9, sign: 10, lantern: 11, fridge: 12, pavers: 13, doorglass: 14, lamp: 15,
};

function cellOrigin(k) {
  return [(k % CELLS_PER_ROW) * CELL_PX, Math.floor(k / CELLS_PER_ROW) * CELL_PX];
}

// ---------------------------------------------------------------------------
// Painting. Every cell is drawn with canvas primitives only — no model output,
// no photographs (docs/ASSETS.md).

function paintNoren(g, x, y) {
  g.fillStyle = '#1f2b48';
  g.fillRect(x, y, 128, 128);
  g.fillStyle = '#e9e4d8';
  g.fillRect(x, y, 128, 10);
  // A bowl with steam over it: the trade, readable from across the avenue.
  g.beginPath();
  g.arc(x + 64, y + 62, 30, 0, Math.PI);
  g.fill();
  g.fillRect(x + 30, y + 58, 68, 6);
  g.strokeStyle = '#e9e4d8';
  g.lineWidth = 4;
  for (const dx of [-14, 0, 14]) {
    g.beginPath();
    g.moveTo(x + 64 + dx, y + 52);
    g.bezierCurveTo(x + 56 + dx, y + 42, x + 72 + dx, y + 36, x + 64 + dx, y + 24);
    g.stroke();
  }
  g.fillStyle = '#121a2e';
  for (const sx of [42, 85]) g.fillRect(x + sx, y + 14, 2, 114);   // the splits
}

function paintMenu(g, x, y) {
  g.fillStyle = '#2a1a10';
  g.fillRect(x, y, 128, 128);
  for (let i = 0; i < 6; i += 1) {
    const px = x + 4 + i * 21;
    g.fillStyle = i % 2 ? '#d7b27a' : '#cfa76c';
    g.fillRect(px, y + 6, 18, 116);
    g.fillStyle = '#1b120a';
    for (let k = 0; k < 5; k += 1) g.fillRect(px + 6, y + 14 + k * 15, 6, 9 - (k % 2) * 3);
    g.fillStyle = '#a82c20';
    g.fillRect(px + 4, y + 96, 10, 18);
  }
}

function paintWood(g, x, y) {
  g.fillStyle = '#7a4d2a';
  g.fillRect(x, y, 128, 128);
  for (let i = 0; i < 26; i += 1) {
    g.fillStyle = i % 3 ? 'rgba(40,20,8,0.22)' : 'rgba(255,210,160,0.10)';
    g.fillRect(x, y + ((i * 37) % 128), 128, 1 + (i % 2));
  }
}

function paintGrid(g, x, y, cols, rows, fill, grout, jitter) {
  g.fillStyle = grout;
  g.fillRect(x, y, 128, 128);
  const w = 128 / cols;
  const h = 128 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const shade = 1 + (((r * 7 + c * 13) % 5) - 2) * jitter;
      g.fillStyle = fill(shade);
      g.fillRect(x + c * w + 2, y + r * h + 2, w - 4, h - 4);
    }
  }
}

function rgb(r, gr, b, k) {
  return `rgb(${Math.round(r * k)},${Math.round(gr * k)},${Math.round(b * k)})`;
}

function paintFrost(g, x, y) {
  const grad = g.createLinearGradient(0, y, 0, y + 128);
  grad.addColorStop(0, '#f4f6f8');
  grad.addColorStop(1, '#c9cfd6');
  g.fillStyle = grad;
  g.fillRect(x, y, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 9; i += 1) g.fillRect(x + ((i * 29) % 120), y, 3, 128);
  g.fillStyle = '#e6dcc4';                                        // cafe curtain
  g.fillRect(x, y + 60, 128, 44);
  g.fillStyle = 'rgba(120,90,50,0.35)';
  for (let i = 0; i < 16; i += 1) g.fillRect(x + i * 8, y + 60, 1, 44);
}

function paintStock(g, x, y) {
  g.fillStyle = '#1a1612';
  g.fillRect(x, y, 128, 128);
  const packs = ['#c8342a', '#e8c23a', '#f1ece0', '#2f7a4a', '#d8702a', '#2d5aa0'];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      const k = (r * 3 + c * 2) % packs.length;
      g.fillStyle = packs[k];
      g.fillRect(x + 3 + c * 25, y + 4 + r * 31, 21, 26);
      g.fillStyle = k === 2 ? '#c8342a' : '#f4efe4';
      g.fillRect(x + 6 + c * 25, y + 12 + r * 31, 15, 5);
    }
  }
}

function paintTicket(g, x, y) {
  g.fillStyle = '#e8e2d2';
  g.fillRect(x, y, 128, 128);
  const keys = ['#c8342a', '#e8c23a', '#2d5aa0', '#2f7a4a'];
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      g.fillStyle = keys[(r + c) % keys.length];
      g.fillRect(x + 10 + c * 28, y + 8 + r * 15, 24, 11);
    }
  }
  g.fillStyle = '#222';
  g.fillRect(x + 20, y + 104, 30, 8);
  g.fillRect(x + 76, y + 100, 34, 18);
}

function paintPoster(g, x, y) {
  g.fillStyle = '#e8b830';
  g.fillRect(x, y, 128, 128);
  g.fillStyle = '#b3271d';
  g.beginPath();
  g.arc(x + 64, y + 50, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f7f0dc';
  g.fillRect(x + 54, y + 30, 20, 40);
  g.fillStyle = '#1b1712';
  g.fillRect(x + 14, y + 96, 100, 10);
  g.fillRect(x + 30, y + 112, 68, 6);
}

function paintSign(g, x, y) {
  g.fillStyle = '#16305a';
  g.fillRect(x, y, 128, 128);
  g.fillStyle = '#f2f2ee';
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('STAIRS', x + 64, y + 44);
  g.fillText('ROOF', x + 64, y + 84);
  g.fillRect(x + 6, y + 6, 116, 3);
  g.fillRect(x + 6, y + 119, 116, 3);
}

function paintLantern(g, x, y) {
  g.fillStyle = '#c23a22';
  g.fillRect(x, y, 128, 128);
  g.fillStyle = '#1a1210';
  g.fillRect(x, y, 128, 14);
  g.fillRect(x, y + 114, 128, 14);
  g.fillStyle = 'rgba(80,10,5,0.35)';
  for (let i = 0; i < 8; i += 1) g.fillRect(x, y + 20 + i * 12, 128, 2);   // the ribs
  g.fillStyle = '#1a1210';
  g.beginPath();
  g.arc(x + 64, y + 64, 20, 0, Math.PI * 2);
  g.fill();
}

function paintFridge(g, x, y) {
  g.fillStyle = '#eef4f6';
  g.fillRect(x, y, 128, 128);
  const glass = ['#6a3a14', '#2c5a2a', '#b77a1e', '#8a1f18'];
  for (let shelf = 0; shelf < 4; shelf += 1) {
    const sy = y + 8 + shelf * 30;
    for (let b = 0; b < 9; b += 1) {
      g.fillStyle = glass[(b + shelf) % glass.length];
      g.fillRect(x + 6 + b * 13, sy + 6, 9, 22);
      g.fillRect(x + 8 + b * 13, sy, 5, 7);
    }
    g.fillStyle = '#9aa4aa';
    g.fillRect(x, sy + 28, 128, 2);
  }
}

function paintDoorGlass(g, x, y) {
  const grad = g.createLinearGradient(0, y, 0, y + 128);
  grad.addColorStop(0, '#ffe2b0');
  grad.addColorStop(0.55, '#e9a462');
  grad.addColorStop(1, '#6a3e1e');
  g.fillStyle = grad;
  g.fillRect(x, y, 128, 128);
  g.fillStyle = 'rgba(30,16,8,0.7)';
  g.fillRect(x, y + 86, 128, 14);                                 // the counter
  g.fillRect(x + 76, y + 50, 14, 36);                             // the keeper
  g.fillRect(x + 74, y + 38, 18, 13);
  for (const sx of [14, 38]) g.fillRect(x + sx, y + 100, 5, 28);  // stool legs
}

function paintCells(g, glow) {
  const [px, py] = cellOrigin(CELL.plain);
  g.fillStyle = '#ffffff';
  g.fillRect(px, py, CELL_PX, CELL_PX);
  const painters = [
    [CELL.noren, paintNoren], [CELL.menu, paintMenu], [CELL.wood, paintWood],
    [CELL.frost, paintFrost], [CELL.stock, paintStock], [CELL.ticket, paintTicket],
    [CELL.poster, paintPoster], [CELL.sign, paintSign], [CELL.lantern, paintLantern],
    [CELL.fridge, paintFridge], [CELL.doorglass, paintDoorGlass],
  ];
  for (const [k, paint] of painters) paint(g, ...cellOrigin(k));
  paintGrid(g, ...cellOrigin(CELL.floor), 2, 2, (s) => rgb(58, 50, 44, s), '#1a1612', 0.06);
  paintGrid(g, ...cellOrigin(CELL.tile), 4, 8, (s) => rgb(206, 202, 190, s), '#8a867c', 0.03);
  paintGrid(g, ...cellOrigin(CELL.pavers), 2, 2, (s) => rgb(128, 126, 120, s), '#4a4844', 0.08);
  const [lx, ly] = cellOrigin(CELL.lamp);
  g.fillStyle = '#ffffff';
  g.fillRect(lx, ly, CELL_PX, CELL_PX);
  // The glow twin: black everywhere except the cells that are light sources,
  // which keep their own colour so a lantern glows red and a sign glows white.
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, ATLAS, ATLAS);
  for (const k of [CELL.sign, CELL.lantern, CELL.fridge, CELL.doorglass, CELL.lamp]) {
    const [cx, cy] = cellOrigin(k);
    glow.drawImage(g.canvas, cx, cy, CELL_PX, CELL_PX, cx, cy, CELL_PX, CELL_PX);
  }
  const [sx, sy] = cellOrigin(CELL.sign);
  glow.fillStyle = 'rgba(0,0,0,0.55)';                            // the board stays dark
  glow.fillRect(sx, sy, CELL_PX, CELL_PX);
  glow.fillStyle = '#f2f2ee';
  glow.font = 'bold 26px sans-serif';
  glow.textAlign = 'center';
  glow.textBaseline = 'middle';
  glow.fillText('STAIRS', sx + 64, sy + 44);
  glow.fillText('ROOF', sx + 64, sy + 84);
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // No mips: a half-resolution mip of a 4x4 atlas bleeds one cell into the next.
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function buildAtlas() {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = ATLAS;
    c.height = ATLAS;
    return c.getContext('2d');
  };
  const g = make();
  const glow = make();
  paintCells(g, glow);
  return { albedo: canvasTexture(g.canvas), glow: canvasTexture(glow.canvas) };
}

// ---------------------------------------------------------------------------
// Parts.

const INSET = 1.5 / ATLAS;
const _c = new THREE.Color();

// Point a geometry's 0..1 UVs at one atlas cell. `plain` collapses them onto
// the cell's middle, so a flat-coloured part never picks up a texel edge.
function mapCell(geo, k) {
  const [cx, cy] = cellOrigin(k);
  const u0 = cx / ATLAS + INSET;
  const v0 = 1 - (cy + CELL_PX) / ATLAS + INSET;
  const span = CELL_PX / ATLAS - INSET * 2;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    const u = k === CELL.plain ? 0.5 : uv.getX(i);
    const v = k === CELL.plain ? 0.5 : uv.getY(i);
    uv.setXY(i, u0 + u * span, v0 + v * span);
  }
}

// A finished part: colour per vertex, UVs in its cell, and — for a light
// source — the light it gives off, fixed rather than baked.
export function part(geo, color, cell = CELL.plain, glow = null) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  _c.set(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) col.set([_c.r, _c.g, _c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  mapCell(g, cell);
  g.userData.glow = glow;
  return g;
}

// ---------------------------------------------------------------------------
// Kit pieces. The rooms draw their furniture from these, not from raw boxes:
// `cased` is the kit's square-section piece — counter carcasses, jambs,
// beams, sills, crates — subdivided about every `step` metres so the baked
// light pools on it, and `tag` names every part a builder pushed the way the
// pool loader tags its meshes (models.js), so the sweep reads a model.
export function cased(w, h, depth, a, y, d, step = 0.5) {
  const seg = (v) => Math.max(1, Math.round(v / step));
  const g = new THREE.BoxGeometry(w, h, depth, seg(w), seg(h), seg(depth));
  g.translate(a, y, -d);
  return g;
}

export function tag(out, from, name) {
  for (let i = from; i < out.length; i += 1) out[i].userData.model = name;
}

export function cylinder(rTop, rBottom, h, a, y, d, sides = 12) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, sides);
  g.translate(a, y, -d);
  return g;
}

export function ball(r, a, y, d) {
  const g = new THREE.SphereGeometry(r, 12, 9);
  g.translate(a, y, -d);
  return g;
}

// Faces for a plane: which way it looks, in the frame.
const FACING = {
  in: [0, Math.PI, 0], out: [0, 0, 0], right: [0, Math.PI / 2, 0], left: [0, -Math.PI / 2, 0],
  up: [-Math.PI / 2, 0, 0], down: [Math.PI / 2, 0, 0],
};

// A plane of w x h, facing `facing`, centred on (a, y, d).
export function panel(w, h, facing, a, y, d, segW = 1, segH = 1) {
  const g = new THREE.PlaneGeometry(w, h, segW, segH);
  const [rx, ry] = FACING[facing];
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(a, y, -d);
  return g;
}

// A plane tiled with one atlas cell every `tile` metres: one quad per tile, so
// the cell repeats and the baked light gets a vertex every tile.
export function tiled(w, h, tile, facing, a, y, d, color, cell) {
  const cols = Math.max(1, Math.round(w / tile));
  const rows = Math.max(1, Math.round(h / tile));
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u = -w / 2 + (c + 0.5) * (w / cols);
      const v = -h / 2 + (r + 0.5) * (h / rows);
      const q = new THREE.PlaneGeometry(w / cols, h / rows);
      q.translate(u, v, 0);
      const [rx, ry] = FACING[facing];
      if (rx) q.rotateX(rx);
      if (ry) q.rotateY(ry);
      q.translate(a, y, -d);
      out.push(part(q, color, cell));
    }
  }
  return out;
}
