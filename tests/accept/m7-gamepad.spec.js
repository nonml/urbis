// M7-8 (docs/ROADMAP.md): a standard pad plays the street — move, look, run,
// drive, enter, hack, journal — and the bindings screen shows the pad. The city
// view stays mouse and keys (D13): with the overview up the pad is dead.
// The pad is a fake behind navigator.getGamepads; its state lives on window.__pad.
// The game reads it once a fixed step, so tests wait in game steps, never wall time.
import { test, expect } from '@playwright/test';
import { waitGame } from './lib/input.js';
import { buildSettingsPanel } from '../../src/ui/settings.js';

const SEED = 7;
const PAD_A = 0, PAD_X = 2, PAD_Y = 3, PAD_RT = 7; // standard-mapping indices

// The pad a driver would hand the page: 17 buttons and four axes, all mutable
// from the test through window.__pad.
const installPad = (page) => page.addInitScript(() => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = {
    id: 'Fake Standard Pad', index: 0, connected: true, mapping: 'standard',
    buttons, axes: [0, 0, 0, 0], timestamp: 0,
  };
  window.__pad = {
    setButton(i, on) { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; },
    setAxis(i, v) { pad.axes[i] = v; },
    reset() { for (const b of buttons) { b.pressed = false; b.value = 0; } pad.axes.fill(0); },
  };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
});

