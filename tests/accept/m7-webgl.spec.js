// M7-9 (docs/ROADMAP.md): when the GPU fails the page says so in words and what
// to try, and a context that comes back restores the game. Test one boots a page
// that refuses WebGL; test two forces a real WEBGL_lose_context loss and restore.
import { test, expect } from '@playwright/test';

test('M7-9: with no WebGL the page says so in words and what to try', async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /^webgl/i.test(type) ? null : real.call(this, type, ...rest);
    };
  });
  await page.goto('/?capture=1&seed=7');
  const fail = page.locator('#gpufail');
  await expect(fail).toBeVisible();
  await expect(fail).toContainText(/WebGL[\s\S]*reload/i);
});

test('M7-9: a lost context says so; a context that comes back restores the game', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?capture=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  const fail = page.locator('#gpufail');
  await expect(fail).toBeHidden();

  await page.evaluate(() => {
    const canvas = document.getElementById('scene');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    window.__glctx = gl.getExtension('WEBGL_lose_context');
    window.__glctx.loseContext();
  });
  await expect(fail).toBeVisible();
  await expect(fail).toContainText(/graphics[\s\S]*reload/i);
  await page.evaluate(() => window.__glctx.restoreContext());
  await expect(fail).toBeHidden();
  await page.waitForFunction(() => window.__game.draws() > 0, null, { timeout: 30000 });
  const step = await page.evaluate(() => window.__game.step());
  await page.waitForFunction((n) => window.__game.step() > n, step, { polling: 'raf', timeout: 30000 });
  expect(errors).toEqual([]);
});
