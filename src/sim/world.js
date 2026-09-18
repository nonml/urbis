// The city's one description of itself: the road graph, the district bounds and
// the lookups derived from them. Pure data and pure maths — no three, no DOM
// (law 5). A new district is an entry in DISTRICTS, not a new file.
//
// Before this existed the avenue positions lived in five files and the bounds
// box in four, and the four had already drifted apart. Everything that needs to
// know where the city is reads it from here.
//
// It also owns the heightfield — see "The ground gets a Y" at the foot of the
// file. Anything that sits on the ground asks heightAt() instead of assuming 0.
import { mulberry32 } from './rng.js';

// Carriageway geometry. ROAD_HALF in render/block.js is the same 3.5; lanes sit
// 2 m off the centre-line because that is where traffic has always been drawn.
export const ROAD_HALF_WIDTH = 3.5;
export const LANE_OFFSET = 2;

// Every node is on a carriageway and heightAt() is exactly zero on every
// carriageway — the road footprints are the flat rects the field is built
// around. A node off the tarmac (a ramp, a bridge deck) will have to sample it.
const GROUND_Y = 0;

// Avenues run N-S along z, crossings run E-W along x. Each is declared as a
// span; the graph is derived by cutting every span where the other axis meets
// it, so an intersection is never written down twice.
const DOWNTOWN = {
  id: 'downtown',
  avenues: [
    { id: 'main', x: 0, z0: -100, z1: 100, lanes: 2 },
    { id: 'east', x: 44, z0: -100, z1: 100, lanes: 2 },
    { id: 'west', x: -44, z0: -100, z1: 100, lanes: 2 },
  ],
  crossings: [
    { id: 'plaza', z: 40, x0: -52, x1: 52, lanes: 2 },
    { id: 'south', z: -64, x0: -7, x1: 51, lanes: 2 },
  ],
  // Where a person may go: the whole district floor. West edge is the river
  // verge, east edge is the far side of the pocket park and the two infill
  // towers flanking it (the pocket park slab in render/landscape.js, block.js:265).
  walk: { minX: -52, maxX: 70, minZ: -68, maxZ: 100 },
  // Where a car may go. Narrower on the east because the tarmac ends there —
  // the plaza crossing is 104 m of road centred on x = 0, so the network itself
  // stops at x = 52 and past it is park, not street.
  drive: { minX: -52, maxX: 52, minZ: -68, maxZ: 100 },
};

export const DISTRICTS = [DOWNTOWN];

function spans(lo, hi, v) {
  return v >= lo && v <= hi;
}

// A span plus every crossing value strictly inside it, in order.
function cutPoints(from, to, crossings) {
  const inside = crossings.filter((v) => v > from && v < to).sort((p, q) => p - q);
  return [from, ...inside, to];
}

function ensureNode(nodes, x, z) {
  const id = `${x},${z}`;
  if (!nodes.has(id)) nodes.set(id, { id, x, z, y: GROUND_Y });
  return nodes.get(id);
}

// kind names what the edge is for. 'avenue' and 'connector' are all the city has
// today; 'bridge', 'tunnel' and 'ramp' join them when a road leaves the flat.
function addChain(nodes, edges, district, way, kind, axis, points) {
  let prev = ensureNode(nodes, points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const next = ensureNode(nodes, points[i][0], points[i][1]);
    edges.push({
      id: `${district.id}.${way.id}.${i - 1}`,
      a: prev.id,
      b: next.id,
      lanes: way.lanes,
      kind,
      axis,
      district: district.id,
      way: way.id,
    });
    prev = next;
  }
}

function addDistrict(district, nodes, edges) {
  for (const av of district.avenues) {
    const met = district.crossings.filter((c) => spans(c.x0, c.x1, av.x)).map((c) => c.z);
    const zs = cutPoints(av.z0, av.z1, met);
    addChain(nodes, edges, district, av, 'avenue', 'z', zs.map((z) => [av.x, z]));
  }
  for (const cr of district.crossings) {
    const met = district.avenues.filter((a) => spans(a.z0, a.z1, cr.z)).map((a) => a.x);
    const xs = cutPoints(cr.x0, cr.x1, met);
    addChain(nodes, edges, district, cr, 'connector', 'x', xs.map((x) => [x, cr.z]));
  }
}

