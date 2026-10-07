// M5-5 police station (M5.T13): A/B. A crime inside a station's 100 m
// catchment is reached by a responding cruiser at least 30% faster than the
// same crime answered with no station; a station more than 100 m away changes
// nothing. Node only, one seed per process (m5-noroad.test.js's worker shape):
// the station is an ops.js parcel on an empty lot, the effect is wanted.js
// syncUnits' start point.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const HUNT_CAP = 60;
// The car's own close-in range (wanted.js drive): this close is reached.
const REACH = 6;
const CATCHMENT = 100;
const FASTER = 0.7;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, STAGE, edgesNear } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createWanted, forceTier, tickWanted } = await import('../../src/sim/wanted.js');
  const { placeService } = await import('../../src/sim/ops.js');
  const { spawnNode, aheadOnRoad } = await import('../../src/sim/patrol.js');

  // One fresh world the way main.js builds one: the seed's map and the city's
  // own parcels in it.
  function world() {
    const map = createMap(seed);
    createCity(seed, map);
    return map;
  }
  const empties = (map) => map.parcels.filter((p) => p.kind === 'lot' && p.stage === STAGE.EMPTY);
  const homeOf = (map, lot) => spawnNode(lot.x, lot.z, 0, [], map);

  // Tick one heat-1 chase with the suspect standing at the crime; returns the
  // first time a responding cruiser is within REACH of it, or null. `from`
  // puts the cruiser where a station would have started it.
  function reachTime(map, at, from) {
    const w = createWanted(map);
    const car = { x: at.x, z: at.z, yaw: 0, speed: 0, flat: 0 };
    const hero = {
      x: at.x, z: at.z, yaw: 0, inCar: false, car,
      body: { x: at.x, z: at.z, yaw: 0 }, cover: false, night: 1,
    };
    forceTier(w, 1, hero, 0, map);
    if (from) {
      Object.assign(w.pursuit[0], { x: from.x, z: from.z, yaw: Math.atan2(at.x - from.x, at.z - from.z), speed: 0 });
    }
    for (let t = DT; t <= HUNT_CAP; t += DT) {
      tickWanted(w, DT, hero, t, map);
      const near = w.pursuit
        .filter((u) => u.active && !u.leaving)
        .map((u) => Math.hypot(u.x - at.x, u.z - at.z));
      if (near.length && Math.min(...near) <= REACH) return +t.toFixed(6);
    }
    return null;
  }

  // A fair scene per seed: an empty lot for the station, then a crime 25–50 m
  // down the road from the station's own street node — inside the 100 m
  // catchment and on pavement a standing suspect can be found from — and a far
  // empty lot for the out-of-catchment control. The station's shorter start
  // must clear the 30% bar in the preview, or the next point (then the next
  // lot) is tried.
  function pickScene(map) {
    const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
    for (const lot of empties(map)) {
      const home = homeOf(map, lot);
      const { edge } = edgesNear(map, home.x, home.z)[0];
      for (const end of [byId.get(edge.a), byId.get(edge.b)]) {
        const yaw = Math.atan2(end.x - home.x, end.z - home.z);
        for (const want of [45, 35, 25, 50]) {
          const spot = aheadOnRoad(home.x, home.z, yaw, want, map);
          const crime = { x: spot.x, z: spot.z };
          if (Math.hypot(crime.x - home.x, crime.z - home.z) < 20) continue;
          if (Math.hypot(crime.x - lot.x, crime.z - lot.z) > CATCHMENT) continue;
          const est = reachTime(map, crime, home);
          if (est === null) continue;
          const base = reachTime(map, crime);
          if (base === null || est > base * FASTER) continue;
          const far = empties(map).find((p) => Math.hypot(p.x - crime.x, p.z - crime.z) > CATCHMENT);
          if (!far) continue;
          return { lot, home, crime, base, far };
        }
      }
    }
    throw new Error(`seed ${seed}: no fair scene`);
  }

  const a = world();
  const { lot, home, crime, far } = pickScene(a);
  const base = reachTime(a, crime);

  const b = world();
  placeService(b, lot.id, 'police');
  const station = reachTime(b, crime);

  const c = world();
  placeService(c, far.id, 'police');
  const out = reachTime(c, crime);

  const distTo = (p) => Math.hypot(p.x - crime.x, p.z - crime.z);
  process.stdout.write(`${JSON.stringify({
    seed, crimeDist: distTo(lot), homeDist: distTo(home), farDist: distTo(far),
    crime: { x: crime.x, z: crime.z }, base, station, far: out,
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
  test(`M5-5 police station seed ${seed}: a crime in the catchment is answered at least 30% faster`, () => {
    const r = row(seed);
    expect(r.crimeDist, `seed ${seed}: the crime stands inside the station's catchment`).toBeLessThanOrEqual(CATCHMENT);
    expect(r.homeDist, `seed ${seed}: the station's cruiser has a real drive to make`).toBeGreaterThanOrEqual(20);
    expect(r.base, `seed ${seed}: the control has ground to cover`).toBeGreaterThan(2);
    expect(r.station, `seed ${seed}: the station answers the crime at least 30% faster`)
      .toBeLessThanOrEqual(r.base * FASTER);
    expect(r.farDist, `seed ${seed}: the far station is outside the catchment`).toBeGreaterThan(CATCHMENT);
    expect(r.far, `seed ${seed}: a station out of reach changes nothing`).toBeCloseTo(r.base, 9);
  });
}
