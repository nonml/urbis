#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(ROOT, 'tools', 'agent', 'baselines', 'perf.json');

const SCENES = [
  {
    name: 'empty_map',
    setup: `(() => {
      const g = window.game; if (!g) return;
      g.weatherSystem?.forceWeather('clear', 999);
      g.state.time.timeOfDay = 0.5;
    })()`,
  },
  {
    name: 'medium_map',
    setup: `(() => {
      const g = window.game; if (!g) return;
      g.weatherSystem?.forceWeather('clear', 999);
      g.state.time.timeOfDay = 0.5;
    })()`,
  },
  {
    name: 'medium_120npcs',
    setup: `(() => {
      const g = window.game; if (!g) return;
      g.weatherSystem?.forceWeather('clear', 999);
      g.state.time.timeOfDay = 0.5;
      const cx = Math.floor(g.map.width / 2);
      const cy = Math.floor(g.map.height / 2);
      while (g.citizens.citizens.length < 120) {
        g.citizens.spawnCitizen(cx + (g.citizens.citizens.length % 20) - 10,
                                cy + Math.floor(g.citizens.citizens.length / 20) - 3);
      }
    })()`,
  },
  {
    name: 'night_rain',
    setup: `(() => {
      const g = window.game; if (!g) return;
      g.weatherSystem?.forceWeather('rain', 999);
      g.state.time.timeOfDay = 0.95;
    })()`,
  },
];

// Presets to sweep — matches keys in src/render/presets.js.
const PRESETS = ['low', 'medium', 'high', 'ultra'];

const SAMPLE_DURATION_MS = 5000;
const WARMUP_MS = 2000;

async function applyPreset(page, presetName) {
  return page.evaluate((name) => {
    const r = window.game?.ui?.renderer3d;
    if (!r || typeof r.setPreset !== 'function') return false;
    return r.setPreset(name);
  }, presetName);
}

async function measureScene(page, scene) {
  await page.evaluate(scene.setup);
  await page.waitForTimeout(WARMUP_MS);

  const frameTimes = await page.evaluate((duration) => {
    return new Promise((resolve) => {
      const times = [];
      let last = performance.now();
      const end = last + duration;
      function tick() {
        const now = performance.now();
        times.push(now - last);
        last = now;
        if (now < end) {
          requestAnimationFrame(tick);
        } else {
          resolve(times);
        }
      }
      requestAnimationFrame(tick);
    });
  }, SAMPLE_DURATION_MS);

  frameTimes.sort((a, b) => a - b);
  const avg = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
  const p50 = frameTimes[Math.floor(frameTimes.length * 0.5)];
  const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
  const p99 = frameTimes[Math.floor(frameTimes.length * 0.99)];
  const fps = 1000 / avg;

  return {
    scene: scene.name,
    samples: frameTimes.length,
    avgMs: +avg.toFixed(2),
    p50Ms: +p50.toFixed(2),
    p95Ms: +p95.toFixed(2),
    p99Ms: +p99.toFixed(2),
    fps: +fps.toFixed(1),
  };
}

/** Stable per-(preset, scene) key for matching against prior baselines. */
function resultKey(r) {
  return r.preset ? `${r.preset}/${r.scene}` : r.scene;
}

async function ensureServer() {
  try {
    const res = await fetch('http://localhost:4173');
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const serverRunning = await ensureServer();
  let serverProcess = null;

  if (!serverRunning) {
    console.log('[perf] Starting preview server...');
    serverProcess = execSync('npm run build', { cwd: ROOT, stdio: 'pipe' });
  }

  // Headless Chromium defaults to SwiftShader (software) WebGL, which produces
  // meaningless ~1-2 fps numbers. Force ANGLE/D3D11 so the real GPU is used.
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  console.log('[perf] Loading game...');
  try {
    await page.goto('http://localhost:4173', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    // Start a new game so window.game (and its renderer) exists.
    const startBtn = page.locator('#start-btn');
    if (await startBtn.count()) {
      await startBtn.first().click();
    }
    // Wait for the game + 3D renderer to be live before measuring.
    await page.waitForFunction(() => !!(window.game && window.game.ui && window.game.ui.renderer3d), {
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
  } catch (err) {
    console.error('[perf] Failed to load game:', err.message);
    console.log('[perf] Ensure server is running: npm run preview');
    await browser.close();
    process.exit(1);
  }

  const results = [];
  for (const preset of PRESETS) {
    const applied = await applyPreset(page, preset);
    if (!applied) {
      console.warn(`[perf] Could not apply preset "${preset}" (renderer not ready) — skipping`);
      for (const scene of SCENES) {
        results.push({ preset, scene: scene.name, error: 'preset not applied' });
      }
      continue;
    }
    console.log(`\n[perf] Preset: ${preset}`);
    for (const scene of SCENES) {
      console.log(`[perf] Measuring: ${preset}/${scene.name}...`);
      try {
        const result = await measureScene(page, scene);
        result.preset = preset;
        results.push(result);
        console.log(`  fps=${result.fps} avg=${result.avgMs}ms p95=${result.p95Ms}ms`);
      } catch (err) {
        console.warn(`  [skip] ${preset}/${scene.name}: ${err.message}`);
        results.push({ preset, scene: scene.name, error: err.message });
      }
    }
  }

  await browser.close();

  const FPS_TARGET = 60;
  const FPS_WARN = 30;
  let budgetFailures = 0;
  console.log(`\n[perf] Budget check (target: ${FPS_TARGET} fps):`);
  for (const r of results) {
    const key = resultKey(r);
    if (r.error) { console.log(`  ${key}: SKIP (error)`); continue; }
    if (r.fps >= FPS_TARGET) {
      console.log(`  ${key}: PASS (${r.fps} fps)`);
    } else if (r.fps >= FPS_WARN) {
      console.log(`  ${key}: DEGRADED (${r.fps} fps — below ${FPS_TARGET})`);
    } else {
      console.log(`  ${key}: FAIL (${r.fps} fps — below minimum ${FPS_WARN})`);
      budgetFailures++;
    }
  }

  // Read the prior baseline BEFORE overwriting so the comparison is meaningful.
  let prev = null;
  if (existsSync(BASELINE_PATH)) {
    try { prev = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')); } catch { prev = null; }
  }

  const output = {
    timestamp: new Date().toISOString(),
    fpsTarget: FPS_TARGET,
    fpsMinimum: FPS_WARN,
    presets: PRESETS,
    results,
    budgetPass: budgetFailures === 0,
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(output, null, 2));
  console.log(`\n[perf] Results written to ${BASELINE_PATH}`);

  if (prev && prev.results) {
    let regressions = 0;
    for (const cur of results) {
      if (cur.error) continue;
      const base = prev.results.find(r => resultKey(r) === resultKey(cur));
      if (!base || base.error) continue;
      const delta = ((cur.avgMs - base.avgMs) / base.avgMs) * 100;
      if (delta > 10) {
        console.warn(`[perf] REGRESSION: ${resultKey(cur)} avg +${delta.toFixed(1)}%`);
        regressions++;
      }
    }
    if (regressions > 0) {
      console.error(`[perf] ${regressions} regression(s) detected (>10%)`);
      process.exit(1);
    }
  }

  console.log('[perf] Done — no regressions.');
}

main().catch(err => {
  console.error('[perf] Fatal:', err);
  process.exit(1);
});
