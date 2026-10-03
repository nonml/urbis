// The defect sweep — every pose in a file, on the five seeds, one boot each,
// four seeds in parallel.
//
//   npm run build
//   node scripts/sweep.mjs --poses docs/shots/poses/first-minutes.json
//
// The five seeds are always 7, 11, 22, 33 and 73, generated (ROADMAP: "five
// seeds" always means these). A pose is { name, x?, z?, yaw?, heading?, hour?,
// weather?, blackout?, city?, wait? }: position and heading go through
// __game.pose, hour through setHour + night(nightOf), blackout through H and its
// cooldown, city view through Z. `heading` is compass degrees (0 north, 90
// east). `weather` is recorded on the report, not applied: rain is the only
// weather until M26.
//
// Per shot it writes <out>/<prefix>-s<seed>-<pose>.png and a pick report
// <out>/picks/<prefix>-s<seed>-<pose>.json holding frameCheck(2), draws, the
// per-frame peak, a draw-ledger summary, and __game.pick() on a 16x9 grid with
// every raw box/cone/cylinder/sphere/icosahedron named. It then writes the draft
// review section <out>/REVIEW-<name>.md and exits 1 if the run passed the
// 10-minute budget. Preview runs on SHOT_PORT, ANGLE Metal on macOS, as
// scripts/shot.mjs does.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { nightOf } from '../src/sim/clock.js';

const SEEDS = [7, 11, 22, 33, 73];
const PICK = { cols: 16, rows: 9, w: 1280, h: 720 };
const DRAW_BUDGET = 175;
const BLOCKED_MAX = 0.02;
const TIME_BUDGET_MS = 10 * 60 * 1000;
const BOOT_TIMEOUT_MS = 60000;
const PORT = Number(process.env.SWEEP_PORT || process.env.SHOT_PORT || 4191);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const posesPath = opt('poses');
if (!posesPath || argv.includes('--help')) {
  console.error('usage: node scripts/sweep.mjs --poses docs/shots/poses/<name>.json [--out docs/shots] [--prefix p] [--seeds 7,11,22,33,73] [--jobs 4]');
  process.exit(posesPath ? 0 : 1);
}
const file = JSON.parse(readFileSync(posesPath, 'utf8'));
const poses = (file.poses ?? []).map((p, i) => ({ ...file.defaults, ...p, name: p.name ?? `pose-${i}` }));
if (poses.length === 0) {
  console.error(`no poses in ${posesPath}`);
  process.exit(1);
}
const seeds = (opt('seeds') ? opt('seeds').split(',') : SEEDS).map(Number).filter((n) => Number.isInteger(n) && n > 0);
const name = file.name ?? posesPath.split('/').pop().replace(/\.json$/, '');
const OUT = opt('out', 'docs/shots');
const PREFIX = opt('prefix', file.prefix ?? `sweep-${name}`);
const JOBS = Math.max(1, Math.min(4, Number(opt('jobs', 4))));
mkdirSync(OUT, { recursive: true });

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const darkNow = (page) => page.evaluate(() => window.__game.dark().some(Boolean));

// A leftover blackout or cooldown must not colour the next pose: skip the street
// clock until no zone is dark. `zoning.skip` is the capture-only fast-forward.
async function clearBlackout(page) {
  for (let i = 0; i < 30 && await darkNow(page); i++) {
    await page.evaluate(() => window.__game.zoning.skip(1));
    await settle(page);
  }
}

async function fireBlackout(page) {
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => { window.__game.hack(); window.__game.zoning.skip(1.2); });
    await settle(page);
    if (await darkNow(page)) return true;
  }
  return false;
}

async function setPose(page, pose) {
  if (pose.blackout !== true) await clearBlackout(page);
  const cityOn = await page.evaluate(() => window.__game.cityview.state().mode === 'city');
  if (cityOn !== (pose.city === true)) {
    await page.keyboard.press('z');
    // The lift is a fixed-step animation, so a page starved by its three
    // parallel siblings takes many slow frames to cross it.
    await page.waitForFunction((on) => {
      const s = window.__game.cityview.state();
      return on ? s.lift > 0.999 : s.lift < 0.001;
    }, pose.city === true, { timeout: BOOT_TIMEOUT_MS });
  }
  const yaw = pose.yaw ?? (pose.heading !== undefined ? (pose.heading * Math.PI) / 180 : undefined);
  if (yaw !== undefined || pose.x !== undefined || pose.z !== undefined) {
    await page.evaluate((p) => {
      const at = window.__game.player();
      window.__game.pose(p.x ?? at.x, p.z ?? at.z, p.yaw ?? 0);
    }, { x: pose.x, z: pose.z, yaw });
  }
  if (typeof pose.hour === 'number') {
    await page.evaluate(([h, n]) => { window.__game.setHour(h); window.__game.night(n); }, [pose.hour, nightOf(pose.hour)]);
  }
  const black = pose.blackout === true ? await fireBlackout(page) : false;
  await settle(page);
  await page.waitForTimeout(pose.wait ?? 600);
  return { black, city: await page.evaluate(() => window.__game.cityview.state().mode === 'city') };
}

