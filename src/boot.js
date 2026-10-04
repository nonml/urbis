// The world's seed and generation flag, decided before world.js is evaluated.
// main.js imports this first: ES modules evaluate depth-first in import order,
// so this runs before any module that reads worldSeed().
import { setWorldSeed } from './sim/seedstore.js';
import { loadSave, clearSave } from './savestore.js';
import { pickWorld } from './sim/newgame.js';
import { initTitle, readPending } from './ui/title.js';

// The rules — seed, generate, saving — live in sim/newgame.js (pure, law 5).
// Here we only hand it the browser's facts and apply the answer before the world
// is built.
const params = new URLSearchParams(location.search);
const urlWorld = params.has('seed') || params.has('gen');
const saved = loadSave();
// A clicked New Game (ui/title.js) leaves its seed and name here; it replaces
// the save, even one a last-moment autosave wrote back on the way out.
const pending = urlWorld ? null : readPending();
if (pending) clearSave();
const savedArg = pending ? JSON.stringify({ seed: pending.seed, generate: true }) : saved;
const { seed: SEED, generate: GENERATE, saving: SAVING } = pickWorld({
  search: location.search,
  webdriver: navigator.webdriver,
  saved: savedArg,
  now: Date.now(),
});
setWorldSeed(SEED, GENERATE);
console.info('urbis seed', SEED, GENERATE ? 'generated' : 'hand preset');

// The title is the player's front door. Automated runs, screenshots and URL
// world picks (?seed / ?gen / ?replay) boot straight into play, as before.
const show = !navigator.webdriver && !params.has('capture') && !urlWorld && !params.has('replay');
initTitle({ seed: SEED, show, pending, saved: pending ? null : saved });

export { SEED, GENERATE, SAVING };
