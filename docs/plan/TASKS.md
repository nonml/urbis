# Tasks

The work behind `docs/ROADMAP.md`, task by task. The roadmap says what is built and how
it is proven; this file says who changes which files, in what order. Written by Claude
on 2026-10-03 from a read of the code and measurements on this Mac, not from memory:
every file named here exists today unless the task creates it, and every M3 task was
sized by counting the references it has to change.

Every milestone is written out. Tasks after M3 are checked again against the spikes'
findings when M3 is half done; a changed row is changed here, with the reason in its
commit. A queue file in `docs/tasks/` is made from these rows when a milestone starts; the queue
files of the old plan (`m1-interiors.json` to `m5-scorecard.json`) move to
`docs/tasks/old/` in the commit that settles this plan, so no old name is run as a new
milestone.
236 tasks for M0 to M12 are here. `docs/plan/CAPABILITIES.md` is where M10, M11, M12 and
M5's additions come from, and the feature lists' check (D14) added 16 tasks. M13 to M34's
509 tasks are in `docs/plan/milestones/`, one file a milestone, under the same rules: 745
in all. A task there names the exact task it needs from another milestone of M13 to M34,
never the whole milestone, so they can overlap without waiting in a circle.

## Rules for a task

1. **It serves one criterion**, named in its row, and its commit says
   `<task id> (<criterion>)`.
2. **Size S** changes up to about 100 lines, **size M** up to about 300. Anything bigger
   is split before it is handed out. A diff that passes 300 lines is stopped and split
   (risk R4).
3. **It touches only its files**, plus its own tests. Two lanes running at once never
   share a file. A task that finds it must touch another file stops and says so.
4. **The check comes first.** A criterion's check is written and shown red on main before
   the code that makes it pass: in an earlier task, or as the first commit of the same
   task. The task that writes a check names its file in Files.
5. **Done** means: `npm run gate` green; its check green, or measurably closer, as the
   row says; golden maps and shot diffs unchanged unless the row declares the change;
   Claude has read the diff and the evidence.
6. **Model:** DeepSeek v4.1 flash at max effort, unless the row says GLM. A task
   DeepSeek fails twice goes to GLM with the failure attached.
7. **Lane:** the crew lane it runs in. Tasks in one lane run in order; lanes run side by
   side.
