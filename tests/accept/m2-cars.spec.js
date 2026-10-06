// M2.T5 (M2-1 part, docs/ROADMAP.md): the hero car renders from the M2.T3
// model file listed in public/assets/CREDITS.md — no box geometry in its body;
// doors (enter/exit), lights and the brake glow keep working; at most 9 draws.
// Traffic + parked cars stay at most 11 draws (today's count, guard).
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const CAR_GLB = 'public/assets/models/car/car.glb';
const TRI_BUDGET = 8000;

function glbJson() {
  const b = readFileSync(CAR_GLB);
  expect(b.subarray(0, 4).toString(), 'GLB magic').toBe('glTF');
  let off = 12;
  let json = null;
  let bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off);
    const type = b.subarray(off + 4, off + 8).toString();
    if (type === 'JSON') json = JSON.parse(b.subarray(off + 8, off + 8 + len).toString());
    if (type === 'BIN\0') bin = b.subarray(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return { json, bin };
}

test('M2.T5 node: car.glb credited, in budget, wheels separate', () => {
  const credits = readFileSync('public/assets/CREDITS.md', 'utf8');
  expect(credits, 'car.glb credited').toMatch(/models\/car\/car\.glb/);
  expect(existsSync(CAR_GLB), 'car.glb exists').toBe(true);
  const { json } = glbJson();
  const acc = (i) => json.accessors[i].count;
  const tris = (json.meshes ?? []).flatMap((m) => m.primitives)
    .reduce((s, p) => s + (p.indices === undefined ? acc(p.attributes.POSITION) : acc(p.indices)) / 3, 0);
  expect(tris, 'under 8,000 triangles').toBeLessThanOrEqual(TRI_BUDGET);
  const names = (json.nodes ?? []).map((n) => n.name ?? '');
  expect(names.some((n) => /body/i.test(n)), 'a body node').toBe(true);
  expect(names.filter((n) => /wheel/i.test(n)).length, 'four separate wheels').toBe(4);
});

test('M2.T5 node: hero built from the model, slab gone, brake kept', () => {
  const src = readFileSync('src/render/traffic.js', 'utf8');
  expect(src, 'hero sources car.glb').toMatch(/models\/car\/car\.glb/);
  const at = src.indexOf('export function buildPlayerCar');
  const end = src.indexOf('export function updatePlayerCar');
  expect(at, 'buildPlayerCar exists').toBeGreaterThanOrEqual(0);
  const hero = src.slice(at, end > at ? end : undefined);
  expect(hero, 'no slab body').not.toMatch(/bodyGeo|wheelGeo|canopyGeo|trimGeo|carTrimMesh|carGlassMesh|ExtrudeGeometry/);
  expect(hero, 'no BoxGeometry in the hero').not.toMatch(/BoxGeometry/);
  expect(src, 'model tag for the M2-6 sweep').toMatch(/userData\.model\s*=\s*HERO_MODEL/);
  expect(hero, 'headlight beams kept').toMatch(/beamGeo/);
  expect(hero, 'tail glow kept').toMatch(/tailGeo|tailMat/);
  expect(hero, 'finder beacon kept').toMatch(/beacon/);
  expect(hero, 'real headlight spot kept').toMatch(/SpotLight/);
  const upd = src.slice(end);
  expect(upd, 'brake flips the tails').toMatch(/braking/);
  expect(upd, 'brake colour').toMatch(/TAIL_BRAKE/);
});

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?capture=1');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
  return errors;
}

test('M2-1 hero: model body, no boxes, at most 9 draws', async ({ page }) => {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__heroRig?.modelReady === true, null, { timeout: 60000 });
  const hero = await page.evaluate(() => window.__heroRig.inspect());
  expect(hero.model, 'body from the credited file').toMatch(/models\/car\/car\.glb/);
  expect(hero.credits, 'that file is credited').toBe(true);
  expect(hero.geoTypes.join(','), 'no box in any hero body mesh').not.toMatch(/BoxGeometry/);
  expect(hero.meshes, 'body meshes present').toBeGreaterThanOrEqual(3);
  const rows = (await page.evaluate(() => window.__game.ledger(1))).flat();
  const heroRows = rows.filter((r) => (r.name ?? '').startsWith('hero-'));
  expect(heroRows.length, `hero draws, saw [${heroRows.map((r) => `${r.pass}:${r.name}`).join(', ')}]`).toBeGreaterThan(0);
  expect(heroRows.length, `hero at most 9 draws, saw ${heroRows.length}`).toBeLessThanOrEqual(9);
  const fleetRows = rows.filter((r) => (r.name ?? '').startsWith('fleet-'));
  expect(fleetRows.length, `traffic at most 11 draws, saw ${fleetRows.length}`).toBeLessThanOrEqual(11);
  expect(errors, 'no page error').toEqual([]);
});

test('M2.T5 hero: doors, lights and brake glow keep working', async ({ page }) => {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__heroRig?.modelReady === true, null, { timeout: 60000 });
  // Doors: F-equivalent enter/exit beside the spawn-parked car.
  expect(await page.evaluate(() => window.__game.player().mode), 'starts on foot').toBe('foot');
  await page.evaluate(() => window.__game.enter());
  expect(await page.evaluate(() => window.__game.player().mode), 'enter works').toBe('drive');
  await page.evaluate(() => window.__game.enter());
  expect(await page.evaluate(() => window.__game.player().mode), 'exit works').toBe('foot');
  // Lights: beams, tails, glows and the spot exist and draw.
  const lights = await page.evaluate(() => window.__heroRig.lights());
  expect(lights.beams, 'headlight beams').toBe(true);
  expect(lights.tails, 'tail glow').toBe(true);
  expect(lights.glows, 'headlight glare sprites').toBe(2);
  expect(lights.spot, 'real headlight spot').toBe(true);
  const rows = (await page.evaluate(() => window.__game.ledger(1))).flat();
  const names = new Set(rows.map((r) => r.name));
  expect(names.has('hero-beams'), 'beams draw').toBe(true);
  expect(names.has('hero-tails'), 'tails draw').toBe(true);
  // Brake: dim parked, bright while holding back with speed on.
  const dim = await page.evaluate(() => window.__heroRig.tailHex());
  expect(dim, 'tails dim parked').toBe('7a140e');
  await page.evaluate(() => window.__game.enter());
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__game.car().speed > 3, null, { timeout: 15000 });
  await page.keyboard.up('w');
  await page.keyboard.down('s');
  await page.waitForFunction(() => window.__heroRig.tailHex() === 'ff2a20', null, { timeout: 8000 });
  const lit = await page.evaluate(() => window.__heroRig.tailHex());
  await page.keyboard.up('s');
  expect(lit, 'tails flare under braking').toBe('ff2a20');
  expect(errors, 'no page error').toEqual([]);
});
