import { test, expect } from '@playwright/test';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 4000;

/**
 * Create a minimal v1 save payload (oldest schema)
 */
function createV1Save() {
    return {
        schemaVersion: 1,
        meta: {
            seed: 123456789,
            mapPreset: 'CITY',
            createdAt: Date.now(),
        },
        time: {
            tick: 100,
            paused: false,
        },
        resources: {
            gold: 200,
            food: 50,
            wood: 30,
        },
        buildings: [],
        citizens: [],
        player: {
            x: 48,
            y: 48,
            health: 100,
        },
    };
}

/**
 * Create a minimal v3 save payload
 */
function createV3Save() {
    return {
        schemaVersion: 3,
        meta: {
            seed: 123456789,
            mapPreset: 'CITY',
            runId: 'test-run-123',
            createdAt: Date.now(),
        },
        time: {
            tick: 500,
            paused: false,
            day: 3,
        },
        resources: {
            gold: 500,
            food: 100,
            wood: 80,
            population: 24,
            housing: 24,
        },
        buildings: {
            list: [
                { id: 1, type: 'town-hall', x: 48, y: 48, level: 1 },
                { id: 2, type: 'farm', x: 50, y: 48, level: 1 },
            ],
            nextId: 3,
        },
        citizens: [],
        player: {
            x: 48,
            y: 48,
            wx: 48,
            wz: 48,
            health: 100,
            maxHealth: 100,
        },
        economy: {
            demand: { residential: 0.5, commercial: 0.3, industrial: 0.2 },
            debt: 0,
        },
    };
}

/**
 * Create a minimal v5 save payload
 */
function createV5Save() {
    return {
        schemaVersion: 5,
        meta: {
            seed: 123456789,
            mapPreset: 'CITY',
            runId: 'test-run-456',
            createdAt: Date.now(),
        },
        time: {
            tick: 1000,
            paused: false,
            day: 7,
            timeOfDay: 12,
        },
        resources: {
            gold: 1000,
            food: 200,
            wood: 150,
            population: 50,
            housing: 48,
            day: 7,
        },
        buildings: {
            list: [
                { id: 1, type: 'town-hall', x: 48, y: 48, level: 2 },
                { id: 2, type: 'farm', x: 50, y: 48, level: 1 },
                { id: 3, type: 'market', x: 48, y: 50, level: 1 },
            ],
            nextId: 4,
        },
        citizens: [],
        player: {
            x: 48,
            y: 48,
            wx: 48.5,
            wz: 48.5,
            health: 80,
            maxHealth: 100,
            heat: 0,
        },
        economy: {
            demand: { residential: 0.6, commercial: 0.4, industrial: 0.3 },
            debt: 0,
        },
        factions: {
            reputation: {},
        },
    };
}

test('@migration v1 → v8 round-trip', async ({ page }) => {
    await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
    await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

    // Write a v1 save to localStorage
    const v1Save = createV1Save();
    const writeResult = await page.evaluate((save) => {
        localStorage.setItem('cityBuilderSave_v1', JSON.stringify(save));
        return { ok: true };
    }, v1Save);
    expect(writeResult.ok).toBe(true);

    // Start game and load the v1 save — should migrate to v8
    await page.click('#start-btn');
    await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
        .catch(() => {});
    await page.waitForTimeout(SPAWN_DELAY);

    // Trigger migration by loading
    const loadResult = await page.evaluate(() => {
        try {
            window.game.loadGame();
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    // Verify state was migrated to v8
    const state = await page.evaluate(() => {
        const g = window.game;
        return {
            schemaVersion: g?.state?.schemaVersion ?? null,
            gold: g?.state?.resources?.gold ?? null,
            hasMeta: !!g?.state?.meta,
            hasHeat: 'heat' in (g?.state?.player ?? {}),
            hasHeatSystem: !!g?.state?.heat,
        };
    });

    expect(state.schemaVersion).toBe(8);
    expect(state.gold).toBe(200);
    expect(state.hasMeta).toBe(true);
    expect(state.hasHeat).toBe(true);
    expect(state.hasHeatSystem).toBe(true);
});

test('@migration v3 → v8 round-trip', async ({ page }) => {
    await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
    await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

    const v3Save = createV3Save();
    const writeResult = await page.evaluate((save) => {
        localStorage.setItem('cityBuilderSave_v3', JSON.stringify(save));
        return { ok: true };
    }, v3Save);
    expect(writeResult.ok).toBe(true);

    await page.click('#start-btn');
    await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
        .catch(() => {});
    await page.waitForTimeout(SPAWN_DELAY);

    const loadResult = await page.evaluate(() => {
        try {
            window.game.loadGame();
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    const state = await page.evaluate(() => {
        const g = window.game;
        return {
            schemaVersion: g?.state?.schemaVersion ?? null,
            gold: g?.state?.resources?.gold ?? null,
            buildingCount: g?.buildings?.buildings?.length ?? 0,
            hasEconomy: !!g?.state?.economy,
        };
    });

    expect(state.schemaVersion).toBe(8);
    expect(state.gold).toBe(500);
    expect(state.buildingCount).toBeGreaterThanOrEqual(2);
    expect(state.hasEconomy).toBe(true);
});

test('@migration v5 → v8 round-trip', async ({ page }) => {
    await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
    await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

    const v5Save = createV5Save();
    const writeResult = await page.evaluate((save) => {
        localStorage.setItem('cityBuilderSave_v5', JSON.stringify(save));
        return { ok: true };
    }, v5Save);
    expect(writeResult.ok).toBe(true);

    await page.click('#start-btn');
    await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
        .catch(() => {});
    await page.waitForTimeout(SPAWN_DELAY);

    const loadResult = await page.evaluate(() => {
        try {
            window.game.loadGame();
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    const state = await page.evaluate(() => {
        const g = window.game;
        return {
            schemaVersion: g?.state?.schemaVersion ?? null,
            gold: g?.state?.resources?.gold ?? null,
            heat: g?.state?.player?.heat ?? 0,
            factionRep: g?.state?.factions?.reputation ?? null,
            hasZeroHostilities: 'zeroHostilities' in (g?.state?.player ?? {}),
        };
    });

    expect(state.schemaVersion).toBe(8);
    expect(state.gold).toBe(1000);
    expect(state.heat).toBe(0);
    expect(state.factionRep).not.toBeNull();
});
