# The player is a person, not a stack of parts

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first (the six laws,
especially 3 and 4, and "Prove it"), then VGA-084 in `docs/VISUAL-GAP-ACTIONS.md`.
You own this feature end to end: read, build, measure, fix, repeat.

## What the player sees today

The avatar (`buildPlayer` in `src/render/player.js`) is the thing on screen in every
street frame, centred, 4.5 m from the lens. From behind it reads as a toy: a
ten-sided coat with facets you can count, a flat box laid across the shoulders as the
yoke, a box backpack with box straps, peg legs that end in box boots, seven-sided
arms with no hands, and a ball for a head on no neck (`docs/shots/slice-078-clearview-s7-day.png`,
centre; `docs/shots/REVIEW.md` defect D10).

## The outcome

From the follow cam, by day and by night, the avatar reads as an adult in a dark
jacket: a sloped shoulder line (no flat box), a neck, a hood or collar, arms that end
in hands, legs in trousers with a knee break, shoes with a toe and a heel, and a
backpack with rounded edges. Smooth shading: enough radial segments (16 or more) that
no facet edge shows at 3 m, smooth normals. Keep the walk cycle (`updatePlayer` swings
legs and arms; keep its fields `legL`, `legR`, `armL`, `armR` and its behaviour), the
coat fabric and the face texture. Grounded and modern: no armour plates, no glow, no
neon trim.

## Finish lines

- No `BoxGeometry` in `buildPlayer` (use rounded shapes: lathe, capsule, extrude with
  bevel, or a box with its corners rounded by your own helper).
- Every curved part has ≥ 16 radial segments. Report the total vertex count before
  and after; after ≤ 8,000.
- Meshes in the avatar group ≤ 7, the count today: `draws:` in the gate unchanged
  (report the draw lines).
- `GATE_PORT=<yours> npm run gate` fully green.
- Shots, before your first edit and after your last:
  `node scripts/shot.mjs docs/shots/lane-playerbody-s7 '[{"name":"street"},{"name":"close","js":"__game.look(0.15,3)"},{"name":"day","keys":["t"],"js":"__game.look(0.15,3)","wait":4000}]' '&gen=1&seed=7'`
  saved as `lane-playerbody-s7-before-*` and `lane-playerbody-s7-after-*`. Run
  `__game.frameCheck(2)` on the street pose after: it must stay ≤ 0.02.

## Do not

Do not touch the pedestrians (`src/render/npcs.js`) or the police officers; only the
player. Do not touch `src/render/traffic.js`, `src/render/zoning.js`,
`src/render/outskirts.js` or `src/render/landscape.js`. No new npm packages, no
downloaded models. Do not commit, push, stash or check out.
