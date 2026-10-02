// The game boots the world pickWorld picks (milestone 2): a player's New Game is
// a generated city, the save remembers it, and an old save continues on the
// hand preset. Automated runs are unchanged.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ viewport: { width: 480, height: 270 } });

// A player's browser, not a robot's: boot.js reads navigator.webdriver.
const asPlayer = (page) => page.addInitScript(() => {
  Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
});
const boot = (page) => page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });

test('boot.js asks pickWorld, and the save carries whether the city was generated', () => {
  const bootSrc = fs.readFileSync('src/boot.js', 'utf8');
  expect(bootSrc).toMatch(/import \{ pickWorld \} from '\.\/sim\/newgame\.js'/);
  expect(bootSrc).toMatch(/setWorldSeed\(SEED, GENERATE\)/);
  expect(bootSrc).not.toMatch(/FIXED_SEED = 20260916/);
  expect(fs.readFileSync('src/sim/save.js', 'utf8')).toMatch(/generate: game\.generate === true/);
  expect(fs.readFileSync('src/main.js', 'utf8')).toMatch(/serialize\(\{ seed: SEED, generate: GENERATE,/);
});

test('a player\'s New Game is a generated city, and continuing keeps it', async ({ page }) => {
  await asPlayer(page);
  await page.goto('/');
  await boot(page);
  const first = await page.evaluate(() => ({ seed: window.__game.seed, generated: window.__game.generated }));
  expect(first.generated).toBe(true);
  expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('urbis.save')));
  expect([saved.seed, saved.generate]).toEqual([first.seed, true]);
  await page.reload();
  await boot(page);
  expect(await page.evaluate(() => ({ seed: window.__game.seed, generated: window.__game.generated }))).toEqual(first);
});

test('an old save continues on the hand preset', async ({ page }) => {
  await asPlayer(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('planted')) return;
    sessionStorage.setItem('planted', '1');
    localStorage.setItem('urbis.save', JSON.stringify({ version: 2, seed: 1234 }));
  });
  await page.goto('/');
  await boot(page);
  expect(await page.evaluate(() => ({ seed: window.__game.seed, generated: window.__game.generated })))
    .toEqual({ seed: 1234, generated: false });
});

test('?gen=0 plays the hand preset, and a robot still does by default', async ({ page, browser }) => {
  await asPlayer(page);
  await page.goto('/?gen=0');
  await boot(page);
  expect(await page.evaluate(() => window.__game.generated)).toBe(false);
  const robot = await browser.newPage();
  await robot.goto('/');
  await boot(robot);
  expect(await robot.evaluate(() => ({ seed: window.__game.seed, generated: window.__game.generated })))
    .toEqual({ seed: 20260916, generated: false });
  await robot.close();
});
