// M7-7 (docs/ROADMAP.md): saves are safe. Three slots, each named by its
// city's name, seed, population and save time; the pause menu saves to the
// active slot at once; New Game and N never replace a save without asking
// first, in the page; a save written before slots loads from slot 1.
//
// The store is exercised in Node with the browser's storage stubbed, exactly
// as it behaves. The page-facing part boots the real game: the title is a
// player's screen (navigator.webdriver stubbed false), the pause menu and the
// N key are the robot's.
import { test, expect } from '@playwright/test';
import {
  SLOT_COUNT, activeSlot, setActiveSlot, slotInfo, slotInfos,
  loadSave, writeSave, clearSave,
} from '../../src/savestore.js';
import { nameForSeed } from '../../src/ui/title.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// A save in src/sim/save.js's shape, enough for a slot to name it.
const gameFor = (seed, population) => ({
  version: 2, seed, generate: true,
  people: { list: Array.from({ length: population }, (_, i) => ({ id: i + 1 })) },
});

const asPlayer = (page) => page.addInitScript(() => {
  Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
});
const boot = (page) => page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });

test('M7-7: three slots hold their own save, with seed, population and save time', () => {
  globalThis.localStorage = memoryStorage();
  expect(SLOT_COUNT).toBe(3);
  expect(activeSlot()).toBe(1);

  setActiveSlot(2);
  expect(writeSave(gameFor(111, 3)), 'the store took the write').toBe(true);
  expect(JSON.parse(loadSave()).seed, 'loadSave reads the active slot').toBe(111);
  expect(slotInfo(2)).toMatchObject({ hasSave: true, seed: 111, population: 3 });
  expect(slotInfo(2).savedAt, 'a save time is kept beside the save').toBeGreaterThan(0);
  expect(slotInfos().map((s) => s.hasSave), 'one slot holds, two are empty')
    .toEqual([false, true, false]);

  setActiveSlot(1);
  expect(loadSave(), 'slot 1 is empty while slot 2 holds').toBe(null);
  expect(clearSave(), 'clear touches the active slot only').toBe(true);
  expect(slotInfo(2).hasSave, 'clearing slot 1 left slot 2 alone').toBe(true);
});

test('M7-7: a save from before slots is already slot 1', () => {
  globalThis.localStorage = memoryStorage();
  localStorage.setItem('urbis.save', JSON.stringify(gameFor(1234, 5)));
  expect(activeSlot(), 'a fresh store plays slot 1').toBe(1);
  expect(JSON.parse(loadSave()).seed, 'the old key loads as slot 1').toBe(1234);
  expect(slotInfo(1), 'and lists with its seed and population')
    .toMatchObject({ hasSave: true, seed: 1234, population: 5 });
  expect(slotInfo(2).hasSave).toBe(false);
  writeSave(gameFor(9, 1));
  expect(JSON.parse(localStorage.getItem('urbis.save')).seed, 'the single-save path is intact').toBe(9);
});

test('M7-7: the title names each slot, and Continue loads the chosen one', async ({ page }) => {
  await asPlayer(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('urbis.planted')) return;
    sessionStorage.setItem('urbis.planted', '1');
    localStorage.setItem('urbis.save', JSON.stringify({
      version: 2, seed: 4242, generate: true,
      people: { list: Array.from({ length: 7 }, (_, i) => ({ id: i + 1 })) },
    }));
    localStorage.setItem('urbis.savedat.1', '1759600200000');
    localStorage.setItem('urbis.save.2', JSON.stringify({
      version: 2, seed: 777, generate: true, people: { list: [{ id: 1 }] },
    }));
    localStorage.setItem('urbis.savedat.2', '1759600300000');
  });
  await page.goto('/?savetest=1');
  await expect(page.locator('#title')).toBeVisible();

  const one = page.locator('#title-slot-1');
  await expect(one, 'slot 1 is named by its city').toContainText(nameForSeed(4242));
  await expect(one).toContainText('seed 4242');
  await expect(one).toContainText('pop 7');
  await expect(one, 'and carries its save time').toContainText(/seed 4242 · pop 7 · \S/);
  await expect(one).toHaveAttribute('data-saved-at', '1759600200000');
  await expect(page.locator('#title-slot-3')).toContainText('EMPTY');

  await page.locator('#title-slot-2').click();
  await page.locator('#title-continue').click();
  await page.waitForFunction(() => window.__game?.seed === 777, null, { timeout: 30000 });
  expect(await page.evaluate(() => localStorage.getItem('urbis.slot'))).toBe('2');
});

