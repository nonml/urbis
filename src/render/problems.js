// Problem icons (M5.T34, criterion M5-16): one pooled billboard layer over the
// held-back buildings of the city view, each showing the first cause the sim
// reports (problemList in sim/decline.js). One InstancedMesh on one canvas
// atlas — 1 draw at any count of icons, 0 on the street or when nothing is
// held back (law 4). The meshes are planning chrome, not world: unlit, outside
// the fog, and their own pick target, so a click can open the reason card
// without painting the lot under it.
import * as THREE from 'three';
import { PROBLEM, problemList } from '../sim/decline.js';
import { builtHeight } from '../sim/zoning.js';

// Six cells: a road, a bolt, a demand arrow, a service cross, a droplet and a
// bin — the marks of the causes M5-16 names, M12's two included.
const CELL = 128, COLS = 3, ROWS = 2;
const MARKS = ['road', 'power', 'demand', 'service', 'water', 'collection'];
const MARK_CELL = Object.fromEntries(MARKS.map((mark, i) => [mark, i]));

export const ICON_LIFT = 5;       // metres above the lot's roofline
const ICON_FRACTION = 0.03;       // icon width as a share of the camera distance
const ICON_MIN = 2;               // metres, at the closest zoom

// Grounded planner paint, not neon: a dark plate with the cause's own colour.
const INK = {
  plate: '#12161d', road: '#d9a441', power: '#e8c34a', demand: '#a9bed4',
  service: '#7fb2e0', water: '#6fb6d9', collection: '#9fbe7a',
};

function cellOrigin(cell) {
  return [(cell % COLS) / COLS, 1 - (Math.floor(cell / COLS) + 1) / ROWS];
}

function drawMark(g, mark, ink) {
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  if (mark === 'road') {
    g.moveTo(-26, -26); g.lineTo(-26, 26);
    g.moveTo(26, -26); g.lineTo(26, 26);
    g.moveTo(0, -20); g.lineTo(0, -7);
    g.moveTo(0, 7); g.lineTo(0, 20);
  } else if (mark === 'power') {
    g.moveTo(8, -28); g.lineTo(-14, 4); g.lineTo(0, 4); g.lineTo(-8, 28);
    g.lineTo(14, -6); g.lineTo(0, -6); g.closePath();
  } else if (mark === 'demand') {
    g.moveTo(0, -28); g.lineTo(0, 16);
    g.moveTo(-16, 2); g.lineTo(0, 20); g.lineTo(16, 2);
  } else if (mark === 'service') {
    g.moveTo(-26, 0); g.lineTo(26, 0);
    g.moveTo(0, -26); g.lineTo(0, 26);
  } else if (mark === 'water') {
    g.moveTo(0, -28);
    g.bezierCurveTo(20, -4, 22, 8, 0, 26);
    g.bezierCurveTo(-22, 8, -20, -4, 0, -28);
    g.closePath();
  } else {
    g.moveTo(-20, -16); g.lineTo(20, -16); g.lineTo(14, 26); g.lineTo(-14, 26);
    g.closePath();
    g.moveTo(-26, -22); g.lineTo(26, -22);
  }
  g.stroke();
  if (mark === 'power' || mark === 'water' || mark === 'collection') g.fill();
}

function paintAtlas() {
  const c = document.createElement('canvas');
  c.width = CELL * COLS;
  c.height = CELL * ROWS;
  const g = c.getContext('2d');
  for (const [mark, cell] of Object.entries(MARK_CELL)) {
    const ox = (cell % COLS) * CELL;
    const oy = Math.floor(cell / COLS) * CELL;
    g.beginPath();
    g.roundRect(ox + 8, oy + 8, CELL - 16, CELL - 16, 24);
    g.fillStyle = INK.plate;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = INK[mark];
    g.stroke();
    g.save();
    g.translate(ox + CELL / 2, oy + CELL / 2);
    drawMark(g, mark, INK[mark]);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One atlas, one material: the vertex shader offsets the plane's uv into its
// mark's cell, exactly the patch render/decline.js uses. The miss guard and the
// cache key are law here too (AGENTS.md "Patch a material's shader").
function iconMaterial() {
  // Planner chrome: the icon reads over the roof it belongs to and over a
  // neighbour in front of it, the way a warning marker in this genre does.
  const mat = new THREE.MeshBasicMaterial({
    map: paintAtlas(), fog: false, transparent: true, depthWrite: false, depthTest: false,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 cell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vMapUv = cell + vMapUv * vec2( ${(1 / COLS).toFixed(4)}, ${(1 / ROWS).toFixed(4)} );`);
    if (!sh.vertexShader.includes('cell + vMapUv')) console.error('[problems] atlas patch missed');
  };
  mat.customProgramCacheKey = () => 'problems-atlas';
  return mat;
}

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// A road op can sign new lots into the live city after the layer was built:
// the pool grows like the kerbs do, same material, one draw at any count.
function makePool(rig, capacity) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const cells = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  geo.setAttribute('cell', cells);
  const mesh = new THREE.InstancedMesh(geo, rig.material, capacity);
  mesh.name = 'problems';
  mesh.renderOrder = 8;
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  if (rig.mesh) rig.group.remove(rig.mesh);
  rig.mesh = mesh;
  rig.cells = cells;
  rig.group.add(mesh);
}

function update(rig, camera, lift) {
  const bad = !(lift > 0) || rig.city.parcels.length === 0;
  if (bad) {
    rig.mesh.visible = false;
    rig.list.length = 0;
    return;
  }
  const list = problemList(rig.city, { dark: rig.dark });
  if (list.length > rig.mesh.instanceMatrix.count) makePool(rig, list.length);
  const mesh = rig.mesh;
  mesh.count = list.length;
  mesh.visible = list.length > 0;
  rig.list = [];
  rig.causes.fill(null);
  list.forEach(({ i, cause }, k) => {
    const p = rig.city.parcels[i];
    const y = builtHeight(p) + ICON_LIFT;
    pos.set(p.x, y, p.z);
    const size = Math.max(ICON_MIN, camera.position.distanceTo(pos) * ICON_FRACTION);
    quat.copy(camera.quaternion);
    scale.set(size, size, 1);
    mesh.setMatrixAt(k, matrix.compose(pos, quat, scale));
    rig.cells.setXY(k, ...cellOrigin(MARK_CELL[PROBLEM[cause].mark]));
    rig.causes[i] = cause;
    rig.list.push({ i, cause, x: p.x, y, z: p.z });
  });
  mesh.instanceMatrix.needsUpdate = true;
  rig.cells.needsUpdate = true;
  if (list.length) mesh.computeBoundingSphere();
}

// The problem layer, ready for the city view to own: `frame(camera, lift)`
// places the icons each frame from the sim's own list, `pick(camera, x, y)`
// names the lot an icon under a screen point belongs to, and `causeOf(i)` is
// that lot's cause this frame.
export function buildProblems(city, { dark = () => false } = {}) {
  const group = new THREE.Group();
  const rig = { city, dark, group, list: [], causes: [] };
  rig.material = iconMaterial();
  makePool(rig, Math.max(1, city.parcels.length));
  return {
    mesh: group,
    frame: (camera, lift) => update(rig, camera, lift),
    pick: (camera, x, y) => {
      if (!rig.mesh.visible || rig.mesh.count === 0) return -1;
      raycaster.setFromCamera(ndc.set(x, y), camera);
      const hit = raycaster.intersectObject(rig.mesh, false)[0];
      return hit?.instanceId === undefined ? -1 : rig.list[hit.instanceId]?.i ?? -1;
    },
    causeOf: (i) => rig.causes[i] ?? null,
  };
}
