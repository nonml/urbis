// Why a lot is changing, in words and in state the street can show. tickParcel
// (sim/zoning.js) decides what a lot does each tick and records it here as a
// trend and a cause code; render dresses the building from its vacancy, and the
// HUD reads the cause back as one line. Pure data, like the rest of sim/.
//
// A building that shrinks with no explanation is a bug to the player (pillar 5),
// so decline has an order: a lot empties before it loses a floor. Its windows go
// dark and the letting boards go up first; only an empty building comes down.
import { worldMap } from './patrol.js';
import { streetName } from './streetnames.js';
import { STAGE } from './map.js';
import { SERVICE_TYPES, serviceReach, servicesOf } from './ops.js';

export const TREND = {
  GROWING: 'growing',     // floors going up, or tenants coming back
  STEADY: 'steady',       // nothing moving, and nothing waiting to
  STALLED: 'stalled',     // work in hand, or a market pulling, and nothing moving
  DECLINING: 'declining', // tenants leaving, then floors coming down
};

// Why a lot is doing what it does. A code, not a sentence: the district economy
// will explain demand with causes of its own (jobs leaving, rents) and set them
// here in the same field, with a line in REASONS below.
export const CAUSE = {
  MARKET_STRONG: 'demand-strong',
  MARKET_THIN: 'demand-thin',
  MARKET_LOW: 'demand-low',
  NO_POWER: 'no-power',
  NO_ROAD: 'no-road',
  NO_SERVICE: 'no-service',
  // M12's water and garbage join the same table (M5-16): the causes are listed
  // here so their icons and words land with the systems that set them.
  NO_WATER: 'no-water',
  NO_COLLECTION: 'no-collection',
};

// Seconds for a full building to empty once its market collapses, and to let
// again once the market is back. Emptying is the warning, so it has to be long
// enough to watch from the pavement: the windows go dark a row at a time.
const EMPTY_SECS = 20;
const REFILL_SECS = 20;

// A lot with finished floors has tenants to lose. A site or bare land does not.
export function hasFloors(p) {
  return p.heights[p.stage] > 0;
}

// Records what tickParcel decided. `gaining` and `losing` are what the market
// asks of the lot; `powered` is whether it can do any of it.
export function judge(p, { gaining, losing, powered }) {
  const moving = gaining || losing;
  if (!powered) {
    p.trend = moving || p.building ? TREND.STALLED : TREND.STEADY;
    p.why = p.trend === TREND.STALLED ? CAUSE.NO_POWER : null;
  } else if (gaining) {
    p.trend = TREND.GROWING;
    p.why = CAUSE.MARKET_STRONG;
  } else if (losing) {
    p.trend = TREND.DECLINING;
    p.why = CAUSE.MARKET_LOW;
  } else {
    p.trend = p.building ? TREND.STALLED : TREND.STEADY;
    p.why = p.building ? CAUSE.MARKET_THIN : null;
  }
}

// Tenants go before floors do. Returns whether the lot is empty, which is the
// only state in which it may lose height. A site has nobody in it, so it is
// empty the moment its market goes.
export function vacate(p, dt) {
  p.vacancy = hasFloors(p) ? Math.min(1, p.vacancy + dt / EMPTY_SECS) : 1;
  return p.vacancy >= 1;
}

export function reoccupy(p, dt) {
  p.vacancy = Math.max(0, p.vacancy - dt / REFILL_SECS);
}

// ---- The line the player reads ------------------------------------------

const BUILDING = { com: 'Offices', res: 'Flats', ind: 'Workshops' };
const SITE = { com: 'Office site', res: 'Housing site', ind: 'Workshop site' };
const MARKET = { com: 'office', res: 'housing', ind: 'industrial' };

// The reason, keyed by cause code, given the market it is about.
export const REASONS = {
  [CAUSE.MARKET_STRONG]: (market) => `${market} demand is strong`,
  [CAUSE.MARKET_THIN]: (market) => `too little ${market} demand to carry on`,
  [CAUSE.MARKET_LOW]: (market) => `${market} demand collapsed`,
  [CAUSE.NO_POWER]: () => 'no power',
};

// A cause set before its line is written reads as the plain market reason for
// the way the lot is going, rather than as nothing.
const PLAIN_CAUSE = {
  [TREND.GROWING]: CAUSE.MARKET_STRONG,
  [TREND.STALLED]: CAUSE.MARKET_THIN,
  [TREND.DECLINING]: CAUSE.MARKET_LOW,
};

// The problem table (M5-16): every cause a held-back building can show, its
// one line and its icon mark. It is the join point — a new system adds its
// cause to CAUSE and its entry here, and the icon layer and the reason card
// pick them up without changing. MARKET_LOW shares demand's entry: a building
// losing demand and one waiting on it are the same problem to the player.
export const PROBLEM = {
  [CAUSE.NO_ROAD]: { label: 'no road', mark: 'road' },
  [CAUSE.NO_POWER]: { label: 'no power', mark: 'power' },
  [CAUSE.NO_SERVICE]: { label: 'no service in reach', mark: 'service' },
  [CAUSE.MARKET_THIN]: { label: 'no demand', mark: 'demand' },
  [CAUSE.MARKET_LOW]: { label: 'no demand', mark: 'demand' },
  [CAUSE.NO_WATER]: { label: 'no water', mark: 'water' },
  [CAUSE.NO_COLLECTION]: { label: 'no collection', mark: 'collection' },
};

