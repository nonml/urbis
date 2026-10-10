// Road pieces pooled (M3.T26, M3-5). Carriageway, walks, kerbs and markings
// were merged geometry in render/block.js; now each is a slot in a fixed-size
// InstancedMesh, one pool per material, keyed to the graph's edges and
// junctions (sim/map.js): an edit rewrites its own slots (M3.T27).
import * as THREE from 'three';
import { ROAD_HALF_WIDTH as ROAD_HALF, WALKWAY_WIDTH } from '../sim/world.js';
import { WORLD_FURNITURE, rhythm } from '../sim/furniture.js';
import { worldMap } from '../sim/patrol.js';
import { ROAD_TYPES, roadTypeOf } from '../sim/map.js';
import { loadPBRMaps, standardFromMaps } from './materials.js';
import { buildInstancePools } from './buildings.js';
import { refreshBuildGround } from './landscape.js';
import { buildRiver, bridgeHalf } from './river.js';

export const WALK_RISE = 0.24;
const PLAZA_WALK_WIDTH = 2.4;  // narrower footways flanking the plaza's 104 m
const KERB_WIDTH = 0.22;
const KERB_RISE = 0.15;
const EDGE_LINE_OUT = ROAD_HALF + 0.2;  // the painted edge line, as shipped
const MARK_Y = 0.02;
const MANHOLE_R = 0.55;
const ROAD_SLACK = 96;  // headroom for a road op that adds a stretch (M3.T27)
const BRIDGE_SLACK = 96;  // the same headroom for a bridge a road op brings
const ARROW_SLACK = 96;   // headroom for a road op that turns roads into one-ways

// The half-width a road is drawn at (M5.T25, M5-10): a lane is
// ROAD_HALF_WIDTH's metres, so a street's two stand 3.5 m each side of its
// centre line and an avenue's four twice as far out. The drag refuses at the
// same number (sim/cityview.js halfWidth), so a road is never refused a width
// the pools then fail to draw.
const halfWidthOf = (edge) => ROAD_TYPES[roadTypeOf(edge)].lanes / 2 * ROAD_HALF;

// The widest road drawn through a point: a junction's own square and its
// crossings are sized by the widest way that meets there, not by a street.
function widestAt(map, nodes, x, z) {
  let half = ROAD_HALF;
  for (const e of map.graph.edges) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    if ((a.x === x && a.z === z) || (b.x === x && b.z === z)) half = Math.max(half, halfWidthOf(e));
  }
  return half;
}

// One flat quad as a slot: the pool's unit plane turned to the ground, `across`
// its x span and `along` its z span. One centred box: `y` is the slot's centre.
function flat(x, z, across, along, y = 0) {
  return { x, y, z, w: across, h: along, d: 1, rx: -Math.PI / 2, kind: 0 };
}

function slab(x, y, z, w, h, d) {
  return { x, y, z, w, h, d, kind: 0 };
}

function edgesOf(map, wayId) {
  return map.graph.edges.filter((e) => e.way === wayId);
}

// How far a piece holds back from a node: the meeting way's half-width at an
// internal junction, nothing at the way's own end.
function endTrim(way, node) {
  const along = way.x !== undefined ? node.z : node.x;
  const lo = way.x !== undefined ? way.z0 : way.x0;
  const hi = way.x !== undefined ? way.z1 : way.x1;
  return along === lo || along === hi ? 0 : ROAD_HALF;
}

