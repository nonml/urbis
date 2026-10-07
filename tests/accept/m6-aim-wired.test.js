// M6.T2b (M6-1, docs/ROADMAP.md): the aim (M6.T2) is what the player sees.
// 3109178 added src/render/aim.js and the registry pick, but nothing imported
// aim.js and the HUD still asked street.js profilerTarget: law 6, dead tech.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

const all = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? all(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []));

test('M6.T2b node: profilerTarget is gone and the frame draws the aim', () => {
  const files = all('src');
  const users = files.filter((f) => /profilerTarget/.test(readFileSync(f, 'utf8')));
  expect(users, 'files still naming profilerTarget').toEqual([]);
  const importers = files.filter((f) => /from ['"][./]*(render\/)?aim\.js['"]/.test(readFileSync(f, 'utf8')));
  expect(importers.length, 'something in the game imports render/aim.js').toBeGreaterThan(0);
});
