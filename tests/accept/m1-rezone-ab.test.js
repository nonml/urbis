// M1-2 (docs/ROADMAP.md): A zones the busiest district's 2 free lots for works at
// minute 1; B touches nothing; by minute 5 A has at least 1 more flat storey than B
// in that district, on 4 of 5 seeds. Node only; one seed per process = its own worker.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const FILE = fileURLToPath(import.meta.url);
const SEEDS = [1, 2, 3, 4, 5];
const POKE_AT = 60;
const SECS = 300;
if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { runAB } = await import('./lib/ab.js');
  const zoneOf = (w) => {
    const h = w.city.economy.districts.map((_, z) =>
      w.city.parcels.filter((p) => p.powerZone === z).reduce((s, p) => s + w.heightOf(p), 0));
    return h[1] > h[0] ? 1 : 0;
  };
  const flats = (w, zone) => w.city.parcels
    .filter((p) => p.powerZone === zone && p.use === 'res')
    .reduce((s, p) => s + Math.floor(w.heightOf(p) / w.thresholds.storey + 1e-6), 0);
  let zone = 0, free = 0, end = null, done = false;
  await runAB({
    seed, at: POKE_AT, secs: SECS,
    poke: (b, a) => {
      if (done) return;
      done = true;
      zone = zoneOf(a);
      const lots = a.city.parcels.map((p, i) => (p.powerZone === zone && p.zoned === null ? i : -1)).filter((i) => i >= 0);
      free = lots.length;
      for (const i of lots) b.zone(i, 'ind');
    },
    sample: ({ base, poked }, t) => {
      if (!end && t >= SECS) end = { base: flats(base, zone), poked: flats(poked, zone) };
    },
  });
  process.stdout.write(`${JSON.stringify({ seed, zone, free, ...end })}\n`);
  process.exit(0);
}
test('M1-2: works on the free lots finish more flats than an untouched city', () => {
  // M1.T1's red check (0/5 seeds today); M1.T3, calm demand, makes it pass: drop this then.
  test.fail(true, 'M1-2 red: the rezone adds no flat storeys on any seed yet');
  const rows = SEEDS.map((seed) =>
    JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], { encoding: 'utf8' }).trim().split('\n').pop()));
  for (const r of rows) expect(r.free, `seed ${r.seed}: the district has 2 free lots to zone`).toBe(2);
  const better = rows.filter((r) => r.poked - r.base >= 1).length;
  const seen = rows.map((r) => `seed ${r.seed} zone ${r.zone}: ${r.poked - r.base >= 0 ? '+' : ''}${r.poked - r.base}`).join(', ');
  expect(better, `seeds with at least +1 flat storey (A minus B): ${seen}`).toBeGreaterThanOrEqual(4);
});