// The scene pick report: one probe per cell of the 16x9 grid, first solid hit,
// and every raw primitive the grid landed on by name (VGA-084's list).
async function pickGrid(page) {
  return page.evaluate((g) => {
    const cells = [];
    const raw = new Map();
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const hits = window.__game.pick(((c + 0.5) / g.cols) * g.w, ((r + 0.5) / g.rows) * g.h, g.w, g.h);
        const hit = hits.find((t) => !t.see) ?? null;
        cells.push(hit && { c, r, path: hit.path, geo: hit.geo, mat: hit.mat, color: hit.color, dist: hit.dist });
        if (hit && /^(Box|Cone|Cylinder|Sphere|Icosahedron)Geometry$/.test(hit.geo ?? '')) {
          const key = `${hit.path} (${hit.geo})`;
          raw.set(key, (raw.get(key) ?? 0) + 1);
        }
      }
    }
    return { cols: g.cols, rows: g.rows, cells, raw: [...raw].map(([key, n]) => ({ key, n })) };
  }, PICK);
}

function ledgerSummary(frames) {
  const rows = frames[0] ?? [];
  const byPass = {};
  const byKey = new Map();
  for (const row of rows) {
    byPass[row.pass] = (byPass[row.pass] ?? 0) + 1;
    const key = `${row.name || row.type} · ${row.material}${row.instances ? ` ×${row.instances}` : ''}`;
    byKey.set(key, (byKey.get(key) ?? 0) + 1);
  }
  return { draws: rows.length, byPass, top: [...byKey].sort((a, b) => b[1] - a[1]).slice(0, 8) };
}

