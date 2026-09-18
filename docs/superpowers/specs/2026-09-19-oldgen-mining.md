# Mining the pre-rewrite city generator

Working reference for wave 2. Audit of `src/gen/` on the frozen branch
`archive/pre-rewrite` @ `955d662`, against `main`'s `src/sim/world.js`.

All citations are `955d662:<path>:<line>` unless the path starts with `src/` alone,
which means the current tree.

**Verdict: mine it, do not port it.** The old generator produces a tile raster, not
a road graph. Its roads have no nodes, intersections, adjacency or lanes; its terrain
is a categorical tile enum forced to 100% grass above width 40 (`955d662:src/map.js:70-80`);
its districts and parcels reached the screen only as debug-overlay colour swatches
(`955d662:src/renderer3d.js:6964, 6989-7001`). Adopting its output means writing a
raster-to-centreline skeletoniser that never existed, then deleting `src/sim/world.js`
and everything reading `nearestEdge()`.

What follows is what is worth taking out of it.

---

## 1. The ordering correction — recorded, not buried

**The old generator did not share this game's inverted ordering. It got that right.**

The working assumption going into wave 2 was that the old code carved terrain
downstream of placement, the way the current tree does — the buried river, the route
through ten towers, the hand-copied footprint table holding the ground up under
buildings standing where they should never have been placed.

It does not. `955d662:src/map.js:60-125` (`Map.generate()`) runs:

```
terrain grid          map.js:62-95      categorical enum written first
resource clusters     map.js:97-111     parks / forest
createStartingArea    map.js:114        flatten the spawn
_carveUrbanCanals     map.js:115        WATER IS CUT HERE
generateDistricts     map.js:118
generateRoads         map.js:121
generateParcels       map.js:124
generatePOIs          map.js:125
```

Water is authored **before** districts, roads, parcels and POIs. Terrain is upstream.
That is the wave 2 design.

**So the ordering is not something to invent. It is something this project already
had and lost.**

The rest of this section is the caveat, and it is the important half.

### One non-asking consumer was enough to poison it

Three of the four downstream placers query terrain before placing. The fourth does not,
and that single omission is why the old city has roads running across open water:

- `drawRoad` (`955d662:src/gen/roads.js:204-245`) writes `roadMap[idx] = 1` and
  **never reads `grid`**. Not once. Water is sitting right there in the same object.
- Consequence: `955d662:src/map.js:224` carries the comment *"Roads will bridge it via
  TERRAIN_BRIDGE handling in Map"*. That handling does not exist. `TERRAIN_BRIDGE` is
  defined at `955d662:src/constants.js:23`, read at `955d662:src/renderer3d.js:2487`,
  and **written by nothing in the entire tree.** The bridge system is a comment.

**Rule for wave 2:** correct ordering is necessary and not sufficient. Make the
terrain/water query a **precondition every placer must call** — one shared predicate
that placement code cannot proceed without — not a courtesy that three of four
happen to observe.

---

## 2. Footprint testing, not centre-point testing

**This is the single most transferable thing in the old tree**, and the old tree
contains both the right pattern and the wrong one, which makes the contrast usable.

Centre-point testing is what lets a 7 m tower with its centre on dry land overhang
6 m of water. It is the ten-tower overlap the current game is living with.

### The wrong one — centre-point, and it is the one everything used

`955d662:src/map.js:268-271`:

```js
isValidPlacement(x, y) {
    const tile = this.getTileAt(x, y);
    return tile !== null && tile !== TERRAIN_WATER;
}
```

One tile. No size, no footprint, no rotation. Its callers —
`955d662:src/buildings.js:377-380` and `955d662:src/citizen.js:277` — inherit the
fault verbatim. A building of any size is validated by its origin tile alone.

### The right one — whole footprint, per tile, with a reason

`955d662:src/content/poi_templates.js:184-210` (`validateSpawnLocation`):

