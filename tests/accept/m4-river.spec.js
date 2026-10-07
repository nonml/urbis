// M4-2 (docs/ROADMAP.md): on all five seeds the generated city has a river at
// least 25 m wide crossing it, at least 2 bridges a car can drive over, no road
// that crosses the water without being a bridge, and the world-scale placement
// rule refuses any footprint on the water or within 8 m of it. The city's own
// land — every lot the city grows a building on — is clear of it too.
//
// The legacy street wall is not scanned here: m3-parcels pins map.buildings
// byte-for-byte to planBuildings(district, seed), and that wall's water spans
// go when the hand tables do (M4.T15). M4-2 checks the placement rule and the
// city's land, which is what this task can enforce.
//
// Node only: one seed per process, no page opens.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const MIN_WATER = 25;
const SETBACK = 8;
const PROBE = 12;
const EPS = 1e-6;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap } = await import('../../src/sim/map.js');
  const map = createMap(seed);
  const nodes = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const at = (id) => nodes.get(id);
  const water = map.water;

  // The box-to-rect gap, so a footprint is measured by its nearest edge.
  const gapToWater = (x, z, w, d) => Math.min(...water.map(([cx, cz, hw, hd]) =>
    Math.hypot(Math.max(0, Math.abs(x - cx) - hw - w / 2),
      Math.max(0, Math.abs(z - cz) - hd - d / 2))));

  const overWater = (x, z) => water.some(([cx, cz, hw, hd]) =>
    Math.abs(x - cx) < hw - EPS && Math.abs(z - cz) < hd - EPS);

  // A road runs along one axis, so an edge crosses a water rect when the two
  // spans overlap inside it.
  const hitsWater = (a, b) => water.some(([cx, cz, hw, hd]) =>
    Math.min(a.x, b.x) < cx + hw - EPS && Math.max(a.x, b.x) > cx - hw + EPS
    && Math.min(a.z, b.z) < cz + hd - EPS && Math.max(a.z, b.z) > cz - hd + EPS);

  const crossing = [];
  const nonBridge = [];
  for (const e of map.graph.edges) {
    if (!hitsWater(at(e.a), at(e.b))) continue;
    crossing.push(e.id);
    if (e.kind !== 'bridge') nonBridge.push(e.id);
  }

  const bridges = map.graph.edges.filter((e) => e.kind === 'bridge').map((e) => {
    const a = at(e.a);
    const b = at(e.b);
    const side = (n) => (n.z < map.town.river.z ? -1 : 1);
    const links = (n) => map.graph.edges.filter((o) => o !== e && (o.a === n.id || o.b === n.id));
    const road = (n, o) => at(o.a === n.id ? o.b : o.a);
    return {
      id: e.id,
      lanes: e.lanes,
      crosses: hitsWater(a, b) && side(a) !== side(b),
      onLand: !overWater(a.x, a.z) && !overWater(b.x, b.z),
      level: a.y === b.y && links(a).some((o) => o.kind !== 'bridge' && road(a, o).y === a.y)
        && links(b).some((o) => o.kind !== 'bridge' && road(b, o).y === b.y),
      mouth: links(a).length >= 1 && links(b).length >= 1,
    };
  });

  // The placement rule (terrain.buildable): water and its 8 m setback refuse a
  // PROBE-wide footprint; a metre past the setback it is dry. The city's own
  // land — every lot — is measured by its box.
  const [cx, cz, hw, hd] = water[0];
  const wet = map.terrain.buildable(0, cz, PROBE, PROBE).water;
  const setback = map.terrain.buildable(0, cz + hd + SETBACK + PROBE / 2 - 1, PROBE, PROBE).water;
  const dry = map.terrain.buildable(0, cz + hd + SETBACK + PROBE / 2 + 1, PROBE, PROBE).water;
  const near = map.lots
    .map(([x, z, w, d], i) => ({ id: `lot:${i}`, gap: gapToWater(x, z, w, d) }))
    .filter((p) => p.gap < SETBACK - EPS).slice(0, 8);

  process.stdout.write(`${JSON.stringify({
    seed,
    river: { width: 2 * hd, minX: cx - hw, maxX: cx + hw, z: cz },
    bounds: map.town.bounds,
    edges: map.graph.edges.length,
    crossing,
    nonBridge,
    bridges,
    probes: { wet, setback, dry },
    near,
  })}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(120000);

for (const seed of SEEDS) {
  test(`M4-2 seed ${seed}: 25 m river, 2 driveable bridges, nothing placed on the water`, () => {
    // M4.T1's red check (no river, no bridge kind on a generated city); M4.T7,
    // bridges, and M4.T8, the drawn river, make it pass: drop this then.
    const r = row(seed);
    expect(r.river.width, `seed ${seed}: river width`).toBeGreaterThanOrEqual(MIN_WATER);
    expect(r.river.minX, `seed ${seed}: river spans the town's west edge`).toBeLessThanOrEqual(r.bounds.minX);
    expect(r.river.maxX, `seed ${seed}: river spans the town's east edge`).toBeGreaterThanOrEqual(r.bounds.maxX);
    expect(r.river.z, `seed ${seed}: river inside the town`).toBeGreaterThan(r.bounds.minZ);
    expect(r.river.z, `seed ${seed}: river inside the town`).toBeLessThan(r.bounds.maxZ);
    expect(r.crossing.length, `seed ${seed}: roads crossing the water`).toBeGreaterThanOrEqual(2);
    expect(r.nonBridge, `seed ${seed}: water crossed by a road that is not a bridge`).toEqual([]);
    expect(r.bridges.length, `seed ${seed}: bridge edges`).toBeGreaterThanOrEqual(2);
    for (const b of r.bridges) {
      expect(b.lanes, `seed ${seed}: ${b.id} lanes`).toBeGreaterThanOrEqual(2);
      expect(b.crosses, `seed ${seed}: ${b.id} must span bank to bank`).toBe(true);
      expect(b.onLand, `seed ${seed}: ${b.id} must land on the banks`).toBe(true);
      expect(b.level, `seed ${seed}: ${b.id} deck must be level with the road`).toBe(true);
      expect(b.mouth, `seed ${seed}: ${b.id} must join a road at both ends`).toBe(true);
    }
    expect(r.probes, `seed ${seed}: buildable must refuse water and its setback`)
      .toEqual({ wet: true, setback: true, dry: false });
    expect(r.near, `seed ${seed}: lots within ${SETBACK} m of the water`).toEqual([]);
  });
}
