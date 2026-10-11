# M34 — The look, finished

From: `docs/VISUAL-GAP-ACTIONS.md`, every item not marked done (73 of 84: 23 partial,
50 open; the ten marked ✅ stay closed, and VGA-084 is M2). M2 makes the
city look right at the play camera; the street and city milestones after it add people,
cars, weather, places and screens. M34 goes back through every visual gap and closes it
by the file's own rule: **done means evidence shot at the normal play camera**, judged in
`docs/shots/REVIEW.md`, with the frame at or under 175 draws. Where another milestone
built the thing (M26's storms, M27's HUD, M33's interiors), M34 closes the item with its
evidence or finds what is still missing. Pillar: the look (grounded modern, never neon,
never toy boxes).

Needs first: M2 (the look), M13 (combat), M18 (vehicles), M19 (police), M20 (hacking),
M26 (weather), M27 (HUD), M33 (places and interiors). Lane: look.

## Keys

None new.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M34-1 | **Wet streets:** VGA-006 (oil rainbows and water in the joints read at play distance, as texture or shader on the mirror) and VGA-010 (lightning is the only light that reaches a dead zone's mirror street, from M26-1's storms) are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: both partial | — |
| M34-2 | **People:** VGA-011 body v2, VGA-012 fashion and accessories read at play distance, VGA-013 night readability, VGA-014 poses and tableaus (sit, lean, smoke, argue, queue, busk; a deal, an arrest), VGA-015 rain silhouettes (umbrellas, hoods, sheltering), VGA-016 hands that carry things (phones, parcels, goods, instruments, laptops), VGA-017 drivers in cars and police on foot, VGA-018 crowds at markets and crossings, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-011, -012, -013 and -018 partial | — |
| M34-3 | **Cars:** VGA-019 body variants, VGA-020 close-up detail, VGA-021 paint under sign and street light, VGA-022 the police build (push bar, livery, spotlight, red and blue thrown on the street and facades), VGA-023 lights that show intent (brakes flare), VGA-024 cabins, drivers and wipers in rain, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-019 to -021 partial | — |
| M34-4 | **Crashes:** VGA-025 impact theatre (dents, glass, sparks, debris that stays) and VGA-026 the camera's impact language (a shake and a pause scaled to the hit) are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | red | — |
| M34-5 | **Streets:** VGA-027 intersections complete, VGA-028 road wear, VGA-029 paving with an identity per district, VGA-030 the civic furniture set, VGA-031 commerce clutter, VGA-032 paper on walls, VGA-033 grime and litter, VGA-034 transit's identity (stops, signs, shelters), VGA-035 construction sites, VGA-036 pole hardware, VGA-037 street art, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-027, -030 and -032 partial | — |
| M34-6 | **Buildings** (the core of VGA-039 and VGA-041, facade systems by district kind, moved forward to M4.T19 on 2026-10-11): VGA-038 the podium's program, VGA-039 windows v2, VGA-040 the daylight facade balance, VGA-041 second and third skins (balconies, fire escapes, AC units), VGA-042 rooftop furniture, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-038 and -041 partial | — |
| M34-7 | **Signs:** VGA-043 shopfronts that live (staff, goods, open and closed), VGA-044 animated signs, VGA-045 signs in rain and mist (halo and drip), are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-043 and -044 partial | — |
| M34-8 | **Nature:** VGA-046 trees v2, VGA-047 grass v2, VGA-048 mountains v2, VGA-049 the river v2, VGA-050 no seams where ground, water and roads meet, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-046 partial | — |
| M34-9 | **Sky:** VGA-051 the storm's life (build, peak, clear), VGA-052 a living sky (clouds that move and light), VGA-053 golden and blue hour, VGA-054 the horizon's promise, VGA-055 weather in the valley, are done, on M26's weather | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-054 partial | — |
| M34-10 | **Water and fire:** VGA-056 splashes (feet, tyres, falls), VGA-057 drains that take the water, VGA-058 steam from vents and manholes, VGA-059 barrel fires, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-058 partial | — |
| M34-11 | **The camera:** VGA-060 collision and awareness (it never clips into a wall or loses the player) and VGA-061 speed and impact language (field of view and shake with speed) are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | red | — |
| M34-12 | **The HUD:** VGA-062 a real HUD and minimap, VGA-063 each tool's identity, VGA-064 the profiler's dossier v2, VGA-065 wayfinding for jobs, VGA-066 the heat and busted screens' language, are done, on M27's HUD | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | red | — |
| M34-13 | **The hero:** VGA-067 the back the player stares at (shape, cloth, motion and the light on it) is done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial | — |
| M34-14 | **Police:** VGA-068 the search's language (torches, the ring, officers looking) and VGA-069 roadblock theatre are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | red | — |
| M34-15 | **Hacking:** VGA-070 hackable things show they are, VGA-071 the overlay layer (grounded: what a phone's screen would show, no holograms), VGA-072 gags with theatre, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-072 partial | — |
| M34-16 | **Life dressing:** VGA-073 market density, VGA-074 alleys as places, VGA-075 each district's identity, VGA-076 job and secret objects, VGA-077 gangs' paint and colours, VGA-078 interiors and height, VGA-079 parks and promenades furnished, are done | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-075 partial | — |
| M34-17 | **Grade:** VGA-081 depth and lens and VGA-082 light discipline are done, and the operator judges the grade on the FX shots (the one thing a headless shot cannot judge) | `tests/accept/m34-shots.spec.js`, `docs/shots/REVIEW.md` | partial: VGA-082 partial | — |
| M34-18 | **The budget after all of it:** the busiest pose holds 175 draws and M7-6's 60 fps on this Mac with every M34 item in | the ledger, `scripts/fps.mjs` | — | — |
| M34-19 | The sweep of every district at dawn, noon, dusk and night in each weather, on five seeds, has 0 open defects, and `VISUAL-GAP-ACTIONS.md` has no item left open | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M34.T1 | **Checks, red.** `m34-shots.spec.js` shoots every item's evidence pose from `docs/shots/vga-poses.json` at the play camera and runs the frame probes | new `tests/accept/m34-shots.spec.js`, new `docs/shots/vga-poses.json` | M2 | M34-1 to M34-17 red | S |
| M34.T2 | **Wet streets.** VGA-006 and VGA-010 | `src/render/rain.js`, `src/render/streaks.js`, `src/render/materials.js` | M34.T1, M26.T3 | M34-1 | M |
| M34.T3 | **People, bodies and clothes.** VGA-011, -012, -013 | `src/render/npcs.js`, `tools/models/make_person.py` | M34.T1, M25.T3 | M34-2 (part) | M |
| M34.T4 | **People, life.** VGA-014 to -018 | `src/render/npcs.js`, `src/sim/street.js`, `src/render/traffic.js`, `src/render/police.js` | M34.T3 | M34-2 | M |
| M34.T5 | **Cars.** VGA-019 to -024 | `src/render/traffic.js`, `src/render/policekit.js`, `src/render/lamps.js` | M34.T1, M18.T5, M18.T13 | M34-3 | M |
| M34.T6 | **Crashes and the camera.** VGA-025, -026, -060, -061 | new `src/render/impacts.js`, `src/game/camera.js` | M34.T1, M10.T8 | M34-4, M34-11 | M |
| M34.T7 | **Streets, the ground.** VGA-027 to -029, -033 | `src/render/block.js`, `src/render/materials.js`, `src/render/setdress.js` | M34.T1 | M34-5 (part) | M |
| M34.T8 | **Streets, the furniture.** VGA-030 to -032, -034 to -037 | `src/render/props.js`, `src/render/setdress.js`, `src/render/signs.js` | M34.T7 | M34-5 | M |
| M34.T9 | **Buildings.** VGA-038 to -042 | `src/render/block.js`, `src/render/chunks.js` | M34.T1 | M34-6 | M |
| M34.T10 | **Signs.** VGA-043 to -045 | `src/render/signs.js`, `src/render/interior.js` | M34.T9 | M34-7 | M |
| M34.T11 | **Nature.** VGA-046 to -050 | `src/render/landscape.js`, `src/render/outskirts.js`, `src/render/river.js` | M34.T1, M26.T7 | M34-8 | M |
| M34.T12 | **Sky.** VGA-051 to -055 | `src/render/atmosphere.js`, `src/render/rain.js` | M34.T1, M26.T3 | M34-9 | M |
| M34.T13 | **Water and fire.** VGA-056 to -059 | `src/render/rain.js`, new `src/render/splashes.js`, `src/render/smoke.js` | M34.T12 | M34-10 | M |
| M34.T14 | **The HUD and the hero.** VGA-062 to -067 | `src/game/hud.js`, `src/ui/minimap.js`, `src/render/profiler.js`, `src/render/player.js` | M34.T1, M27.T10, M27.T12 | M34-12, M34-13 | M |
| M34.T15 | **Police and hacking.** VGA-068 to -072 | `src/render/police.js`, `src/render/hackfx.js` | M34.T1, M19.T4, M20.T5 | M34-14, M34-15 | M |
| M34.T16 | **Life dressing.** VGA-073 to -079 | `src/render/setdress.js`, `src/render/props.js`, `src/render/interiorsets.js` | M34.T1, M33.T5, M33.T3 | M34-16 | M |
| M34.T17 | **Grade.** VGA-081, -082; the operator's judgement on the FX shots | `src/render/atmosphere.js`, `src/render/lamps.js`, `docs/shots/REVIEW.md` | M34.T16 | M34-17 | M |
| M34.T18 | **Close.** The budget at the busiest pose (M34-18); the sweep of every district, hour and weather; `VISUAL-GAP-ACTIONS.md` updated item by item; one commit per defect | the sweep, the ledger, `scripts/fps.mjs`, `docs/VISUAL-GAP-ACTIONS.md` | all of the above | M34-18, M34-19 | M |

## Decisions for the operator

- **The grade** (M34-17): the operator judges the FX shots, as `REVIEW.md` records.