const NODE_BY_ID = new Map();
export const EDGES = [];
for (const district of DISTRICTS) addDistrict(district, NODE_BY_ID, EDGES);
export const NODES = [...NODE_BY_ID.values()];

export function node(id) {
  return NODE_BY_ID.get(id) ?? null;
}

function unionBox(boxes) {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minZ: Math.min(...boxes.map((b) => b.minZ)),
    maxZ: Math.max(...boxes.map((b) => b.maxZ)),
  };
}

// The two playable boxes, and the only ones. They differ on purpose: a person
// can cross the east park, a car has no road to get there on. When a second
// district lands these stop being one box each and become per-district
// containment — a union box would let you walk through the gap between them.
export const WALK_BOUNDS = unionBox(DISTRICTS.map((d) => d.walk));
export const DRIVE_BOUNDS = unionBox(DISTRICTS.map((d) => d.drive));

// How far the road network itself reaches. Wider in z than the playable box —
// the avenues run on past the bounds so the vista closes on towers, not void.
export const GRAPH_EXTENT = {
  minX: Math.min(...NODES.map((n) => n.x)),
  maxX: Math.max(...NODES.map((n) => n.x)),
  minZ: Math.min(...NODES.map((n) => n.z)),
  maxZ: Math.max(...NODES.map((n) => n.z)),
};

// Slide a point back inside a box. `hit` is what a car needs: it kills its speed
// against a wall rather than grinding along it.
export function clampToBounds(bounds, x, z) {
  const cx = Math.max(bounds.minX, Math.min(bounds.maxX, x));
  const cz = Math.max(bounds.minZ, Math.min(bounds.maxZ, z));
  return { x: cx, z: cz, hit: cx !== x || cz !== z };
}

function projectOnSegment(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const raw = len2 === 0 ? 0 : ((x - a.x) * dx + (z - a.z) * dz) / len2;
  const t = Math.max(0, Math.min(1, raw));
  const px = a.x + dx * t;
  const pz = a.z + dz * t;
  return { t, x: px, z: pz, dist: Math.hypot(x - px, z - pz) };
}

// The stretch of road a point is standing on, the closest point on its
// centre-line, how far along that is (t, 0..1) and the distance to it.
export function nearestEdge(x, z) {
  let best = null;
  for (const edge of EDGES) {
    const hit = projectOnSegment(x, z, node(edge.a), node(edge.b));
    if (!best || hit.dist < best.dist) best = { edge, ...hit };
  }
  return best;
}

// Where a car driving this edge sits. `dir` is the sign of travel along the
// edge's own axis, and the lane sits LANE_OFFSET to the positive side of the
// other axis — exactly where street.js has always drawn traffic. That makes
// N-S right-hand and E-W left-hand, an inconsistency inherited from the shipped
// street; it gets settled when traffic migrates onto this graph, not before.
export function laneCenterLine(edge, dir) {
  const a = node(edge.a);
  const b = node(edge.b);
  const off = dir * LANE_OFFSET;
  const ox = edge.axis === 'z' ? off : 0;
  const oz = edge.axis === 'x' ? off : 0;
  return {
    x0: a.x + ox, z0: a.z + oz, y0: a.y,
    x1: b.x + ox, z1: b.z + oz, y1: b.y,
  };
}

