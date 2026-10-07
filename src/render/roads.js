// Road pieces pooled (M3.T26, M3-5). Carriageway, walks, kerbs and markings
// were merged geometry in render/block.js; now each is a slot in a fixed-size
// InstancedMesh, one pool per material, keyed to the graph's edges and
// junctions (sim/map.js): an edit rewrites its own slots (M3.T27).
import * as THREE from 'three';
import { ROAD_HALF_WIDTH as ROAD_HALF, WALKWAY_WIDTH } from '../sim/world.js';
import { WORLD_FURNITURE, rhythm } from '../sim/furniture.js';
import { worldMap } from '../sim/patrol.js';
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
// full half-width.
function carriagewayPieces(map, nodes) {
  const degree = new Map();
  for (const e of map.graph.edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const out = [];
  const junctionIds = new Set();
  const trim = (id) => ((degree.get(id) ?? 0) > 1 ? ROAD_HALF : 0);
  for (const e of map.graph.edges) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    const vertical = a.x === b.x;
    const raw = vertical ? b.z - a.z : b.x - a.x;
    const t0 = trim(e.a);
    const t1 = trim(e.b);
    if (t0 > 0) junctionIds.add(e.a);
    if (t1 > 0) junctionIds.add(e.b);
    const span = Math.abs(raw) - t0 - t1;
    if (span <= 0) continue;
    const mid = (vertical ? a.z + b.z : a.x + b.x) / 2 + (Math.sign(raw) * (t0 - t1)) / 2;
    out.push(vertical ? flat(a.x, mid, ROAD_HALF * 2, span) : flat(mid, a.z, span, ROAD_HALF * 2));
  }
  for (const id of junctionIds) {
    const j = nodes.get(id);
    out.push(flat(j.x, j.z, ROAD_HALF * 2, ROAD_HALF * 2));
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
// crossings that carry them, edge by edge.
function dashPieces(map, nodes, out) {
  const dash = 3;
  const clear = 0.5 + dash / 2;
  for (const way of map.district.avenues) {
    for (const e of edgesOf(map, way.id)) {
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
// meets. A mid-block crossing is block.js's to wire (tests/streetscape-wire).
function zebraPieces(map, out) {
  const furniture = map.furniture ?? WORLD_FURNITURE;
  const junctions = furniture ? furniture.junctions
    : map.district.avenues.map((a) => ({ x: a.x, z: map.district.crossings[0].z }));
  for (const j of junctions) {
    for (let i = -3; i <= 3; i++) mark(out, j.x + i * 0.7, j.z, 0.35, ROAD_HALF * 2 - 1);
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

// Every road piece of a map, before a pool exists, keyed to the edge or
// junction it belongs to. `extras` are the pieces block.js wires for the map
// (the hand preset's promenade, the mid-block zebras). Pure, so a test can
// count pieces without a texture loader.
export function roadPieces(map = worldMap(), extras = {}) {
  const nodes = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const paving = pavingPieces(map, nodes);
  const markings = [];
  dashPieces(map, nodes, markings);
  zebraPieces(map, markings);
  edgeLines(map, nodes, markings);
  const manholes = [];
  for (const way of map.district.avenues) {
    for (const z of rhythm(way.x, -48, 48, 24, map)) {
      manholes.push({ x: way.x + (z % 48 === 0 ? -1.8 : 1.8), y: 0.022, z });
    }
  }
  return {
    carriageway: carriagewayPieces(map, nodes),
    walks: [...paving.walks, ...(extras.walks ?? [])],
    kerbs: [...paving.kerbs, ...(extras.kerbs ?? [])],
    markings: [...markings, ...(extras.markings ?? [])],
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

// The deck and railing of every bridge edge (M4.T8). The deck is a slab under
// the carriageway whose top stays 1 cm under the tarmac, so the road plane and
// its paint are never covered; the railings run post-and-rail along both edges
// for the whole span, which is the part of a flat city's bridge a player
// actually reads. Slots, so a road op that adds or removes a crossing rewrites
// them with the rest of the road (M3.T27).
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
  const manholes = buildCirclePool(
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.7, metalness: 0.4 }),
    pieces.manholes, ROAD_SLACK,
  );
  for (const pool of [road, walks, kerbs, markings]) group.add(pool.group);
  group.add(manholes.mesh);
  // Bridge decks and railings ride their own pools (M4.T8): one draw each
  // whatever the map does, rewritten by the same update a road op triggers.
  const deck = buildInstancePools(
    [new THREE.MeshStandardMaterial({ color: 0x4b5158, roughness: 0.85, metalness: 0.05 })],
    pieces.bridges.decks, { shape: 'box', castShadow: false, receiveShadow: true, slack: BRIDGE_SLACK },
  );
  const rails = buildInstancePools(
    [new THREE.MeshStandardMaterial({ color: 0x2f343a, roughness: 0.5, metalness: 0.6 })],
    pieces.bridges.rails, { shape: 'box', castShadow: true, receiveShadow: false, slack: BRIDGE_SLACK },
  );
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
    pools: { road, walks, kerbs, markings, manholes, deck, rails },
    river,
    update,
  };
}