```js
export function validateSpawnLocation(template, map, x, y, width) {
    const { avoid_water, avoid_roads } = template.spawn_rules;
    const { width: sizeW, height: sizeH } = template.size;

    // Bounds are checked against the FAR corner, not the origin.
    if (x < 0 || y < 0 || x + sizeW > width || y + sizeH > map.height) {
        return { valid: false, reason: 'Out of bounds' };
    }

    // Every tile the footprint covers, not the centre.
    for (let dy = 0; dy < sizeH; dy++) {
        for (let dx = 0; dx < sizeW; dx++) {
            const px = x + dx;
            const py = y + dy;
            const idx = py * width + px;

            if (avoid_water) {
                const terrain = map.grid[py][px];
                if (terrain === 0) return { valid: false, reason: 'Water tile' };
            }
            if (avoid_roads) {
                if (map.roadMap[idx] === 1 || map.sidewalkMap[idx] === 1) {
                    return { valid: false, reason: 'Road tile' };
                }
            }
        }
    }
    return { valid: true };
}
```

Four properties worth copying exactly:

1. **The footprint loop.** Every covered tile is tested, so a partial overhang fails.
2. **Bounds tested at `x + sizeW`, not `x`.** The far corner, not the origin.
3. **Constraints come from the item** (`template.spawn_rules`), not from the caller.
   A new prop type declares what it cannot sit on.
4. **It returns `{ valid, reason }`, not a boolean.** The reason is what makes a
   generation failure debuggable instead of a silent absence.

### Porting it to metres

`world.js` has no tiles, so the loop becomes an AABB-vs-field test: sample the
terrain/water field at the footprint's corners **and** at any interior spacing finer
than the field's own feature size, or test the footprint rectangle against the water
polygon directly. **Corners alone are not enough** — a footprint can straddle a
narrow channel with all four corners dry. Whatever the shape, keep properties 2–4
verbatim; they cost nothing and they are where the old code was right.

---

## 3. The mining list

Seven items. Everything worth taking, and nothing else.

### Item 1 — spacing hierarchy · `955d662:src/gen/roads.js:35-36`

- **Valuable:** grid spacing scaled to map size, and *every 4th line is an avenue at
  double width*. This is what makes a grid read as a city rather than graph paper.
- **Change:** becomes `lanes: 2` vs `lanes: 1` on a `world.js` span. Trivial.

### Item 2 — the kink · `955d662:src/gen/roads.js:136-171` (`drawAxisRoad`)

- **Valuable:** 35% chance an avenue takes a single 1-unit jog at mid-span, gated on
  span length > 12. Best visual idea in the file — it kills the laser-perfect grid
  tell for about fifteen lines of work.
- **Change:** emit two avenue spans at slightly different `x` plus a short connector
  span between them. The graph handles it for free; `addChain` already cuts spans
  at crossings.

### Item 3 — mid-block alleys · `955d662:src/gen/roads.js:102-127`

- **Valuable:** 18% of blocks get one alley at half-spacing length, random
  orientation. Watch Dogs street texture for almost nothing.
- **Change:** extra `lanes: 1` spans inside a block.

### Item 4 — the core/rim split · `955d662:src/gen/roads.js:42-43` (`coreInset`)

- **Valuable:** roads exist only inside an inset box; outside stays unstreeted. Stops
  the generator paving the whole world and gives a natural city edge.
- **Change:** nothing — this is `drive` bounds being tighter than `walk` bounds, which
  `src/sim/world.js:34-40` already models. It confirms the existing design rather
  than changing it.

### Item 5 — the radial geography pass · `955d662:src/map.js:144-165`

- **Valuable:** the only real design judgement on the branch. Normalised radial
  distance from centre picks the theme:

  | band | themes |
  |---|---|
  | `< 0.22` | elite / commercial |
  | `< 0.38` | commercial / oldtown |
  | `< 0.60` | residential / suburbs |
  | else | industrial / suburbs |

  plus a harbor-edge override at `map.js:153` that **wins over** the radial rule.
  Each band is a coin-flip between two themes so the rings are not uniform.
- **Change:** it reads `d.center` off flood-filled blobs; evaluate it per authored
  district box instead. ~20 lines. **Keep the override-before-radial ordering** —
  geography beats distance, which is right.

**Is `theme` actually consumed, or is it dead like `densityTarget`?** It is consumed.
This is the one field that is genuinely load-bearing:

- `955d662:src/renderer3d.js:4352-4372` — tuned per-theme tables for **grime**
  (`industrial 0.8 … elite 0.05`), **posters** (`oldtown 0.8 … suburbs 0.05`),
  **poster layers** (`oldtown: 3, commercial: 2`), **graffiti faction colour +
  chance**. Applied at `:4395, :4434, :4440, :4472`; cached at `:519`.
