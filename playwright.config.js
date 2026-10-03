import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

// The gate is fast: every test that runs in Node, plus one boot of the game
// (tests/smoke.spec.js), side by side, in under a minute. A browser test boots
// the whole city and costs seconds a time; GATE_FULL=1 (`npm run gate:full`)
// runs all of them one by one, and blocks nothing.
const FULL = process.env.GATE_FULL === '1';
const FAST_FILES = fs.readdirSync('tests').filter((f) => f.endsWith('.spec.js'))
    .filter((f) => f === 'smoke.spec.js' || !/\bpage\b/.test(fs.readFileSync(`tests/${f}`, 'utf8')));

// Locally: real GPU via ANGLE — D3D11 on Windows, Metal on macOS (D3D11 does
// not exist there, and asking for it silently drops Chrome to a fallback).
// In CI there is no GPU, so we fall back to SwiftShader — valid ONLY because
// renderer.info.render.calls is a CPU-side counter and is backend-independent.
// Never read an fps number from a CI run; the charter bans SwiftShader for timing.
const ANGLE_BACKEND = process.platform === 'darwin' ? 'metal' : 'd3d11';
const GPU_ARGS = process.env.CI
    ? ['--enable-unsafe-swiftshader']
    : [`--use-angle=${ANGLE_BACKEND}`, '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

// The gate must test THIS working tree's build and no other. That is not
// automatic: with a fixed port and reuseExistingServer, a gate run in one
// worktree will silently adopt a server another worktree left listening, pass
// green, and tell you your code is fine when your code was never loaded. It
// has already happened here — three agents on parallel worktrees, one shared
// 4173, and a round of measurements that meant nothing.
//
// So: never reuse a server we did not start, and fail loudly on a busy port
// rather than let vite slide to the next one while Playwright waits on the
// old. Parallel worktrees set GATE_PORT to something distinct.
const PORT = Number(process.env.GATE_PORT || 4173);

export default defineConfig({
    testDir: './tests',
    testMatch: FULL ? undefined : FAST_FILES,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: FULL ? 1 : 4,
    reporter: [['list']],
    timeout: 90000,
    expect: { timeout: 20000 },
    use: {
        baseURL: `http://localhost:${PORT}`,
        viewport: { width: 960, height: 540 },
        trace: 'on-first-retry',
        // Windows uses installed Chrome — real GPU, and the chromium download
        // stalls there. macOS has no such stall, so it uses bundled chromium.
        // CI installs bundled chromium, where headless_shell is fine for draw counts.
        channel: process.env.CI || process.platform === 'darwin' ? 'chromium' : 'chrome',
        launchOptions: { args: GPU_ARGS },
    },
    webServer: {
        // Vite directly, never through `npm run`, which forks a grandchild the
        // kill misses: the wrapper dies, the vite server keeps the port, and the
        // next gate run meets a busy port. scripts/shot.mjs leads with this.
        command: `node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
        port: PORT,
        timeout: 60000,
        reuseExistingServer: false,
    },
});
