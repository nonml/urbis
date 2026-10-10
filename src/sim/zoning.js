// City growth: the empty lots the district builds on by itself, and gives back
// when the market goes. Pure data in, pure data out — render reads it, only main
// ticks it (law 5). Why growth lives on empty land instead of on the 68 shipped
// towers is docs/ZONING.md.
import { createStreams } from './rng.js';
import { worldMap } from './patrol.js';
import { isDark, zoneAt } from './street.js';
// The stage scale and the use set belong to the map's parcels (sim/map.js);
// re-exported so every reader keeps importing them from zoning, as before.
import { STAGE, STAGES, USES } from './map.js';
export { STAGE, STAGES, USES };
import {
  COMMERCE_PER_HOME,
  ESTABLISHED_PER_LOT_M2,
  FIRMS_USUAL,
  INDUSTRY_PER_COMMERCE,
  M3_PER_PERSON,
  cityDemand,
  createEconomy,
  demandFor,
  tickEconomy,
} from './economy.js';
import { REASONS, TREND, hasFloors, judge, reoccupy, vacate } from './decline.js';

// A parcel no road reaches is cut off from the city's life: it declines on the
// missing road alone, whatever the market says (ops.js marks it `noRoad`, M5-3).
// The cause reads in the lot note and the news; decline.js's reason table holds
// the words, so zoning — the system that acts on it — registers its line.
export const NO_ROAD = 'no-road';
REASONS[NO_ROAD] = () => 'no road';

// M6.T18 (M6-4): the crane hacks. STOP CRANE parks a site — the jib stops
// slewing and nothing is built — and DROP LOAD takes a stage off the lot: the
// crane comes down with it and the site is shut for a minute. Both carry a
// cause of their own, read in the lot note and the news the way the missing
// road is, because a stalled crane is not a market giving up.
export const CRANE_STOP_SECS = 30;
export const CRANE_SHUT_SECS = 60;
const CRANE_STOPPED = 'crane-stopped';
const CRANE_DROPPED = 'load-dropped';
REASONS[CRANE_STOPPED] = () => 'crane stopped';
REASONS[CRANE_DROPPED] = () => 'load dropped, site shut';

// The shell stands this far inside the hoarding line on every side. It lives
// here, not in render/zoning.js, because the interiors derive their door face
// and room from the same building footprint the shell is drawn at.
export const SETBACK = 1.2;

// Empty land: centre x, centre z, width along x, depth along z. Read off the
// tower, road, tree and verge tables and then checked from the street — every
// lot clears every carriageway, footway, podium, trunk and grass strip. Five
// each side of z = 0, so whichever zone is blacked out has work to stop.
//
// A generated map carries its plan's lots in `map.lots`; this table is the
// hand preset's map entry, read only while the preset map has no lots of its
// own (M4.T15 deletes it with the rest of the preset).
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
// low block, the mid-rise and the tower. The first two are quick: a lot the
// player zones raises its first floor in at most 20 game seconds and stands as a
// low block inside a minute, so a player standing on the pavement watches a lot
// become a building. The later stages keep the city's slower pace. The last is
// 90 s, not 45: at 45 every res lot on seeds 7 and 22 stood finished before
// minute 5, so M1-2's A/B could not read a rezone at all (docs/ECONOMY.md).
const STAGE_SECS = [8, 16, 32, 90];
// A slump takes a stage back per minute. Slower than growth on purpose: a city
// that empties as fast as it fills is flickering, not declining.
const DECLINE_SECS = 60;
// Demand bands. Empty land the district rolled needs a real market before
// anyone breaks ground; a lot the player zones is the player's order and starts
// on that alone (tickParcel). A started building keeps going on less; below the
// floor the district sheds it.
const BREAK_GROUND_AT = 0.55;
const GROW_AT = 0.42;
const DECLINE_AT = 0.28;
// Growth pace at bare GROW_AT demand, as a share of full pace.
const SLOW_PACE = 0.5;

// The zoning thresholds above, read back by scripts/economy-probe.mjs so its
// report quotes the shipped numbers instead of hard-coding a second copy.
export function probeThresholds() {
  return { breakGroundAt: BREAK_GROUND_AT, growAt: GROW_AT, declineAt: DECLINE_AT, storey: STOREY, freeLots: FREE_LOTS };
}

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

