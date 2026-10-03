# Free land the player can see

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first (the six laws,
"Prove it"). You own this feature end to end: read, build, measure, fix, repeat.

## What the player sees today

Slice 077 made every district of a new city start with `FREE_LOTS` (2) empty, unzoned
lots for the player to zone (`freeLand()` in `src/sim/zoning.js`). In its own shot,
`docs/shots/slice-077-freeland-s7-cityview.png`, nobody can say which lots those are:
city view paints unzoned land the same grey as everything else
(`src/render/cityview.js`), and at street level an empty lot is just a gap.

## The outcome

- **Street level:** a free lot reads as land for sale: a rough ground plate (gravel
  and weeds, darker than the pavement), a low construction-style fence along the
  street side with a gap, and a real-estate board on posts at the kerb, sized like a
  real one (about 2.4 × 1.2 m, 2 m up), lettered "LAND FOR LEASE" in a plain sign
  colour (navy, brick red or forest green on white: never neon; see AGENTS.md "Add a
  sign" for palette). Read `src/render/vacancy.js` and `src/render/signs.js` first and
  reuse their board / atlas if they fit.
- **City view:** free lots stand out at a glance: a pale neutral outline, dashed if you
  can, clearly unlike the zone colours, plus the same board seen from above.
- When the player zones the lot, all of it goes away.

Put the new rendering in a new file `src/render/vacant.js` and wire it in `src/main.js`;
`src/render/zoning.js` belongs to another worker.

## Finish lines

- A capture-only probe `window.__game.freeLots()` returns each free lot's `{ x, z }`.
- `tests/vacant-land.spec.js` (you write it), on `?capture=1&gen=1&seed=N` for N = 7,
  73 and 1234567: in city view (`z`), every free lot's centre projects inside the frame
  and `__game.pick` there hits the vacant-lot mesh first; then `__game.pose` the player
  on the pavement facing the lot, and `pick` at the screen centre hits the board, fence
  or plate. After zoning the lot (find how the game zones one), those meshes are gone.
- One merged or instanced mesh for all lots: `draws:` up by at most 2 (report it).
- `GATE_PORT=<yours> npm run gate` fully green.
- Shots: `docs/shots/lane-vacant-s7-city.png` and `lane-vacant-s7-street.png` (street
  pose facing a free lot), same for seed 73. Report the draw lines.

## Do not

Do not touch `src/render/zoning.js`, `src/render/outskirts.js`, `src/render/landscape.js`
or the sim's zoning rules. Do not commit, push, stash or check out.