- `955d662:src/buildings.js:279-287` — `DISTRICT_THEME_BONUSES[theme][type]`
  multiplies income.
- `955d662:src/audio/soundscape.js:95` — ambient bed per theme.
- `955d662:src/sim/politics/pressure_map.js:116`,
  `955d662:src/sim/cases/assembler.js:11`,
  `955d662:src/sim/campaign/case_generator.js:162`,
  `955d662:src/sim/quests/quest_engine.js:500, :617` — mission/case targeting.
- `955d662:src/ui/map_screen.js:178`, `955d662:src/dev/dev_menu.js:941` — map colour,
  debug readout.

**But be precise about what that buys.** Theme drives **decoration, income and quest
targeting**. It drives **no massing** — no building height, footprint or count is a
function of theme or distance anywhere on the branch.

- You **inherit a tuned curve** for surface differentiation. The eight-entry
  grime/poster/graffiti ladders at `renderer3d.js:4352-4372` are hand-tuned, actually
  consumed, and good. Steal the numbers nearly verbatim for facade decals.
- You **inherit only the idea** for a downtown → suburb → outskirts silhouette.
  Nobody ever built it. That is still ours to write.

### Item 6 — two-phase rejection sampling · `955d662:src/content/poi_templates.js:222-247`

- **Valuable:** sample candidates from the region's **member-tile list** first
  (`:232-247`), fall back to its bounding box only after N failures (`:252-262`).
  Bbox-first sampling burns attempts in the empty corners of concave regions.
- **Change:** our districts are boxes, so today the fallback *is* the primary — keep
  the two-phase shape anyway so it survives non-rectangular districts. Add the
  road-**adjacency** test it lacks: it has `avoid_roads` but never `require_frontage`,
  which is why a POI can land mid-block with no way to reach it.

### Item 7 — constraints as data · `955d662:src/content/poi_templates.js:14-148`

- **Valuable:** `{ id, name, type, size{w,h}, attributes{}, spawn_rules{
  min_district_size, avoid_water, avoid_roads, priority } }`. A new landmark is a
  data entry, not a code path, and `spawn_rules` is the placement predicate's input
  declared next to the thing it governs.
- **Change:** re-author as JSON under `src/content/` with a
  `scripts/validate_content.mjs` entry, matching the signs/missions pattern. Tile
  `size{w,h}` becomes metres. Do not copy the JS file; it carries the bugs in §6.

### Not worth taking

- `955d662:src/gen/pipeline.js` — see §4.
- `955d662:src/gen/parcels.js` — rect-splitting a tile raster is meaningless without
  tiles, and it has no frontage concept at all (see §6).
- `955d662:src/gen/pois.js` — the spawner class. Two real bugs; re-author.
- `955d662:src/gen/districts.js` flood fill — wrong primitive for road-graph
  districts. **Caveat in §8.**

### The third placement predicate

Named for completeness alongside the two in §2 — `955d662:src/build/placement.js:17-56`
(`validatePlacement`), 56 lines and the best-shaped file on the branch:

```js
export function validatePlacement(game, type, x, y, rotation = 0) {
    const buildingDef = BUILDING_TYPES[type] || BUILDING_SECURITY[type];

    if (!buildingDef) return { ok: false, reason: 'Unknown building type.' };
    if (!Number.isInteger(x) || !Number.isInteger(y))
        return { ok: false, reason: 'Invalid build coordinates.' };
    if (x < 0 || y < 0 || x >= map.width || y >= map.height)
        return { ok: false, reason: 'Out of map bounds.' };

    const parcelId = map.getParcelAt?.(x, y);
    if (parcelId === undefined || parcelId === null || parcelId < 0)
        return { ok: false, reason: 'Must be placed inside a parcel.' };

    const terrain = map.getTileAt(x, y);
    if (terrain === TERRAIN_WATER) return { ok: false, reason: 'Cannot build on water.' };
    if (map.roadMap?.[idx] === 1 || map.sidewalkMap?.[idx] === 1)
        return { ok: false, reason: 'Cannot build on roads or sidewalks.' };

    const occupied = buildings.getBuildingsAt(x, y);
    if (occupied.length > 0) return { ok: false, reason: 'Tile already occupied.' };

    const cost = buildingDef.cost || {};
    const insufficientFunds = checkInsufficientFunds(resources, cost);

    return {
        ok: !insufficientFunds,
        warning: insufficientFunds,          // distinct from a hard failure
        reason: insufficientFunds ? 'Insufficient funds.' : '',
        parcelId, rotation: ((rotation % 4) + 4) % 4, cost,
        upkeep: buildingDef.upkeep || 0,
    };
}
```

