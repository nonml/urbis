# Feature: every New Game is a whole, clean, different city

Written 2026-10-02 by Claude, game director. You own this whole feature. Work like a
developer: read, build, measure, fix, and repeat as many times as you need. Stop only
when every finish line is met, or when you are truly blocked.

Read `AGENTS.md` (all of it), `docs/ROADMAP.md` and `docs/PROCGEN.md`. Then read
`src/sim/citygen.js`, `src/sim/world.js`, `src/sim/seedstore.js`, `src/boot.js` and
`src/sim/landmarks.js`, plus `scripts/check_overlap.mjs` and
`scripts/check_layouts.mjs`.

## Where it stands

`?gen=1&seed=N` boots a generated road layout. Everything placed **on** it is still
tuned to the old hand map, and the meter shows it:

```
npm run check:layouts   (seeds 1–10)
total: overlap 254, road 238
```

## The outcome

Any seed gives a city where nothing overlaps, nothing stands on a road, the streets
are lined, the lots sit in real blocks, and the doors, signs and spots the game uses
exist on real buildings. A real player's New Game (not `navigator.webdriver`)
generates by default.

The debt to pay, as far as known. Find the rest with the meter.

- `LOTS` (`src/sim/zoning.js`): derive the lots from the blocks between roads and
  the seed. Keep about the same count, at least 6, with a mix of sizes and uses' room.
- The street wall (`ROW_RUNS`, `KEEP_OUT` in `src/render/block.js`, plus the copies in
  the checker), the south row and the terminus caps (`SOUTH_TOWERS`,
  `TERMINUS_TOWERS`), and `DISTRICT_RELIEF` (`world.js`). Two smaller workers may
  have landed derivations of these already (`git log`); build on them.
- Code that destructures `const [MAIN_X, EAST_X, WEST_X] = AVENUE_X` or keys on
  crossing order (`street.js`, `lamps.js`, `block.js` and others; grep `AVENUE_X\[`
  and `CROSSINGS\[`). Make it work for 2–4 avenues and 1–3 crossings.
- `PINNED_TOWERS` (`landmarks.js`): choose host towers by a rule over the generated
  street wall.
- `src/content/signs.json`, mission spots (`src/sim/mission.js`, `arc.js`) and spawn
  points: attach them to generated buildings and roads by rule. A thing whose host is
  missing is skipped. It never crashes.
- Walk/drive bounds and the outskirts/landscape around the district.

## Finish lines (all must hold)

1. `check:layouts` takes `--from A --to B`. Over seeds 1–20 it prints
   `total: overlap 0, road R` where R counts only vista caps deliberately standing on
   avenue ends past the play area. Report R, and keep it ≤ 4 per seed.
2. Every seed's worst street-wall row is ≥ 90% frontage. Make the checker compute
   frontage from the same derivation the game uses, not a copy.
3. A browser test boots `?gen=1&seed=N` for N = 1…5. Each asserts no page error and
   draws ≤ 175, and prints `gen seed N draws: D / 175`.
4. `src/boot.js`: `GENERATE` defaults to **true** for real players (no `?seed`, not
   webdriver). `?gen=0` forces the hand layout. Automated runs stay on the hand
   layout unless `?gen=1`, so existing tests keep their numbers.
5. `npm run check:overlap` (the hand layout) is unchanged or better.
   `GATE_PORT=4573 npm run gate` is fully green.
6. Evidence: `npm run build`, then `scripts/shot.mjs` with `SHOT_PORT=4591`, prefix
   `docs/shots/slice-062-newcity-sN`, a `city` pose, for N = 1, 2, 3. Pass `?gen=1&seed=N`
   the way `shot.mjs` accepts extra query (read it). Report the draw lines. Do not
   open or judge the PNGs.

## Do not

Do not touch interiors' content (`interiorsets.js`, `interiorkit.js`), saves
(`save.js`) or the scorecard scripts, because other workers own those. Do not commit,
push, stash or check out. At the end, report: the files changed, every finish line
with its number, and anything you could not do.

## Unfinished work you may reuse

Two smaller workers were stopped mid-way. Their uncommitted diffs are still there:
`git -C ../urbis-wt-streetwall diff` (street-wall gaps from world data, plus
`src/sim/streetwall.js` if present) and `git -C ../urbis-wt-vistas diff` (south row,
terminus and relief derived, plus a relief check). Read them, take what is sound, and
check it yourself. Neither was verified.
