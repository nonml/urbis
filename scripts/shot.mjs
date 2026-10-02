// Screenshot harness — law 1 evidence from the built game, on Windows or macOS.
//
//   npm run build
//   node scripts/shot.mjs docs/shots/slice-053-noverlap '[{"name":"street"},{"name":"city","keys":["z"],"wait":2500}]'
//   node scripts/shot.mjs docs/shots/slice-053-west '[{"name":"street"}]' '&spawn=west'
//
// Each pose is { name, keys?, wait? }: keys are pressed in order (z city view,
// t day/night, h blackout hack), then it waits `wait` ms (default 1500) and saves
// <prefix>-<name>.png. The third argument is appended to the URL — `&spawn=` takes
// east, shop, promenade or west (src/main.js). Every pose prints the draws now
// and the peak since the pose before, read on every frame: a 50 ms sampler
// misses peaks (AGENTS.md, "Prove it").
//
// The browser follows playwright.config.js: installed Chrome with D3D11 on
// Windows, bundled chromium with Metal on macOS.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.SHOT_PORT || 4191);
const BOOT_TIMEOUT_MS = 30000;
const [,, prefix, posesJson = '[{"name":"street"}]', query = ''] = process.argv;
if (!prefix) {
  console.error('usage: node scripts/shot.mjs <out-prefix> [poses json] [url query]');
  process.exit(1);
}
const poses = JSON.parse(posesJson);
const mac = process.platform === 'darwin';

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
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(`${url}?capture=1${query}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: BOOT_TIMEOUT_MS });
  await page.evaluate(() => {
    window.__peak = 0;
    const tick = () => { window.__peak = Math.max(window.__peak, window.__game.draws()); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  for (const [i, p] of poses.entries()) {
    for (const k of p.keys ?? []) await page.keyboard.press(k);
    // `js` runs one capture probe (window.__game.enterLot('com')) before the
    // wait, so a pose can stand inside a space the keys cannot reach.
    if (p.js) await page.evaluate(p.js);
    await page.waitForTimeout(p.wait ?? 1500);
    const png = await page.evaluate(() => window.__game.shot());
    const name = `${prefix}-${p.name ?? i}.png`;
    writeFileSync(name, Buffer.from(png.split(',')[1], 'base64'));
    const { draws, peak } = await page.evaluate(() => ({ draws: window.__game.draws(), peak: window.__peak }));
    await page.evaluate(() => { window.__peak = 0; });
    console.log(`${name}  draws ${draws}  peak ${peak}`);
  }
  console.log('page errors:', errors.length ? errors : 'none');
} finally {
  await browser.close();
  server.kill();
}
