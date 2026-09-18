import { defineConfig } from '@playwright/test';

// Locally: real GPU via ANGLE/D3D11.
// In CI there is no GPU, so we fall back to SwiftShader — valid ONLY because
// renderer.info.render.calls is a CPU-side counter and is backend-independent.
// Never read an fps number from a CI run; the charter bans SwiftShader for timing.
const GPU_ARGS = process.env.CI
    ? ['--enable-unsafe-swiftshader']
    : ['--use-angle=d3d11', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

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
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    timeout: 90000,
    expect: { timeout: 20000 },
    use: {
        baseURL: `http://localhost:${PORT}`,
        viewport: { width: 960, height: 540 },
        trace: 'on-first-retry',
        // Locally use installed Chrome — real GPU, and no 150 MB download.
        // CI installs bundled chromium, where headless_shell is fine for draw counts.
        channel: process.env.CI ? 'chromium' : 'chrome',
        launchOptions: { args: GPU_ARGS },
    },
    webServer: {
        command: `npm run preview -- --port ${PORT} --strictPort`,
        port: PORT,
        timeout: 60000,
        reuseExistingServer: false,
    },
});
