// M5.T17b (M5-6, docs/ROADMAP.md): the city's books run in the game and a save
// keeps them. M5.T17 built src/sim/budget.js; this proves it is wired — boot a
// generated city, let two game minutes close the books, and the money must move
// by exactly the formula's income minus upkeep — and that a save then load hands
// back the same money and the same tax rates, to the cent. A ringing fire alarm
// (M5.T14) travels with it, because save.js keeps its deadline now.
import { test, expect } from '@playwright/test';

const SEED = 7, BOOT = '/?capture=1&gen=1&seed=7', MINUTE = 60, TOL = 0.01;

// ?gen=1/?seed never touches the save (newgame.js), and a robot does not save
// either, so the city this spec continues rides in the title's pending key and
// boots behind ?savetest=1 — the same two-step tests/accept/m5-bulldoze.spec.js
// uses. The key is removed before the reload, or that boot would wipe the save.
async function bootSeed(page) {
  await page.goto(BOOT);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.evaluate((s) => localStorage.setItem('urbis.pending', JSON.stringify({ seed: s, name: 'accept' })), SEED);
  await page.goto('/?capture=1&savetest=1');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__game.seed)).toBe(SEED);
}

test('M5-6: the books close on the running game, and a save keeps them', async ({ page }) => {
  test.setTimeout(180000);
  await bootSeed(page);

  const before = await page.evaluate(() => window.__game.budget());
  expect(before.money, 'the city opens on its treasury').toBe(500);
  await page.evaluate((secs) => window.__game.advance(secs), MINUTE);
  const first = await page.evaluate(() => window.__game.budget());
  await page.evaluate((secs) => window.__game.advance(secs), MINUTE);
  const after = await page.evaluate(() => window.__game.budget());

  const earned = first.income + after.income - first.upkeep - after.upkeep;
  const moved = after.money - before.money;
  expect(first.income, 'the city taxes the floor it has').toBeGreaterThan(0);
  expect(first.upkeep, 'the city pays for its roads and services').toBeGreaterThan(0);
  expect(Math.abs(moved - earned), `money moved ${moved}, the books closed ${earned}`)
    .toBeLessThanOrEqual(Math.abs(earned) * TOL);
  console.log(`books: ${before.money} -> ${after.money} (${moved.toFixed(2)}), `
    + `income ${first.income.toFixed(2)}/${after.income.toFixed(2)}, `
    + `upkeep ${first.upkeep.toFixed(2)}/${after.upkeep.toFixed(2)}`);

  expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
  expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('urbis.save')));
  expect(saved.city.economy.budget.money, 'the save carries the money').toBe(after.money);
  await page.evaluate(() => localStorage.removeItem('urbis.pending'));
  await page.reload();
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.evaluate(() => window.__game.pause());

  const back = await page.evaluate(() => window.__game.budget());
  expect(back.money, 'the loaded city has the same money, to the cent').toBe(after.money);
  expect(back.tax, 'the loaded city has the same tax rates').toEqual(after.tax);
  expect(back.income).toBe(after.income);
  expect(back.upkeep).toBe(after.upkeep);
});

// The fire alarm (M5.T14) is a deadline on the parcel, so it survives only if
// save.js keeps the field: Node only, on the sim main.js boots, in one process.
test('M5.T14: a ringing alarm survives a save', async () => {
  // The world seed is module state this worker shares with every test file
  // after it (one worker under GATE_FULL), and worldMap() memoises its first
  // call, so touching the seed here would hand those files this city. Cache
  // the map this run opened on, seed seed 7's, and put the seed back.
  const { setWorldSeed, worldSeed } = await import('../../src/sim/seedstore.js');
  const { worldMap } = await import('../../src/sim/patrol.js');
  const opened = worldSeed();
  worldMap();
  setWorldSeed(SEED, true);
  try {
    await ringAndLoad();
  } finally {
    setWorldSeed(opened.seed, opened.generate);
  }
});

async function ringAndLoad() {
  const [
    { createMap }, { serialize, deserialize }, { createCity },
    { createClock }, { createStreet }, { createPlayer }, { createPlayerCar },
    { createInterior }, { createMission }, { createPeople }, { raiseAlarm, alarmLeft },
  ] = await Promise.all([
    import('../../src/sim/map.js'), import('../../src/sim/save.js'), import('../../src/sim/zoning.js'),
    import('../../src/sim/clock.js'), import('../../src/sim/street.js'), import('../../src/sim/player.js'),
    import('../../src/sim/vehicle.js'), import('../../src/sim/interior.js'), import('../../src/sim/mission.js'),
    import('../../src/sim/people.js'), import('../../src/sim/alarms.js'),
  ]);
  const map = createMap(SEED), city = createCity(SEED, map);
  const game = {
    seed: SEED, generate: true, map, clock: createClock(), street: createStreet(SEED, map), city,
    player: createPlayer(map), car: createPlayerCar(map), interior: createInterior(),
    mission: createMission(), people: createPeople(SEED),
  };
  // A standing building, not a lot: only a standing one can have an alarm. The
  // map's own parcel list is every building and lot, the one a service's
  // catchment is measured over.
  const standing = city.standing.find((p) => p.kind !== 'lot');
  expect(standing, 'the generated city has standing buildings').toBeTruthy();
  const secs = raiseAlarm(map.parcels, standing, 30);
  expect(secs, 'the alarm was raised').toBeGreaterThan(0);
  expect(alarmLeft(standing, 30)).toBe(secs);

  const data = JSON.stringify(serialize(game));
  const back = deserialize(data);
  expect(back, 'the save loads').toBeTruthy();
  const parcel = back.city.standing.find((p) => p.id === standing.id);
  expect(parcel, 'the same building came back').toBeTruthy();
  expect(parcel.alarmUntil, 'the alarm rings after the load').toBe(standing.alarmUntil);
  expect(alarmLeft(parcel, 30), 'with the same seconds left').toBe(secs);
  // The field is plain data, so a save that never had an alarm still loads.
  const plain = JSON.parse(data);
  for (const p of [...plain.city.parcels, ...plain.city.standing]) delete p.alarmUntil;
  const older = deserialize(JSON.stringify(plain));
  expect(older, 'a save with no alarms still loads').toBeTruthy();
  expect(older.city.standing.find((p) => p.id === standing.id).alarmUntil).toBeUndefined();
}
