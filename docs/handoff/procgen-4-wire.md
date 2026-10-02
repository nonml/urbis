# Procgen 4: the world reads the generator (behind `?gen=1`), plus a layout meter

Written 2026-10-02 by Claude. Read `AGENTS.md` (at least **The six laws**),
`docs/PROCGEN.md`, `src/sim/citygen.js` and the top 50 lines of `src/sim/world.js`.
After that, this file is all you need.

## Why it is behind a flag

Lots, the pinned towers, the south row, the terminus and the relief box are still
hand-placed for today's map. With generated roads they collide. Stages 5–7 fix that.
This stage makes the collisions **measurable**, so later briefs have a number to drive
to zero. Without the flag, the game must stay exactly as it is.

## The edits

1. **`src/sim/seedstore.js`** (new, pure):
   ```js
   // The world's seed and whether to generate from it. Set once, before
   // world.js is evaluated (src/boot.js in the browser, the checker in Node).
   let state = { seed: 20260916, generate: false };
   export function setWorldSeed(seed, generate) { state = { seed, generate }; }
   export function worldSeed() { return state; }
   ```
2. **`src/boot.js`** (new, outside `sim/`). Move `seedFromUrl()`, `freshSeed()`,
   `FIXED_SEED`, `SEED` and the `console.info` there from `src/main.js`. Add
   `const GENERATE = new URLSearchParams(location.search).get('gen') === '1';`.
   Call `setWorldSeed(SEED, GENERATE)` and `export { SEED, GENERATE }`.
3. **`src/main.js`**: make `import { SEED } from './boot.js';` the **first** import. ES
   modules evaluate depth-first in import order, so boot runs before `world.js` is
   evaluated. Delete the moved code. Behaviour without `?gen=1` is unchanged.
4. **`src/sim/world.js`**: rename the literal to `HAND_DOWNTOWN`, then add:
   ```js
   const { seed, generate } = worldSeed();
   const DOWNTOWN = generate ? generateDistrict(seed) : HAND_DOWNTOWN;
   ```
   Nothing else in `world.js` changes.
5. **`scripts/check_overlap.mjs`**: accept `--seed N`. When it is given, call
   `setWorldSeed(N, true)` **before** the first dynamic import of any `src/` module
   (move the import of `seedstore.js` to the top if needed). In that mode, print the
   same lines but skip the ratchet failures and exit 0. Without `--seed`, behaviour is
   byte-identical.
6. **`scripts/check_layouts.mjs`** (new) and an npm script `check:layouts`. For seeds
   1 to 10, it runs `node scripts/check_overlap.mjs --seed N` as a child process and
   prints one line per seed: `seed N: overlap A, road B, worst row C%`. It ends with a
   `total: overlap ΣA, road ΣB` line. It always exits 0. Do **not** add it to `gate`;
   it is a meter, not a gate.
7. **`tests/gate.spec.js`**: add a test that loads `/?gen=1&seed=5` and waits for
   `window.__game`. It asserts `__game.seed === 5` and that no page error was thrown.
   Follow how the first test in that file collects `errors`. If the generated layout
   throws, find the module that throws and fix it **only** by reading world data
   instead of a hard-coded value. If that is not small, mark the test `test.fixme`
   with a one-line reason and report it.

## Numeric pass/fail

- `npm run check:overlap` (no seed) prints exactly the lines it printed before your
  edit.
- `npm run check:layouts` runs and prints 10 seed lines plus a total. Report all 11.
- `GATE_PORT=4673 npm run gate` is fully green with the test count +1 (or +0 with one
  fixme, reported), and `draws:` is unchanged.

## Do not

Do not move or edit `LOTS`, the tower tables, `landmarks.js` or the street wall. Do
not commit, push, stash or check out. Do not open PNGs. If it fails after two
retries, stop and report BLOCKED with the output.
