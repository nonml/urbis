// M1-4 (docs/ROADMAP.md): left alone for 10 game minutes, no district's demand for
// any use may sit pinned (>= BREAK_GROUND_AT) or idle (< DECLINE_AT) for more than
// 40% of samples, on all five seeds. Thresholds are the shipped sim's own, read
// through the A/B runner. Node only; one seed per process = its own worker.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const FILE = fileURLToPath(import.meta.url);
const SEEDS = [1, 2, 3, 4, 5];
const SECS = 600;
const USES = ['res', 'com', 'ind'];
const LIMIT = 0.4;
if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { runAB } = await import('./lib/ab.js');
  const zones = [];
  await runAB({
    seed, secs: SECS,
    sample: ({ base }) => {
      const { breakGroundAt, declineAt } = base.thresholds;
      base.city.economy.districts.forEach((d, i) => {
        const r = (zones[i] ??= { zone: i, samples: 0, pinned: {}, idle: {} });
        r.samples += 1;
        for (const use of USES) {
          if (d.demand[use] >= breakGroundAt) r.pinned[use] = (r.pinned[use] ?? 0) + 1;
          if (d.demand[use] < declineAt) r.idle[use] = (r.idle[use] ?? 0) + 1;
        }
      });
    },
  });
  process.stdout.write(`${JSON.stringify({ seed, zones })}\n`);
  process.exit(0);
}
test('M1-4: ten quiet minutes never pin or idle a district use past 40%', () => {
  // M1.T1's red check (every seed pins a use today); M1.T3, calm demand, makes it pass: drop this then.
  test.fail(true, 'M1-4 red: districts pin demand far past 40% of samples yet');
  const data = SEEDS.map((seed) =>
    JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], { encoding: 'utf8' }).trim().split('\n').pop()));
  const bad = [];
  for (const { seed, zones } of data) {
    for (const r of zones) {
      for (const use of USES) {
        const pinned = (r.pinned[use] ?? 0) / r.samples, idle = (r.idle[use] ?? 0) / r.samples;
        if (pinned > LIMIT || idle > LIMIT) {
          bad.push(`seed ${seed} zone ${r.zone} ${use}: pinned ${(pinned * 100).toFixed(1)}% idle ${(idle * 100).toFixed(1)}%`);
        }
      }
    }
  }
  expect(bad, `over ${LIMIT * 100}% of samples:\n${bad.join('\n')}`).toEqual([]);
});
