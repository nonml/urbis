// M4-9 (docs/ROADMAP.md): the town is not an island. On each of the five seeds
// one regional road enters at an edge of the map and joins the arterials;
// through-traffic and commuters from outside drive it, appearing at its far end
// out in the open land past the town and leaving there again.
//
// Node only: no page opens, one seed per test. The road and the cars that drive
// it are the sim's own — map.js's `outside`, traffic.js's fleet — so the check
// reads the world a game boots on rather than a picture of it.
import { test, expect } from '@playwright/test';
import { setWorldSeed } from '../../src/sim/seedstore.js';
import { createMap, graphBounds, BUILD_MARGIN } from '../../src/sim/map.js';
import { createTraffic, tick } from '../../src/sim/traffic.js';

// "Five seeds" always means 7, 11, 22, 33 and 73 (docs/ROADMAP.md).
const SEEDS = [7, 11, 22, 33, 73];
// The fleet the game ticks (street.js CAR_COUNT).
const FLEET = 16;
// The frame loop's own fixed step (M0.T1), so the sim runs the way it plays.
const STEP = 0.05;
// Long enough for a car from outside to drive in, run the length of the town
// and drive out again: the town is about 1.3 km across, a car holds at every
// light on the way, and a round through it is three or four minutes of game
// time. The ticks are the frame loop's own and cost a tenth of a second a seed.
const SECS = 600;
// M3-6's appear/go allowance (traffic.js CAM_DIST + CAM_MARGIN, VIEW_DOT): a
// car the player cannot see appear may only appear this far out from the
// camera and off its own view axis.
const SIGHT = 70;
const VIEW_DOT = 0.6;

// The world a game of `seed` boots on: the map, and the fleet ticked on it.
function world(seed) {
  setWorldSeed(seed, true);
  const map = createMap(seed);
  return { map, traffic: createTraffic(map, seed, FLEET) };
}

// Every trip the fleet takes while `secs` of game time pass. A trip is a new
// goal: a car always stands at the node it was driving to when it takes its
// next one, so the goal a car moved away from is where that trip started.
function tripsOf(traffic, secs) {
  const at = traffic.cars.map((c) => c.goal);
  const trips = [];
  for (let t = 0; t < secs; t += STEP) {
    tick(traffic, STEP);
    traffic.cars.forEach((c, i) => {
      if (c.goal === at[i]) return;
      if (c.route.length > 0) trips.push({ from: at[i], to: c.goal, route: c.route.slice() });
      at[i] = c.goal;
    });
  }
  return trips;
}

// How far a node stands from the spawn camera, and how far off its view axis:
// a car from outside is only invisible out there (M3-6's own rule).
function sightOf(map, node) {
  const cam = map.spawn?.player;
  if (!cam) return { dist: 0, dot: 1 };
  const dx = node.x - cam.x;
  const dz = node.z - cam.z;
  const dist = Math.hypot(dx, dz);
  return { dist, dot: dist === 0 ? 1 : (dx * Math.sin(cam.yaw) + dz * Math.cos(cam.yaw)) / dist };
}

