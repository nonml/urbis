// The district economy: jobs, homes and wealth in each district, and the demand
// for each use they add up to. What grows on the lots feeds it, and it decides
// what grows next. The loop and every number here are argued in docs/ECONOMY.md.
// Pure: zoning ticks it, render and the probe read it (law 5).
import { isDark } from './street.js';

// A district is a power zone (zoneAt in street.js): the grid is what a player
// can cut, so it is the unit a consequence lands on. Indexed by zone.
export const DISTRICTS = ['south', 'north'];
const USES = ['res', 'com', 'ind'];

// A resident or a worker for every 25 m² of floor, on the 3.5 m storey the lots
// build to — a finished lot holds 20 to 120 people.
export const M3_PER_PERSON = 25 * 3.5;
// The towers a district already stood in before any lot broke ground: this many
// residents per m² of its lot land, about what the lots hold at full build. It
// is balanced — as many jobs as homes, shops for its spending, workshops for its
// shops — so everything the lots add is the margin that moves.
const ESTABLISHED_PER_LOT_M2 = 0.4;

// What the district needs of each use, per unit of what drives it. Every job
// on the lots wants a home; residents' spending keeps about a third as many
// people busy in shops; trading shops keep two in five of theirs again in
// workshops supplying them.
const COMMERCE_PER_HOME = 0.35;
const INDUSTRY_PER_COMMERCE = 0.4;

// Firms from beyond the map looking for floor in the district — offices want
// commercial floor, works want industrial — in the jobs they would bring. One
// moves in or out every half-minute to minute and a bit, lot-sized, and the odds
// lean back toward the usual level, so the district wanders but never drifts.
// This is the market the city cannot control, and why it never settles.
const FIRMS_USUAL = 0.12;
const FIRM_MIN = 0.06;
const FIRM_MAX = 0.15;
const FIRMS_PULL = 4;
const MOVE_MIN_SECS = 25;
const MOVE_MAX_SECS = 70;
const MOVE_ODDS_FLOOR = 0.15;
// The district arrives with this many times the usual firms queuing for floor:
// the boom the city starts building into.
const BOOT_FIRMS = 2;

// Demand is the balance plus the unmet need, as a share of the district. At
// BALANCED a lot neither starts nor sheds work (zoning's hold band); GAP_GAIN is
// how hard a shortage or a glut of one tenth of the district pushes off it.
const BALANCED = 0.36;
const GAP_GAIN = 3;
// The market reads the district late: developers build on the last twenty
// seconds' numbers, not today's. So a boom overshoots into a glut and a glut
// into a shortage, and the district cycles instead of parking at a balance.
const MARKET_LAG_SECS = 20;

// Wealth is the district's spending power, 0..1, chasing its employment. Pay
// comes back slower than it goes, and a dark district trades nothing: a full
// blackout drains about a seventh of it, which takes half a minute to earn back.
const WEALTH_RISE_SECS = 25;
const WEALTH_FALL_SECS = 15;
const DARK_DRAIN_SECS = 60;

// A firm that sat through a power cut gives up on the district (milestone 4: a
// poke sets off a chain the player can watch, sized to the act). FLIGHT_SECS
// after the power comes back, jobs worth FLIGHT_PER_DARK_SEC of the district for
// every second it was dark leave: one hack is about one lot-sized firm. The news
// line reports it, and the lots answer the floor the district now wants less of.
export const FLIGHT_SECS = 4;
export const FLIGHT_PER_DARK_SEC = 0.015;
// A police chase scares trade off the district the same way (milestone 4c):
// jobs worth FLIGHT_PER_CHASE_SEC of the district for every second of chase, per
// tier (wanted.js heat), leave FLIGHT_SECS after the chase does. Half a minute
// at tier 2 is about one lot-sized firm, like one hack.
export const FLIGHT_PER_CHASE_SEC = 0.002;

// A use whose floor moved less than this many people in a tick is holding.
const STILL = 1e-6;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const perUse = (fn) => Object.fromEntries(USES.map((use) => [use, fn(use)]));

