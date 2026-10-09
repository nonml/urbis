// M5-9 (docs/ROADMAP.md): a game that built a road, bulldozed a building and a
// road, placed a service, painted a cap and set tax rates saves and continues
// with the same roads, buildings, lots, services and money, through
// serialize/deserialize behind src/savestore.js — the pair main.js's autosave
// drives. A road edit travels only in the op log, so the roads go through
// save.js's applyOp door, the descriptor the reload replays (m3-save.spec.js's
// shape); the city view's own drag calls ops.js directly and records none. The
// service, the cap and the taxes are the city's own state and travel on the
// snapshot. Node only, one child per seed: world.js reads the seed once at
// import, so every world is built in its own process.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05, PLAY = 90, AFTER = 60;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  // The sim modules, imported after the seed is set: world.js reads it at import.
  const sim = Object.assign({}, ...await Promise.all(['map', 'zoning', 'street', 'people', 'clock',
    'player', 'vehicle', 'interior', 'mission', 'ops', 'budget', 'save', 'cityview']
    .map((m) => import(`../../src/sim/${m}.js`))));
  const { mapHash, createMap, createCity, tickZoning, STAGE, capParcel, createStreet, tickStreet,
    createPeople, tickPeople, createClock, tickClock, createPlayer, createPlayerCar, createInterior,
    createMission, SERVICES, addRoad, undo, applyOp, placeService, setTax, serialize, deserialize,
    createCityView, tickCityView } = sim;
  const slots = new Map();
  globalThis.localStorage = { getItem: (k) => slots.get(k) ?? null,
    setItem: (k, v) => void slots.set(k, String(v)), removeItem: (k) => slots.delete(k) };
  const { writeSave, loadSave } = await import('../../src/savestore.js');
  // main.js's own game object: the live map, the city it grows, and the rest.
  const map = createMap(seed), city = createCity(seed, map);
  const game = { seed, generate: true, map, city, clock: createClock(), street: createStreet(seed, map),
    player: createPlayer(map), car: createPlayerCar(map), interior: createInterior(),
    mission: createMission(), people: createPeople(seed) };
  const view = createCityView(city, map);
  const step = () => { tickClock(game.clock, DT); tickStreet(game.street, DT); tickZoning(city, DT, game.street);
    tickPeople(game.people, city); tickCityView(view, city, DT, new Set()); };
  const run = (secs) => { for (let i = 0, n = Math.round(secs / DT); i < n; i++) step(); };
  // What the criterion names, read off a live game.
  const print = (g) => ({
    roads: g.map.graph.edges.map((e) => e.id).sort(),
    lots: g.city.parcels.map((p) => `${p.id}:${p.kind}:${p.zoned}:${p.stage}`),
    buildings: g.city.standing.map((p) => `${p.id}:${p.kind}:${p.stage}`),
    services: g.map.parcels.filter((p) => p.kind === 'service').map((p) => `${p.id}:${p.type}`),
    caps: g.map.parcels.filter((p) => p.cap !== undefined && p.cap !== STAGE.HIGH).length,
    books: { money: g.city.economy.budget.money, tax: { ...g.city.economy.budget.tax } } });
  const ticked = (g) => ({ hash: mapHash(g.map), money: g.city.economy.budget.money });
  // A road a player could drag: an extension of a generated road into open land, found
  // by laying it and putting it back (m5-roads.spec.js's own probe).
  const drags = map.graph.nodes.slice().flatMap((n) => [[1, 0], [0, 1], [-1, 0], [0, -1]]
    .map(([dx, dz]) => [{ x: n.x, z: n.z }, { x: n.x + dx * 80, z: n.z + dz * 80 }]));
  const ids = () => new Set(map.graph.edges.map((e) => e.id)), had = ids();
  const site = drags.find(([a, b]) => { const edges = map.graph.edges.length; addRoad(map, a, b);
    const open = map.graph.edges.length > edges; undo(map); return open; });
  applyOp(map, { op: 'addRoad', a: [site[0].x, site[0].z], b: [site[1].x, site[1].z] });
  const road = [...ids()].find((id) => !had.has(id));
  applyOp(map, { op: 'removeRoad', id: road });                    // the road just built comes out
  applyOp(map, { op: 'removeRoad', id: map.graph.edges[0].id });   // and a generated one with it
  const victim = map.parcels.find((p) => (p.kind === 'row' || p.kind === 'tower') && p.stage >= STAGE.LOW);
  applyOp(map, { op: 'bulldoze', id: victim.id });
  const empty = map.parcels.find((p) => p.kind === 'lot' && p.stage === STAGE.EMPTY);
  const type = Object.keys(SERVICES).find((t) => SERVICES[t].cost <= city.economy.budget.money);
  placeService(map, empty, type);   // a service on an empty lot, as the tool does
  capParcel(city, city.parcels.indexOf(city.parcels.find((p) => p.kind === 'lot' && p.zoned)), STAGE.LOW);
  setTax(city.economy.budget, 'res', 24); setTax(city.economy.budget, 'ind', 7);
  run(PLAY);
  const data = serialize(game); writeSave(data);   // the store, as main.js's autosave writes it
  const back = deserialize(loadSave()), saved = print(game), loaded = back ? print(back) : null;
  run(game, AFTER); if (back) run(back, AFTER);
  const lots = createCity(seed, createMap(seed)).parcels.length;   // what a reload lays from the seed
  process.stdout.write(`${JSON.stringify({ seed, road, victim: victim.id, type, ops: data.ops.length, lots,
    saved, loaded, kept: ticked(game), continued: back ? ticked(back) : null })}\n`);
  process.exit(0);
}

test.setTimeout(300000);
for (const seed of SEEDS) {
  test(`M5-9 seed ${seed}: a game with built and bulldozed roads, services, caps and taxes continues`, () => {
    const r = JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim().split('\n').pop());
    expect(r.ops, `seed ${seed}: the built road, the two bulldozed roads and the torn building are logged`).toBe(4);
    expect([r.saved.services.length, r.saved.caps], `seed ${seed}: the ${r.type} and the low cap stand`)
      .toEqual([1, 1]);
    expect(r.saved.roads, `seed ${seed}: the built road stands and the bulldozed ones are gone`)
      .not.toContain(r.road);
    expect(r.loaded, `seed ${seed}: the save reloads (${r.ops} ops, ${r.saved.lots.length} lots `
      + `against ${r.lots} from the seed)`).not.toBe(null);
    const shown = (v) => (Array.isArray(v) ? `${v.length} entries` : String(v));
    for (const k of ['roads', 'lots', 'buildings', 'services', 'caps']) {
      expect(r.loaded[k], `seed ${seed}: the same ${k} — ${shown(r.saved[k])} came back, ${shown(r.loaded[k])}`)
        .toEqual(r.saved[k]);
    }
    expect(r.loaded.books, `seed ${seed}: the treasury and the tax rates are the same`).toEqual(r.saved.books);
    expect(r.continued, `seed ${seed}: both cities keep ticking the same`).toEqual(r.kept);
  });
}