function row(seed) {
  const { map, traffic } = world(seed);
  const nodes = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const regional = map.graph.edges.filter((e) => e.kind === 'regional');
  // An arterial edge is one the town plan's arterial ways cut: buildGraph names
  // a way's edges after the axis it runs, not after the way's own kind.
  const arterialWays = new Set([...map.town.arterials.avenues, ...map.town.arterials.crossings].map((w) => w.id));
  const arterial = map.graph.edges.filter((e) => arterialWays.has(e.way));
  const outside = map.outside ?? null;
  const gate = outside ? nodes.get(outside.gate) : null;
  const join = outside ? nodes.get(outside.join) : null;
  const axes = [...new Set(regional.map((e) => e.axis))];
  const lines = [...new Set(regional.map((e) => (e.axis === 'z' ? nodes.get(e.a).x : nodes.get(e.a).z)))];
  // The ends the arterials leave the town by, read from the town plan rather
  // than from the map's own labels: a node with one edge, on an arterial.
  const degree = new Map();
  for (const e of map.graph.edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const arterialNodes = new Set(arterial.flatMap((e) => [e.a, e.b]));
  const ends = new Set([...degree.keys()]
    .filter((id) => degree.get(id) === 1 && arterialNodes.has(id) && id !== outside?.gate));
  const box = graphBounds(map.graph);
  const edge = (axis) => (axis === 'z' ? { min: box.minZ, max: box.maxZ } : { min: box.minX, max: box.maxX });

  const trips = tripsOf(traffic, SECS);
  const onRegional = trips.filter((t) => t.route.some((id) => outside?.edges.includes(id)));
  const fromGate = trips.filter((t) => t.from === outside?.gate || t.to === outside?.gate);
  const through = fromGate.filter((t) => ends.has(t.from) || ends.has(t.to));
  const commute = fromGate.filter((t) => !through.includes(t));
  const farSight = [...ends].map((id) => sightOf(map, nodes.get(id)));

  return {
    seed,
    roads: {
      ways: [...new Set(regional.map((e) => e.way))],
      edges: regional.length,
      axes,
      lines,
      axis: axes.length === 1 ? axes[0] : null,
      join: join ? {
        degree: degree.get(join.id),
        arterials: map.graph.edges.filter((e) => (e.a === join.id || e.b === join.id) && arterialWays.has(e.way)).length,
        regional: regional.filter((e) => e.a === join.id || e.b === join.id).length,
      } : null,
      ends: ends.size,
      gate: gate ? {
        x: gate.x, z: gate.z,
        degree: degree.get(gate.id),
        arterials: map.graph.edges.filter((e) => (e.a === gate.id || e.b === gate.id) && arterialWays.has(e.way)).length,
        spans: axes.length === 1 ? { axis: axes[0], ...edge(axes[0]) } : null,
        atMap: {
          minZ: map.bounds.minZ - gate.z, maxZ: gate.z - map.bounds.maxZ,
          minX: map.bounds.minX - gate.x, maxX: gate.x - map.bounds.maxX,
        },
      } : null,
    },
    sight: gate ? sightOf(map, gate) : null,
    farSight: { nearest: Math.min(...farSight.map((s) => s.dist)) },
    traffic: {
      trips: trips.length,
      onRoad: onRegional.length,
      appeared: fromGate.filter((t) => t.from === outside?.gate).length,
      left: fromGate.filter((t) => t.to === outside?.gate).length,
      through: through.length,
      commute: commute.length,
    },
  };
}

test.setTimeout(120000);

for (const seed of SEEDS) {
  test(`M4-9 seed ${seed}: a road in from outside, and traffic that drives it`, () => {
    const r = row(seed);
    // One regional road: one way, straight, along one axis.
    expect(r.roads.ways.length, `seed ${seed}: regional ways`).toBe(1);
    expect(r.roads.edges, `seed ${seed}: regional edges`).toBeGreaterThan(0);
    expect(r.roads.axes, `seed ${seed}: regional axes`).toEqual([r.roads.axis]);
    expect(r.roads.lines.length, `seed ${seed}: the road bends`).toBe(1);
    // It joins the arterials: a junction where a regional edge meets one.
    expect(r.roads.join, `seed ${seed}: no node joining the arterials`).not.toBeNull();
    expect(r.roads.join.degree, `seed ${seed}: the join is not a junction`).toBeGreaterThanOrEqual(3);
    expect(r.roads.join.arterials, `seed ${seed}: no arterial at the join`).toBeGreaterThanOrEqual(1);
    expect(r.roads.join.regional, `seed ${seed}: no regional edge at the join`).toBeGreaterThanOrEqual(1);
    // Its far end stands out in the open land: nothing arterial there, the
    // outermost node the graph has, within a build margin of the map's edge.
    expect(r.roads.gate, `seed ${seed}: no far end past the town`).toBeTruthy();
    expect(r.roads.gate.degree, `seed ${seed}: the far end is not a road end`).toBe(1);
    expect(r.roads.gate.arterials, `seed ${seed}: the far end is on an arterial`).toBe(0);
    const spans = r.roads.gate.spans;
    const reach = r.roads.axis === 'z'
      ? Math.min(r.roads.gate.z - spans.min, spans.max - r.roads.gate.z)
      : Math.min(r.roads.gate.x - spans.min, spans.max - r.roads.gate.x);
    expect(reach, `seed ${seed}: the far end stands inside the graph, not at its edge`).toBeLessThan(1e-6);
    const toMap = r.roads.axis === 'z'
      ? Math.min(r.roads.gate.atMap.minZ, r.roads.gate.atMap.maxZ)
      : Math.min(r.roads.gate.atMap.minX, r.roads.gate.atMap.maxX);
    expect(toMap, `seed ${seed}: the far end stands past the map's own edge`).toBeLessThanOrEqual(BUILD_MARGIN);
    // The far end stands out of sight of the spawn, by M3-6's own rule: that is
    // where a car from outside appears and leaves, and the camera cannot watch
    // it happen. The arterial ends through-traffic crosses the town to leave by
    // stand as far out again, past every road the town has.
    expect(r.sight.dist, `seed ${seed}: the far end is this close to the camera`).toBeGreaterThanOrEqual(SIGHT);
    expect(r.sight.dot, `seed ${seed}: the far end is in the camera's view`).toBeLessThanOrEqual(VIEW_DOT);
    expect(r.roads.ends, `seed ${seed}: no arterial end to leave the town by`).toBeGreaterThan(0);
    expect(r.farSight.nearest, `seed ${seed}: an arterial end stands this close to the camera`).toBeGreaterThanOrEqual(SIGHT);
    // Traffic: cars drive it, appear at the far end, leave at it, run the length
    // of the town on it, and commute in and out on it.
    expect(r.traffic.onRoad, `seed ${seed}: no car drove the road in`).toBeGreaterThan(0);
    expect(r.traffic.appeared, `seed ${seed}: no car appeared at the far end`).toBeGreaterThan(0);
    expect(r.traffic.left, `seed ${seed}: no car left at the far end`).toBeGreaterThan(0);
    expect(r.traffic.through, `seed ${seed}: no through-traffic crossed the town`).toBeGreaterThan(0);
    expect(r.traffic.commute, `seed ${seed}: no commuter from outside`).toBeGreaterThan(0);
  });
}