function makeDistrict(id, lots, rand) {
  const size = lots.reduce((sum, p) => sum + p.w * p.d, 0) * ESTABLISHED_PER_LOT_M2;
  const shops = size * COMMERCE_PER_HOME;
  const firms = size * FIRMS_USUAL * BOOT_FIRMS;
  return {
    id,
    name: DISTRICTS[id],
    size,
    // The established district. Its jobs match its homes.
    base: { res: size, com: shops, ind: shops * INDUSTRY_PER_COMMERCE },
    firms: { com: firms, ind: firms },
    wealth: 1,
    dark: false,
    nextMove: lerp(MOVE_MIN_SECS, MOVE_MAX_SECS, rand()),
    last: null,
    darkFor: 0,
    chase: 0,
    chaseFor: 0,
    // Firms that have given up and leave at `at`: { at, jobs, cause }, oldest first.
    flights: [],
    lots: perUse(() => 0),
    floor: perUse(() => 0),
    trend: perUse(() => 0),
    jobs: 0,
    homes: 0,
    need: perUse(() => 0),
    have: perUse(() => 0),
    price: perUse(() => BALANCED),
    demand: perUse(() => BALANCED),
  };
}

// People standing on the lots right now, per district and use, and which way
// that is going: +1 rising, -1 coming down, 0 holding — what the lots show.
function measureFloors(economy, parcels, heightOf) {
  const was = economy.districts.map((d) => ({ ...d.floor }));
  for (const d of economy.districts) {
    for (const use of USES) {
      d.floor[use] = 0;
      d.lots[use] = 0;
    }
  }
  for (const p of parcels) {
    const d = economy.districts[p.powerZone];
    if (!(p.use in d.floor)) continue;
    d.floor[p.use] += (heightOf(p) * p.w * p.d) / M3_PER_PERSON;
    d.lots[p.use] += 1;
  }
  economy.districts.forEach((d, i) => {
    for (const use of USES) {
      const moved = d.floor[use] - was[i][use];
      d.trend[use] = Math.abs(moved) < STILL ? 0 : Math.sign(moved);
    }
  });
}

// Need against have, per use. Homes follow the jobs on the lots; commerce
// follows what residents spend, plus offices wanting floor; industry follows
// what the shops sell, plus works wanting floor.
function price(d) {
  for (const use of USES) d.have[use] = d.base[use] + d.floor[use];
  d.homes = d.have.res;
  d.jobs = d.base.res + d.floor.com + d.floor.ind;
  d.need.res = d.jobs;
  d.need.com = d.homes * d.wealth * COMMERCE_PER_HOME + d.firms.com;
  d.need.ind = d.have.com * d.wealth * INDUSTRY_PER_COMMERCE + d.firms.ind;
  for (const use of USES) d.price[use] = clamp01(BALANCED + (GAP_GAIN * (d.need[use] - d.have[use])) / d.size);
}

export function createEconomy(parcels, heightOf, rand) {
  const economy = {
    time: 0,
    rand,
    districts: DISTRICTS.map((_, id) => makeDistrict(id, parcels.filter((p) => p.powerZone === id), rand)),
  };
  measureFloors(economy, parcels, heightOf);
  for (const d of economy.districts) {
    price(d);
    Object.assign(d.demand, d.price);
  }
  return economy;
}

// A firm moves in or out. Four draws every time, whatever happens, so the sim
// stream stays in step and one district's fortunes never reach the other's.
function moveFirm(economy, d) {
  const [kind, roll, share, wait] = [economy.rand(), economy.rand(), economy.rand(), economy.rand()];
  const use = kind < 0.5 ? 'com' : 'ind';
  const short = (d.size * FIRMS_USUAL - d.firms[use]) / d.size;
  const odds = Math.max(MOVE_ODDS_FLOOR, Math.min(1 - MOVE_ODDS_FLOOR, 0.5 + FIRMS_PULL * short));
  const firm = d.size * lerp(FIRM_MIN, FIRM_MAX, share);
  const jobs = roll < odds ? firm : -Math.min(firm, d.firms[use]);
  d.firms[use] += jobs;
  if (jobs !== 0) d.last = { at: economy.time, use, jobs };
  d.nextMove = economy.time + lerp(MOVE_MIN_SECS, MOVE_MAX_SECS, wait);
}

