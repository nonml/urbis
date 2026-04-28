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
  { name: 'empty_map', setup: 'window.__perfScene="empty"' },
  { name: 'medium_map', setup: 'window.__perfScene="medium"' },
  { name: 'medium_120npcs', setup: 'window.__perfScene="medium_npcs"' },
  { name: 'night_rain', setup: 'window.__perfScene="night_rain"' },
];

const SAMPLE_DURATION_MS = 5000;
const WARMUP_MS = 2000;

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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  console.log('[perf] Loading game...');
  try {
    await page.goto('http://localhost:4173', { timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch (err) {
    console.error('[perf] Failed to load game:', err.message);
    console.log('[perf] Ensure server is running: npm run preview');
    await browser.close();
    process.exit(1);
  }

  const results = [];
  for (const scene of SCENES) {
    console.log(`[perf] Measuring: ${scene.name}...`);
    try {
      const result = await measureScene(page, scene);
      results.push(result);
      console.log(`  fps=${result.fps} avg=${result.avgMs}ms p95=${result.p95Ms}ms`);
    } catch (err) {
      console.warn(`  [skip] ${scene.name}: ${err.message}`);
      results.push({ scene: scene.name, error: err.message });
    }
  }

  await browser.close();

  const output = {
    timestamp: new Date().toISOString(),
    results,
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(output, null, 2));
  console.log(`[perf] Results written to ${BASELINE_PATH}`);

  if (existsSync(BASELINE_PATH)) {
    const prev = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
    if (prev.results) {
      let regressions = 0;
      for (const cur of results) {
        if (cur.error) continue;
        const base = prev.results.find(r => r.scene === cur.scene);
        if (!base || base.error) continue;
        const delta = ((cur.avgMs - base.avgMs) / base.avgMs) * 100;
        if (delta > 10) {
          console.warn(`[perf] REGRESSION: ${cur.scene} avg +${delta.toFixed(1)}%`);
          regressions++;
        }
      }
      if (regressions > 0) {
        console.error(`[perf] ${regressions} regression(s) detected (>10%)`);
        process.exit(1);
      }
    }
  }

  console.log('[perf] Done — no regressions.');
}

main().catch(err => {
  console.error('[perf] Fatal:', err);
  process.exit(1);
});
