# Shot review log

Every shot is judged here before it counts as evidence (AGENTS.md, "How to work",
step 5). One entry per shot: the slice, the verdict, and each defect by id. Open
defects stay in the table at the bottom until a commit fixes them.

## 2026-10-07 — M2.F2e, the player stands on both feet (`m2-0-person`)

`docs/shots/m2-0-person.png`, the hand map street pose at the spawn, day (key t),
same camera as M2.F2d. Reviewed against the F2d shot and a 200x300 crop of the player:

- **Shows the feature.** Centre frame, from behind: the legs now stand apart with a
  visible gap between the trouser legs, the feet are flat and planted at a stance
  width, and the jacket hem meets the trousers with no pinched dark blob at the
  crotch. The hands hang compact, fingers together down the sides — no splayed fan.
  Measured at bake (`make_person.py`): ankle separation 0.267 m (0.2-0.3 asked),
  both soles heel +0.009 m / toe +0.000 m over the ground. The walk clip is unchanged.
- **Clear view.** `__game.frameCheck()` blocked 0 — nothing but the player within
  2 m of the lens. The player fills the centre; the white car ahead sits behind.
- **Nothing broken.** Legs are straight, the pelvis level, no floating or
  intersecting parts in the crop. Draws unchanged: 153 now, peak 153 (the pose
  re-keys the same skinned mesh, so no cost).
- **Toy or neon?** The baked MPFB person, one mesh, one material; no raw primitives
  added and no neon.
- **Readable.** A player sees a person standing relaxed on the pavement, not
  mid-step and not on their toes.

Open defects in frame, not this slice's: **D16** the hero car's slab (mid-frame).

## 2026-10-06 — M1.T4/M1.T2 evidence, re-shot on the plan's five seeds

`tests/accept/m1-zone-shows.spec.js` (M1-1) re-ran on seeds 7, 11, 22, 33, 73 and
wrote `docs/shots/m1-zone-<seed>-before/after.png` for each. Seed 7's pair was
reviewed: before, the free lot's LAND FOR SALE board fills the frame; after, the
board is gone and the lot stands with its first floor inside the 60 game second
bar. PASS. The same test asserts the click zoned the lot and the height is > 0 on
every seed, and the run passed all five. The old seeds 1-5 shots are removed: the
criterion's five seeds are the plan's own.

## 2026-10-06 — M2.T17, weather drawn (6 shots)

`tests/accept/m2-weather.spec.js` on seed 1 at the spawn: clear, overcast and rain,
each by day and night (`docs/shots/m2-weather-<state>-<day|night>.png`). Judged:

- **Rain shows the feature.** Day and night the road is dark and wet with the
  streetlight smeared across it; clear and overcast roads stay dry. PASS.
- **Overcast vs clear is drawn and measured, but weak on the eye at this pose.**
  The spec reads the clear day's blue sky cells losing 15+ levels of blue in
  overcast and rain, >5% of the 48x27 grid changed, and the sun disc gone; at the
  spawn the sky is a sliver between towers, so a player looking only at the still
  would struggle to name clear against overcast. Logged as D19 (open).
- Known open defects in frame: **D5** puddle shards (rain, lower left, day and
  night) and **D16** the hero car's raw slab (centre). Both belong to M2's list.
- No neon; no new draws (the spec measures overcast = clear, rain = clear + 1).

## 2026-10-04 — M1.T6, first-minutes sweep (50 shots)

`SWEEP_PORT=6291 node scripts/sweep.mjs --poses docs/shots/poses/first-minutes.json`
on seeds 7, 11, 22, 33, 73 (generated): 50 shots, 5.5 min of the 10 min budget,
0 page errors, worst peak 141 of 175, `blocked` 0.0% everywhere. 45 shots are
flagged for raw-primitive cells only (M2 owns those). The draft with every pick
report is `docs/shots/REVIEW-first-minutes.md` and `docs/shots/picks/m1-sweep-*.json`.

Fixed in the M1.T6 working tree:

- **D3** — the grey box on the facade is the jib of the site crane on the parcel
  at (-6.25, 7.47) on seed 7. The crane zoning from `f690cc8` already leaves
  every boom clear (`__game.cranes()`: jib 9 m, `clear: true`) and the mast is
  drawn from the ground to the mast top, so the jib no longer floats. The pick
  at the reported spot now lands on that jib, not on a detached box.