Worth copying: **every rejection carries a distinct reason string**; `warning` is
separated from `ok` so a soft failure (affordability) is not conflated with a hard
one (water); and the success return **carries the derived data the caller needs**
(`parcelId`, normalised `rotation`, `cost`, `upkeep`) so the caller never re-derives it.

Not worth copying: it is centre-point, like `map.js:268`. Combine this **shape** with
§2's **footprint loop**.

---

## 4. `gen/pipeline.js` — the verdict

**Ordering: keep. Stage interface: leave. State handoff: there is not one.**

Fair description as *intent*: `addPhase(name, generatorFn, maxSteps)` queues phases;
`runFrame()` (`955d662:src/gen/pipeline.js:71-128`) runs `ceil(maxSteps/20)` steps then
returns so a rAF loop can drive it; there is a progress callback, `cancel()`, and a
`runSync()` escape hatch.

### It never executed, once

- `GenerationPipeline` is constructed in exactly one place —
  `createMapGenerationPipeline` at `pipeline.js:194` — and **that function has no
  callers anywhere on the branch.** `map.js` imports districts/roads/parcels/pois and
  never this file. No test. No import. It has never run.
- It **cannot** run: `pipeline.js:34` calls `new RNG(seed)` with **no import for
  `RNG`** → `ReferenceError` in the constructor.
- The file **does not parse**. Verified with `node --check`:
  `SyntaxError: Unexpected reserved word` at `pipeline.js:351` — `await` inside a
  non-async `function*` in a module. It would fail `npm run build` on `main` today.
- Phases 5 / 6 / 7 (Roads, Parcels, Buildings) are empty counters
  (`pipeline.js:293-311`). There is no generation in it.

### Why the shape is not worth keeping either

- **The stage interface is not a contract.** `generatorFn(step)` returns only
  `{ done }`. It takes no input and produces no output.
- **Stages do not hand state along.** They all close over the same mutable `map` god
  object and mutate it in place (`pipeline.js:212, :232, :262`). There is no stage
  boundary, so you cannot run stage 4 without having run 1–3, cannot test a stage in
  isolation, and cannot diff a stage's output. **That is the reason it was untestable,
  therefore never tested, therefore never run.** The dead code and the missing
  contract are the same fact.
- **Its budget is step-count, not time** (`stepSize = maxSteps / 20`,
  `pipeline.js:85`) — a fixed 1/20th of work per frame regardless of cost, which is
  precisely the wrong control variable for a hitch.
- `getStatus()` and `getTotalProgress()` divide by two different denominators for the
  same number. `PipelineProgress` stamps `Date.now()` (`:23`) into generator state.

**The ordering in it is worth keeping, but the authority for that ordering is
`map.js:60-125`, which actually ran.** The pipeline's copy is the imitation.

### What to write instead

`stage(input) → output`, pure, each stage's output being the next's input — which is
already how `src/sim/world.js` works (authored spans → derived `NODES`/`EDGES`).

For `src/render/chunks.js`, write a fresh budgeted queue, roughly fifteen lines:

- Pending-build queue; `update()` drains until a `performance.now()` deadline, with a
  max-N-per-frame guard so one pathological tile cannot blow the budget.
- **Keep the 32-tile first fill synchronous, before the first presented frame.**
  Amortise *streaming* builds only, or the player watches the city pop in.

Adopting `pipeline.js` means debugging someone's never-run draft to get a worse
budget model.

---

## 5. What should be JSON, and what must stay code

The test, stated first, because "constraints as data" over-applies easily:

> **Flatten to JSON when the entry is a *fact about one thing*, enumerable and
> finite, that a human will want to add to without reading code. Keep as code when
> the value is a *function of the world* — when it depends on other entries, on
> position, on time, or on anything computed at generation.**

Three corollaries that catch most of the bad calls:

1. **A lookup table keyed by a closed set is data. A curve is code.** `GRIME_BIAS`
   has eight keys and no arithmetic — data. The radial band selection in
   `map.js:144-165` is a function of distance with thresholds and coin-flips — code,
   with its thresholds named as constants next to it.
