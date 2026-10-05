// M1-2 (docs/ROADMAP.md): A zones the busiest district's 2 free lots for works at
// minute 1; B touches nothing; by minute 5 A has at least 1 more flat storey than B
// in that district, on 4 of 5 seeds. M1-3 rides the same run: on every seed where
// M1-2 passes, A's news names the rezone as the cause ("...for the new workshops")
// within 5 game minutes, and B never shows a credit line at all. Node only; one
// seed per process = its own worker.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const POKE_AT = 60;
const SECS = 300;
if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  // The seed first: news.js pulls in the sim modules, and ab.js refuses a sim
  // evaluated for another seed (layout reads the seed at module load).
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createNews, tickNews } = await import('../../src/sim/news.js');
  const { runAB } = await import('./lib/ab.js');
  const zoneOf = (w) => {
    const h = w.city.economy.districts.map((_, z) =>
      w.city.parcels.filter((p) => p.powerZone === z).reduce((s, p) => s + w.heightOf(p), 0));
    return h[1] > h[0] ? 1 : 0;
  };
  const flats = (w, zone) => w.city.parcels
    .filter((p) => p.powerZone === zone && p.use === 'res')
    .reduce((s, p) => s + Math.floor(w.heightOf(p) / w.thresholds.storey + 1e-6), 0);
  // M1-3: the line the news would print. Tick both worlds' news every step, as
  // main.js does after the city, and keep the first credit each world shows.
  const newsPoked = createNews(), newsBase = createNews();
  let zone = 0, free = 0, end = null, done = false, credit = { poked: null, base: null };
  const firstCredit = (news, t, mark) => {
    if (mark.value !== null) return;
    const item = news.items.find((i) => /for the new /.test(i.text));
    if (item) mark.value = { at: +t.toFixed(1), text: item.text };
  };
  const creditPoked = { value: null }, creditBase = { value: null };
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
      tickNews(newsPoked, poked.city, poked.people, poked.street);
      tickNews(newsBase, base.city, base.people, base.street);
      firstCredit(newsPoked, t, creditPoked);
      firstCredit(newsBase, t, creditBase);
      if (!end && t >= SECS) {
        end = { base: flats(base, zone), poked: flats(poked, zone) };
        credit = { poked: creditPoked.value, base: creditBase.value };
      }
    },
  });
  process.stdout.write(`${JSON.stringify({ seed, zone, free, ...end, credit })}\n`);
  process.exit(0);
}
test('M1-2: works on the free lots finish more flats than an untouched city', () => {
  const rows = SEEDS.map((seed) =>
    JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], { encoding: 'utf8' }).trim().split('\n').pop()));
  for (const r of rows) expect(r.free, `seed ${r.seed}: the district has 2 free lots to zone`).toBe(2);
  const better = rows.filter((r) => r.poked - r.base >= 1).length;
  const seen = rows.map((r) => `seed ${r.seed} zone ${r.zone}: ${r.poked - r.base >= 0 ? '+' : ''}${r.poked - r.base}`).join(', ');
  expect(better, `seeds with at least +1 flat storey (A minus B): ${seen}`).toBeGreaterThanOrEqual(4);
});

test('M1-3: the rezone earns its credit line, and the untouched city never does', () => {
  const rows = SEEDS.map((seed) =>
    JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], { encoding: 'utf8' }).trim().split('\n').pop()));
  const missed = rows
    .filter((r) => r.poked - r.base >= 1)
    .filter((r) => !r.credit.poked || r.credit.poked.at > SECS || !/for the new workshops/.test(r.credit.poked.text))
    .map((r) => `seed ${r.seed}: ${JSON.stringify(r.credit.poked)}`);
  expect(missed, `seeds where M1-2 passed and the credit line did not:\n${missed.join('\n')}`).toEqual([]);
  const claimed = rows.filter((r) => r.credit.base !== null)
    .map((r) => `seed ${r.seed}: ${JSON.stringify(r.credit.base)}`);
  expect(claimed, `untouched cities that showed a credit line:\n${claimed.join('\n')}`).toEqual([]);
});
