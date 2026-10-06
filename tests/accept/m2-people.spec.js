// M2.T4 / M2-2 player + M2-0 pipeline: MPFB body by script, CMU walk fitted,
// skinned GLB under 10,000 triangles; the player renders one SkinnedMesh with
// an animation mixer; the limbs move between frames while they walk. Test 1 is
// Node-only (the script runs to a temp path, its GLB parses, player.js sources
// the model); test 2 boots the game, serving that same file at the model URL.
import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GLB = join(tmpdir(), 'm2-person.glb');
const TRI_BUDGET = 10000;

test.beforeAll(async () => {
  execFileSync('python3', ['tools/models/make_person.py'], { env: { ...process.env, PERSON_OUT: GLB } });
});

function glb() {
  const b = readFileSync(GLB);
  expect(b.subarray(0, 4).toString(), 'GLB magic').toBe('glTF');
  let off = 12;
  const chunks = [];
  while (off < b.length) {
    chunks.push({ len: b.readUInt32LE(off), type: b.subarray(off + 4, off + 8).toString(), at: off + 8 });
    off += 8 + chunks[chunks.length - 1].len;
  }
  const find = (t) => { const c = chunks.find((x) => x.type === t); return b.subarray(c.at, c.at + c.len); };
  return { json: JSON.parse(find('JSON').toString()), bin: find('BIN\0') };
}

test('M2.T4 node: make_person.py runs, its GLB is skinned, walks, in budget', async () => {
  const src = readFileSync('tools/models/make_person.py', 'utf8');
  expect(src, 'MPFB body, CMU walk').toMatch(/MPFB[\s\S]*CMU/i);
  expect(existsSync(GLB), 'person.glb exported').toBe(true);
  const { json, bin } = glb();
  const acc = (i) => json.accessors[i].count;
  const tris = (json.meshes ?? []).flatMap((m) => m.primitives)
    .reduce((s, p) => s + (p.indices === undefined ? acc(p.attributes.POSITION) : acc(p.indices)) / 3, 0);
  expect(tris, 'under 10,000 triangles').toBeLessThan(TRI_BUDGET);
  expect(json.skins?.[0]?.joints.length ?? 0, 'a real skeleton').toBeGreaterThanOrEqual(6);
  const anim = (json.animations ?? []).find((a) => /walk/i.test(a.name ?? ''));
  expect(anim, 'a walk clip').toBeTruthy();
  const limbs = anim.channels.filter((c) => /thigh|shin|arm/i.test(json.nodes[c.target.node].name ?? ''));
  expect(limbs.length, 'limb joints animated').toBeGreaterThanOrEqual(4);
  for (const c of limbs) {
    const o = json.accessors[anim.samplers[c.sampler].output];
    const at = (json.bufferViews[o.bufferView].byteOffset ?? 0) + (o.byteOffset ?? 0);
    const vals = Array.from({ length: o.count * 4 }, (_, i) => bin.readFloatLE(at + i * 4));
    expect(Math.max(...vals) - Math.min(...vals), `${json.nodes[c.target.node].name} moves`).toBeGreaterThan(1e-3);
  }
  const psrc = readFileSync('src/render/player.js', 'utf8');
  expect(psrc, 'person.glb SkinnedMesh mixer').toMatch(/person\.glb[\s\S]*SkinnedMesh[\s\S]*AnimationMixer/);
});

async function gridOf(page) {
  return page.evaluate(async () => {
    const img = new Image();
    img.src = window.__game.shot();
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 48; c.height = 27;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, 48, 27);
    return [...g.getImageData(0, 0, 48, 27).data];
  });
}

function diffShare(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 10) changed++;
  }
  return changed / (a.length / 4);
}

test('M2-2 player: one rigged mesh, walking moves it, idle holds it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/assets/models/person.glb', (route) => route.fulfill({ path: GLB }));
  await page.goto('/?capture=1&gen=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__game?.avatarStats?.().meshes === 1, null, { timeout: 60000 });
  expect(await page.evaluate(() => window.__game.avatarStats().verts), 'a decimated body').toBeLessThan(TRI_BUDGET);
  const rows = (await page.evaluate(() => window.__game.ledger(1))).flat();
  expect(rows.filter((r) => r.pass === 'main' && r.type === 'SkinnedMesh').length, 'one SkinnedMesh draw').toBe(1);
  await page.evaluate(() => window.__game.night(0));
  await page.waitForTimeout(1500);
  await page.keyboard.down('w');
  await page.waitForTimeout(900);
  const walkA = await gridOf(page);
  await page.waitForTimeout(450);
  const walkB = await gridOf(page);
  await page.keyboard.up('w');
  await page.waitForTimeout(1200);
  const idleA = await gridOf(page);
  await page.waitForTimeout(450);
  const idleB = await gridOf(page);
  expect(errors, 'no page error').toEqual([]);
  expect(diffShare(walkA, walkB), 'limbs move between frames while walking').toBeGreaterThan(0.03);
  // Measured 0.59 walking / 0.027 idle: the street moves ~3% of cells.
  expect(diffShare(idleA, idleB), 'idle holds the frame').toBeLessThan(0.05);
  mkdirSync('docs/shots', { recursive: true });
  const png = await page.evaluate(() => window.__game.shot());
  writeFileSync('docs/shots/m2-0-person.png', Buffer.from(png.split(',')[1], 'base64'));
});
