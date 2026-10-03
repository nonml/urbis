# Cranes that never swing through a neighbour

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first (the six laws,
"Prove it"). You own this feature end to end: read, build, measure, fix, repeat.

## What the player sees today

- City view, seed 7 (`docs/shots/slice-077-freeland-s7-cityview.png`): yellow jibs
  reach out over neighbouring roofs and across roads.
- Street, seed 7 spawn (`docs/shots/slice-078-clearview-s7-street.png`, top right): a
  grey box with a yellow band floats 10 m up a facade. `__game.pick` puts it in the
  zoning kit InstancedMesh (`src/render/zoning.js`), instances near (-11, 10–11.7, 8):
  a crane's cab and jib with no visible mast under it.

Likely cause: `slewZone()` in `src/render/zoning.js`. When no heading clears
(`best.run === 0`) it returns `rest: 0, swing: 0`, so the jib points along +x through
whatever is there. Measure before you trust this.

## The outcome

Every crane's whole boom (counter-jib and jib), at every yaw it ever reaches
(rest ± swing), clears every rect `buildZoning` already collects (tower footprints,
other parcels, roads). A crane boxed in at full `JIB` tries a shorter jib (0.75, then
0.5 of `JIB`) and takes the longest that has a clear heading; if none clears, it stands
as a mast and cab with no jib. Every crane that has a jib has its mast drawn from the
ground (or its podium) up to the jib, so nothing floats.

## Finish lines

- A pure, exported `craneRig(p, rects)` returns `{ rest, swing, jib }`.
  `tests/crane-clear.spec.js` (you write it) proves on synthetic rects: open ground
  gets the full jib; a lot boxed in on all sides at 18 m gets a shorter jib; boxed in
  at 9 m gets no jib.
- A capture-only probe `window.__game.cranes()` (behind `?capture=1`, like the others
  at the bottom of `src/main.js`) returns each crane's `{ x, z, yaw, jib, clear }`,
  where `clear` re-tests the boom at its current yaw. A browser test in the same spec
  file boots `?capture=1&gen=1&seed=N` for N = 1..12 and 73, advances the sim
  (`__game.advance(120)`), and expects every crane `clear: true`. Report the count of
  cranes and of shortened / jib-less ones.
- `GATE_PORT=<yours> npm run gate` fully green; `draws:` unchanged (report it).
- Shots: `node scripts/shot.mjs docs/shots/lane-cranes-s7 '[{"name":"street"},{"name":"city","keys":["z"],"wait":3000}]' '&gen=1&seed=7'`
  and the same for seed 73. Report the draw lines.

## Do not

Do not touch `src/render/outskirts.js`, `src/render/landscape.js`, `src/render/cityview.js`
or anything under `src/sim/` except reading it. Do not commit, push, stash or check out.
