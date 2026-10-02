# Procgen 6b: vista caps and the flat district derive from the roads

Written 2026-10-02 by Claude. Read `AGENTS.md` (at least **The six laws**) and
`docs/PROCGEN.md`. After that, this file is all you need.

## Where it stands

Three tables are tuned to today's three avenues and one south connector:

- `src/render/block.js` ~323: `SOUTH_TOWERS` (x, w, h), with `SOUTH_ROW_Z = -76.1`.
  The row stands just south of the `south` connector's road-and-walkway band.
- `src/render/block.js` ~333: `TERMINUS_TOWERS` (x, z, w, h, d). There is one cap on
  each avenue's north end (z 104) and one between each neighbouring pair (z 106).
- `src/sim/world.js` ~241: `DISTRICT_RELIEF = [7, 2.5, 73, 117.5]` (cx, cz, half-x,
  half-z). It is the box where the ground stays flat for the towers.

## The edits

1. **South row.** Derive it from the **southernmost** crossing in `CROSSINGS`
   (`src/sim/world.js`):
   - Row z: `cr.z - ROAD_BAND - (SOUTH_DEPTH + PODIUM_LIP)/2`, where
     `ROAD_BAND = ROAD_HALF_WIDTH + WALKWAY_WIDTH`, `SOUTH_DEPTH = 10` and
     `PODIUM_LIP = 1.2`. Today this gives -76.1.
   - Tower x: from `cr.x0 + 5` to `cr.x1 - 5`, every 12 m. Today that is -2, 10, 22,
     34, 46.
   - Widths cycle `[11, 10]` and heights cycle `[30, 42, 26, 36, 28]` by index, so
     today's row is reproduced exactly.
   - Delete `SOUTH_TOWERS` and `SOUTH_ROW_Z`.
2. **Terminus.**
   - For each avenue: a cap at `x = av.x`, `z = av.z1 + 4`.
   - For each neighbouring avenue pair: a cap at the midpoint x, `z = av.z1 + 6`.
   - Sizes cycle through today's values, in today's emission order, so the output is
     identical for today's map: avenue caps `[16,44,12], [14,36,11], [14,40,12]`, then
     mid caps `[12,52,11], [12,48,11]`.
   - Keep the avenue caps first, in `AVENUES` order (main, east, west), then the mid
     caps. If that order differs from today's table, match today's order for
     `idx`/facade stability and say how you did it.
   - Delete `TERMINUS_TOWERS`.
3. **Relief box.** In `world.js`, derive `DISTRICT_RELIEF` from the union of
   `WALK_BOUNDS` and `GRAPH_EXTENT`, grown by a named `RELIEF_MARGIN`. Pick the
   smallest margin that passes the check below, and report it.
4. **New check** in `scripts/check_overlap.mjs`. For every tower footprint it already
   collects, sample `heightAt` (from `world.js`) at the 4 corners and the centre. Print
   `relief: N towers off flat ground (ratchet 0)`, counting a tower when any sample
   has `|y| > 0.01`, and list each offending tower like the road lines do. Fail if
   N > 0. Add the check **before** making edit 3, and report N on today's code first.

## Numeric pass/fail

- `npm run check:overlap` prints `overlap: 0`, `road: 7`, the same frontage, and
  `relief: 0 towers off flat ground`.
- `grep -n "SOUTH_TOWERS\|TERMINUS_TOWERS\|SOUTH_ROW_Z\|7, 2.5, 73" src -r` prints
  only the `name` strings passed to `emitTower` (rename them `south[i]` and
  `terminus[i]` so the grep prints nothing at all).
- `GATE_PORT=4773 npm run gate` is fully green, and `draws:` is unchanged.

## Do not

Do not touch `PINNED_TOWERS`/`landmarks.js`, the street wall (`ROW_RUNS`,
`KEEP_OUT`, `streetWall`), `LOTS` or `signs.json`. Do not commit, push, stash or check
out. Do not open PNGs. If it fails after two retries, stop and report BLOCKED with the
output.
