// M2.F2b (M2-0, M2-2, docs/ROADMAP.md): person.glb shipped (M2.F2) but the play
// shot showed no one: the box figure left and nothing took its place. The person
// must stand where the player is, at human size, feet on the pavement, with its
// limbs moving while it walks. `__game.avatarBox()` returns the avatar's world
// bounds from Box3.setFromObject (skinned, so after the mixer has posed it) and
// `player` the sim position it should stand on.
import { test, expect } from '@playwright/test';

const PORT = process.env.GATE_PORT || 4173;

test('M2.F2b: the shipped person stands where the player is, at human size', async ({ page }) => {
  await page.goto(`http://localhost:${PORT}/?capture=1`);
  await page.waitForFunction(() => window.__game?.draws() > 0);
  await page.waitForFunction(() => window.__game.avatarBox().skinned, null, { timeout: 15000 });
  const a = await page.evaluate(() => window.__game.avatarBox());
  const h = a.max[1] - a.min[1];
  expect(h, 'height, m').toBeGreaterThan(1.55);
  expect(h, 'height, m').toBeLessThan(2.0);
  expect(Math.abs(a.min[1] - a.player[1]), 'feet on the ground, m').toBeLessThan(0.15);
  const cx = (a.min[0] + a.max[0]) / 2;
  const cz = (a.min[2] + a.max[2]) / 2;
  expect(Math.hypot(cx - a.player[0], cz - a.player[2]), 'stands at the player, m').toBeLessThan(0.6);
  expect(a.onScreen, 'the play camera sees the body').toBe(true);
});
