// The world's seed and generation flag, decided before world.js is evaluated.
// main.js imports this first: ES modules evaluate depth-first in import order,
// so this runs before any module that reads worldSeed().
import { setWorldSeed } from './sim/seedstore.js';
import { loadSave } from './savestore.js';
import { pickWorld } from './sim/newgame.js';

// The rules — seed, generate, saving — live in sim/newgame.js (pure, law 5).
// Here we only hand it the browser's facts and apply the answer before the world
// is built.
const { seed: SEED, generate: GENERATE, saving: SAVING } = pickWorld({
  search: location.search,
  webdriver: navigator.webdriver,
  saved: loadSave(),
  now: Date.now(),
});
setWorldSeed(SEED, GENERATE);
console.info('urbis seed', SEED, GENERATE ? 'generated' : 'hand preset');

export { SEED, GENERATE, SAVING };
