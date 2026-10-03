# M17 — On foot

From: `docs/plan/features/mechanics.md` GAP-04-001 to GAP-04-021 (GAP-04-005 is M14-5's,
GAP-04-006 is M16-16's) and GAP-01-055; `docs/plan/CAPABILITIES.md` G1's stamina, G2's
climb and vault, G24's ragdolls, G30 and G31; the BACKLOG's verticality (rooftops, lifts).
When it closes, the player moves through the city as in the three street games: first
person or third, climbing, vaulting and free-running over it, up to its roofs by stairs
and lifts, off them by parachute, under its water with a breath to hold, and down hard
when they fall. Pillars: live in it; every tool is expressive.

Needs first: M10-5 (swimming), M10-9 (jump), M13-1 (health), M13-16 (stealth), M2's
person and its baked clips, M4-3 (terrain), M33's interiors for stairs. Lane: street.

## Keys

On foot (rebindable on M7.T11's screen):

- **V** switches first and third person on foot; in a car it cycles M18-5's four views, first person among them.
- **Space** jumps (M10-9); at a ledge or obstacle up to 2.2 m it climbs or vaults; while
  running into a wall within 1 m it kicks off the wall for a second jump; **held for
  0.5 s** before release it jumps 1.5 times as high.
- **Shift held** runs (built); running with Shift held also free-runs over low cars,
  rails and walls without a key.
- **C** crouches (M13); **C while running** slides 3 m; **C in water** dives.
- **In the air:** **Space** opens the parachute; **Space** again cuts it away. W, A, S and
  D steer.
- **E** sits on a bench, chair or stool in front (E uses what is in front).
- Cheats are numbers dialled on M27's phone.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M17-1 | **First person:** V switches the camera to the player's eyes within 0.2 s on foot, and in any car it is one of the views V cycles (M18-5), with the car's dashboard and mirrors drawn, at most 1 more draw; V again returns to the follow camera. The setting for each mode (on foot, in a car) is kept. Head bob is a setting (off, low, full). Scoped aim (M13-2) uses this view. The player's own arms and weapon are drawn, never the inside of their head | `tests/accept/m17-firstperson.spec.js` | red: one follow camera (`src/main.js`) | GAP-05-038 |
| M17-2 | **Climb and vault:** running at an obstacle 0.5-1.2 m high and pressing Space vaults it in 0.6 s; a ledge up to 2.2 m is climbed in 1.2 s; fences and railings are hopped. Ladders and drainpipes on the back walls of buildings (placed from the map, one in three buildings) are climbed with W and S. Ground steeper than 35° is clambered at half speed. An open window in a lit flat is entered (M33's interiors). At a ledge, S drops the player to hang and lower | `tests/accept/m17-climb.spec.js` | red: Space does nothing until M10-9; no climb (searched "climb", "vault" in src: none) | GAP-04-009 |
| M17-3 | **Free running:** running with Shift over low cars, benches, rails and walls up to 1.2 m crosses them without slowing more than 20%; C while running slides 3 m under a gap 1 m high; the wall kick reaches a ledge 3.5 m up; the held jump reaches 1.5 times as high. A test route of 12 obstacles from the map is crossed in under 1.4 times the time it takes on flat road *(provisional)* | `tests/accept/m17-parkour.spec.js` | red | GAP-04-018, GAP-04-019 |
| M17-4 | **Roofs:** every building of 4 floors or more has a reachable roof, by stairs in its lobby or by a lift: E at the lift's call button, a choice of floor, and the doors open on it in 3 s. Roofs of neighbouring buildings within 3 m and 1.5 m of height of each other are a route across the block. Roofs carry vents, water tanks and fences from the map's dressing, pooled | `tests/accept/m17-roofs.spec.js` | red: no roof is reachable | — |
| M17-5 | **Falls and bodies:** a fall of 4-8 m does 10-40 damage; 8-15 m knocks the player down and they limp for 10 s; over 15 m kills (M13-1). Into water from up to 40 m is no harm. The player and people fall as ragdolls when hit by a car above 20 km/h, a blast or a fall, and get up within 3 s if alive. Ragdolls cost no draws (the skinned people pool) | `tests/accept/m17-falls.spec.js` | red: no health, no fall (searched "fall" in `src/sim/player.js`: none) | GAP-04-001, GAP-04-011 |
| M17-6 | **Parachutes:** from a roof or the edge of a hill more than 30 m above the ground below, or from an aircraft (M18), the player falls free; Space opens the chute; WASD steer it at 6 m/s forward and turn at 60° a second; a landing faster than 6 m/s rolls. Space again cuts it away. A smoke trail colour and the bag's look are picked at a shop (M25). Skydiving from a helicopter or plane at 500 m falls free for at least 12 s. The canopy is one pooled draw | `tests/accept/m17-parachute.spec.js` | red: no parachute (G31: "out") | GAP-01-055 |
| M17-7 | **Jumps:** 10 parachute jumps per city, made from the seed's tallest towers, hills and the airfield (M16-11), each with rings to pass through and a landing target; gold, silver and bronze by rings and distance; a sponsor pays for each medal | `tests/m17-jumps.test.js` | red | — |
| M17-8 | **Under water:** C in water dives. A breath ring empties in 30 s and fills at the surface in 4 s; when it is empty, health drains at 10 a second until the surface or death (M13-1). The player can sink to the river or harbour bottom and walk on it. Weapons go away on entering water and come back on leaving. A rebreather from a dive shop (M22) gives 5 minutes. The water is tinted and murky below 2 m, with no more draws | `tests/accept/m17-underwater.spec.js` | red: M10-5 plans swimming at the surface only | GAP-04-002, GAP-04-004, GAP-04-007, GAP-04-008, GAP-04-010, GAP-04-012 |
| M17-9 | **Crouch and quiet steps:** crouched, the player moves at 1.6 m/s and their footsteps are heard to 3 m against 8 m walking and 15 m running (the noise M13-16's guards hear). Soft-soled shoes (worn gear, M25) halve each radius | `tests/m17-noise.test.js`, `tests/accept/m17-crouch.spec.js` | red: no crouch, no noise | GAP-04-003, GAP-04-020 |
| M17-10 | **Stamina:** running drains a stamina bar in 20 s; with it empty the player cannot run; walking refills it in 5 s. The bar shows under the minimap only when not full. M23's fitness raises it | `tests/accept/m17-stamina.spec.js` | red: Shift runs without limit (`sim/player.js:5-6`) | — |
| M17-11 | **Sitting:** E at a bench, chair, bar stool or low wall sits the player down; the camera eases out; the city goes on; any move key stands them up. People sit on benches too, from the walker pool | `tests/accept/m17-sit.spec.js` | red | GAP-04-021 |
| M17-12 | **Cheats:** numbers dialled on M27's phone turn on cheats; four here: super jump (jump 6 times as high), a drop from the sky (the player falls from 300 m with a parachute), a parachute at once, and a drunk walk (the player staggers for 60 s and the camera sways). A cheat turns off achievements (M29) until the next load, and the save says so | `tests/accept/m17-cheats.spec.js` | red | GAP-04-013, GAP-04-014, GAP-04-015, GAP-04-016 |
| M17-13 | **Clips:** every move in M17 plays a baked clip (vault, climb, ladder, hang, slide, wall kick, roll, freefall, chute, swim stroke, dive, sit, stagger, limp) on M2's person; no clip pops or slides more than 0.1 m against the ground | `tests/accept/m17-clips.spec.js` | red: M2 plans walk and run only | — |
| M17-14 | A saved game keeps the camera mode, stamina, any cheat's state and the player's place on a roof, ladder or under water, and continues the same | `tests/accept/m17-save.spec.js` | red | — |
| M17-15 | The sweep of every M17 move, at street level and from roofs, day and night, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M17.T1 | **Checks, red.** `m17-firstperson.spec.js`, `m17-climb.spec.js`, `m17-parkour.spec.js`, `m17-roofs.spec.js`, `m17-falls.spec.js`, `m17-parachute.spec.js`, `m17-jumps.test.js` | new `tests/accept/m17-firstperson.spec.js`, new `tests/accept/m17-climb.spec.js`, new `tests/accept/m17-parkour.spec.js`, new `tests/accept/m17-roofs.spec.js`, new `tests/accept/m17-falls.spec.js`, new `tests/accept/m17-parachute.spec.js`, new `tests/m17-jumps.test.js` | M10.T22 | M17-1 to M17-7 red | S |
| M17.T2 | **Checks, red.** `m17-underwater.spec.js`, `m17-noise.test.js`, `m17-crouch.spec.js`, `m17-stamina.spec.js`, `m17-sit.spec.js`, `m17-cheats.spec.js`, `m17-clips.spec.js`, `m17-save.spec.js` | new `tests/accept/m17-underwater.spec.js`, new `tests/m17-noise.test.js`, new `tests/accept/m17-crouch.spec.js`, new `tests/accept/m17-stamina.spec.js`, new `tests/accept/m17-sit.spec.js`, new `tests/accept/m17-cheats.spec.js`, new `tests/accept/m17-clips.spec.js`, new `tests/accept/m17-save.spec.js` | M17.T1 | M17-8 to M17-14 red | S |
| M17.T3 | **First-person camera.** V switches; eye height; arms and weapon drawn; head bob setting; one setting per mode | `src/game/camera.js`, `src/game/input.js`, `src/render/player.js`, `src/ui/settings.js` | M17.T1, M7.T11 | M17-1 (part) | M |
| M17.T4 | **The cockpit.** A dashboard and mirrors per car class from M2's pipeline, at 1 more draw | `src/render/traffic.js`, `public/assets/models/` | M17.T3, M2.T6 | M17-1 | M |
| M17.T5 | **Ledges, sim.** The map marks vaultable edges, climbable ledges, ladders, drainpipes and open windows; the player's move rules for vault, climb, hang, drop and steep ground | `src/sim/player.js`, new `src/sim/ledges.js`, `src/sim/collide.js`, `src/sim/dressing.js` | M17.T1, M10.T7 | M17-2 (part) | M |
| M17.T6 | **Ladders and pipes, drawn.** Ladders and drainpipes on back walls, pooled | `src/render/props.js`, `src/render/block.js` | M17.T5 | M17-2 | S |
| M17.T7 | **Free running.** Run-through vaults, the slide, the wall kick and the held jump | `src/sim/player.js`, `src/sim/ledges.js` | M17.T5 | M17-3 | M |
| M17.T8 | **Roofs.** Stairs and lifts to roofs of 4+ floors; the lift's floor choice; roof routes across the block; roof dressing pooled | `src/sim/interior.js`, `src/sim/ledges.js`, `src/sim/dressing.js`, `src/render/setdress.js` | M17.T5, M33.T3 | M17-4 | M |
| M17.T9 | **Falls and ragdolls.** Fall damage by height; water landings; ragdolls for the player and people on car hits, blasts and falls; getting up | `src/sim/player.js`, new `src/sim/ragdoll.js`, `src/render/npcs.js`, `src/render/player.js` | M17.T1, M13.T3 | M17-5 | M |
| M17.T10 | **Parachutes.** Freefall, opening, steering, landing, cutting away; skydiving from aircraft; the canopy draw; trail and bag from M25's shop | new `src/sim/parachute.js`, `src/sim/player.js`, new `src/render/parachute.js` | M17.T8, M18.T19 | M17-6 | M |
| M17.T11 | **Jumps.** Ten jumps from the seed's high points, rings and targets, medals and pay | new `src/sim/jumps.js`, `src/render/overlays.js` | M17.T10 | M17-7 | M |
| M17.T12 | **Under water.** Diving, the breath ring, drowning, walking the bottom, weapons away, the rebreather; murk below 2 m | `src/sim/player.js`, new `src/sim/breath.js`, `src/render/atmosphere.js`, `src/ui/hud.js` | M17.T2, M10.T12 | M17-8 | M |
| M17.T13 | **Crouch and noise.** Crouch speed and the three noise radii; soft soles | `src/sim/player.js`, `src/sim/stealth.js` | M17.T2, M13.T36 | M17-9 | S |
| M17.T14 | **Stamina.** The bar, its drain and refill, fitness from M23 | `src/sim/player.js`, `src/ui/hud.js` | M17.T2 | M17-10 | S |
| M17.T15 | **Sitting.** Seats from the map; E sits; people sit on benches | `src/sim/player.js`, `src/sim/walkers.js`, `src/sim/furniture.js` | M17.T2 | M17-11 | S |
| M17.T16 | **Cheats.** The cheat list and the dial-pad entry; the four on-foot cheats; achievements off and the save's mark | new `src/sim/cheats.js`, new `src/content/cheats.json`, `src/sim/save.js` | M17.T2, M27.T2 | M17-12 | M |
| M17.T17 | **Clips** (lane: assets). Fourteen clips baked onto M2's person | `tools/models/bake_vat.py`, `public/assets/models/` | M17.T2, M2.T9 | M17-13 | M |
| M17.T18 | **Save** keeps everything in M17-14 | `src/sim/save.js` | M17.T16 | M17-14 | S |
| M17.T19 | **Close.** The sweep of every M17 move; one commit per defect; the new keys in the hints | the sweep, `content/hints.json` | all of the above | M17-15 | M |

## Decisions for the operator

None.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M17-1 | GTA-01-019, GTA-02-015, GTA-18-019, GTA-18-020, GTA-18-021 |
| M17-2 | GTA-01-005, GTA-01-006, WD-06-005, WD-06-006, WD-06-007, WD-06-008, WD-06-012, WD-06-013, WD-06-016, CP-01-006, CP-01-007, CP-01-008, CP-01-027, CP-01-035 |
| M17-3 | CP-01-012, CP-01-013, CP-01-041 |
| M17-4 | CP-01-024, CP-01-038 |
| M17-5 | GTA-01-017 |
| M17-6 | GTA-03-020 to GTA-03-025, GTA-12-039 |
| M17-7 | GTA-10-011, GTA-10-073, GTA-16-020 |
| M17-10 | GTA-01-004, CP-15-002 |
