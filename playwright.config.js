import { defineConfig } from '@playwright/test';

// Locally: real GPU via ANGLE/D3D11.
// In CI there is no GPU, so we fall back to SwiftShader — valid ONLY because
// renderer.info.render.calls is a CPU-side counter and is backend-independent.
// Never read an fps number from a CI run; the charter bans SwiftShader for timing.
const GPU_ARGS = process.env.CI
    ? ['--enable-unsafe-swiftshader']
    : ['--use-angle=d3d11', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

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
        baseURL: 'http://localhost:4173',
        viewport: { width: 960, height: 540 },
        trace: 'on-first-retry',
        // Full chromium, not headless_shell — the shell has no real GPU path.
        channel: 'chromium',
        launchOptions: { args: GPU_ARGS },
    },
    webServer: {
        command: 'npm run preview',
        port: 4173,
        timeout: 60000,
        reuseExistingServer: !process.env.CI,
    },
});
