// The city's books (M5-6, M5.T17): what the city earns, what it costs to run,
// and what it cannot pay for. The economy ticks them — tickEconomy, one call a
// frame — and the city view and the probe read them (budgetReport).
//
// The formula, in full; this is the whole model:
//
//   income = Σ over uses of tax[use] × floorArea[use]        per game minute
//   upkeep = ROAD_PER_METRE × roadMetres
//          + SERVICE_UPKEEP × services still running        per game minute
//   money += income − upkeep, once a game minute
//
// `tax[use]` is in points and one point is TAX_POINT credits per m² of floor
// per game minute, so the homes at 12 points over 40,000 m² of flats earn about
// 190 credits a minute. `floorArea[use]` is every standing floor of that use —
// the map's fixed buildings and the lots that have grown — so a building that
// rises is taxed more. Road metres are the graph's edges, live, so a road the
// player lays is charged for from the next minute. A service that is shut is not
// running and costs nothing: that is the whole point of shutting it.
//
// A tax is a price on a use, so it is felt where that use is wanted: each point
// costs the use TAX_DEMAND of demand (economy.js price). Ten points on the
// homes is 0.025 — a third of a band edge, enough to read, not enough to slam a
// district idle. The price alone moves; the need and the have are what the city
// has built, not what it is charged.
//
// In the red the city stops paying for what it cannot: services shut, the
// police first and within them the farthest from the player's spawn
// (map.spawn) first, one a game minute after the first. They come back one a
// game minute when the books can hold RESERVE_MINUTES of a service's upkeep in
// hand, the nearest to the spawn first — the one that covers the most. The news
// says both (news.js).
//
// Pure (law 5): no three.js, no DOM, and no RNG — the books are arithmetic on
// state, so a save holds them and a replay runs them again. The map they
// measure is held weakly beside them, the way economy.js holds its market, so
// a state hash never walks one.
const EPS = 1e-9;

// Game seconds between two closings of the books.
export const GAME_MINUTE = 60;
// The tax rates a new city opens with, in points.
export const TAX_OPEN = { res: 12, com: 12, ind: 12 };
export const TAX_MAX = 30;
// Credits one point of tax earns per m² of floor per game minute.
export const TAX_POINT = 0.0004;
// Demand one point of tax costs the use it taxes.
export const TAX_DEMAND = 0.0025;
// The treasury a new city opens with: about a minute of the opening city's
// upkeep, so a city that never raises a tax has a few minutes before the books
// go red and a city that does never notices.
export const START_MONEY = 500;
// Upkeep per metre of road per game minute.
export const ROAD_PER_METRE = 0.02;
// Upkeep per running service per game minute.
export const SERVICE_UPKEEP = 25;
// Minutes of a service's upkeep the books must hold before it reopens.
export const RESERVE_MINUTES = 5;
// Game seconds between two services changing hands.
export const SHUT_SECS = 60;

// The map each set of books measures, held weakly: the budget itself stays
// plain data, so a save or a state hash never reaches a map through it.
const MAPS = new WeakMap();

export function createBudget(map, money = START_MONEY) {
  const budget = {
    time: 0,
    // Game seconds counted toward the next closing of the books.
    due: 0,
    money,
    tax: { ...TAX_OPEN },
    // The last game minute's figures: what the panel shows between closings.
    income: 0,
    upkeep: 0,
    debt: false,
    wasDebt: false,
    // How many services stand shut, and when one last changed hands. `since` is
    // −1 while a red spell has shut nothing yet, so the first one goes at once.
    closed: 0,
    since: -1,
    // The last shut and the last reopening, a new object each time so the news
    // can diff them by identity (news.js snapshot), carrying what a line needs.
    lastShut: null,
    lastBack: null,
  };
  MAPS.set(budget, map);
  return budget;
}

// A tax in points, clamped to what a city can set. Returns the rate the use
// landed on, so a tool can show what it asked for; a use the city does not tax
// (there is no such rate) is refused and reports nothing.
export function setTax(budget, use, points) {
  if (use in budget.tax) budget.tax[use] = Math.max(0, Math.min(TAX_MAX, Math.round(points)));
  return budget.tax[use];
}

export function raiseTax(budget, use, points) {
  return setTax(budget, use, budget.tax[use] + points);
}

// The services that stand, and the ones still running. A shut service keeps
// its building — the city has closed its doors, not knocked them down (M12-6
// extends this to plants, pumps and depots).
const servicesOf = (parcels) => (parcels ?? []).filter((p) => p.kind === 'service');
const runningOf = (parcels) => servicesOf(parcels).filter((p) => !p.shut);

