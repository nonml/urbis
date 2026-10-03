// The economy probe (docs/ROADMAP.md "Next session: the economy rework", step 1).
//
//   node scripts/economy-probe.mjs --seeds 1-12 --minutes 10
//
// It measures the market before anyone rebalances it. For each seed it builds a
// generated city the way a new game does (src/boot.js -> setWorldSeed(seed, true)
// before src/sim/ is evaluated), ticks it in the frame loop's own 50 ms steps
// (tickStreet then tickZoning, like window.__game.advance), and reports demand
// states, A/B gains for a blackout, a chase and a rezone, and growth speed.
//
// The world seed is fixed at module evaluation, so one process plays one seed.
// This file is both the aggregator and the per-seed worker (`--worker`), spawned
// with the seed as an argument so src/sim/ is evaluated fresh for each one.
//
// It imports src/sim/ only: no browser, no three.js. Every threshold comes from
// src/sim/{zoning,economy}.js via probeThresholds()/probeConstants().
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setWorldSeed } from '../src/sim/seedstore.js';

const FILE = fileURLToPath(import.meta.url);
const OUT = 'docs/ECONOMY-PROBE.md';
const DT = 0.05;
const TICKS = Math.round(1 / DT);
const USES = ['res', 'com', 'ind'];
const STATES = ['idle', 'band', 'pinned'];
const CHECKPOINTS = [120, 300, 600];      // seconds: minutes 2, 5 and 10
const POKE_AT = 60;                        // the poke lands at minute 1
const CHASE_SECS = 30;                     // a 30 s chase at tier 2
const CHASE_TIER = 2;

// ---------------------------------------------------------------------------
// The worker: one seed, in its own process.
// ---------------------------------------------------------------------------

const api = {};
async function loadSim() {
  if (api.zoning) return api;
  api.street = await import('../src/sim/street.js');
  api.zoning = await import('../src/sim/zoning.js');
  api.economy = await import('../src/sim/economy.js');
  api.Z = api.zoning.probeThresholds();
  api.E = api.economy.probeConstants();
  return api;
}

function snapshot(city, zoning, storey) {
  return city.economy.districts.map((d, z) => ({
    floors: floorsIn(city, z, zoning, storey),
    jobs: Math.round(d.jobs),
    homes: Math.round(d.homes),
  }));
}

function floorsIn(city, zone, zoning, storey) {
  return city.parcels
    .filter((p) => p.powerZone === zone)
    .reduce((sum, p) => sum + Math.floor(zoning.builtHeight(p) / storey + 1e-6), 0);
}