async function sweepPose(page, seed, pose) {
  const state = await setPose(page, pose);
  // draws is read before shot(): shot renders the composer a second time and
  // would double the count (renderer.info never auto-resets in this game).
  const { draws, png } = await page.evaluate(() => ({ draws: window.__game.draws(), png: window.__game.shot() }));
  const shot = `${PREFIX}-s${seed}-${pose.name}`;
  writeFileSync(`${OUT}/${shot}.png`, Buffer.from(png.split(',')[1], 'base64'));
  const peak = await page.evaluate(() => { const p = window.__peak; window.__peak = 0; return p; });
  const fc = await page.evaluate(() => window.__game.frameCheck(2));
  const ledger = ledgerSummary(await page.evaluate(() => window.__game.ledger(1)));
  const grid = await pickGrid(page);
  const flags = [];
  if (pose.blackout === true && !state.black) flags.push('blackout did not land');
  if (draws > DRAW_BUDGET) flags.push(`draws ${draws} > ${DRAW_BUDGET}`);
  if (peak > DRAW_BUDGET) flags.push(`peak ${peak} > ${DRAW_BUDGET}`);
  if (fc.blocked > BLOCKED_MAX) flags.push(`frameCheck ${(fc.blocked * 100).toFixed(1)}% > 2%`);
  if (grid.raw.length) flags.push(`raw primitives: ${grid.raw.map((x) => `${x.key} ×${x.n}`).join(', ')}`);
  if (pose.weather && pose.weather !== 'rain') flags.push(`weather "${pose.weather}" not implemented (rain only)`);
  const report = {
    seed, pose: pose.name, shot: `${shot}.png`, hour: pose.hour ?? null,
    weather: pose.weather ?? 'rain', city: state.city, dark: await darkNow(page),
    draws, peak, blocked: fc.blocked, blockers: fc.blockers, ledger, grid, flags,
  };
  mkdirSync(`${OUT}/picks`, { recursive: true });
  writeFileSync(`${OUT}/picks/${shot}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`  s${seed} ${pose.name}: draws ${draws} peak ${peak} blocked ${(fc.blocked * 100).toFixed(1)}%${flags.length ? ` · ${flags.length} flagged` : ''}`);
  return report;
}

async function sweepSeed(browser, seed, poses) {
  const page = await browser.newPage({ viewport: { width: PICK.w, height: PICK.h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const shots = [];
  try {
    // commit, not load: the load event waits for four generated worlds to build
    // at once, and only __game.draws() says the world is really up.
    await page.goto(`http://localhost:${PORT}/?capture=1&seed=${seed}&gen=1`, { waitUntil: 'commit', timeout: BOOT_TIMEOUT_MS });
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: BOOT_TIMEOUT_MS });
    const who = await page.evaluate(() => ({ seed: window.__game.seed, generated: window.__game.generated }));
    if (who.seed !== seed || who.generated !== true) errors.push(`identity: seed ${who.seed} generated ${who.generated}`);
    await page.evaluate(() => {
      window.__peak = 0;
      const tick = () => { window.__peak = Math.max(window.__peak, window.__game.draws()); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    for (const pose of poses) shots.push(await sweepPose(page, seed, pose));
  } finally {
    await page.close();
  }
  console.log(`seed ${seed}: ${shots.length} shots, ${errors.length} error(s)`);
  return { seed, errors, shots };
}

function reviewDraft(reports, elapsed) {
  const shots = reports.flatMap((r) => r.shots);
  const flagged = shots.filter((s) => s.flags.length > 0);
  const errors = reports.flatMap((r) => r.errors.map((e) => `seed ${r.seed}: ${e}`));
  const worst = shots.reduce((m, s) => Math.max(m, s.peak), 0);
  const table = shots.map((s) => `| ${s.shot} | ${s.seed} | ${s.draws} | ${s.peak} | ${(s.blocked * 100).toFixed(1)}% | ${s.flags.join('; ') || '—'} |`);
  return [
    `## ${new Date().toISOString().slice(0, 10)} — sweep draft: ${name} (${shots.length} shots)`,
    '',
    'Draft for `docs/shots/REVIEW.md` — judge every shot before pasting (AGENTS.md step 5).',
    '',
    `\`node scripts/sweep.mjs --poses ${posesPath}\` on seeds ${seeds.join(', ')} (generated); ` +
      `${(elapsed / 60000).toFixed(1)} min of the 10 min budget; draws ≤ ${DRAW_BUDGET}, frameCheck ≤ 2%.`,
    `Worst peak ${worst}; ${flagged.length} of ${shots.length} shots flagged; ${errors.length} page error(s).`,
    '',
    '| Shot | Seed | draws | peak | blocked | Flags |',
    '|---|---|---|---|---|---|',
    ...table,
    ...(flagged.length ? ['', '### Flags', '', ...flagged.map((s) => `- **${s.shot}** — ${s.flags.join('; ')}`)] : []),
    ...(errors.length ? ['', '### Page errors', '', ...errors.map((e) => `- ${e}`)] : []),
    '',
  ].join('\n');
}

const started = Date.now();
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const mac = process.platform === 'darwin';
let browser = null;
let reports = [];
try {
  for (let t = Date.now(); ; await sleep(250)) {
    if (await fetch(`http://localhost:${PORT}/`).then((r) => r.ok, () => false)) break;
    if (Date.now() - t > BOOT_TIMEOUT_MS) throw new Error(`preview did not start on ${PORT}`);
  }
  browser = await chromium.launch({
    channel: mac ? 'chromium' : 'chrome',
    args: [`--use-angle=${mac ? 'metal' : 'd3d11'}`, '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  });
  const queue = [...seeds];
  await Promise.all(Array.from({ length: Math.min(JOBS, seeds.length) }, async () => {
    for (let seed = queue.shift(); seed !== undefined; seed = queue.shift()) {
      reports.push(await sweepSeed(browser, seed, poses));
    }
  }));
  reports.sort((a, b) => seeds.indexOf(a.seed) - seeds.indexOf(b.seed));
} finally {
  if (browser) await browser.close();
  server.kill();
}

const elapsed = Date.now() - started;
const count = reports.reduce((n, r) => n + r.shots.length, 0);
writeFileSync(`${OUT}/REVIEW-${name}.md`, reviewDraft(reports, elapsed));
const under = elapsed <= TIME_BUDGET_MS;
console.log(`${count} shots in ${(elapsed / 60000).toFixed(1)} min (under 10: ${under ? 'yes' : 'no'})`);
console.log(`draft review: ${OUT}/REVIEW-${name}.md`);
process.exitCode = under ? 0 : 1;