// A carriageway quad per edge, cut where a junction meets it, plus one square
// per junction: the old full-span merges overlapped in every junction square,
// edge-plus-junction tiles the same tarmac exactly once. Every edge the graph
// holds is drawn, whatever way laid it, so the road a player drags (M5.T3c)
// appears the same frame its version change reaches the pools; a node with two
// edges or more is a junction and trims them back, a dangling end keeps its
// full half-width. An avenue's tarmac is twice a street's (M5.T25), and a
// junction with an avenue in it covers an avenue's mouth. A bridge edge is the
// one exception (M4.T8b): its deck is the carriageway (bridgePieces), so no
// tarmac quad is laid over the deck and a pick at the deck's middle names the
// bridge, not the road. The junction squares still close the street at each
// end of the span.
function carriagewayPieces(map, nodes) {
  const degree = new Map();
  for (const e of map.graph.edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const out = [];
  const junctionIds = new Set();
  // An edge trims back at a junction by its own half-width: its tarmac runs
  // right up to the square laid there, and no further.
  const trim = (id, half) => ((degree.get(id) ?? 0) > 1 ? half : 0);
  for (const e of map.graph.edges) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    const vertical = a.x === b.x;
    const raw = vertical ? b.z - a.z : b.x - a.x;
    const half = halfWidthOf(e);
    const t0 = trim(e.a, half);
    const t1 = trim(e.b, half);
    if (t0 > 0) junctionIds.add(e.a);
    if (t1 > 0) junctionIds.add(e.b);
    if (e.kind === 'bridge') continue;
    const span = Math.abs(raw) - t0 - t1;
    if (span <= 0) continue;
    const mid = (vertical ? a.z + b.z : a.x + b.x) / 2 + (Math.sign(raw) * (t0 - t1)) / 2;
    out.push(vertical ? flat(a.x, mid, half * 2, span) : flat(mid, a.z, span, half * 2));
  }
  for (const id of junctionIds) {
    const j = nodes.get(id);
    const half = widestAt(map, nodes, j.x, j.z);
    out.push(flat(j.x, j.z, half * 2, half * 2));
  }
  return out;
}

// The ways that carry a footway: every avenue, the plaza (narrower) and south.
function footways(map) {
  const { avenues, crossings } = map.district;
  return [
    ...avenues.map((w) => [w, WALKWAY_WIDTH]),
    [crossings[0], PLAZA_WALK_WIDTH],
    [crossings[crossings.length - 1], WALKWAY_WIDTH],
  ];
}

// A walk and a kerb per side of each edge, full length, so adjacent pieces meet
// at the junction centre exactly as the merged way's slabs did. The hand
// preset's promenade pieces and the zebras are block.js's to wire.
function pavingPieces(map, nodes) {
  const walks = [];
  const kerbs = [];
  for (const [way, width] of footways(map)) {
    const off = ROAD_HALF + width / 2;
    const kerb = ROAD_HALF + KERB_WIDTH / 2;
    for (const e of edgesOf(map, way.id)) {
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const vertical = a.x === b.x;
      const len = Math.abs(vertical ? b.z - a.z : b.x - a.x);
      const mid = (vertical ? a.z + b.z : a.x + b.x) / 2;
      for (const side of [-1, 1]) {
        walks.push(vertical
          ? slab(way.x + side * off, 0, mid, width, WALK_RISE, len)
          : slab(mid, 0, way.z + side * off, len, WALK_RISE, width));
        kerbs.push(vertical
          ? slab(way.x + side * kerb, KERB_RISE / 2, mid, KERB_WIDTH, KERB_RISE, len)
          : slab(mid, KERB_RISE / 2, way.z + side * kerb, len, KERB_RISE, KERB_WIDTH));
      }
    }
  }
  return { walks, kerbs };
}

// The `anchor + k*step` positions inside one edge, holding `clear` back from
// the ends: the merged path's phase, so a piece away from a junction does not
// move and a piece inside a junction mouth is dropped.
function rhythmIn(anchor, step, from, to) {
  const out = [];
  for (let v = anchor + step * Math.ceil((from - anchor) / step); v <= to; v += step) out.push(v);
  return out;
}

// A painted quad as a slot, for a caller that places its own markings.
export function markSlot(x, z, across, along) {
  return { ...flat(x, z, across, along, MARK_Y), kind: z < 0 ? 0 : 1 };
}

// Every painted quad carries its half's power zone: two draws, one blackout each.
function mark(out, x, z, across, along) {
  out.push(markSlot(x, z, across, along));
}