async function bootPadded(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await installPad(page);
  await page.goto(`/?capture=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  return errors;
}

// Hold a button over a sim step and release it over another, so the once-a-step
// read sees both edges however the frames fall.
async function tapPad(page, index) {
  await page.evaluate((i) => window.__pad.setButton(i, true), index);
  await waitGame(page, 0.1);
  await page.evaluate((i) => window.__pad.setButton(i, false), index);
  await waitGame(page, 0.1);
}

const moved = (page, from) => page.evaluate((w) => {
  const p = window.__game.player();
  return Math.hypot(p.x - w.x, p.z - w.z);
}, from);

test('M7-8: the pad walks, runs and looks the street', async ({ page }) => {
  const errors = await bootPadded(page);
  // Move: left stick forward, no keys.
  const was = await page.evaluate(() => window.__game.player());
  await page.evaluate(() => window.__pad.setAxis(1, -1));
  await waitGame(page, 2);
  await page.evaluate(() => window.__pad.reset());
  const walked = await moved(page, was);
  expect(walked, 'left stick forward walks the player').toBeGreaterThan(3);
  // Run: the same stick with RT covers more ground in the same game seconds.
  await waitGame(page, 1);
  const fromRun = await page.evaluate(() => window.__game.player());
  await page.evaluate((rt) => { window.__pad.setAxis(1, -1); window.__pad.setButton(rt, true); }, PAD_RT);
  await waitGame(page, 2);
  await page.evaluate(() => window.__pad.reset());
  const ran = await moved(page, fromRun);
  expect(ran, 'RT runs while the stick walks').toBeGreaterThan(walked * 1.3);
  // Look: the right stick orbits the follow camera with the player standing.
  await waitGame(page, 1);
  const camWas = await page.evaluate(() => window.__game.cam());
  await page.evaluate(() => window.__pad.setAxis(2, 1));
  await waitGame(page, 1);
  await page.evaluate(() => window.__pad.reset());
  const camNow = await page.evaluate(() => window.__game.cam());
  expect(Math.hypot(camNow[0] - camWas[0], camNow[2] - camWas[2]), 'the right stick turns the camera')
    .toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});

test('M7-8: the pad enters and drives, hacks and opens the journal', async ({ page }) => {
  const errors = await bootPadded(page);
  // Enter: A at the spawn enters the hero car, as F does.
  await tapPad(page, PAD_A);
  await page.waitForFunction(() => window.__game.player().mode === 'drive', null, { timeout: 20000 });
  // Drive: the left stick is throttle, so speed rises and the car moves.
  const carWas = await page.evaluate(() => window.__game.car());
  await page.evaluate(() => window.__pad.setAxis(1, -1));
  await waitGame(page, 2);
  await page.evaluate(() => window.__pad.reset());
  const carNow = await page.evaluate(() => window.__game.car());
  expect(carNow.speed, 'the stick accelerates the car').toBeGreaterThan(1);
  expect(Math.hypot(carNow.x - carWas.x, carNow.z - carWas.z), 'the car drove').toBeGreaterThan(2);
  // A again gets out; X blackens the player's zone; Y toggles the journal.
  await tapPad(page, PAD_A);
  await page.waitForFunction(() => window.__game.player().mode === 'foot', null, { timeout: 20000 });
  await tapPad(page, PAD_X);
  await page.waitForFunction(() => window.__game.dark().some(Boolean), null, { timeout: 20000 });
  await tapPad(page, PAD_Y);
  await expect(page.locator('#arc-journal')).toBeVisible();
  await tapPad(page, PAD_Y);
  await expect(page.locator('#arc-journal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('M7-8: the city view stays mouse and keys (D13)', async ({ page }) => {
  const errors = await bootPadded(page);
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { timeout: 20000 });
  const was = await page.evaluate(() => window.__game.cityview.state());
  const bodyWas = await page.evaluate(() => window.__game.player());
  // Every street control at once: move, look, run, enter, hack, journal.
  await page.evaluate(([a, x, y, rt]) => {
    window.__pad.setAxis(1, -1);
    window.__pad.setAxis(2, 1);
    window.__pad.setButton(a, true);
    window.__pad.setButton(x, true);
    window.__pad.setButton(y, true);
    window.__pad.setButton(rt, true);
  }, [PAD_A, PAD_X, PAD_Y, PAD_RT]);
  await waitGame(page, 2);
  await page.evaluate(() => window.__pad.reset());
  const now = await page.evaluate(() => ({
    view: window.__game.cityview.state(),
    body: window.__game.player(),
    dark: window.__game.dark(),
  }));
  expect(now.view.mode, 'the pad does not lift the overview').toBe('city');
  expect([now.view.x, now.view.z, now.view.yaw], 'the pad does not pan or orbit the overview')
    .toEqual([was.x, was.z, was.yaw]);
  expect(now.body, 'the pad does not move the body').toEqual(bodyWas);
  expect(now.body.mode, 'the pad does not enter the car').toBe('foot');
  expect(now.dark, 'the pad does not hack').toEqual([false, false]);
  await expect(page.locator('#arc-journal'), 'the pad does not open the journal').toBeHidden();
  expect(errors).toEqual([]);
});

// The bindings screen (M7.T15): the pad is listed beside the keys, with the
// connection the browser reports. Node-only, against the smallest DOM, as
// m7-settings.spec.js does — the fake navigator is the browser's own read.
function fakeDom() {
  const el = () => ({
    children: [], listeners: {}, style: {}, textContent: '',
    append(...kids) { this.children.push(...kids); },
    appendChild(kid) { this.children.push(kid); return kid; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  });
  globalThis.document = { createElement: el, documentElement: {} };
  return el();
}

function find(host, id) {
  if (host.id === id) return host;
  for (const kid of host.children ?? []) {
    const hit = find(kid, id);
    if (hit) return hit;
  }
  return null;
}

const PAD_ROWS = [
  ['MOVE', 'LEFT STICK'], ['LOOK', 'RIGHT STICK'], ['RUN', 'RT'], ['DRIVE', 'LEFT STICK'],
  ['ENTER', 'A / CROSS'], ['BLACKOUT', 'X / SQUARE'], ['JOURNAL', 'Y / TRIANGLE'],
];

test('M7-8: the bindings screen shows the pad, connected or not', () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const withPads = (pads, run) => {
    Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });
    try { run(); } finally { Object.defineProperty(globalThis, 'navigator', real); }
  };
  withPads([{ connected: true }], () => {
    const host = fakeDom();
    buildSettingsPanel(host);
    const status = find(host, 'pad-status');
    expect(status, 'the pad section is on the screen').toBeTruthy();
    expect(status.textContent, 'a pad the browser reports reads connected')
      .toMatch(/^GAMEPAD CONNECTED$/);
    const grid = find(host, 'pad-grid');
    const rows = [];
    for (let i = 0; i < grid.children.length; i += 2) {
      rows.push([grid.children[i].textContent, grid.children[i + 1].textContent]);
    }
    expect(rows, 'every street action the pad plays is listed').toEqual(PAD_ROWS);
  });
  withPads([], () => {
    const host = fakeDom();
    buildSettingsPanel(host);
    expect(find(host, 'pad-status').textContent, 'no pad reads so').toMatch(/NOT CONNECTED/);
  });
});
