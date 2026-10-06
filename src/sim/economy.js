// The district economy: jobs, homes and wealth in each district, and the demand
// for each use they add up to. What grows on the lots feeds it, and it decides
// what grows next. The loop and every number here are argued in docs/ECONOMY.md.
// Pure: zoning ticks it, render and the probe read it (law 5).
import { isDark } from './street.js';
import { worldMap } from './patrol.js';

// A district is a power zone (zoneAt in street.js): the grid is what a player
// can cut, so it is the unit a consequence lands on. Indexed by zone; the names
// are the readout's, not a map field — the map holds districts, the grid holds
// zones, and the two meet again at M3.T7.
const ZONE_NAMES = ['south', 'north'];
const USES = ['res', 'com', 'ind'];

// A resident or a worker for every 25 m² of floor, on the 3.5 m storey the lots
// build to — a finished lot holds 20 to 120 people.
export const M3_PER_PERSON = 25 * 3.5;
// The hand preset's towers are not parcels, so only it still estimates the
// established district this way: residents per m² of lot land, about what the
// lots hold at full build. A generated map measures its buildings (M3.T16);
// M4.T15 deletes this with the preset.
export const ESTABLISHED_PER_LOT_M2 = 0.4;

// The floor a parcel holds right now, in the economy's people: its built height
// over its footprint, at M3_PER_PERSON of floor. The lots measure it through
// zoning's builtHeight; a map's standing buildings stand at their full height.
// One formula, exported so sim/people.js counts the same floor the economy does.
export function floorPeople(p, heightOf) {
  return (heightOf(p) * p.w * p.d) / M3_PER_PERSON;
}

// What the district needs of each use, per unit of what drives it. Every job
// on the lots wants a home; trading shops keep two in five of theirs again in
// workshops supplying them. A measured generated district counts every floor as
// jobs (M3.T16), so its mix keeps jobs equal to homes: COMMERCE_PER_HOME is the
// shops a home's spending keeps, 1/(1 + INDUSTRY_PER_COMMERCE), and it makes
// the base's shops plus its workshops add up to one home — half its floor homes,
// half work. The hand preset shipped with a third instead.
export const INDUSTRY_PER_COMMERCE = 0.4;
export const COMMERCE_PER_HOME = 1 / (1 + INDUSTRY_PER_COMMERCE);
const COMMERCE_PER_HOME_HAND = 0.35;

// Firms from beyond the map looking for floor in the district — offices want
// commercial floor, works want industrial — in the jobs they would bring. One
// moves in or out every half-minute to minute and a bit, lot-sized, and the odds
// lean back toward the usual level, so the district wanders but never drifts.
// This is the market the city cannot control, and why it never settles.
// A generated new game gets the calm market (docs/ECONOMY.md, M1.T3): a firm
// 3-7% of the district, pull 8, the opening queue served off. A measured
// district is several times the lots' full build (M3.T16), so the usual level a
// firm wanders around is 6% of it and the bands stay un-pinned; the hand preset
// is still sized by the old estimate and keeps the market it shipped with.
export const FIRMS_USUAL = 0.06;
const FIRMS_USUAL_HAND = 0.12;
const FIRM_MIN = 0.03;
const FIRM_MAX = 0.07;
const FIRM_MIN_HAND = 0.06;
const FIRM_MAX_HAND = 0.15;
const FIRMS_PULL = 8;
const FIRMS_PULL_HAND = 4;
const MOVE_MIN_SECS = 25;
const MOVE_MAX_SECS = 70;
const MOVE_ODDS_FLOOR = 0.15;
// Two kinds this close to equally out of line: the draw picks between them.
const FIRM_TIE = 0.02;
// The district arrives with this many times the usual firms queuing for floor:
// the boom the city starts building into. As the market works, the surplus
// above the usual level thins with a BOOT_THIN_SECS time constant — a queue
// being served, not a position held — so the kick-off build-out never leaves
// one use's demand pinned. Only a surplus thins; lower firms stay.
const BOOT_FIRMS = 2;
const BOOT_THIN_SECS = 240;
// What one move serves off the opening surplus. Stateless: a saved game restores exactly.
const BOOT_THIN = 1 - Math.exp(-(MOVE_MIN_SECS + MOVE_MAX_SECS) / (2 * BOOT_THIN_SECS));

