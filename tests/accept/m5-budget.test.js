// M5-6 (docs/ROADMAP.md) — the city's books (M5.T17, src/sim/budget.js):
// income and upkeep match the formula they are stated with, every game minute;
// ten more points on the homes tax lowers home demand against the same city
// untaxed; and a budget in the red shuts the service it cannot pay for — the
// farthest police station first, inside 60 game seconds — and the news says so.
//
// Node only, one seed per process (m5-clinic.test.js's worker shape): the worker
// builds every world the way main.js builds one — the seed's map, a street, a
// city and its people — and steps them by the frame loop's own 50 ms, in main's
// order. The expected numbers are recomputed here from the world, not read back
// from the budget: the tax the books hold, the floor area each use stands on,
// the metres of road and the services that stand. Only the stated constants
// (TAX_POINT, ROAD_PER_METRE, SERVICE_UPKEEP) come from the module, the way
// m5-clinic.test.js takes wealthRiseSecs from probeConstants().
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SERVICE_UPKEEP } from '../../src/sim/budget.js';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const USES = ['res', 'com', 'ind'];
const SECS_PER_MIN = 60;
// Game minutes the formula world runs: a quiet opening, then a service placed,
// so the per-service upkeep is a measured step and not a corner case.
const MINUTES = 4;
// How long the tax A/B runs after the homes tax moves: several market lags, so
// the demand the lots read has caught up with the price the tax sets.
const TAX_SECS = 300;
// The criterion's own window, and how long the books are given to go red.
const SHUT_WITHIN = 60;
const RED_WAIT = 360;
// Ten points, and the demand cost the task names.
const POINTS = 10;
const DROP = 0.02;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { builtHeight, createCity, tickZoning } = await import('../../src/sim/zoning.js');
  const { createStreet, tickStreet } = await import('../../src/sim/street.js');
  const { createPeople, tickPeople } = await import('../../src/sim/people.js');
  const { createNews, liveNews, tickNews } = await import('../../src/sim/news.js');
  const { placeService } = await import('../../src/sim/ops.js');
  const { cityDemand, tickEconomy } = await import('../../src/sim/economy.js');
  const {
    ROAD_PER_METRE, SERVICE_UPKEEP, TAX_POINT, budgetReport, raiseTax, setTax,
  } = await import('../../src/sim/budget.js');

  function world() {
    const map = createMap(seed);
    const street = createStreet(seed, map);
    const city = createCity(seed, map);
    return { map, street, city, people: createPeople(seed), news: createNews() };
  }

  // main.js's order: street, city (which ticks the economy), people, news.
  function step(w, dt) {
    tickStreet(w.street, dt);
    tickZoning(w.city, dt, w.street);
    tickPeople(w.people, w.city);
    tickNews(w.news, w.city, w.people, w.street);
  }

  function run(w, secs, each = () => {}) {
    for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
      step(w, DT);
      each(w);
    }
  }

  // The formula, recomputed from the world: floor area per use in m², the
  // metres of road in the graph, and the services that stand. The books close
  // on the whole storeys a parcel stands at (budget.js floorAreas), and they
  // close inside the city's tick, ahead of the lots' own growth (zoning.js
  // updateDemand runs before the parcels), so the frame they close on is
  // measured at its opening heights.
  const heightsAt = (map) => map.parcels.map((p) => p.heights[p.stage]);
  const areaOf = (map, heights) => Object.fromEntries(USES.map((use) => [use, map.parcels
    .reduce((sum, p, i) => (p.use === use ? sum + heights[i] * p.w * p.d : sum), 0)]));
  const metresOf = (map) => {
    const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
    return map.graph.edges.reduce((sum, e) => {
      const [a, b] = [byId.get(e.a), byId.get(e.b)];
      return sum + Math.hypot(a.x - b.x, a.z - b.z);
    }, 0);
  };
  const servicesOf = (map) => map.parcels.filter((p) => p.kind === 'service');
  // A shut service is not running, so it is not charged for.
  const runningOf = (map) => servicesOf(map).filter((p) => !p.shut);
  const want = (map, heights, tax) => ({
    income: USES.reduce((sum, use) => sum + tax[use] * TAX_POINT * areaOf(map, heights)[use], 0),
    upkeep: ROAD_PER_METRE * metresOf(map) + SERVICE_UPKEEP * runningOf(map).length,
  });

  const empties = (map) => map.parcels
    .filter((p) => p.kind === 'lot' && p.stage === STAGE.EMPTY);

  // 1. The books, minute by minute, against the formula recomputed here.
  const f = world();
  const formula = [];
  const start = f.city.economy.budget.money;
  let due = 0;
  let placed = false;
  for (let i = 0, frames = Math.round(MINUTES * SECS_PER_MIN / DT); i < frames; i++) {
    const opening = heightsAt(f.map);
    step(f, DT);
    const b = f.city.economy.budget;
    const closed = due > 1 && b.due < 1;
    due = b.due;
    if (!closed) continue;
    formula.push({
      minute: formula.length + 1,
      income: b.income, upkeep: b.upkeep, money: b.money,
      tax: { ...b.tax }, area: areaOf(f.map, opening),
      services: runningOf(f.map).length,
      want: want(f.map, opening, b.tax),
    });
    // A service stands from the third minute on, so the per-service upkeep is
    // measured as a step in the same city.
    if (!placed) {
      placed = true;
      placeService(f.map, empties(f.map)[0], 'police');
    }
  }

  // 2. A against B: B raises the homes tax by ten points at the first minute.
  // The lots are held still and the standing buildings stand, so the demand that
  // moves from here is the tax and nothing else — tests/economy.spec.js's
  // marketWith instrument, as m5-clinic.test.js uses it. A live city answers
  // the same bite by building fewer homes, which is the floor and not the want.
  const flat = (p) => (p.kind === 'lot' ? 0 : builtHeight(p));
  const market = (w) => {
    tickStreet(w.street, DT);
    tickEconomy(w.city.economy, w.city.parcels, flat, w.street, DT);
  };
  function runMarket(w, secs) {
    for (let i = 0, n = Math.round(secs / DT); i < n; i++) market(w);
  }
  const a = world();
  const b2 = world();
  const books = { base: [], poked: [] };
  runMarket(a, SECS_PER_MIN);
  runMarket(b2, SECS_PER_MIN);
  raiseTax(b2.city.economy.budget, 'res', POINTS);
  for (let minute = 0; minute < TAX_SECS / SECS_PER_MIN; minute++) {
    runMarket(a, SECS_PER_MIN);
    runMarket(b2, SECS_PER_MIN);
    for (const [w, rows] of [[a, books.base], [b2, books.poked]]) {
      rows.push({ ...budgetReport(w.city.economy.budget) });
    }
  }
  const tax = {
    minutes: books.base.length,
    base: { demand: cityDemand(a.city.economy).res, money: a.city.economy.budget.money },
    poked: { demand: cityDemand(b2.city.economy).res, money: b2.city.economy.budget.money },
    books, points: b2.city.economy.budget.tax.res - a.city.economy.budget.tax.res,
  };

  // 3. The red: two police stations, the taxes cut to nothing, and the news
  // watched from the first frame — the shut is timed from the books going red,
  // so the watching starts before they do.
  const d = world();
  const spawn = d.map.spawn.player;
  const out = (p) => Math.hypot(p.x - spawn.x, p.z - spawn.z);
  const [near, far] = [empties(d.map).reduce((x, y) => (out(x) <= out(y) ? x : y)),
    empties(d.map).reduce((x, y) => (out(x) >= out(y) ? x : y))];
  placeService(d.map, near, 'police');
  placeService(d.map, far, 'police');
  for (const use of USES) setTax(d.city.economy.budget, use, 0);
  const seen = new Set();
  let redAt = null;
  let farAt = null;
  let nearAt = null;
  let nearOpenWhenFarShut = null;
  const watch = (w) => {
    if (redAt === null && w.city.economy.budget.debt) redAt = w.street.time;
    if (farAt === null && far.shut) {
      farAt = w.street.time;
      nearOpenWhenFarShut = !near.shut;
    }
    if (nearAt === null && near.shut) nearAt = w.street.time;
    for (const text of liveNews(w.news, w.street.time)) seen.add(text);
  };
  // Long enough for the books to go red and the window to play out after it.
  run(d, RED_WAIT, watch);
  run(d, SHUT_WITHIN, watch);
  const debt = {
    redAt, farAt, nearAt, nearOpenWhenFarShut,
    secondsToFarShut: farAt === null || redAt === null ? null : farAt - redAt,
    gap: nearAt === null || farAt === null ? null : nearAt - farAt,
    near: { id: near.id, dist: out(near) }, far: { id: far.id, dist: out(far) },
    news: [...seen],
  };

  process.stdout.write(`${JSON.stringify({
    seed, start, formula, tax, debt,
  })}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(300000);
const ROWS = new Map();
for (const seed of SEEDS) {
  test(`M5-6 seed ${seed}: the books`, () => {
    ROWS.set(seed, row(seed));
    expect(ROWS.get(seed).formula.length).toBe(MINUTES);
  });
}

for (const seed of SEEDS) {
  test(`M5-6 seed ${seed}: income and upkeep are the stated formula every game minute`, () => {
    const r = ROWS.get(seed) ?? row(seed);
    let net = 0;
    for (const m of r.formula) {
      expect(m.income, `seed ${seed} minute ${m.minute}: income is the tax over the floor area each use stands on — ${JSON.stringify({ tax: m.tax, area: m.area })}`)
        .toBeCloseTo(m.want.income, 4);
      expect(m.upkeep, `seed ${seed} minute ${m.minute}: upkeep is the road metres plus the services that stand`)
        .toBeCloseTo(m.want.upkeep, 4);
      net += m.income - m.upkeep;
    }
    // The money is the sum of the minutes, and nothing else moves it.
    const last = r.formula[r.formula.length - 1];
    expect(last.money - r.start, `seed ${seed}: the money is the minutes' net and nothing else`).toBeCloseTo(net, 4);
    // The per-service upkeep is a measured step in the same city: the minute a
    // station stands costs exactly one service's upkeep more than the one before.
    const before = r.formula[0];
    const after = r.formula[1];
    expect(before.services, `seed ${seed}: the city opens with no services of its own`).toBe(0);
    expect(after.services, `seed ${seed}: a police station stands from the next minute`).toBe(1);
    expect(after.upkeep - before.upkeep, `seed ${seed}: one service's upkeep is SERVICE_UPKEEP`)
      .toBeCloseTo(SERVICE_UPKEEP, 4);
  });
}

