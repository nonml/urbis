// The game runs the commute (milestone 3): main ticks it every frame, a walker
// who has gone indoors is not drawn, casts no shadow and cannot be profiled,
// and the profiler says where a commuter is heading.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createStreet } from '../src/sim/street.js';
import { createMap } from '../src/sim/map.js';
import { createHackables, syncHackables } from '../src/sim/hackables.js';

test.use({ viewport: { width: 480, height: 270 } });

test('a walker who has gone indoors cannot be profiled', () => {
  // The profiler aims through the hackables registry (M6.T2b): a walker indoors
  // is not registered, so nothing can aim at them.
  const map = createMap(1);
  const street = createStreet(1, map);
  const n = street.npcs[0];
  n.out = true;
  const reg = createHackables({ map, street });
  const has = () => [...reg.npcs.values()].some((e) => e.ref === n);
  expect(has()).toBe(true);
  n.out = false;
  syncHackables(reg, { map, street });
  expect(has()).toBe(false);
});

test('main ticks the commute and every walker view skips the ones indoors', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  expect(main).toMatch(/tickCommute\(street, people, city, clock\.hour, player\.x, player\.z\)/);
  expect(main).toMatch(/commuteLabel\(targetPerson, clock\.hour\)/);
  expect(fs.readFileSync('src/render/npcs.js', 'utf8')).toMatch(/n\.out === false/);
  expect(fs.readFileSync('src/render/blobs.js', 'utf8')).toMatch(/n\.out === false/);
  expect(fs.readFileSync('src/render/profiler.js', 'utf8')).toMatch(/export function updateProfiler\(camera, target, person = null, doing = null\)/);
});

test('the street empties at 3am and fills at the morning rush', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?capture=1');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const atStart = await page.evaluate(() => window.__game.walkersOut());
  await page.evaluate(() => window.__game.setHour(3));
  await page.waitForTimeout(800);
  const night = await page.evaluate(() => window.__game.walkersOut());
  await page.evaluate(() => window.__game.setHour(8));
  await page.waitForTimeout(800);
  const rush = await page.evaluate(() => window.__game.walkersOut());
  expect(atStart, '22:00 leaves some indoors').toBeLessThan(72);
  expect(night, '3am is emptier than 22:00').toBeLessThan(atStart);
  expect(rush, 'the rush fills the street').toBeGreaterThan(night + 20);
  expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
  expect(errors).toEqual([]);
});