// The firm a power cut drives out: while d.dark, d.darkFor counts the seconds;
// on the first tick lit again a flight sized to them is booked FLIGHT_SECS out.
// A flight that comes due takes its jobs from whichever of offices or works has
// more firms, as far as there are any, and d.last says why (cause) for the news.
// It never draws from economy.rand, so the other district's stream stays in step.
function flee(economy, d, dt) {
  if (d.dark) d.darkFor += dt;
  else if (d.darkFor > 0) {
    d.flights.push({ at: economy.time + FLIGHT_SECS, jobs: d.size * FLIGHT_PER_DARK_SEC * d.darkFor, cause: 'dark' });
    d.darkFor = 0;
  }
  scare(economy, d, dt);
  while (d.flights.length > 0 && economy.time >= d.flights[0].at) {
    const flight = d.flights.shift();
    const use = d.firms.com >= d.firms.ind ? 'com' : 'ind';
    const jobs = Math.min(flight.jobs, d.firms[use]);
    d.firms[use] -= jobs;
    if (jobs > 0) d.last = { at: economy.time, use, jobs: -jobs, cause: flight.cause };
  }
}

// The police chase the player is in, told to the economy once a frame by main
// after tickWanted: zone is the power zone the suspect is in, tier wanted.heat.
// chaseIn: d = economy.districts[zone]; when d exists and tier > 0, d.chase =
// Math.max(d.chase, tier). Nothing else.
export function chaseIn(economy, zone, tier) {
  const d = economy.districts[zone];
  if (d && tier > 0) d.chase = Math.max(d.chase, tier);
}

// scare, called by flee every tick: when d.chase > 0, d.chaseFor += d.chase *
// dt; otherwise, when d.chaseFor > 0, d.flights.push({ at: economy.time +
// FLIGHT_SECS, jobs: d.size * FLIGHT_PER_CHASE_SEC * d.chaseFor, cause: 'chase'
// }) and d.chaseFor = 0. Then d.chase = 0, so a chase that stops being told
// stops counting.
function scare(economy, d, dt) {
  if (d.chase > 0) d.chaseFor += d.chase * dt;
  else if (d.chaseFor > 0) {
    d.flights.push({ at: economy.time + FLIGHT_SECS, jobs: d.size * FLIGHT_PER_CHASE_SEC * d.chaseFor, cause: 'chase' });
    d.chaseFor = 0;
  }
  d.chase = 0;
}

function earn(d, dt) {
  const employment = Math.min(d.jobs, d.homes) / d.homes;
  const target = d.dark ? 0 : employment;
  const secs = d.dark ? DARK_DRAIN_SECS : target > d.wealth ? WEALTH_RISE_SECS : WEALTH_FALL_SECS;
  d.wealth += (target - d.wealth) * Math.min(1, dt / secs);
}

function react(d, dt) {
  for (const use of USES) d.demand[use] += (d.price[use] - d.demand[use]) * Math.min(1, dt / MARKET_LAG_SECS);
}

// `heightOf(parcel)` is how tall it stands now (zoning's builtHeight), passed in
// so the economy never imports zoning and the two stay one-way.
export function tickEconomy(economy, parcels, heightOf, street, dt) {
  economy.time += dt;
  measureFloors(economy, parcels, heightOf);
  for (const d of economy.districts) {
    d.dark = isDark(street, d.id);
    flee(economy, d, dt);
    if (economy.time >= d.nextMove) moveFirm(economy, d);
    price(d);
    earn(d, dt);
    react(d, dt);
  }
}

// What the market says about one parcel's use, in the parcel's own district.
export function demandFor(city, parcel) {
  return city.economy.districts[parcel.powerZone]?.demand[parcel.use] ?? 0;
}

// The whole city's demand per use: the mean of its districts, for a glance.
export function cityDemand(economy) {
  return perUse((use) => economy.districts.reduce((sum, d) => sum + d.demand[use], 0) / economy.districts.length);
}

// Plain numbers for the readout and the probe — nothing in it is live state.
export function districtReport(city) {
  const { economy } = city;
  return economy.districts.map((d) => ({
    name: d.name,
    zone: d.id,
    dark: d.dark,
    size: Math.round(d.size),
    jobs: Math.round(d.jobs),
    homes: Math.round(d.homes),
    wealth: +d.wealth.toFixed(3),
    firms: { com: Math.round(d.firms.com), ind: Math.round(d.firms.ind) },
    demand: { ...d.demand },
    lots: { ...d.lots },
    trend: { ...d.trend },
    need: perUse((use) => Math.round(d.need[use])),
    have: perUse((use) => Math.round(d.have[use])),
    last: d.last && { ago: +(economy.time - d.last.at).toFixed(1), use: d.last.use, jobs: Math.round(d.last.jobs) },
  }));
}
