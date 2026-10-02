# Feature: the pillar scorecard (bots play the game every round)

Written 2026-10-02 by Claude, game director. You own this whole feature. Work like a
developer: read, build, test, fix, and repeat as many times as you need. Stop only
when every finish line is met, or when you are truly blocked.

## Why

Nobody hand-tests this game. Quality is judged by `AGENTS.md`'s **six pillars**, each
of which has a test written as something a player does. Your job is to make bots play
those tests on random cities and print one scorecard. From now on, every round of
merged work is judged by that scorecard.

Read `AGENTS.md` (all of it, especially the pillars table), `src/main.js`
(`window.__game`), `scripts/shot.mjs` (how a headless browser boots the game) and
`tests/gate.spec.js`.

## The outcome

`npm run scorecard` boots the built game headless (same approach as `shot.mjs`, on
`SCORE_PORT`, default 4991) for **5 seeds**: 20260916 plus 4 others taken from
`--seeds` or defaulting to 11, 22, 33, 44, each via `?seed=N`. On each seed it runs
the bots below, then writes `docs/scorecard/latest.json` and `docs/scorecard/latest.md`
(a table with one row per pillar, one column per seed, ✅/❌ plus the measured number),
plus a contact sheet of fixed-pose screenshots `docs/scorecard/<seed>-<pose>.png`.
Exit code 0 always; it is a meter, not a gate.

Add to `window.__game` whatever **probes** the bots need: zone a lot, fast-forward
sim time, teleport, read the player's state and parcels. Keep them behind the existing
`?capture=1` pattern, or behind `navigator.webdriver`, so players never see them.

| Pillar | Bot | Pass when |
|---|---|---|
| Build it, live in it | zone a lot `com`, fast-forward until LOW, teleport beside its door, walk in | `isIndoors` becomes true. **Today this fails, and the scorecard must say so honestly.** If no door API exists, report ❌ with the reason "no door on zoned buildings" |
| The city lives | snapshot the parcels, economy, NPC and car positions; idle 120 s of sim time; snapshot again | ≥ 1 parcel stage or progress changed, and ≥ 50% of NPCs moved more than 5 m |
| Every tool is expressive | fire the hack (`__game.hack()`); compare street lamp/blackout state before and after | the zone's lights state changed |
| Consequence fits the act | the same hack: measure how far its effect reaches | the effect stays inside one zone, not city-wide |
| The player feels capable | walk the player along every avenue edge in `world.js` `EDGES` (teleport to the start, hold forward toward the end, 20 s cap per edge); drive one loop in a car if a car probe exists | reached ≥ 95% of edge ends; zero frames with the camera inside a building footprint (use the footprints `check_overlap.mjs` reads) |
| Beauty in the system | run `npm run lint` and count warnings; count functions over 60 lines in `src/` | lint errors = 0; report the counts |

Contact-sheet poses: the `street`, `city` and `day` poses that `shot.mjs` docs/shots use,
one per seed.

## Finish lines

- `npm run build && npm run scorecard` completes in under 6 minutes on this Mac and
  writes all the files above. Report `latest.md` in full.
- Every row has a real measured number, not a placeholder.
- `GATE_PORT=4573 npm run gate` is fully green, and `draws:` is unchanged.
- `docs/scorecard/README.md` explains each bot in 2 lines each.

## Do not

Do not change gameplay, rendering, the city generation or interiors. Other workers own
those; you only add probes and scripts. Do not commit, push, stash or check out. Do not
open or judge PNGs. At the end, report: the files changed, the full `latest.md`, and
anything you could not do.
