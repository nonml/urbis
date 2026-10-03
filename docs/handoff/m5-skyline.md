# The skyline ring: distant buildings, not static-noise slabs

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first (the six laws,
"Prove it"), then VGA-084 in `docs/VISUAL-GAP-ACTIONS.md`. You own this feature end to
end: read, build, measure, fix, repeat.

## What the player sees today

The skyline ring around a generated city (`src/render/block.js`, "Horizon promise
(VGA-054)", near line 950; placed by `ringFor` in `src/sim/vistas.js`) is drawn as
giant plain boxes. In city view (`docs/shots/slice-077-freeland-s7-cityview.png`, the
right third) they read as black monoliths covered in TV-static: the window texture is
far finer than the city's own towers, so at distance it turns to noise. By day they
are near-black slabs.

## The outcome

From city view and from the street, ring towers read as distant office and apartment
buildings of the same city: windows on the same floor and bay scale as the city's own
towers (read `FACADE_TILE` and the facade materials in `src/render/materials.js` and
reuse them if you can), lit windows grouped by floor rather than per-pixel noise, a
facade colour that reads by day, and no shimmer when the camera moves (mipmapped,
nothing finer than a pixel at city-view distance). A setback crown on the tallest ones
is welcome; boxes stacked into a toy are not.

## Finish lines

Measure on the seed 7 city view (`?capture=1&gen=1&seed=7`, press `z`, wait 3 s,
`__game.shot()`), before your first edit and after your last, inside the box x 900–1250,
y 100–600 (the ring towers on the right). Read pixels in the page through a 2D canvas;
luma = 0.2126 R + 0.7152 G + 0.0722 B.

- **Noise:** mean absolute luma difference between horizontally neighbouring pixels.
  After ≤ 50% of before.
- **Daylight:** the same box after pressing `t` and waiting 4 s: mean luma after ≥ 60
  (out of 255) and ≥ 1.5 × before.
- `draws:` unchanged (report it). `GATE_PORT=<yours> npm run gate` fully green.
- Shots before and after: `docs/shots/lane-skyline-s7-city-before.png`, `-after.png`,
  the day version, and the seed 73 street view looking down an avenue. Report all
  numbers before and after and the draw lines.

## Do not

Do not move the ring (its placement belongs to `src/sim/vistas.js` and the farmland
work depends on it). Do not touch `src/render/zoning.js`, `src/render/outskirts.js`,
`src/render/landscape.js` or `src/render/traffic.js`. Do not commit, push, stash or
check out.
