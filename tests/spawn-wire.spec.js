// A new game on a generated world starts at its spawn (milestone 2): the player
// and the hero car are created there, the game boots them there, and getting
// out of the car or posing a shot keeps the player inside this world's walk
// box, not the hand map's.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createPlayer } from '../src/sim/player.js';
import { createPlayerCar } from '../src/sim/vehicle.js';

const SIM = new URL('../src/sim/', import.meta.url).href;

test.use({ viewport: { width: 480, height: 270 } });

test('the hand preset creates the player and the car where it always has', () => {
  const p = createPlayer();
  const c = createPlayerCar();
  expect([p.x, p.z, p.yaw]).toEqual([2.5, 26, Math.PI]);
  expect([c.x, c.z, c.yaw]).toEqual([3.0, 23.5, Math.PI]);
});

test('a generated world creates the player and the car at its spawn', () => {
  for (const seed of [3, 7, 12]) {
    const code = `
      const { setWorldSeed } = await import('${SIM}seedstore.js');
      setWorldSeed(${seed}, true);
      const { SPAWN } = await import('${SIM}spawn.js');
      const { createPlayer } = await import('${SIM}player.js');
      const { createPlayerCar } = await import('${SIM}vehicle.js');
      const { heightAt } = await import('${SIM}world.js');
      const p = createPlayer();
      const c = createPlayerCar();
      console.log(JSON.stringify({ SPAWN, p, c, py: heightAt(p.x, p.z), cy: heightAt(c.x, c.z) }));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const { SPAWN, p, c, py, cy } = JSON.parse(run.stdout);
    expect([p.x, p.z, p.yaw, p.y], `seed ${seed}`).toEqual([SPAWN.player.x, SPAWN.player.z, SPAWN.player.yaw, py]);
    expect([c.x, c.z, c.yaw, c.y], `seed ${seed}`).toEqual([SPAWN.car.x, SPAWN.car.z, SPAWN.car.yaw, cy]);
  }
});

test('main.js keeps the player inside this world\'s walk box, not the hand map\'s', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  expect(main).not.toMatch(/Math\.max\(-52/);
  expect(main).not.toMatch(/Math\.max\(-68/);
});

test('the game boots a generated world at its spawn', async ({ page }) => {
  const code = `
    const { setWorldSeed } = await import('${SIM}seedstore.js');
    setWorldSeed(7, true);
    const { SPAWN } = await import('${SIM}spawn.js');
    console.log(JSON.stringify(SPAWN));
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  const spawn = JSON.parse(run.stdout);
  await page.goto('/?capture=1&gen=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  const p = await page.evaluate(() => window.__game.player());
  const c = await page.evaluate(() => window.__game.car());
  expect([p.x, p.z]).toEqual([+spawn.player.x.toFixed(2), +spawn.player.z.toFixed(2)]);
  expect([c.x, c.z]).toEqual([+spawn.car.x.toFixed(2), +spawn.car.z.toFixed(2)]);
});
