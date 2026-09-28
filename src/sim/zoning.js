// City growth: the empty lots the district builds on by itself, and gives back
// when the market goes. Pure data in, pure data out — render reads it, only main
// ticks it (law 5). Why growth lives on empty land instead of on the 68 shipped
// towers is docs/ZONING.md.
import { createStreams } from './rng.js';
import { isDark, zoneAt } from './street.js';
import { cityDemand, createEconomy, demandFor, tickEconomy } from './economy.js';

export const STAGES = ['EMPTY', 'SITE', 'LOW', 'MID', 'HIGH'];
export const STAGE = Object.fromEntries(STAGES.map((name, i) => [name, i]));
export const USES = ['res', 'com', 'ind'];

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
  return {
    x, z, w, d,
    use: USES[Math.floor(rand() * USES.length)],
    stage,
    progress: rand() * START_PROGRESS,
    powerZone: zoneAt(z),
    pace: 0.8 + rand() * 0.4,
    // Height at the top of each stage, EMPTY to HIGH. A SITE has no floors yet;
    // it is climbing toward the low block.
    heights: [0, 0, LOW_HEIGHT, LOW_HEIGHT + (top - LOW_HEIGHT) * MID_SHARE, top],
    building: false,
  };
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
  const parcels = LOTS.map((lot) => makeParcel(rng.world, lot));
  const economy = createEconomy(parcels, builtHeight, rng.sim);
  return { time: 0, parcels, economy, demand: cityDemand(economy) };
}

function growthRate(p, demand) {
  const eager = Math.min(1, (demand - GROW_AT) / (1 - GROW_AT));
  return (p.pace * (SLOW_PACE + (1 - SLOW_PACE) * eager)) / STAGE_SECS[p.stage];
}

// Progress is work toward the next stage, so both directions stay continuous: a
// stage completes at 1 and carries the overshoot; a slump below 0 drops a stage
// and lands at the top of the one beneath, the same height it just left.
function tickParcel(p, demand, dt) {
  const bar = p.stage === STAGE.EMPTY ? BREAK_GROUND_AT : GROW_AT;
  const grows = p.stage < STAGE.HIGH && demand >= bar;
  if (grows) {
    p.progress += dt * growthRate(p, demand);
    if (p.progress >= 1) {
      p.stage += 1;
      p.progress = p.stage === STAGE.HIGH ? 0 : p.progress - 1;
    }
  } else if (demand < DECLINE_AT) {
    p.progress -= dt / DECLINE_SECS;
    if (p.progress < 0 && p.stage > STAGE.EMPTY) {
      p.stage -= 1;
      p.progress += 1;
    }
    p.progress = Math.max(0, p.progress);
  }
  p.building = p.stage >= STAGE.SITE && p.stage < STAGE.HIGH && (grows || p.progress > 0);
}

export function tickZoning(city, dt, street) {
  city.time += dt;
  updateDemand(city, dt, street);
  for (const p of city.parcels) {
    // The cascade hook: a site without power does no work. It does not decline
    // either — a blackout stops the crane, it does not dismantle it.
    if (isDark(street, p.powerZone)) continue;
    tickParcel(p, demandFor(city, p), dt);
  }
}

// How tall the parcel stands right now: the finished stage plus the share of the
// next one already built. Continuous, so a building rises instead of popping.
export function builtHeight(p) {
  const floor = p.heights[p.stage];
  if (p.stage === STAGE.HIGH) return floor;
  return floor + (p.heights[p.stage + 1] - floor) * p.progress;
}
