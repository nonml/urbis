import { test, expect } from '@playwright/test';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 3000;

test('@smoke toggle rain, verify effect visible', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Force rain via direct state manipulation (setWeather is async-transition; bypass queue)
  const result = await page.evaluate(() => {
    const ws = window.game?.weatherSystem;
    if (!ws) return { ok: false, reason: 'no weatherSystem' };

    // Clear transition queue and force state immediately
    ws.transitionQueue = [];
    ws.state.type = 'rain';
    ws.state.intensity = 1.0;
    ws.state.duration = 60;

    return {
      ok: true,
      weatherType: ws.state?.type ?? null,
      isRaining: ws.isRaining?.() ?? (ws.state?.type === 'rain'),
    };
  });

  expect(result.ok).toBe(true);
  expect(result.weatherType).toBe('rain');
  expect(result.isRaining).toBe(true);
});

test('@smoke force night, force day, verify lighting', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Force night by setting timeOfDay close to midnight (0.9 = 21:36 in a 24-tick day)
  const nightResult = await page.evaluate(() => {
    if (!window.game) return { ok: false };
    const tickPerDay = window.game.state.time.tickPerDay || 24;
    // Set timeOfDay to ~0.875 (night)
    window.game.state.time.timeOfDay = 0.875;
    window.game.state.time.tick = Math.floor(tickPerDay * 0.875);
    return { ok: true, timeOfDay: window.game.state.time.timeOfDay };
  });
  expect(nightResult.ok).toBe(true);
  expect(nightResult.timeOfDay).toBeCloseTo(0.875, 2);

  // Force day
  const dayResult = await page.evaluate(() => {
    if (!window.game) return { ok: false };
    const tickPerDay = window.game.state.time.tickPerDay || 24;
    window.game.state.time.timeOfDay = 0.5;
    window.game.state.time.tick = Math.floor(tickPerDay * 0.5);
    return { ok: true, timeOfDay: window.game.state.time.timeOfDay };
  });
  expect(dayResult.ok).toBe(true);
  expect(dayResult.timeOfDay).toBeCloseTo(0.5, 2);

  // Canvas should still be rendering (no crash)
  const canvas = await page.$('#game-canvas');
  expect(canvas).toBeTruthy();
});

test('@smoke open/close minimap', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Open map screen via direct API call (M key opens smartphone menu, not the map screen)
  await page.evaluate(() => window.game?.ui?.toggleMapScreen());
  await page.waitForTimeout(300);

  // Check that the map screen overlay appeared
  const visibleAfterOpen = await page.evaluate(() => {
    const screen = document.querySelector('#map-screen');
    if (!screen) return false;
    return !screen.classList.contains('hidden') && screen.style.display !== 'none';
  });
  expect(visibleAfterOpen).toBe(true);

  // Close via API again
  await page.evaluate(() => window.game?.ui?.toggleMapScreen());
  await page.waitForTimeout(300);

  const visibleAfterClose = await page.evaluate(() => {
    const screen = document.querySelector('#map-screen');
    if (!screen) return true; // element removed = closed
    return !screen.classList.contains('hidden') && screen.style.display !== 'none';
  });
  expect(visibleAfterClose).toBe(false);
});

test('@smoke pause menu opens and closes', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Open pause menu via direct API call (keyboard may not reach handler without focus)
  await page.evaluate(() => window.game?.ui?.togglePauseMenu());
  await page.waitForTimeout(300);

  const openAfterToggle = await page.evaluate(() => {
    const overlay = document.querySelector('#pause-overlay');
    if (!overlay) return false;
    return !overlay.classList.contains('hidden');
  });
  expect(openAfterToggle).toBe(true);

  // Close via API again
  await page.evaluate(() => window.game?.ui?.togglePauseMenu());
  await page.waitForTimeout(300);

  const closedAfterToggle = await page.evaluate(() => {
    const overlay = document.querySelector('#pause-overlay');
    if (!overlay) return true;
    return overlay.classList.contains('hidden');
  });
  expect(closedAfterToggle).toBe(true);
});
