// M4-7 (docs/ROADMAP.md, task M4.T16): draws at or under 175 on every frame at
// the busiest pose of each seed. The check the task names is scripts/shot.mjs's
// peak per frame on the five seeds, so this test runs exactly that — the same
// harness a human runs for law-1 evidence — with the poses a player reaches
// through the keys (T day/night, Z the city view, H the blackout, F the car)
// and the sim call the frame loop makes for a chase, and asserts the peaks it
// measured.
//
// The numbers cannot be read in Node: the peak is renderer.info.render.calls on
// every requestAnimationFrame of the running bundle, which only a browser has.
// The check runs with --no-shot: a five-seed measurement's evidence is the
// printed peaks, not 25 frames nobody looks at.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// The sweep's five seeds (scripts/sweep.mjs: "five seeds" always means these).
const SEEDS = [7, 11, 22, 33, 73];
const DRAW_BUDGET = 175;
const PORT = process.env.SHOT_PORT || '6691';
const PREFIX = '.scratch/m4-t16';
// The busiest poses, in the order a player reaches them. Each is measured on
// every frame of its own wait, not sampled: a 50 ms poll misses the peaks
// (AGENTS.md, "Prove it").
//   street    the opening frame at the spawn, on foot, night.
//   day       T: the glide to day, the frames where the day shadow pass and the
//             night's lit pools, streaks and glows are all drawn at once.
//   city      Z: the overview, every building of the town in the one frustum.
//   blackout  H: the overview in a blackout — the pursuit car, the hack pulse,
//             the sparks and the mirror faces on top of that.
//   chase     Z, F, H: back on the street in the car, a crime and the pursuit
//             the frame loop's tickWanted answers it with.
const POSES = [
  { name: 'street' },
  { name: 'day', keys: ['t'], wait: 3000 },
  { name: 'city', keys: ['z'], wait: 3000 },
  { name: 'blackout', keys: ['h'], wait: 4000 },
  { name: 'chase', keys: ['z', 'f', 'h'], js: 'window.__game.police.tier(3)', wait: 6000 },
];

test('M4-7: every frame at the busiest pose of each seed stays within 175 draws', () => {
  test.setTimeout(420000);
  // The check exits 1 when a peak passes the budget; the peaks are read from
  // its stdout either way, so a failure reports the number, not just a code.
  let out = '';
  try {
    out = execFileSync(process.execPath, [
      'scripts/shot.mjs', PREFIX, JSON.stringify(POSES), '', '--seeds', SEEDS.join(','), '--budget', String(DRAW_BUDGET), '--no-shot',
    ], { encoding: 'utf8', env: { ...process.env, SHOT_PORT: PORT } });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const lines = out.split('\n');
  const rows = new Map();
  for (const line of lines) {
    const m = /-s(\d+)-([a-z-]+)\.png\s+draws (\d+)\s+peak (\d+)/.exec(line);
    if (m) rows.set(`${m[1]}:${m[2]}`, { seed: Number(m[1]), pose: m[2], draws: Number(m[3]), peak: Number(m[4]) });
  }

  // The check measured the five seeds, and no other world: a run that boots one
  // seed and calls it five has proved nothing (AGENTS.md, parallel worktrees).
  for (const seed of SEEDS) {
    for (const pose of POSES) {
      expect(rows.get(`${seed}:${pose.name}`),
        `seed ${seed}, pose ${pose.name}: no measured frame in the check's output\n${out}`).toBeTruthy();
    }
  }
  for (const seed of SEEDS) {
    expect(out, `seed ${seed}: the check booted it clean`).toContain(`page errors (${seed}): none`);
  }

  for (const seed of SEEDS) {
    const worst = POSES.reduce((m, p) => Math.max(m, rows.get(`${seed}:${p.name}`).peak), 0);
    for (const pose of POSES) {
      const r = rows.get(`${seed}:${pose.name}`);
      const where = `seed ${seed}, pose ${pose.name}`;
      // The sweep read real frames: a peak below the frame it covers, or a
      // peak of zero, is a broken instrument rather than a cheap one.
      expect(r.peak, `${where}: the peak covers the frame it swept`).toBeGreaterThanOrEqual(r.draws);
      expect(r.draws, `${where}: the game drew something`).toBeGreaterThan(0);
      expect(r.peak, `${where}: peak ${r.peak} over ${DRAW_BUDGET} draws`).toBeLessThanOrEqual(DRAW_BUDGET);
    }
    // The busiest pose really is busier than the opening frame, so the check
    // has teeth: a harness that reports an idle frame everywhere passes it.
    expect(rows.get(`${seed}:day`).peak, `seed ${seed}: the day frame costs more than the night one`)
      .toBeGreaterThan(rows.get(`${seed}:street`).peak);
    expect(worst, `seed ${seed}: worst peak ${worst}`).toBeLessThanOrEqual(DRAW_BUDGET);
  }
});