// Center dashes down each avenue (10 cm x 3 m on a 6 m pitch) and along the two
// crossings that carry them, edge by edge. A one-way carries arrows down its
// centre instead (arrowPieces), the way a real one-way is painted.
function dashPieces(map, nodes, out) {
  const dash = 3;
  const clear = 0.5 + dash / 2;
  for (const way of map.district.avenues) {
    for (const e of edgesOf(map, way.id)) {
      if (roadTypeOf(e) === 'oneway') continue;
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const from = Math.min(a.z, b.z) + endTrim(way, a) + clear;
      const to = Math.max(a.z, b.z) - endTrim(way, b) - clear;
      for (const z of rhythmIn(way.z0 + 3, 6, from, to)) mark(out, way.x, z, 0.10, dash);
    }
  }
  const { crossings } = map.district;
  for (const [way, inset] of [[crossings[0], 2], [crossings[crossings.length - 1], 3]]) {
    for (const e of edgesOf(map, way.id)) {
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const from = Math.min(a.x, b.x) + endTrim(way, a) + 0.5;
      const to = Math.max(a.x, b.x) - endTrim(way, b) - 0.5;
      for (const x of rhythmIn(way.x0 + inset, 5, from, to)) mark(out, x, way.z, 2, 0.10);
    }
  }
}

// Junction stripes: 35 cm wide on a 70 cm pitch, across each avenue a crossing
// meets, spanning the whole carriageway the widest road there is drawn at. A
// mid-block crossing is block.js's to wire (tests/streetscape-wire).
function zebraPieces(map, nodes, out) {
  const furniture = map.furniture ?? WORLD_FURNITURE;
  const junctions = furniture ? furniture.junctions
    : map.district.avenues.map((a) => ({ x: a.x, z: map.district.crossings[0].z }));
  for (const j of junctions) {
    const span = widestAt(map, nodes, j.x, j.z) * 2 - 1;
    for (let i = -3; i <= 3; i++) mark(out, j.x + i * 0.7, j.z, 0.35, span);
  }
}

// One span as the zone pieces the two marking materials need, cut at z = 0.
function zoneSplit(from, to) {
  if (to <= 0 || from >= 0) return [[(from + to) / 2, to - from]];
  return [[from / 2, -from], [to / 2, to]];
}

// The edge line each side of every avenue, edge by edge, held just clear of
// the junction mouth.
function edgeLines(map, nodes, out) {
  for (const way of map.district.avenues) {
    for (const e of edgesOf(map, way.id)) {
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const from = Math.min(a.z, b.z) + endTrim(way, a) + 0.6;
      const to = Math.max(a.z, b.z) - endTrim(way, b) - 0.6;
      for (const side of [-1, 1]) {
        for (const [zc, len] of zoneSplit(from, to)) mark(out, way.x + side * EDGE_LINE_OUT, zc, 0.10, len);
      }
    }
  }
}

// The dress a road a player dragged (way 'op') carries (M5.T3d): a walk and a
// kerb per side, centre dashes and edge lines, so a new street reads between
// its lots the way a generated avenue does. Every offset stands clear of the
// road's own half-width (M5.T25), so an avenue's walks flank its four lanes
// where a street's flank its two. End lines stop a road's half-width short of
// each end, so paint never runs into a junction. A one-way carries arrows down
// its centre instead of dashes (arrowPieces).
function opDress(map, nodes) {
  const walks = [];
  const kerbs = [];
  const markings = [];
  const dash = 3;
  for (const e of map.graph.edges) {
    if (e.way !== 'op') continue;
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    const vertical = a.x === b.x;
    const len = Math.abs(vertical ? b.z - a.z : b.x - a.x);
    const half = halfWidthOf(e);
    const clear = half + 0.6;
    if (len <= 2 * clear) continue;
    const mid = (vertical ? a.z + b.z : a.x + b.x) / 2;
    const walkOff = half + WALKWAY_WIDTH / 2;
    const kerbOff = half + KERB_WIDTH / 2;
    for (const side of [-1, 1]) {
      walks.push(vertical
        ? slab(a.x + side * walkOff, 0, mid, WALKWAY_WIDTH, WALK_RISE, len)
        : slab(mid, 0, a.z + side * walkOff, len, WALK_RISE, WALKWAY_WIDTH));
      kerbs.push(vertical
        ? slab(a.x + side * kerbOff, KERB_RISE / 2, mid, KERB_WIDTH, KERB_RISE, len)
        : slab(mid, KERB_RISE / 2, a.z + side * kerbOff, len, KERB_RISE, KERB_WIDTH));
    }
    const lo = (vertical ? Math.min(a.z, b.z) : Math.min(a.x, b.x)) + clear;
    const hi = (vertical ? Math.max(a.z, b.z) : Math.max(a.x, b.x)) - clear;
    if (roadTypeOf(e) !== 'oneway') {
      for (const v of rhythmIn(3, 6, lo + dash / 2 + 0.5, hi - dash / 2 - 0.5)) {
        if (vertical) mark(markings, a.x, v, 0.10, dash);
        else mark(markings, v, a.z, dash, 0.10);
      }
    }
    for (const side of [-1, 1]) {
      if (vertical) {
        for (const [zc, span] of zoneSplit(lo, hi)) mark(markings, a.x + side * (half + 0.2), zc, 0.10, span);
      } else {
        mark(markings, (lo + hi) / 2, a.z + side * (half + 0.2), hi - lo, 0.10);
      }
    }
  }
  return { walks, kerbs, markings };
}