// Floor area per use, in m², over the city's whole parcel list: every building
// that stands, the map's own and the lots that have grown. The floor a parcel
// stands at is its own stage's height — the books are closed on whole storeys,
// so a building is taxed for what it stands at and not for the crane's fraction
// of the next one, and the measure is the map's own rather than a height
// function the caller happens to pass in.
function floorAreas(parcels) {
  const area = { res: 0, com: 0, ind: 0 };
  for (const p of parcels ?? []) {
    if (p.use in area) area[p.use] += p.heights[p.stage] * p.w * p.d;
  }
  return area;
}

// Every edge of the graph, end to end: the road the city maintains.
function roadMetres(map) {
  const edges = map?.graph?.edges ?? [];
  const byId = new Map((map?.graph?.nodes ?? []).map((n) => [n.id, n]));
  return edges.reduce((sum, e) => {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    return a && b ? sum + Math.hypot(a.x - b.x, a.z - b.z) : sum;
  }, 0);
}

// One game minute of the books: the formula over the city as it stands, applied
// to the money. Debt is the money being under nothing at all, and a spell that
// has just gone red shuts its first service at once.
function closeBooks(budget, parcels) {
  const area = floorAreas(parcels);
  // The tax in credits per m²: the points the city has set, at TAX_POINT each.
  const rate = (use) => budget.tax[use] * TAX_POINT;
  budget.income = Object.keys(budget.tax).reduce((sum, use) => sum + rate(use) * area[use], 0);
  budget.upkeep = ROAD_PER_METRE * roadMetres(MAPS.get(budget))
    + SERVICE_UPKEEP * runningOf(parcels).length;
  budget.money += budget.income - budget.upkeep;
  budget.debt = budget.money < 0;
  if (budget.debt && !budget.wasDebt) budget.since = -1;
  budget.wasDebt = budget.debt;
}

// Where the city's centre is taken to be: the player's spawn, the map's own
// downtown, so "farthest" is the fringe of the city and not an arbitrary 0,0.
function centre(budget) {
  return MAPS.get(budget)?.spawn?.player ?? { x: 0, z: 0 };
}

const out = (p, c) => Math.hypot(p.x - c.x, p.z - c.z);
const isPolice = (p) => Number(p.type === 'police');

// The next service the red takes: the police before anything else — the one
// promise a city in trouble keeps longest — and within a kind the farthest from
// the centre first, the outer cover being the cheapest to lose.
function nextToShut(budget, open) {
  const c = centre(budget);
  return [...open].sort((a, b) => isPolice(b) - isPolice(a) || out(b, c) - out(a, c))[0];
}

// The service the black brings back: the nearest the centre, because that is
// the one whose catchment answers the most buildings for the same upkeep.
function nextToReopen(budget, shut) {
  const c = centre(budget);
  return [...shut].sort((a, b) => out(a, c) - out(b, c))[0];
}

function shut(budget, p) {
  p.shut = true;
  budget.since = budget.time;
  budget.lastShut = { id: p.id, type: p.type, x: p.x, z: p.z, at: budget.time };
}

function reopen(budget, p) {
  delete p.shut;
  budget.since = budget.time;
  budget.lastBack = { id: p.id, type: p.type, x: p.x, z: p.z, at: budget.time };
}

// What the red takes and what the black gives back, at one change a game
// minute. `closed` is recounted from the map every time, so a service the
// player bulldozes while it is shut straightens the count out.
function tuneServices(budget, parcels) {
  const all = servicesOf(parcels);
  const open = all.filter((p) => !p.shut);
  const shutList = all.filter((p) => p.shut);
  budget.closed = shutList.length;
  if (open.length === 0 && shutList.length === 0) return;
  const rested = budget.since >= 0 && budget.time - budget.since < SHUT_SECS;
  if (budget.debt) {
    if (open.length > 0 && !rested) shut(budget, nextToShut(budget, open));
    return;
  }
  if (shutList.length > 0 && !rested && budget.money >= SERVICE_UPKEEP * RESERVE_MINUTES) {
    reopen(budget, nextToReopen(budget, shutList));
  }
}

// One step of the books: the game minute counted, closed when it is whole, and
// the services answered whenever the city is in the red or has one shut. A
// healthy city with everything running only ever counts its seconds.
export function tickBudget(budget, parcels, dt) {
  budget.time += dt;
  budget.due += dt;
  if (budget.due + EPS >= GAME_MINUTE) {
    budget.due = 0;
    closeBooks(budget, parcels);
  }
  if (budget.debt || budget.closed > 0) tuneServices(budget, parcels);
}

// Plain numbers for the panel and the probe (law 6): nothing in it is live
// state, and the panel rounds what it draws.
export function budgetReport(budget) {
  return {
    money: budget.money,
    tax: { ...budget.tax },
    income: budget.income,
    upkeep: budget.upkeep,
    net: budget.income - budget.upkeep,
    debt: budget.debt,
    closed: budget.closed,
    due: budget.due,
  };
}
