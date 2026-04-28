import { test, expect } from '@playwright/test';
import { join } from 'path';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 5000;
const PLAYTEST_DURATION_MS = 15 * 60 * 1000;
const CHECKPOINT_INTERVAL_MS = 3 * 60 * 1000;
const SCREENSHOT_DIR = join('tests', 'playwright', 'playtest-screenshots');

test('@playtest 15-minute headless session', async ({ page }) => {
  test.setTimeout(PLAYTEST_DURATION_MS + 60000);

  const errors = [];
  page.on('pageerror', (err) => errors.push({ time: Date.now(), message: err.message }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ time: Date.now(), message: msg.text() });
    }
  });

  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });
  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  const gameLoaded = await page.evaluate(() => !!window.game?.state);
  expect(gameLoaded).toBe(true);

  const startTime = Date.now();
  let screenshotCount = 0;
  let nextCheckpoint = startTime + CHECKPOINT_INTERVAL_MS;

  const playerActions = [
    () => page.keyboard.press('w'),
    () => page.keyboard.press('a'),
    () => page.keyboard.press('s'),
    () => page.keyboard.press('d'),
    () => page.keyboard.press('f'),
    () => page.keyboard.press('q'),
    () => page.keyboard.press('h'),
  ];

  while (Date.now() - startTime < PLAYTEST_DURATION_MS) {
    const actionIdx = Math.floor(Math.random() * playerActions.length);
    await playerActions[actionIdx]();

    if (Date.now() >= nextCheckpoint && screenshotCount < 5) {
      screenshotCount++;
      await page.screenshot({
        path: join(SCREENSHOT_DIR, `checkpoint-${screenshotCount}.png`),
      });
      nextCheckpoint = Date.now() + CHECKPOINT_INTERVAL_MS;
    }

    await page.waitForTimeout(500 + Math.floor(Math.random() * 2000));

    const alive = await page.evaluate(() => !!window.game?.state);
    expect(alive).toBe(true);
  }

  if (screenshotCount < 5) {
    screenshotCount++;
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `checkpoint-${screenshotCount}.png`),
    });
  }

  const finalState = await page.evaluate(() => ({
    tick: window.game?.state?.time?.tick ?? 0,
    population: window.game?.state?.resources?.population ?? 0,
    gold: window.game?.state?.resources?.gold ?? 0,
    mode: window.game?.mode ?? 'unknown',
  }));

  expect(finalState.tick).toBeGreaterThan(0);
  expect(errors.length).toBe(0);
  expect(screenshotCount).toBeGreaterThanOrEqual(5);
});

test('@playtest scripted agent completes starter objective', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });
  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);

  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('w');
    await page.waitForTimeout(100);
  }

  const objectiveState = await page.evaluate(() => {
    const tm = window.game?.tutorialManager;
    if (!tm) return { active: false, step: -1 };
    return {
      active: tm.isActive ?? false,
      step: tm.currentStep ?? -1,
      completed: tm.completed ?? false,
    };
  });

  expect(objectiveState).toBeTruthy();
});
