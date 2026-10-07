// M5-1 (docs/ROADMAP.md): on all five seeds the player drags a road of at
// least 100 m from an existing road into open land with the mouse, drives its
// full length with the keys, and finds new lots on both sides
// (docs/shots/m5-road-<seed>.png). The site is the seed's own map; the drag is
// a real mouse drag with the road tool from the palette (M5.T3).
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createMap, projectOnSegment } from '../../src/sim/map.js';
import { addRoad, undo } from '../../src/sim/ops.js';
import { hold, waitGame } from './lib/input.js';

const SEEDS = [7, 11, 22, 33, 73];
const LENGTH = 120, DRIVE_SECS = 30;   // metres dragged, seconds W is held
const SPEED = 4, PICK_Y = 1.2, SHOTS = 'docs/shots';
test.setTimeout(600000);
// Clear ground: inside the drive bounds, off the water, and no standing
// building on the line. Empty lots are open land and fair game.
function lane(map, a, b) {
  const drive = map.district.drive, m = 4;
  const inside = (p) => p.x > drive.minX + m && p.x < drive.maxX - m
    && p.z > drive.minZ + m && p.z < drive.maxZ - m;
  if (!inside(a) || !inside(b)) return false;
  return Array.from({ length: 25 }, (_, i) => i).every((i) => {
    const x = a.x + (b.x - a.x) * i / 24, z = a.z + (b.z - a.z) * i / 24;
    const wet = (map.water ?? []).some(([cx, cz, hw, hd]) =>
      Math.abs(x - cx) <= hw + 2 && Math.abs(z - cz) <= hd + 2);
    const blocked = map.parcels.some((p) => (p.kind !== 'lot' || p.stage > 0)
      && projectOnSegment(p.x, p.z, a, b).dist <= 7.5 + Math.max(p.w, p.d) / 2);
    return !wet && !blocked;
  });
}
// The first drag a player could make: a straight extension of a generated road
// into clear land the op accepts with lots on both sides.
function roadSite(seed) {
  const map = createMap(seed);
  const before = new Set(map.parcels.map((p) => p.id));
  for (const node of map.graph.nodes) for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const from = { x: node.x, z: node.z };
    const to = { x: node.x + dx * LENGTH, z: node.z + dz * LENGTH };
    if (!lane(map, from, to)) continue;
    const version = map.version;
    addRoad(map, from, to);
    if (map.version === version) continue;
    const side = (p) => Math.sign((to.x - from.x) * (p.z - from.z) - (to.z - from.z) * (p.x - from.x));
    const added = map.parcels.filter((p) => p.kind === 'lot' && !before.has(p.id));
    if (added.some((p) => side(p) < 0) && added.some((p) => side(p) > 0)) return { from, to };
    undo(map);
  }
  return null;
}

for (const seed of SEEDS) {
  test(`M5-1 seed ${seed}: a dragged road into open land is driven end to end`, async ({ page }) => {
    test.fail(true, 'M5-1 red: no road tool or road drag in the city view');
    const site = roadSite(seed);
    expect(site, `seed ${seed}: the seed has open land for a 120 m drag`).toBeTruthy();
    await page.goto(`/?capture=1&gen=1&seed=${seed}&speed=${SPEED}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.keyboard.press('z');
    await page.waitForFunction(() => {
      const v = window.__game.cityview.state();
      return v.mode === 'city' && v.lift >= 1;
    }, null, { polling: 'raf', timeout: 30000 });
    const tool = await page.$('#tool-road');
    expect(tool, `seed ${seed}: the road tool is in the palette`).toBeTruthy();
    await tool.click();
    await page.evaluate((m) => window.__game.cityview.aim(m),
      { x: (site.from.x + site.to.x) / 2, z: (site.from.z + site.to.z) / 2 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const before = await page.evaluate(() => window.__game.city().parcels.map((p) => p.id));
    const from = await page.evaluate((p) => window.__game.screenOf(p.x, 0.5, p.z), site.from);
    const to = await page.evaluate((p) => window.__game.screenOf(p.x, 0.5, p.z), site.to);
    const onCanvas = (px) => page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.id === 'scene', px);
    expect(await onCanvas(from) && await onCanvas(to), `seed ${seed}: both ends project onto the canvas`).toBe(true);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8);
    await page.mouse.up();
    await waitGame(page, 0.2);
    const added = await page.evaluate((ids) => window.__game.city().parcels
      .filter((p) => p.kind === 'lot' && !ids.includes(p.id)).map((p) => ({ x: p.x, z: p.z })), before);
    const side = (p) => Math.sign((site.to.x - site.from.x) * (p.z - site.from.z) - (site.to.z - site.from.z) * (p.x - site.from.x));
    expect(added.some((p) => side(p) < 0) && added.some((p) => side(p) > 0),
      `seed ${seed}: new lots on both sides (${added.length} added)`).toBe(true);
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(`${SHOTS}/m5-road-${seed}.png`,
      Buffer.from((await page.evaluate(() => window.__game.shot())).split(',')[1], 'base64'));
    // Z down, stand the hero car at the near end, drive the length with W.
    await page.keyboard.press('z');
    await page.waitForFunction(
      () => window.__game.cityview.state().mode === 'street' && window.__game.cityview.state().lift <= 0,
      null, { polling: 'raf', timeout: 30000 });
    await page.evaluate((p) => window.__game.police.drive(p.x, p.z, p.yaw),
      { ...site.from, yaw: Math.atan2(site.to.x - site.from.x, site.to.z - site.from.z) });
    await waitGame(page, 0.5);
    await hold(page, 'w', DRIVE_SECS);
    const car = await page.evaluate(() => window.__game.car());
    const hit = projectOnSegment(car.x, car.z, site.from, site.to);
    expect(hit.t * LENGTH, `seed ${seed}: the car drove ${(hit.t * LENGTH).toFixed(1)} of ${LENGTH} m`)
      .toBeGreaterThanOrEqual(LENGTH * 0.9);
    expect(hit.dist, `seed ${seed}: the car stayed on the new road`).toBeLessThan(4);
  });
}