// ---------------------------------------------------------------------------
// The ground gets a Y.
//
// The field is non-negative everywhere except the river channel: every base in
// this world sits at y <= 0 (buildings at 0, the ground plane at -0.08, the
// mountains at -4), so relief that only rises can bury a base but never expose
// one, and the shipped skyline cannot break.
//
// The channel is the one dip, and it earns the exception because without it the
// river is invisible — the ground plane at -0.08 is opaque and the water sits
// under it at -0.5. It is confined to the 9.5 m of ground between two pieces of
// paving it must not undercut: avenue -44's east walkway ends at x = -37.5
// (block.js puts it at ROAD_HALF + 1.5, three metres wide) and the promenade
// slab starts at x = -28. The drop reaches zero at -37.4 and -28.2.
//
// It lives here, beside the road graph, because the graph is what decides where
// the ground must stay flat — and because a mover asking how high the ground is
// must not have to reach into the renderer to find out (law 5).
const TERRAIN_SEED = 70413;
// Below SHOP_SILL (0.55 in block.js), so a swell never buries a shopfront.
const VERGE_RISE = 0.45;
const HILL_RISE = 3.0;
// Metres of blend from a flat footprint's edge out to full relief. Short enough
// for a 15 m park to read, long enough that the lip is a slope and not a step.
const FLAT_BLEND = 11;
// Beyond the built district the relief opens up over this distance.
const WILD_BLEND = 70;

// A carriageway stays dead flat across its own width plus the walkway beside it
// (block.js lays 3 m slabs along the avenues, 2.4 m along the crossings) plus a
// tenth of a metre, so the blend starts off the paving and the street frame
// never tilts.
const AVENUE_WALKWAY = 3;
const CROSSING_WALKWAY = 2.4;
const FLAT_MARGIN = 0.1;
const ROAD_FLAT_HALF = ROAD_HALF_WIDTH + AVENUE_WALKWAY + FLAT_MARGIN;
// A causeway takes no margin: it is held flat by the 1.2 m pier blend, which is
// the skirt, and widening it would push the river's cut ends out into the open.
const CAUSEWAY_HALF = ROAD_HALF_WIDTH + CROSSING_WALKWAY;

// The river bed, as a rect: cx, cz, half-width of the flat bed, half-length.
// BED_DROP leaves roughly half a metre of water over the bed at y = -0.5; the
// banks run out over BANK_RUN and reach zero clear of the paving on both sides.
// The half-length stops short of the water plane's 280 m so its cut ends stay
// buried under rising ground instead of showing as a straight edge.
export const RIVER_CHANNEL = [-32.8, -5, 2.1, 136];
const BANK_RUN = 2.5;
const BED_DROP = 1.1;

// Footprints that stay dead flat. Every road in the graph makes its own — add an
// avenue and the ground under it flattens without anyone editing a table.
function roadFlatRects() {
  const rects = [];
  for (const d of DISTRICTS) {
    for (const av of d.avenues) {
      rects.push([av.x, (av.z0 + av.z1) / 2, ROAD_FLAT_HALF, (av.z1 - av.z0) / 2]);
    }
    for (const cr of d.crossings) {
      rects.push([(cr.x0 + cr.x1) / 2, cr.z, (cr.x1 - cr.x0) / 2, ROAD_FLAT_HALF]);
    }
  }
  return rects;
}

// The one flat footprint that is not a road: the river promenade, a paved deck
// block.js lays between the west avenue and the water. Nothing in the graph
// describes it, so it stays data.
const PROMENADE = [-17, -32, 11, 4.5];
const FLAT_RECTS = [...roadFlatRects(), PROMENADE];

// Ten of the 68 towers are built out over the channel corridor — avenue -44's
// east row overlaps the water by 6.0 to 7.5 m each, two infill towers clip its
// east bank, and the north terminus clips its west (every footprint that meets
// x -38..-28 was enumerated from block.js TOWERS via emitTower's
// ax + side * (8.5 + d / 2), not guessed). They are not mine to move, so the
// ground is held up under them and the river narrows past each one instead:
// piers standing in the water, not towers hanging over a hole.
const PIER_BLEND = 1.2;
const TOWER_ABUTMENTS = [
  [-30.5, -44, 5.5, 5], [-30, -26, 6.5, 5.5], [-30.5, -6, 5, 5], [-30.5, 12, 6, 5],
  [-30, 30, 7, 5.5], [-30.5, 50, 5, 5], [-30, 78, 7, 5.5],
  [-22, -24, 7, 6], [-22, 70, 7, 6], [-44, 104, 7, 6],
];

