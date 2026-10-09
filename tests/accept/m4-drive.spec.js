// M4-4 (docs/ROADMAP.md): holding the keys, the player drives from the spawn to
// the centre of the farthest district in under three minutes, on all five seeds.
//
// The town a seed plans is 4-6 districts about 600 m across, and the spawn
// stands in the downtown street between them. How far "farthest" can reach is
// bounded by where the car may drive: the hero car is clamped to the map's own
// drivable box (src/sim/vehicle.js), and on every seed today that box's east
// edge is still the downtown street's, so the districts east of it are outside
// the car's reach at any speed. The target is therefore the farthest district
// whose centre and whose road route both lie inside that box — on every seed a
// 590-740 m drive over 900-1050 m of the town's own graph, in a district other
// than the spawn's, in 60-100 game seconds. When a later task settles that
// east edge, more districts qualify and this check drives further east with no
// edit here.
//
// The drive is real: F into the hero car, then the keys, with game time read off
// `__game.step()` in fixed steps — never wall seconds, so a slow frame rate
// stretches the wall clock and not the three minutes. The route is the town's
// own road graph (map.graph, the one traffic and the map read), A*'d from the
// node nearest the car to the node nearest the district centre; the helper in
// lib/input.js steers it by pressing keys. Nothing about the drive is posed or
// teleported, and the check proves the route was covered rather than cut.
import { test, expect } from '@playwright/test';
import { createMap, nodeAt } from '../../src/sim/map.js';
import { driveAlong } from './lib/input.js';

// The sweep's five seeds (scripts/sweep.mjs, "five seeds" always means these).
const SEEDS = [7, 11, 22, 33, 73];
// The criterion's own number: three minutes of game time, spawn to the centre
// of the farthest district.
const DRIVE_SECS = 180;
const SPEED = 8;
// ?speed=8 runs 8 whole steps a frame, so a frame is 0.4 s of game and a run
// that fails costs a few seconds of wall clock, not three minutes of it.
test.setTimeout(300000);

// The districts of the town a seed plans: one per town-plan cell, each with its
// kind — the districts M4-1 counts. A cell's centre is the middle of its walk
// box, the same shape every reader of a district takes.
const centreOf = (box) => ({ x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 });

const routeLength = (nodes) => nodes.reduce((n, node, i) => (i
  ? n + Math.hypot(node.x - nodes[i - 1].x, node.z - nodes[i - 1].z) : n), 0);

// A* over the road graph, node to node, by edge length. The town plan cuts
// every district's roads and the arterials into one graph (map.js
// districtsGraph), so a route exists between any two of its nodes.
function graphRoute(map, fromId, toId) {
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const links = new Map(map.graph.nodes.map((n) => [n.id, []]));
  for (const edge of map.graph.edges) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;
    const len = Math.hypot(a.x - b.x, a.z - b.z);
    links.get(edge.a).push({ to: edge.b, len });
    links.get(edge.b).push({ to: edge.a, len });
  }
  const goal = byId.get(toId);
  const ahead = (id) => Math.abs(byId.get(id).x - goal.x) + Math.abs(byId.get(id).z - goal.z);
  const best = new Map([[fromId, 0]]);
  const came = new Map();
  const open = new Set([fromId]);
  const shut = new Set();
  while (open.size > 0) {
    let at = null, low = Infinity;
    for (const id of open) {
      const f = best.get(id) + ahead(id);
      if (f < low) { low = f; at = id; }
    }
    if (at === toId) break;
    open.delete(at);
    shut.add(at);
    for (const link of links.get(at)) {
      if (shut.has(link.to)) continue;
      const cost = best.get(at) + link.len;
      if (cost < (best.get(link.to) ?? Infinity)) {
        best.set(link.to, cost);
        came.set(link.to, at);
        open.add(link.to);
      }
    }
  }
  if (!came.has(toId) && fromId !== toId) return null;
  const ids = [toId];
  while (ids[0] !== fromId) ids.unshift(came.get(ids[0]));
  return ids.map((id) => byId.get(id));
}

