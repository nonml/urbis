// City growth: the empty lots the district builds on by itself, and gives back
// when the market goes. Pure data in, pure data out — render reads it, only main
// ticks it (law 5). Why growth lives on empty land instead of on the 68 shipped
// towers is docs/ZONING.md.
import { createStreams } from './rng.js';
import { WORLD_PLAN } from './layout.js';
import { isDark, zoneAt } from './street.js';
import { cityDemand, createEconomy, demandFor, tickEconomy } from './economy.js';
import { TREND, hasFloors, judge, reoccupy, vacate } from './decline.js';

export const STAGES = ['EMPTY', 'SITE', 'LOW', 'MID', 'HIGH'];
export const STAGE = Object.fromEntries(STAGES.map((name, i) => [name, i]));
export const USES = ['res', 'com', 'ind'];

// The shell stands this far inside the hoarding line on every side. It lives
// here, not in render/zoning.js, because the interiors derive their door face
// and room from the same building footprint the shell is drawn at.
export const SETBACK = 1.2;

// Empty land: centre x, centre z, width along x, depth along z. Read off the
// tower, road, tree and verge tables and then checked from the street — every
// lot clears every carriageway, footway, podium, trunk and grass strip. Five
// each side of z = 0, so whichever zone is blacked out has work to stop.
const LOTS = [
  [-15.25, 56, 16.5, 10],     // main avenue, west side, north of the plaza
  [28.5, 56, 16, 10],         // behind the main and east rows, north of the plaza
  [61, 63.75, 16, 13.5],      // east avenue, park side, north of the plaza
  [61, 92.75, 16, 13.5],      // east avenue, park side, at the north terminus
  [11.25, 91, 7.5, 10],       // main avenue, east side, at the north terminus
  [29.25, -35.75, 12.5, 8.5], // east avenue, west side, in the gap in the row
  [-21.75, -61.75, 8.5, 12.5], // south-west corner, past the end of the connector
  [-12.5, -61.75, 8, 12.5],
  [61.5, -63.75, 15, 7.5],    // east avenue, park side, south end
  [61.5, -55, 15, 8],
];

// Seconds to finish each stage at full demand — breaking ground, then up to the
// low block, the mid-rise and the tower. Quick enough that a player standing on
// the pavement watches a lot become a building.
const STAGE_SECS = [12, 22, 32, 45];
// A slump takes a stage back per minute. Slower than growth on purpose: a city
// that empties as fast as it fills is flickering, not declining.
const DECLINE_SECS = 60;
// Demand bands. An empty lot needs a real market before anyone breaks ground; a
// started building keeps going on less; below the floor the district sheds it.
const BREAK_GROUND_AT = 0.55;
const GROW_AT = 0.42;
const DECLINE_AT = 0.28;
// Growth pace at bare GROW_AT demand, as a share of full pace.
const SLOW_PACE = 0.5;

export const STOREY = 3.5;
const LOW_HEIGHT = 3 * STOREY;
// A lot grows as tall as its footprint carries — this many times its short side
// — inside the band the shipped towers already stand in.
const SLENDERNESS = 3.6;
const TOP_MIN = 22;
const TOP_MAX = 46;
// Where the mid-rise sits between the low block and the finished tower.
const MID_SHARE = 0.45;

// The district arrives part-built: mostly empty lots and fresh sites, a few
// buildings already up, nothing finished — the skyline is still being decided.
const START_STAGES = [STAGE.EMPTY, STAGE.EMPTY, STAGE.EMPTY, STAGE.SITE, STAGE.SITE, STAGE.LOW, STAGE.LOW, STAGE.MID];
const START_PROGRESS = 0.8;

function makeParcel(rand, [x, z, w, d]) {
  const stage = START_STAGES[Math.floor(rand() * START_STAGES.length)];
  const fit = Math.min(TOP_MAX, Math.max(TOP_MIN, Math.min(w, d) * SLENDERNESS));
  const top = fit * (0.85 + rand() * 0.25);
  const use = USES[Math.floor(rand() * USES.length)];
  return {
    x, z, w, d,
    // `use` is what stands on the lot, or what it is breaking ground as; `zoned`
    // is what the lot is zoned for (null: unzoned). The district arrives zoned
    // for what it is already building, so an untouched city grows exactly as
    // it did before the player could zone. The player repaints it in city view.
    use,
    zoned: use,
    stage,
    progress: rand() * START_PROGRESS,
    powerZone: zoneAt(z),
    pace: 0.8 + rand() * 0.4,
    // Height at the top of each stage, EMPTY to HIGH. A SITE has no floors yet;
    // it is climbing toward the low block.
    heights: [0, 0, LOW_HEIGHT, LOW_HEIGHT + (top - LOW_HEIGHT) * MID_SHARE, top],
    building: false,
    // What the lot is doing and why, and how empty it stands (sim/decline.js).
    trend: TREND.STEADY,
    why: null,
    vacancy: 0,
  };
}

