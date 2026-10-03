# Cars that are cars, not boxes

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first (the six laws,
especially 3 and 4, and "Prove it"), then VGA-084 in `docs/VISUAL-GAP-ACTIONS.md`.
You own this feature end to end: read, build, measure, fix, repeat.

## What the player sees today

Every car is a stack of boxes: `src/render/traffic.js` builds the body from
`BoxGeometry` parts and stretches one saloon into five shapes (VGA-019). The player's
own car is an orange slab with a flat lid (`docs/shots/slice-078-clearview-s7-day.png`,
centre). It is the first thing the player looks at.

## The outcome

Each of the five shapes is one body with a real silhouette, built in code from a side
profile: a `THREE.Shape` of the car seen from the side (bonnet, windscreen rake, roof,
rear screen, boot, wheel-arch cut-outs) run through `ExtrudeGeometry` with a bevel, so
the edges round off. Glass is an inset, darker band along the cabin. Wheels are
tyre-and-rim cylinders that sit in the arches. One function builds all five shapes
from a handful of numbers each (length, height, cabin start and end, roof height,
bonnet slope). Paint, the hero car and police liveries keep working as they do now.

## Finish lines

- No `BoxGeometry` left in the car-body builder (lights and plates may stay boxes).
- Still instanced exactly as today: `draws:` in the gate unchanged (report before and
  after). Each shape ≤ 2,000 vertices; report each.
- The hero car, traffic and parked cars all use the new bodies; police cars too if they
  share the builder (read `src/render/police.js`; do not edit it unless they do).
- `GATE_PORT=<yours> npm run gate` fully green.
- Shots: `node scripts/shot.mjs docs/shots/lane-carbody-s7 '[{"name":"street"},{"name":"day","keys":["t"],"wait":4000}]' '&gen=1&seed=7'`
  before your first edit (`lane-carbody-s7-before`) and after. Report the draw lines.

## Do not

Do not touch the light pools or beams in `traffic.js` (another worker owns those),
`src/render/zoning.js`, `src/render/outskirts.js` or `src/render/landscape.js`. No new
npm packages, no downloaded models. Do not commit, push, stash or check out.
