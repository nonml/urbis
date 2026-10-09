// Screenshot harness — law 1 evidence from the built game, on Windows or macOS.
//
//   npm run build
//   node scripts/shot.mjs docs/shots/slice-053-noverlap '[{"name":"street"},{"name":"city","keys":["z"],"wait":2500}]'
//   node scripts/shot.mjs docs/shots/slice-053-west '[{"name":"street"}]' '&spawn=west'
//   node scripts/shot.mjs .scratch/m4-t16 '[poses]' '' --seeds 7,11,22,33,73 --budget 175
//
// Each pose is { name, keys?, js?, wait? }: keys are pressed in order (z city
// view, t day/night, h blackout hack, f the hero car), `js` is evaluated before
// the wait (one capture probe, so a pose can stand inside a space the keys
// cannot reach), then it waits `wait` ms (default 1500) and saves
// <prefix>-<name>.png. The third argument is appended to the URL — `&spawn=`
// takes east, shop, promenade or west (src/main.js). Every pose prints the draws
// now and the peak since the pose before, read on every frame: a 50 ms sampler
// misses peaks (AGENTS.md, "Prove it").
//
// `--seeds 7,11,22,33,73` measures the sweep's five seeds in one run, one
// generated world each (`?gen=1&seed=N`), every pose on each: the M4-7 check
// (docs/ROADMAP.md) is the peak per frame of every pose of every seed. The run
// asserts the world it booted is the seed it was asked for — a check that
// silently measured another world proves nothing — and exits 1 when a pose's
// peak passes `--budget` (default 175), so the check can fail. `--no-shot`
// measures without writing the frames, for a run that wants the numbers only.
//
// The browser follows playwright.config.js: installed Chrome with D3D11 on
// Windows, bundled chromium with Metal on macOS.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.SHOT_PORT || 4191);
const BOOT_TIMEOUT_MS = 30000;
const DRAW_BUDGET = 175;
// Flags may sit anywhere after the script; everything else is the positional
// triple (prefix, poses, query) the header documents.
const argv = process.argv.slice(2);
const positional = [];
const flags = new Map();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { positional.push(a); continue; }
  const next = argv[i + 1];
  if (next !== undefined && !next.startsWith('--')) { flags.set(a.slice(2), next); i += 1; }
  else flags.set(a.slice(2), true);
}
const flagValue = (name, fallback) => (flags.has(name) && flags.get(name) !== true ? flags.get(name) : fallback);
const BUDGET = Number(flagValue('budget', DRAW_BUDGET));
const SEEDS = String(flagValue('seeds', ''))
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);
const [prefix, posesJson = '[{"name":"street"}]', query = ''] = positional;
if (!prefix) {
  console.error('usage: node scripts/shot.mjs <out-prefix> [poses json] [url query] [--seeds 7,11,22,33,73] [--budget 175]');
  process.exit(1);
}
const poses = JSON.parse(posesJson);
const mac = process.platform === 'darwin';
// One run, one world per seed: null is the single boot the URL query names.
const seeds = SEEDS.length ? SEEDS : [null];

// Node runs vite directly, not through a shell, so kill() stops the server
// itself on every platform instead of orphaning it behind a dead shell.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${PORT}/`;
for (const start = Date.now(); ; await new Promise((r) => setTimeout(r, 250))) {
  if (await fetch(url).then((r) => r.ok, () => false)) break;
  if (Date.now() - start > BOOT_TIMEOUT_MS) { server.kill(); throw new Error(`preview did not start on ${PORT}`); }
}

const browser = await chromium.launch({
  channel: mac ? 'chromium' : 'chrome',
  args: [`--use-angle=${mac ? 'metal' : 'd3d11'}`, '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const over = [];
try {
  for (const seed of seeds) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    const world = seed === null ? `${url}?capture=1${query}`
      : `${url}?capture=1&gen=1&seed=${seed}${query}`;
    await page.goto(world);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: BOOT_TIMEOUT_MS });
    // The peak of every frame from here, reset before each pose's wait so the
    // number printed for a pose is the frames that pose held.
    await page.evaluate(() => {
      window.__peak = 0;
      const tick = () => { window.__peak = Math.max(window.__peak, window.__game.draws()); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    // A seed asked for and not booted is the whole run measuring nothing.
    if (seed !== null) {
      const who = await page.evaluate(() => ({ seed: window.__game.seed, generated: window.__game.generated }));
      if (who.seed !== seed || who.generated !== true) {
        errors.push(`identity: asked for seed ${seed}, booted seed ${who.seed} generated ${who.generated}`);
      }
    }
    for (const [i, p] of poses.entries()) {
      for (const k of p.keys ?? []) await page.keyboard.press(k);
      // `js` runs one capture probe (window.__game.enterLot('com')) before the
      // wait, so a pose can stand inside a space the keys cannot reach.
      if (p.js) await page.evaluate(p.js);
      await page.waitForTimeout(p.wait ?? 1500);
      // shot() renders the composer a second time, and renderer.info never
      // auto-resets in this game (render/atmosphere.js sets autoReset false,
      // main.js resets once a frame), so the frame's count is read before the
      // extra render — the same order scripts/sweep.mjs reads it in.
      const draws = await page.evaluate(() => window.__game.draws());
      const name = `${prefix}${seed === null ? '' : `-s${seed}`}-${p.name ?? i}.png`;
      // The measured numbers never need the PNG: a five-seed check poses 25
      // frames and writes 150 MB of them. --no-shot measures without it.
      if (!flags.has('no-shot')) {
        const png = await page.evaluate(() => window.__game.shot());
        writeFileSync(name, Buffer.from(png.split(',')[1], 'base64'));
      }
      const peak = await page.evaluate(() => { const p = window.__peak; window.__peak = 0; return p; });
      console.log(`${name}  draws ${draws}  peak ${peak}`);
      if (peak > BUDGET) over.push(`${name}: peak ${peak} > ${BUDGET}`);
    }
    console.log(`page errors (${seed ?? 'url'}):`, errors.length ? errors : 'none');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
for (const line of over) console.error(`over budget: ${line}`);
if (over.length) process.exitCode = 1;
