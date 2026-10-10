// M5.T25 (M5-10, docs/ROADMAP.md): road types in the tool, and drawn. The
// palette carries the three road types; a drag lays the type it picked — a
// street two lanes wide, an avenue four, a one-way two lanes the same way —
// the pools draw the avenue at the 4-lane cross-section and the one-way with
// painted arrows, and a click on a road offers the change to the held type and
// its cost and then makes it. What a type does to traffic is M5.T24's A/B
// (m5-roadtypes.test.js); this is the hand that lays it and the frame that
// draws it.
//
// Every check is the player's own: the palette row, a real mouse drag, a real
// click on the road, and the renderer's own pick through the game's probe —
// nothing calls the sim's functions behind the game's back.
import { test, expect } from '@playwright/test';
import { projectOnSegment, ROAD_TYPES } from '../../src/sim/map.js';
import { createMap } from '../../src/sim/map.js';
import { addRoad, undo } from '../../src/sim/ops.js';
import { waitGame } from './lib/input.js';

const SEED = 7;
const LENGTH = 120;          // metres dragged
const CLEAR = 8;             // metres of clear ground each side: an avenue's half
const WIDE = 9.5;            // metres out where only a 4-lane road's walk stands
const SPEED = 4;
test.setTimeout(600000);

// The first runs a player could drag: a straight extension of a generated road
// into open land the op accepts with nothing standing near the line, each one
// edge (no crossing), so one drag is one road.
function sites(want) {
  const map = createMap(SEED);
  const found = [];
  const drive = map.district.drive, m = 6;
  const inside = (p) => p.x > drive.minX + m && p.x < drive.maxX - m
    && p.z > drive.minZ + m && p.z < drive.maxZ - m;
  for (const node of map.graph.nodes) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (found.length >= want) return found;
      const from = { x: node.x, z: node.z };
      const to = { x: node.x + dx * LENGTH, z: node.z + dz * LENGTH };
      if (!inside(from) || !inside(to)) continue;
      let clear = true;
      for (let i = 0; i <= 40 && clear; i++) {
        const x = from.x + (to.x - from.x) * i / 40;
        const z = from.z + (to.z - from.z) * i / 40;
        if ((map.water ?? []).some(([cx, cz, hw, hd]) =>
          Math.abs(x - cx) <= hw + 3 && Math.abs(z - cz) <= hd + 3)) { clear = false; break; }
        for (const p of map.parcels) {
          if (p.kind === 'lot' && p.stage === 0) continue;
          if (projectOnSegment(p.x, p.z, from, to).dist - Math.max(p.w, p.d) / 2 < CLEAR) {
            clear = false;
            break;
          }
        }
      }
      if (!clear) continue;
      const version = map.version;
      addRoad(map, from, to);
      if (map.version === version) continue;
      if (map.graph.edges.filter((e) => e.way === 'op').length !== 1) { undo(map); continue; }
      found.push({ from, to });
      undo(map);
    }
  }
  return found;
}

const midOf = (site) => ({ x: (site.from.x + site.to.x) / 2, z: (site.from.z + site.to.z) / 2 });
// The edge the game actually laid, from the pick the cursor holds: a node id is
// its own "x,z" (sim/ops.js roadPoint), so the arrow's place — the edge's own
// middle — is read off the sim rather than assumed from the drag's ends.
const midOfEdge = (edge) => {
  const [ax, az] = edge.a.split(',').map(Number);
  const [bx, bz] = edge.b.split(',').map(Number);
  return { x: (ax + bx) / 2, z: (az + bz) / 2 };
};
// A point `off` metres to one side of the run, on the ground: where a wider
// road's walk stands and a narrower one does not reach.
const offOf = (site, off) => (site.from.x === site.to.x
  ? { x: midOf(site).x + off, z: midOf(site).z }
  : { x: midOf(site).x, z: midOf(site).z + off });

