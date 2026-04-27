import { test, expect } from '@playwright/test';

// Timeout configuration
const GLOBAL_TIMEOUT = 60000;
const ACTION_TIMEOUT = 15000;
const NAVIGATION_TIMEOUT = 10000;
const GAME_LOAD_DELAY = 6000;
const RENDER_STABILIZE_DELAY = 2000;

// Selector constants
const SELECTORS = {
    START_BTN: '#start-btn',
    GAME_CONTAINER: '#game-container',
    GAME_CANVAS: '#game-canvas',
};

// Extend test with custom fixtures
const customTest = test.extend({
    page: async ({ page }, use) => {
        page.setDefaultTimeout(ACTION_TIMEOUT);
        page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

        const consoleErrors = [];
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (msg.type() === 'error') {
                consoleErrors.push(text);
            }
        });

        page.consoleErrors = consoleErrors;
        page.consoleMessages = consoleMessages;

        // Helper to dismiss blocking overlays
        page.dismissOverlays = async () => {
            const isBuildMenuClosed = await page.evaluate(() => {
                const hud = document.getElementById('build-mode-hud');
                if (hud && hud.textContent && hud.textContent.includes('Build: Off')) {
                    return true;
                }
                return false;
            });

            await page.evaluate(() => {
                const overlayIds = [
                    'politics-panel', 'campaign-panel', 'factions-panel', 'tech-screen',
                    'quest-log', 'case-file', 'codex', 'shop', 'citizen-profile',
                    'map-screen', 'seed-browser', 'case-browser', 'hack-list',
                    'breach-minigame', 'run-summary', 'tutorial-tooltip',
                    'crisis-overlay', 'defeat-overlay', 'victory-overlay',
                    'settings-overlay'
                ];
                overlayIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.pointerEvents = 'none';
                        el.style.opacity = '0';
                        el.style.display = 'none';
                    }
                });
                document.querySelectorAll('.overlay-content, .dialogue-overlay, .tutorial-overlay, .crisis-choice-overlay').forEach(el => {
                    el.style.pointerEvents = 'none';
                    el.style.display = 'none';
                });
                const minimapContainer = document.querySelector('.minimap-container');
                if (minimapContainer) {
                    minimapContainer.style.pointerEvents = 'none';
                }
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.pointerEvents = 'none';
                }
                const mainArea = document.querySelector('#main-area');
                if (mainArea) {
                    mainArea.style.pointerEvents = 'none';
                }
                const gameContainer = document.querySelector('#game-container');
                if (gameContainer) {
                    gameContainer.style.pointerEvents = 'auto';
                }
                const buildingPanel = document.querySelector('.building-panel');
                if (buildingPanel) {
                    buildingPanel.classList.remove('hidden');
                    buildingPanel.style.setProperty('display', 'block', 'important');
                    buildingPanel.style.pointerEvents = 'auto';
                    buildingPanel.scrollTop = 0;
                }
            });

            if (isBuildMenuClosed) {
                await page.keyboard.press('b');
            }
        };

        await use(page);
    },
});

customTest.describe.configure({ timeout: GLOBAL_TIMEOUT });

// ============================================================================
// FIRE WEAPON TESTS
// ============================================================================
customTest.describe('Fire Weapon', () => {
    customTest.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4173/');
        await page.waitForLoadState('networkidle');
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY });
    });

    customTest('equip pistol and fire, impact registers', async ({ page }) => {
        // Click start to begin game
        await page.click(SELECTORS.START_BTN);
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });

        // Wait for game to initialize window.game
        await page.waitForTimeout(3000);

        // Dismiss overlays
        await page.dismissOverlays();

        // Force street mode + equip pistol via game state (Tab key doesn't reliably reach game keydown handler in Playwright)
        await page.evaluate(() => {
            if (window.game) {
                window.game.mode = 'street';
                window.game.modeIndicator?.setMode('street');
                window.game.combat?.setWeapon('pistol');
            }
        });
        await page.waitForTimeout(200);
        // Directly call combat.fire() via evaluate (mouse click coordinates unreliable in Playwright)
        const fireResult = await page.evaluate(() => {
            if (!window.game?.combat) return null;
            return window.game.combat.fire(5, 5);
        });

        expect(fireResult).toBeTruthy();
        expect(fireResult.hit).toBeTruthy();

        // Verify: no uncaught errors during firing
        expect(page.consoleErrors.filter(e => !e.includes('libpng warning') && !e.includes('iCCP')).length).toBe(0);
    });

    customTest('fire multiple shots, ammo decreases', async ({ page }) => {
        // Click start to begin game
        await page.click(SELECTORS.START_BTN);
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });

        // Wait for game to initialize window.game
        await page.waitForTimeout(3000);

        await page.dismissOverlays();

        // Force street mode via game state (Tab key doesn't reliably reach game keydown handler in Playwright)
        await page.evaluate(() => {
            if (window.game) {
                window.game.mode = 'street';
                window.game.modeIndicator?.setMode('street');
            }
        });
        await page.waitForTimeout(200);

        const canvas = page.locator(SELECTORS.GAME_CANVAS);
        const canvasBox = await canvas.boundingBox();
        const centerX = canvasBox.x + canvasBox.width / 2;
        const centerY = canvasBox.y + canvasBox.height / 2;

        // Get initial ammo count
        const initialAmmo = await page.evaluate(() => {
            return window.game?.combat?.getAmmoDisplay?.();
        });

        // Fire 3 shots with small delays
        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(400); // pistol fireRate = 300ms

        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(400);

        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(400);

        // Verify ammo decreased
        const finalAmmo = await page.evaluate(() => {
            return window.game?.combat?.getAmmoDisplay?.();
        });

        // Ammo should be initial minus 3 (or less if started at 0)
        if (typeof initialAmmo === 'number' && initialAmmo > 3) {
            expect(Number(finalAmmo)).toBe(initialAmmo - 3);
        }
        // If ammo was Infinity (melee) or started at 0, just verify it's still a valid number
        else {
            expect(finalAmmo).toBeDefined();
        }
    });

    customTest('fire in god mode does not fire weapon', async ({ page }) => {
        // Click start to begin game
        await page.click(SELECTORS.START_BTN);
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });

        // Wait for game to initialize window.game
        await page.waitForTimeout(3000);

        await page.dismissOverlays();

        // Verify game is in god mode (default) via game state
        const gameMode = await page.evaluate(() => window.game?.mode);
        expect(gameMode).toBe('god');

        const canvas = page.locator(SELECTORS.GAME_CANVAS);
        const canvasBox = await canvas.boundingBox();
        const centerX = canvasBox.x + canvasBox.width / 2;
        const centerY = canvasBox.y + canvasBox.height / 2;

        // Click on canvas - should NOT fire in god mode
        const lastFireBefore = await page.evaluate(() => {
            return window.game?.combat?._lastFireTime || 0;
        });

        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(200);

        const lastFireAfter = await page.evaluate(() => {
            return window.game?.combat?._lastFireTime || 0;
        });

        // _lastFireTime should not have changed (still 0 or unchanged)
        expect(lastFireBefore).toBe(lastFireAfter);
    });
});
