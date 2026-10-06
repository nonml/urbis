// M2.T10 (M2-4, docs/ROADMAP.md): landscape. Trees render from a model —
// three tree models, every tree mesh tagged like the pool loader tags them —
// and no icosahedron or cone survives in any tree or mountain. Node-only:
// no page opens.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// buildTrees paints its leaf cards on a canvas: stub the one DOM call it needs
// so the geometry builds in Node exactly as in the browser.
if (typeof document === 'undefined') {
  const noop = () => {};
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        clearRect: noop,
        save: noop,
        translate: noop,
        rotate: noop,
        beginPath: noop,
        ellipse: noop,
        fill: noop,
        restore: noop,
      }),
    }),
  };
}

const propsSrc = readFileSync('src/render/props.js', 'utf8');
const landSrc = readFileSync('src/render/landscape.js', 'utf8');

test('M2-4: no icosahedron or cone in any tree or mountain', () => {
  for (const [name, src] of [['props.js', propsSrc], ['landscape.js', landSrc]]) {
    expect(src, `${name}: no IcosahedronGeometry`).not.toMatch(/IcosahedronGeometry/);
    expect(src, `${name}: no ConeGeometry`).not.toMatch(/ConeGeometry/);
  }
});

test('M2-4: mountains build as one smooth model mesh', async () => {
  const { buildMountains } = await import('../../src/render/landscape.js');
  const { DISTRICTS } = await import('../../src/sim/world.js');
  const group = buildMountains(DISTRICTS[0]);
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  expect(meshes.length, 'one merged mountain mesh').toBe(1);
  const mesh = meshes[0];
  expect(mesh.geometry.type, 'not a cone or icosahedron').not.toMatch(/Cone|Icosahedron/);
  expect(mesh.material.flatShading, 'slopes, not flat-shaded spikes').not.toBe(true);
  expect(mesh.material.vertexColors, 'rock/snow vertex colours').toBe(true);
  expect(mesh.geometry.attributes.color, 'a painted color attribute').toBeTruthy();
  expect(mesh.userData.model, 'a model tag like the pool loader sets').toBeTruthy();
});

test('M2-4: trees render from 3 models', async () => {
  // Three tree models live in the source, one tag each — whether as a
  // `userData.model = 'tree-…'` assignment or a `model: 'tree-…'` pool entry.
  const tags = [
    ...propsSrc.matchAll(/userData\.model\s*=\s*['"]([^'"]+)['"]/g),
    ...propsSrc.matchAll(/model:\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1]).filter((s) => /tree/i.test(s));
  expect(new Set(tags).size, `three tree models, saw [${[...new Set(tags)]}]`).toBeGreaterThanOrEqual(3);

  const { buildTrees } = await import('../../src/render/props.js');
  const group = buildTrees();
  const meshes = [];
  group.traverse((o) => { if (o.isInstancedMesh) meshes.push(o); });
  expect(meshes.length, 'trunk + branch + one canopy pool per model').toBe(5);
  for (const m of meshes) {
    expect(m.userData.model, `${m.name || 'tree mesh'} carries its model`).toBeTruthy();
    expect(m.geometry.type, `${m.userData.model}: not an icosahedron or cone`).not.toMatch(/Icosahedron|Cone/);
  }
  const models = new Set(meshes.map((m) => m.userData.model));
  expect(models.size, `three tree models, saw [${[...models]}]`).toBeGreaterThanOrEqual(3);
  const canopies = meshes.filter((m) => /canopy/i.test(m.userData.model));
  expect(canopies.length, 'one canopy pool per tree model').toBe(3);
  for (const c of canopies) {
    expect(c.material.map, 'leaf-card texture').toBeTruthy();
    expect(c.material.alphaTest, 'alpha-cut leaves').toBe(0.5);
    const tris = c.geometry.index ? c.geometry.index.count / 3 : c.geometry.attributes.position.count / 3;
    expect(tris, `${c.userData.model}: a light canopy`).toBeLessThanOrEqual(600);
  }
  // Every spot grows exactly one trunk and one canopy.
  const trunks = meshes.filter((m) => /trunk/i.test(m.userData.model));
  expect(trunks.length, 'one trunk pool').toBe(1);
  const total = canopies.reduce((s, c) => s + c.count, 0);
  expect(total, 'every trunk has a canopy').toBe(trunks[0].count);
});
