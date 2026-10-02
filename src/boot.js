// The world's seed and generation flag, decided before world.js is evaluated.
// main.js imports this first: ES modules evaluate depth-first in import order,
// so this runs before any module that reads worldSeed().
import { setWorldSeed } from './sim/seedstore.js';

function seedFromUrl() {
  const raw = new URLSearchParams(location.search).get('seed');
  if (!/^\d+$/.test(raw ?? '')) return null;
  const n = Number(raw);
  return n > 0 && n < 2 ** 31 ? n : null;
}
function freshSeed() {
  return Date.now() % 2147483647 || 1;
}
// A new game is a new city (AGENTS.md). ?seed=N replays one; automated runs
// (navigator.webdriver) pin the fixed seed so the gate and shots stay comparable.
const FIXED_SEED = 20260916;
const GENERATE = new URLSearchParams(location.search).get('gen') === '1';
const SEED = seedFromUrl() ?? (navigator.webdriver ? FIXED_SEED : freshSeed());
setWorldSeed(SEED, GENERATE);
console.info('urbis seed', SEED);

export { SEED, GENERATE };
