// M5-2 (docs/ROADMAP.md): on all five seeds the player clicks one row
// building, one tower and one grown lot with the bulldozer; each is gone
// within 60 game seconds, its land is an empty lot that zones R and grows, the
// gap shows in the shot, draws stay at or under 175, and a saved game keeps it
// (docs/shots/m5-bulldoze-<seed>.png). ?savetest=1 boots the fixed test seed,
// so this seed rides in the title's pending key for one boot; the key is
// removed before the reload or that boot would wipe the save.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clickWorld, waitGame } from './lib/input.js';

const SEEDS = [7, 11, 22, 33, 73];
const SPEED = 4, PICK_Y = 1.2, SHOTS = 'docs/shots';
const GONE_STEPS = 60 * 20;   // 60 game seconds at the 50 ms step
test.setTimeout(600000);
// ?savetest=1 on, with the seed parked in the title's pending key for the boot.
async function bootView(page, seed) {
  await page.goto(`/?capture=1&gen=1&seed=${seed}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.evaluate((s) => localStorage.setItem('urbis.pending', JSON.stringify({ seed: s, name: 'accept' })), seed);
  await page.goto(`/?capture=1&savetest=1&speed=${SPEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__game.seed)).toBe(seed);
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 30000 });
}

async function aim(page, x, z) {
  await page.evaluate((p) => window.__game.cityview.aim(p), { x, z });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const parcel = (page, id) => page.evaluate((i) => window.__game.city().parcels.find((p) => p.id === i), id);
const stateOf = (page, ids) => page.evaluate((list) => {
  const all = window.__game.city().parcels;
  return list.map((id) => {
    const p = all.find((q) => q.id === id);
    return p && { id, kind: p.kind, zoned: p.zoned, stage: p.stage };
  });
}, ids);

for (const seed of SEEDS) {
  test(`M5-2 seed ${seed}: row, tower and lot are bulldozed, zoned and saved`, async ({ page }) => {
    await bootView(page, seed);
    const parcels = await page.evaluate(() => window.__game.city().parcels);
    const targets = [parcels.find((p) => p.kind === 'row'), parcels.find((p) => p.kind === 'tower'),
      parcels.find((p) => p.kind === 'lot' && p.stage > 0)];
    for (const t of targets) expect(t, `seed ${seed}: the map has a row, a tower and a grown lot`).toBeTruthy();
    const gaps = [];
    for (const target of targets) {
      await aim(page, target.x, target.z);
      const tool = await page.$('#tool-bulldoze');
      expect(tool, `seed ${seed}: the bulldoze tool is in the palette`).toBeTruthy();
      await tool.click();
      const start = await page.evaluate(() => window.__game.step());
      for (let i = 0; i < 8; i++) {   // one click a stage, until the lot is clear
        const cur = await parcel(page, target.id);
        if (cur.stage === 0) break;
        await clickWorld(page, cur.x, PICK_Y, cur.z);
        await waitGame(page, 0.05);
      }
      const end = await page.evaluate(() => window.__game.step());
      const dead = await parcel(page, target.id);
      expect(dead.kind, `seed ${seed}: the ${target.kind} is an empty lot`).toBe('lot');
      expect(dead.stage, `seed ${seed}: the ${target.kind} came down`).toBe(0);
      expect(end - start, `seed ${seed}: the ${target.kind} gone within 60 game seconds`).toBeLessThanOrEqual(GONE_STEPS);
      gaps.push(dead);
    }
    for (const gap of gaps) {   // the gap zones R and grows like any new land
      await aim(page, gap.x, gap.z);
      await page.keyboard.press('r');
      await waitGame(page, 0.05);
      await clickWorld(page, gap.x, PICK_Y, gap.z);
      await waitGame(page, 0.05);
      expect((await parcel(page, gap.id)).zoned, `seed ${seed}: the gap zones R`).toBe('res');
    }
    await page.evaluate(() => window.__game.zoning.skip(61));
    for (const gap of gaps) {
      expect((await parcel(page, gap.id)).height, `seed ${seed}: the gap grows a floor`).toBeGreaterThan(0);
    }
    await aim(page, gaps[0].x, gaps[0].z);
    mkdirSync(SHOTS, { recursive: true });
    const url = await page.evaluate(() => window.__game.shot());
    writeFileSync(`${SHOTS}/m5-bulldoze-${seed}.png`, Buffer.from(url.split(',')[1], 'base64'));
    const keep = await stateOf(page, gaps.map((p) => p.id));
    expect(await page.evaluate(() => window.__game.draws()), `seed ${seed}: draws at the gap`).toBeLessThanOrEqual(175);
    expect(await page.evaluate(() => window.__game.saveNow())).toBe(true);
    await page.evaluate(() => localStorage.removeItem('urbis.pending'));
    await page.reload();
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.evaluate(() => window.__game.pause());
    expect(await page.evaluate(() => window.__game.seed)).toBe(seed);
    const after = await stateOf(page, gaps.map((p) => p.id));
    for (let i = 0; i < keep.length; i++) {
      expect(after[i]?.kind, `seed ${seed}: ${keep[i].id} kept after reload`).toBe(keep[i].kind);
      expect(after[i]?.zoned, `seed ${seed}: ${keep[i].id} zoning kept`).toBe(keep[i].zoned);
      expect(after[i]?.stage, `seed ${seed}: ${keep[i].id} stage kept`).toBeGreaterThanOrEqual(keep[i].stage);
    }
  });
}
