// M2-7 (docs/ROADMAP.md): the weather is drawn. Rain falls only while it is
// raining; clear and overcast frames show none of it. Clear, overcast and rain
// each draw a different frame at the spawn by day and by night — overcast and
// rain take the blue out of the frame (grey sky, no sun) and rain wets the road
// — and no state spends a draw the old always-rain frame did not.
//
// The rain's own pixels are named by the draw ledger (game/probe.js, capture
// only): the one Points mesh drawn with a ShaderMaterial is the rain cloud.
// The look is compared as a 48x27 mean-colour grid of the shot, so the check
// measures the frame without opening a PNG. The six shots land in docs/shots/
// for the REVIEW.md pass. Every state is frozen on the same fixed step, so the
// same seed draws the same street in every state: only the weather may differ.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const SEED = 1;
const SPEED = 2;          // whole steps a frame: the sim advances by twos
const STEPS = 16;         // the step every weather state is frozen on
const GW = 48, GH = 27;   // mean-colour grid the frames are compared on
const DIFF = 10;          // per-channel levels that count a cell as changed
const STATES = ['clear', 'overcast', 'rain'];
const SHOTS = 'docs/shots';

test.setTimeout(300000);

// Freeze every page on the same step, before its frame callback: with ?speed=2
// the sim takes whole steps, so the same seed draws the same street and the
// same traffic in every weather, and only the weather differs between shots.
async function freezeAt(page, steps) {
  await page.addInitScript((n) => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => {
      const g = window.__game;
      if (g && g.step() >= n) g.pause();
      cb(t);
    });
  }, steps);
}

async function boot(page, state) {
  await page.goto(`/?capture=1&gen=1&seed=${SEED}&speed=${SPEED}&weather=${state}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
}

// One rendered frame as a GW x GH mean-colour RGBA grid: drawImage averages the
// canvas, so a cell is the colour the frame has in that part of the view.
async function gridOf(page) {
  return page.evaluate(async ({ gw, gh }) => {
    const img = new Image();
    img.src = window.__game.shot();
    await img.decode();
    const c = document.createElement('canvas');
    c.width = gw; c.height = gh;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, gw, gh);
    return [...g.getImageData(0, 0, gw, gh).data];
  }, { gw: GW, gh: GH });
}

async function saveShot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  const png = await page.evaluate(() => window.__game.shot());
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
}

// Let the material programs compile and the frame settle at the new state.
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const tick = () => (++n > 24 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }));
}

// The rows the rain drew: one Points mesh with a ShaderMaterial (render/rain.js).
// Hack-fx sparks and the stars are PointsMaterial, so this names the rain alone.
const rainRows = (frames) => frames.flat().filter((r) => r.type === 'Points' && r.material === 'ShaderMaterial');

async function sampleDraws(page, frames) {
  return page.evaluate((n) => new Promise((resolve) => {
    const out = [];
    const tick = () => {
      out.push(window.__game.draws());
      if (out.length >= n) resolve(out);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), frames);
}

// Share of grid cells whose colour moved more than DIFF levels in a channel.
function diffShare(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (d > DIFF) changed++;
  }
  return changed / (a.length / 4);
}

// The sky, as pixels: the clear day frame's bright blue cells — sky is bright
// and blue, glass is not bright — and the same cells read in another state.
// Overcast and rain must turn them grey, which is the drawn sky changing.
function skyCells(clear) {
  const idx = [];
  for (let i = 0; i < clear.length; i += 4) {
    const r = clear[i], g = clear[i + 1], b = clear[i + 2];
    if ((r + g + b) / 3 > 150 && b - r > 10) idx.push(i);
  }
  return idx;
}

function meanBlueAt(grid, idx) {
  let sum = 0;
  for (const i of idx) sum += grid[i + 2] - grid[i];
  return idx.length ? sum / idx.length : 0;
}

test('M2-7: each weather state draws, rain falls only in rain, no state costs a new draw', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const frames = {};
  const draws = {};
  // The freeze script is installed once and runs on every navigation.
  await freezeAt(page, STEPS);
  for (const state of STATES) {
    await boot(page, state);
    // Day first, then night, both at the spawn pose: ?capture holds the clock.
    await page.evaluate(() => window.__game.night(0));
    await settle(page);
    frames[state] = {
      day: await gridOf(page),
      rain: rainRows(await page.evaluate(() => window.__game.ledger(1))),
    };
    await saveShot(page, `m2-weather-${state}-day`);
    draws[state] = await sampleDraws(page, 30);
    await page.evaluate(() => window.__game.night(1));
    await settle(page);
    frames[state].night = await gridOf(page);
    await saveShot(page, `m2-weather-${state}-night`);
  }
  expect(errors, 'no page error').toEqual([]);

  // The rain falls only in rain: its one draw is in the rain frame, nowhere else.
  expect(frames.rain.rain.length, 'the rain cloud draws in rain').toBeGreaterThan(0);
  expect(frames.clear.rain.length, 'no rain cloud in clear').toBe(0);
  expect(frames.overcast.rain.length, 'no rain cloud in overcast').toBe(0);

  // Each state is a different frame by day; rain is visible by night too.
  expect(diffShare(frames.clear.day, frames.overcast.day), 'overcast differs from clear by day').toBeGreaterThan(0.05);
  expect(diffShare(frames.clear.day, frames.rain.day), 'rain differs from clear by day').toBeGreaterThan(0.05);
  expect(diffShare(frames.overcast.day, frames.rain.day), 'rain differs from overcast by day').toBeGreaterThan(0.03);
  expect(diffShare(frames.clear.night, frames.rain.night), 'rain differs from clear by night').toBeGreaterThan(0.05);

  // Overcast and rain grey the sky: the cells that are blue sky in the clear
  // day frame lose their blue in the same cells of the other states.
  const sky = skyCells(frames.clear.day);
  expect(sky.length, 'the clear day frame shows sky').toBeGreaterThanOrEqual(4);
  expect(meanBlueAt(frames.clear.day, sky) - meanBlueAt(frames.overcast.day, sky), 'overcast greys the sky').toBeGreaterThan(15);
  expect(meanBlueAt(frames.clear.day, sky) - meanBlueAt(frames.rain.day, sky), 'rain greys the sky').toBeGreaterThan(15);

  // Day and night are really two frames in every state.
  for (const s of STATES) {
    expect(diffShare(frames[s].day, frames[s].night), `${s}: day and night differ`).toBeGreaterThan(0.2);
  }

  // No new draws: overcast is clear's own count and rain is that plus the one
  // rain cloud the old build always drew; every state stays inside law 3.
  for (const s of STATES) expect(Math.max(...draws[s]), `${s}: inside the draw budget`).toBeLessThanOrEqual(175);
  expect(Math.min(...draws.overcast), 'overcast draws exactly what clear does').toBe(Math.min(...draws.clear));
  expect(Math.min(...draws.rain), 'rain adds only its one cloud').toBe(Math.min(...draws.clear) + 1);
});
