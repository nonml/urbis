// M4-5 (docs/ROADMAP.md): the act stays its size. A/B on each of the five
// seeds: a blackout in one district leaves every district no resident commutes
// through or to bit-identical, and the districts the commute links reach differ
// only in the commute times and the trade those carry. Node only: no page
// opens, one seed per process (the A/B runner boots the sim from the seed).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const AT = 60;
const SECS = 180;
const TRADE = new Set(['wealth', 'need', 'price', 'demand']);
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { districtAt } = await import('../../src/sim/map.js');
  const { districtReport } = await import('../../src/sim/economy.js');
  const { runAB } = await import('./lib/ab.js');

  // Everything a district is except the fields the commute's trade moves.
  const struct = (w, id) => {
    const d = w.city.economy.districts[id];
    const kept = Object.fromEntries(Object.keys(d).filter((k) => !TRADE.has(k)).map((k) => [k, d[k]]));
    return hash({ d: kept, parcels: w.city.parcels.filter((p) => p.powerZone === id) });
  };
  // A linked district may trade and grow differently: growth is the trade the
  // commute carries. What no commute can move is its identity, size and power.
  const still = (w, id) => {
    const d = w.city.economy.districts[id];
    return hash([d.id, d.name, d.calm, d.size, d.base, d.dark]);
  };
  const trade = (w, id) => {
    const d = w.city.economy.districts[id];
    return { wealth: d.wealth, need: d.need, price: d.price, demand: d.demand,
      commute: districtReport(w.city)[id].commute };
  };
  // The districts a resident's commute goes through or to: a pair's home and
  // job area, and the area of every edge on its route. A blackout in x can only
  // reach these.
  const reachOf = (w, x) => {
    const map = w.street.traffic.map;
    const f = w.street.traffic.flow;
    const nodes = new Map(map.graph.nodes.map((n) => [n.id, n]));
    const edges = new Map(map.graph.edges.map((e) => [e.id, e]));
    const reach = new Set([x]);
    for (const pair of f?.pairs ?? []) {
      const zones = new Set();
      const home = map.parcels[pair.m.i];
      const job = map.parcels[pair.m.j];
      if (home) zones.add(home.powerZone);
      if (job) zones.add(job.powerZone);
      for (const id of Array.isArray(pair.route) ? pair.route : []) {
        const e = edges.get(id);
        if (!e) continue;
        const a = nodes.get(e.a);
        const b = nodes.get(e.b);
        const hit = districtAt(map, (a.x + b.x) / 2, (a.z + b.z) / 2);
        if (hit) zones.add(hit.id);
      }
      if (zones.has(x)) for (const z of zones) reach.add(z);
    }
    return [...reach].sort((a, b) => a - b);
  };

  let x = -1;
  let reach = null;
  let reachFlow = null;
  let final = null;
  const actDark = [false, false];
  await runAB({
    seed, at: AT, secs: SECS,
    sample: ({ base, poked }, t) => {
      if (x < 0) x = base.city.economy.districts.reduce((b, d, i, a) => (d.size > a[b].size ? i : b), 0);
      actDark[0] ||= base.city.economy.districts[x].dark;
      actDark[1] ||= poked.city.economy.districts[x].dark;
      // Every routed hour widens the reach: routes solve over many ticks, so a
      // check of the first non-empty pair list would miss links.
      const flow = base.street.traffic.flow;
      if (flow?.stage === 'ready' && flow !== reachFlow) {
        reachFlow = flow;
        const seen = reachOf(base, x);
        reach = reach === null ? seen : [...new Set([...reach, ...seen])].sort((a, b) => a - b);
      }
      if (t >= SECS) final = { base, poked };
    },
    poke: (w) => w.hack(x),
  });

  const { base, poked } = final;
  const zones = base.city.economy.districts.length;
  const fullBad = [];
  const structBad = [];
  const changed = [];
  for (let id = 0; id < zones; id++) {
    const inside = (reach ?? [x]).includes(id);
    if (!inside) {
      if (struct(base, id) !== struct(poked, id) || hash(trade(base, id)) !== hash(trade(poked, id))) fullBad.push(id);
    } else if (id !== x) {
      if (still(base, id) !== still(poked, id)) structBad.push(id);
      if (hash(trade(base, id)) !== hash(trade(poked, id))) changed.push(id);
    }
  }
  process.stdout.write(`${JSON.stringify({
    seed, x, zones, reach: reach ?? [x], fullBad, structBad, changed,
    actDark, actChanged: struct(base, x) !== struct(poked, x),
  })}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(90000);

for (const seed of SEEDS) {
  test(`M4-5 seed ${seed}: a blackout reaches only through the commute links`, () => {
    // M4.T1's red check (a blackout reaches no other district today); M4.T18,
    // locality, makes it pass: drop this then.
    const r = row(seed);
    expect(r.reach.length, `seed ${seed}: districts a commute reaches from ${r.x}: ${r.reach}`).toBeGreaterThan(1);
    expect(r.fullBad, `seed ${seed}: districts outside reach ${r.reach} changed: ${r.fullBad}`).toEqual([]);
    expect(r.structBad, `seed ${seed}: reach districts leaked beyond trade: ${r.structBad}`).toEqual([]);
    expect(r.changed, `seed ${seed}: no district linked to ${r.x} changed: reach ${r.reach}`).not.toEqual([]);
    expect(r.actDark, `seed ${seed}: dark seen [control, poked]`).toEqual([false, true]);
    expect(r.actChanged, `seed ${seed}: the hacked district ${r.x} did not change`).toBe(true);
  });
}