2. **If flattening it forces you to invent a mini-language, stop.** The moment JSON
   needs `"when": "distNorm < 0.38"` you have written an interpreter, and the
   validator can no longer tell you if it is correct. That is worse than a function.
3. **If two entries can contradict each other, it is code.** Data files cannot
   express precedence. The harbor override beating the radial rule (`map.js:153`) is
   exactly this — as data it is two rules with no stated winner.

Applied to the old content pipeline:

| Thing | Where | Verdict |
|---|---|---|
| POI templates | `955d662:src/content/poi_templates.js:14-148` | **JSON.** Finite, per-item, no cross-references. `spawn_rules` is a flag set, not a computation. Already called in item 7. |
| Per-theme decoration ladders | `955d662:src/renderer3d.js:4352-4372` | **JSON.** Eight closed keys, pure lookup, and the exact thing an artist will want to tune without opening a `.js`. `POSTER_COLORS` (`:4365`) too. |
| `DISTRICT_THEME_BONUSES` | used at `955d662:src/buildings.js:283` | **JSON.** A two-level table keyed by theme then building type. Pure lookup. |
| District name pools | `955d662:src/gen/districts.js:6-23` | **JSON.** Eighty strings in eight lists. The single clearest case on the branch. |
| `getBuildingPools(theme)` | `955d662:src/gen/districts.js:249-260` | **JSON.** It is a `switch` pretending to be a function; every arm is a literal array. |
| `getZoneTypeForDistrict` | `955d662:src/gen/parcels.js:190-198` | **JSON — and note the bug the flattening fixes.** As code its `|| ZONE_RESIDENTIAL` silently swallowed three real themes (§6.4). As a validated JSON map, `validate_content.mjs` can assert **every** theme has an entry, and the fault becomes a gate failure instead of a wrong city. *This is the strongest argument for the rule.* |
| Radial band thresholds | `955d662:src/map.js:154-158` | **Code.** Ordered predicates with a precedence rule (harbor beats radial) and randomness inside each band. Corollaries 2 and 3 both fire. |
| Road spacing / avenue-every / kink chance / alley chance | `955d662:src/gen/roads.js:35-36, :105, :138` | **Code, with named constants.** They are arguments to a generation algorithm, not facts about an object. Naming them next to the algorithm satisfies AGENTS.md; a JSON file just moves them somewhere the algorithm cannot be read beside them. |
| Terrain / zone / road colour tables | `955d662:src/gen/roads.js:8`, `955d662:src/gen/parcels.js:11`, `955d662:src/constants.js:40` | **Neither — they are render data and must not live in `src/sim/` at all.** See §6.1. If they become JSON they belong to the renderer. |

---

## 6. Anti-patterns — what the new generator must not repeat

1. **Render data in sim files.** `ROAD_COLORS` (`955d662:src/gen/roads.js:8`) and
   `ZONE_COLORS` (`955d662:src/gen/parcels.js:11`), consumed by
   `955d662:src/ui/map_screen.js:4-5`. Law 5 in spirit; `check:boundary` would not
   catch it because a hex string is not an import.
2. **Silently unconnected districts.** `955d662:src/gen/roads.js:84-92` spurs each
   district centre to the nearest road within radius 10; if there is none, it does
   nothing and reports nothing. A district can be generated with no road to it.
3. **Validators written and never called.** `validateRoadConnectivity`
   (`955d662:src/gen/roads.js:377`) is a correct-looking BFS that is exactly the test
   for fault 2 — and nothing invokes it. Same for `validateDistrictContiguity`
   (`955d662:src/gen/districts.js:298`). See §7.
4. **A `default:` that swallows real cases.** `955d662:src/gen/parcels.js:193-197`
   has no `docks` / `suburbs` / `oldtown` entry; `955d662:src/map.js:154-158`
   actively assigns all three; every such block silently zones residential.
5. **No frontage concept in lot subdivision.** `createParcelsForBlock`
   (`955d662:src/gen/parcels.js:101`) takes the block bbox and cuts it into
   `w/3 × h/3` rectangles (`:124-126`), keeping any with ≥ 6 tiles. It does not know
   which side the road is on. No street-facing axis, no depth-vs-width distinction,
   no corner handling. **The classic subtle failure, made in full.**
