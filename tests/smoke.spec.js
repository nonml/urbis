// The fast gate's one look at the running game: the hand map and a generated
// city boot with no error and no failed request, and draw within budget. Every
// other browser test boots the whole city for seconds at a time; those run in
// `npm run gate:full`, which blocks nothing.
import { test, expect } from '@playwright/test';

const DRAW_BUDGET = 175;
const BOOTS = ['', '&gen=1&seed=7'];

for (const query of BOOTS) {
  test(`boots clean and within ${DRAW_BUDGET} draws: ${query || 'hand map'}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`/?capture=1${query}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    const draws = await page.evaluate(() => window.__game.draws());
    console.log(`draws: ${draws} / ${DRAW_BUDGET} (${query || 'hand map'})`);
    expect(errors).toEqual([]);
    expect(draws).toBeLessThanOrEqual(DRAW_BUDGET);
  });
}
