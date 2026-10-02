# Procgen 3: the street wall's gaps come from world data

Written 2026-10-02 by Claude. Read `AGENTS.md` (at least **The six laws**) and
`docs/PROCGEN.md`. After that, this file is all you need.

## Where it stands

`src/render/block.js` (~line 270-330) builds the avenue street wall from two tables
tuned to today's map:

- `ROW_RUNS = [[-55.5, 33.5], [46.5, 97]]`: the z stretches where rows may stand.
- `KEEP_OUT`: per-avenue, per-side gaps for the lots, the promenade deck and the
  roof-stair yard.

`scripts/check_overlap.mjs` (lines ~40-55) keeps **copies** of both tables to measure
frontage. Under a generated city both are wrong, so both must go.

## The edits

1. Create `src/sim/streetwall.js`, a pure module (no three, no DOM). It exports
   `rowRuns(ax, side)`, which returns the open `[z0, z1]` runs for the row on side
   `side` (-1 = west, 1 = east) of the avenue at x `ax`. Derive it from:
   - the avenue's span and `WALK_BOUNDS` (`src/sim/world.js`);
   - every crossing (`CROSSINGS`) whose `x0..x1` reaches the avenue: subtract its
     band, `z ± (ROAD_HALF_WIDTH + WALKWAY_WIDTH)`;
   - every lot in `LOTS` (`src/sim/zoning.js`; format `[cx, cz, widthX, depthZ]`,
     full sizes) whose x-range overlaps the row strip, i.e. from
     `ax + side*BUILD_LINE` to `ax + side*(BUILD_LINE + ROW_DEPTH_MAX)`: subtract
     its z-range;
   - the promenade deck (`PROMENADE` in `world.js`, format `[cx, cz, halfX, halfZ]`)
     by the same strip test;
   - the roof-stair yard: find what stands there in `block.js` (search "stair" and
     "roof"; it sits just north of the pinned tower at z -48) and subtract its
     footprint from the same source the yard is built from.

   Export from their modules whatever you need (`LOTS`, `PROMENADE`, …). Name every
   margin as a constant derived from `ROAD_HALF_WIDTH` / `WALKWAY_WIDTH`, with no
   bare tuned numbers. `BUILD_LINE`, `MIN_RUN` and the row depth range move into
   this module.
2. Make `block.js` call `rowRuns()`. Delete `ROW_RUNS` and `KEEP_OUT` there. The
   `PINNED_TOWERS` subtraction stays in `block.js`.
3. Make `scripts/check_overlap.mjs` import `rowRuns` (and `BUILD_LINE`, `MIN_RUN`)
   instead of its copies. Delete the copies. Do not change its ratchets.

## Numeric pass/fail

- `npm run check:overlap` prints `overlap: 0`, `road: 7` or fewer, and
  `frontage: worst row` ≥ 98.2%.
- `grep -n "KEEP_OUT\|ROW_RUNS" src scripts -r` prints nothing.
- `GATE_PORT=4473 npm run gate` is fully green, and `draws:` is no higher than before
  your edit (record it first).

Report the building count line from `check:overlap` before and after your edit.

## Do not

Do not touch `PINNED_TOWERS`, the south row, the terminus, `LOTS` values, or the
checker's ratchet numbers. Do not commit, push, stash or check out. Do not open PNGs.
If it fails after two retries, stop and report BLOCKED with the output.
