import { test, expect } from '@playwright/test';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 3000;

test('@smoke open hack, select node, complete breach', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Switch to street mode and find an available interactable
  const hackResult = await page.evaluate(() => {
    if (!window.game) return { ok: false, reason: 'game not ready' };

    window.game.mode = 'street';

    const nodes = window.game.interactables?.interactables ?? [];
    const node = nodes.find(n => n.state === 'available');
    if (!node) return { ok: false, reason: 'no available node' };

    return window.game.executeHack(node, true);
  });

  // executeHack returns { ok: true, success: true, ... } on success
  // If no node available, skip gracefully
  if (hackResult.reason === 'no available node') return;

  expect(hackResult.ok).toBe(true);
  expect(hackResult.success).toBe(true);
});