// Demand is the balance plus the unmet need, as a share of the district. At
// BALANCED a lot neither starts nor sheds work (zoning's hold band); GAP_GAIN
// is how hard a shortage or glut pushes off it — at 1.5 a nudge across a band
// edge, where gain 3 slammed uses pinned or idle (docs/ECONOMY.md).
const BALANCED = 0.36;
const GAP_GAIN = 1.5;
const GAP_GAIN_HAND = 3;
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

// The commute a district's residents drive (M3.T35): traffic lays every
// resident's trip on the graph's edges for the hour and publishes the
// per-district summary on street.traffic.flowByDistrict — the residents, the
// share with no route, and their mean drive in minutes. A blackout jams what
// is left: with the signals out, DARK_LATE of the district's commuters run
// late on top of the ones no road reaches. Late workers earn nothing while
// they are late, and lost trade is what their shops never see. Both default
// to nothing, so a routed, lit district reads exactly what it did before.
export const DARK_LATE = 0.5;

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

// A rezone earns a line in the news when the floor it added lifts a use the
// chain pulls (PULLS below) where the district can see it. Two ways to clear
// that bar: the pulled use's demand reaches the level zoning breaks ground at
// (BREAK_GROUND_AT, copied because zoning imports this module and the two stay
// one-way), or the district's need for it grows by this share of the district —
// the jobs the new floor itself added. need.res only moves with real floor, not
// with a firm's queue (need.com / need.ind), so the second path names the act
// and not the market's own noise, and the demand band gate keeps the line off
// while the use is not building. A lot is 3-21% of its district (ECONOMY.md),
// so 2% is a lot's early floors, not a rounding error.
const CREDIT_AT = 0.55;
const CREDIT_BAND = 0.42;
const CREDIT_NEED_RISE = 0.02;
// How long a rezone stays the district's live cause. Long enough for the floor
// it added to break ground and the 20 s market lag to arrive; the deadline also
// keeps an old rezone from claiming a swing that is really the market's own.
const CREDIT_SECS = 300;

