// M2.T11 (M2-5 part, docs/ROADMAP.md): street kit. `street_lamp_01` is the
// street lamp; benches, bins and bus stops are models through the pool loader;
// the grown-lot rooms use models, not `box()`; no street prop over 5,000
// triangles, and the frame's triangles at the spawn drop under 600 k.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const PROP_BUDGET = 5000;
const FRAME_TRIS = 600_000;

const LAMP_GLB = 'public/assets/models/street_lamp_01/street_lamp_01_1k.gltf';
const HYDRANT_GLB = 'public/assets/models/fire_hydrant/fire_hydrant_1k.gltf';
const BIN_GLB = 'public/assets/models/metal_trash_can/metal_trash_can_1k.gltf';
const BENCH_GLB = 'public/assets/models/bench/bench.glb';
const SHELTER_GLB = 'public/assets/models/bus_stop/bus_stop.glb';

// A model file is GLB (binary) or glTF (JSON with an outside buffer): either
// way the mesh inventory lives in the JSON chunk. Same triangle count the
// M2.T5 check uses for the car.
function glbJson(path) {
  const b = readFileSync(path);
  if (b.subarray(0, 4).toString() === 'glTF') {
    let off = 12;
    while (off < b.length) {
      const len = b.readUInt32LE(off);
      const type = b.subarray(off + 4, off + 8).toString();
      if (type === 'JSON') return JSON.parse(b.subarray(off + 8, off + 8 + len).toString());
      off += 8 + len;
    }
    throw new Error(`${path}: no JSON chunk`);
  }
  return JSON.parse(b.toString('utf8'));
}

function triCount(path) {
  const json = glbJson(path);
  const acc = (i) => json.accessors[i].count;
  return Math.round((json.meshes ?? []).flatMap((m) => m.primitives)
    .reduce((s, p) => s + (p.indices === undefined ? acc(p.attributes.POSITION) : acc(p.indices)) / 3, 0));
}

test('M2.T11 node: every street prop file exists and stays under 5,000 triangles', () => {
  for (const f of [LAMP_GLB, HYDRANT_GLB, BIN_GLB, BENCH_GLB, SHELTER_GLB]) {
    expect(existsSync(f), `${f} exists`).toBe(true);
    expect(triCount(f), `${f} under ${PROP_BUDGET} triangles`).toBeLessThanOrEqual(PROP_BUDGET);
  }
});

test('M2.T11 node: street_lamp_01 is the street lamp, not a procedural pole', () => {
  const src = readFileSync('src/render/lamps.js', 'utf8');
  expect(src, 'lamps load street_lamp_01 through the pool loader').toMatch(/street_lamp_01/);
  expect(src, 'lamps go through the model pool').toMatch(/loadModelPool/);
  expect(src, 'no procedural pole cylinder left').not.toMatch(/CylinderGeometry\(0\.09, 0\.12/);
  expect(src, 'no procedural arm box left').not.toMatch(/BoxGeometry\(1\.9, 0\.1, 0\.1\)/);
});

test('M2.T11 node: benches, bins and bus stops are models through the pool loader', () => {
  const dress = readFileSync('src/render/setdress.js', 'utf8');
  const scene = readFileSync('src/game/scene.js', 'utf8');
  expect(dress, 'benches load as a model').toMatch(/models\/bench\/bench\.glb/);
  expect(dress, 'bus stops load as a model').toMatch(/models\/bus_stop\/bus_stop\.glb/);
  expect(scene, 'bins stay a model').toMatch(/models\/metal_trash_can\/metal_trash_can_1k\.gltf/);
  expect(dress, 'kit goes through the model pool').toMatch(/loadModelPool|loadPropInstances/);
});

// Grown-lot rooms as models (M2-5) are not done: Muse's T12 only tagged their
// box() parts, and M2.F1 removed the tags. A real rooms task replaces them.

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?capture=1');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
  return errors;
}

test('M2-5 browser: the kit stands at the spawn and the frame stays under 600 k triangles', async ({ page }) => {
  const errors = await boot(page);
  // The props resolve a frame or two after boot; the render modules report
  // what the pool loader instanced, so this waits for the models, not a guess.
  await page.waitForFunction(() => window.__streetKit?.lamps > 0
    && window.__streetKit?.benches > 0 && window.__streetKit?.shelters > 0, null, { timeout: 60000 });
  const kit = await page.evaluate(() => window.__streetKit);
  expect(kit.lamps, 'street lamps stand').toBeGreaterThan(10);
  expect(kit.models.join(','), 'lamps are street_lamp_01').toMatch(/street_lamp_01/);
  expect(kit.benches, 'benches stand').toBeGreaterThan(2);
  expect(kit.shelters, 'bus stops stand').toBeGreaterThan(0);
  expect(kit.models.join(','), 'bins are the trash-can model').toMatch(/metal_trash_can/);
  // The HUD's status line carries the frame's measured triangles (main.js
  // reads renderer.info after the frame rendered): millions, two decimals.
  await page.waitForFunction(() => document.body.innerText.includes('tris'), null, { timeout: 30000 });
  const tris = await page.evaluate(() => {
    const m = document.body.innerText.match(/([\d.]+)M tris/);
    return m ? Math.round(parseFloat(m[1]) * 1e6) : -1;
  });
  expect(tris, 'HUD reports measured triangles').toBeGreaterThanOrEqual(0);
  expect(tris, `frame under ${FRAME_TRIS} triangles at the spawn, saw ${tris}`).toBeLessThan(FRAME_TRIS);
  expect(await page.evaluate(() => window.__game.draws()), 'frame within the draw budget').toBeLessThanOrEqual(175);
  expect(errors, 'no page error').toEqual([]);
});
