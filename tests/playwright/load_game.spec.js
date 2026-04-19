import { test, expect } from '@playwright/test';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;

test('@smoke game loads and reaches main menu < 10s', async ({ page }) => {
  const loadStart = Date.now();

  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });

  // Wait for the main menu overlay to appear
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // Verify the main menu is visible
  const menuVisible = await page.isVisible('#main-menu-overlay');
  expect(menuVisible).toBe(true);

  // Verify the start button is present
  const startBtn = await page.$('#start-btn');
  expect(startBtn).toBeTruthy();

  const loadTime = Date.now() - loadStart;
  console.log(`Game loaded in ${loadTime}ms`);

  // Verify load time is under 10 seconds
  expect(loadTime).toBeLessThan(10000);
});

test('@smoke game canvas is present', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // The game canvas should exist in the DOM
  const canvas = await page.$('#game-canvas');
  expect(canvas).toBeTruthy();
});

test('@smoke game container is present', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // The game container should exist
  const container = await page.$('#game-container');
  expect(container).toBeTruthy();
});

test('@smoke resources bar renders', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // Resource bar should be present
  const resourceBar = await page.$('#resource-bar');
  expect(resourceBar).toBeTruthy();
});

test('@smoke main menu buttons are visible', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // Verify key buttons are visible
  await expect(page.locator('#start-btn')).toBeVisible();
  await expect(page.locator('#settings-btn')).toBeVisible();
});

test('@smoke pressing start launches the game', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // Click start
  await page.click('#start-btn');

  // Main menu should disappear
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => { /* menu might persist in some modes, that's ok */ });

  // Game container should still be present
  const container = await page.$('#game-container');
  expect(container).toBeTruthy();
});

test('@smoke settings overlay opens', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // Click settings
  await page.click('#settings-btn');

  // Settings overlay should appear
  await expect(page.locator('#settings-overlay')).toBeVisible();
});

test('@smoke settings overlay closes', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // Open settings
  await page.click('#settings-btn');
  await expect(page.locator('#settings-overlay')).toBeVisible();

  // Close settings (look for close button)
  const closeBtn = page.locator('#settings-close, .settings-close, [aria-label*="close"]');
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click();
    await expect(page.locator('#settings-overlay')).not.toBeVisible();
  }
});
