// The news line is on screen (milestone 3): main ticks the news after the city
// and the people, and a few minutes of the city running put lines top right.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ viewport: { width: 960, height: 540 } });

test('main ticks the news and shows it', () => {
  const src = fs.readFileSync('src/main.js', 'utf8');
  expect(src).toMatch(/import \{ createNews, tickNews, liveNews \} from '\.\/sim\/news\.js'/);
  expect(src).toMatch(/import \{ buildNews, showNews \} from '\.\/render\/news\.js'/);
  expect(src).toMatch(/tickNews\(news, city, people, street\)/);
  expect(src).toMatch(/showNews\(newsLine, liveNews\(news, street\.time\)\)/);
});

for (const world of ['', '&gen=1&seed=7']) {
  test(`three minutes of the city make the news${world ? ` (${world.slice(1)})` : ' (hand preset)'}`, async ({ page }) => {
    const bad = [];
    page.on('pageerror', (e) => bad.push(String(e)));
    await page.goto(`/?capture=1${world}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__game.zoning.skip(180));
    await page.waitForFunction(() => window.__game.news().length > 0, null, { timeout: 10000 });
    const lines = await page.evaluate(() => window.__game.news());
    expect(lines.length).toBeLessThanOrEqual(4);
    for (const line of lines) expect(line).toMatch(/^[0-9A-Z]/);
    await expect(page.locator('#news')).toBeVisible();
    expect((await page.locator('#news').textContent()).length).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });
}