// Every painted quad of a one-way (M5.T25, M5-10): an arrow every ARROW_PITCH
// metres, anchored at the edge's middle so a road reads the same whichever end
// a player drags it from and pointing the way the road is driven (a one-way
// runs from its `a` node to its `b`, sim/map.js lanesInDir). An arrow is a
// painted shaft with a two-arm head: three quads, one marking. It rides the
// marking materials so a blackout dims it with the rest of the road's paint.
const ARROW_PITCH = 24;    // metres between arrows along a one-way
const ARROW_LEN = 0.6;     // metres of arrow per metre of the road's half-width
const SHAFT_W = 0.16;      // metres wide a painted line is, as the dashes are
// A painted bar `across` wide and `along` long lying on the ground, turned so
// its length runs `u` (a flat quad's length runs its own +y, and a rz of
// atan2 lays that down along any ground direction).
function bar(x, z, across, along, u) {
  return { ...markSlot(x, z, across, along), rz: Math.atan2(-u.x, -u.z) };
}

function arrowAt(p, u, v, len) {
  const out = [bar(p.x, p.z, SHAFT_W, len * 0.8, u)];
  const tip = { x: p.x + u.x * len * 0.42, z: p.z + u.z * len * 0.42 };
  for (const side of [-1, 1]) {
    const d = { x: u.x * 0.78 + v.x * side * 0.63, z: u.z * 0.78 + v.z * side * 0.63 };
    const n = Math.hypot(d.x, d.z);
    d.x /= n;
    d.z /= n;
    out.push(bar(tip.x - d.x * len * 0.13, tip.z - d.z * len * 0.13, SHAFT_W, len * 0.42, d));
  }
  return out;
}

function arrowPieces(map, nodes) {
  const out = [];
  for (const e of map.graph.edges) {
    if (roadTypeOf(e) !== 'oneway') continue;
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    const vertical = a.x === b.x;
    const span = vertical ? b.z - a.z : b.x - a.x;
    const half = halfWidthOf(e);
    const clear = half + 0.6;
    const lo = (vertical ? Math.min(a.z, b.z) : Math.min(a.x, b.x)) + clear;
    const hi = (vertical ? Math.max(a.z, b.z) : Math.max(a.x, b.x)) - clear;
    if (lo >= hi) continue;
    const mid = (vertical ? a.z + b.z : a.x + b.x) / 2;
    const line = vertical ? a.x : a.z;
    const u = vertical ? { x: 0, z: Math.sign(span) } : { x: Math.sign(span), z: 0 };
    const v = { x: u.z, z: -u.x };
    const len = half * ARROW_LEN;
    const at = (k) => (vertical ? { x: line, z: k } : { x: k, z: line });
    for (let k = mid; k >= lo; k -= ARROW_PITCH) out.push(...arrowAt(at(k), u, v, len));
    for (let k = mid + ARROW_PITCH; k <= hi; k += ARROW_PITCH) out.push(...arrowAt(at(k), u, v, len));
  }
  return out;
}

