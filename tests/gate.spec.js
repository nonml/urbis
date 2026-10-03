import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

const DRAW_BUDGET = 175;
const SHOT_DIR = 'docs/shots/gate';
// createPlayer's spawn (src/sim/player.js), for the walk-away check below.
const SPAWN = { x: 2.5, z: 26 };

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

// The first frame of a new game is the player's first look at the city. Slices
// 074-076 shipped one with a parked car's roof filling a sixth of it, and every
// draw and fps check passed. Nothing but the avatar may stand this close.
const OPENING_NEAR = 2;
const OPENING_BLOCKED_MAX = 0.02;
for (const query of ['', '&gen=1&seed=2', '&gen=1&seed=7', '&gen=1&seed=1234567']) {
    test(`a new game opens on a clear view of the street${query && ` (${query.slice(1)})`}`, async ({ page }) => {
        await page.goto(`/?capture=1${query}`);
        await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        const view = await page.evaluate((near) => window.__game.frameCheck(near), OPENING_NEAR);
        expect(view.blocked, view.blockers.join('; ')).toBeLessThanOrEqual(OPENING_BLOCKED_MAX);
    });
}

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

// The save half of continue: the player walks away from the spawn, a save is
// forced, the page reloads, and they are standing where they stood — same seed.
// ?savetest=1 is the only switch that lets an automated run read or write a save.
test('a save continues the player where they stood', async ({ page }) => {
    await page.goto('/?savetest=1');
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    const seed = await page.evaluate(() => window.__game.seed);

    await page.keyboard.down('w');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');
    const before = await page.evaluate(() => window.__game.player());
    // The walk happened, or the test would pass on a save that never worked.
    expect(Math.hypot(before.x - SPAWN.x, before.z - SPAWN.z)).toBeGreaterThan(0.5);

    expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);
    await page.reload();
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.__game.seed)).toBe(seed);
    const after = await page.evaluate(() => window.__game.player());
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThanOrEqual(0.5);
});

// The autosave on the way out: hiding the tab saves the game, and the next
// boot continues from it.
test('hiding the tab saves, and the game continues from it', async ({ page }) => {
    await page.goto('/?savetest=1');
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });

    await page.keyboard.down('w');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');
    const before = await page.evaluate(() => window.__game.player());
    expect(Math.hypot(before.x - SPAWN.x, before.z - SPAWN.z)).toBeGreaterThan(0.5);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.reload();
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    const after = await page.evaluate(() => window.__game.player());
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThanOrEqual(0.5);
});

// N: a new game is a new city (AGENTS.md). The save is wiped — the player is
// back at the spawn after a save held them elsewhere — and under ?seed=7 the
// replay URL goes with it, so the boot draws a seed of its own again.
test('new game wipes the save and boots a city again', async ({ page }) => {
    await page.goto('/?savetest=1');
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.keyboard.down('w');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');
    expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);

    await page.keyboard.press('n');
    // Waiting on the outcome, not on the navigation: the save is gone, so the
    // reloaded game stands at the spawn again.
    await page.waitForFunction((spawn) => {
        const p = window.__game?.player();
        return p && Math.abs(p.x - spawn.x) < 0.1 && Math.abs(p.z - spawn.z) < 0.1;
    }, SPAWN, { timeout: 30000 });

    await page.goto('/?seed=7');
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.__game.seed)).toBe(7);
    await page.keyboard.press('n');
    await page.waitForFunction(() => window.__game && window.__game.seed !== 7, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.__game.seed)).not.toBe(7);
});
