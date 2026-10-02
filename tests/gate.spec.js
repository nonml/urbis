import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

const DRAW_BUDGET = 175;
const SHOT_DIR = 'docs/shots/gate';

function saveShot(dataUrl, name) {
    mkdirSync(SHOT_DIR, { recursive: true });
    writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

async function boot(page) {
    await page.goto('/?capture=1');
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
}

test('boots and exposes the debug API', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    const api = await page.evaluate(() => Object.keys(window.__game));
    expect(api).toEqual(expect.arrayContaining(['draws', 'hack', 'dark', 'player', 'heat', 'mission', 'city']));
    expect(errors).toEqual([]);
});

test('a new game takes its seed from the url, and pins the fixed one without it', async ({ page }) => {
    await page.goto('/?seed=7');
    await page.waitForFunction(() => window.__game?.seed > 0);
    expect(await page.evaluate(() => window.__game.seed)).toBe(7);

    await page.goto('/');
    await page.waitForFunction(() => window.__game?.seed > 0);
    expect(await page.evaluate(() => window.__game.seed)).toBe(20260916);
});

test('the generated world boots from its seed', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?gen=1&seed=5');
    await page.waitForFunction(() => window.__game);
    expect(await page.evaluate(() => window.__game.seed)).toBe(5);
    expect(errors).toEqual([]);
});

test(`whole frame stays within ${DRAW_BUDGET} draws`, async ({ page }) => {
    await boot(page);

    const draws = await page.evaluate(() => window.__game.draws());
    const shot = await page.evaluate(() => window.__game.shot());
    saveShot(shot, 'budget');

    console.log(`draws: ${draws} / ${DRAW_BUDGET}`);
    expect(draws).toBeGreaterThan(0);
    expect(draws).toBeLessThanOrEqual(DRAW_BUDGET);
});

test('blackout hack darkens a zone and the world shows it', async ({ page }) => {
    await boot(page);

    expect(await page.evaluate(() => window.__game.dark())).toEqual([false, false]);
    saveShot(await page.evaluate(() => window.__game.shot()), 'hack-before');

    await page.evaluate(() => window.__game.hack());
    await page.waitForFunction(() => window.__game.dark().some(Boolean), null, { timeout: 15000 });
    saveShot(await page.evaluate(() => window.__game.shot()), 'hack-after');

    expect(await page.evaluate(() => window.__game.dark())).toContain(true);
});

// Pillar 1's own test: sit idle, does the world change? Not as pixels any more —
// traffic and pedestrians pass that on their own, and they are not the city. The
// claim is that the district itself moves: a lot breaks ground, a floor goes on,
// a building comes down, while nobody touches anything. The sim half of this,
// ticked for two full minutes, is tests/zoning.spec.js.
test('the world changes while the player stands still', async ({ page }) => {
    await boot(page);

    const stood = await page.evaluate(() => window.__game.player());
    const before = await page.evaluate(() => window.__game.city().parcels.map((p) => p.stage));
    await page.waitForFunction(
        (stages) => window.__game.city().parcels.some((p, i) => p.stage !== stages[i]),
        before,
        { timeout: 30000 },
    );
    expect(await page.evaluate(() => window.__game.player())).toEqual(stood);
});