// The market constants above, read back by scripts/economy-probe.mjs so its
// report quotes the shipped numbers instead of hard-coding a second copy.
export function probeConstants() {
  return {
    balanced: BALANCED,
    gapGain: GAP_GAIN,
    firmsUsual: FIRMS_USUAL,
    marketLagSecs: MARKET_LAG_SECS,
    wealthRiseSecs: WEALTH_RISE_SECS,
    wealthFallSecs: WEALTH_FALL_SECS,
    darkDrainSecs: DARK_DRAIN_SECS,
    flightSecs: FLIGHT_SECS,
    flightPerDarkSec: FLIGHT_PER_DARK_SEC,
    flightPerChaseSec: FLIGHT_PER_CHASE_SEC,
    creditAt: CREDIT_AT,
    creditSecs: CREDIT_SECS,
  };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const perUse = (fn) => Object.fromEntries(USES.map((use) => [use, fn(use)]));

// A district's size is the floor area of its parcels (M3.T16): every building
// already standing, measured parcel by parcel in the economy's people, not a
// flat 0.4 rate over lot land. The base mix is one home, COMMERCE_PER_HOME shops
// and their workshops per resident, so the measured floor divided by that sum is
// the district's own size — the floor the model assumes its established district
// holds is the floor its buildings actually hold. The hand preset has no
// building parcels and keeps the shipped estimate (M4.T15 deletes it with it).
function districtSize(parcels, heightOf, calm) {
  const built = parcels.filter((p) => p.kind !== 'lot');
  if (!calm || built.length === 0) {
    return parcels.reduce((sum, p) => sum + p.w * p.d, 0) * ESTABLISHED_PER_LOT_M2;
  }
  const mix = 1 + COMMERCE_PER_HOME * (1 + INDUSTRY_PER_COMMERCE);
  return built.reduce((sum, p) => sum + floorPeople(p, heightOf), 0) / mix;
}

function makeDistrict(id, parcels, rand, calm, heightOf) {
  const size = districtSize(parcels, heightOf, calm);
  const shops = size * (calm ? COMMERCE_PER_HOME : COMMERCE_PER_HOME_HAND);
  const firms = size * (calm ? FIRMS_USUAL : FIRMS_USUAL_HAND) * BOOT_FIRMS;
  return {
    id,
    name: ZONE_NAMES[id],
    calm,
    size,
    // The established district. Its jobs match its homes.
    base: { res: size, com: shops, ind: shops * INDUSTRY_PER_COMMERCE },
    firms: { com: firms, ind: firms },
    wealth: 1,
    dark: false,
    nextMove: lerp(MOVE_MIN_SECS, MOVE_MAX_SECS, rand()),
    last: null,
    // The player's rezone taking the ground, while it is the live cause, and
    // the demand change it is credited with once one crosses the bar. Both null
    // until a rezone happens; the news reads `credit`.
    rezone: null,
    credit: null,
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
// A use appearing on more lots than last tick is the player's rezone taking the
// ground, not the market growing; it becomes the district's live cause.
function measureFloors(economy, parcels, heightOf) {
  const was = economy.districts.map((d) => ({ floor: { ...d.floor }, lots: { ...d.lots } }));
  for (const d of economy.districts) {
    for (const use of USES) {
      d.floor[use] = 0;
      d.lots[use] = 0;
    }
  }
  for (const p of parcels) {
    const d = economy.districts[p.powerZone];
    if (!(p.use in d.floor)) continue;
    d.floor[p.use] += floorPeople(p, heightOf);
    d.lots[p.use] += 1;
  }
  economy.districts.forEach((d, i) => {
    for (const use of USES) {
      const moved = d.floor[use] - was[i].floor[use];
      d.trend[use] = Math.abs(moved) < STILL ? 0 : Math.sign(moved);
      if (d.lots[use] > was[i].lots[use]) {
        d.rezone = { at: economy.time, use, need: { ...d.need } };
      }
    }
  });
}

// Need against have, per use. Homes follow the jobs; commerce follows what
// residents spend, plus offices wanting floor; industry follows what the shops
// sell, plus works wanting floor. A measured district's jobs are every
// non-residential floor it has (M3.T16); the hand preset shipped with its
// balanced base standing in for them through base.res.
function price(d, lost = 0) {
  for (const use of USES) d.have[use] = d.base[use] + d.floor[use];
  d.homes = d.have.res;
  d.jobs = d.calm ? d.have.com + d.have.ind : d.base.res + d.floor.com + d.floor.ind;
  const commerce = d.calm ? COMMERCE_PER_HOME : COMMERCE_PER_HOME_HAND;
  d.need.res = d.jobs;
  d.need.com = d.homes * d.wealth * commerce * (1 - lost) + d.firms.com;
  d.need.ind = d.have.com * d.wealth * INDUSTRY_PER_COMMERCE + d.firms.ind;
  const gain = d.calm ? GAP_GAIN : GAP_GAIN_HAND;
  for (const use of USES) d.price[use] = clamp01(BALANCED + (gain * (d.need[use] - d.have[use])) / d.size);
}

// `map` is the city being played: a map carrying its own lots is a generated
// plan, and a generated new game gets the calm market (docs/ECONOMY.md, M1.T3).
// The hand preset's map has no lots and keeps the market it shipped with.
export function createEconomy(parcels, heightOf, rand, map = worldMap()) {
  const calm = Boolean(map.lots);
  // The map's parcel list holds every building and lot (M3.T15); the economy
  // sizes each district from the buildings on it. The grown lots arrive in
  // `parcels` and stay the margin measured in `d.floor`.
  const all = map.parcels ?? parcels;
  const economy = {
    time: 0,
    rand,
    calm,
    districts: ZONE_NAMES.map((_, id) => makeDistrict(id, all.filter((p) => p.powerZone === id), rand, calm, heightOf)),
  };
  measureFloors(economy, parcels, heightOf);
  for (const d of economy.districts) {
    // The opening city is what the seed rolled, not a rezone: the first measure
    // counts it, and no player did that.
    d.rezone = null;
    price(d);
    Object.assign(d.demand, d.price);
  }
  return economy;
}

// A firm moves in or out. Four draws every time, whatever happens, so the sim
// stream stays in step and one district's fortunes never reach the other's.
function moveFirm(economy, d) {
  const [kind, roll, share, wait] = [economy.rand(), economy.rand(), economy.rand(), economy.rand()];
  const usual = d.size * (d.calm ? FIRMS_USUAL : FIRMS_USUAL_HAND);
  let use = kind < 0.5 ? 'com' : 'ind';
  if (d.calm) {
    // The serving of the opening queue: every move, the surplus above the usual
    // level loses a serving's worth (a frozen market never acts, so its firms stay).
    for (const u of ['com', 'ind']) {
      if (d.firms[u] > usual) d.firms[u] -= (d.firms[u] - usual) * BOOT_THIN;
    }
    // The kind furthest from its usual level takes the move.
    const short = perUse((u) => (usual - d.firms[u]) / d.size);
    const far = Math.abs(short.com) - Math.abs(short.ind);
    use = far > FIRM_TIE ? 'com' : far < -FIRM_TIE ? 'ind' : use;
  }
  const short = (usual - d.firms[use]) / d.size;
  const pull = d.calm ? FIRMS_PULL : FIRMS_PULL_HAND;
  const odds = Math.max(MOVE_ODDS_FLOOR, Math.min(1 - MOVE_ODDS_FLOOR, 0.5 + pull * short));
  const firm = d.size * lerp(d.calm ? FIRM_MIN : FIRM_MIN_HAND, d.calm ? FIRM_MAX : FIRM_MAX_HAND, share);
  const jobs = roll < odds ? firm : -Math.min(firm, d.firms[use]);
  d.firms[use] += jobs;
  if (jobs !== 0) d.last = { at: economy.time, use, jobs };
  d.nextMove = economy.time + lerp(MOVE_MIN_SECS, MOVE_MAX_SECS, wait);
}

// The firm a power cut drives out: while d.dark, d.darkFor counts the seconds;
// on the first tick lit again a flight sized to them is booked FLIGHT_SECS out.
// A flight that comes due takes its jobs from whichever of offices or works has
// more firms, as far as there are any, and d.last says why (cause) for the news.
// A measured district's floor is what its jobs are counted on, so when the
// firms cannot cover the flight, the established floor the rest sat on goes with
// it (M3.T16): the jobs leave the city and the lots answer the empty want. The
// hand preset's balanced base is not counted that way and only loses firms.
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
    const floor = d.calm ? Math.min(flight.jobs - jobs, d.base[use]) : 0;
    if (floor > 0) d.base[use] -= floor;
    if (jobs + floor > 0) d.last = { at: economy.time, use, jobs: -(jobs + floor), cause: flight.cause };
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

function earn(d, dt, late = 0) {
  const employment = Math.min(d.jobs, d.homes) / d.homes;
  const target = d.dark ? 0 : employment * (1 - late);
  const secs = d.dark ? DARK_DRAIN_SECS : target > d.wealth ? WEALTH_RISE_SECS : WEALTH_FALL_SECS;
  d.wealth += (target - d.wealth) * Math.min(1, dt / secs);
}

function react(d, dt) {
  for (const use of USES) d.demand[use] += (d.price[use] - d.demand[use]) * Math.min(1, dt / MARKET_LAG_SECS);
}

// The use a rezone to `use` pulls, in the order the chain finds them (the loop
// above): works and offices bring jobs, so homes are wanted first; offices are
// also floor shops supply, so works follow; homes bring spending, so shops.
const PULLS = { res: ['com'], com: ['res', 'ind'], ind: ['res'] };
// The chain a rezone sets off, named only when it counts: while d.rezone is the
// district's live cause, the first pulled use the rezone's own floor has lifted
// past the build bar is credited to it. The base need it must clear is the
// district's at the rezone, so a bar already crossed does not claim it — only
// what the new floor added does. That is the line the news prints; a rezone
// that never moves a district over the bar says nothing. It gives up at
// CREDIT_SECS so an old rezone cannot claim the market's own swing, and it
// never draws from economy.rand, so the streams stay in step.
function creditRezone(d, time) {
  if (d.rezone === null) return;
  if (time - d.rezone.at > CREDIT_SECS) {
    d.rezone = null;
    return;
  }
  for (const pulled of PULLS[d.rezone.use]) {
    const added = (d.need[pulled] - d.rezone.need[pulled]) / d.size;
    if (d.demand[pulled] >= CREDIT_AT
        || (d.demand[pulled] >= CREDIT_BAND && added >= CREDIT_NEED_RISE)) {
      d.credit = { at: time, use: pulled, cause: 'rezone', source: d.rezone.use };
      d.rezone = null;
      return;
    }
  }
}

// What the commute costs each district right now (M3.T35): the share of its
// residents running late, and the trade their shops lose with them. Read off
// the flow every tick; zeros until traffic publishes its first hour. It lives
// beside the districts, never on them, so a save that holds the districts
// holds the commute's causes and not its values.
const COMMUTE = new WeakMap();
const NO_COMMUTE = { late: 0, lost: 0 };

function readCommute(economy, d, street) {
  const flow = street?.traffic?.flowByDistrict?.[d.id];
  const late = Math.min(1, (flow?.late ?? 0) + (d.dark ? DARK_LATE : 0));
  let by = COMMUTE.get(economy);
  if (!by) COMMUTE.set(economy, (by = {}));
  return (by[d.id] = { late, lost: late });
}

function commuteOf(economy, id) {
  return COMMUTE.get(economy)?.[id] ?? NO_COMMUTE;
}

// `heightOf(parcel)` is how tall it stands now (zoning's builtHeight), passed in
// so the economy never imports zoning and the two stay one-way.
export function tickEconomy(economy, parcels, heightOf, street, dt) {
  economy.time += dt;
  measureFloors(economy, parcels, heightOf);
  for (const d of economy.districts) {
    d.dark = isDark(street, d.id);
    const commute = readCommute(economy, d, street);
    flee(economy, d, dt);
    if (economy.time >= d.nextMove) moveFirm(economy, d);
    price(d, commute.lost);
    earn(d, dt, commute.late);
    react(d, dt);
    creditRezone(d, economy.time);
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
    commute: { ...commuteOf(economy, d.id) },
    lots: { ...d.lots },
    trend: { ...d.trend },
    need: perUse((use) => Math.round(d.need[use])),
    have: perUse((use) => Math.round(d.have[use])),
    last: d.last && { ago: +(economy.time - d.last.at).toFixed(1), use: d.last.use, jobs: Math.round(d.last.jobs) },
    credit: d.credit && {
      ago: +(economy.time - d.credit.at).toFixed(1),
      use: d.credit.use,
      cause: d.credit.cause,
      source: d.credit.source,
    },
  }));
}