- **D4** — the bright rectangle at night was a fleet car's headlight glow at
  the lens plus the hard-sided sign/lamp streaks. The glow takes the same
  near-camera fade as the throw, the throw's near edge fades to zero, and the
  streak texture fades its two long sides (`traffic.js`, `streaks.js`). No pick
  in the 50 final reports hits the `#cfe6ff` plane that named the defect.
- **D17** — on seeds 7 and 22 a west heading at the spawn opened the follow
  camera inside the block east of the avenue (144/144 picked cells at 0 m,
  centre pixel pure black). The camera now pulls out of the street wall's
  footprints and steps over obstacles under 1.4 m (`game/camera.js`,
  `block.js` carries each footprint's height); west now has 0 cells at 0 m on
  both seeds, and the shot shows the street.
- **D18** — the HUD panels all anchored to the same two corners: news covered
  the mission panel end to end, and the city palette sat under the district
  table, lot note and story dialogue. The bottom-left column re-stacks what is
  visible on the 4 Hz HUD tick (city palette, district table, lot note, police
  radio, story dialogue) and the mission panel sits under the news
  (`game/hud.js`): measured 0 overlapping panel pairs in the city view (was 4).

Still open, and not this task's: D5 (puddle shards), D8 (cranes over neighbours
in city view), D15 (wet road by day), D16 (the hero car is a raw slab).
Raw-primitive cells in the picks are M2's list, not defects here.

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
| D3 | A grey box with a yellow band hangs on a facade 10 m up | seed 7 spawn, right side; instanced box near (-11, 10–11.7, 8) | **fixed** `f690cc8` crane zoning; identified M1.T6 as the parcel's jib, mast drawn |
| D4 | A hard-edged bright rectangle lies on the road under the player at night | seed 7 spawn, night | **fixed** M1.T6: glow near-camera fade, throw near fade, streak side fade |
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
| D17 | A west heading at the spawn opened the follow camera inside the block east of the avenue: 144/144 picked cells at 0 m, centre pixel pure black | seeds 7 and 22, spawn, day and night | **fixed** M1.T6 (`game/camera.js` pulls the arm out of the street wall); 0 cells at 0 m on both seeds |
| D18 | HUD panels overlap each other's text: news covered the mission panel end to end and the city palette sat under the district table, lot note and story dialogue | city view, seed 7 | **fixed** M1.T6 (`game/hud.js` stacks the bottom-left column and sets the mission panel under the news; measured 0 overlapping pairs) |
| D19 | At the spawn pose the clear and overcast day shots are hard to tell apart on the eye: towers occlude the sky, and the sun's dimming shows mostly in the distant haze | M2-7 shots, `docs/shots/m2-weather-clear-day.png` / `-overcast-day.png` | open; measured in the frame (sky cells, 15+ levels), weak in the still. M2/M26 weather look |
| D20 | Seven of seed 7's 31 legacy street-wall rows stand in the 30 m water rect and its 8 m setback (e.g. (-6.3, 21.2), 31 m tall, north face z = 12.9 inside the river); from the seeded spawn the wall hides the river from the city view and from a pick, and a row's shell rises out of the water | seed 7, city view over (-18.5, 0.8); pick at (-3.5, 0) hits a row | open; sim placement (layout.js/map.js) debt, M4.T15 removes the spans at source. The river itself is carved and drawn correctly (`displaceToTerrain` drops every ground surface in a water rect to WATER_BED), and the check's deck-clear probe no longer lands on a row |
| D21 | Seed 7's river probe `near.x + 15` = (-3.5, 0) lay on the **next** bridge: art-ns1 crosses the same 30 m river at x = 0 with a 3.9 m half-deck, so pick #1 was `bridge` and the water 1 cm under it. The two in-town bridges are 18.5 m apart; the check assumed one bridge per ~600 m | `tests/accept/m4-river-look.spec.js:43`, seed 7 | **fixed** main `97c226b`: the probe picks the candidate 8/15/30 m off the bridge with the largest gap to every deck (seed 7: (-48.5, 0.75), 30 m clear) |
| D22 | Seed 7's deck probe (-18.5, 0.8) lay behind a transparent white glow quad (`MeshBasicMaterial`, `see: true`, equal distance): pick #1 was the quad, the deck #2 | `tests/accept/m4-river-look.spec.js:49`, seed 7 | **fixed** main `97c226b`: `pickAt` filters see-through hits (glow, rain), as `m3-render.spec.js` does |
