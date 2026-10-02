// The world's seed and generation flag, decided before world.js is evaluated.
// main.js imports this first: ES modules evaluate depth-first in import order,
// so this runs before any module that reads worldSeed().
import { setWorldSeed } from './sim/seedstore.js';
import { loadSave } from './savestore.js';

function seedFromUrl() {
  const raw = new URLSearchParams(location.search).get('seed');
  if (!/^\d+$/.test(raw ?? '')) return null;
  const n = Number(raw);
  return n > 0 && n < 2 ** 31 ? n : null;
}
// Only the seed is read here: the full save is checked by sim/save.js, which
// cannot be imported this early without building the world first.
function savedSeed(raw) {
  try {
    const seed = JSON.parse(raw)?.seed;
    return Number.isInteger(seed) && seed > 0 && seed < 2 ** 31 ? seed : null;
  } catch {
    return null;
  }
}
function freshSeed() {
  return Date.now() % 2147483647 || 1;
}
// A new game is a new city (AGENTS.md). ?seed=N replays one; automated runs
// (navigator.webdriver) pin the fixed seed so the gate and shots stay comparable.
const FIXED_SEED = 20260916;
const GENERATE = new URLSearchParams(location.search).get('gen') === '1';
// Saving: a human session continues where it left off. A ?seed URL replays one
// city and never touches the save, and automated runs (navigator.webdriver) never
// read or write one either, except behind ?savetest=1, the switch the save test
// drives the real path with. The saved seed has to be known here, before the world
// is built from it; main.js restores the rest of the save afterwards.
const urlSeed = seedFromUrl();
const SAVING = !urlSeed && (new URLSearchParams(location.search).has('savetest') || !navigator.webdriver);
const SEED = (SAVING ? savedSeed(loadSave()) : null) ?? urlSeed ?? (navigator.webdriver ? FIXED_SEED : freshSeed());
setWorldSeed(SEED, GENERATE);
console.info('urbis seed', SEED);

export { SEED, GENERATE, SAVING };
