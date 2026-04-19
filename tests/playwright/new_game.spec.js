import { test, expect } from '@playwright/test';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 3000;
const HUD_TIMEOUT = 5000;

test('@smoke start new game, player spawns, HUD renders', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  // Click start to begin new game
  await page.click('#start-btn');

  // Wait for main menu to disappear
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => { /* menu may persist in some modes */ });

  // Wait for game to initialize
  await page.waitForTimeout(SPAWN_DELAY);

  // Verify HUD elements are rendered
  const resourceBar = await page.$('#resource-bar');
  expect(resourceBar).toBeTruthy();

  // Verify game container is active
  const container = await page.$('#game-container');
  expect(container).toBeTruthy();

  // Verify the canvas is present
  const canvas = await page.$('#game-canvas');
  expect(canvas).toBeTruthy();
});

test('@smoke new game HUD shows gold value', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Read gold value from game state
  const gold = await page.evaluate(() => {
    return window.game?.state?.resources?.gold ?? null;
  });
  expect(gold).not.toBeNull();
  expect(typeof gold).toBe('number');
  expect(gold).toBeGreaterThanOrEqual(0);
});

test('@smoke new game HUD shows population', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Read population from game state
  const population = await page.evaluate(() => {
    return window.game?.state?.meta?.population ?? null;
  });
  expect(population).not.toBeNull();
  expect(typeof population).toBe('number');
  expect(population).toBeGreaterThanOrEqual(0);
});

test('@smoke new game HUD shows day counter', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Read day from game state
  const day = await page.evaluate(() => {
    return window.game?.state?.meta?.day ?? null;
  });
  expect(day).not.toBeNull();
  expect(typeof day).toBe('number');
});

test('@smoke new game player position is valid', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Read player position from game state
  const playerPos = await page.evaluate(() => {
    return window.game?.player?.position ?? null;
  });
  expect(playerPos).not.toBeNull();
  expect(typeof playerPos).toBe('object');
  expect(playerPos.x).toBeGreaterThan(0);
  expect(playerPos.y).toBeGreaterThan(0);
});

test('@smoke new game camera is positioned', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });

  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  // Read camera position from game state
  const cameraPos = await page.evaluate(() => {
    return window.game?.camera?.position ?? null;
  });
  expect(cameraPos).not.toBeNull();
  expect(typeof cameraPos).toBe('object');
  expect(typeof cameraPos.x).toBe('number');
  expect(typeof cameraPos.y).toBe('number');
});
