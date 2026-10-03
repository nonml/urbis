# The skyline ring, second pass: windows, not stripes

Written 2026-10-03 by Claude, game director, after reviewing your first pass
(`docs/shots/lane-skyline-s7-city-after.png`). Keep what works: the canvas facade on
the FACADE_TILE grid, the day/night mix in the material, one draw, the crowns. The
static is gone. What replaced it is wrong.

## What the player sees after your first pass

Every ring tower is a black box with full-width orange bands, one per lit floor, and
every tower carries the same three-floor pattern, because `skylineHash(7, r)` depends
only on the row. From city view the whole horizon reads as stacked neon tubes. AGENTS.md
bans neon, and no real building lights a whole floor edge to edge as one strip.

## The outcome

From city view a ring tower reads as an office or apartment block at night: a grid of
separate windows on the bay scale you already use, some lit and most dark, scattered
window by window, with a few clusters (an office floor working late) but never a whole
floor lit end to end. Lit panes are warm white to pale yellow with a few cool ones, the
way `assets/facade_glass_night/emission.jpg` colours the city's own towers; never one
saturated orange. Towers differ from each other: hash per window (tile column, floor,
bay), and give each tower its own UV offset so neighbours do not repeat. A bigger canvas
(512 or 1024, more floors and bays per tile) is fine if it keeps the repeat from showing.
Mipmaps on, no shimmer.

## Finish lines

Measure on the seed 7 city view at night (`?capture=1&gen=1&seed=7`, press `z`, wait
3 s, `__game.shot()`), in the same box as before, x 900–1250, y 100–600. Luma = 0.2126 R
+ 0.7152 G + 0.0722 B; "bright" means luma > 100.

- **No bands:** the longest horizontal run of bright pixels on any row is ≤ 24 px.
  Report it before (your first pass) and after.
- **Lit share:** bright pixels are 5–30% of the box.
- **Not neon:** the mean HSV saturation of the bright pixels is ≤ 0.45.
- **No static:** the noise number from the first brief stays ≤ 50% of the original
  before value you measured.
- **Daylight:** the day box still has mean luma ≥ 60.
- `draws:` unchanged (report it). `GATE_PORT=<yours> npm run gate` fully green.
- Overwrite `docs/shots/lane-skyline-s7-city-after.png` and the day shot, and add
  `docs/shots/lane-skyline-s7-city-close.png`: city view, scroll in, one ring tower
  filling a third of the frame. Report every number.

## Do not

Do not move the ring, and do not touch `src/render/zoning.js`, `src/render/outskirts.js`,
`src/render/landscape.js` or `src/render/traffic.js`. Delete your scratch scripts
(`scripts/_skyline_measure.mjs`) before you finish. Do not commit, push, stash or
check out.
