// M7-3 (docs/ROADMAP.md): Esc pauses. The fixed-step loop holds — no sim step
// runs, so every clock and entity stays put — a menu shows, and Esc (or the
// menu's own Resume) starts the world again from where it stopped, not
// fast-forwarded. The Node test drives advance() itself, for the 5 s no page
// can hurry; the browser test presses the real key and holds a wall-clock 5 s.
import { test, expect } from '@playwright/test';
import { advance, createFixedStep, isPaused, setPaused } from '../../src/game/loop.js';

test('M7-3: paused runs no fixed step and banks no backlog', () => {
  const step = createFixedStep(1);
  setPaused(true);
  let ran = 0;
  for (let f = 0; f < 300; f++) ran += advance(step, 1 / 60);
  setPaused(false);
  expect(ran, '5 s of 60 fps frames ran no sim step').toBe(0);
  expect(isPaused()).toBe(false);
  // The frame after resume runs its own 1/60 s at most, never the 5 s held.
  expect(advance(step, 1 / 60), 'the pause banked no steps for resume').toBe(0);
});

test('M7-3: Esc holds game time for 5 s behind a menu, Esc resumes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?capture=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });

  // Running: the fixed step advances before any key is pressed.
  const t0 = await page.evaluate(() => window.__game.step());
  await page.waitForFunction((n) => window.__game.step() > n, t0, { polling: 'raf', timeout: 30000 });

  await page.keyboard.press('Escape');
  const menu = page.locator('#pause');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('PAUSED');
  const held = await page.evaluate(() => window.__game.step());

  // Five seconds of wall time: the sim clock does not move one step.
  await page.waitForTimeout(5000);
  expect(await page.evaluate(() => window.__game.step()), 'game time held for 5 s').toBe(held);
  await expect(menu).toBeVisible();

  // Esc resumes: the menu lifts and the world runs on from where it stopped.
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await page.waitForFunction((n) => window.__game.step() > n, held, { polling: 'raf', timeout: 30000 });

  // The menu's own button resumes too.
  await page.keyboard.press('Escape');
  await expect(menu).toBeVisible();
  const held2 = await page.evaluate(() => window.__game.step());
  await page.locator('#pause-resume').click();
  await expect(menu).toBeHidden();
  await page.waitForFunction((n) => window.__game.step() > n, held2, { polling: 'raf', timeout: 30000 });
  expect(errors).toEqual([]);
});