for (const seed of SEEDS) {
  test(`M5-6 seed ${seed}: ten more points on the homes tax lowers home demand`, () => {
    const r = ROWS.get(seed) ?? row(seed);
    const { tax } = r;
    expect(tax.points, `seed ${seed}: B's homes tax is ten points up`).toBe(POINTS);
    // The richer city wants homes less: the demand the lots read has chased the
    // price the tax set down by more than the ten points cost.
    expect(tax.poked.demand, `seed ${seed}: with the tax at ${tax.poked.demand.toFixed(3)} against an untaxed ${tax.base.demand.toFixed(3)}`)
      .toBeLessThan(tax.base.demand - DROP);
    // And the books say why: the extra points earn exactly what the extra floor
    // area is worth, minute by minute, with the upkeep unchanged.
    let earned = 0;
    for (let i = 0; i < tax.minutes; i++) {
      earned += (tax.books.poked[i].income - tax.books.base[i].income)
        - (tax.books.poked[i].upkeep - tax.books.base[i].upkeep);
    }
    expect(tax.poked.money - tax.base.money, `seed ${seed}: the ten points earn the floor they tax`)
      .toBeCloseTo(earned, 4);
  });
}

for (const seed of SEEDS) {
  test(`M5-6 seed ${seed}: in debt the farthest police station shuts within 60 game seconds and the news says so`, () => {
    const r = ROWS.get(seed) ?? row(seed);
    const { debt } = r;
    expect(debt.redAt, `seed ${seed}: the books go red inside ${RED_WAIT}s with the taxes cut`).not.toBeNull();
    expect(debt.far.dist, `seed ${seed}: the shut station is the one ${Math.round(debt.far.dist)}m out, against the nearer at ${Math.round(debt.near.dist)}m`)
      .toBeGreaterThan(debt.near.dist);
    expect(debt.farAt, `seed ${seed}: the farthest police station shuts once the books are red`).not.toBeNull();
    expect(debt.secondsToFarShut, `seed ${seed}: it shuts ${debt.secondsToFarShut.toFixed(1)}s after the books go red`)
      .toBeLessThanOrEqual(SHUT_WITHIN);
    // Farthest first, not both at once: the nearer one is still standing when
    // the farthest goes, and a full minute passes before it follows.
    expect(debt.nearOpenWhenFarShut, `seed ${seed}: the nearer station is still open when the farthest shuts`).toBe(true);
    expect(debt.gap, `seed ${seed}: the nearer station follows ${debt.gap.toFixed(1)}s later, not at once`)
      .toBeGreaterThanOrEqual(SHUT_WITHIN - 1);
    const line = debt.news.find((t) => /police station/i.test(t) && /debt/i.test(t));
    expect(line, `seed ${seed}: the news names the station and the debt — it said: ${debt.news.join(' | ')}`)
      .toBeTruthy();
  });
}