function classify(city, counts, Z) {
  for (const d of city.economy.districts) {
    for (const use of USES) {
      const v = d.demand[use];
      const state = v < Z.declineAt ? 'idle' : v >= Z.breakGroundAt ? 'pinned' : 'band';
      const key = `${use}|${state}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
}

// The busiest zone (most built height) is the one every poke lands on, so the
// gain is measurable whatever the seed's layout does with z = 0.
function pickZone(city, zoning) {
  const weight = city.economy.districts.map((_, z) =>
    city.parcels.filter((p) => p.powerZone === z).reduce((s, p) => s + zoning.builtHeight(p), 0));
  return weight[1] > weight[0] ? 1 : 0;
}

const freeLots = (city, zone) => city.parcels
  .map((p, i) => (p.powerZone === zone && p.zoned === null ? i : -1))
  .filter((i) => i >= 0);

function recordSpeed(city, ids, age, speed, zoning) {
  for (const idx of ids) {
    const p = city.parcels[idx];
    const s = (speed[idx] ??= {});
    if (s.first === undefined && zoning.builtHeight(p) > 0) s.first = age;
    if (s.low === undefined && p.stage >= zoning.STAGE.LOW) s.low = age;
  }
}

// One world, ticked the way main.js ticks it. `opts.poke` is null for the
// baseline. Returns snapshots at 2/5/10 minutes, optional demand counts, the
// zone and free lots it picked at minute 1, and the rezoned lots' speeds.
function runWorld(seed, opts) {
  const { street, zoning, Z } = api;
  const city = zoning.createCity(seed);
  const state = street.createStreet(seed);
  const counts = {};
  const snaps = {};
  const speed = {};
  let zone = opts.zone ?? 0;
  let freeIndex = opts.freeIndex ?? null;
  let poked = false;
  const cpAt = new Map(CHECKPOINTS.map((secs) => [secs * TICKS, secs]));
  for (let i = 0; i < opts.totalTicks; i++) {
    street.tickStreet(state, DT);
    zoning.tickZoning(city, DT, state);
    const t = (i + 1) * DT;
    if (opts.sample) classify(city, counts, Z);
    if (!opts.poke && freeIndex === null && t >= POKE_AT) {
      zone = pickZone(city, zoning);
      freeIndex = freeLots(city, zone);
    }
    if (opts.poke === 'chase' && t >= POKE_AT && t < POKE_AT + CHASE_SECS) {
      api.economy.chaseIn(city.economy, zone, CHASE_TIER);
    }
    if (opts.poke === 'hack' && !poked && t >= POKE_AT) {
      street.hackBlackout(state, zone);
      poked = true;
    }
    if (opts.poke === 'zone' && !poked && t >= POKE_AT) {
      for (const idx of freeIndex) zoning.zoneParcel(city, idx, 'ind');
      poked = true;
    }
    if (opts.poke === 'zone' && poked) recordSpeed(city, freeIndex, t - POKE_AT, speed, zoning);
    const cp = cpAt.get(i + 1);
    if (cp !== undefined) snaps[cp] = snapshot(city, zoning, Z.storey);
  }
  return { counts, snaps, speed, zone, freeIndex, ticks: opts.totalTicks };
}

function gain(base, poked) {
  const out = {};
  for (const min of [2, 5, 10]) {
    const b = base.snaps[min * 60];
    const p = poked.snaps[min * 60];
    out[min] = p.map((d, z) => ({
      floors: d.floors - b[z].floors,
      jobs: d.jobs - b[z].jobs,
      homes: d.homes - b[z].homes,
    }));
  }
  return out;
}

function demandShares(counts) {
  const out = {};
  for (const use of USES) {
    const n = STATES.reduce((s, k) => s + (counts[`${use}|${k}`] || 0), 0) || 1;
    out[use] = Object.fromEntries(STATES.map((k) => [k, (counts[`${use}|${k}`] || 0) / n]));
  }
  return out;
}

function speedSummary(speed, freeIndex) {
  const firsts = freeIndex.map((i) => speed[i]?.first).filter((v) => v !== undefined);
  const lows = freeIndex.map((i) => speed[i]?.low).filter((v) => v !== undefined);
  return { first: median(firsts), low: median(lows), lots: freeIndex.length };
}

async function worker(seed, minutes) {
  const sim = await loadSim();
  const totalTicks = minutes * 60 * TICKS;
  const base = runWorld(seed, { totalTicks, sample: true });
  const share = { zone: base.zone, freeIndex: base.freeIndex };
  const pokes = {
    hack: runWorld(seed, { totalTicks, poke: 'hack', ...share }),
    chase: runWorld(seed, { totalTicks, poke: 'chase', ...share }),
    zone: runWorld(seed, { totalTicks, poke: 'zone', ...share }),
  };
  return {
    seed,
    minutes,
    thresholds: sim.Z,
    market: sim.E,
    demand: { perUse: demandShares(base.counts), samples: base.ticks * 2 },
    zone: base.zone,
    freeLots: base.freeIndex.length,
    gains: Object.fromEntries(Object.entries(pokes).map(([k, w]) => [k, gain(base, w)])),
    speed: speedSummary(pokes.zone.speed, base.freeIndex),
  };
}

// ---------------------------------------------------------------------------
// The aggregator.
// ---------------------------------------------------------------------------

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const num = (v, digits = 1) => (v === null || v === undefined ? '—' : v.toFixed(digits));
const pct = (v) => `${(v * 100).toFixed(1)}`;
const secs = (v, minutes) => (v === null ? `>${minutes * 60}` : v.toFixed(1));

function demandTable(rows, minutes) {
  const head = ['seed', ...USES.flatMap((u) => STATES.map((s) => `${u} ${s}%`))];
  const line = (label, get) => `| ${label} | ${head.slice(1).map((_, i) => get(i)).join(' | ')} |`;
  const body = rows.map((r) => line(r.seed, (i) => {
    const use = USES[Math.floor(i / 3)];
    const state = STATES[i % 3];
    return pct(r.demand.perUse[use][state]);
  }));
  const med = line('median', (i) => {
    const use = USES[Math.floor(i / 3)];
    const state = STATES[i % 3];
    return pct(median(rows.map((r) => r.demand.perUse[use][state])));
  });
  return [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...body,
    med,
  ].join('\n');
}

function gainTable(rows, poke) {
  const cols = ['floors', 'jobs', 'homes'].flatMap((m) => [2, 5, 10].map((t) => `${m}@${t}`));
  const cell = (r, col) => {
    const [metric, t] = col.split('@');
    const at = r.gains[poke][t];
    const poked = at[r.zone];
    const other = at[1 - r.zone];
    return `${poked[metric]}`;
  };
  const body = rows.map((r) => `| ${r.seed} | z${r.zone} | ${cols.map((c) => cell(r, c)).join(' | ')} |`);
  const med = `| median | — | ${cols.map((c) => {
    const [metric, t] = c.split('@');
    return median(rows.map((r) => r.gains[poke][t][r.zone][metric]));
  }).join(' | ')} |`;
  return [
    `| seed | zone | ${cols.join(' | ')} |`,
    `|${['---', '---', ...cols].map(() => '---').join('|')}|`,
    ...body,
    med,
  ].join('\n');
}

function speedTable(rows, minutes) {
  const body = rows.map((r) => `| ${r.seed} | ${secs(r.speed.first, minutes)} | ${secs(r.speed.low, minutes)} |`);
  const med = `| median | ${secs(median(rows.map((r) => r.speed.first)), minutes)} | ${secs(median(rows.map((r) => r.speed.low)), minutes)} |`;
  return ['| seed | first floor (s) | low-rise (s) |', '|---|---|---|', ...body, med].join('\n');
}

// The largest |delta| on the district the poke never touched, across every
// seed, poke and checkpoint. Should be exactly 0: the pokes take no RNG draws.
function untouchedMax(rows) {
  let max = 0;
  for (const r of rows) {
    for (const poke of ['hack', 'chase', 'zone']) {
      for (const t of [2, 5, 10]) {
        for (const m of ['floors', 'jobs', 'homes']) {
          max = Math.max(max, Math.abs(r.gains[poke][t][1 - r.zone][m]));
        }
      }
    }
  }
  return max;
}

function buildDoc(rows, minutes) {
  const z = rows[0].thresholds;
  const e = rows[0].market;
  const other = untouchedMax(rows);
  return `# The economy probe

\`node scripts/economy-probe.mjs --seeds 1-${rows.length} --minutes ${minutes}\` ran the
pure sim the way \`src/main.js\` runs it — generated city from the seed, 50 ms steps,
\`tickStreet\` then \`tickZoning\` — in plain Node. ${rows.length} seeds x ${minutes} minutes.
This is a meter only: no gameplay constant was changed.

**Thresholds, quoted from the shipped sim (never invented).** Demand buckets use
\`DECLINE_AT = ${z.declineAt}\` and \`BREAK_GROUND_AT = ${z.breakGroundAt}\` from
\`src/sim/zoning.js\`: **idle** is demand below \`DECLINE_AT\` (the district sheds the
use); **in band** is \`DECLINE_AT\` up to \`BREAK_GROUND_AT\` (a lot holds, no new land
breaks); **pinned** is \`BREAK_GROUND_AT\` and above (over-subscribed, always building).
Floors are \`Math.floor(builtHeight / STOREY)\`, \`STOREY = ${z.storey}\`. The market
constants are \`BALANCED = ${e.balanced}\`, \`GAP_GAIN = ${e.gapGain}\`,
\`FIRMS_USUAL = ${e.firmsUsual}\`, \`MARKET_LAG_SECS = ${e.marketLagSecs}\` in
\`src/sim/economy.js\`. Each district is a power zone; the city has two.

## 1. Demand states

Read each cell as the share of sampled ticks the district's demand for that use
spent in that bucket, both districts pooled over the seed's ${minutes}-minute baseline
run (untouched). A "pinned" column near 100 means the use is pinned high all the
time; a large "idle" plus large "pinned" with a near-empty band is the bang-bang the
rework has to fix.

${demandTable(rows, minutes)}

## 2. A/B gains

Each poke lands once at minute 1 on the busier of the two districts (the \`zone\`
column). B is the same seed as A, re-run with the poke; every cell is **B minus A**,
in whole units, at minutes 2, 5 and 10, for the poked district. The three pokes:
a blackout hack (\`H\`), a 30 s police chase at tier 2 (\`chaseIn\`), and rezoning both
free lots of the district for works (\`zoneParcel(..., 'ind')\`). The district the poke
never touched is unchanged in every run (largest |delta| measured: ${other}).

### 2a. Blackout hack

${gainTable(rows, 'hack')}

### 2b. Police chase (60-90 s, tier 2)

${gainTable(rows, 'chase')}

### 2c. Rezone both free lots to works

${gainTable(rows, 'zone')}

## 3. Speed of a newly zoned lot

From the minute-1 rezone in 2c: seconds until the lot shows its first floor
(\`builtHeight > 0\`) and until it reaches low-rise (\`stage >= LOW\`). Median of the
district's free lots; \`>${minutes * 60}\` means it never got there in the run.

${speedTable(rows, minutes)}
`;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

function parseSeeds(arg) {
  if (!arg) return Array.from({ length: 12 }, (_, i) => i + 1);
  if (arg.includes('-')) {
    const [lo, hi] = arg.split('-').map(Number);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  return arg.split(',').map(Number);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function main() {
  if (process.argv[2] === '--worker') {
    const seed = Number(process.argv[3]);
    const minutes = Number(process.argv[4]);
    setWorldSeed(seed, true);
    const result = await worker(seed, minutes);
    // A single line so the aggregator can parse it without a shared module.
    process.stdout.write(`PROBE\t${JSON.stringify(result)}\n`);
    return;
  }
  const seeds = parseSeeds(arg('--seeds', null));
  const minutes = Math.max(Number(arg('--minutes', 10)), 10);
  const start = performance.now();
  const rows = seeds.map((seed) => {
    const out = execFileSync(process.execPath, [FILE, '--worker', String(seed), String(minutes)], {
      encoding: 'utf8', maxBuffer: 1 << 26,
    });
    const line = out.split('\n').find((l) => l.startsWith('PROBE\t'));
    if (!line) throw new Error(`seed ${seed}: no probe output`);
    return JSON.parse(line.slice(6));
  });
  const doc = buildDoc(rows, minutes);
  writeFileSync(OUT, doc);
  const ms = performance.now() - start;
  const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
  console.log(`${OUT}: ${rows.length} seeds x ${minutes} min in ${(ms / 1000).toFixed(1)} s`);
  console.log(`measurement hash: ${hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
