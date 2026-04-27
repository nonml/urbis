import { test, expect } from '@playwright/test';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 3000;

const TERRAIN_ROAD = 4;

test('@smoke god mode, place road tile', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // In god mode, place a road tile via the map API
  const result = await page.evaluate((roadTerrain) => {
    if (!window.game) return { ok: false, reason: 'game not ready' };

    const map = window.game.map;
    if (!map) return { ok: false, reason: 'map not ready' };

    // Pick a tile in the middle of the map that is not already road
    const cx = Math.floor(map.width / 2) + 10;
    const cy = Math.floor(map.height / 2) + 10;

    const before = map.getTileAt(cx, cy);
    map.setTileAt(cx, cy, roadTerrain);
    const after = map.getTileAt(cx, cy);

    return { ok: true, before, after, placed: after === roadTerrain };
  }, TERRAIN_ROAD);

  expect(result.ok).toBe(true);
  expect(result.placed).toBe(true);
  expect(result.after).toBe(TERRAIN_ROAD);
});

test('@smoke god mode, place a residential building', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Place a house via the game buildings API (same call used during new-game init)
  const result = await page.evaluate(() => {
    if (!window.game) return { ok: false, reason: 'game not ready' };

    const buildings = window.game.buildings;
    const map = window.game.map;
    if (!buildings || !map) return { ok: false, reason: 'systems not ready' };

    const countBefore = buildings.buildings.length;

    // Use an empty tile well away from starter buildings
    const tx = Math.floor(map.width / 2) + 15;
    const ty = Math.floor(map.height / 2) + 15;

    const building = buildings.build('house', tx, ty);
    const countAfter = buildings.buildings.length;

    return {
      ok: true,
      placed: countAfter > countBefore,
      type: building?.type ?? null,
      countBefore,
      countAfter,
    };
  });

  expect(result.ok).toBe(true);
  expect(result.placed).toBe(true);
  expect(result.type).toBe('house');
});
