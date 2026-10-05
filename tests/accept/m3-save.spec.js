// M3.T38 / M3-8 (docs/ROADMAP.md): the save holds the edits. A game after 200
// operations saves and continues to the same map hash and state hash; the save
// is under 1 MB; the op log is compacted on save; a version-2 save starts a new
// game with a one-line message, never a crash.
//
// Node only: the map is built in a fresh process because world.js reads the
// seed once, when it is imported. The map hash is sim/map.js's; the state hash
// is taken over the save's own state payload (the map and its op log are
// hashed by themselves).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 33];
const OPS = 200;
const FLIPS = 60;
const MAX_BYTES = 1_000_000;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const [
    { createMap, mapHash }, { applyOp, opsOf, serialize, deserialize }, { mulberry32 },
    { createClock, tickClock }, { createStreet, tickStreet }, { createCity, tickZoning },
    { createPeople, tickPeople }, { createPlayer }, { createPlayerCar },
    { createInterior }, { createMission },
  ] = await Promise.all([
    import('../../src/sim/map.js'), import('../../src/sim/save.js'), import('../../src/sim/rng.js'),
    import('../../src/sim/clock.js'), import('../../src/sim/street.js'), import('../../src/sim/zoning.js'),
    import('../../src/sim/people.js'), import('../../src/sim/player.js'), import('../../src/sim/vehicle.js'),
    import('../../src/sim/interior.js'), import('../../src/sim/mission.js'),
  ]);

  // The game main.js boots, with the map this save carries.
  function boot() {
    const map = createMap(seed);
    const city = createCity(seed, map);
    return {
      seed, generate: true, map, clock: createClock(),
      street: createStreet(seed, map), city,
      player: Object.assign(createPlayer(map), { mode: 'foot' }),
      car: createPlayerCar(map), interior: createInterior(),
      mission: createMission(), people: createPeople(seed),
    };
  }

  // The state the save holds: clock, street (walkers and traffic among it),
  // city, player, car, interior, mission, people. An economy's derived values
  // recompute on the first tick by design.
  const stateHash = (g) => {
    const { ops, mapVersion, ...state } = serialize(g);
    return mapHash(state);
  };
  const run = (g, secs) => {
    for (let t = 0; t < secs; t += 0.05) {
      tickClock(g.clock, 0.05);
      tickStreet(g.street, 0.05);
      tickZoning(g.city, 0.05, g.street);
      tickPeople(g.people, g.city);
    }
  };
  const pick = (rand, xs) => xs[Math.floor(rand() * xs.length)];

  // One random op on the map as it stands, as the plain descriptor the log
  // stores — the same distribution tests/accept/m3-ops.test.js fuzzes with.
  function nextOp(rand, map) {
    const roll = rand();
    if (roll < 0.2) return { op: 'zone', id: pick(rand, map.parcels).id, use: pick(rand, [null, 'res', 'com', 'ind']) };
    if (roll < 0.4) {
      const up = map.parcels.filter((q) => q.stage > 0);
      return { op: 'bulldoze', id: pick(rand, up.length ? up : map.parcels).id };
    }
    if (roll < 0.6) return { op: 'place', id: pick(rand, map.parcels).id, kind: pick(rand, ['tower', 'cap', 'row']) };
    if (roll < 0.8 && map.graph.nodes.length) {
      const n = pick(rand, map.graph.nodes);
      const d = (0.5 + Math.floor(rand() * 40) * 0.5) * (rand() < 0.5 ? -1 : 1);
      return { op: 'addRoad', a: [n.x, n.z], b: rand() < 0.5 ? [n.x + d, n.z] : [n.x, n.z + d] };
    }
    if (map.graph.edges.length) return { op: 'removeRoad', id: pick(rand, map.graph.edges).id };
    return { op: 'zone', id: pick(rand, map.parcels).id, use: pick(rand, [null, 'res', 'com', 'ind']) };
  }

  const game = boot();
  const rand = mulberry32(seed);
  // 60 repaints of one lot first: one decision the save must fold to its net
  // effect. Then 200 random operations, then 90 s of the city living on top.
  const lot = game.city.parcels.find((p) => p.kind === 'lot') ?? game.city.parcels[0];
  const uses = [null, 'res', 'com', 'ind', 'res', 'com'];
  for (let i = 0; i < FLIPS; i++) applyOp(game.map, { op: 'zone', id: lot.id, use: uses[i % uses.length] });
  const flipOps = opsOf(game.map).length;
  for (let i = 0; i < OPS; i++) applyOp(game.map, nextOp(rand, game.map));
  run(game, 90);

  const logged = opsOf(game.map).length;
  const mapBefore = mapHash(game.map);
  const stateBefore = stateHash(game);
  const data = serialize(game);
  const bytes = Buffer.byteLength(JSON.stringify(data));
  const back = deserialize(JSON.stringify(data));
  const mapSame = mapHash(back.map) === mapBefore;
  const stateSame = stateHash(back) === stateBefore;

  // Both keep living: the continuation is compared after the same 120 s.
  run(game, 120);
  run(back, 120);

  process.stdout.write(`${JSON.stringify({
    seed, logged, flipOps, saved: data.ops.length, inMemory: opsOf(game.map).length, bytes,
    format: data.format, version: data.version,
    mapSame, stateSame,
    mapContinued: mapHash(back.map) === mapHash(game.map),
    stateContinued: stateHash(back) === stateHash(game),
  })}\n`);
  process.exit(0);
}

