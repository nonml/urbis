// Interiors in the running game: E takes the player into the noodle bar and up
// onto the roof next door, both inside the draw budget, and a blackout visibly
// kills the shop's lights while the player stands in it. The sim half — walls,
// bounds, the camera — is interior.spec.js, headless.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

const DRAW_BUDGET = 175;
const SHOT_DIR = 'docs/shots/gate';

// Draw calls do not depend on resolution, and on a software renderer every
// pixel costs time: a quarter of the gate's viewport runs four times the frames.
test.use({ viewport: { width: 480, height: 270 } });

function saveShot(dataUrl, name) {
    mkdirSync(SHOT_DIR, { recursive: true });
    writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

async function boot(page) {
    await page.goto('/?capture=1');
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    // The bundle under test is the one with doors in it.
    expect(await page.evaluate(() => typeof window.__game.space)).toBe('function');
    await page.waitForTimeout(1000);
}

async function frames(page, n) {
    await page.evaluate((k) => new Promise((r) => {
        let i = 0;
        const f = () => (++i >= k ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
    }), n);
}

// The worst draw count over the next `n` frames, every one of them.
async function peak(page, n) {
    return page.evaluate((k) => new Promise((r) => {
        const seen = [];
        const f = () => {
            seen.push(window.__game.draws());
            if (seen.length >= k) r(Math.max(...seen));
            else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
    }), n);
}

// Mean brightness of a captured frame, 0..255.
async function brightness(page) {
    return page.evaluate(() => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 160;
            c.height = 90;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0, c.width, c.height);
            const px = g.getImageData(0, 0, c.width, c.height).data;
            let sum = 0;
            for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
            resolve(sum / (px.length / 4));
        };
        img.src = window.__game.shot();
    }));
}

async function useDoorAt(page, x, z, label) {
    await page.evaluate(([px, pz]) => window.__game.pose(px, pz, 0), [x, z]);
    await page.waitForFunction((l) => window.__game.door() === l, label, { timeout: 15000 });
    await page.keyboard.press('e');
}

// At least `secs` of game time. The frame loop clamps dt at 50 ms, so on a
// slow renderer game time runs behind the wall clock: wait for both.
async function gameSeconds(page, secs) {
    await page.evaluate((s) => new Promise((r) => {
        const start = performance.now();
        let n = 0;
        const f = () => {
            n++;
            if (n * 0.05 >= s && performance.now() - start >= s * 1000) r();
            else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
    }), secs);
}

// One boot for all of it: the gate pays for every page load.
test('E walks into the noodle bar and out, a blackout kills its lights, the stair goes to the roof', async ({ page }) => {
    test.setTimeout(180000);
    await boot(page);
    await useDoorAt(page, -5.9, -10.77, 'ENTER RAMEN');
    await page.waitForFunction(() => window.__game.space() === 'ramen');
    await frames(page, 3);
    const inside = await peak(page, 8);
    console.log(`inside draws: ${inside} / ${DRAW_BUDGET}`);
    expect(inside).toBeLessThanOrEqual(DRAW_BUDGET);
    saveShot(await page.evaluate(() => window.__game.shot()), 'interior-lit');
    const lit = await brightness(page);

    // Past the collapse flicker and into the dark itself.
    await page.evaluate(() => window.__game.hack());
    await page.waitForFunction(() => window.__game.dark()[0], null, { timeout: 15000 });
    await gameSeconds(page, 1.2);
    const dark = await brightness(page);
    saveShot(await page.evaluate(() => window.__game.shot()), 'interior-dark');
    expect(dark).toBeLessThan(lit * 0.6);

    await useDoorAt(page, -8.15, -10.77, 'LEAVE');
    await page.waitForFunction(() => window.__game.space() === 'street');

    await useDoorAt(page, -13.5, -41.4, 'STAIRS TO ROOF');
    await page.waitForFunction(() => window.__game.space() === 'roof');
    expect((await page.evaluate(() => window.__game.player())).y).toBeGreaterThan(40);
    await page.evaluate(() => window.__game.look(0.75, 7));
    await frames(page, 3);
    const roof = await peak(page, 8);
    console.log(`roof draws: ${roof} / ${DRAW_BUDGET}`);
    expect(roof).toBeLessThanOrEqual(DRAW_BUDGET);
    saveShot(await page.evaluate(() => window.__game.shot()), 'interior-roof');
});