async function boot(page) {
  await page.goto(`/?capture=1&gen=1&seed=${SEED}&speed=${SPEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 30000 });
}

// Aim the overview at the run, then drag it end to end with the mouse, the way
// a player lays a road (m5-roads.spec.js drives the same gesture).
async function dragRoad(page, site) {
  await page.evaluate((p) => window.__game.cityview.aim(p), midOf(site));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const from = await page.evaluate((p) => window.__game.screenOf(p.x, 0.5, p.z), site.from);
  const to = await page.evaluate((p) => window.__game.screenOf(p.x, 0.5, p.z), site.to);
  const onCanvas = (px) => page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.id === 'scene', px);
  expect(await onCanvas(from) && await onCanvas(to), 'both ends of the drag project onto the canvas').toBe(true);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + (to.x - from.x) * i / 8, from.y + (to.y - from.y) * i / 8);
  }
  await page.mouse.up();
  await waitGame(page, 0.5);
}

// The road the cursor now holds — the view's own `road`, the same hold the
// card reads — or null.
async function hoverRoad(page, at) {
  const px = await page.evaluate((p) => window.__game.screenOf(p.x, 0.5, p.z), at);
  await page.mouse.move(px.x, px.y);
  await waitGame(page, 0.4);
  return page.evaluate(() => window.__game.cityview.state().road ?? null);
}

async function pickAt(page, at) {
  const px = await page.evaluate((p) => window.__game.screenOf(p.x, 0, p.z), at);
  return page.evaluate(([x, y]) => window.__game.pick(x, y, window.innerWidth, window.innerHeight), [px.x, px.y]);
}

const isRoad = (hits) => hits.some((h) => /road/i.test(h.path));

test('M5.T25: the drag lays the type the palette picked, drawn at its own cross-section', async ({ page }) => {
  const found = sites(3);
  expect(found.length, `seed ${SEED}: open land for three road drags`).toBe(3);
  await boot(page);
  // The palette carries the three road types, and each names its per-metre price.
  for (const [id, type] of [['road', 'street'], ['avenue', 'avenue'], ['oneway', 'oneway']]) {
    const row = await page.$(`#tool-${id}`);
    expect(row, `the ${id} tool is in the palette`).toBeTruthy();
    expect(await row.evaluate((el) => el.textContent)).toContain(`$${ROAD_TYPES[type].cost}/m`);
  }

  // A drag with the street tool lays a street: two lanes, and the drawn road
  // stops short of nine metres from its centre line.
  await page.click('#tool-road');
  await dragRoad(page, found[0]);
  const street = await hoverRoad(page, midOf(found[0]));
  expect(street?.kind, 'the cursor holds the road it just dragged').toBe('road');
  expect(street.edge.lanes, 'the street is two lanes').toBe(2);
  expect(street.edge.oneWay).toBe(false);
  expect(await isRoad(await pickAt(page, offOf(found[0], WIDE))),
    'the street\'s cross-section does not reach eight metres out').toBe(false);

  // A drag with the avenue tool lays an avenue: four lanes, drawn wide enough
  // that its walk stands where the street's did not.
  await page.click('#tool-avenue');
  await dragRoad(page, found[1]);
  const avenue = await hoverRoad(page, midOf(found[1]));
  expect(avenue?.kind, 'the cursor holds the avenue it just dragged').toBe('road');
  expect(avenue.edge.lanes, 'the avenue is four lanes').toBe(4);
  expect(avenue.edge.oneWay).toBe(false);
  expect(await isRoad(await pickAt(page, offOf(found[1], WIDE))),
    'the avenue is drawn at the 4-lane width').toBe(true);

  // A drag with the one-way tool lays a one-way: two lanes the same way, with
  // painted arrows down it — the arrow pool is a mesh of its own, so a pick at
  // the run's middle names it.
  await page.click('#tool-oneway');
  await dragRoad(page, found[2]);
  const oneway = await hoverRoad(page, midOf(found[2]));
  expect(oneway?.kind, 'the cursor holds the one-way it just dragged').toBe('road');
  expect(oneway.edge.lanes, 'the one-way is two lanes').toBe(2);
  expect(oneway.edge.oneWay, 'the one-way runs the one way').toBe(true);
  const arrowAt = midOfEdge(oneway.edge);
  expect(Math.hypot(arrowAt.x - midOf(found[2]).x, arrowAt.z - midOf(found[2]).z),
    'the one-way was laid where it was dragged').toBeLessThan(1);
  expect((await pickAt(page, arrowAt)).some((h) => /arrow/i.test(h.path)),
    'the one-way is drawn with arrows').toBe(true);
  // A street and an avenue of the same length are painted differently: the
  // one-way's arrows are the only reason a pick mid-street names one.
  expect((await pickAt(page, midOfEdge(street.edge))).some((h) => /arrow/i.test(h.path)),
    'the street is not drawn with one-way arrows').toBe(false);
});

test('M5.T25: a click on a road offers the change to the held type and its cost, and makes it', async ({ page }) => {
  const found = sites(1);
  expect(found.length, `seed ${SEED}: open land for a road drag`).toBe(1);
  await boot(page);
  await page.click('#tool-road');
  await dragRoad(page, found[0]);

  // With the avenue tool held, the road under the cursor offers the change and
  // what it costs: the difference per metre of the avenue over the street.
  await page.click('#tool-avenue');
  const before = await hoverRoad(page, midOf(found[0]));
  expect(before?.kind, 'the cursor holds the street under it').toBe('road');
  expect(before.edge.lanes).toBe(2);
  const card = await page.evaluate(() => {
    const el = document.querySelector('#lotcard');
    return { text: el?.textContent ?? '', upgrade: el?.dataset.upgrade ?? '', cost: el?.dataset.cost ?? '' };
  });
  expect(card.upgrade, 'the card offers the avenue').toBe('avenue');
  expect(card.text).toContain('avenue');
  expect(Number(card.cost), `the card's cost, read from ${card.text}`)
    .toBe(Math.round(before.length * (ROAD_TYPES.avenue.cost - ROAD_TYPES.street.cost)));

  // A click on the road makes the change, in place: the same road, four lanes.
  const px = await page.evaluate((p) => window.__game.screenOf(p.x, 0.5, p.z), midOf(found[0]));
  await page.mouse.move(px.x, px.y);
  await page.mouse.down();
  await page.mouse.up();
  await waitGame(page, 0.5);
  const after = await hoverRoad(page, midOf(found[0]));
  expect(after?.edge.lanes, 'the street was upgraded to an avenue in place').toBe(4);
  expect(after.edge.oneWay).toBe(false);
  expect(after.length, 'the road is the same road').toBeCloseTo(before.length, 6);
  // And it is drawn as one: the cross-section reaches further out than the
  // street's did.
  expect(await isRoad(await pickAt(page, offOf(found[0], WIDE))),
    'the upgraded road is drawn at the 4-lane width').toBe(true);
  // The offer is spent: the card no longer names a change to make.
  const spent = await page.evaluate(() => {
    const el = document.querySelector('#lotcard');
    return { text: el?.textContent ?? '', upgrade: el?.dataset.upgrade ?? '' };
  });
  expect(spent.upgrade, 'the card offers nothing left to change').toBe('');
});
