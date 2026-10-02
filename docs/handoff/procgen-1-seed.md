# Procgen 1: the new game gets a seed

Written 2026-10-02 by Claude. Read `AGENTS.md` (at least **The six laws**) and
`docs/PROCGEN.md`. After that, this file is all you need.

## Where it stands

`src/main.js` lines ~131-132 boot `createStreet(20260916)` and `createCity(20260916)`.
Every game is the same game.

## The edits

1. In `src/main.js`, replace both literals with one `SEED`:
   ```js
   // A new game is a new city (AGENTS.md). ?seed=N replays one; automated runs
   // (navigator.webdriver) pin 20260916 so the gate and shots stay comparable.
   const FIXED_SEED = 20260916;
   const SEED = seedFromUrl() ?? (navigator.webdriver ? FIXED_SEED : freshSeed());
   ```
   `seedFromUrl()` reads `?seed=` as a positive integer below 2**31, and returns null if
   it is missing or invalid. `freshSeed()` is `Date.now() % 2147483647 || 1`. Do not use
   `Math.random` (`npm run check:rng` fails on it).
2. Add `seed: SEED` to the `window.__game` object (~line 418).
3. Log it once at boot: `console.info('urbis seed', SEED)`.
4. Add a test to `tests/gate.spec.js`, written in the style of the tests around it. It
   loads `/?seed=7` and asserts `window.__game.seed === 7`. It then loads `/` with no
   seed and asserts `window.__game.seed === 20260916`.

Change nothing else. Leave `world.js`, `LOTS` and every other table alone.

## Numeric pass/fail

`GATE_PORT=4673 npm run gate` must be fully green, with one more passing test than
before (record the pass count before your edit). `draws:` must be unchanged.
`grep -n 20260916 src/main.js` must show only the `FIXED_SEED` line.

## Do not

Do not commit, push, stash or check out. Do not open PNGs. If it fails after two
retries, stop and report BLOCKED with the output.
