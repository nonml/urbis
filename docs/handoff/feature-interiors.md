# Feature: walk into what you zoned (pillar 1)

Written 2026-10-02 by Claude, game director. You own this whole feature. Work like a
developer: read, build, test, fix, and repeat as many times as you need. Stop only
when every finish line is met, or when you are truly blocked.

## Why this, why now

`AGENTS.md`'s first pillar is **Build it, live in it**. Its test is: *Can you walk into
something you zoned?* Today the answer is **no**. Zoned lots grow buildings
(`src/sim/zoning.js`, `src/render/zoning.js`), but the only enterable places are two
hand-placed spaces, the noodle bar and the roof (`src/sim/interior.js`). That gap is
the heart of the game, and it is your job.

Read `AGENTS.md` (all of it), `docs/INTERIORS.md`, `docs/ZONING.md`,
`docs/CITYVIEW.md`, `src/sim/interior.js` and its render half
(`src/render/interior.js`, `interiorkit.js`, `interiorsets.js`), and
`src/render/zoning.js`.

## The outcome

Every grown parcel (stage LOW or higher) has a street door. Through it is a space that
matches its use and size:

| Use | Inside |
|---|---|
| `com` | a shop: counter, shelves, fridge wall. At MID or HIGH, a bigger floor or a café |
| `res` | an apartment lobby with a mailbox wall, stairs, and one flat you can enter. The first `res` parcel to reach LOW is the player's **safehouse** |
| `ind` | a workshop or warehouse: racking, a forklift, a roller door |

- The door appears when the building reaches LOW and disappears when the building is
  cleared or declines below LOW. While the player is inside, the building never
  disappears; defer the decline until they leave.
- Doors and frames derive from the parcel's lot and the building's footprint, never
  from typed coordinates. The city will soon be generated from a seed
  (`docs/PROCGEN.md`), so whatever lots exist must just work.
- Grounded modern look (see AGENTS.md): never neon, never toy boxes. Reuse the kit in
  `interiorkit.js`/`interiorsets.js`, and merge or instance the furniture (law 4).
- The two existing spaces keep working.

## Finish lines (all must hold)

- **Pure test** `tests/interior.spec.js`: from seed 20260916, zone one lot of each use
  and tick until each reaches LOW. Then assert each has a door. Walk the player body
  through each door, assert `isIndoors`, and walk back out. Clear one lot and assert
  its door is gone.
- **Browser test** in `tests/interior-gate.spec.js`: the same flow for one `com` lot
  via `window.__game`. It asserts draws ≤ 175 inside and prints
  `zoned shop draws: N / 175`.
- `GATE_PORT=4173 npm run gate` is fully green. The street `draws:` line must not rise
  by more than 3.
- Evidence: `npm run build`, then one `scripts/shot.mjs` call (`SHOT_PORT=4191`,
  prefix `docs/shots/slice-061-zoned-interiors`) with a pose inside each use's space.
  Report the draw lines. Do not open or judge the PNGs.
- Update `docs/INTERIORS.md`.

## Do not

Do not touch `citygen.js`, `world.js` road data, the street-wall code or
`check_overlap.mjs`, because another worker owns those. Do not commit, push, stash or
check out. At the end, report: the files changed, every finish line with its number,
and anything you could not do.
