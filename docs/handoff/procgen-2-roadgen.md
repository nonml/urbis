# Procgen 2: seed → district road layout

Written 2026-10-02 by Claude. Read `AGENTS.md` (at least **The six laws**) and
`docs/PROCGEN.md`. Then read the top of `src/sim/world.js` (the `DOWNTOWN` object,
lines 1-50). After that, this file is all you need.

## Goal

Add a new pure module, `src/sim/citygen.js`, that exports `generateDistrict(seed)`. It
returns an object with exactly `DOWNTOWN`'s shape:
`{ id, avenues: [{id,x,z0,z1,lanes}], crossings: [{id,z,x0,x1,lanes}], walk, drive }`.
Do **not** wire it into `world.js` yet; that is stage 4.

## Rules the output must follow

Use `mulberry32` from `src/sim/rng.js`. No `Math.random`, no three, no DOM.
`id` is `'downtown'`.

- **Avenues:** 2 to 4 of them. Ids are `av0`…, sorted by x. Neighbouring x values are
  36 to 56 m apart. The mean x is within ±20 of 0. `z0 = -100`, `z1 = 100`,
  `lanes: 2`. Round x to 0.5 m.
- **Crossings:** 1 to 3 of them. Ids are `cr0`…, sorted by z. Each z is in [-80, 80],
  rounded to 0.5 m, and at least 40 m from every other crossing. Each crossing runs
  from avenue `i` to avenue `j` (j > i), meaning `x0 = avenues[i].x - 8` and
  `x1 = avenues[j].x + 8`. At least one crossing spans every avenue.
- **Bounds:** `drive = { minX: min x0, maxX: max x1, minZ: -68, maxZ: 100 }`.
  `walk` is the same box with `maxX: drive.maxX + 18`, which leaves room for the
  park. (For comparison, today's hand layout gives drive x -52…52 and walk to 70.)
- **Determinism:** the same seed always returns a deep-equal object.

## Test

Add `tests/citygen.spec.js`, in the same style as `tests/zoning.spec.js` (it uses
`@playwright/test`, pure Node, and no browser). Loop over seeds 1 to 500 and assert
every rule above, one `expect` per rule. Then assert that seeds 1 and 2 differ, and
that seed 20260916 called twice is deep-equal.

## Numeric pass/fail

`GATE_PORT=4573 npm run gate` must be fully green, and the new spec's tests must pass.
`draws:` must be unchanged. Nothing outside `src/sim/citygen.js` and
`tests/citygen.spec.js` may change.

## Do not

Do not commit, push, stash or check out. Do not open PNGs. If it fails after two
retries, stop and report BLOCKED with the output.