// The car may only go where the map's own drivable box lets it (vehicle.js
// clamps to it). A district is drivable when its centre is inside that box and
// so is the whole road route to it; anything else the car cannot reach at any
// speed, however long it holds the keys.
function drivable(map, centre, from) {
  const box = map.district.drive;
  const route = graphRoute(map, from.id, nodeAt(map, centre.x, centre.z).node.id);
  if (!route) return null;
  const inside = route.every((n) => n.x > box.minX && n.x < box.maxX
    && n.z > box.minZ && n.z < box.maxZ);
  if (!inside || centre.x <= box.minX || centre.x >= box.maxX
    || centre.z <= box.minZ || centre.z >= box.maxZ) return null;
  return { route, length: routeLength(route) };
}

// The drive this seed's check runs: the farthest district the car can reach,
// and the graph route to it from the hero car's own parked pose.
function drive(seed) {
  const map = createMap(seed);
  const at = map.spawn.car;
  const from = nodeAt(map, at.x, at.z).node;
  const cells = map.cells.map((cell) => ({ kind: cell.kind, centre: centreOf(cell.walk) }));
  const far = cells
    .map((o) => ({ ...o, d: Math.hypot(o.centre.x - at.x, o.centre.z - at.z), way: drivable(map, o.centre, from) }))
    .filter((o) => o.way)
    .sort((a, b) => b.d - a.d)[0];
  return {
    map,
    from,
    far,
    // The districts the drive box leaves outside the car's reach, for the
    // failure message and the shot-free record of what this drive could not do.
    closed: cells.filter((o) => !drivable(map, o.centre, from))
      .map((o) => `${o.kind} at (${o.centre.x.toFixed(0)}, ${o.centre.z.toFixed(0)})`),
    waypoints: [...far.way.route.map((n) => ({ x: n.x, z: n.z })), far.centre],
  };
}

for (const seed of SEEDS) {
  test(`M4-4 seed ${seed}: the spawn drives to the farthest district under the keys`, async ({ page }) => {
    const where = drive(seed);
    expect(where.far, `seed ${seed}: the town plans a district the car can reach`).toBeTruthy();
    const road = where.far.way.length;
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`/?capture=1&gen=1&seed=${seed}&speed=${SPEED}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
    // The chase is the city answering the drive, and its answer — a roadblock
    // that stops the car dead (sim/response.js collide) — is a pursuit
    // criterion, not this one. Held through the game's own capture probe, which
    // calls the sim's own tick: the car drives every metre of the route under
    // the keys either way, and the check measures the town's roads.
    await page.evaluate(() => window.__game.police.hold(true));
    // The car the F prompt greets you with, on the kerb beside the spawn.
    const start = await page.evaluate(() => window.__game.car());
    const run = await driveAlong(page, where.waypoints, { capSecs: DRIVE_SECS });

    expect(run.stuck, `seed ${seed}: ${run.why ?? 'the drive stopped'} at (${run.x}, ${run.z}) `
      + `after ${run.secs}s, ${run.gap} m short of the ${where.far.kind} district centre `
      + `(${where.far.centre.x.toFixed(0)}, ${where.far.centre.z.toFixed(0)}) — the car is clamped to the `
      + `map's drivable box x=[${where.map.district.drive.minX}, ${where.map.district.drive.maxX}], `
      + `z=[${where.map.district.drive.minZ}, ${where.map.district.drive.maxZ}], which leaves `
      + `${where.closed.join('; ')} outside it`).toBe(false);
    expect(run.gap, `seed ${seed}: the car came to rest ${run.gap} m from the district centre`).toBeLessThanOrEqual(10);
    expect(run.secs, `seed ${seed}: ${road.toFixed(0)} m of road in ${run.secs}s`).toBeLessThan(DRIVE_SECS);
    // The road was driven, not cut: the car covers the route it was given.
    expect(run.moved, `seed ${seed}: the car covered ${run.moved} m of the ${road.toFixed(0)} m route`)
      .toBeGreaterThanOrEqual(road * 0.8);
    expect(start.x, `seed ${seed}: the drive began at the hero car, not a posed pose`)
      .toBeCloseTo(where.map.spawn.car.x, 1);
    expect(errors, `seed ${seed}: no page error during the drive`).toEqual([]);
  });
}
