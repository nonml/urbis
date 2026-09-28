// The arc in the running game: the HUD elements are there, 1 and 2 only answer
// an open dialogue, J toggles the journal, and getting in the car puts the marker
// up over the substation — inside the draw budget. The story itself is proven
// headless, on every path, in arc.spec.js.
import { test, expect } from '@playwright/test';
import { ARC } from '../src/sim/arc.js';

test('in the game: the objective, the dialogue, 1 and 2, the journal, the marker', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?capture=1');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  const objective = page.locator('#arc-objective');
  const dialogue = page.locator('#arc-dialogue');
  const journal = page.locator('#arc-journal');
  await expect(objective).toContainText('LIVE WIRE');
  await expect(objective).toContainText('Get in the car');
  await expect(dialogue).toContainText('RUF TAMM');
  // 2 answers nothing on a plain line; 1 moves it along.
  await page.keyboard.press('2');
  await expect(dialogue).toContainText('RUF TAMM');
  await page.keyboard.press('1');
  await expect(dialogue).toBeHidden();
  // With no dialogue open, 1 and 2 are inert.
  const before = await page.evaluate(() => JSON.stringify(window.__game.arc()));
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  expect(await page.evaluate(() => JSON.stringify(window.__game.arc()))).toBe(before);
  await page.keyboard.press('j');
  await expect(journal).toContainText('CELESTE MARROW');
  await expect(journal).toContainText('LIVE WIRE');
  await page.keyboard.press('j');
  await expect(journal).toBeHidden();
  // Into the car: the step moves on and the marker goes up over the substation.
  await page.evaluate(() => window.__game.enter());
  await page.waitForFunction(() => window.__game.arc().target !== null);
  await expect(objective).toContainText('Drive to the south substation');
  const target = await page.evaluate(() => window.__game.arc().target);
  expect(target).toEqual({ x: ARC.places.substation_s.x, z: ARC.places.substation_s.z });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
  expect(errors).toEqual([]);
});
