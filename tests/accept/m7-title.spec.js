// M7-2 (docs/ROADMAP.md): the title screen is the front door. New Game,
// Continue (disabled with no save) and Settings work by mouse; New Game shows
// the new city's seed with a reroll and takes a typed seed; the city's name is
// made from the seed, the player can change it, and it shows on the HUD and the
// save. The title is a player's screen, so navigator.webdriver is stubbed false
// (boot.js hides the title from automated runs); everything else is a real
// click, a real key and the running game's own save.
import { test, expect } from '@playwright/test';
import { nameForSeed } from '../../src/ui/title.js';

const asPlayer = (page) => page.addInitScript(() => {
  Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
});

test('M7-2: the title works by mouse and takes a typed seed and name', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await asPlayer(page);
  await page.goto('/?savetest=1');
  await expect(page.locator('#title')).toBeVisible();

  // No save yet: Continue is disabled.
  await expect(page.locator('#title-continue')).toBeDisabled();

  // Settings opens and closes by mouse.
  await page.locator('#title-settings').click();
  await expect(page.locator('#title-settings-panel')).toBeVisible();
  await page.locator('#title-settings-back').click();
  await expect(page.locator('#title-settings-panel')).toBeHidden();

  // New Game: the seed, its reroll, a seed to type, and the name the seed made.
  await page.locator('#title-newgame').click();
  await expect(page.locator('#title-newgame-panel')).toBeVisible();
  const seedVal = page.locator('#title-seed');
  const first = Number(await seedVal.textContent());
  expect(first, 'the panel opens on the boot seed').toBeGreaterThan(0);
  await expect(page.locator('#title-nameinput')).toHaveValue(nameForSeed(first));

  // The reroll rolls a new seed (the roll is random, so retry a few times).
  let rolled = first;
  for (let i = 0; i < 5 && rolled === first; i++) {
    await page.locator('#title-reroll').click();
    rolled = Number(await seedVal.textContent());
  }
  expect(rolled, 'the reroll rolls a new seed').not.toBe(first);

  // A typed seed moves the seed and the name the seed makes; the player may
  // then change the name before starting.
  await page.locator('#title-seedinput').fill('777');
  await expect(seedVal).toHaveText('777');
  await expect(page.locator('#title-nameinput')).toHaveValue(nameForSeed(777));
  await page.locator('#title-nameinput').fill('Testville');
  await page.locator('#title-start').click();

  await page.waitForFunction(() => window.__game?.seed === 777, null, { timeout: 30000 });
  await expect(page.locator('#cityname'), 'the HUD carries the city name and seed')
    .toContainText('Testville');
  await expect(page.locator('#cityname')).toContainText('seed 777');

  // The name reaches the save: the pause menu names the slot it wrote.
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toBeVisible();
  await page.locator('#pause-save').click();
  await expect(page.locator('#pause-saveline'), 'the save names the player\'s city')
    .toContainText('Testville');
  const names = await page.evaluate(() => JSON.parse(localStorage.getItem('urbis.citynames')));
  expect(names['777'], 'the renamed city sticks for the save slot to read').toBe('Testville');
  expect(errors).toEqual([]);
});
