# The night road: soft light pools, puddles that reflect

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first (the six laws,
"Prove it"). You own this feature end to end: read, build, measure, fix, repeat.

## What the player sees today

On a new game at night (`?capture=1&gen=1&seed=7`, the opening frame,
`docs/shots/slice-078-clearview-s7-street.png`):

- **A hard-edged bright rectangle** lies on the road under and behind the player.
  `__game.pick(700, 650)` hits a see-through instanced `PlaneGeometry`,
  `MeshBasicMaterial` colour `#cfe6ff`, instance 6, at about (-15.7, 0.2, 27.1): the
  car light pools in `src/render/traffic.js` (the beam / pool meshes near line 240).
  A pool of light has no straight edges, and a headlight pool belongs in front of
  the car, not behind it.
- **Puddles break into shards.** The mirror puddles (`src/render/setdress.js`, "Mirror
  puddles") show lit windows as scattered glass-like fragments: lower left of
  `docs/shots/slice-076-chase-s7-tier2.png`, and the white fleck near (290, 615) of
  the slice-078 night frame.

## The outcome

Every light pool on the road fades out radially with no visible edge, sits where its
light points, and stays as bright at its centre as today. Puddles show the city as a
soft vertical smear of colour, the way wet asphalt does, not as fragments.

## Finish lines

Measure each number on the seed 7 opening frame at night (1280×720, `__game.shot()`),
before your first edit and after your last. Read pixels by drawing the shot into a 2D
canvas in the page (`getImageData`); luma = 0.2126 R + 0.7152 G + 0.0722 B.

- **Pool edge:** the largest luma jump between neighbouring pixels along row 650,
  x 560–900. After ≤ 40% of before.
- **Pool light kept:** the summed luma of the box x 560–900, y 600–720. After within
  ±30% of before (law 6: the light stays, its edge goes).
- **Puddle shards:** the largest neighbouring luma jump inside x 150–450, y 540–660.
  After ≤ 50% of before, while the summed luma of that box stays within ±40%.
- `GATE_PORT=<yours> npm run gate` fully green; `draws:` unchanged (report it).
- Shots before and after: `docs/shots/lane-nightroad-s7-before.png` and
  `lane-nightroad-s7-after.png`, plus the seed 73 opening frame at night. Report all
  six numbers before and after, and the draw lines.

## Do not

Do not touch `src/render/zoning.js`, `src/render/police.js`, `src/render/outskirts.js`
or `src/render/landscape.js`, and do not change the car bodies in `traffic.js` (another
worker owns those): only the light pools and beams. Do not commit, push, stash or
check out.
