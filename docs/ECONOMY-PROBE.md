# The economy probe

`node scripts/economy-probe.mjs --seeds 1-2 --minutes 10` ran the
pure sim the way `src/main.js` runs it — generated city from the seed, 50 ms steps,
`tickStreet` then `tickZoning` — in plain Node. 2 seeds x 10 minutes.
This is a meter only: no gameplay constant was changed.

**Thresholds, quoted from the shipped sim (never invented).** Demand buckets use
`DECLINE_AT = 0.28` and `BREAK_GROUND_AT = 0.55` from
`src/sim/zoning.js`: **idle** is demand below `DECLINE_AT` (the district sheds the
use); **in band** is `DECLINE_AT` up to `BREAK_GROUND_AT` (a lot holds, no new land
breaks); **pinned** is `BREAK_GROUND_AT` and above (over-subscribed, always building).
Floors are `Math.floor(builtHeight / STOREY)`, `STOREY = 3.5`. The market
constants are `BALANCED = 0.36`, `GAP_GAIN = 3`,
`FIRMS_USUAL = 0.12`, `MARKET_LAG_SECS = 20` in
`src/sim/economy.js`. Each district is a power zone; the city has two.

## 1. Demand states

Read each cell as the share of sampled ticks the district's demand for that use
spent in that bucket, both districts pooled over the seed's 10-minute baseline
run (untouched). A "pinned" column near 100 means the use is pinned high all the
time; a large "idle" plus large "pinned" with a near-empty band is the bang-bang the
rework has to fix.

| seed | res idle% | res band% | res pinned% | com idle% | com band% | com pinned% | ind idle% | ind band% | ind pinned% |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 9.6 | 64.3 | 26.2 | 0.0 | 11.9 | 88.1 | 19.8 | 44.4 | 35.8 |
| 2 | 0.0 | 10.5 | 89.5 | 16.3 | 47.3 | 36.4 | 9.7 | 35.8 | 54.5 |
| median | 4.8 | 37.4 | 57.8 | 8.2 | 29.6 | 62.3 | 14.7 | 40.1 | 45.2 |

## 2. A/B gains

Each poke lands once at minute 1 on the busier of the two districts (the `zone`
column). B is the same seed as A, re-run with the poke; every cell is **B minus A**,
in whole units, at minutes 2, 5 and 10, for the poked district. The three pokes:
a blackout hack (`H`), a 30 s police chase at tier 2 (`chaseIn`), and rezoning both
free lots of the district for works (`zoneParcel(..., 'ind')`). The district the poke
never touched is unchanged in every run (largest |delta| measured: 0).

### 2a. Blackout hack

| seed | zone | floors@2 | floors@5 | floors@10 | jobs@2 | jobs@5 | jobs@10 | homes@2 | homes@5 | homes@10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | z1 | -3 | 0 | 0 | -15 | -2 | 1 | -9 | -5 | 0 |
| 2 | z1 | -14 | -24 | 2 | -79 | -126 | 16 | -1 | -17 | 0 |
| median | — | -8.5 | -12 | 1 | -47 | -64 | 8.5 | -5 | -11 | 0 |

### 2b. Police chase (60-90 s, tier 2)

| seed | zone | floors@2 | floors@5 | floors@10 | jobs@2 | jobs@5 | jobs@10 | homes@2 | homes@5 | homes@10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | z1 | 0 | 0 | 0 | -1 | 0 | 0 | 0 | 0 | 0 |
| 2 | z1 | 0 | -22 | 2 | 0 | -122 | 18 | 0 | 0 | 0 |
| median | — | 0 | -11 | 1 | -0.5 | -61 | 9 | 0 | 0 | 0 |

### 2c. Rezone both free lots to works

| seed | zone | floors@2 | floors@5 | floors@10 | jobs@2 | jobs@5 | jobs@10 | homes@2 | homes@5 | homes@10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | z1 | 0 | 2 | -1 | 0 | 13 | -7 | 0 | 0 | 0 |
| 2 | z1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| median | — | 0 | 1 | -0.5 | 0 | 6.5 | -3.5 | 0 | 0 | 0 |

## 3. Speed of a newly zoned lot

From the minute-1 rezone in 2c: seconds until the lot shows its first floor
(`builtHeight > 0`) and until it reaches low-rise (`stage >= LOW`). Median of the
district's free lots; `>600` means it never got there in the run.

| seed | first floor (s) | low-rise (s) |
|---|---|---|
| 1 | 225.3 | 257.9 |
| 2 | >600 | >600 |
| median | 112.7 | 128.9 |