// A new city leaves the player land to zone: a rezone that must knock a
// building down first takes jobs away before it adds any, so empty land is
// where a zoning change starts a chain. In each district of a generated world
// (WORLD_PLAN set), the FREE_LOTS lots that start EMPTY with the least
// progress (ties by index) start unzoned: use and zoned null, progress 0. The
// hand preset keeps every lot zoned. Milestone 4 skeleton: a stub, with its
// test in tests/zoning-freeland.todo.js.
export const FREE_LOTS = 2;
function freeLand(parcels) {
  void parcels;
}

// Demand is the district economy's (sim/economy.js): what stands on the lots and
// what happens in each district move it. A parcel reads its own district's
// market through demandFor(); `demand` is the whole city's mean, for a glance.
function updateDemand(city, dt, street) {
  tickEconomy(city.economy, city.parcels, builtHeight, street, dt);
  city.demand = cityDemand(city.economy);
}

export function createCity(seed) {
  const rng = createStreams(seed);
  const parcels = (WORLD_PLAN?.lots ?? LOTS).map((lot) => makeParcel(rng.world, lot));
  if (WORLD_PLAN) freeLand(parcels);
  const economy = createEconomy(parcels, builtHeight, rng.sim);
  return { time: 0, parcels, economy, demand: cityDemand(economy) };
}

function growthRate(p, demand) {
  const eager = Math.min(1, (demand - GROW_AT) / (1 - GROW_AT));
  return (p.pace * (SLOW_PACE + (1 - SLOW_PACE) * eager)) / STAGE_SECS[p.stage];
}

// Progress is work toward the next stage, so both directions stay continuous: a
// stage completes at 1 and carries the overshoot; a slump below 0 drops a stage
// and lands at the top of the one beneath, the same height it just left. A
// building empties before it sheds anything (vacate).
function tickParcel(p, demand, dt, powered) {
  const bar = p.stage === STAGE.EMPTY ? BREAK_GROUND_AT : GROW_AT;
  const grows = p.stage < STAGE.HIGH && demand >= bar;
  const lets = demand >= GROW_AT && p.vacancy > 0;
  const slumps = !grows && demand < DECLINE_AT;
  judge(p, { gaining: grows || (lets && hasFloors(p)), losing: slumps && p.stage > STAGE.EMPTY, powered });
  // The cascade hook: a site without power does no work. It does not decline
  // either — a blackout stops the crane, it does not dismantle it.
  if (!powered) return;
  if (lets) reoccupy(p, dt);
  if (grows) {
    p.progress += dt * growthRate(p, demand);
    if (p.progress >= 1) {
      p.stage += 1;
      p.progress = p.stage === STAGE.HIGH ? 0 : p.progress - 1;
    }
  } else if (slumps && vacate(p, dt)) {
    p.progress -= dt / DECLINE_SECS;
    if (p.progress < 0 && p.stage > STAGE.EMPTY) {
      p.stage -= 1;
      p.progress += 1;
    }
    p.progress = Math.max(0, p.progress);
  }
  p.building = p.stage >= STAGE.SITE && p.stage < STAGE.HIGH && (grows || p.progress > 0);
}

// A lot whose building no longer fits its zoning clears first: it comes down a
// stage at a time, as continuously as it went up, and only the empty lot takes
// the new use and breaks ground as it — a building never changes use standing.
// An unzoned lot clears and stays clear. Faster than a slump, because it is a
// demolition the player ordered, not a market giving up (docs/CITYVIEW.md).
// A stage comes down in CLEAR_SECS: a tower is cleared in a minute.
const CLEAR_SECS = 15;
function clearLot(p, dt) {
  if (p.stage === STAGE.EMPTY) {
    p.use = p.zoned;
    p.progress = 0;
    p.building = false;
    return;
  }
  p.progress -= dt / CLEAR_SECS;
  if (p.progress < 0) {
    p.stage -= 1;
    p.progress += 1;
  }
  p.building = p.stage > STAGE.EMPTY;
}

// The player's hand on the city (city view, sim/cityview.js): zone lot `index`
// for a use, or unzone it with null. Nothing moves here; the lot answers over
// the ticks that follow. Returns whether the zoning changed.
export function zoneParcel(city, index, use) {
  const p = city.parcels[index];
  if (!p || (use !== null && !USES.includes(use)) || p.zoned === use) return false;
  p.zoned = use;
  return true;
}

export function tickZoning(city, dt, street, hold = -1) {
  city.time += dt;
  updateDemand(city, dt, street);
  city.parcels.forEach((p, i) => {
    // The player's own building waits for them: while they stand inside it,
    // its decline (or ordered demolition) is deferred, so the space they are
    // in never disappears around them.
    if (i === hold) return;
    const powered = !isDark(street, p.powerZone);
    if (p.zoned !== null && p.use === p.zoned) {
      // A pinned market (capture probes, sim/decline.js) outranks the economy.
      tickParcel(p, city.pins?.[p.use] ?? demandFor(city, p), dt, powered);
    } else if (powered) {
      // A demolition the player ordered stops in a blackout like any other work.
      clearLot(p, dt);
    }
  });
}

// How tall the parcel stands right now: the finished stage plus the share of the
// next one already built. Continuous, so a building rises instead of popping.
export function builtHeight(p) {
  const floor = p.heights[p.stage];
  if (p.stage === STAGE.HIGH) return floor;
  return floor + (p.heights[p.stage + 1] - floor) * p.progress;
}
