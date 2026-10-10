// M5-17 (docs/ROADMAP.md): pause and speed in the city view. Space pauses the
// overview and Space resumes it; three buttons run the sim at 1, 2 and 4 fixed
// steps a frame through M0's own speed (game/loop.js, M0-2); and leaving the
// city view always puts the street back to 1.
//
// Every check is the player's own: the key and the palette's buttons, through
// the game's listeners, and the numbers read off the running game —
// __game.step() counts the fixed steps the frame loop really ran and
// __game.stateHash() is the hash the record/replay checks trust. Nothing here
// reaches behind the game: no sim function is called to make it work.
import { test, expect } from '@playwright/test';
import { cityView } from './lib/input.js';

const SEED = 7;
const FRAMES = 40;                  // animation frames the step rate is counted over
test.setTimeout(240000);

// The fixed steps the frame loop ran over `frames` animation frames. One
// main.js frame runs between each of this sampler's ticks, so a game set to N
// steps a frame advances exactly N a tick — which is what the buttons promise.
function stepsPerFrames(page, frames = FRAMES) {
  return page.evaluate((n) => new Promise((resolve) => {
    let ticks = 0, first = null, last = 0;
    const tick = () => {
      const step = window.__game.step();
      if (first === null) first = step;
      last = step;
      if (++ticks >= n) resolve({ steps: last - first, frames: ticks });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), frames);
}

// What a second of real time is worth at speed 1: the game's own 50 ms steps.
function stepsPerSecond(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now(), s0 = window.__game.step();
    const tick = () => {
      const secs = (performance.now() - t0) / 1000;
      if (secs >= 1) resolve({ steps: window.__game.step() - s0, secs });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

const speedOf = (page) => page.evaluate(() => window.__game.cityview.state().speed);

async function open(page) {
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await cityView(page);
}

test('M5-17: Space pauses the city view, and Space resumes it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page);

  // Up there the city runs on its own before any key is pressed.
  const t0 = await page.evaluate(() => window.__game.step());
  await page.waitForFunction((n) => window.__game.step() > n, t0, { polling: 'raf', timeout: 30000 });

  await page.keyboard.press(' ');
  expect(await speedOf(page), 'Space paused the overview').toBe(0);
  await expect(page.locator('#speed'), 'the row says the overview is paused').toHaveAttribute('data-speed', '0');
  const held = await page.evaluate(() => window.__game.step());
  const hash = await page.evaluate(() => window.__game.stateHash());

  // Ten seconds: not one sim step, and the whole state hash unchanged.
  await page.waitForTimeout(10000);
  expect(await page.evaluate(() => window.__game.step()), 'a paused city runs no step').toBe(held);
  expect(await page.evaluate(() => window.__game.stateHash()), 'a paused city keeps the same state').toBe(hash);

  // The same key starts it again, from where it stopped.
  await page.keyboard.press(' ');
  expect(await speedOf(page), 'Space resumed the overview').toBe(1);
  await page.waitForFunction((n) => window.__game.step() > n, held, { polling: 'raf', timeout: 30000 });
  expect(errors).toEqual([]);
});

test('M5-17: the three speed buttons run 1, 2 and 4 fixed steps a frame', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page);

  // 1x is real time: a second of it is a second of game time, not four.
  const one = await stepsPerSecond(page);
  expect(one.steps / one.secs, '1x runs a second of game time a second').toBeGreaterThan(12);
  expect(one.steps / one.secs, '1x is not four steps a frame').toBeLessThan(28);

  for (const n of [1, 2, 4]) {
    await page.click(`#speed-${n}`);
    await expect(page.locator(`#speed-${n}`), `the ${n}x button is the one held`).toHaveAttribute('data-on', 'yes');
    expect(await speedOf(page), `the ${n}x button set the speed`).toBe(n);
    const ran = await stepsPerFrames(page);
    if (n === 1) {
      // 1x is the real-time accumulator: at most a step a frame, never four.
      expect(ran.steps, '1x runs no faster than one step a frame').toBeLessThan(ran.frames);
      expect(ran.steps, '1x still runs').toBeGreaterThan(0);
    } else {
      expect(ran.steps, `${n}x runs exactly ${n} fixed steps a frame`).toBe(n * (ran.frames - 1));
    }
  }
  expect(errors).toEqual([]);
});

test('M5-17: leaving the city view sets the street back to 1', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page);

  await page.click('#speed-4');
  const fast = await stepsPerFrames(page);
  expect(fast.steps, 'the overview was running four steps a frame').toBe(4 * (fast.frames - 1));

  // Z back to the street: the overview's speed does not follow the player down.
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'street' && v.lift <= 0;
  }, null, { polling: 'raf', timeout: 30000 });
  expect(await speedOf(page), 'the street is back to one step a frame').toBe(1);

  const back = await stepsPerFrames(page);
  expect(back.steps, 'the street runs one step a frame at most, not four').toBeLessThan(back.frames);
  expect(back.steps, 'the street still runs').toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
