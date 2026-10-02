// Layout meter — procgen stage 4: what the overlap checker says about ten
// generated layouts. A meter, not a gate: it prints numbers to drive later
// stages toward zero and always exits 0 (docs/handoff/procgen-4-wire.md).
import { spawnSync } from 'node:child_process';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function measure(seed) {
  const run = spawnSync(
    process.execPath,
    ['scripts/check_overlap.mjs', '--seed', String(seed)],
    { encoding: 'utf8' },
  );
  const out = run.stdout ?? '';
  return {
    overlap: /^overlap: (\d+)/m.exec(out)?.[1] ?? '?',
    road: /^road: (\d+)/m.exec(out)?.[1] ?? '?',
    worst: /^frontage: worst row ([\d.]+)%/m.exec(out)?.[1] ?? '?',
  };
}

let overlapTotal = 0;
let roadTotal = 0;
for (const seed of SEEDS) {
  const { overlap, road, worst } = measure(seed);
  overlapTotal += Number(overlap);
  roadTotal += Number(road);
  console.log(`seed ${seed}: overlap ${overlap}, road ${road}, worst row ${worst}%`);
}
console.log(`total: overlap ${overlapTotal}, road ${roadTotal}`);
