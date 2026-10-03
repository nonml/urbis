# A police chase the player can see

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first (the six laws,
"Prove it"). You own this feature end to end: read, build, measure, fix, repeat.

## What the player sees today

The chase slices (`docs/shots/slice-075-chase-s7-tier3.png`,
`slice-076-chase-s7-tier2.png`) were taken at wanted tier 2 and 3 on seed 7, and not
one police car is in either frame. The radio talks about a chase the player cannot see.

## The outcome

Once the player is wanted at tier 2 or more on a generated city, a pursuit car comes
for them through the city's real roads and is on screen behind or ahead of them within
20 seconds of game time, close enough to read as police (lightbar, livery).

Start from `src/sim/wanted.js`, `src/sim/patrol.js`, `src/sim/response.js`,
`src/render/police.js` and the probes `__game.wanted()`, `__game.pursuit()`,
`__game.police` at the bottom of `src/main.js`. Find out first why no car is in frame:
units that never spawn, spawn far away, cannot route on a generated road graph, or are
drawn somewhere the camera never looks. Measure, then fix the real cause.

## Finish lines

- A capture-only probe `window.__game.policeOnScreen()` returns, for each active
  pursuit unit, `{ dist, inFrame, visible }`: `dist` to the player in metres, `inFrame`
  whether its centre projects inside the canvas, `visible` whether `__game.pick` at that
  projected pixel hits the unit's own mesh first.
- `tests/chase-seen.spec.js` (you write it): on `?capture=1&gen=1&seed=N` for N = 7, 73
  and 1234567, raise the wanted tier to 2 the way play does (read how slices 075/076 did
  it: the hack, then heat), run game time forward, and expect that within 20 s some
  unit has `dist ≤ 40`, `inFrame` and `visible`. Report the time it took on each seed.
- `GATE_PORT=<yours> npm run gate` fully green; `draws:` within 175 (report it).
- Shots at the moment the test passes, normal follow cam, seeds 7 and 73:
  `docs/shots/lane-chase-s7-seen.png`, `lane-chase-s73-seen.png` (use `scripts/shot.mjs`
  with a `js` step). Report the draw lines.

## Do not

Do not touch `src/render/zoning.js`, `src/render/traffic.js`, `src/render/outskirts.js`
or `src/render/landscape.js`. Do not change the economy. Do not commit, push, stash or
check out.