test('M7-7: New Game takes an empty slot, and asks before it replaces one', async ({ page }) => {
  await asPlayer(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('urbis.planted')) return;
    sessionStorage.setItem('urbis.planted', '1');
    localStorage.setItem('urbis.save', JSON.stringify({
      version: 2, seed: 4242, generate: true, people: { list: [{ id: 1 }] },
    }));
  });
  await page.goto('/?savetest=1');
  await expect(page.locator('#title')).toBeVisible();
  const planted = await page.evaluate(() => localStorage.getItem('urbis.save'));

  // An empty slot needs no ask: the panel opens on that slot.
  await page.locator('#title-slot-2').click();
  await page.locator('#title-newgame').click();
  await expect(page.locator('#title-newgame-panel')).toBeVisible();
  await expect(page.locator('#title-replace')).toBeHidden();
  await expect(page.locator('#title-slot-target')).toContainText('SLOT 2');

  // An occupied slot asks in the page first; cancelling leaves it alone.
  await page.locator('#title-newgame-back').click();
  await page.locator('#title-slot-1').click();
  await page.locator('#title-newgame').click();
  await expect(page.locator('#title-replace')).toBeVisible();
  await expect(page.locator('#title-replace')).toContainText(nameForSeed(4242));
  await page.locator('#title-replace-no').click();
  await expect(page.locator('#title-replace')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('urbis.save')).seed)).toBe(4242);

  // Confirming opens the panel on slot 1, and starting replaces that slot.
  await page.locator('#title-newgame').click();
  await page.locator('#title-replace-yes').click();
  await expect(page.locator('#title-slot-target')).toContainText('SLOT 1');
  const newSeed = Number(await page.locator('#title-seed').textContent());
  await page.locator('#title-start').click();
  await page.waitForFunction((s) => window.__game?.seed === s, newSeed, { timeout: 30000 });
  expect(await page.evaluate(() => localStorage.getItem('urbis.slot'))).toBe('1');
  expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);
  const after = await page.evaluate(() => localStorage.getItem('urbis.save'));
  expect(JSON.parse(after).seed, 'start wrote the new city into slot 1').toBe(newSeed);
  expect(after, 'and replaced the planted save, not re-listed it').not.toBe(planted);
});

test('M7-7: the pause menu writes the active slot at once', async ({ page }) => {
  await page.goto('/?savetest=1');
  await boot(page);
  await page.evaluate(() => {
    localStorage.removeItem('urbis.save');
    localStorage.removeItem('urbis.savedat.1');
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toBeVisible();
  await page.locator('#pause-save').click();
  const slot = await page.evaluate(() => ({
    raw: localStorage.getItem('urbis.save'),
    at: Number(localStorage.getItem('urbis.savedat.1')),
    seed: window.__game.seed,
  }));
  expect(JSON.parse(slot.raw).seed, 'the button wrote the slot at once').toBe(slot.seed);
  expect(slot.at).toBeGreaterThan(0);
  await expect(page.locator('#pause-saveline')).toContainText('SAVED');
});

test('M7-7: N asks in the page; cancel keeps the save, confirm replaces it', async ({ page }) => {
  // A player's run without the title (a capture): N is play input, not a menu.
  await asPlayer(page);
  await page.goto('/?capture=1');
  await boot(page);
  expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);
  const before = await page.evaluate(() => {
    window.__marker = 1;
    return localStorage.getItem('urbis.save');
  });
  await page.keyboard.press('n');
  const ask = page.locator('#newgame-ask');
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('SLOT 1');
  await page.locator('#newgame-no').click();
  await expect(ask).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('urbis.save')), 'cancel replaced nothing').toBe(before);
  expect(await page.evaluate(() => !!window.__marker), 'cancel did not reload the page').toBe(true);

  await page.keyboard.press('n');
  await expect(ask).toBeVisible();
  await page.locator('#newgame-yes').click();
  await page.waitForFunction(() => window.__game && !window.__marker, null, { timeout: 30000 });
  expect(await page.evaluate(() => localStorage.getItem('urbis.save')), 'the new game cleared the slot')
    .toBe(null);
});
