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
    expect(api).toEqual(expect.arrayContaining(['draws', 'hack', 'dark', 'player', 'heat', 'mission']));
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

// Pillar 1's own test: sit idle, does the world change? Compared as pixels because
// that is the claim — traffic and pedestrians must visibly move on their own.
test('the world changes while the player stands still', async ({ page }) => {
    await boot(page);

    const before = await page.evaluate(() => window.__game.shot());
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => window.__game.shot());

    expect(after).not.toBe(before);
});
