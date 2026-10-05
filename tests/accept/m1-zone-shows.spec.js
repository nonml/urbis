// M1-1 (docs/ROADMAP.md): on all five seeds, Z into the city view, pick the R
// brush, click an empty lot with the mouse, Z back to the street. Within 60 game
// seconds the lot has its first floor, and the play camera shows it. Each seed
// saves the pavement pose before the zoning and again after the wait:
// docs/shots/m1-zone-<seed>-before.png / -after.png.
//
// The click is a real one (M0.T4): the free lot projects through __game.screenOf
// onto the canvas and the city view's own pick names it before the mouse goes
// down. The overview is aimed at the lot the way a player pans to it.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clickWorld, cityView, waitGame } from './lib/input.js';

const SEEDS = [7, 11, 22, 33, 73];
const SPEED = 4;              // ?speed: 4 fixed steps a frame, the M0 convention
const LIMIT = 60;             // M1-1's game seconds to the first floor
const STEPS_PER_SEC = 20;     // the fixed step is 50 ms (game/loop.js)
const PICK_Y = 1.2;           // half the city view's 2.4 m pick floor
const SHOTS = 'docs/shots';

function saveShot(dataUrl, name) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

test.setTimeout(300000);

test('M1-1: a mouse-zoned empty lot shows its first floor within 60 game seconds', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const late = [];
  for (const seed of SEEDS) {
    await page.goto(`/?capture=1&gen=1&seed=${seed}&speed=${SPEED}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });

    // A lot the district left open (sim/zoning.js freeLand), with the pavement
    // pose that faces it (render/vacant.js streetPose) — the play camera's view.
    const lot = await page.evaluate(() => window.__game.freeLots()[0]);
    expect(lot, `seed ${seed}: the city left land to zone`).toBeTruthy();
    await page.evaluate((p) => window.__game.pose(p.x, p.z, p.yaw), lot.pose);
    await waitGame(page, 0.5);
    saveShot(await page.evaluate(() => window.__game.shot()), `m1-zone-${seed}-before`);

    // Z, the R brush, click the lot, Z again. Aim the overview at the lot first,
    // as a player pans; the pick below still has to name the lot the projection
    // put the cursor over.
    await cityView(page, 'res');
    await page.evaluate((l) => window.__game.cityview.aim({ x: l.x, z: l.z }), lot);
    // The camera jumps to the aimed pivot on the next frame; project only after
    // it has, or the pixel goes stale the moment the pick reads it.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const hit = await page.evaluate(([x, y, z]) => {
      const px = window.__game.screenOf(x, y, z);
      const w = window.innerWidth;
      const h = window.innerHeight;
      return {
        onCanvas: document.elementFromPoint(px.x, px.y)?.id === 'scene',
        lot: window.__game.cityview.pick((px.x / w) * 2 - 1, 1 - (px.y / h) * 2),
      };
    }, [lot.x, PICK_Y, lot.z]);
    expect(hit.onCanvas && hit.lot === lot.index, `seed ${seed}: the free lot projects onto the canvas`).toBe(true);

    await clickWorld(page, lot.x, PICK_Y, lot.z);
    await waitGame(page, 0.1);
    expect(await page.evaluate((i) => window.__game.cityview.lots()[i].zoned, lot.index),
      `seed ${seed}: the mouse click zoned the lot for R`).toBe('res');
    const zonedAt = await page.evaluate(() => window.__game.step());

    await page.keyboard.press('z');
    await page.waitForFunction(
      () => window.__game.cityview.state().mode === 'street' && window.__game.cityview.state().lift <= 0,
      null, { polling: 'raf', timeout: 30000 });

    // Wait out M1-1's bar, or stop the moment the first floor stands. The
    // deadline is game steps, never wall time.
    const deadline = zonedAt + LIMIT * STEPS_PER_SEC;
    await page.waitForFunction(
      ({ i, until }) => window.__game.step() >= until || window.__game.city().parcels[i].height > 0,
      { i: lot.index, until: deadline }, { polling: 'raf', timeout: 180000 });
    const after = await page.evaluate((i) => ({
      height: window.__game.city().parcels[i].height,
      stage: window.__game.city().parcels[i].stage,
      step: window.__game.step(),
    }), lot.index);
    saveShot(await page.evaluate(() => window.__game.shot()), `m1-zone-${seed}-after`);

    if (!(after.height > 0)) {
      late.push(`seed ${seed}: no first floor after ${((after.step - zonedAt) / STEPS_PER_SEC).toFixed(1)} game s (stage ${after.stage})`);
    }
  }
  expect(late, `first floor within ${LIMIT} game seconds:\n${late.join('\n')}`).toEqual([]);
  expect(errors).toEqual([]);
});