// A crossing that spans the channel holds its own ground up and crosses on an
// earth causeway — which is where a bridge goes. Derived, so a second crossing
// over the water causeways itself.
function causewayRects() {
  const rects = [];
  for (const d of DISTRICTS) {
    for (const cr of d.crossings) {
      if (spans(cr.x0, cr.x1, RIVER_CHANNEL[0])) {
        rects.push([(cr.x0 + cr.x1) / 2, cr.z, (cr.x1 - cr.x0) / 2, CAUSEWAY_HALF]);
      }
    }
  }
  return rects;
}

const CHANNEL_ABUTMENTS = [...TOWER_ABUTMENTS, ...causewayRects()];

// The built district as one rect (cx, cz, half-width, half-depth). Inside it the
// relief is the verge swell only, so the 68 merged towers and the skyline ring
// keep the flat ground they were authored against.
const DISTRICT_RELIEF = [7, 2.5, 73, 117.5];

// Two bands of randomly-oriented waves. The swell is short, so a 15 m verge
// actually rolls instead of being handed one constant offset; the hills are
// long, because a hill the size of a park is a mound. Every wavelength stays
// above twice the 4 m sampling grid, so the mesh cannot alias one into facets.
function seedWaves(rand, wavelengths) {
  const waves = wavelengths.map((wavelength, i) => {
    const angle = rand() * Math.PI * 2;
    const k = (Math.PI * 2) / wavelength;
    return {
      kx: Math.cos(angle) * k, kz: Math.sin(angle) * k,
      phase: rand() * Math.PI * 2, amp: 1 / (i + 1),
    };
  });
  const total = waves.reduce((sum, w) => sum + w.amp, 0);
  return waves.map((w) => ({ ...w, amp: w.amp / total }));
}

const TERRAIN_RAND = mulberry32(TERRAIN_SEED);
const SWELL_WAVES = seedWaves(TERRAIN_RAND, [34, 19]);
const HILL_WAVES = seedWaves(TERRAIN_RAND, [190, 88, 43]);

function band01(waves, x, z) {
  let n = 0;
  for (const w of waves) n += w.amp * Math.sin(w.kx * x + w.kz * z + w.phase);
  return 0.5 + 0.5 * n;
}

function smoothstep01(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function rectDistance(x, z, cx, cz, hw, hd) {
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dz = Math.max(0, Math.abs(z - cz) - hd);
  return Math.hypot(dx, dz);
}

// 1 inside any of the rects, 0 once the blend has run out.
function holdFlat(rects, blend, x, z) {
  let held = 0;
  for (const [cx, cz, hw, hd] of rects) {
    held = Math.max(held, 1 - smoothstep01(rectDistance(x, z, cx, cz, hw, hd) / blend));
    if (held >= 1) return 1;
  }
  return held;
}

function flatness(x, z) {
  return Math.max(holdFlat(FLAT_RECTS, FLAT_BLEND, x, z),
    holdFlat(CHANNEL_ABUTMENTS, PIER_BLEND, x, z));
}

// How far the ground falls toward the river bed. The abutments hold it up, so
// the channel closes under a tower or a street and reopens past it.
function channelDrop(x, z) {
  const bed = 1 - smoothstep01(rectDistance(x, z, ...RIVER_CHANNEL) / BANK_RUN);
  if (bed <= 0) return 0;
  return BED_DROP * bed * (1 - holdFlat(CHANNEL_ABUTMENTS, PIER_BLEND, x, z));
}

function wildness(x, z) {
  return smoothstep01(rectDistance(x, z, ...DISTRICT_RELIEF) / WILD_BLEND);
}

// Ground elevation in metres above the ground plane. Exactly zero on every road,
// negative only in the river channel.
export function heightAt(x, z) {
  const open = 1 - flatness(x, z);
  const swell = VERGE_RISE * band01(SWELL_WAVES, x, z);
  const hills = HILL_RISE * band01(HILL_WAVES, x, z) * wildness(x, z);
  return open * (swell + hills) - channelDrop(x, z);
}