// A one-way's arrows, pooled (M5.T25): one InstancedMesh per power zone, so
// each zone's paint dims with that zone's blackout, and sized at boot like the
// manholes' own pool — a map with no one-way has no arrow to size from, and a
// pool built empty could never draw one. `update` rewrites the instances the
// map now carries.
const ARROW_GEO = new THREE.PlaneGeometry(1, 1);

function buildArrowPool(materials, slots) {
  const counts = [0, 0];
  for (const s of slots) counts[s.kind] += 1;
  const meshes = [0, 1].map((kind) => {
    const mesh = new THREE.InstancedMesh(ARROW_GEO, materials[kind], Math.max(1, counts[kind]) + ARROW_SLACK);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = 'arrows';
    return mesh;
  });
  const at = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const size = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const update = (list = slots) => {
    const used = [0, 0];
    for (const s of list) {
      const mesh = meshes[s.kind];
      const i = used[s.kind]++;
      if (!mesh || i >= mesh.instanceMatrix.count) continue;
      at.set(s.x, s.y ?? 0, s.z);
      size.set(s.w, s.h, s.d ?? 1);
      quat.setFromEuler(euler.set(s.rx ?? 0, s.ry ?? 0, s.rz ?? 0));
      mesh.setMatrixAt(i, m.compose(at, quat, size));
    }
    for (const [kind, mesh] of meshes.entries()) {
      mesh.count = used[kind];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };
  update();
  const group = new THREE.Group();
  for (const mesh of meshes) group.add(mesh);
  return { group, meshes, update };
}

// Every road piece of a map, before a pool exists, keyed to the edge or
// junction it belongs to. `extras` are the pieces block.js wires for the map
// (the hand preset's promenade, the mid-block zebras). Pure, so a test can
// count pieces without a texture loader.
export function roadPieces(map = worldMap(), extras = {}) {
  const nodes = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const paving = pavingPieces(map, nodes);
  const op = opDress(map, nodes);
  const markings = [];
  dashPieces(map, nodes, markings);
  zebraPieces(map, nodes, markings);
  edgeLines(map, nodes, markings);
  const manholes = [];
  for (const way of map.district.avenues) {
    for (const z of rhythm(way.x, -48, 48, 24, map)) {
      manholes.push({ x: way.x + (z % 48 === 0 ? -1.8 : 1.8), y: 0.022, z });
    }
  }
  return {
    carriageway: carriagewayPieces(map, nodes),
    walks: [...paving.walks, ...op.walks, ...(extras.walks ?? [])],
    kerbs: [...paving.kerbs, ...op.kerbs, ...(extras.kerbs ?? [])],
    markings: [...markings, ...op.markings, ...(extras.markings ?? [])],
    arrows: arrowPieces(map, nodes),
    manholes,
    bridges: bridgePieces(map),
  };
}

// One InstancedMesh of the same circle keeps the manholes at one draw.
function buildCirclePool(material, slots, slack) {
  const geo = new THREE.CircleGeometry(MANHOLE_R, 14);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, slots.length) + slack);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const at = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const m = new THREE.Matrix4();
  const update = (list = slots) => {
    mesh.count = Math.min(list.length, mesh.instanceMatrix.count);
    for (let i = 0; i < mesh.count; i++) {
      mesh.setMatrixAt(i, m.compose(at.set(list[i].x, list[i].y, list[i].z), quat, scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  update();
  return { mesh, update, draws: () => (mesh.count > 0 ? 1 : 0) };
}

// The deck and railing of every bridge edge (M4.T8). Since M4.T8b the deck's
// top is the bridge's carriageway — carriagewayPieces leaves bridge edges out —
// so the dark asphalt stops at each bank and the concrete deck spans the water
// 1 cm under street level, the paint still drawn above it. The railings run
// post-and-rail along both edges for the whole span, which is the part of a
// flat city's bridge a player actually reads. Slots, so a road op that adds or
// removes a crossing rewrites them with the rest of the road (M3.T27).
const DECK_TOP = -0.01;
const DECK_BOTTOM = -0.75;
const RAIL_INSET = 0.2; // the railing stands this far inside the deck edge
const RAIL_STEP = 2;
const POST_W = 0.09;
const POST_H = 1.0;
const TOP_RAIL_Y = 0.95;
const MID_RAIL_Y = 0.55;
const RAIL_T = 0.07;
const END_OVER = 0.4; // tucked under the road at each end of the edge

// One side's worth of railing along `len` centred on `at`: posts on a fixed
// step with one at each end, two rails spanning it. A rail is a long thin box,
// so a post and a rail are the same pool.
function railSlots(at, len, vertical) {
  const out = [];
  const count = Math.max(2, Math.ceil(len / RAIL_STEP) + 1);
  const step = len / (count - 1);
  for (let i = 0; i < count; i++) {
    const t = -len / 2 + i * step;
    out.push(vertical
      ? { kind: 0, x: at.x, y: POST_H / 2, z: at.z + t, w: POST_W, h: POST_H, d: POST_W }
      : { kind: 0, x: at.x + t, y: POST_H / 2, z: at.z, w: POST_W, h: POST_H, d: POST_W });
  }
  for (const y of [TOP_RAIL_Y, MID_RAIL_Y]) {
    out.push(vertical
      ? { kind: 0, x: at.x, y, z: at.z, w: RAIL_T, h: RAIL_T, d: len }
      : { kind: 0, x: at.x, y, z: at.z, w: len, h: RAIL_T, d: RAIL_T });
  }
  return out;
}

// Every bridge edge's deck and railings. The bank runs in render/river.js share
// `bridgeHalf`, so the deck's edge and the gap cut for it cannot drift apart.
export function bridgePieces(map) {
  const nodes = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const decks = [];
  const rails = [];
  for (const e of map.graph.edges) {
    if (e.kind !== 'bridge') continue;
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    const vertical = a.x === b.x;
    const lo = (vertical ? Math.min(a.z, b.z) : Math.min(a.x, b.x)) - END_OVER;
    const hi = (vertical ? Math.max(a.z, b.z) : Math.max(a.x, b.x)) + END_OVER;
    const mid = (lo + hi) / 2;
    const len = hi - lo;
    const line = vertical ? a.x : a.z;
    const width = bridgeHalf(map, e) * 2;
    const deck = { kind: 0, y: (DECK_TOP + DECK_BOTTOM) / 2, h: DECK_TOP - DECK_BOTTOM };
    decks.push(vertical
      ? { ...deck, x: line, z: mid, w: width, d: len }
      : { ...deck, x: mid, z: line, w: len, d: width });
    for (const side of [-1, 1]) {
      const off = line + side * (width / 2 - RAIL_INSET);
      rails.push(...railSlots(vertical ? { x: off, z: mid } : { x: mid, z: off }, len, vertical));
    }
  }
  return { decks, rails };
}

// One fixed InstancedMesh per material whatever the map does; `update(map)`
// rewrites every slot — a version change is matrix writes (M3.T27). `extrasOf`
// lets the caller wire the pieces only it knows how to place.
export function buildRoads(texLoader, maxAniso, map = worldMap(), extrasOf = () => ({})) {
  const pieces = roadPieces(map, extrasOf(map));
  const group = new THREE.Group();
  const asphalt = loadPBRMaps(texLoader, maxAniso, 'asphalt', 'albedo', 2, 30);
  const roadMat = standardFromMaps(asphalt, { roughness: 0.38, envMapIntensity: 1.4, color: 0x7e838d });
  const paving = loadPBRMaps(texLoader, maxAniso, 'paving_slabs', 'albedo', 1.5, 60);
  const walkMat = standardFromMaps(paving, { roughness: 0.6, envMapIntensity: 0.7, color: 0x9aa0ab });
  const concrete = loadPBRMaps(texLoader, maxAniso, 'concrete', 'albedo', 1, 40);
  const curbMat = standardFromMaps(concrete, { roughness: 0.75, envMapIntensity: 0.4, color: 0x7d828c });
  const markingMats = [0, 1].map(() => new THREE.MeshStandardMaterial({
    color: 0xb8bcc2, emissive: 0x6a7078, emissiveIntensity: 0.015, roughness: 0.6,
  }));
  const road = buildInstancePools([roadMat], pieces.carriageway, {
    shape: 'plane', castShadow: false, receiveShadow: true, slack: ROAD_SLACK,
  });
  const walks = buildInstancePools([walkMat], pieces.walks, {
    shape: 'box', castShadow: false, receiveShadow: true, slack: ROAD_SLACK,
  });
  const kerbs = buildInstancePools([curbMat], pieces.kerbs, {
    shape: 'box', castShadow: false, receiveShadow: true, slack: ROAD_SLACK,
  });
  // The paint is unlit by the shadow pass, exactly as the merged quads were.
  const markings = buildInstancePools(markingMats, pieces.markings, {
    shape: 'plane', castShadow: false, receiveShadow: false, slack: ROAD_SLACK,
  });
  // A one-way's arrows (M5.T25): painted on the marking materials, so a
  // blackout dims them with the rest of the road's paint, but in a pool of
  // their own — one draw while a one-way is drawn at all, and none while the
  // map holds no one-way, which every generated map does not.
  const arrows = buildArrowPool(markingMats, pieces.arrows);
  group.add(arrows.group);
  const manholes = buildCirclePool(
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.7, metalness: 0.4 }),
    pieces.manholes, ROAD_SLACK,
  );
  // Every piece a road is drawn from answers to the name 'road', so a pick
  // (game/probe.js) can say what the tarmac under a point is (M5.T3d).
  for (const pool of [road, walks, kerbs, markings]) {
    for (const mesh of pool.meshes) mesh.name = 'road';
    group.add(pool.group);
  }
  // The arrows answer to their own name: a pick at a one-way's middle names
  // the arrow it is drawn with.
  group.add(arrows.group);
  manholes.mesh.name = 'road';
  group.add(manholes.mesh);
  // Bridge decks and railings ride their own pools (M4.T8): one draw each
  // whatever the map does, rewritten by the same update a road op triggers.
  // Both answer to the name 'bridge' (M4.T8b), so a pick on the deck — the
  // bridge's carriageway — or its railing names the crossing. The concrete and
  // steel are light enough to read against the blue-green water from above.
  const deck = buildInstancePools(
    [new THREE.MeshStandardMaterial({ color: 0x6d737c, roughness: 0.85, metalness: 0.05 })],
    pieces.bridges.decks, { shape: 'box', castShadow: false, receiveShadow: true, slack: BRIDGE_SLACK },
  );
  const rails = buildInstancePools(
    [new THREE.MeshStandardMaterial({ color: 0x8a919a, roughness: 0.42, metalness: 0.55 })],
    pieces.bridges.rails, { shape: 'box', castShadow: true, receiveShadow: false, slack: BRIDGE_SLACK },
  );
  for (const mesh of [...deck.meshes, ...rails.meshes]) mesh.name = 'bridge';
  // The river the graph crosses (M4.T8): water and its banks; the decks and
  // railings above are road furniture and ride the road pools.
  const river = buildRiver(texLoader, maxAniso, map);
  group.add(deck.group);
  group.add(rails.group);
  group.add(river.group);

  const update = (next = worldMap()) => {
    const p = roadPieces(next, extrasOf(next));
    road.update(p.carriageway);
    walks.update(p.walks);
    kerbs.update(p.kerbs);
    markings.update(p.markings);
    arrows.update(p.arrows);
    manholes.update(p.manholes);
    deck.update(p.bridges.decks);
    rails.update(p.bridges.rails);
    river.update(next);
    refreshBuildGround(next);
  };
  return {
    group,
    mats: { road: roadMat, walk: walkMat, curb: curbMat },
    markings: markingMats,
    pools: { road, walks, kerbs, markings, arrows, manholes, deck, rails },
    river,
    update,
  };
}
