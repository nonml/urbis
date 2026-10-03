// A new game boots without an error in the console. The gate only listened for
// uncaught exceptions, so two story boards that overflow the sign atlas printed
// "[arc] sign lot_arden does not fit the atlas" on every boot, beside a 404, and
// nothing failed (D12, docs/shots/REVIEW.md).
import { test, expect } from '@playwright/test';

const QUERIES = ['', '&gen=1&seed=7', '&gen=1&seed=73', '&gen=1&seed=1234567'];

for (const q of QUERIES) {
  test(`a new game boots clean: ${q || 'the hand map'}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`/?capture=1${q}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}
