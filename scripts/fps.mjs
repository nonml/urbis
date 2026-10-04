// 60 fps harness (M7.T13, criterion M7-6): the 95th-percentile frame at the
// busiest pose, at 1280x720 and at the window's full Retina size.
//
//   npm run build
//   SHOT_PORT=6091 node scripts/fps.mjs            # FPS_PORT overrides SHOT_PORT
//
// Boots the built game exactly as scripts/shot.mjs does — vite preview on a
// strict port, bundled chromium with ANGLE Metal on macOS, installed Chrome
// with D3D11 on Windows — and measures 600 frames after 90 of warmup.
//
// The interval between rAF callbacks is vsync-clamped: on this Mac even a blank
// page reads p95 17.4 ms, so it cannot tell a frame that fits from one that does
// not (M3.S1's spike, docs/spikes/m3-render.md). The frame that M7-6 budgets is
// the work: from the frame's own start timestamp, through the game's render
// callback, to `gl.finish()` — every sim tick, scene update, shadow pass, bloom
// and grade, submitted and executed. p95 of that is the number that has to fit
// a 16.7 ms budget; the intervals are reported beside it as dropped-frame
// evidence only, and the exit code is 1 when the work p95 is 16.7 ms or more.
//
// The window is always 1280x720 CSS. "Full Retina" is that window at
// devicePixelRatio 2, a 2560x1440 backing store — the game caps its own pixel
// ratio at 2 (render/atmosphere.js createRenderer). Never measure under
// ?capture=1: preserveDrawingBuffer costs a copy every frame that play does not
// pay for, and the frame would be measured with a cost the player never sees.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.FPS_PORT || process.env.SHOT_PORT || 4192);
const TARGET_MS = 16.7;
const WARMUP = 90;
const SAMPLES = 600;
const BOOT_TIMEOUT_MS = 30000;
const VIEWPORT = { width: 1280, height: 720 };
// The busiest ordinary play poses, not a lab angle: with no query the game
// opens at its own spawn; the rest are reachable with the real keys.
const POSES = [
  { name: 'spawn', query: '' },
  { name: 'canyon', query: '&spawn=cross' },
  { name: 'promenade', query: '&spawn=promenade' },
  { name: 'cityview', query: '', keys: ['z'], settle: () => window.__game.cityview.state().lift >= 0.999 },
  { name: 'day', query: '', keys: ['t'], settle: () => window.__game.tod() < 0.02 },
];
const SCALES = [{ name: '1280x720', dpr: 1 }, { name: 'retina', dpr: 2 }];
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
  const rows = [];
  const errors = [];
  for (const scale of SCALES) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: scale.dpr });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${scale.name}/${e.message}`));
    for (const pose of POSES) {
      await page.goto(`${url}?${pose.query.replace(/^&/, '')}`);
      await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: BOOT_TIMEOUT_MS });
      for (const k of pose.keys ?? []) await page.keyboard.press(k);
      // The pose's own settle condition (the city view's rise, the night glide),
      // then a fixed pause so streaming and the first-frame costs are behind us.
      if (pose.settle) await page.waitForFunction(pose.settle, null, { timeout: BOOT_TIMEOUT_MS });
      await page.waitForTimeout(1200);
      const { work, list } = await page.evaluate(({ warm, samples }) => new Promise((resolve) => {
        const gl = document.getElementById('scene').getContext('webgl2')
          || document.getElementById('scene').getContext('webgl');
        const work = [];
        const list = [];
        let prev = 0;
        let left = warm;
        const tick = (t) => {
          if (left > 0) { left -= 1; prev = t; requestAnimationFrame(tick); return; }
          if (prev) list.push(t - prev);
          prev = t;
          // The frame's end: all of this frame's GL is submitted by the game's
          // callback (which ran just before this one), this waits for it to
          // execute. `t` is the frame's start, so now - t is the frame's cost.
          gl.finish();
          work.push(performance.now() - t);
          if (work.length < samples) requestAnimationFrame(tick);
          else resolve({ work, list });
        };
        requestAnimationFrame(tick);
      }), { warm: WARMUP, samples: SAMPLES });
      // Nearest-rank percentile: 600 samples need 570 under target for p95.
      const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.ceil(p * s.length) - 1]; };
      const work95 = pct(work, 0.95);
      const dropped = list.filter((d) => d > 25).length;
      rows.push({ scale: scale.name, pose: pose.name, work95, list95: pct(list, 0.95), dropped });
      console.log(`${scale.name.padEnd(9)} ${pose.name.padEnd(10)} work p50 ${pct(work, 0.5).toFixed(2)}  p95 ${work95.toFixed(2)}  max ${Math.max(...work).toFixed(2)}  |  interval p95 ${pct(list, 0.95).toFixed(2)}  dropped ${dropped}`);
    }
    await context.close();
  }
  const worst = rows.reduce((a, b) => (b.work95 > a.work95 ? b : a));
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(`busiest: ${worst.pose} at ${worst.scale} — frame p95 ${worst.work95.toFixed(2)} ms (target < ${TARGET_MS})`);
  if (worst.work95 >= TARGET_MS) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
