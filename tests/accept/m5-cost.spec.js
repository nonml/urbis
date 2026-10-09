// M5-7's cost and refusal (docs/ROADMAP.md, task M5.T19): before anything is
// placed or bulldozed the city view says what it costs, a tool the treasury
// cannot pay refuses and says why, hovering a tool names what it does and its
// cost, and a right click or Escape puts the tool down. Ctrl+Z's refund is
// M5.T26's half of M5-7 and waits on src/game/input.js, which this task never
// touches.
import { test, expect } from '@playwright/test';
import { TOOLS } from '../../src/sim/cityview.js';
import { waitGame } from './lib/input.js';

const SEED = 7;
const PICK_Y = 1.2;                 // half the city view's 2.4 m pick floor
const SCHOOL = 'school';            // the dearest tool: more than the opening treasury
const COST = 1000;
test.setTimeout(120000);

const cardOf = (page) => page.evaluate(() => document.getElementById('lotcard').innerHTML);
const rowOf = (page, id) => page.$(`#tool-${id}`);
const stateOf = (page) => page.evaluate(() => window.__game.cityview.state());

// The canvas pixel a world point projects to, moved to so the view's own hover
// settles on what is under the cursor before the card is read or the click lands.
async function hoverAt(page, x, z) {
  const pt = await page.evaluate(([p, y]) => window.__game.screenOf(p.x, y, p.z), [{ x, z }, PICK_Y]);
  await page.mouse.move(pt.x, pt.y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return pt;
}

test('M5-7: every tool shows its cost, and one the money cannot pay refuses and says so', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.__game.cityview.state().lift >= 1, null, { polling: 'raf', timeout: 30000 });

  // Every tool the palette holds says its cost, at the number the tool charges
  // (sim/cityview.js), and names what it does — before one is used.
  for (const id of Object.keys(TOOLS)) {
    const row = await rowOf(page, id);
    const shown = await row.evaluate((el) => ({ cost: el.dataset.cost, text: el.textContent, title: el.title }));
    const want = TOOLS[id].cost(null, null);
    expect(Number(shown.cost), `${id}: the palette carries the cost`).toBe(want);
    expect(shown.text, `${id}: the row shows $${want}`).toContain(`$${shown.cost}`);
    expect(shown.title, `${id}: the row names what the tool does`).toContain(TOOLS[id].name);
  }

  // Hovering a tool names what it does and what it costs.
  await page.hover('#tool-res');
  const help = await page.evaluate(() => document.getElementById('toolhelp').textContent);
  expect(help, 'the hover names what the brush does').toContain(TOOLS.res.blurb);
  expect(help, 'the hover names the cost').toContain(`$${TOOLS.res.cost(null, null)}`);

  const money = await page.evaluate(() => Number(document.getElementById('books').dataset.money));
  expect(money, `the opening treasury (${money}) is under the school's $${COST}`).toBeLessThan(COST);
  const afford = await page.evaluate((id) => document.getElementById(`tool-${id}`).dataset.afford, SCHOOL);
  expect(afford, 'the palette says which tools the money cannot pay').toBe('no');

  const lots = await page.evaluate(() => window.__game.freeLots().map((l) => ({ x: l.x, z: l.z, index: l.index })));
  expect(lots.length, `seed ${SEED}: the city left land to build on`).toBeGreaterThanOrEqual(3);
  const state = (i) => page.evaluate((k) => window.__game.cityview.lots()[k], i);

  // The school on an empty lot: the card says what it costs and that the money
  // cannot pay for it, and the click changes nothing.
  await (await rowOf(page, SCHOOL)).click();
  expect((await stateOf(page)).brush, 'the palette picks the school up').toBe(SCHOOL);
  await hoverAt(page, lots[0].x, lots[0].z);
  expect(await cardOf(page), 'the card refuses the school before it acts').toContain(`cannot pay $${COST}`);
  await page.mouse.down();
  await page.mouse.up();
  await waitGame(page, 0.05);
  expect(await cardOf(page), 'the card still says why').toContain(`cannot pay $${COST}`);
  expect(await state(lots[0].index), 'the refused school left the lot open land')
    .toMatchObject({ zoned: null, stage: 'EMPTY' });

  // A tool the money can pay: the card names the act and its cost first, then
  // the click zones the next free lot.
  await page.keyboard.press('r');
  const cheap = lots[1];
  const pt = await hoverAt(page, cheap.x, cheap.z);
  const cost = TOOLS.res.cost(null, null);
  expect(await cardOf(page), 'the card names the act and its cost first').toContain(`◆ zone res · $${cost}`);
  await page.mouse.down();
  await page.mouse.up();
  await waitGame(page, 0.05);
  expect((await state(cheap.index)).zoned, 'the R brush zones the lot it can pay for').toBe('res');

  // Bulldozing says its cost before it acts too.
  const building = await page.evaluate(() => window.__game.city().parcels.find((p) => p.kind === 'lot' && p.stage !== 'EMPTY'));
  expect(building, `seed ${SEED}: a built lot stands to be demolished`).toBeTruthy();
  await (await rowOf(page, 'bulldoze')).click();
  await hoverAt(page, building.x, building.z);
  expect(await cardOf(page), 'the demolish card names its cost').toMatch(/◆ demolish · \$\d+/);

  // A right click puts the tool down, and a click with nothing held paints
  // nothing; a key picks it up again and Escape puts it down as well.
  const down = await hoverAt(page, lots[2].x, lots[2].z);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  expect((await stateOf(page)).active, 'a right click puts the brush down').toBe(false);
  await page.mouse.down();
  await page.mouse.up();
  expect((await state(lots[2].index)).zoned, 'a tool that is down paints nothing').toBe(null);
  await page.keyboard.press('r');
  expect((await stateOf(page)).active, 'a key picks the brush up again').toBe(true);
  await page.keyboard.press('Escape');
  expect((await stateOf(page)).active, 'Escape puts the brush down').toBe(false);
  await hoverAt(page, lots[0].x, lots[0].z);
  await page.mouse.down();
  await page.mouse.up();
  expect((await state(lots[0].index)).zoned, 'the lot stays open land with the tool down').toBe(null);

  expect(errors).toEqual([]);
});
