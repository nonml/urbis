import path from 'node:path';
import { defineConfig } from '@playwright/test';
// Headed bundled chromium on the real GPU (ANGLE Metal), normal vsync: the
// question is whether a frame fits 16.7 ms, and uncapped sub-ms numbers only
// measure scheduler noise.
export default defineConfig({
    testDir: import.meta.dirname,
    testMatch: 'measure.spec.js',
    workers: 1,
    retries: 0,
    timeout: 300000,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:6091',
        viewport: { width: 1280, height: 720 },
        headless: false,
        launchOptions: {
            args: ['--use-angle=metal', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
                '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
        },
    },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js --port 6091 --strictPort',
        cwd: path.join(import.meta.dirname, '../..'),
        port: 6091,
        timeout: 60000,
        reuseExistingServer: false,
    },
});