// M4.R1 (docs/tasks/m4.json): mouse look like GTA and Watch Dogs on PC. In the
// street view — on foot and in the car — a click on the canvas takes the pointer
// lock, and while the canvas holds it every mousemove turns the camera through
// the same look(dx, dy) the drag uses, with no button held. The mouse never
// steers: A/D steer, the mouse only moves the camera. The overview keeps its own
// click-and-drag, never takes the lock, and going up releases the one the street
// took.
//
// The lock is faked the way a headless page can hold one: document's
// pointerLockElement is defined as the canvas and the pointerlockchange the
// browser fires on a lock change is fired by hand. What the check then exercises
// is the game's own gate — document.pointerLockElement === canvas — with the
// browser's permission prompt taken out of the question. Every mousemove below
// carries movementX and buttons 0 with no press before it, so a look that needs
// a held button fails here.
import { test, expect } from '@playwright/test';
import { cityView } from './lib/input.js';

// The seed docs/tasks/m4.json names for this boot.
const SEED = 7;
// The movementX one mousemove carries, and the yaw it must turn: camera.js's
// ORBIT_PER_PX is 0.005 rad a pixel, so 200 px is a radian of look.
const MOVE_PX = 200;
const LOOK_RAD = MOVE_PX * 0.005;

// One buttonless mousemove, dispatched and read back inside a single evaluate so
// no frame lands between the two readings. No press precedes it.
function lookStep(page, px) {
  return page.evaluate((dx) => {
    const read = () => ({
      cam: window.__game.camYaw(),
      car: window.__game.car(),
      city: window.__game.cityview.state().yaw,
    });
    const before = read();
    document.dispatchEvent(new MouseEvent('mousemove', {
      movementX: dx, movementY: 0, buttons: 0, bubbles: true, cancelable: true,
    }));
    return { before, after: read() };
  }, px);
}

const hint = (page) => page.evaluate(() => document.getElementById('hint').textContent);

test('M4.R1: a locked mouse looks on foot and in the car, and never steers', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });

  await page.evaluate(() => {
    const canvas = document.getElementById('scene');
    Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
  });

  // On foot, with the lock held and no button down: the camera turns by exactly
  // the movement it was given, through the drag's own look().
  const foot = await lookStep(page, MOVE_PX);
  expect(Math.abs(foot.after.cam - foot.before.cam),
    'a locked mousemove with no button turns the camera on foot').toBeCloseTo(LOOK_RAD, 4);
  expect(await hint(page), 'the street view names the mouse as its look').toContain('mouse · look');

  // A click on the canvas takes the lock.
  await page.evaluate(() => {
    const canvas = document.getElementById('scene');
    window.__lockAsks = 0;
    canvas.requestPointerLock = () => { window.__lockAsks += 1; };
  });
  await page.mouse.click(480, 270);
  expect(await page.evaluate(() => window.__lockAsks), 'a click on the canvas takes the lock').toBe(1);

  // F into the hero car the spawn parks on the kerb.
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__game.player().mode === 'drive', null, { polling: 'raf' });
  // In the car the same bare mouse looks, and the car it is driving does not
  // move a millimetre for it: the heading and the rest are the ones it found.
  const wheel = await lookStep(page, MOVE_PX);
  expect(Math.abs(wheel.after.cam - wheel.before.cam),
    'a locked mousemove with no button turns the camera in the car').toBeCloseTo(LOOK_RAD, 4);
  expect(wheel.after.car.yaw, 'the mouse never steers the car').toBe(wheel.before.car.yaw);
  expect(wheel.after.car.x, 'the mouse never moves the car').toBe(wheel.before.car.x);
  expect(wheel.after.car.z, 'the mouse never moves the car').toBe(wheel.before.car.z);
  expect(wheel.after.car.speed, 'the mouse is not the throttle').toBe(wheel.before.car.speed);

  // Z lifts to the overview, which keeps the drag look the cursor needs there: a
  // buttonless mousemove does nothing to it, a click on it never takes the lock,
  // and going up releases the one the street took.
  await page.evaluate(() => {
    window.__releases = 0;
    document.exitPointerLock = () => { window.__releases += 1; };
  });
  await cityView(page, 'res');
  const over = await lookStep(page, MOVE_PX);
  expect(over.after.city, 'a buttonless mousemove does not move the overview camera')
    .toBe(over.before.city);
  expect(await page.evaluate(() => window.__releases), 'going up releases the lock').toBeGreaterThan(0);
  await page.mouse.click(480, 270);
  expect(await page.evaluate(() => window.__lockAsks), 'the overview never takes the lock').toBe(1);
  expect(await hint(page), 'the overview names its drag as the look').toContain('drag · look');
  expect(errors, 'no page error through the boot, the drive and the overview').toEqual([]);
});
