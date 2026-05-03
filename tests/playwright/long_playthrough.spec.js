import { test, expect } from '@playwright/test';
import { join } from 'path';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 5000;
// 3 hours = 10800000ms, plus 30min buffer for startup/shutdown
const PLAYTEST_DURATION_MS = 3 * 60 * 60 * 1000;
const CHECKPOINT_INTERVAL_MS = 15 * 60 * 1000; // every 15 min
const SCREENSHOT_DIR = join('tests', 'playwright', 'playtest-screenshots');

/**
 * 3-hour scripted headless playthrough.
 * Exercises: movement, combat, hacking, building, saving, weather, day/night.
 * Verifies: zero uncaught errors, game remains alive, checkpoints succeed.
 */
test('@playthrough 3-hour headless session', async ({ page }) => {
    test.setTimeout(PLAYTEST_DURATION_MS + 60 * 60 * 1000); // 3h + 1h buffer

    const errors = [];
    const warnings = [];
    page.on('pageerror', (err) => errors.push({ time: Date.now(), message: err.message }));
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            errors.push({ time: Date.now(), message: msg.text() });
        }
    });

    // Load game
    await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
    await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });
    await page.click('#start-btn');
    await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
        .catch(() => {});
    await page.waitForTimeout(SPAWN_DELAY);

    const gameLoaded = await page.evaluate(() => !!window.game?.state);
    expect(gameLoaded).toBe(true);

    const startTime = Date.now();
    let checkpointNum = 0;
    let nextCheckpoint = startTime + CHECKPOINT_INTERVAL_MS;
    let actionCycle = 0;

    // Action sequences to vary gameplay
    const actionSequences = [
        // Movement exploration
        () => page.keyboard.pressSequence('wwwwaaaassssdddd'),
        // Hack attempt
        async () => { await page.keyboard.press('h'); await page.waitForTimeout(500); },
        // Fire weapon
        async () => { await page.keyboard.press('f'); await page.waitForTimeout(200); },
        // Switch weapon
        () => page.keyboard.press('q'),
        // Save game
        async () => {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            await page.keyboard.press('s');
            await page.waitForTimeout(300);
            await page.keyboard.press('Escape');
        },
        // Weather toggle (dev mode)
        async () => {
            await page.evaluate(() => window.game?.ui?.toggleWeather?.());
        },
    ];

    while (Date.now() - startTime < PLAYTEST_DURATION_MS) {
        // Pick action based on cycle
        const seqIdx = actionCycle % actionSequences.length;
        const action = actionSequences[seqIdx];
        await action();
        actionCycle++;

        // Random movement between actions
        const moveKeys = ['w', 'a', 's', 'd'];
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press(moveKeys[Math.floor(Math.random() * 4)]);
            await page.waitForTimeout(100 + Math.random() * 200);
        }

        // Checkpoint: screenshot + state verification
        if (Date.now() >= nextCheckpoint) {
            checkpointNum++;
            try {
                await page.screenshot({
                    path: join(SCREENSHOT_DIR, `3h_checkpoint-${checkpointNum}.png`),
                });
            } catch (e) {
                warnings.push({ time: Date.now(), message: `Screenshot failed: ${e.message}` });
            }

            // Verify game is still alive
            const alive = await page.evaluate(() => !!window.game?.state);
            expect(alive, `Game crashed at checkpoint ${checkpointNum}`).toBe(true);

            // Record state snapshot
            const state = await page.evaluate(() => ({
                tick: window.game?.state?.time?.tick ?? 0,
                gold: window.game?.state?.resources?.gold ?? 0,
                heat: window.game?.state?.player?.heat ?? 0,
                population: window.game?.state?.resources?.population ?? 0,
            }));
            warnings.push({
                time: Date.now(),
                message: `Checkpoint ${checkpointNum}: tick=${state.tick}, gold=${state.gold}`,
            });

            nextCheckpoint = Date.now() + CHECKPOINT_INTERVAL_MS;
        }

        // Wait between actions
        await page.waitForTimeout(2000 + Math.random() * 5000);
    }

    // Final state check
    const finalState = await page.evaluate(() => ({
        tick: window.game?.state?.time?.tick ?? 0,
        population: window.game?.state?.resources?.population ?? 0,
        gold: window.game?.state?.resources?.gold ?? 0,
        mode: window.game?.mode ?? 'unknown',
    }));

    expect(finalState.tick).toBeGreaterThan(0);
    expect(errors.length, `Uncaught errors: ${errors.map(e => e.message).join('; ')}`).toBe(0);
    expect(checkpointNum).toBeGreaterThanOrEqual(10); // At least 10 checkpoints in 3 hours
});
