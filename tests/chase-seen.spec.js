// A chase the player can see: with the city wanted at tier 2, a pursuit car
// reaches the suspect and is on screen within twenty seconds of game time.
//
// The frame is what matters here, not the sim — tests/wanted.spec.js already
// proves the units route and close. This is the law-1 half of the same claim,
// on the three seeds the original chase shots used, through the capture probe
// `window.__game.policeOnScreen()` (src/main.js): for each live unit, how far it
// is, whether its centre is in the canvas, and whether the nearest solid pixel
// there is the unit itself.
import { test, expect } from '@playwright/test';

const SEEDS = [7, 73, 1234567];
const WINDOW_SECS = 20;
const NEAR = 40;

// The crime is staged the way play does it and the way slices 075/076 did: the
// player takes the wheel, the hack raises the first tier, and the capture probe
// adds the second. `police.tier` is the probe's own name for the sim entry point
// play reaches by committing a second crime.
async function wantedTierTwo(page) {
  await page.evaluate(() => window.__game.enter());
  await page.evaluate(() => window.__game.hack());
  await page.evaluate(() => window.__game.police.tier(2));
}

for (const seed of SEEDS) {
  test(`a pursuit car is on screen within ${WINDOW_SECS}s (seed ${seed})`, async ({ page }) => {
    await page.goto(`/?capture=1&gen=1&seed=${seed}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
    await page.waitForTimeout(1000);

    await wantedTierTwo(page);
    const started = Date.now();
    const handle = await page.waitForFunction(
      (near) => window.__game.policeOnScreen().find((u) => u.dist <= near && u.inFrame && u.visible) ?? false,
      NEAR,
      { timeout: (WINDOW_SECS + 2) * 1000, polling: 100 },
    );
    const secs = (Date.now() - started) / 1000;
    const seen = await handle.jsonValue();

    console.log(`seed ${seed}: pursuit on screen at ${secs.toFixed(1)}s`, JSON.stringify(seen));
    expect(secs).toBeLessThanOrEqual(WINDOW_SECS);
  });
}