6. **`Uint8Array` with 255 as sentinel for unbounded ids.** `blockMap`
   (`955d662:src/gen/roads.js:280`), `districtMap`
   (`955d662:src/gen/districts.js:37`). Worse: `roads.js:34-35` openly states the
   spacing constants were **tuned to dodge the overflow** rather than widen the type.
   Silent aliasing above 255.
7. **Full-grid allocation per item.** `955d662:src/gen/parcels.js:131` allocates a
   `width * height` `Uint8Array` **per block** — roughly 13 MB of churn on a 256²
   map, to track a few dozen tiles.
8. **Adjacent-seed stream derivation.** `seed+1 / +2 / +3 / +4`
   (`955d662:src/map.js:125, :141, :319, :341`) while
   `955d662:src/rng_streams.js` — which does proper XOR-constant derivation — sits
   unused. Adjacent seeds decorrelate poorly on xorshift32. `src/sim/rng.js`
   `createStreams` already does this correctly; add streams there.
9. **Precedence and truthiness bugs one test would have caught.**
   `955d662:src/gen/pois.js:72` — `a === 'residential' || a === 'elite' &&
   chance(0.5)` gives **every** residential district a safehouse unconditionally.
   `955d662:src/gen/pois.js:198` — `getNearestPOI` returns the **first** POI always,
   because the `.find()` callback returns a distance, which is truthy.
10. **Generality nothing uses.** `drawRoad`'s Bresenham
    (`955d662:src/gen/roads.js:204`) handles arbitrary diagonals; every call site is
    axis-aligned.
11. **Functions that do too many things.** Five over AGENTS.md's 60-line limit:
    `generateDistricts` **210** (`districts.js:34`), `createMapGenerationPipeline`
    **150** (`pipeline.js:193`), `generateRoads` **108** (`roads.js:24`),
    `createParcelsForBlock` **85** (`parcels.js:101`), `generateParcels` **67**
    (`parcels.js:23`).
12. **A god object as the stage interface.** Every generator takes `map` and mutates
    it: `parcels.js:36-46, :113, :118` reads seven of its fields and calls
    `map.getDistrictAt()`. The import counts look clean (1–2 per file) and understate
    the coupling by an order of magnitude. **Import count is not a coupling measure
    when the payload is a god object.**

---

## 7. Written, reviewed, never executed

Four such systems have now surfaced in this project — the river, `densityTarget`,
`bias`, and `gen/pipeline.js`. The old tree has **ten more**, found by grepping for
callers. Listed because the shared shape is the useful part.

| Thing | Where | Status |
|---|---|---|
| `densityTarget` | written `districts.js:221`, bumped `map.js:166` | **Read by nothing.** |
| `buildingPools` | written `districts.js:229`, re-derived `map.js:163` | **Read by nothing.** |
| `bias{crime,wealth,event}` | written `districts.js:224-228`, adjusted `map.js:164-165` | **Read by nothing.** |
| `validateRoadConnectivity` | `roads.js:377` | No caller. The test for anti-pattern 2. |
| `validateDistrictContiguity` | `districts.js:298` | No caller. |
| `calculateParcelizationRatio` | `parcels.js:244` | No caller. A coverage metric nobody measured. |
| `getSpacingForType` | `poi_templates.js` | **Imported at `pois.js:3` and never invoked.** |
| `getPOIAt`, `getPOIsInDistrict` | `pois.js` | No callers. |
| `isRoad` | `roads.js:337` | Exported; `renderer3d.js:2055` wrote its own local `isRoadAt` instead. |
| `yieldGenerator` | `pipeline.js:347` | The file's `SyntaxError`. Never imported. |
| `minSize` | `districts.js:39` | Computed, commented *"3% minimum per spec"*, never used. The spec is not enforced. |
| `TERRAIN_BRIDGE` | `constants.js:23` | Read by the renderer, **written by nothing.** |
| `startId`, `parcelMap` params; `let parcelId = 0` | `parcels.js:50, :101` | Passed and never used. |

### And one that runs but is inert, which is the worse variant

`checkMinimumSpacing` (`955d662:src/content/poi_templates.js:275-290`) guards against
POIs stacking. It reads `map.pois`. But `Map`'s constructor
(`955d662:src/map.js:44-58`) **never initialises `this.pois`**, and `spawnPOIs`
(`955d662:src/gen/pois.js:~205`) only assigns it *after* `spawnAll()` has finished.

