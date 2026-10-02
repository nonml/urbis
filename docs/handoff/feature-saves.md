# Feature: save and continue

Written 2026-10-02 by Claude. You own this whole feature. Work like a developer: read,
build, test, fix, and repeat as many times as you need. Stop only when every finish
line below is met, or when you are truly blocked.

Read `AGENTS.md` (all of it), then `docs/PROCGEN.md` and `src/main.js`. Then follow
where the game's state lives: `src/sim/street.js`, `src/sim/zoning.js`, the economy
module it imports, `src/sim/interior.js` and the player/vehicle state in `main.js`.

## The outcome

The game has no save system. After this:

- The game autosaves every 30 s and when the tab is hidden.
- On boot, if a save exists, the player continues: the same city (same seed), the
  same buildings at the same growth stage, the same money and economy, the player
  standing where they were (indoors or out, on foot or in the car), and the same time
  of day.
- A **New Game** key or menu entry (put it where the HUD already lists keys) wipes the
  save and boots a fresh seed. This is the moment a new city is generated
  (`docs/PROCGEN.md`).
- `?seed=N` and automated runs (`navigator.webdriver`) never read or write the save,
  so tests stay deterministic.

## Rules

- **Pure sim:** serialize/deserialize live in `src/sim/save.js` and take and return
  plain objects. Only `main.js` (or a small `src/savestore.js`) touches
  `localStorage`, wrapped in try/catch. `npm run check:boundary` must pass.
- **Versioned:** `{ version: 1, seed, ... }`. A save with an unknown version is ignored,
  and the game starts new. It must never crash.
- Save only state that cannot be rebuilt from the seed. Do not store meshes or
  anything derived.
- No `Math.random` (`npm run check:rng`).

## Finish lines (all must hold)

- `tests/save.spec.js` (pure Node, written in the style of `tests/zoning.spec.js`):
  run the city 120 s from seed 20260916, serialize, deserialize into a fresh city,
  tick both another 60 s, and assert deep-equal parcels and economy. Also assert that
  a bad version and garbage JSON both return null.
- A browser test in `tests/gate.spec.js`: boot with a test-only switch that enables
  saving (for example `?savetest=1`), move the player, force a save via
  `window.__game`, reload, and assert the player position is within 0.5 m and
  `__game.seed` is unchanged.
- `GATE_PORT=4073 npm run gate` is fully green, and `draws:` is unchanged.

## Do not

Do not change the city generation, the street wall, interiors' content or
`check_overlap.mjs`, because other workers own those. Do not commit, push, stash or
check out. Do not open PNGs. At the end, report: the files changed, every finish line
with its number, and anything you could not do.
