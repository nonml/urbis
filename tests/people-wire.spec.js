// In the running game the people are real and the day runs (milestone 3): the
// census matches what stands on the lots, every pedestrian the profiler reads is
// one of those people with a home and a job, and a capture holds the clock so
// shots repeat.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 480, height: 270 } });

async function boot(page) {
  await page.goto('/?capture=1');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
}

test('the census counts the people on the lots', async ({ page }) => {
  await boot(page);
  const c = await page.evaluate(() => window.__game.census());
  expect(c.residents).toBeGreaterThan(0);
  expect(c.workers).toBeGreaterThan(0);
  expect(c.workers + c.unemployed).toBe(c.residents);
});

test('every pedestrian is a person with a home and a job or none', async ({ page }) => {
  await boot(page);
  const seen = await page.evaluate(() => Array.from({ length: 8 }, (_, k) => window.__game.person(k)));
  for (const p of seen) {
    expect(p.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(p.home).toMatch(/^LOT \d+$/);
    expect(p.work).toMatch(/^(LOT \d+|out of work)$/);
  }
});

test('a capture holds the clock at the start hour', async ({ page }) => {
  await boot(page);
  const a = await page.evaluate(() => window.__game.hour());
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => window.__game.hour())).toBe(a);
  expect(a).toBe(22);
});