// One child per seed, kept so the four tests share the sim work.
const WORLDS = new Map();
function world(seed) {
  if (!WORLDS.has(seed)) {
    const out = execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    WORLDS.set(seed, JSON.parse(out.trim().split('\n').pop()));
  }
  return WORLDS.get(seed);
}

test('M3-8: a game after 200 operations saves and continues to the same map and state', () => {
  for (const seed of SEEDS) {
    const m = world(seed);
    expect(m.format, `seed ${seed}: the save is the version-3 format`).toBe(3);
    expect(m.logged, `seed ${seed}: the log holds the effective operations`).toBeGreaterThan(OPS * 0.4);
    expect(m.mapSame, `seed ${seed}: the loaded map is the same map`).toBe(true);
    expect(m.stateSame, `seed ${seed}: the loaded state is the same state`).toBe(true);
    expect(m.mapContinued, `seed ${seed}: both cities keep growing the same`).toBe(true);
    expect(m.stateContinued, `seed ${seed}: both worlds keep ticking the same`).toBe(true);
    expect(m.bytes, `seed ${seed}: the save is under 1 MB`).toBeLessThan(MAX_BYTES);
  }
});

test('M3-8: the save compacts the op log and stays exact', () => {
  for (const seed of SEEDS) {
    const m = world(seed);
    expect(m.flipOps, `seed ${seed}: the repaints were effective operations`).toBeGreaterThan(FLIPS / 2);
    expect(m.logged - m.saved, `seed ${seed}: the run is folded to its net effect`)
      .toBeGreaterThanOrEqual(m.flipOps - 4);
    expect(m.inMemory, `seed ${seed}: the live log is compacted too`).toBe(m.saved);
  }
});

test('M3-8: a version-2 save starts a new game with a one-line message, never a crash', async () => {
  const { deserialize, takeNotice, SAVE_FORMAT } = await import('../../src/sim/save.js');
  expect(SAVE_FORMAT).toBe(3);
  takeNotice();
  let out = 'unset';
  expect(() => { out = deserialize({ version: 2, seed: 7, generate: true }); }).not.toThrow();
  expect(out).toBeNull();
  const line = takeNotice();
  expect(typeof line, 'the player is told, in words').toBe('string');
  expect(line.length, 'the message is not empty').toBeGreaterThan(0);
  expect(line, 'the message is one line').not.toContain('\n');
  expect(takeNotice(), 'the notice is handed over once').toBeNull();

  // Anything that is not a save stays silent, and still never throws.
  takeNotice();
  expect(deserialize('{"version":')).toBeNull();
  expect(deserialize(null)).toBeNull();
  expect(deserialize({ version: 4, seed: 7 })).toBeNull();
  expect(takeNotice(), 'garbage is not an old save').toBeNull();
});

test('M3-8: an old save in a slot starts a new game, with the message', async () => {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  const { writeSave, loadSave, setActiveSlot } = await import('../../src/savestore.js');
  const { deserialize, takeNotice } = await import('../../src/sim/save.js');
  setActiveSlot(1);
  writeSave({ version: 2, seed: 99, generate: true, people: { list: [] } });
  const raw = loadSave();
  expect(JSON.parse(raw).seed, 'the store keeps the old save readable').toBe(99);
  takeNotice();
  expect(deserialize(raw), 'and it starts a new game').toBeNull();
  expect(takeNotice(), 'with one line about why').toBeTruthy();
});
