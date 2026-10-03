import { defineConfig } from '@playwright/test';

// The M3.S2 spike's Node-only tests: no browser and no web server. From the
// repo root: `npx playwright test -c spikes/m3-traffic/playwright.config.js`.
export default defineConfig({ testDir: '.', workers: 1, timeout: 120000, reporter: [['list']] });
