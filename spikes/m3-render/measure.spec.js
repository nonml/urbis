import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
const OUT = path.join(import.meta.dirname, 'results.json');
const CONFIGS = [];
for (const mesh of ['instanced', 'batched'])
    for (const cam of ['play', 'city'])
        for (const dpr of [1, 2])
            for (const night of [0, 1]) CONFIGS.push({ mesh, cam, dpr, night });
test('M3.S1 pooled city render spike', async ({ page }) => {
    test.setTimeout(300000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    const rows = [];
    for (const c of CONFIGS) {
        errors.length = 0;
        const url = `/spikes/m3-render/index.html?mesh=${c.mesh}&cam=${c.cam}&dpr=${c.dpr}&night=${c.night}`;
        await page.bringToFront();
        await page.goto(url);
        await page.waitForFunction(() => window.__spike?.done === true, null, { timeout: 120000 });
        const r = await page.evaluate(() => window.__spike.result);
        const where = `${url}\n${JSON.stringify(r)}\n${errors.join('\n')}`;
        expect(errors, where).toEqual([]);
        expect(r.error, where).toBeNull();
        expect(r.frames, where).toBe(600);
        expect(r.draws, where).toBe(c.night ? 8 : 14);
        rows.push(r);
    }
    fs.writeFileSync(OUT, `${JSON.stringify({ measured: new Date().toISOString(), rows }, null, 2)}\n`);
    const head = ['mesh', 'cam', 'dpr', 'night', 'backing', 'draws', 'p50', 'p95', 'max', 'late>20', 'workP95'];
    const table = [head, ...rows.map((r) => [r.mesh, r.cam, `x${r.dpr}`, r.night ? 'night' : 'day',
        r.backing, r.draws, r.p50, r.p95, r.max, r.late, r.renderP95])];
    const w = head.map((_, i) => Math.max(...table.map((row) => String(row[i]).length)));
    process.stdout.write(`${table.map((row) => row.map((v, i) => String(v).padEnd(w[i])).join('  ')).join('\n')}\n`);
});