8. **Shared files go one at a time.** A file in the Files column of tasks in two lanes is
   shared: the crew holds the second task until the first is merged, and when both are
   ready, the one on the long pole goes first. The busiest: `src/main.js` (M0, then
   M3.T1-T5), `src/sim/economy.js` and `src/sim/zoning.js` (M1, M3, M5, M6, M11),
   `src/sim/traffic.js` (M3, M5, M6, M10), `src/sim/wanted.js` (M6, M10),
   `src/sim/save.js` (M3, M5, M10, M11), `src/game/input.js` and `src/game/hud.js`
   (M5, M6, M7, M10, M11), `src/render/traffic.js` (M2, M3, M10), `src/render/npcs.js`,
   `src/render/lamps.js` (M2, M3), `src/render/landscape.js` (M2, M4),
   `src/sim/anchors.js` (M3, M4, M5, M6), `src/sim/walkers.js` (M3, M6, M10),
   `src/render/block.js` (M3's two lanes; M2.T13 waits for M3.T25).

## M0 — The test harness (lane: tools)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M0.T1 | **Fixed step.** The frame loop keeps an accumulator and calls the sim ticks in fixed 50 ms steps (at most 5 a frame); the player, car and camera are drawn interpolated between the last two steps. Every `tick*` call that took the frame's `dt` takes the step instead | `src/main.js` (the `render()` loop only), new `src/game/loop.js` | — | M0-1 (part) | M |
| M0.T2 | **Record and replay.** `?record=1` keeps every key and mouse event with the sim step it landed on and offers the log through `__game.inputLog()`; `?replay=<name>` loads `tests/replays/<name>.json` and feeds it in by step. `__game.stateHash()` hashes player, car, street, city, economy, people and wanted state; its check first | `src/game/loop.js`, new `src/game/replay.js`, `src/main.js` (probe lines only), new `tests/accept/m0-replay.spec.js` | M0.T1 | M0-1 | M |
| M0.T3 | **Speed.** `?speed=N` (1 to 8) runs N fixed steps per frame | `src/game/loop.js` | M0.T1 | M0-2 | S |
| M0.T4 | **Real-input helpers.** `__game.screenOf(x, y, z)` projects a world point to canvas pixels; `tests/accept/lib/input.js` gives `hold(page, keys, gameSecs)`, `clickWorld(page, x, y, z)`, `cityView(page, brush)`, `waitGame(page, secs)`; an example check zones a lot by mouse | new `tests/accept/lib/input.js`, new `tests/accept/m0-input.spec.js`, `src/main.js` (one probe) | M0.T3 | M0-3 | M |
| M0.T5 | **A/B runner.** Lift the tick loop out of `scripts/economy-probe.mjs` into `tests/accept/lib/ab.js`: `runAB({ seed, poke, at, secs, sample })` steps A and B in `main.js`'s tick order and returns per-district series and differences; the probe uses it and prints the same tables | new `tests/accept/lib/ab.js`, `scripts/economy-probe.mjs` | — | M0-4 | M |
| M0.T6 | **Shot diff.** `node scripts/shotdiff.mjs <dirA> <dirB>` prints, per pose, the share of pixels whose colour differs by more than 8 levels, and exits 1 over a threshold | new `scripts/shotdiff.mjs` | — | M0-8 | S |
| M0.T7 | **The sweep.** `node scripts/sweep.mjs --poses docs/shots/poses/<name>.json` boots each of the five seeds once, visits every pose (position, heading, hour, weather, blackout, city view), writes the shot, runs the scene pick (`pickPixel`) on a 16 × 9 grid and `frameCheck()`, reads draws and the ledger, and writes a draft `REVIEW.md` section listing anything a check flags; four seeds in parallel, under 10 minutes for 50 poses. It runs on the Mac's GPU through ANGLE Metal, as `scripts/shot.mjs` does | new `scripts/sweep.mjs`, new `docs/shots/poses/first-minutes.json` | M0.T3 | M0-5 | M |
| M0.T8 | **Golden maps.** `node scripts/map-golden.mjs` writes, for each of the five seeds, the district, every graph node and edge, every lot, pinned tower, lamp, sign, parked car, story place and the spawn to `tests/golden/map-<seed>.json`; `tests/golden.test.js` fails on any difference. The street wall joins it in M3.T6 | new `scripts/map-golden.mjs`, new `tests/golden.test.js`, new `tests/golden/` | — | M0-7 | M |
| M0.T9 | **`npm run accept`.** `npm run accept -- M1` runs `tests/accept/m1-*`; with no argument it reads the Done log in `docs/ROADMAP.md` and runs the check of every green criterion; `--speed 1` forces real speed (risk R10) | `package.json`, new `scripts/accept.mjs` | M0.T4, M0.T5 | M0-6 | S |
| M0.T10 | **Draw between steps.** Every sim mover keeps its last step's pose; cars, walkers, police and the helicopter are drawn at `lerp(previous, current, alpha)`, as M0.T1 does for the player, car and camera; its check first | `src/game/loop.js`, `src/sim/street.js`, `src/sim/wanted.js`, `src/render/traffic.js`, `src/render/npcs.js`, `src/render/police.js`, `src/render/heli.js`, new `tests/accept/m0-smooth.spec.js` | M0.T1 | M0-9 | M |

## M1 — Building pays off (lane: sim)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M1.T1 | **Checks, red.** `m1-rezone-ab.test.js` (A zones the 2 free lots for works at minute 1; flats storeys at minute 5, A minus B, five seeds) and `m1-calm.test.js` (pinned and idle shares over 10 minutes, five seeds), both on the A/B runner | new `tests/accept/m1-rezone-ab.test.js`, new `tests/accept/m1-calm.test.js` | M0.T5 | M1-2, M1-4 red | S |
| M1.T2 | **Checks, red.** `m1-zone-shows.spec.js` (Z, R, click the lot, Z; first floor within 60 game seconds; before and after shots) and `m1-hack-ab.spec.js` (walk to the lit district, H; jobs A against B; the other district bit-identical, through replays) | new `tests/accept/m1-zone-shows.spec.js`, new `tests/accept/m1-hack-ab.spec.js` | M0.T2, M0.T4 | M1-1 red, M1-5 green | M |
| M1.T3 | **Calm demand.** `GAP_GAIN` toward 1-1.5, a firm 3-7% of its district, a lot use mix where jobs about equal homes; each constant's new value and reason in `ECONOMY.md`. Run the probe before and after | `src/sim/economy.js`, `src/sim/zoning.js` (constants only), `docs/ECONOMY.md` | M1.T1 | M1-4, M1-2 | M |
| M1.T4 | **Fast first floor.** The site and first stages take at most 60 game seconds on a zoned lot with demand in band; the later stages keep their pace | `src/sim/zoning.js` | M1.T2 | M1-1 | S |
| M1.T5 | **Credit line.** A demand change carries its cause (a rezone, a firm move, a blackout, a chase); the news names a rezone only when that cause moved the district past a threshold | `src/sim/economy.js`, `src/sim/news.js` | M1.T3 | M1-3 | M |
| M1.T6 | **First-minutes sweep.** Run `first-minutes.json` (spawn, four headings, day and night, the city view, five seeds); fix D3 (the grey box on a facade at seed 7's spawn), D4 (the bright rectangle under the player at night), the HUD panels that overlap each other's text in the city view, and whatever else it finds, one commit per defect | whatever each defect names | M0.T7 | M1-6 | M |

## M2 — Strip the toy (lane: assets)

All models load through one pool loader, so a model costs its draws once however many
times it stands in the city. **People are the hard part:** today's walkers cost 12
draws as parts; as separate rigged meshes they would cost 72. So the player is one
rigged mesh, and the walkers are one instanced pool whose walk is baked into a texture
(a vertex animation texture) that the shader plays with a per-walker phase. **Props are
too heavy:** the hydrant model is 86 k triangles. Every model gets a triangle budget.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M2.T1 | **Install and measure.** Blender, the trellis2mlx environment and its weights, and MPFB, by one script; the README records free disk before and after, and the versions | new `tools/models/setup.sh`, new `tools/models/README.md` | — | M2-0 (part) | S |
| M2.T2 | **Pool loader.** `loadModelPool(name, count)` in `src/render/models.js`: one GLB in, one `InstancedMesh` per material out, with set and free slot calls; the hydrant and bin move onto it with the same draws; every mesh it makes carries `userData.model` (the file), which the sweep reads for M2-6 | new `src/render/models.js`, `src/render/props.js` | — | M2-0 (part) | M |
| M2.T3 | **One car, end to end.** A CC0 or generated reference image through trellis.cpp (`tools/models/trellis_cpp.sh`; M2.E1's car, `tools/models/evidence/car.glb`, is the starting point — re-run with `TRELLIS_FORCE=1` for another reference), then `tools/models/clean_car.py` in Blender: under 8,000 triangles, metres, Y-up, origin at the base, wheels as separate nodes; export; credit; shown in the game by the pool loader. README: minutes, peak memory | new `tools/models/clean_car.py`, `public/assets/models/`, `public/assets/CREDITS.md` | M2.T1, M2.T2 | M2-0 | M |
| M2.T4 | **One person, end to end.** MPFB body by script, CMU walk fitted, exported as a skinned GLB under 10,000 triangles; the player's render uses it as one `SkinnedMesh` with an animation mixer; its check first | new `tools/models/make_person.py`, `src/render/player.js`, new `tests/accept/m2-people.spec.js` | M2.T1 | M2-0, M2-2 (player) | M |
| M2.T5 | **Hero car.** The hero car body from M2.T3's pipeline replaces the slab (D16); doors, lights and the brake glow keep working; at most 9 draws; its check first | `src/render/traffic.js` (`buildPlayerCar`, `updatePlayerCar`), new `tests/accept/m2-cars.spec.js` | M2.T3 | M2-1 (part) | M |
| M2.T6 | **Traffic.** Five body shapes from the pipeline replace `CAR_SHAPES`; parked and moving cars share the pools; at most 11 draws (today's) | `src/render/traffic.js` | M2.T5 | M2-1 (part) | M |
| M2.T7 | **Police.** The cruiser body and the roadblock and spike kit from the pipeline replace the primitives in `policekit.js` | `src/render/policekit.js`, `src/render/police.js` | M2.T6 | M2-1 | M |
| M2.T8 | **Walker bake.** `tools/models/bake_vat.py`: 4 MPFB bodies × walk and idle, baked to a vertex animation texture and a base mesh | new `tools/models/bake_vat.py`, `public/assets/models/` | M2.T4 | M2-2 (part) | M |
| M2.T9 | **Walker pool.** `render/npcs.js` draws every walker from the baked pool: per-instance body, coat tint and phase; all walkers at most 2 draws; limbs move between frames | `src/render/npcs.js` | M2.T8 | M2-2 | M |
| M2.T10 | **Trees.** 3 tree models (Blender's Sapling add-on or the pipeline) replace the icosahedron canopies; mountains lose their cones; its check first | `src/render/props.js` (`buildTrees`), `src/render/landscape.js`, new `tests/accept/m2-landscape.spec.js` | M2.T2 | M2-4 | M |
| M2.T11 | **Street kit.** `street_lamp_01` becomes the lamp; benches, bins and bus stops from the pipeline; the hydrant and bin cut to under 5,000 triangles each; its check first | `src/render/lamps.js`, `src/render/setdress.js`, `public/assets/models/`, new `tests/accept/m2-kit.spec.js` | M2.T2 | M2-5 (part) | M |
| M2.T12 | **Rooms.** The grown-lot rooms and the noodle bar draw their furniture from models, not `box()` | `src/render/interiorkit.js`, `src/render/interiorsets.js` | M2.T2 | M2-5 | M |
| M2.T13 | **Building kit** (after the building pools). The six facade materials, rooflines and cornices already built (`render/block.js:476-486`, `05daf90`) move into the pools with the buildings (M3.T22-T25); this adds what is not built: window reveals at least 0.15 m deep, window frames, shopfronts and roof plant as pooled parts on every building parcel; at most 12 more draws; its check first | `src/render/buildings.js` (made in M3.T22), new `tests/accept/m2-streetwall.spec.js` | M3.T25 | M2-3 (part) | M |
| M2.T14 | **Frontage on generated seeds.** `check:overlap` measures the hand map's rows only (98.3% worst row today, ratchet 98.2%); it runs on the five seeds too, and if a row falls under the ratchet, the row cut in `planBuildings` closes the gaps | `scripts/check_overlap.mjs`, `src/sim/layout.js` | M3.T6 | M2-3 (part) | S |
| M2.T15 | **VGA-084 sweep.** Night, day and blackout poses on five seeds; one commit per defect found; the sweep lists every picked building, car, person, tree or prop mesh with no `userData.model` | the sweep; whatever each defect names | M2.T7, M2.T9, M2.T10, M2.T12, M2.T14 | M2-6 | M |
| M2.T16 | **Weather, sim.** New `sim/weather.js`: each game day's states (clear, overcast, rain) from a stream of their own (`createStreams` gains `weather`, so no existing replay shifts); a wetness 0-1 that rises in rain and falls over 2 game minutes after; `?weather=` pins a state for the sweep; its check first | new `src/sim/weather.js`, `src/sim/rng.js`, `src/game/loop.js`, new `tests/accept/m2-weather.test.js` | M0.T1, M3.T5 | M2-7 (part) | S |
| M2.T17 | **Weather, drawn.** The rain falls only in rain; VGA-005's wet grade, the puddle mirrors and the road gloss read the wetness; overcast greys the sky and dims the sun; no new draws; each state shot at the spawn by day and night and judged in `REVIEW.md` | `src/render/rain.js`, `src/render/materials.js`, `src/render/setdress.js`, `src/render/atmosphere.js`, new `tests/accept/m2-weather.spec.js` | M2.T16 | M2-7 | M |

## M3 — The city as data (lanes: engine-sim, engine-render)

**The load-time constants M3-2 removes** (20): from `src/sim/world.js`: `DISTRICTS`,
`EDGES`, `NODES`, `AVENUES`, `CROSSINGS`, `AVENUE_X`, `CROSSING_Z`, `WALK_BOUNDS`,
`DRIVE_BOUNDS`, `GRAPH_EXTENT`; `WORLD_PLAN` (`layout.js`); `PINNED_TOWERS`
(`landmarks.js`); `WORLD_FURNITURE` (`furniture.js`); `WORLD_VISTAS` (`vistas.js`);
`WORLD_DRESSING` (`dressing.js`); `MIDBLOCK` (`streetscape.js`); `SUBSTATIONS`,
`PURSUIT_HOMES` (`anchors.js`); `SPAWN` (`spawn.js`); `STREET_HALF` (`street.js`).
Each becomes a field or a query on the map. Pure tuning constants (`ROAD_HALF_WIDTH`,
`LOTS_MIN` and the like) stay.

**Size of the move**, counted on 2026-10-03 (references to those names, and the
crossings' local aliases `PLAZA` and `SOUTH`): `render/block.js` 46, `sim/street.js`
23, `sim/patrol.js` 16, `main.js` 11, and 1 to 6 in each of 26 other files. So the
readers move in six groups of about 25-50 references each, and `block.js` is a task of
its own.

**What is already proven:** grown lots are instanced unit boxes wearing the tower
facade materials, which already scale their texture to each instance's size
(`render/materials.js:53`); the outskirts claim slots in fixed pools per tile at a
flat 9 draws (`render/outskirts.js`). The building and road pools copy those two.

**Order.** Two spikes first; then `main.js` is split so lanes stop colliding; then the
map is built beside the old constants and the readers move over one group at a time,
each task leaving the game unchanged (goldens and shot diff); then the street wall
becomes parcels, then edits, then the renderer and traffic follow the map.

### Spikes (each lands a doc, not game code)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M3.S1 | **Can this Mac draw the city?** A throwaway page builds 2,000 buildings as unit shells in per-architecture instance pools with the tower materials and zone attribute, plus 300 road pieces, plus shadows; measures draws and the 95th-percentile frame by day and by night at the play camera and the city view, at 1280 × 720 and at full Retina size; repeats with three.js 0.160's `BatchedMesh`. Writes the numbers and a recommendation | new `docs/spikes/m3-render.md` (the page stays in the spike branch) | — | decides M3.T22-T27, D5 | M |
| M3.S2 | **Can traffic run on the graph?** A Node prototype: a 6-district grid graph, 60 cars on trips between parcels with A* routes, lanes, signals, a following gap, turns at junctions; every resident's commute as an edge flow. Measures the step cost and finds the failure cases (gridlock at a junction, a car with no route) | new `docs/spikes/m3-traffic.md` (the prototype stays in the spike branch) | — | decides M3.T29-T35, M3-9 | M |

### Split main.js (lane: engine-render; every task: gate green, shot diff under 0.5%)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M3.T1 | **Probes out.** Everything `window.__game` exposes (`frameCheck`, `pickPixel`, `policeProbe`, `draws`, `ledger`, `cityview` and the rest) moves to `src/game/probe.js`, which takes the game's parts as one object | `src/main.js`, new `src/game/probe.js` | M0.T6 | M3-1 (part) | M |
| M3.T2 | **Input out.** Keys, mouse, pointer lock, `footInput`, `driveInput`, the city-view binding | `src/main.js`, new `src/game/input.js` | M3.T1 | M3-1 (part) | M |
| M3.T3 | **Camera out.** The follow rig, `placeFollowCamera`, interior rigs, drag-to-orbit | `src/main.js`, new `src/game/camera.js` | M3.T2 | M3-1 (part) | M |
| M3.T4a | **Scene build out.** Every `build*` call and `scene.add` into `buildScene(ctx)` | `src/main.js`, new `src/game/scene.js` | M3.T3 | M3-1 (part) | M |
| M3.T4b | **Scene update out.** Every `update*` call into `updateScene(ctx, frame)` (the two halves move 89 `build*`, `update*` and `scene.add` calls today) | `src/main.js`, `src/game/scene.js` | M3.T4a | M3-1 (part) | M |
| M3.T5 | **HUD out.** Status lines, door HUD, news, ledger, arc UI wiring; `main.js` at most 300 lines | `src/main.js`, new `src/game/hud.js` | M3.T4b | M3-1 | M |

### One live map (lane: engine-sim; every task: goldens unchanged unless declared)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M3.T6 | **The street wall moves into the sim.** `planBuildings(district, seed)` in `layout.js` cuts each row into buildings (front, depth, height, kind) from the world seed, not 2084; styles come from the district plan (distance to the first crossing, avenue order), not from `ax === 0 && z < 40`; `block.js` draws what it returns. Declared golden change: the street wall | `src/sim/layout.js`, `src/render/block.js` (`streetWall`, `styleFor`), `scripts/map-golden.mjs` | M0.T8 | M3-3 (part) | M |
| M3.T7 | **One list of buildings.** Pinned towers, end caps (`WORLD_VISTAS.caps`) and row buildings come out of one `buildingsOf(plan)` with the same fields | `src/sim/layout.js`, `src/sim/vistas.js`, `src/sim/landmarks.js` | M3.T6 | M3-3 (part) | S |
| M3.T8 | **The map.** `src/sim/map.js`: `createMap(seed)` returns `{ seed, version, district, graph, buildings, lots, furniture, dressing, anchors, spawn }` built by today's derivations, and queries `nodeAt`, `edgesNear`, `buildingsIn(box)`, `districtAt`; `mapHash(map)`. Nothing reads it yet; a test checks it against the goldens | new `src/sim/map.js`, new `tests/map.test.js` | M3.T7 | M3-2 (part) | M |
| M3.T9 | **Police read the map** (32 references). `patrol.js`, `dispatch.js`, `wanted.js`, `vehicle.js`, `player.js` take the map instead of importing constants | those five files, `src/main.js` (wiring) | M3.T8, M3.T5 | M3-2 (part) | M |
| M3.T10 | **Street life reads the map** (31). `street.js`, `furniture.js`, `decline.js` | those three files | M3.T9 | M3-2 (part) | M |
| M3.T11 | **Lots read the map** (15). `zoning.js` (its hand `LOTS` table becomes the preset's map entry), `economy.js`, `cityview.js`, `interior.js` | those four files | M3.T10, M1 done | M3-2 (part) | M |
| M3.T12 | **Story places read the map** (33). `anchors.js`, `spawn.js`, `streetscape.js`, `dressing.js`, `vistas.js`, `streetnames.js`, `landmarks.js`, `layout.js`; `streetscape.js` loses its "neon blade" wording, the last hit of VGA-083's grep for `neon` | those eight files | M3.T11 | M3-2 (part) | M |
| M3.T13 | **The ground and street wall read the map** (46). `render/block.js` | `src/render/block.js` | M3.T12 | M3-2 (part) | M |
| M3.T14 | **Everything else reads the map** (33): `render/zoning.js`, `vacant.js`, `lamps.js`, `signs.js`, `landscape.js`, `outskirts.js` and `main.js`'s last 11; the 20 exports are deleted; `check_boundary.mjs` fails on any of their names | those seven files; the ten that export the 20 (`world.js`, `layout.js`, `landmarks.js`, `furniture.js`, `vistas.js`, `dressing.js`, `streetscape.js`, `anchors.js`, `spawn.js`, `street.js`); `scripts/check_boundary.mjs` | M3.T13 | M3-2 | M |

### Every building a parcel, and edits (lane: engine-sim)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M3.T15 | **Parcels for all.** Row buildings, towers and caps join the lots in `city.parcels` with `kind` (`row`, `tower`, `cap`, `lot`), a use from their style, and stage HIGH; only `lot` parcels grow or decline on their own; its check first | `src/sim/zoning.js`, `src/sim/map.js`, new `tests/accept/m3-parcels.spec.js` | M3.T14 | M3-3 (part) | M |
| M3.T16 | **The economy counts buildings.** A district's size is the floor area of its parcels, not lot area times 0.4 (`economy.js:19`); recalibrate until M1's checks are green again (risk R3) | `src/sim/economy.js`, `src/sim/people.js` | M3.T15, M1 done | M3-3 (part), M1 still green | M |
| M3.T17 | **Pick names parcels.** Every drawn building carries its parcel id; the scene pick and `__game.pick()` return it | `src/render/block.js`, `src/render/zoning.js`, `src/game/probe.js` | M3.T15 | M3-3 | S |
| M3.T18 | **Building ops.** `zone`, `bulldoze` (any parcel comes down a stage at a time, as `clearLot` does today; its land becomes an empty `lot`), `place(kind, parcel)`, each with an undo; `map.version`; the dirty 64 m tiles | `src/sim/map.js`, new `src/sim/ops.js` | M3.T15 | M3-4 (part) | M |
| M3.T19 | **Road ops.** `addRoad(a, b)` on the grid from an existing node, `removeRoad(edge)`; the graph is cut again at crossings; parcels left with no frontage road get `noRoad` | `src/sim/ops.js`, `src/sim/map.js` | M3.T18 | M3-4 (part) | M |
| M3.T20 | **New frontage.** After a road op, rows and lots are planned again on the dirty tiles only, keeping every untouched parcel's id | `src/sim/layout.js`, `src/sim/ops.js` | M3.T19 | M3-4 (part) | M |
| M3.T21 | **The ops test.** 200 random ops then their undos on five seeds give back the golden map hash; each op at most 2 ms | new `tests/accept/m3-ops.test.js` | M3.T20 | M3-4 | S |

### The renderer follows the map (lane: engine-render)

`buildTowers` in `render/block.js` (lines 735-970) merges rows, towers, caps, podiums,
posters, roof caps and shop glass into one mesh per material. It comes apart in four
tasks, so none passes 300 lines.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M3.T22 | **Row shells pooled** (overrides `ZONING.md`'s no-instancing line; ROADMAP M3 says why). Row buildings leave the merged street wall for per-architecture shell pools in new `render/buildings.js` (the `render/zoning.js` pattern); each slot carries its parcel id and district; its check first | new `src/render/buildings.js`, `src/render/block.js`, new `tests/accept/m3-render.spec.js` | M3.S1, M3.T17 | M3-5 (part) | M |
| M3.T23 | **Towers and caps pooled.** Pinned towers and end caps join the pools; the merged shell path in `buildTowers` is deleted (law 6, no dead tech) | `src/render/buildings.js`, `src/render/block.js` | M3.T22 | M3-5 (part) | M |
| M3.T24 | **Podiums and shop glass pooled,** keyed to their parcel, so a bulldoze frees them with the shell | `src/render/buildings.js`, `src/render/block.js` (`podiumSkin`, shop glass) | M3.T23 | M3-5 (part) | M |
| M3.T25 | **Posters and roof caps pooled** (`posterWall`, `roofline`); `buildTowers` keeps only what is not a building | `src/render/buildings.js`, `src/render/block.js` | M3.T24 | M3-5 (part) | M |
| M3.T26 | **Road pools.** Carriageway, walks, kerbs and markings as pooled pieces per edge and junction (`buildGround`, `buildMarkings` today merge them) | new `src/render/roads.js`, `src/render/block.js` | M3.T25 | M3-5 (part) | M |
| M3.T27 | **Tiles rebuild.** A map version change sends the dirty tiles to the chunk manager, which reclaims their slots inside its 1.5 ms a frame; the outskirts clear where a road now runs | `src/render/chunks.js`, `src/game/scene.js`, `src/render/outskirts.js` | M3.T26, M3.T20 | M3-5 | M |

### Traffic drives the graph (lane: engine-sim)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M3.T28 | **Check, red.** `m3-traffic.test.js` (Node: no jumps, red lights, removed and added roads) and `m3-traffic.spec.js` (the same in the browser, plus the 8:00 walkers) | new `tests/accept/m3-traffic.test.js`, new `tests/accept/m3-traffic.spec.js` | M3.S2 | M3-6 red | S |
| M3.T29 | **Car following.** New `sim/traffic.js`: a car holds an edge, a lane, a distance along it and a route; it keeps a gap to the car ahead and turns at nodes. Settles the lane side `world.js:laneCenterLine` flags (N-S drives right, E-W left today). Node tests only; nothing wired | new `src/sim/traffic.js`, new `tests/traffic.test.js` | M3.T28, M3.T19 | M3-6 (part) | M |
| M3.T30 | **Trips.** Cars get trips between parcels and A* routes; they appear and go only 60 m or more from the camera and out of its view; `tickStreet`'s wrap for cars is deleted and `street.js` hands cars to `traffic.js` | `src/sim/traffic.js`, `src/sim/street.js` | M3.T29 | M3-6 (part) | M |
| M3.T31 | **Signals.** Every junction of two ways runs a two-phase light; cars stop at the line on red; signal heads drawn as a pool | `src/sim/traffic.js`, `src/render/lamps.js` | M3.T30 | M3-6 (part) | M |
| M3.T32 | **Traffic is drawn from the sim.** `render/traffic.js` reads position and yaw from `sim/traffic.js` instead of `axis` and `dir`; drawn between steps (M0-9) | `src/render/traffic.js` | M3.T30 | M3-6 (part) | M |
| M3.T33 | **Walkers on the graph.** Walkers hold a walkway and a route and cross at junctions; the wrap for walkers is deleted | `src/sim/street.js`, new `src/sim/walkers.js` | M3.T30 | M3-6 (part) | M |
| M3.T34 | **Commuters are residents.** At the rushes a walker is a resident going between their home and job parcels (`people.js`); `commute.js`'s turning round is deleted; `render/npcs.js` reads position and yaw; drawn between steps (M0-9) | `src/sim/walkers.js`, `src/sim/commute.js`, `src/render/npcs.js` | M3.T33 | M3-6 (part) | M |
| M3.T35 | **The commute flow.** Every resident's trips laid on edges by hour; the visible cars near the player are drawn from it; a person's commute time feeds the economy (late workers, lost trade) | `src/sim/traffic.js`, `src/sim/economy.js` | M3.T34 | M3-6, M3-9 | M |

### Districts, save, cost, close (lane: engine-sim, except T37)

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M3.T36 | **Districts in the sim.** `map.districts` with bounds; `districtAt(x, z)` replaces `zoneAt`; `street.zones` and the economy's districts run N, named by the map, not `['south', 'north']`; its check first | `src/sim/street.js`, `src/sim/economy.js`, `src/sim/map.js`, new `tests/accept/m3-districts.test.js` | M3.T27 | M3-7 (part) | M |
| M3.T37 | **Districts in the light** (lane: engine-render). Window lighting takes a district id per vertex and a 16-entry uniform instead of two zones; the `DARK` array, glows, mirror re-shoots and H follow N districts; H targets the district the player stands in | `src/render/materials.js`, `src/game/scene.js`, `src/render/hackfx.js` | M3.T36 | M3-7 | M |
| M3.T38 | **Save v3.** Seed, op log, state; compacts the log on save; a v2 save starts a new game with a one-line message; its check first | `src/sim/save.js`, `src/savestore.js`, new `tests/accept/m3-save.spec.js` | M3.T21 | M3-8 | M |
| M3.T39 | **Sim bench.** `scripts/simbench.mjs` builds a 2,000-building test map with 60 cars, 150 walkers and the full commute flow, and times 1,000 steps | new `scripts/simbench.mjs` | M3.T35 | M3-9 | S |
| M3.T40 | **Close.** `npm run accept` on every earlier criterion; the M3 sweep (street wall, junctions, lights, traffic at the rushes, a bulldozed gap, five seeds); one commit per defect | the sweep | all of the above | M3-10 | M |

## M4 — A city, not a street (lane: engine; T9 in assets)

**Terrain first, then placement.** The river was built once and stopped after four
faults in one feature: buried under the ground plane, routed through a row of ten
towers, darker than its own banks, and sited where no light reaches it
(`world-scale-design.md`, "Wave 2"). They were one fault: terrain was cut after the
buildings were placed and patched under them. M4 inverts it: the generator lays the
ground and the water first, and every placement asks one question, "is this footprint
over water or too steep?". With the map in place (M3), the heightfield can also leave
`world.js`, which its own comment says a module cycle prevents today.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M4.T1 | **Checks, red.** `m4-districts.test.js` (districts, kinds, buildings, free lots, five seeds) and `m4-local.test.js` (a blackout's reach, through the commute links) | new `tests/accept/m4-districts.test.js`, new `tests/accept/m4-local.test.js` | M3 done | M4-1, M4-5 red | S |
| M4.T2 | **Terrain module.** The heightfield moves from `world.js` to new `sim/terrain.js`, built from the map; `buildable(x, z, w, d)` answers water and gradient; no behaviour change on today's seeds | `src/sim/world.js`, new `src/sim/terrain.js`, `src/sim/map.js` | M4.T1 | M4-3 (part) | M |
| M4.T3 | **The town plan.** Seed → a coarse grid of 4-6 district cells about 600 m across, each with a kind (towers, housing, works, suburb), an east-west river corridor of 60 m (about 30 m of water, 7 m banks, 8 m setback; the spec's targets), and arterial roads joining the cells | new `src/sim/townplan.js`, `src/sim/map.js` | M4.T2 | M4-1 (part), M4-2 (part) | M |
| M4.T4 | **Districts from cells.** `generateDistrict` takes a cell and a kind (avenue gap, crossing count, height and style range); all districts' roads join into one graph through the arterials | `src/sim/citygen.js`, `src/sim/map.js` | M4.T3 | M4-1 (part) | M |
| M4.T5 | **Buildings by kind.** `planBuildings` per kind: towers as today; housing as mid-rise rows; works as wide sheds on deep lots; suburb as detached houses on plots with gardens; every footprint asks `buildable` | `src/sim/layout.js` | M4.T4 | M4-1 (part), M4-2 (part) | M |
| M4.T6 | **Hills.** Relief off the roads across the town; roads graded flat with the existing blend (`FLAT_BLEND`); junctions level | `src/sim/terrain.js` | M4.T5 | M4-3 (part) | M |
| M4.T7 | **Bridges.** Where a road crosses the river corridor, its edge becomes kind `bridge`, its deck level with the road; nothing else may cross water; its check first | `src/sim/map.js`, `src/sim/terrain.js`, `src/sim/ops.js`, new `tests/accept/m4-river.spec.js` | M4.T5 | M4-2 (part) | M |
| M4.T8 | **River and bridges drawn.** The water material from main before `354d937` (the commit that took the river channel out: `git show 354d937^`), inside the spec's albedo bounds (`world-scale-design.md`, "What carries forward"), banks, bridge decks and railings as pools; lit, and in sight down at least two avenues | new `src/render/river.js`, `src/render/roads.js` | M4.T7 | M4-2 | M |
| M4.T9 | **Suburb and works buildings** (lane: assets). House, low-rise flat and shed models through the M2 pipeline, added to the building pools | `src/render/buildings.js`, `public/assets/models/` | M4.T5, M2.T3 | M4-1 (part) | M |
| M4.T10 | **Movers on hills.** Player, hero car, traffic, walkers and police sample the terrain; nobody sinks or floats; `m4-terrain.spec.js` | `src/sim/player.js`, `src/sim/vehicle.js`, `src/sim/traffic.js`, `src/sim/walkers.js`, `src/sim/wanted.js`, new `tests/accept/m4-terrain.spec.js` | M4.T6 | M4-3 | M |
| M4.T11 | **Economy by kind.** A district's starting mix follows its kind (housing more homes, works more jobs); M1's checks stay green | `src/sim/economy.js` | M4.T5 | M4-1 (part) | M |
| M4.T12 | **Story places across the town.** A substation per district, pursuit homes, arc places, interiors' frames and the spawn (in the towers district) placed by the map, not by the first district | `src/sim/anchors.js`, `src/sim/spawn.js`, `src/sim/landmarks.js` | M4.T5 | M4-1 | M |
| M4.T13 | **Outskirts around the town.** The farmland bands follow the town's outline instead of one district's edge | `src/render/outskirts.js`, `src/render/landscape.js` | M4.T5 | M4-8 (part) | M |
| M4.T14 | **The drive check.** `m4-drive.spec.js`: a key-driving helper that steers along the graph route by pressing keys; spawn to the farthest district centre in under 3 minutes, five seeds | new `tests/accept/m4-drive.spec.js`, `tests/accept/lib/input.js` | M4.T10 | M4-4 | M |
| M4.T15 | **The preset goes.** The 15 `HAND_` tables and `LOTS`, `KEEP_OUT`, `ROW_RUNS`, `SOUTH_TOWERS`, `TERMINUS_TOWERS` are deleted; every test runs on a generated seed | every file holding them; `tests/` | M4.T12 | M4-6 | M |
| M4.T16 | **Draws at the busiest pose.** Measure on five seeds; if any frame passes 175, this becomes the streaming task (world-scale plank 3, `render/chunks.js` already built) and is split before it starts | `scripts/shot.mjs` poses | M4.T13 | M4-7 | S, or split |
| M4.T17 | **A road in from outside.** One regional road enters at an edge of the map and joins the arterials; through-traffic and commuters from outside appear and leave at its far end, out of sight; its check first | `src/sim/townplan.js`, `src/sim/map.js`, `src/sim/traffic.js`, new `tests/accept/m4-outside.test.js` | M4.T4 | M4-9 | M |
| M4.T18 | **Close.** Locality (M4-5) green; the district sweep, day and night, five seeds; one commit per defect | the sweep | all of the above | M4-5, M4-8 | M |

## M5 — The building toolset (lanes: sim, ui; T10 in assets)

Every tool is an M3 operation with a cost, a cursor preview and a rule that can refuse
it with a reason. **Story places stay deletable:** if the player bulldozes a building
the arc or an interior uses, the story moves to the nearest building of the same use,
and the journal says so; nothing is protected from the player.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M5.T1 | **The tool frame.** A tool is `{ op, cost(map, at), preview(at), refuse(map, at) → reason }`; the R C I X brushes become tools; the city-view panel lists tools with their keys and costs; hovering a tool names what it does and its cost; a right click or Esc puts it down | `src/sim/cityview.js`, `src/ui/cityview.js` | M4 done | M5-7 (part) | M |
| M5.T2 | **Checks, red.** `m5-roads.spec.js`, `m5-bulldoze.spec.js`, `m5-noroad.test.js` | new files in `tests/accept/` | M5.T1 | M5-1, M5-2, M5-3 red | M |
| M5.T3 | **Road drag.** Press on a road node, drag: a grid-snapped preview with its length and cost; release lays it with `addRoad`; it refuses over water, through buildings or up too steep, saying which | `src/sim/cityview.js`, `src/render/cityview.js`, `src/ui/cityview.js` | M5.T2 | M5-1 (part) | M |
| M5.T4 | **A new road is a street.** Lamps, signals and furniture planned along it; lots planned on both sides (M3.T20); the outskirts gone from its path (M3.T27) | `src/sim/furniture.js`, `src/sim/ops.js` | M5.T3 | M5-1 | M |
| M5.T5 | **Bulldoze tool.** Any building or road under the cursor highlights with its cost; a click runs `bulldoze` or `removeRoad`; removing a road that would cut buildings off asks first, in the page (the browser's `confirm` is not used) | `src/sim/cityview.js`, `src/render/cityview.js`, `src/ui/cityview.js` | M5.T2 | M5-2 | M |
| M5.T6 | **No road, no life.** A parcel with `noRoad` declines with the reason "no road" in its lot note and the news | `src/sim/zoning.js`, `src/sim/news.js` | M5.T5 | M5-3 | S |
| M5.T7 | **Story places move.** A bulldozed arc place, door or pursuit home moves to the nearest building of the same use; the journal says so | `src/sim/anchors.js`, `src/sim/arc.js` | M5.T5 | M5-2 (part) | M |
| M5.T8 | **Height cap.** A parcel field `cap`; growth stops at it; Shift with a brush paints a low-rise cap | `src/sim/zoning.js`, `src/sim/cityview.js` | M5.T1 | M5-4 (part) | S |
| M5.T9 | **New land grows.** `m5-newland.spec.js`: a lot on a new road zoned R shows its first floor within 60 game seconds; a capped lot stops at LOW | new `tests/accept/m5-newland.spec.js` | M5.T4, M5.T8 | M5-4 | S |
| M5.T10 | **Service buildings** (lane: assets). Substation, police station, fire station, clinic, school and park models through the M2 pipeline, under 15,000 triangles each, added to the pools | `public/assets/models/`, `src/render/buildings.js` | M2.T3 | M5-5 (part) | M |
| M5.T11 | **Services as parcels.** Parcel kind `service` with a type; a place tool for each on an empty lot; a door and a room from the `INTERIORS.md` pattern (`parcelItems` gets a set per service); every service has a catchment radius and a capacity (patients, pupils, cells, trucks), written in `CITYVIEW.md`: its effect reaches only parcels in its catchment, up to its capacity | `src/sim/ops.js`, `src/sim/interior.js`, `src/sim/cityview.js` | M5.T10 | M5-5 (part) | M |
| M5.T12 | **Substation.** A district with two comes back from a blackout in half the dark time (`street.js` `darkUntil`); A/B check first | `src/sim/street.js`, new `tests/accept/m5-substation.spec.js` | M5.T11 | M5-5 (part) | S |
| M5.T13 | **Police station.** Cruisers start from the nearest station and drive (`wanted.js` `syncUnits` spawns at `SPAWN_DIST` from the player today); a crime within 100 m is reached at least 30% faster; A/B check first | `src/sim/wanted.js`, new `tests/accept/m5-police.spec.js` | M5.T11 | M5-5 (part) | M |
| M5.T14 | **Fire alarm and fire station.** A sim event "alarm" a building can have (M6's hack sets one off); it clears in half the time within 300 m of a station; A/B check first | new `src/sim/alarms.js`, new `tests/accept/m5-fire.test.js` | M5.T11 | M5-5 (part) | M |
| M5.T15 | **Clinic and school.** Wealth recovers at least 20% faster in their district (`WEALTH_RISE_SECS`, 25 s today); A/B check first | `src/sim/economy.js`, new `tests/accept/m5-clinic.test.js` | M5.T11 | M5-5 (part) | S |
| M5.T16 | **Park.** Home demand within 100 m rises by at least 0.05; A/B check first | `src/sim/economy.js`, new `tests/accept/m5-park.test.js` | M5.T11 | M5-5 | S |
| M5.T17 | **Budget, sim.** City money; income each game minute = tax × floor area per use; upkeep per road metre and per service; a higher tax lowers that use's demand; in debt, services shut, farthest police station first, and the news says so; formula in `ECONOMY.md` | new `src/sim/budget.js`, `src/sim/economy.js`, `src/sim/news.js`, new `tests/accept/m5-budget.test.js` | M5.T11 | M5-6 | M |
| M5.T18 | **Budget, panel.** Tax per use and the money line in the city view | `src/ui/cityview.js` | M5.T17 | M5-6 | S |
| M5.T19 | **Cost and refusal.** Every tool shows its cost before it acts; one the money cannot pay refuses and says so; `m5-cost.spec.js` | `src/sim/cityview.js`, `src/ui/cityview.js`, new `tests/accept/m5-cost.spec.js` | M5.T17 | M5-7 | S |
| M5.T20 | **Overlay frame.** One pooled lot-tint layer with per-instance colour, 2 draws at most; a key cycles overlays | new `src/render/overlays.js`, `src/sim/cityview.js` | M5.T1 | M5-8 (part) | M |
| M5.T21 | **Five overlays.** Demand, power, police cover (distance to a station), land value (its formula written down), traffic (edge load from the commute flow); each matches the sim on 5 sampled lots; plus a coverage overlay per service (its catchment, shaded by how full it is) | `src/render/overlays.js`, new `tests/accept/m5-overlays.spec.js` | M5.T20, M5.T13 | M5-8 | M |
| M5.T22 | **Save v4.** Money, tax rates, caps and services; a v3 save continues with defaults | `src/sim/save.js` | M5.T17 | M5-9 | S |
| M5.T23 | **The save check.** Build roads, bulldoze, place services, set caps and taxes; save; reload; all the same | new `tests/accept/m5-save.spec.js` | M5.T22 | M5-9 | S |
| M5.T24 | **Road types in the sim.** Edges get `lanes` (2 or 4) and `oneWay`; `traffic.js` uses them; `upgradeRoad(edge, type)` as an op with an undo; A/B check first | `src/sim/map.js`, `src/sim/ops.js`, `src/sim/traffic.js`, new `tests/accept/m5-roadtypes.test.js` | M5.T4 | M5-10 (part) | M |
| M5.T25 | **Road types in the tool, and drawn.** The drag picks a type; a click on a road offers the upgrade and its cost; the road pools draw the 4-lane width and one-way arrows | `src/sim/cityview.js`, `src/ui/cityview.js`, `src/render/roads.js` | M5.T24 | M5-10 | M |
| M5.T26 | **Undo.** Ctrl+Z in the city view undoes the last act within 10 game seconds through M3's undo, and refunds its cost | `src/sim/cityview.js`, `src/game/input.js` | M5.T19 | M5-7 | S |
| M5.T27 | **Demand bars.** Three bars for the district under the cursor, read from the economy | `src/ui/cityview.js` | M5.T1 | M5-8 (part) | S |
| M5.T28 | **Pollution.** Works lots pollute by stage, and busy roads make noise by their edge load in M3's commute flow; home demand and land value (M5.T21's formula) fall within 60 m; the news names the cause; A/B check first | new `src/sim/pollution.js`, `src/sim/economy.js`, `src/sim/news.js`, new `tests/accept/m5-pollution.test.js` | M5.T21 | M5-11 | M |
| M5.T29 | **Pollution overlay,** the sixth | `src/render/overlays.js` | M5.T28 | M5-8 | S |
| M5.T30 | **Milestones.** Population tiers written in `ZONING.md`; a locked tool refuses with "unlocks at N people"; the city view always shows the population and the next tier, and reaching a tier says on screen what it unlocked; the scripted-player test | new `src/sim/milestones.js`, `src/sim/cityview.js`, `src/ui/cityview.js`, `docs/ZONING.md`, new `tests/accept/m5-milestones.test.js` | M5.T19 | M5-12 | M |
| M5.T31 | **Junction control.** Click a junction in the city view: lights, stop signs or yield; cars in M3's traffic obey; A/B check first | `src/sim/traffic.js`, `src/sim/cityview.js`, `src/ui/cityview.js`, new `tests/accept/m5-junctions.test.js` | M5.T1 | M5-14 | M |
| M5.T32 | **History.** A panel of population, jobs, the jobless, the city's money and demand per use over the last 5 game days, on a 2D canvas; the economy keeps the series; its check first | new `src/ui/history.js`, `src/sim/economy.js`, new `tests/accept/m5-history.spec.js` | M5.T17 | M5-15 | S |
| M5.T33 | **Drag zoning.** Hold the mouse with a brush and drag: every empty lot the stroke crosses is zoned, its total cost shown before release; one undo takes the stroke back; checked in `m5-newland.spec.js` | `src/sim/cityview.js`, `src/ui/cityview.js`, `tests/accept/m5-newland.spec.js` | M5.T9, M5.T26 | M5-4 | S |
| M5.T34 | **Problem icons.** One pooled icon layer in the city view (1 draw): every building held back shows its first cause, from `decline.js` and the services' reach; a click opens today's reason card; M12's causes join the same table; its check first | new `src/render/problems.js`, `src/sim/decline.js`, `src/ui/cityview.js`, new `tests/accept/m5-problems.spec.js` | M5.T11 | M5-16 | M |
| M5.T35 | **Pause and speed.** In the city view Space pauses and resumes; three buttons run 1, 2 or 4 sim steps a frame through M0's speed; leaving the city view sets 1; its check first | `src/sim/cityview.js`, `src/ui/cityview.js`, `src/game/loop.js`, new `tests/accept/m5-speed.spec.js` | M5.T1, M0.T3 | M5-17 | S |
| M5.T36 | **Close.** The sweep of the city view and the street at every new road, gap and service; one commit per defect; the M5 keys' hints (M7.T12) | the sweep, `content/hints.json` | all of the above, M7.T12 | M5-13 | M |

## M6 — The hacking toolset (lanes: sim, render)

Today a hack is one key that blacks out the zone the player stands in (`main.js`
`fireHack`), and the profiler aims at walkers within 14 m in front of the player
(`street.js` `profilerTarget`). M6 generalises the profiler's aim into one registry of
hackable things.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M6.T1 | **The registry.** Every hackable thing (junction, car, camera, pipe, crane, building, person, bridge, control box, planning office) is registered from the map with its position, kind, hacks and costs, and kept current as the map changes | new `src/sim/hackables.js` | M4 done | M6-1 (part) | M |
| M6.T2 | **Aim.** The nearest registered thing within 40 m, inside a view cone and in sight (a 2D ray against parcel footprints), highlighted with its name and cost; replaces `profilerTarget`; `m6-aim.spec.js` first | `src/sim/hackables.js`, new `src/render/aim.js`, new `tests/accept/m6-aim.spec.js` | M6.T1 | M6-1 | M |
| M6.T3 | **Fire and menu.** One key fires a thing's default hack; holding it opens a menu of its hacks | `src/game/input.js`, new `src/ui/hackmenu.js` | M6.T2 | M6-4 (part) | M |
| M6.T4 | **Battery.** A meter whose refill rate and every hack's cost are written in new `docs/HACKING.md` (feel values, rule 10); each hack spends its cost; one it cannot pay refuses and says why; HUD meter; `m6-battery.test.js` first | new `src/sim/battery.js`, `src/game/hud.js`, new `tests/accept/m6-battery.test.js`, new `docs/HACKING.md` | M6.T3 | M6-3 | S |
| M6.T5 | **Control boxes.** One per district on a street, placed by the map; breaking in is holding E for 3 s (tap E stays the door key), seen by walkers and police nearby; until then only the profiler and the blackout work there; `m6-access.spec.js` first | `src/sim/hackables.js`, `src/sim/anchors.js`, new `tests/accept/m6-access.spec.js` | M6.T3 | M6-2 | M |
| M6.T6 | **Police see hacks.** A hack fired in a unit's sight raises heat (`wanted.js` `raise`, cause `hack`); dispatch has a line per hack kind | `src/sim/wanted.js`, `src/sim/dispatch.js` | M6.T3 | M6-4 (part) | S |
| M6.T7 | **Traffic signals.** All-green at a junction; cars brake and jam; commuters through it late; the block's shops lose trade; a cruiser in it stuck | `src/sim/traffic.js`, new `tests/accept/m6-signals.spec.js` | M6.T6 | M6-4 (part) | M |
| M6.T8 | **Bollards.** Posts rise across a junction; a car that hits them stops dead; traffic reroutes; a chasing cruiser stops | `src/sim/traffic.js`, `src/sim/wanted.js`, new `src/render/bollards.js`, new `tests/accept/m6-bollards.spec.js` | M6.T6 | M6-4 (part) | M |
| M6.T9 | **Steam pipe.** A street shut for 60 s with a steam column; its shops lose trade; cars and police reroute | `src/sim/traffic.js`, `src/sim/economy.js`, `src/render/hackfx.js`, new `tests/accept/m6-steam.spec.js` | M6.T6 | M6-4 (part) | M |
| M6.T10 | **Bridge.** A lifting span rises; nothing crosses; commuters to the far side late; that side's jobs dip | `src/sim/traffic.js`, `src/render/river.js`, new `tests/accept/m6-bridge.spec.js` | M6.T6, M4.T8 | M6-4 (part) | M |
| M6.T11 | **Car hijack.** One car brakes, swerves or floors it; a crash blocks the road, or a pursuer is taken out | `src/sim/traffic.js`, `src/sim/wanted.js`, new `tests/accept/m6-hijack.spec.js` | M6.T6 | M6-4 (part) | M |
| M6.T12 | **Street camera, the hack.** Cameras registered on buildings; cut one and the police are blind in that street (`patrol.js` `canSee`) | `src/sim/hackables.js`, `src/sim/patrol.js`, new `tests/accept/m6-camera.spec.js` | M6.T6 | M6-4 (part) | S |
| M6.T13 | **Street camera, the view.** The view jumps into the camera; profile from there; jump to any camera in view; Esc returns | `src/game/camera.js`, `src/render/aim.js` | M6.T12 | M6-4 (part) | M |
| M6.T14 | **Radio jam.** Dispatch turns to static; for 20 s the police cannot raise the tier or call units | `src/sim/wanted.js`, `src/ui/dispatch.js`, new `tests/accept/m6-jam.spec.js` | M6.T6 | M6-4 (part) | S |
| M6.T15 | **Calls.** A call generator: a profiled person's call as subtitles, drawn from what the economy has queued (the next firm move, a closing shop) | new `src/sim/calls.js`, `src/sim/economy.js` | M6.T6 | M6-4 (part) | M |
| M6.T16 | **Eavesdrop.** Fires the call; some calls tip the next city event before it happens | `src/sim/hackables.js`, new `tests/accept/m6-eavesdrop.spec.js` | M6.T15 | M6-4 (part) | S |
| M6.T17 | **Bank transfer.** A person's balance drains into the player's; they stop spending; enough in one district and its shops lose trade | `src/sim/people.js`, `src/sim/economy.js`, new `tests/accept/m6-bank.test.js` | M6.T6 | M6-4 (part) | S |
| M6.T18 | **Crane.** Stop: the site stalls. Drop: the lot loses a stage and the site shuts for a minute | `src/sim/zoning.js`, `src/render/zoning.js`, new `tests/accept/m6-crane.spec.js` | M6.T6 | M6-4 (part) | S |
| M6.T19 | **Fire alarm.** Sets off M5's alarm event: the building empties onto the pavement; its shop shuts for 2 minutes | `src/sim/alarms.js`, `src/sim/walkers.js`, new `tests/accept/m6-alarm.spec.js` | M6.T6, M5.T14 | M6-4 (part) | S |
| M6.T20 | **Planning office.** A building per district; inside, a lot's permit fast-tracked (full pace for a minute) or frozen (no progress for 2 minutes) | `src/sim/zoning.js`, `src/sim/interior.js`, new `tests/accept/m6-permit.spec.js` | M6.T6 | M6-4 (part) | M |
| M6.T21 | **Reach.** One Node test runs every hack's A/B and checks M4-5's rule: nothing outside its reach changes | new `tests/accept/m6-reach.test.js` | M6.T7 to M6.T20 | M6-4 | S |
| M6.T22 | **Focus.** Holding Q slows the game to 0.3 times speed for up to 4 s (the fixed-step loop runs fewer steps a frame) and spends battery while held, at the rate in `HACKING.md`; its check first | `src/game/loop.js`, `src/sim/battery.js`, `src/game/input.js`, new `tests/accept/m6-focus.spec.js` | M6.T4 | M6-3 | S |
| M6.T23 | **Close.** The sweep of every hack's shot; one commit per defect; the M6 keys' hints (M7.T12) | the sweep, `content/hints.json` | all of the above, M7.T12 | M6-5 | M |

## M10 — Living in it (lane: street)

Taking a car means taking one of the sim's cars, so M10 waits for M3's routed traffic.
Today `main.js` `toggleVehicle` (F) lets the player into the hero car only. F stays the
car key for every car; E stays the door key.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M10.T1 | **Checks, red.** `m10-cars.spec.js`, `m10-map.spec.js` | new files in `tests/accept/` | M3.T35 | M10-1, M10-2 red | S |
| M10.T2 | **Any parked car.** Parked cars become sim cars that can be entered; F at one puts the player in it, driving with `vehicle.js` and that car's body; the hero car stays where it was left | `src/sim/vehicle.js`, `src/sim/traffic.js`, `src/game/input.js` | M10.T1 | M10-1 (part) | M |
| M10.T3 | **Carjack.** F at a traffic car stopped at a light: the driver gets out and runs off as a walker; the player drives; police in sight raise heat with the cause "theft" | `src/sim/traffic.js`, `src/sim/walkers.js`, `src/sim/wanted.js` | M10.T2 | M10-1 (part) | M |
| M10.T4 | **The taken car, drawn.** It draws from its traffic body in the hero-car rig (lights, brake glow), within today's car draws | `src/render/traffic.js` | M10.T2 | M10-1 | M |
| M10.T5 | **Minimap.** A 2D-canvas overlay: the roads within 150 m from the map, heading, the mission marker, police in sight | new `src/ui/minimap.js`, `src/game/hud.js` | M10.T1 | M10-2 (part) | M |
| M10.T6 | **Map screen and route.** M opens the town map; a click sets a waypoint; the route comes from the same A* as traffic and is worked out again within 1 s once the player leaves it | new `src/ui/mapscreen.js`, `src/ui/minimap.js`, `src/sim/traffic.js` (exports the router) | M10.T5 | M10-2 | M |
| M10.T7 | **Car collision.** There is none today (`vehicle.js:1`: "No collision yet — road-clamped only"; only the roadblock collides, `response.js`). The player's car hits traffic, parked cars, police, building footprints and street furniture as 2D boxes from the map, and stops or glances off by the angle; traffic and police brake for it; its check first | new `src/sim/collide.js`, `src/sim/vehicle.js`, `src/sim/traffic.js`, new `tests/accept/m10-collide.spec.js` | M10.T2 | M10-3 (part) | M |
| M10.T8 | **Damage, sim.** Every car has damage 0-1; a hit over 5 m/s adds by speed; at 1 it is a wreck: stopped, blocking its lane, towed 60 s after it is out of view; a wrecked pursuer ends its chase; its check first | `src/sim/vehicle.js`, `src/sim/traffic.js`, `src/sim/wanted.js`, new `tests/accept/m10-damage.spec.js` | M10.T7 | M10-3 (part) | M |
| M10.T9 | **Damage, drawn.** Smoke from 60% as one pooled draw; a wreck darkened, its lights out, tilted | new `src/render/smoke.js`, `src/render/traffic.js`, `src/render/police.js` | M10.T8 | M10-3 | M |
| M10.T10 | **Walkers run.** A car on the pavement within 20 m, a crash or a chase: walkers run from it along their walkway and come back 10 s after it has gone; A/B check first | `src/sim/walkers.js`, new `tests/accept/m10-react.spec.js` | M10.T1 | M10-4 (part) | M |
| M10.T11 | **Witnesses.** A walker who saw a crime calls it in after 5 s unless the player is out of their sight by then; heat rises with the cause "witness"; a dispatch line for it | `src/sim/walkers.js`, `src/sim/wanted.js`, `src/sim/dispatch.js`, `content/dispatch.json` | M10.T10 | M10-4 | M |
| M10.T12 | **Water.** Past the bank a car sinks over 3 s and is gone; the player swims at 1 m/s to the nearest bank and climbs out; no route crosses water; its check first | `src/sim/player.js`, `src/sim/vehicle.js`, `src/sim/terrain.js`, `src/render/player.js`, new `tests/accept/m10-water.spec.js` | M10.T2, M4.T8 | M10-5 | M |
| M10.T13 | **Save** keeps the taken car and where it was left; its check first | `src/sim/save.js`, new `tests/accept/m10-save.spec.js` | M10.T2 | M10-6 | S |
| M10.T14 | **Handbrake and steering.** Space in a car locks the rear: grip drops and the car slides; steering eases with speed across the whole range, not only to 4 m/s (`vehicle.js:33`); its check first | `src/sim/vehicle.js`, `src/game/input.js`, new `tests/accept/m10-handling.spec.js` | M10.T7 | M10-8 | S |
| M10.T15 | **Jump.** Space on foot jumps 0.6 m under gravity; M10.T7's collision boxes get heights, so the player lands on kerbs, benches, car roofs and walls under 1 m and never inside them; the rigged player's jump comes through M2's pipeline; its check first | `src/sim/player.js`, `src/sim/collide.js`, `src/render/player.js`, new `tests/accept/m10-jump.spec.js` | M10.T7, M2.T4 | M10-9 | M |
| M10.T16 | **Nobody passes through anybody.** The player on foot stops against a walker, or shoulders past at a run; a bumped walker turns to look; walkers keep apart from each other; checked in `m10-react.spec.js` | `src/sim/player.js`, `src/sim/walkers.js`, `tests/accept/m10-react.spec.js` | M10.T10 | M10-4 (part) | M |
| M10.T17 | **Knocked down.** Walkers in a car's path dive clear; one the car still reaches falls and gets up after 5 s (a fall and a get-up baked into M2's walker pool); heat rises with the cause "hit" if police or a witness saw it | `src/sim/walkers.js`, `src/sim/wanted.js`, `tools/models/bake_vat.py`, `src/render/npcs.js` | M10.T11, M10.T16, M2.T9 | M10-4 | M |
| M10.T18 | **Going round, and the ram.** A car stopped 5 s behind a wreck or a parked car passes it by the other lane, or waits where there is none; a pursuing cruiser alongside the player's car steers into it; checked in `m10-collide.spec.js` | `src/sim/traffic.js`, `src/sim/wanted.js`, `tests/accept/m10-collide.spec.js` | M10.T8 | M10-3 | M |
| M10.T19 | **Police on foot, sim.** Off the road beyond a cruiser's reach, the nearest unit's two officers get out and run after the player at 5.5 m/s along the walkways; within 1.5 m for 2.5 s they bust; they search where they last saw the player and go back when the search ends; its check first | `src/sim/wanted.js`, `src/sim/walkers.js`, new `tests/accept/m10-foot.spec.js` | M10.T16 | M10-10 (part) | M |
| M10.T20 | **Police on foot, drawn.** Officers are walkers from M2's pool in a uniform tint, with a run; their cruiser's doors open | `src/render/npcs.js`, `src/render/police.js` | M10.T19, M2.T9 | M10-10 | S |
| M10.T21 | **Legend and place names.** The map screen's legend lists every icon; crossing into a district shows its name for 3 s; checked in `m10-map.spec.js` | `src/ui/mapscreen.js`, `src/game/hud.js`, `tests/accept/m10-map.spec.js` | M10.T6 | M10-2 | S |
| M10.T23 | **The street breaks, sim.** Street furniture is registered from the map as breakable things with a mass; `breakAt(x, z, force)` breaks what is in reach; a car over 4 m/s passes through and loses speed and gains damage by mass; a broken lamp is dark, a broken signal leaves its junction uncontrolled; out-of-sight kit is restored after 3 game minutes; saved; its check first | new `src/sim/breakables.js`, `src/sim/collide.js`, `src/sim/vehicle.js`, `src/sim/traffic.js`, new `tests/accept/m10-break.spec.js` | M10.T7, M10.T8, M2.T11 | M10-11 (part) | M |
| M10.T24 | **The street breaks, drawn.** A fallen lamp post or signal is drawn bent and lying from its pool instance; knocked kit tumbles and comes to rest; glass shatters into one pooled shard burst; a broken hydrant sprays for 30 s; at most 2 more draws, measured | `src/render/setdress.js`, `src/render/lamps.js`, new `src/render/debris.js` | M10.T23, M10.T9 | M10-11 | M |
| M10.T25 | **Checks, red: people in cars, cars that break, marks.** `m10-occupants.spec.js`, `m10-wreck.spec.js`, `m10-marks.spec.js` | new files in `tests/accept/` | M10.T1 | M10-12, M10-13, M10-14 red | S |
| M10.T26 | **People in cars.** Car bodies get see-through glass (a glass material with reflection, separate from the paint) and seats; every traffic, police and taxi car carries its driver (police two) from M2's person pool in a seated pose, one instanced draw for all; the player is drawn at the wheel of the car they drive; a carjacked driver is the one who was seated | `tools/models/make_saloon.py`, `src/render/traffic.js`, `src/render/player.js`, new `src/render/occupants.js`, `src/sim/traffic.js` | M10.T4, M2.F2c | M10-12 | M |
| M10.T27 | **Cars break, drawn.** Dents by hit point (vertex offsets per instance), glass cracked then gone with shards through M10.T24's pool, lights out, a loose bumper or door; a burnt-out wreck black | `src/render/traffic.js`, `src/render/debris.js` | M10.T9, M10.T24 | M10-13 (part) | M |
| M10.T28 | **Cars burn and explode.** Fire at 90% damage, the blast 8 s later: the car thrown, cars within 5 m wrecked, walkers within 10 m knocked down (M10.T17), `breakAt` around it; the fireball and fire as one pooled draw that M13's grenades reuse; at most 2 more draws in all, measured | `src/sim/vehicle.js`, `src/sim/traffic.js`, new `src/sim/blast.js`, new `src/render/explosions.js` | M10.T8, M10.T23, M10.T27 | M10-13 | M |
| M10.T29 | **Getting in, seen.** The door opens on its hinge, the person steps in and sits, the door shuts (and the reverse); a carjack drags the driver out through the open door; doors are separate parts of the car body that swing | `tools/models/make_saloon.py`, `src/render/traffic.js`, `src/render/player.js`, `src/render/occupants.js` | M10.T26, M10.T3 | M10-12 | M |
| M10.T30 | **Driving leaves marks.** Tyre marks from slides, hard brakes and wheelspin as one pooled decal ring buffer that fades over 2 game minutes; tyre smoke and contact sparks through M10.T9's pool; at most 2 more draws, measured | `src/sim/vehicle.js`, new `src/render/marks.js`, `src/render/smoke.js` | M10.T14, M10.T9 | M10-14 | M |
| M10.T22 | **Close.** The sweep of every M10 shot; one commit per defect; the M10 keys' hints (M7.T12) | the sweep, `content/hints.json` | all of the above, M7.T12 | M10-7 | M |

## M11 — Something to play for (lane: depth)

The gig board can start once the town exists (M4); each gig kind waits for the tools
it uses.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M11.T1 | **Checks, red.** `m11-gigs.test.js` (Node, five seeds, 10 game hours) and `m11-own.spec.js` | new files in `tests/accept/` | M4 done | M11-1, M11-4 red | M |
| M11.T2 | **Gig board.** `sim/gigs.js`: a gig is `{ kind, client, place, ask, pay, deadline, madeFrom }`, offered from the sim's state and checked against it every tick; shown in the journal with a marker; `docs/GIGS.md` writes down the kinds, the pay and the cred table; a taken gig's time left shows on the HUD | new `src/sim/gigs.js`, `src/render/arcui.js`, new `docs/GIGS.md`, `src/game/hud.js` | M11.T1 | M11-1 (part) | M |
| M11.T3 | **Stall a site, and Tail.** Made from rival sites and the economy's queued firm moves; done when the site has stood frozen 2 minutes, or when the move's destination is learned | `src/sim/gigs.js`, new `tests/accept/m11-stall.spec.js`, new `tests/accept/m11-tail.spec.js` | M11.T2, M6.T16, M6.T20 | M11-2 (part) | M |
| M11.T4 | **Lights out, and Delivery.** Made from rival shops and residents' jobs across the town | `src/sim/gigs.js`, new `tests/accept/m11-lights.spec.js`, new `tests/accept/m11-delivery.spec.js` | M11.T2, M10.T2 | M11-2 (part) | M |
| M11.T5 | **Clear the way, and Build to order.** Made from late commuters at a junction and residents in poor districts | `src/sim/gigs.js`, new `tests/accept/m11-clear.spec.js`, new `tests/accept/m11-build.spec.js` | M11.T2, M6.T7, M5.T15, M5.T16 | M11-1, M11-2 | M |
| M11.T6 | **Clients remember; sell to the target.** A lapsed gig's client offers nothing for 30 game minutes; a gig sold to its target is paid by the target, and the client offers nothing for the rest of the game day | `src/sim/gigs.js`, new `tests/accept/m11-sell.spec.js` | M11.T3, M11.T4 | M11-3 | M |
| M11.T7 | **Buy a building.** A price from its stage and its district's wealth (formula in `ECONOMY.md`); holding E at the door for 1 s buys (tap E still goes in); every game hour it pays the owner's share of the lot's trade | new `src/sim/property.js`, `src/sim/economy.js`, `docs/ECONOMY.md` | M11.T1 | M11-4 (part) | M |
| M11.T8 | **Safehouse.** An owned building's room is a save point, and a game saved there continues there | `src/sim/interior.js`, `src/sim/save.js`, `src/savestore.js` | M11.T7 | M11-4 (part) | S |
| M11.T9 | **Where the money came from.** Each payout (a gig, a building's hour) is a line in the journal and the news, so the ₡ on the HUD is never a mystery (pillar 5) | `src/render/arcui.js`, `src/sim/news.js` | M11.T7 | M11-4 | S |
| M11.T10 | **Cred.** Gigs and missions give cred; the tiers in `GIGS.md` unlock a bigger battery, a 60 m hack range, a faster break-in and better-paid kinds; the HUD shows cred and the next unlock | new `src/sim/cred.js`, `src/sim/battery.js`, `src/sim/hackables.js`, `src/game/hud.js`, new `tests/accept/m11-cred.test.js` | M11.T2, M6.T5 | M11-5 | M |
| M11.T11 | **Save** keeps the gigs on offer, what each client remembers, cred and owned buildings | `src/sim/save.js`, new `tests/accept/m11-save.spec.js` | M11.T6, M11.T8, M11.T10 | M11-6 | S |
| M11.T12 | **Talk, the sim.** New `sim/talk.js` makes a walker's lines from their sim state: their job and home (`people.js`), their district's last news, sometimes a gig lead (`gigs.js`); short answers in a district the player has hurt (blackouts, stalls, theft); its check first | new `src/sim/talk.js`, new `tests/accept/m11-talk.spec.js` | M11.T2 | M11-8 (part) | M |
| M11.T13 | **Talk, shown.** Tap E at a walker within 2 m with no door nearer: they stop and face the player, and up to three lines show as subtitles in the arc's style; a lead opens on the gig board | `src/game/input.js`, `src/render/arcui.js`, `src/sim/walkers.js` | M11.T12 | M11-8 | M |
| M11.T14 | **A bust costs money.** A bust takes 10% of the ₡ held *(provisional)* from the wallet the arc pays into; the news line says how much; checked in `m11-own.spec.js` | `src/sim/arc.js`, `src/sim/news.js`, `tests/accept/m11-own.spec.js` | M11.T9 | M11-4 | S |
| M11.T15 | **Close.** The sweep of every M11 shot; one commit per defect; the M11 keys' hints (M7.T12) | the sweep, `content/hints.json` | all of the above, M7.T12 | M11-7 | M |

## M12 — The city runs on something (lane: city; T11 in assets)

Power is two deadlines today (`street.js` `darkUntil`), with nothing that makes it or
uses it. M12 gives the city the utilities a Skylines player meets first. Pipes and
cables are not drawn: they are taken to run under every road.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M12.T1 | **Checks, red.** `m12-power.test.js`, `m12-water.test.js`, `m12-garbage.test.js`, `m12-fire.spec.js` (A/B, Node where they can be) | new files in `tests/accept/` | M5 done | M12-1 to M12-4 red | M |
| M12.T2 | **Power, sim.** Plants make MW; districts use MW by floor area (formula in `ECONOMY.md`); substations carry a district's share; when demand passes supply, blocks go dark in turn through the blackout's own `darkUntil`, cause "short of power"; H still works through the same code; the dark blocks show M5-16's icon "no power" | new `src/sim/power.js`, `src/sim/street.js`, `src/sim/economy.js`, `docs/ECONOMY.md`, `src/sim/decline.js` | M12.T1 | M12-1 (part) | M |
| M12.T3 | **Power, tools.** Place a plant; the power overlay shows supply against demand per district; the news names a shortfall | `src/sim/cityview.js`, `src/ui/cityview.js`, `src/render/overlays.js`, `src/sim/news.js` | M12.T2 | M12-1 | M |
| M12.T4 | **Water, sim.** A pumping station on a river bank and a treatment plant; a parcel on a road joined to both has water; a lot without it stops at LOW with the reason "no water"; M5-16's icon shows it | new `src/sim/water.js`, `src/sim/zoning.js`, `src/sim/decline.js` | M12.T1 | M12-2 (part) | M |
| M12.T5 | **Water, tools and river.** Place both; the treatment plant's outflow shows downstream on the pollution overlay | `src/sim/cityview.js`, `src/render/overlays.js`, `src/sim/pollution.js` | M12.T4 | M12-2 | S |
| M12.T6 | **Garbage, sim.** Buildings make garbage by stage; a depot's trucks collect along the roads up to its capacity; uncollected garbage lowers land value, reason "no collection"; M5-16's icon shows it | new `src/sim/garbage.js`, `src/sim/economy.js`, `src/sim/decline.js` | M12.T1 | M12-3 (part) | M |
| M12.T7 | **Garbage, drawn.** Bags pile on the pavement in front of an uncollected building, one pooled draw | new `src/render/litter.js` | M12.T6 | M12-3 | S |
| M12.T8 | **Fire, sim.** Buildings catch fire at a rate in `ECONOMY.md` *(provisional)*, by use and stage; with no truck in reach, a stage is lost each minute; M5's alarm becomes a fire's first minute | new `src/sim/fire.js`, `src/sim/alarms.js`, `src/sim/zoning.js` | M12.T1 | M12-4 (part) | M |
| M12.T9 | **Fire, drawn.** Flames and smoke on the burning building, pooled with M10's smoke | `src/render/smoke.js`, new `src/render/flames.js` | M12.T8, M10.T9 | M12-4 | M |
| M12.T10 | **Fleets.** Fire trucks, garbage trucks and ambulances are cars in M3's traffic with a job: they leave their building, take the A* route, stop at lights and come back; a fire is out when the truck has stood at it for its burn time | `src/sim/traffic.js`, `src/sim/fire.js`, `src/sim/garbage.js` | M12.T8, M12.T6 | M12-5 (part) | M |
| M12.T11 | **Fleet bodies** (lane: assets). Three models through the M2 pipeline, in the traffic pools; at most 3 more draws | `public/assets/models/`, `src/render/traffic.js` | M2.T6 | M12-5 | M |
| M12.T12 | **Upkeep.** Plants, pumps, treatment plants and depots in the budget; in debt they shut farthest first (M5-6's rule) | `src/sim/budget.js` | M12.T3, M12.T5, M12.T6 | M12-6 | S |
| M12.T13 | **Save** keeps every utility and fleet; its check first | `src/sim/save.js`, new `tests/accept/m12-save.spec.js` | M12.T12 | M12-7 | S |
| M12.T14 | **Close.** The sweep of every utility at day and night; one commit per defect; the M12 keys' hints | the sweep, `content/hints.json` | all of the above, M7.T12 | M12-8 | M |

## M7 — Sound and the front door (lane: front door)

There is no audio code today. The browser's own Web Audio does the job without a
package. Sounds are CC0 only (`ASSETS.md`); "royalty-free" packs whose licence is not
CC0 are not used without the operator's yes.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M7.T1 | **Audio engine.** Web Audio context started on the first input; the listener follows the camera; pooled positional sources; master, effects and ambience buses; silent under `?capture=1` unless asked; `__game.sounds()` lists what plays | new `src/audio/engine.js`, `src/game/scene.js` | M3.T5 | M7-1 (part) | M |
| M7.T2 | **The sound set.** A fetch script with checksums for each CC0 sound, the horn and a completion sting among them, each in `CREDITS.md`; `m7-sound.spec.js` first | new `tools/sounds/fetch.sh`, `public/assets/sounds/`, `public/assets/CREDITS.md`, new `tests/accept/m7-sound.spec.js` | M7.T1 | M7-1 (part) | S |
| M7.T3 | **Street ambience** by hour and district kind; traffic hum from the commute flow; crowd from walkers nearby | new `src/audio/ambience.js` | M7.T2 | M7-1 (part) | M |
| M7.T4 | **Engines and the horn.** The hero car's pitch rises with speed; traffic passes by; E in a car sounds the horn | new `src/audio/vehicles.js` | M7.T2 | M7-1 (part) | M |
| M7.T5 | **Police.** Sirens on active units; dispatch crackle under the subtitles | `src/audio/vehicles.js`, `src/ui/dispatch.js` | M7.T4 | M7-1 (part) | S |
| M7.T6 | **Sites.** Crane and site sounds at working lots | new `src/audio/sites.js` | M7.T2 | M7-1 (part) | S |
| M7.T7 | **Blackout.** The district's hum dies and comes back with the lights | `src/audio/ambience.js` | M7.T3 | M7-1 | S |
| M7.T8 | **Title screen.** New Game, Continue (disabled with no save), Settings, by mouse; New Game shows the new city's seed with a reroll, and takes a typed seed; `m7-title.spec.js` first; a city name made from the seed, which the player can change, shown on the HUD and the save slot | new `src/ui/title.js`, `src/boot.js` | M3.T5 | M7-2 | M |
| M7.T9 | **Pause.** Esc holds the fixed-step loop and shows a menu; Esc resumes; its check first | new `src/ui/pause.js`, `src/game/loop.js`, new `tests/accept/m7-pause.spec.js` | M7.T8 | M7-3 | S |
| M7.T10 | **Settings.** Mouse speed and invert, volumes, quality (shadow distance, resolution scale), field of view, full screen, subtitle size; stored the way `savestore.js` stores the save; its check first | new `src/ui/settings.js`, new `src/settingsstore.js`, new `tests/accept/m7-settings.spec.js` | M7.T8 | M7-4 (part) | M |
| M7.T11 | **Key bindings.** A rebinding screen; `input.js` reads the bindings | `src/ui/settings.js`, `src/game/input.js` | M7.T10 | M7-4 | M |
| M7.T12 | **First hints.** One hint per key, gone once done, read from `content/hints.json`: Z, E, F and H now; each later milestone's close adds its own keys; its check first | new `src/ui/hints.js`, new `content/hints.json`, new `tests/accept/m7-hints.spec.js` | M7.T8 | M7-5 | S |
| M7.T13 | **60 fps.** `scripts/fps.mjs` reads the 95th-percentile frame at the busiest pose at 1280 × 720 and full Retina size; quality defaults set until it is under 16.7 ms (16.8-17.6 ms at the spawn today) | new `scripts/fps.mjs`, `src/render/atmosphere.js` | M7.T10 | M7-6 | M |
| M7.T14 | **Save slots.** Three slots, each named by its city's name, seed, population and save time; the pause menu saves to the slot at once; New Game takes an empty slot or asks before it replaces one; N in play asks first, in the page; today's single save moves into slot 1; its check first | `src/savestore.js`, `src/ui/title.js`, `src/game/input.js`, new `tests/accept/m7-slots.spec.js` | M7.T8 | M7-7 | M |
| M7.T15 | **Gamepad.** The browser's Gamepad API, standard mapping: move, look, run, drive, enter, hack, journal; the city view stays mouse and keys; the bindings screen shows the pad; its check first (a fake pad behind `navigator.getGamepads`) | `src/game/input.js`, `src/ui/settings.js`, new `tests/accept/m7-gamepad.spec.js` | M7.T11 | M7-8 | M |
| M7.T16 | **When the GPU fails.** With no WebGL, or when the context is lost, the page says so in words and what to try; a context that comes back restores the game; its check first (the test forces a lost context with `WEBGL_lose_context`) | `src/boot.js`, new `src/ui/gpufail.js`, new `tests/accept/m7-webgl.spec.js` | M7.T8 | M7-9 | S |
| M7.T17 | **Music.** CC0 tracks fetched with checksums the way the sounds are, each in `CREDITS.md`; a title theme; a score under the arc's missions that turns urgent when `wanted.js` starts a chase and settles when it ends; `m7-music.spec.js` first | new `src/audio/music.js`, `tools/sounds/fetch.sh`, `public/assets/CREDITS.md`, new `tests/accept/m7-music.spec.js` | M7.T2 | M7-10 (part) | M |
| M7.T18 | **Car radio.** In a car, B cycles two stations and off; getting back in, a station plays on from where it would have been; one station if CC0 cannot fill two | `src/audio/music.js`, `src/game/input.js` | M7.T17 | M7-10 | S |
| M7.T19 | **Close.** The sweep of the title, pause, settings, slots, hints and the GPU message; one commit per defect | the sweep | all of the above | M7 | M |

## M8 — The sell check

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M8.T1 | **Ready.** `npm run accept` at speed 1 on every criterion; the full sweep of every milestone's poses; one commit per defect | the sweep | M1-M7, M10, M11 done, M8.T4 | M8-1 | M |
| M8.T2 | *Operator* plays 20 minutes and says sell, rework or stop | — | M8.T1 | M8-2 | — |
| M8.T3 | *Operator's choice:* 2-3 players, 15 minutes each, notes in `docs/playtest/` | new `docs/playtest/` | M8.T1 | M8-3 | — |
| M8.T4 | **Licence,** as the operator decided (D11): `package.json` gets `"license": "UNLICENSED"` and `"private": true`, there is no LICENSE file, and a gate check fails if either changes or a LICENSE file appears | `package.json`, `scripts/check_licence.mjs` (new) | D11 | M8-1 | S |

## M9 — Ship on Steam (lane: ship)

M9 closes last, after M13 to M34. M9.T2 (the Steam binding), M9.T4 (the Windows
package), M9.T7 (the event tape and achievements) and M9.T8 (cloud saves) run as soon as
M8-2 says sell, because M29, M30 and M31 build on them.

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M9.T1 | *Operator* registers on Steamworks ($100) and gives the app id | `steam_appid.txt` | M8-2 says sell | M9-1 | — |
| M9.T2 | **The Steam binding.** Check whether `greenworks` (the old code's choice) still builds against today's Electron; if it does not, the alternative is an npm package, so the *operator* decides | `electron.cjs`, `greenworks.json`, new `docs/spikes/m9-steam.md` | M9.T1 | M9-2 (part) | S |
| M9.T3 | **macOS package.** `npm run electron:build` from a clean clone starts the game; `scripts/ship-check.mjs` boots the packaged app and reads the first frame | new `scripts/ship-check.mjs`, `package.json` | M9.T2 | M9-2 (part) | M |
| M9.T4 | **Windows package,** built and started on the operator's Windows PC with the same script, which also reads the draws and the 95th-percentile frame at the busiest pose | `scripts/ship-check.mjs` | M9.T3 | M9-2 | S |
| M9.T5 | **Old saves.** A save from the M8 build loads in the ship build; every save version has a migration and a test | `src/sim/save.js`, new `tests/accept/m9-old-save.test.js` | M8.T1, M13 to M34 closed | M9-3 | S |
| M9.T6 | **The store page.** 5 screenshots and a 30-60 s trailer recorded from the game with the browser's own `MediaRecorder`; the sweep checks them; `git log` shows only fixes since M8-2 | new `scripts/trailer.mjs` | M9.T3, M13 to M34 closed | M9-4, M9-5 | M |
| M9.T7 | **Achievements.** At least 10, each from an event on a new event tape (`src/sim/events.js`) that the news, the journal and the arc write to; nothing logs events today, `news.js` keeps only the live line (the first building grown, the first gig, a chase escaped, a district opened…), through the Steam binding; listed in `docs/STEAM.md` | `electron.cjs`, new `src/steam.js`, new `docs/STEAM.md`, new `src/sim/events.js`, `src/sim/news.js` | M9.T2 | M9-6 (part) | M |
| M9.T8 | **Cloud saves.** The save slots sync through Steam Cloud; a game saved on the Mac continues on Windows | `electron.cjs`, `src/savestore.js` | M9.T2, M7.T14 | M9-6 (part) | S |
| M9.T9 | **Depot upload.** One script builds both packages and uploads them to the Steam depot with SteamCMD; the operator types their own login | new `scripts/steam-upload.sh` | M9.T4 | M9-6 | S |
