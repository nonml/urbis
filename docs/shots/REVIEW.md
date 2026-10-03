# Shot review log

Every shot is judged here before it counts as evidence (AGENTS.md, "How to work",
step 5). One entry per shot: the slice, the verdict, and each defect by id. Open
defects stay in the table at the bottom until a commit fixes them.

## 2026-10-03 — retro-review of slices 074–077: all FAIL

These shipped as "done" without a real review. The operator found the problems.

| Shot | Verdict | Defects |
|---|---|---|
| slice-074-newgame-s7-boot / -grown | FAIL | D1, D3, D10 |
| slice-075-chase-s7-tier3 | FAIL | D1, D2, D3, D5, D10 |
| slice-076-chase-s7-hack / -tier2 | FAIL | D1, D2, D3, D5, D10 |
| slice-077-freeland-s7-cityview | FAIL | D6, D7, D8, D9 |

074–076 are the same pose on the same spawn: four slices of one broken frame.

## 2026-10-03 — slice-078, a new game opens on a clear street

| Shot | Verdict | Defects |
|---|---|---|
| slice-078-clearview-s7-street | FAIL (D1 fixed) | D3, D4, D10 |
| slice-078-clearview-s7-day | FAIL (D1 fixed) | D3, D10 |

Shows the feature: yes, the avenue, crossing and shopfronts are visible where the
parked car's roof was. `frameCheck(2)` 0.177 → 0 on seeds 7 and 2.

## 2026-10-03 — slice-079, the ranges and the fields fit a generated city

| Shot | Verdict | Defects |
|---|---|---|
| slice-079-mountains-s7-west-day | PASS for D6; frame FAIL | D7 |
| slice-079-farmland-s7-se-day | PASS for the fields; frame FAIL | D7, D13 |
| slice-079-outskirts-s7-cityview | FAIL | D7, D8 |

Shows the feature: from the west end of the z = 38 street on seed 7, by day, the
range stands as a hazy ridge with a snow cap past the last block, not in the street;
5.6% of the frame is mountain. At night it is lost in the haze (mountain luma 0
against a sky of 4.6), which is what a night range does. Fields, fences and farm
houses lie past the skyline from the south-east corner, and in city view top right.
The first set of review poses stood the player at walk-box corners through
`__game.pose`, which skips collision: a pose inside a block put the camera in a
building. Review poses now come from walking, not from teleporting.

## 2026-10-03 — slice-080, the crew's eleven lanes brought in together

The operator brought every lane's uncommitted work onto main by hand and deleted the
worktrees; these shots are of that combined build.

| Shot | Verdict | Defects |
|---|---|---|
| slice-080-crew-s7-street / -s73-street | FAIL | D4, D5, D16 |
| slice-080-crew-s7-close | PASS for the player | D16 |
| slice-080-crew-s7-day | PASS for the player | D15, D16 |
| slice-080-crew-s7-city | PASS for D7; frame FAIL | D8 |
| slice-080-crew-s7-cityday | PASS for D7 | D8 |

Shows the feature: the player is a person from behind now: a rounded coat, a
backpack with soft edges, hands, a head on a neck, no boxes (D10 half fixed). The
outer towers lost the TV static for whole lit windows. As brought in, every tower
wore the same horizontal amber stripes, because a floor was lit end to end; in
review each window is lit on its own, from a staggered tile, and the city view now
reads as windows by night and pale facades by day. The skyline change also read
each ring tower's height as its depth, which put 18 phantom overlaps in
`check:overlap`; fixed in review. The cranes still sweep their jibs over streets in city view (D8),
and the night road still has the puddle shards and the hard-sided streaks (D4, D5:
the night-road lane built nothing).

## Defects

| Id | Defect | Where | Status |
|---|---|---|---|
| D1 | A parked car's roof fills 15% of a new game's opening frame, 1.4 m from the lens | seeds 2, 7: the kerb slot behind the spawn | **fixed** slice-078; gate checks 4 seeds |
| D2 | The chase shots have no police car in them; nothing in frame shows a chase | 075, 076 | open |
| D3 | A grey box with a yellow band hangs on a facade 10 m up | seed 7 spawn, right side; instanced box near (-11, 10–11.7, 8) | open, not yet identified |
| D4 | A hard-edged bright rectangle lies on the road under the player at night | seed 7 spawn, night | open |
| D5 | Puddle reflections break into scattered glass-like shards | 076 tier2, lower left | open |
| D6 | Mountains stand at fixed hand-map coordinates: a range rises inside the city on 127 of 300 seeds (94 m over the road on seed 73), and 99% of their slope is steeper than 55°, so they read as blue spikes | 077 city view, left; seed 73 street | **fixed** slice-079 (`m5-mountains`); `tests/landscape-place.spec.js`, 300 seeds |
| D7 | The outer towers are giant boxes with a TV-static window texture | 077 city view, right | **fixed** slice-080 (`m5-skyline` and review) |
| D8 | Crane jibs reach out over neighbouring roofs and off their lot | 077 city view | open |
| D9 | The free land the slice added cannot be picked out in its own shot | 077 city view | open |
| D10 | The player and the hero car are raw boxes | every street shot | player **fixed** slice-080; the hero car is D16 |
| D11 | The farmland and farm tracks stood at hand-map coordinates on every generated city | outskirts.js `BANDS`, `LANES` | **fixed** slice-079 (`m5-farmland`, `m5-farm-tracks`); `tests/outskirts-place.spec.js`, `outskirts-lanes.spec.js` |
| D12 | Two story boards (`lot_arden`, `lot_trust`) overflow the sign atlas and print an error on every boot, beside a 404 | src/render/arc.js `packSigns`; no favicon | **fixed** slice-080 (`m5-boot-clean`); `tests/boot-clean.spec.js`, 4 boots |
| D13 | Between the last street and the fields the ground is a bare, flat, untextured plane | slice-079-farmland-s7-se-day, foreground | open; `m5-grass` greens the first 24 m |
| D14 | The verges, pocket park and tufts stand at hand-map coordinates: on all 300 seeds grass lies across a street (826 m² on seed 73, where the z = 9 crossing runs into a lawn) | landscape.js `buildGrassGround`, `TUFT_RECTS` | **fixed** slice-080 (`m5-grass`); `tests/grass-place.spec.js`, 301 seeds |
| D15 | By day, looking down a street toward the sun, the wet road reads as brushed steel | seed 73, (46, 9) facing east | open |
| D16 | The hero car beside the spawn is still a slab with a cabin on it: the car-body lane changed the traffic, not the car the player stands next to | slice-080 street shots, right of the player | open |
