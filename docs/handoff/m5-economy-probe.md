# The economy probe: measure the market before anyone rebalances it

Written 2026-10-03 by Claude, game director. Read `AGENTS.md` first, then
`docs/ROADMAP.md` "Next session: the economy rework", step 1. You own this step end to
end. You only measure: no gameplay constants change in this task.

## Why

The city's demand is bang-bang: one finished lot or one firm moving swings demand by
0.2–0.45 (`GAP_GAIN = 3` in `src/sim/economy.js`), so each use is pinned at the top or
idle most of the time, and zoning free land grows homes about as much as leaving it
alone. Nobody can rebalance that honestly without a meter. Build the meter.

## The outcome

`node scripts/economy-probe.mjs [--seeds 1-12] [--minutes 10]` runs in plain Node (it
imports `src/sim/` only: no browser, no three.js), and for each seed builds the city the
way a new game does (read how `src/main.js` and `src/sim/newgame.js` create the street
and the city from a generated seed), ticks it in the frame loop's 0.05 s steps
(`tickStreet` then `tickZoning`, like `__game.advance`), and reports:

1. **Demand states:** for each use, the share of sampled time it is *idle*, *in the hold
   band*, or *pinned*. Take the band edges and the pinned threshold from the constants in
   `src/sim/zoning.js` and `src/sim/economy.js`; quote which ones you used. Never invent
   thresholds.
2. **A/B gains:** run the same seed twice, untouched (A) and poked once at minute 1 (B),
   for three pokes: a blackout hack, a police chase (the economy's chase hook,
   `chaseIn`/`scare`, read `tests/economy-chase.spec.js`), and zoning both free lots of
   a district for works. Report B minus A, at minutes 2, 5 and 10, in finished floors,
   jobs and homes per district.
3. **Speed:** how long a newly zoned lot takes to show its first floor, and to reach
   low-rise.

It writes `docs/ECONOMY-PROBE.md`: one table per section, one row per seed, plus a
median row, and two lines on how to read each table.

## Finish lines

- The probe runs 12 seeds × 10 minutes in under 3 minutes on this Mac (report the time).
- Run it twice: the two outputs are identical (determinism; report that you checked).
- Every number in `docs/ECONOMY-PROBE.md` comes from a run, none from a formula.
- `GATE_PORT=<yours> npm run gate` fully green, and `draws:` unchanged.

## Do not

Do not change any file under `src/` except to export a function the probe needs
(then say which and why). Do not commit, push, stash or check out.
