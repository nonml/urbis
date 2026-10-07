// Where the street furniture stands on a generated world: lamps, parked cars,
// utility boxes, the zebra crossings, and the rhythm every kerbside fitting
// follows, all derived from the district's roads (docs/PROCGEN.md), so nothing
// stands in a crossing or hangs off an avenue the world does not have. On the
// hand preset the render keeps its own tables and WORLD_FURNITURE is null.
// Pure (law 5): render/lamps.js, render/block.js and sim/street.js read it.
//
// Milestone 2 skeleton: the constants are final, the bodies are stubs that each
// have a test in tests/furniture-*.todo.js.
import { DISTRICTS, ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';
import { worldSeed } from './seedstore.js';
import { mulberry32 } from './rng.js';
import { CAM_ROOM, spawnFor } from './spawn.js';
import { worldMap } from './patrol.js';

// Its own random stream, so furniture never moves a lot, a vista or a person.
export const FURN_SALT = 0xf00d;
// Kerbside furniture on one road keeps this far from the centre-line of a road
// it meets: that road's carriageway, a walkway and a step more.
export const FURN_CLEAR = 1.5;
export const BAND = ROAD_HALF_WIDTH + WALKWAY_WIDTH + FURN_CLEAR;
// And stops this far short of its own road's ends.
export const END_CLEAR = 4;

// Lamps: the hand map's rhythm, a pole every LAMP_STEP metres on alternate
// sides, the pole POLE_X off an avenue's centre-line with its head ARM back
// over the road; a crossing's narrower footway puts its poles CROSS_POLE_OUT
// off the centre-line and their heads CROSS_HEAD_OUT.
export const LAMP_STEP = 18;
export const LAMP_PHASE = 9;
export const POLE_X = 5.4;
export const ARM = 1.8;
export const CROSS_POLE_OUT = 4.2;
export const CROSS_HEAD_OUT = 2.4;

// Parked cars: a kerb slot every PARK_STEP metres down each side of every
// avenue, and PARK_SHARE of them hold a car.
export const PARK_STEP = 12;
export const PARK_PHASE = 6;
export const PARK_SHARE = 0.3;

// Utility boxes out against the building line, every BOX_STEP on alternate sides.
export const BOX_STEP = 40;
export const BOX_PHASE = 20;
export const BOX_OUT = ROAD_HALF_WIDTH + 2.7;

// The z's down avenue `av` on the rhythm phase + k * step (k any integer), from
// av.z0 + END_CLEAR to av.z1 - END_CLEAR inclusive, leaving out every z closer
// than BAND to a crossing that meets the avenue (c.x0 <= av.x <= c.x1).
// Ascending.
export function avenueSpots(av, crossings, phase, step) {
  const near = crossings.filter((c) => c.x0 <= av.x && av.x <= c.x1);
  const out = [];
  for (let k = Math.ceil((av.z0 + END_CLEAR - phase) / step); phase + k * step <= av.z1 - END_CLEAR; k++) {
    const z = phase + k * step;
    if (near.every((c) => Math.abs(z - c.z) >= BAND)) out.push(z);
  }
  return out;
}

// The x's along crossing `c` on the rhythm phase + k * step, from c.x0 +
// END_CLEAR to c.x1 - END_CLEAR inclusive, leaving out every x closer than BAND
// to any avenue's centre-line. Ascending.
export function crossingSpots(c, avenues, phase, step) {
  const out = [];
  for (let k = Math.ceil((c.x0 + END_CLEAR - phase) / step); phase + k * step <= c.x1 - END_CLEAR; k++) {
    const x = phase + k * step;
    if (avenues.every((a) => Math.abs(x - a.x) >= BAND)) out.push(x);
  }
  return out;
}

// A kerbside rhythm for the avenue at x = ax, as the render's loops write it:
// `from` to `to` inclusive, every `step`. On the hand preset exactly that range;
// on a generated world the same rhythm down that avenue's whole length, off its
// crossings: avenueSpots(the avenue at ax, the map's crossings, from, step).
export function rhythm(ax, from, to, step, map = worldMap()) {
  if (!map.furniture) {
    const out = [];
    for (let z = from; z <= to; z += step) out.push(z);
    return out;
  }
  const avenue = map.district.avenues.find((a) => a.x === ax);
  return avenueSpots(avenue, map.district.crossings, from, step);
}

// Street lamps { x, z, hx, hz, rotY, zone }, the shape render/lamps.js draws.
// Every avenue in order, at avenueSpots(a, crossings, LAMP_PHASE, LAMP_STEP),
// alternating sides from the west (side -1 first): pole at a.x + side * POLE_X,
// head at a.x + side * (POLE_X - ARM) and the same z, rotY 0 for side 1 and
// Math.PI for side -1. Then every crossing in order, at crossingSpots(c,
// avenues, LAMP_PHASE, LAMP_STEP), alternating from the south (side -1 first):
// pole at z = c.z + side * CROSS_POLE_OUT, head at hx = x, hz = c.z + side *
// CROSS_HEAD_OUT, rotY -Math.PI / 2 for side 1 and Math.PI / 2 for side -1.
// zone is 0 for a pole at z < 0 and 1 otherwise (the blackout's two halves).
export function lampsFor(district) {
  const sideOf = (i) => (i % 2 === 0 ? -1 : 1);
  const lamps = [];
  for (const a of district.avenues) {
    avenueSpots(a, district.crossings, LAMP_PHASE, LAMP_STEP).forEach((z, i) => {
      const side = sideOf(i);
      lamps.push({
        x: a.x + side * POLE_X, z,
        hx: a.x + side * (POLE_X - ARM), hz: z,
        rotY: side > 0 ? 0 : Math.PI, zone: z < 0 ? 0 : 1,
      });
    });
  }
  for (const c of district.crossings) {
    crossingSpots(c, district.avenues, LAMP_PHASE, LAMP_STEP).forEach((x, i) => {
      const side = sideOf(i);
      const z = c.z + side * CROSS_POLE_OUT;
      lamps.push({
        x, z, hx: x, hz: c.z + side * CROSS_HEAD_OUT,
        rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2, zone: z < 0 ? 0 : 1,
      });
    });
  }
  return lamps;
}

// Parked cars [avenueX, side, z], the shape sim/street.js parks. Every avenue in
// order, its west side (-1) then its east (1), at avenueSpots(a, crossings,
// PARK_PHASE, PARK_STEP): one draw of mulberry32((seed ^ FURN_SALT) >>> 0) per
// spot in that order, and the spot holds a car when the draw is < PARK_SHARE.
// The spawn kerb stays empty from the hero car back to CAM_ROOM behind the
// player, where the follow cam stands; the draw is still taken, so every other
// car parks where it always has.
export function parkedFor(district, seed) {
  const rand = mulberry32((seed ^ FURN_SALT) >>> 0);
  const parked = [];
  for (const a of district.avenues) {
    for (const side of [-1, 1]) {
      for (const z of avenueSpots(a, district.crossings, PARK_PHASE, PARK_STEP)) {
        if (rand() < PARK_SHARE && !behindSpawn(district, a, side, z)) parked.push([a.x, side, z]);
      }
    }
  }
  return parked;
}

function behindSpawn(district, a, side, z) {
  const { player, car } = spawnFor(district);
  return a === district.avenues[0] && side === 1 && car.z < z && z <= player.z + CAM_ROOM;
}

// Utility boxes [x, z]. Every avenue in order, at avenueSpots(a, crossings,
// BOX_PHASE, BOX_STEP), alternating sides from the west: x = a.x + side * BOX_OUT.
export function boxesFor(district) {
  return district.avenues.flatMap((a) => avenueSpots(a, district.crossings, BOX_PHASE, BOX_STEP)
    .map((z, i) => [a.x + (i % 2 === 0 ? -1 : 1) * BOX_OUT, z]));
}

// Where a crossing meets an avenue { x, z }: zebra stripes and drain grates go
// here. Every crossing in order, and for each every avenue it meets (c.x0 <=
// a.x <= c.x1) in order: { x: a.x, z: c.z }.
export function junctionsOf(district) {
  return district.crossings.flatMap((c) => district.avenues
    .filter((a) => c.x0 <= a.x && a.x <= c.x1)
    .map((a) => ({ x: a.x, z: c.z })));
}

// ---------------------------------------------------------------------------
// The roads the player lays (M5.T4). Every edge an op adds is `way: 'op'`; a
// new road is a street, so the same rhythm runs along it and the same kerbside
// fittings stand on it. Only those edges are read here, so the district's own
// plan above never moves, and a road taken out takes its fittings with it.
const ROAD_WAY = 'op';
const SAME = 1e-6;

// Every edge a player laid, as { axis, at, from, to, ends }: `at` is the fixed
// centre-line coordinate, `from..to` the span along the varying axis, ascending.
function opPieces(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const pieces = [];
  for (const e of graph.edges) {
    if (e.way !== ROAD_WAY) continue;
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    if (!a || !b) continue;
    if (Math.abs(a.x - b.x) < SAME && Math.abs(a.z - b.z) < SAME) continue;
    const axis = e.axis === 'x' ? 'x' : 'z';
    pieces.push(axis === 'x'
      ? { axis, at: a.z, from: Math.min(a.x, b.x), to: Math.max(a.x, b.x), ends: [a, b] }
      : { axis, at: a.x, from: Math.min(a.z, b.z), to: Math.max(a.z, b.z), ends: [a, b] });
  }
  return pieces;
}

// The graph's junctions: nodes where roads of both axes meet. The generated
// plan names its own as crossing x avenue (junctionsOf); this is the graph's
// answer, and the one a player's road is judged by.
function junctionNodes(graph) {
  const axes = new Map();
  for (const e of graph.edges) {
    for (const id of [e.a, e.b]) {
      let set = axes.get(id);
      if (!set) axes.set(id, (set = new Set()));
      set.add(e.axis);
    }
  }
  return graph.nodes.filter((n) => (axes.get(n.id)?.size ?? 0) >= 2);
}

// The along-coordinates of the junctions a piece meets: its own ends, since
// ops.js cuts every road it crosses at the junction, so a piece never carries
// a junction inside it.
function pieceBlocks(piece, junctionIds) {
  return piece.ends.filter((end) => junctionIds.has(end.id))
    .map((end) => (piece.axis === 'x' ? end.x : end.z));
}

// The spots a piece carries on `phase + k * step`, END_CLEAR off its own ends
// and BAND clear of every junction it meets: the rhythm avenueSpots walks.
function pieceSpots(piece, phase, step, blocks) {
  const out = [];
  for (let k = Math.ceil((piece.from + END_CLEAR - phase) / step);
    phase + k * step <= piece.to - END_CLEAR; k++) {
    const v = phase + k * step;
    if (blocks.every((b) => Math.abs(v - b) >= BAND)) out.push(v);
  }
  return out;
}

// Street lamps along the roads the player laid, the shape lampsFor names: the
// avenue rhythm (POLE_X, ARM, LAMP_PHASE/STEP), alternating sides from the
// west/south, zone is the pole's own z (the blackout's two halves).
function roadLamps(graph) {
  const junctionIds = new Set(junctionNodes(graph).map((n) => n.id));
  const lamps = [];
  const add = (piece, v, side) => {
    if (piece.axis === 'x') {
      const z = piece.at + side * POLE_X;
      lamps.push({
        x: v, z, hx: v, hz: piece.at + side * (POLE_X - ARM),
        rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2, zone: z < 0 ? 0 : 1,
      });
      return;
    }
    lamps.push({
      x: piece.at + side * POLE_X, z: v,
      hx: piece.at + side * (POLE_X - ARM), hz: v,
      rotY: side > 0 ? 0 : Math.PI, zone: v < 0 ? 0 : 1,
    });
  };
  for (const piece of opPieces(graph)) {
    pieceSpots(piece, LAMP_PHASE, LAMP_STEP, pieceBlocks(piece, junctionIds))
      .forEach((v, i) => add(piece, v, i % 2 === 0 ? -1 : 1));
  }
  return lamps;
}

// Utility boxes along a player's road, the shape boxesFor names: every
// BOX_STEP on alternate sides, out against the building line.
function roadBoxes(graph) {
  const junctionIds = new Set(junctionNodes(graph).map((n) => n.id));
  const boxes = [];
  for (const piece of opPieces(graph)) {
    pieceSpots(piece, BOX_PHASE, BOX_STEP, pieceBlocks(piece, junctionIds))
      .forEach((v, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        boxes.push(piece.axis === 'x'
          ? [v, piece.at + side * BOX_OUT]
          : [piece.at + side * BOX_OUT, v]);
      });
  }
  return boxes;
}

// A junction is a zebra: every node a player's road touches and joins a road
// of the other axis, which is every crossing of the drag and every street it
// lands on. A coordinate the district's own plan already names is kept once.
function roadJunctions(graph, district) {
  const touched = new Set();
  for (const e of graph.edges) {
    if (e.way !== ROAD_WAY) continue;
    touched.add(e.a);
    touched.add(e.b);
  }
  const seen = new Set(junctionsOf(district).map((j) => `${j.x},${j.z}`));
  const out = [];
  for (const n of junctionNodes(graph)) {
    if (!touched.has(n.id)) continue;
    const key = `${n.x},${n.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x: n.x, z: n.z });
  }
  return out;
}

// The furniture plan of a map. A road op passes the graph it leaves (M5.T4),
// so the player's streets carry the district's own rhythms; the load-time map
// passes none and gets the district plan alone.
export function planFurniture(district, seed, graph = null) {
  return {
    lamps: graph ? [...lampsFor(district), ...roadLamps(graph)] : lampsFor(district),
    parked: parkedFor(district, seed),
    boxes: graph ? [...boxesFor(district), ...roadBoxes(graph)] : boxesFor(district),
    junctions: graph ? [...junctionsOf(district), ...roadJunctions(graph, district)] : junctionsOf(district),
  };
}

// The furniture of the world being played: null on the hand preset.
export const WORLD_FURNITURE = worldSeed().generate ? planFurniture(DISTRICTS[0], worldSeed().seed) : null;