function makeParcel(rand, [x, z, w, d], index) {
  const stage = START_STAGES[Math.floor(rand() * START_STAGES.length)];
  const fit = Math.min(TOP_MAX, Math.max(TOP_MIN, Math.min(w, d) * SLENDERNESS));
  const top = fit * (0.85 + rand() * 0.25);
  const use = USES[Math.floor(rand() * USES.length)];
  return {
    // The building parcels live in map.parcels; these are the lots the city
    // grows. The id matches the map's own lot parcel (sim/map.js lotParcel).
    id: `lot:${index}`,
    kind: 'lot',
    x, z, w, d,
    // `use` is what stands on the lot, or what it is breaking ground as; `zoned`
    // is what the lot is zoned for (null: unzoned). The seed rolls the opening
    // use and balanceUses settles the mix; the player repaints in city view.
    use,
    zoned: use,
    // Whether the player's zone still owns this lot's first floors
    // (sim/cityview.js): set by zoneParcel, spent when the lot reaches LOW.
    painted: false,
    // The tallest stage the lot may reach (M5.T8). HIGH is no cap; the player
    // paints LOW with Shift and a brush (cityview.js capParcel).
    cap: STAGE.HIGH,
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
// where a zoning change starts a chain. In each district of a generated map,
// the FREE_LOTS lots that start EMPTY with the least progress (ties by index)
// start unzoned: use and zoned null, progress 0. The hand preset keeps every
// lot zoned.
export const FREE_LOTS = 2;
function freeLand(parcels) {
  for (const zone of new Set(parcels.map((p) => p.powerZone))) {
    parcels
      .filter((p) => p.powerZone === zone && p.stage === STAGE.EMPTY)
      .sort((a, b) => a.progress - b.progress)
      .slice(0, FREE_LOTS)
      .forEach((p) => {
        p.use = null;
        p.zoned = null;
        p.progress = 0;
      });
  }
}

// What each district's zoned lots should carry so lot jobs about equal lot
// homes: homes 48 % of the lots' full floor, shops 29 %, works 23 % — shops
// serve the homes, works supply the shops and the offices' stock. `USE_ROOM`
// is the price each use aims at when full: 0.42, the top of zoning's hold
// band. The start is the share guess, biggest lot first; then single lots and
// pairs trading uses walk while that lowers the worst of the three full-build
// gaps. Unzoned free lots are left for the player (M1-2); the hand preset
// keeps its rolled mix.
const USE_SHARE = { res: 0.48, com: 0.29, ind: 0.23 };
const USE_ROOM = 0.04;

function fullBuildGap(cap, size, firms) {
  const dev = {
    res: (cap.com + cap.ind - cap.res) / size,
    com: (COMMERCE_PER_HOME * cap.res + firms - cap.com) / size,
    ind: (INDUSTRY_PER_COMMERCE * cap.com + firms - cap.ind) / size,
  };
  return Math.max(...USES.map((use) => Math.abs(dev[use] - USE_ROOM)));
}

// The opening mix: each lot (biggest first) takes the use furthest short of
// its share, so no single giant lot blocks the smaller ones from a use.
function greedyMix(lots, capacity, total) {
  const cap = Object.fromEntries(USES.map((use) => [use, 0]));
  for (const p of [...lots].sort((a, b) => capacity(b) - capacity(a))) {
    let pick = USES[0];
    for (const use of USES) if (USE_SHARE[use] * total - cap[use] > USE_SHARE[pick] * total - cap[pick]) pick = use;
    p.use = pick; p.zoned = pick; cap[pick] += capacity(p);
  }
  return cap;
}

function balanceUses(parcels) {
  const capacity = (p) => (p.heights[STAGE.HIGH] * p.w * p.d) / M3_PER_PERSON;
  for (const zone of new Set(parcels.map((p) => p.powerZone))) {
    const all = parcels.filter((p) => p.powerZone === zone);
    const lots = all.filter((p) => p.zoned !== null);
    if (lots.length < USES.length) continue;
    const size = all.reduce((sum, p) => sum + p.w * p.d, 0) * ESTABLISHED_PER_LOT_M2;
    const firms = FIRMS_USUAL * size;
    const total = lots.reduce((sum, p) => sum + capacity(p), 0);
    const cap = greedyMix(lots, capacity, total);
    let best = fullBuildGap(cap, size, firms);
    for (let pass = 0; pass < lots.length; pass++) {
      let moved = false;
      for (const p of lots) {
        const c = capacity(p);
        for (const use of USES) {
          if (use === p.use) continue;
          cap[p.use] -= c; cap[use] += c;
          const gap = fullBuildGap(cap, size, firms);
          if (gap < best) {
            p.use = use; p.zoned = use;
            best = gap;
            moved = true;
          } else {
            cap[use] -= c; cap[p.use] += c;
          }
        }
      }
      // Two lots trading uses escape what one lot's walk cannot: the centre is often a swap.
      for (let i = 0; i < lots.length; i++) {
        for (let j = i + 1; j < lots.length; j++) {
          const [a, b] = [lots[i], lots[j]];
          if (a.use === b.use) continue;
          const [ca, cb] = [capacity(a), capacity(b)];
          cap[a.use] += cb - ca; cap[b.use] += ca - cb;
          const gap = fullBuildGap(cap, size, firms);
          if (gap < best) {
            [a.use, b.use] = [b.use, a.use];
            [a.zoned, b.zoned] = [a.use, b.use];
            best = gap;
            moved = true;
          } else {
            cap[a.use] -= cb - ca; cap[b.use] -= ca - cb;
          }
        }
      }
      if (!moved) break;
    }
  }
}

// Demand is the district economy's (sim/economy.js): what stands on the lots and
// what happens in each district move it. A parcel reads its own district's
// market through demandFor(); `demand` is the whole city's mean, for a glance.
function updateDemand(city, dt, street) {
  tickEconomy(city.economy, city.parcels, builtHeight, street, dt);
  city.demand = cityDemand(city.economy);
}

export function createCity(seed, map = worldMap()) {
  const rng = createStreams(seed);
  // A map with lots of its own is a generated plan; the preset map has none,
  // and its hand tables play the generated behaviour off, exactly as before.
  const generated = Boolean(map.lots);
  const parcels = (map.lots ?? LOTS).map((lot, i) => makeParcel(rng.world, lot, i));
  if (generated) {
    freeLand(parcels);
    balanceUses(parcels);
  }
  // Every building and lot is one live parcel in the map (sim/map.js): the lots
  // the city grows, then the standing row, tower and cap parcels. This replaces
  // the map's opening lot stubs, so one lot is one object, not two.
  const buildings = (map.parcels ?? []).filter((p) => p.kind !== 'lot');
  for (const p of buildings) p.powerZone = zoneAt(p.z);
  // The fixed buildings keep their order, with the rows last: a road op splices
  // frontage rows out of map.parcels (ops.js replanFrontage), so the towers and
  // caps ahead of them keep the parcel index a walker's spot — and M5-3's A/B —
  // reads across the edit.
  const standing = [
    ...buildings.filter((p) => p.kind !== 'row'),
    ...buildings.filter((p) => p.kind === 'row'),
  ];
  map.parcels = [...parcels, ...standing];
  const economy = createEconomy(parcels, builtHeight, rng.sim, map);
  // `parcels` is the lots (the city view zones and the renderer draws it), and
  // `standing` the fixed buildings a road op can cut off (M5.T6); one map, two
  // lists, because only the lots are the player's to move.
  return { time: 0, parcels, standing, economy, demand: cityDemand(economy) };
}

// The pace a lot works at, as a share of its stage a second. While the player's
// zone owns a lot's first floors it works at least at the pace of a market at
// the bottom of the growth band: the order shows in any district, and a market
// above the band still speeds it. Every other lot works at its demand's pace.
function growthRate(p, demand) {
  const wanted = p.painted && p.stage < STAGE.LOW ? Math.max(demand, GROW_AT) : demand;
  const eager = Math.min(1, (wanted - GROW_AT) / (1 - GROW_AT));
  return (p.pace * (SLOW_PACE + (1 - SLOW_PACE) * eager)) / STAGE_SECS[p.stage];
}

// Progress is work toward the next stage, so both directions stay continuous: a
// stage completes at 1 and carries the overshoot; a slump below 0 drops a stage
// and lands at the top of the one beneath, the same height it just left. A
// building empties before it sheds anything (vacate).
function tickParcel(p, demand, dt, powered) {
  const cap = capOf(p);
  const seeded = p.painted && p.stage < STAGE.LOW;
  const bar = seeded ? 0 : p.stage === STAGE.EMPTY ? BREAK_GROUND_AT : GROW_AT;
  const grows = p.stage < cap && demand >= bar;
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
      p.progress = p.stage >= cap ? 0 : p.progress - 1;
      // The order is fulfilled at the low block; the market owns the lot after.
      if (p.stage >= STAGE.LOW) p.painted = false;
    }
  } else if (slumps && vacate(p, dt)) {
    p.progress -= dt / DECLINE_SECS;
    if (p.progress < 0 && p.stage > STAGE.EMPTY) {
      p.stage -= 1;
      p.progress += 1;
    }
    p.progress = Math.max(0, p.progress);
  }
  p.building = p.stage >= STAGE.SITE && p.stage < cap && (grows || p.progress > 0);
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

// A site under a crane hack does nothing at all: no work, no demolition, no
// market. The lot keeps its stage and its crane; only the work stops, and the
// cause on it names the hack. True while the countdown runs — and the countdown
// is cleared on the way out, so the site that reopens carries nothing over.
function craneHalt(p, now) {
  if (!p.stoppedUntil) return false;
  if (now < p.stoppedUntil) {
    p.building = p.stage >= STAGE.SITE && p.stage < capOf(p);
    p.trend = TREND.STALLED;
    p.why = p.dropped ? CRANE_DROPPED : CRANE_STOPPED;
    return true;
  }
  p.stoppedUntil = 0;
  p.dropped = false;
  return false;
}

// The crane hacks, fired at the site the registry entry stands over
// (hackables.js registers a crane for every lot breaking ground). Returns null
// when the hack fired, or the reason it did not, the way the hack menu asks.
export function hackCrane(city, entry, hack) {
  const p = entry?.ref;
  if (!p || p.kind !== 'lot' || city.parcels.indexOf(p) < 0) return 'no site in reach';
  if (p.stage !== STAGE.SITE) return 'no crane on that lot';
  if (hack.id === 'crane_stop') {
    // A stop already running is not shortened by a second one.
    p.stoppedUntil = Math.max(p.stoppedUntil ?? 0, city.time + CRANE_STOP_SECS);
    p.dropped = false;
    return null;
  }
  if (hack.id === 'crane_drop') {
    // The load comes down on the lot: a stage off, back to bare land, and the
    // site shut. The player's order on the lot stands, so it breaks ground
    // again the moment the shut lifts.
    p.stage = Math.max(STAGE.EMPTY, p.stage - 1);
    p.progress = 0;
    p.stoppedUntil = city.time + CRANE_SHUT_SECS;
    p.dropped = true;
    return null;
  }
  return 'not built yet';
}

// The player's hand on the city (city view, sim/cityview.js): zone lot `index`
// for a use, or unzone it with null. Nothing moves here; the lot answers over
// the ticks that follow. Returns whether the zoning changed.
export function zoneParcel(city, index, use) {
  const p = city.parcels[index];
  if (!p || p.kind !== 'lot' || (use !== null && !USES.includes(use)) || p.zoned === use) return false;
  p.zoned = use;
  // The player's hand, not the market's: the lot's first floors go up on the
  // player's order alone (tickParcel, growthRate), spent at the low block.
  if (use !== null) p.painted = true;
  return true;
}

// The tallest stage a parcel may reach (M5.T8). `cap` is a stage index; the
// seed's lots and the map's standing buildings open uncapped (HIGH). An absent
// field reads as HIGH, so a parcel from the hand tables behaves as it always did.
export function capOf(p) {
  return p.cap ?? STAGE.HIGH;
}

// The player's cap brush (M5.T8): Shift with a zone brush paints the lot
// low-rise. Growth stops at the cap; what already stands stays until the market
// clears it (clearLot) — a cap is not an order to demolish. The eraser paints
// HIGH, lifting the cap back off. Returns whether the cap changed.
export function capParcel(city, index, cap) {
  const p = city.parcels[index];
  if (!p || p.kind !== 'lot' || !Number.isInteger(cap) || cap < STAGE.EMPTY || cap > STAGE.HIGH) return false;
  if (capOf(p) === cap) return false;
  p.cap = cap;
  return true;
}

// A parcel the roads no longer reach declines on the missing road alone: the
// market and the stage have nothing to do with it, so it overrides both. A road
// back clears the cause. Reads in the lot note and the news (news.js).
function noRoad(p) {
  if (p.noRoad) {
    p.trend = TREND.DECLINING;
    p.why = NO_ROAD;
    return true;
  }
  if (p.why === NO_ROAD) {
    p.trend = TREND.STEADY;
    p.why = null;
  }
  return false;
}

export function tickZoning(city, dt, street, hold = -1) {
  city.time += dt;
  updateDemand(city, dt, street);
  city.parcels.forEach((p, i) => {
    // A cut-off lot does no work at all: growth, clearing and the market wait.
    if (noRoad(p)) return;
    // Only a lot grows or declines on its own. A row, tower or cap is a fixed
    // parcel the player edits (M3.T18), never one the market moves.
    if (p.kind !== 'lot') return;
    // M6.T18: a site under a crane hack waits — no work, no demolition, no
    // market — until the crane lifts or the shut ends.
    if (craneHalt(p, city.time)) return;
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
  // The standing buildings are the map's parcels, not the city's (createCity);
  // a road op leaves one cut off and the same cause declines it here.
  (city.standing ?? []).forEach(noRoad);
}

// How tall the parcel stands right now: the finished stage plus the share of the
// next one already built. Continuous, so a building rises instead of popping.
export function builtHeight(p) {
  const floor = p.heights[p.stage];
  if (p.stage === STAGE.HIGH) return floor;
  return floor + (p.heights[p.stage + 1] - floor) * p.progress;
}