// A building the world is holding back from growing: one stands or is started,
// on land the player zoned for it, below the cap and not moving. A finished
// building is not held back — it is done — and an empty lot is not a building.
export function heldBack(p) {
  if (p.kind !== 'lot' || p.zoned === null || p.use !== p.zoned) return false;
  if (!(p.building || hasFloors(p))) return false;
  return p.stage < (p.cap ?? STAGE.HIGH) && p.trend !== TREND.GROWING;
}

// The first cause a held-back building shows: what is missing from the outside
// in. `dark` is the power zone's truth (street.js isDark), `served` whether a
// service the city runs reaches this parcel (servedIn below). Ties read the way
// judge() judges them: power outranks the market, and a stranded parcel
// outranks both.
export function problemOf(p, { dark = false, served = true } = {}) {
  if (p.noRoad || p.why === CAUSE.NO_ROAD) return CAUSE.NO_ROAD;
  if (dark) return CAUSE.NO_POWER;
  if (!served) return CAUSE.NO_SERVICE;
  return PROBLEM[p.why] ? p.why : CAUSE.MARKET_THIN;
}

// Which parcels every service the city actually runs can reach, capacity
// included (ops.js serviceReach). A city that has built no clinic cannot
// complain that a lot lacks one, so types with no services are not tested.
export function servedIn(city) {
  const reaches = SERVICE_TYPES
    .filter((type) => servicesOf(city.parcels, type).length > 0)
    .map((type) => serviceReach(city.parcels, type));
  if (reaches.length === 0) return () => true;
  return (p) => reaches.every((reach) => reach.has(p));
}

// Every held-back building and the cause its icon shows, in parcel order. The
// icon layer, the reason card and the acceptance check all read this one list.
export function problemList(city, { dark = () => false, served = servedIn(city) } = {}) {
  const out = [];
  city.parcels.forEach((p, i) => {
    if (!heldBack(p)) return;
    out.push({ i, cause: problemOf(p, { dark: dark(p.powerZone), served: served(p) }) });
  });
  return out;
}

function doing(p) {
  const floors = hasFloors(p);
  if (p.trend === TREND.GROWING) return floors && p.vacancy > 0 ? 'filling up again' : 'going up';
  if (p.trend === TREND.DECLINING) {
    if (!floors) return 'being cleared';
    return p.vacancy < 1 ? 'emptying' : 'coming down';
  }
  return floors && !p.building ? 'on hold' : 'stopped';
}

// A junction a player can find: the nearest avenue, and the crossing it meets
// when the lot is within a short block of one.
const CORNER = 25;

export function address(x, z, map = worldMap()) {
  const { avenues, crossings } = map.district;
  const nearest = (ways, at) => ways.reduce((a, b) => (Math.abs(at(b)) < Math.abs(at(a)) ? b : a));
  const avenue = nearest(avenues, (a) => a.x - x);
  const crossing = nearest(crossings, (c) => c.z - z);
  if (Math.abs(crossing.z - z) <= CORNER) return `${streetName(avenue)} & ${streetName(crossing)}`;
  return `${streetName(avenue)} Ave`;
}

// Whether there is anything to say: the lot is changing, and it has a use.
function newsworthy(p) {
  return p.trend !== TREND.STEADY && p.use in BUILDING;
}

// One line, or null when there is nothing to say.
export function describe(p, map = worldMap()) {
  if (!newsworthy(p)) return null;
  const noun = (hasFloors(p) ? BUILDING : SITE)[p.use];
  const reason = REASONS[p.why] ?? REASONS[PLAIN_CAUSE[p.trend]];
  return `${noun} at ${address(p.x, p.z, map)} ${doing(p)} — ${reason(MARKET[p.use])}`;
}

// Which changing lot the player means: the one they stand beside, or the one
// they are looking at down the street. Nearest wins.
const BESIDE = 14;              // metres from the lot's edge
const SIGHT = 60;
const LOOK_COS = Math.cos(0.35); // about 20 degrees either side of the view

export function focusParcel(parcels, x, z, fx, fz) {
  let best = null;
  let bestD = Infinity;
  for (const p of parcels) {
    if (!newsworthy(p)) continue;
    const d = Math.hypot(Math.max(0, Math.abs(p.x - x) - p.w / 2), Math.max(0, Math.abs(p.z - z) - p.d / 2));
    const toX = p.x - x;
    const toZ = p.z - z;
    const seen = (toX * fx + toZ * fz) / (Math.hypot(toX, toZ) || 1) >= LOOK_COS;
    if ((d <= BESIDE || (seen && d <= SIGHT)) && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

// Holds one market at a level whatever the demand model writes, until released
// with null. For capture probes and tests that need a slump now rather than in
// three minutes of waiting for the swell; nothing in play calls it.
export function pinDemand(city, use, level) {
  city.pins = city.pins || {};
  if (level === null) delete city.pins[use];
  else city.pins[use] = level;
}