So throughout generation `map.pois` is `undefined`, the guard's first line
(`if (!map.pois) return true;`) fires on every call, and **the spacing check never
rejects anything.** It is called, it returns, it is measured as covered by any
line-coverage tool, and it does nothing. POIs can stack.

### The pattern

**Every one of these is either a validator or a tuning field.** Both are things you
write when you finish a feature, and both are things nothing downstream forces you to
call. There are **zero unit tests for any file in `955d662:src/gen/`** — that is the
root cause, not a coincidence.

**Guards for wave 2:**

- **Wire the validator into the generator's own return path.** `generate()` should
  call `assert()` itself and throw. A validator reachable only from a test that
  nobody wrote is decoration.
- **A tuning field with no reader is a defect, not dead weight.** If nothing consumes
  it, delete it — it reads as a working feature in review, which is how three of
  these survived.
- **Distrust guards that return early on falsy state.** `if (!x) return true;` at the
  top of a predicate is how `checkMinimumSpacing` passed review and never worked.
  Initialise the state or make the guard throw.

---

## 8. Branch pointers

Frozen branch `archive/pre-rewrite` @ `955d662`; the old game was deleted from `main`
in `1c061e7`.

**Worth reading:**

- `955d662:src/map.js` — **narrowly.** `:144-165` geography pass, `:222-252`
  canal/park carving, `:60-125` for the stage ordering. The rest is the god object.
- `955d662:src/build/placement.js` — **yes.** 56 lines, reason-returning placement
  predicate. Best-shaped file on the branch. §3.
- `955d662:src/content/poi_templates.js` — **yes.** `:184-210` footprint predicate,
  `:222-247` two-phase sampling, `:14-148` the data shape.
- `955d662:src/sim/zoning/zoning.js` (5 KB) + `955d662:src/sim/zoning/growth_sim.js`
  (8 KB) — **yes, highest-value unread.** Under `sim/`, separate from `gen/`, and the
  source `955d662:src/minimap.js:3` imports `ZONE_TYPES` from. If R/C/I growth was
  ever implemented it is here, not in `gen/parcels.js`. Read alongside
  `docs/ZONING.md` on `main`.
- `955d662:src/sim/economy/demand.js` — **yes, small.** Clean config-object-first
  R/C/I demand calc, no visible coupling.
- `955d662:src/renderer3d.js:4352-4372` — **yes, for the tables only.** Tuned,
  consumed, eight-entry per-theme decoration ladders.

**Not worth reading:**

- `955d662:src/buildings.js` — **no**, except `:279-287` for the
  `DISTRICT_THEME_BONUSES` idea. Otherwise city-builder inventory.
- `955d662:src/buildings_extended.js` — **no.** Unlock-tier defs for a different
  game's economy.
- `955d662:src/citizen.js` — **no.** Colony-sim agent
  (`happiness` / `foodLevel` / `salary`), not city generation.
- `955d662:src/economy/balancer.js` — **no.** Builder-economy balance tuning.
- `955d662:src/save/` — **no.** Imports `state/game_state.js`, which does not exist
  on `main`.
- `955d662:src/workers/` — **no.** `citizen_worker.js` is 2.5 KB of mood arithmetic;
  its own header admits movement stayed on the main thread because the map would not
  serialise.
- `955d662:src/gen/pipeline.js` — **no.** Does not parse, never ran, no stage
  contract.

### The one call I am not certain about

`generateDistricts`' multi-source balanced flood fill
(`955d662:src/gen/districts.js:78-145`) is the only non-trivial algorithm in `gen/`.
It is **wrong for road-graph districts** — `src/sim/world.js:34-40` models those as
boxes with separate `walk` / `drive` bounds — but it is plausibly **right for a
zoning tile map**: round-robin growth from seeds with per-district size caps and
shuffled expansion directions produces organic, balanced, space-filling regions,
which is fiddly to get right from scratch.

I have not read `docs/ZONING.md`. **Before discarding it, read that alongside
`955d662:src/sim/zoning/zoning.js`.** If zoning wants space-filling tile regions,
this is a real port: 210 lines to break into three, a swap to `src/sim/rng.js`'s
API, and delete the dead `minSize` at `:39`.

Everything else in this document I am confident about.
