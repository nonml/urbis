// M2.F2 and M2.F4 (M2-0, M2-1, M2-2, docs/ROADMAP.md): the models the game loads
// are in the repo, not made in a temp dir by a test. The person is a skinned GLB
// with a walk clip; the car is one believable modern saloon body with no flat
// slab under it (the trellis "showcase racer" came out as shards on a plane).
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

function glb(path) {
  const b = readFileSync(path);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
}

test('M2.F2 node: person.glb ships, skinned, with a walk', () => {
  const path = 'public/assets/models/person.glb';
  expect(existsSync(path), `${path} committed`).toBe(true);
  const j = glb(path);
  expect(j.skins?.length ?? 0, 'skinned').toBeGreaterThan(0);
  expect((j.animations ?? []).some((a) => /walk/i.test(a.name ?? '')), 'walk clip').toBe(true);
  expect(readFileSync('public/assets/CREDITS.md', 'utf8')).toContain('person.glb');
});
