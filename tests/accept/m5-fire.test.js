// M5-5 fire alarm and fire station (M5.T14, docs/ROADMAP.md): A/B. A
// building's fire alarm clears in half the time when a fire station stands
// within the station's 300 m catchment (SERVICES.fire.radius, docs/CITYVIEW.md),
// and runs its full course with no station. Node only, one seed per process
// (m5-noroad.test.js's worker shape): the station is an ops.js service parcel
// on an empty lot, the alarm a deadline on the building (sim/alarms.js).
//
// There is no out-of-reach arm here: today's generated town spans 219-263 m
// corner to corner, under the station's 300 m catchment, so every parcel is in
// reach and a far station cannot be placed. Reach is tied to the real service
// machinery instead — the alarmed building stands inside
// SERVICES.fire.radius of the station and is one of the parcels ops.js
// serviceReach assigns it (the catchment-with-capacity rule of M5-5).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const CATCHMENT = 300;
const CAP = 60;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { placeService, servicesOf, serviceReach, hasBuilding, SERVICES } =
    await import('../../src/sim/ops.js');
  const { raiseAlarm, alarmOn, ALARM_SECS } = await import('../../src/sim/alarms.js');

  // One fresh world the way main.js builds one: the seed's map and the city's
  // own lots in it, with the standing buildings among the map's parcels.
  function world() {
    const map = createMap(seed);
    createCity(seed, map);
    return map;
  }
  const byId = (map, id) => map.parcels.find((p) => p.id === id);
  const stands = (map) => map.parcels.filter(hasBuilding);
  const empties = (map) => map.parcels.filter((p) => p.kind === 'lot' && p.stage === STAGE.EMPTY);

  // Set one alarm off at time 0 and step it until it clears: what was set and
  // how long the building actually rang for. `mid` is the alarm mid-ring, so a
  // deadline of 0 cannot pass as "cleared immediately".
  function run(map, id) {
    const p = byId(map, id);
    const set = raiseAlarm(map.parcels, p, 0);
    let t = 0;
    while (alarmOn(p, t)) {
      t += DT;
      if (t > set + CAP) throw new Error(`seed ${seed}: alarm on ${id} never cleared`);
    }
    return { set, mid: alarmOn(p, set / 2), cleared: t };
  }

  // The scene: an empty lot with a standing building inside the station's
  // catchment to alarm — the nearest one, so the station serves it first.
  function pickScene(map) {
    const buildings = stands(map);
    const gap = (p, lot) => Math.hypot(p.x - lot.x, p.z - lot.z);
    const lot = empties(map)
      .find((l) => buildings.some((b) => gap(b, l) > 0 && gap(b, l) <= CATCHMENT));
    if (!lot) throw new Error(`seed ${seed}: no empty lot has a building in the catchment`);
    const target = buildings
      .filter((b) => gap(b, lot) > 0 && gap(b, lot) <= CATCHMENT)
      .sort((p, q) => gap(p, lot) - gap(q, lot))[0];
    return { lot, target, targetDist: gap(target, lot) };
  }

  const a = world();
  const { lot, target, targetDist } = pickScene(a);
  const full = run(a, target.id);

  const b = world();
  placeService(b, lot.id, 'fire');
  const half = run(b, target.id);

  const refused = raiseAlarm(a.parcels, lot, 0);
  process.stdout.write(`${JSON.stringify({
    seed, targetDist, full, half, refused, alarmSecs: ALARM_SECS,
    radius: SERVICES.fire.radius,
    station: servicesOf(b.parcels, 'fire').filter((p) => p.id === lot.id).length,
    served: serviceReach(b.parcels, 'fire').has(byId(b, target.id)),
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
  test(`M5-5 fire alarm seed ${seed}: a station in the catchment clears an alarm in half the time`, () => {
    const r = row(seed);
    expect(r.radius, `seed ${seed}: the catchment is the documented 300 m`).toBe(CATCHMENT);
    expect(r.station, `seed ${seed}: the fire station stands on the empty lot`).toBe(1);
    expect(r.targetDist, `seed ${seed}: the alarmed building is inside the 300 m catchment`)
      .toBeGreaterThan(0);
    expect(r.targetDist, `seed ${seed}: the alarmed building is inside the 300 m catchment`)
      .toBeLessThanOrEqual(CATCHMENT);
    expect(r.served, `seed ${seed}: the alarm is in the station's serviceReach`).toBe(true);
    expect(r.refused, `seed ${seed}: an empty lot holds no alarm`).toBe(0);
    expect(r.full.set, `seed ${seed}: with no station the alarm runs its full course`)
      .toBeCloseTo(r.alarmSecs, 9);
    expect(r.half.set, `seed ${seed}: a station in reach halves the alarm`)
      .toBeCloseTo(r.full.set / 2, 9);
    for (const [name, m] of [['no station', r.full], ['station', r.half]]) {
      expect(m.mid, `seed ${seed}: the ${name} alarm rings mid-way`).toBe(true);
      expect(m.cleared, `seed ${seed}: the ${name} alarm rings to its deadline`).toBeGreaterThanOrEqual(m.set - 1e-9);
      expect(m.cleared, `seed ${seed}: the ${name} alarm stops within a step of it`).toBeLessThan(m.set + DT + 1e-9);
    }
  });
}
