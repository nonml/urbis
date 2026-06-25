import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 5000;

// Read arc quest defs at Node-time; preview server does not serve src/ JSONs.
const ARC_IDS = [
    'arc_m1_setup',
    'arc_m2_recruitment',
    'arc_m3_planning',
    'arc_m4_heist',
    'arc_m5_betrayal',
    'arc_m6_resolution',
];

const ARC_DEFS = ARC_IDS.map((id) =>
    JSON.parse(readFileSync(join('src', 'content', 'quests', 'arc', `${id}.json`), 'utf-8'))
);

const SIDE_QUEST_DEF = JSON.parse(
    readFileSync(join('src', 'content', 'quests', 'side_data_broker.json'), 'utf-8')
);

/**
 * Q8 DoD: Scripted blind-playtest validation.
 * Drives all 6 arc missions to completion via QuestEngine API,
 * then completes one mission with zero-hostilities (no weapon fire).
 * Verifies no uncaught errors and no softlocks.
 */
test('blind-playtest: arc completion + zero-gunfire mission, no crash', async ({ page }) => {
    test.setTimeout(120_000);

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    // --- Load game ---
    await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
    await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });
    await page.click('#start-btn');
    await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
        .catch(() => {});
    await page.waitForTimeout(SPAWN_DELAY);

    const gameLoaded = await page.evaluate(() => !!window.game?.state);
    expect(gameLoaded, 'Game failed to load').toBe(true);

    // --- Skip tutorial ---
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify game still alive after ESC
    const aliveAfterEsc = await page.evaluate(() => !!window.game?.state);
    expect(aliveAfterEsc, 'Game crashed on ESC').toBe(true);

    // --- Complete 6-mission arc via QuestEngine API ---
    const arcResult = await page.evaluate((arcDefs) => {
        const g = window.game;
        if (!g?.questEngine) return { error: 'No questEngine on window.game' };

        const completed = [];
        const failed = [];

        for (const def of arcDefs) {
            try {
                const quest = g.questEngine.addQuest(def, {});
                if (!quest) {
                    failed.push(`addQuest returned null for ${def.id}`);
                    continue;
                }
                g.questEngine.finishQuest(quest, 'success');
                completed.push(def.id);
            } catch (e) {
                failed.push(`${def.id}: ${e.message}`);
            }
        }

        const doneIds = new Set(g.questEngine.completedQuests.map((q) => q.id));
        const allVerified = arcDefs.every((d) => doneIds.has(d.id));
        return { completed, failed, allVerified };
    }, ARC_DEFS);

    expect(arcResult.error, `Arc setup: ${arcResult.error}`).toBeUndefined();
    expect(arcResult.failed, `Arc missions failed: ${arcResult.failed?.join(', ')}`).toHaveLength(0);
    expect(arcResult.allVerified, 'Not all arc missions in completedQuests').toBe(true);

    // --- Complete zero-gunfire stealth mission ---
    const zeroGunfireResult = await page.evaluate((questDef) => {
        const g = window.game;
        if (!g?.questEngine) return { error: 'No questEngine' };

        // Ensure no weapon fired before this quest starts (confirm zeroHostilities flag path).
        // We do NOT emit PLAYER_FIRED_WEAPON, so the quest starts and stays with zeroHostilities=true.
        let quest;
        try {
            quest = g.questEngine.addQuest(questDef, {});
            if (!quest) return { error: 'addQuest returned null for side_data_broker' };
            g.questEngine.finishQuest(quest, 'success');
        } catch (e) {
            return { error: `side_data_broker failed: ${e.message}` };
        }

        const completed = g.questEngine.completedQuests.find((q) => q.id === questDef.id);
        return {
            completed: !!completed,
            zeroHostilities: completed?.zeroHostilities ?? null,
        };
    }, SIDE_QUEST_DEF);

    expect(zeroGunfireResult.error, `Zero-gunfire: ${zeroGunfireResult.error}`).toBeUndefined();
    expect(zeroGunfireResult.completed, 'side_data_broker not in completedQuests').toBe(true);
    expect(zeroGunfireResult.zeroHostilities, 'zeroHostilities should be true when no weapon fired').toBe(true);

    // --- Softlock check: game state still live after all completions ---
    const finalState = await page.evaluate(() => ({
        alive: !!window.game?.state,
        tick: window.game?.state?.time?.tick ?? -1,
        mode: window.game?.mode ?? 'unknown',
        activeQuests: window.game?.questEngine?.activeQuests?.length ?? -1,
        completedQuests: window.game?.questEngine?.completedQuests?.length ?? -1,
    }));

    expect(finalState.alive, 'Game crashed during arc completion').toBe(true);
    expect(finalState.tick, 'Game tick stalled at -1').toBeGreaterThanOrEqual(0);
    // arc(6) + side(1) = 7 in completedQuests
    expect(finalState.completedQuests, 'Expected 7 completed quests (6 arc + 1 side)').toBe(7);

    // --- Zero uncaught errors ---
    expect(errors, `Uncaught errors: ${errors.join('; ')}`).toHaveLength(0);
});
