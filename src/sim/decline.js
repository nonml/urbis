// Why a lot is changing, in words and in state the street can show. tickParcel
// (sim/zoning.js) decides what a lot does each tick and records it here as a
// trend and a cause code; render dresses the building from its vacancy, and the
// HUD reads the cause back as one line. Pure data, like the rest of sim/.
//
// A building that shrinks with no explanation is a bug to the player (pillar 5),
// so decline has an order: a lot empties before it loses a floor. Its windows go
// dark and the letting boards go up first; only an empty building comes down.
import { AVENUES, CROSSINGS } from './world.js';

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
const title = (id) => id[0].toUpperCase() + id.slice(1);

export function address(x, z) {
  const nearest = (ways, at) => ways.reduce((a, b) => (Math.abs(at(b)) < Math.abs(at(a)) ? b : a));
  const avenue = nearest(AVENUES, (a) => a.x - x);
  const crossing = nearest(CROSSINGS, (c) => c.z - z);
  if (Math.abs(crossing.z - z) <= CORNER) return `${title(avenue.id)} & ${title(crossing.id)}`;
  return `${title(avenue.id)} Ave`;
}

// Whether there is anything to say: the lot is changing, and it has a use.
function newsworthy(p) {
  return p.trend !== TREND.STEADY && p.use in BUILDING;
}

// One line, or null when there is nothing to say.
export function describe(p) {
  if (!newsworthy(p)) return null;
  const noun = (hasFloors(p) ? BUILDING : SITE)[p.use];
  const reason = REASONS[p.why] ?? REASONS[PLAIN_CAUSE[p.trend]];
  return `${noun} at ${address(p.x, p.z)} ${doing(p)} — ${reason(MARKET[p.use])}`;
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
