// M0-1 (docs/ROADMAP.md): the sim advances in 50 ms steps in the browser, and an
// input log recorded with ?record=1 replays with ?replay= to the same
// __game.stateHash() at 60 game seconds. Three recorded sessions; each is
// replayed three times, and every replay must land on its recording's hash.
//
// The replay JSON is served from memory: ?replay=<name> fetches
// tests/replays/<name>.json, and the route below answers with the recording, so
// the check needs no fixture on disk. Test hooks: __game.step() counts fixed
// steps, __game.pause() stops them, __game.inputLog() is the ?record=1 log and
// __game.replayDone() is true once a ?replay= run has consumed its log.
//
// M0-2 is checked here too: one log replayed at 4 steps a frame and at 1 gives
// the same hash, so the replay is fed by step, not by frame.
import { test, expect } from '@playwright/test';

const SEED = 7;
const RECORD_SPEED = 4;        // real input arrives between frames; 4 leaves room before step 1200
const REPLAY_SPEED = 8;
const CHECK_STEPS = 60 / 0.05; // the fixed step is 50 ms: 60 game seconds = 1200 steps
const SHORT_STEPS = 600;       // 30 game seconds, enough for the speed check
const ROUNDS = 3;
const REPLAYS = 3;

test.setTimeout(240000);

async function boot(page, query) {
  await page.goto(`/?capture=1&seed=${SEED}${query}`);
  await page.waitForFunction(() => typeof window.__game?.step === 'function', null, { timeout: 30000 });
}

// A real session: a look drag, the wheel, walking, sprinting, the car, the
// blackout hack and a day/night flip. Every event goes through the game's own
// listeners, exactly as a player would send it.
async function play(page) {
  await page.mouse.move(480, 270);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(480 + i * 12, 270 + i * 3);
  await page.mouse.up();
  await page.mouse.wheel(0, 160);
  await page.keyboard.down('w');
  await page.waitForTimeout(150);
  await page.keyboard.down('Shift');
  await page.waitForTimeout(150);
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  await page.keyboard.press('h');
  await page.waitForTimeout(120);
  await page.keyboard.press('t');
  await page.keyboard.press('f');
  await page.waitForTimeout(200);
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(150);
  await page.keyboard.up('d');
  await page.keyboard.up('w');
  await page.keyboard.press('f');
  await page.keyboard.press('z');
  await page.waitForTimeout(100);
  await page.keyboard.press('r');
  await page.keyboard.press('c');
  await page.keyboard.press('z');
}

// Pause on the first rendered frame at or past `steps` game steps. At a
// whole-step frame every frame lands on a multiple of its speed, so for a
// multiple of RECORD_SPEED the pause is on the step exactly. The pause runs
// inside the page's rAF poll, and no frame can slip between it and the reads
// below.
async function recordAt(page, steps) {
  await boot(page, `&speed=${RECORD_SPEED}&record=1`);
  await play(page);
  await page.waitForFunction((n) => {
    const g = window.__game;
    if (g.step() < n) return false;
    g.pause();
    return true;
  }, steps, { polling: 'raf', timeout: 60000 });
  return page.evaluate(() => ({
    step: window.__game.step(),
    hash: window.__game.stateHash(),
    log: window.__game.inputLog(),
  }));
}

async function replay(page, name, speed) {
  await boot(page, `&speed=${speed}&replay=${name}`);
  await page.waitForFunction(
    () => window.__game.replayDone() || window.__game.replayError(),
    null, { timeout: 120000 });
  return page.evaluate(() => ({
    step: window.__game.step(),
    hash: window.__game.stateHash(),
    error: window.__game.replayError(),
  }));
}

async function serve(page, name, log) {
  await page.route(`**/tests/replays/${name}.json`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(log) }));
}

test('M0-1: a recorded log replays to the same state hash at 60 game seconds', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (let round = 0; round < ROUNDS; round++) {
    const rec = await recordAt(page, CHECK_STEPS);
    expect(rec.step, `round ${round}: recording paused at 60.00 game seconds`).toBe(CHECK_STEPS);
    expect(rec.log.steps, `round ${round}: the log ends on the paused step`).toBe(CHECK_STEPS);
    const kinds = new Set(rec.log.events.map((e) => e.type));
    for (const kind of ['keydown', 'keyup', 'pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      expect(kinds.has(kind), `round ${round}: the log kept a ${kind}`).toBe(true);
    }
    const name = `m0-rec-${round}`;
    await serve(page, name, rec.log);
    for (let run = 0; run < REPLAYS; run++) {
      const rep = await replay(page, name, REPLAY_SPEED);
      expect(rep.error, `round ${round} replay ${run}: no replay error`).toBeNull();
      expect(rep.step, `round ${round} replay ${run}: stopped at the recorded step`).toBe(CHECK_STEPS);
      expect(rep.hash, `round ${round} replay ${run}: same hash as the recording`).toBe(rec.hash);
    }
  }
  expect(errors).toEqual([]);
});

test('M0-2: a replay ends on the same hash at 1 and at 4 steps a frame', async ({ page }) => {
  const rec = await recordAt(page, SHORT_STEPS);
  expect(rec.step).toBe(SHORT_STEPS);
  const name = 'm0-speed';
  await serve(page, name, rec.log);
  for (const speed of [4, 1]) {
    const rep = await replay(page, name, speed);
    expect(rep.error, `speed ${speed}: no replay error`).toBeNull();
    expect(rep.step, `speed ${speed}: stopped at the recorded step`).toBe(SHORT_STEPS);
    expect(rep.hash, `speed ${speed}: same hash as the recording`).toBe(rec.hash);
  }
});
