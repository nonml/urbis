// M2.F1 (M2-6, docs/ROADMAP.md): `userData.model` means "this mesh came from a
// model file". The sweep trusts it, so a hand-built box, cylinder or quad that
// wears the tag hides a defect instead of fixing it (5edace1 tagged the player's
// boxes 'player-avatar'). Every tag in src/render must name a .glb path, as a
// string or as a constant set to one; the pool loader (models.js) tags with the
// file it loaded and is the one exception.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'src/render';
const TAG = /userData\.model\s*=\s*([^;]+);/g;

function glbPath(rhs, src) {
  const lit = rhs.match(/^['"`]([^'"`]+)['"`]$/);
  if (lit) return lit[1].endsWith('.glb');
  const id = rhs.match(/^[A-Z_][A-Z0-9_]*$/);
  if (!id) return false;
  const def = src.match(new RegExp(`\\b${rhs}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`));
  return Boolean(def && def[1].endsWith('.glb'));
}

test('M2.F1 node: every userData.model tag names a model file', () => {
  const fakes = [];
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.js') && n !== 'models.js')) {
    const src = readFileSync(`${DIR}/${f}`, 'utf8');
    for (const m of src.matchAll(TAG)) {
      const rhs = m[1].trim();
      if (!glbPath(rhs, src)) fakes.push(`${f}: userData.model = ${rhs}`);
    }
  }
  expect(fakes, 'tags on meshes that no model file made').toEqual([]);
});
