# World scale — from one street to a city you can drive

Design doc. Status: **approved in chat 2026-09-19**, implementation wave 1 dispatched.
Read `AGENTS.md` first; this document assumes its six laws and does not restate them.

## The request

The operator's words: the game "looks nothing like a city, a suburb or outskirt, or
river, bridge, mountain, terrain, underpass, overpass, subways," and when asked how to
pay for a bigger world: **"Just do what Watch Dogs can."**

Watch Dogs streams its city. So do we.

## What is actually true today — measured, not assumed

Three read-only scouts swept the repo on 2026-09-19. Findings, with citations:

**Playable extent is 122 m x 168 m.** `BOUNDS` in `src/sim/player.js:4` is
`{ minX: -52, maxX: 70, minZ: -68, maxZ: 100 }`. Three N-S avenues at `x = 0, 44, -44`
(`src/render/block.js:601`), each `STREET_LEN = 200` (`block.js:7`), plus two E-W
crossings at `z = 40` and `z = -64` (`block.js:38-43`). That is the whole map.

**The world has no single definition of itself.** The avenue positions are hardcoded
independently in `block.js`, `sim/street.js`, `render/lamps.js`, and
`render/landscape.js` — seven separate times in `block.js` alone.
(`render/hackfx.js` turned out clean.) The player bounds box is hardcoded **four
separate times** — `sim/player.js:4`, `sim/vehicle.js:33-34`, `sim/wanted.js:81-82`,
`main.js:276-277`. Adding a district today means editing nine files in lockstep.

**Correction, 2026-09-19 (worker 3).** This document originally called the 52-vs-70
disagreement on max X a bug. **It is not.** The two values measure different things and
both are correct:

- The tarmac genuinely ends at `x = +-52`. `roadCross` (`block.js:39-41`) is
  `PlaneGeometry(104, 7)` centred on x = 0, spanning exactly -52..+52, and
  `street.js:115` spawns E-W traffic across the same span.
- The walkable floor genuinely extends to `x = 70`. The pocket park slab is at
  x = 53.5..68.5 (`landscape.js:37`) and two infill towers sit at x = 60..72
  (`block.js:265`). Clamping foot movement to 52 would make shipped content
  permanently unreachable — a visible regression.

They are therefore modelled as two explicit boxes, `WALK_BOUNDS` and `DRIVE_BOUNDS`,
not flattened into one. The z range is identical in both, which is why the difference
looked like drift. **The lesson is the one AGENTS.md already states: measure the claim
before acting on a critique — including a critique in this document.**

**Nothing streams.** No chunking, no LOD, no distance culling anywhere in `src/render/`.
Every builder (`buildGround`, `buildTowers`, `buildSkyline`, `buildRiver`,
`buildGrassGround`, `buildGrassTufts`, `buildMountains`) is called exactly once at load
and its output stays resident for the session. `NPC_COUNT` and `CAR_COUNT` are fixed
constants (`sim/street.js:5-6`), not spawned by proximity.

**Flatness is structural, not data.** `buildGround` (`block.js:25-135`) is a flat
`PlaneGeometry(700, 700)` base plus flat boxes at fixed y. Every placement in traffic,
NPC and tower code is `(x, fixedY, z)` with no height term. The mountains
(`landscape.js:128-129`) are the only non-flat geometry and sit outside `BOUNDS`.

**No road graph exists.** Agents move 1D along a fixed `axis` and wrap at `STREET_HALF`
(`sim/street.js:234-273`). There is no adjacency, no intersection logic, no turning.
Nothing in this game has ever turned a corner.

**~49 of the current ~154 draws are spent in violation of law 4.**
`render/signs.js:65-112` builds each of 10 signs as an individual `THREE.Mesh` **plus**
an individual `THREE.Sprite` (~23 draws with arms and alley glows);
`render/lamps.js:100-108` builds **26 individual `THREE.Sprite` glows**, one per lamp.
Law 4 requires both to be instanced or merged.

**No roadmap collision.** `docs/BACKLOG.md:74-78` lists streaming, subway tunnels and
skybridges explicitly as long-horizon and *not* current queue. `docs/ZONING.md` grows
buildings on existing lots inside the current grid and forbids touching the 68 merged
towers (`ZONING.md:148-149`) — this design does not touch them either.

## The reframe

The draw budget was never the blocker. **The blocker is that the world cannot describe
itself.** Until there is one authority on where the streets are and how high the ground
is, every new district is nine hand-edits, and streaming is impossible because nothing
can answer "what is inside this tile?"

## Non-goals

- Not touching the 68 merged towers. `ZONING.md:148-149` forbids it and every shipped
  VGA item rides on them.
- Not reinstating SSR, SSAO or volumetric fog. Removed for cause in `56f1462`.
- Not raising the 175 cap on speculation. Plank 0 reclaims enough headroom that the
  question can be deferred until a real measured frame demands it.
- Not adding an npm package. `three` plus the existing instancing patterns cover this.
- Not rewriting the traffic/NPC sim in wave 1. The graph lands first; agents learn to
  read it later.

## The four planks

Ordered by dependency, not by appeal.

### Plank 0 — Reclaim the wasted draws

Instance the sign meshes and sprites; instance the 26 lamp glows. This is a law-4
compliance fix that happens to fund the project.

**Correction, 2026-09-19.** This document first claimed plank 0 reclaims ~49 draws and
takes the frame to ~109. **That was an overstatement and is withdrawn.** It assumed
every sign and lamp sprite draws every frame. They do not: three.js frustum-culls
individual `Sprite` and `Mesh` objects, so the objects outside the view already cost
nothing. An instanced replacement costs a flat 1 draw whenever *any* instance is
visible, so the real saving is `(average visible count) - 1`, not `(total count) - 1`.

Confirmed object counts (exact): `LAMPS` has **26** entries and builds **26**
`THREE.Sprite` glows, each with its own `SpriteMaterial` (`lamps.js:100-108`).
`signs.json` has **10** entries, each building 1 `Mesh` + 1 `Sprite` = **20 draws**
(`signs.js:86-107`); the sign arms are already correctly merged.

Estimated reclaim in a **typical driving frame: 10-20 draws** — roughly 6-10 of 26
lamps and 5-6 of 10 signs are plausibly in frustum at once, given FOV 52 and the fog.

**But the budget governs the peak frame, not the typical one**, and the peak is the
intersection view (`?spawn=cross`, `main.js:227-233`, authored precisely to put both
road axes in one frame) where ~15-18 lamps are visible. **The reclaim at peak — the
number law 3 actually cares about — sits at the top of that range or above it.**

All of the above remains an estimate. Only the integrator's measured before/after
counts as evidence, per law 2.

Risk: sprites billboard and may carry per-object uniforms or sort order that blocks
naive merging. If instancing proves genuinely impossible for a given case, that is a
finding to report, not a thing to force.

### Plank 1 — `src/sim/world.js`, the single source of truth

A pure-sim module (zero `three`, zero DOM — law 5) that owns:

- the road graph: nodes `{ id, x, z, y }` and edges `{ a, b, lanes, kind }`
- district bounds, replacing all four copies of the bounds box
- the derived lookups every other file needs: nearest edge, lane centre, extent

`block.js`, `street.js`, `lamps.js`, `hackfx.js`, `player.js`, `vehicle.js` and
`wanted.js` then read from it instead of their own literal tables. The 52-vs-70
inconsistency disappears because there is only one number left.

Wave 1 delivers the module plus the `sim/` migrations. The `render/` migrations follow
once the shape is proven, so a bad graph design cannot corrupt the shipped skyline.

### Plank 2 — `heightAt(x, z)`, the ground gets a Y

A seeded heightfield with a single sampling function. `buildGround` and the landscape
builders sample it instead of writing fixed y. Once ground has a height, terrain relief,
a river valley with banks you descend, over/underpasses and the subway (negative y) are
all the same feature expressed at different elevations.

Wave 1 is a spike: prove `heightAt` can drive `buildGround` without breaking the road
surface or the shipped street frame. Gentle relief only — the streets must stay drivable.

### Plank 3 — Chunk streaming

World cut into tiles; tiles built on approach and disposed behind. Depends on plank 1,
because the graph is what answers "what is inside this tile?"

Wave 1 is a spike: an unwired chunk manager with explicit build/dispose lifecycle and a
test, so the design can be reviewed before it touches the frame loop.

### Then: the content

Bridge, over/underpass, subway, outskirt district. On top of planks 0-3 these are
content, not engine work.

## Wave 1 — five parallel workers

Partitioned so that **no two agents touch the same file.**

| # | Job | Files owned |
|---|---|---|
| 1 | Instance sign meshes + sprites | `src/render/signs.js` |
| 2 | Instance the 26 lamp glows | `src/render/lamps.js` |
| 3 | Road graph + bounds unification | `src/sim/world.js` (new), `sim/player.js`, `sim/vehicle.js`, `sim/wanted.js` |
| 4 | Heightfield spike | `src/render/block.js`, `src/render/landscape.js` |
| 5 | Chunk manager spike | `src/render/chunks.js` (new, unwired) |

`src/main.js` is owned by the integrator (the main session) and by nobody else — it is
the one file all five would otherwise collide in.

### Measurement protocol

Workers run **only** the static checks: `npm run lint`, `npm run check:rng`,
`npm run check:boundary`, `npm run validate`.

Workers do **not** run `npm run build`, `npm run preview`, `npm test` or `npm run gate`.
Five agents sharing one `build/` directory and one port 4173 would corrupt each other's
results, and a corrupted draw number is exactly the failure law 2 exists to prevent.

The integrator builds, measures and screenshots **once per plank, sequentially**, at the
normal play camera, and records the measured delta. One measurer, one methodology.

## Wave 2 — carried forward from wave 1

Raised by the workers, recorded here so none of it is lost.

**`world.js` needs two things before chunks can use it** (worker 5, after reading the
finished `world.js`):

1. **`edgesIn(rect)`** — a spatial query. It must return edges that **cross** the
   rectangle, not only edges with both endpoints inside it: an avenue spanning
   z = -100..100 has both endpoints outside almost every tile it passes through, so an
   endpoint-containment test would build almost no road.
2. **A border-clipping rule.** Nothing currently says whether an edge crossing a tile
   boundary is clipped to the window, assigned to one owner tile, or duplicated. Left
   unspecified, two neighbouring tiles each build the full edge — doubled road geometry
   and doubled draws at every seam.

**Other carried items:**

- **Lane handedness is inconsistent.** N-S traffic is left-hand, E-W is right-hand
  (worker 3). Invisible today only because nothing turns and the E-W axis is sparse
  (4 of 16 cars). Fix during the `street.js` migration — it is a sign flip in
  `makeEWCar` — and decide which side this city drives on.
- **`heightAt` should move to `src/sim/world.js`.** It is pure maths with one dependency
  (`mulberry32`, already in `sim/`), and its `FLAT_RECTS` is a hand-copy of the road
  table `world.js` now owns — it will drift the first time a road moves. Move it *with*
  the plank-1 render migration, not as a standalone cleanup. `displaceToTerrain` stays
  in `render/` (it mutates a `BufferGeometry`).
- **Chunk residency maths should move to `src/sim/`** for the same reason: traffic and
  NPC spawning will want "which tiles are hot", and they cannot import a `render/` file
  without dragging three across the law-5 boundary. All seven functions are already
  three-free and side-effect-free.
- **Nothing reads `heightAt` yet** — player, vehicles and NPCs still move at fixed y, so
  the player walks through the pocket-park mound. Needs a ground clamp.
- **Chunk builds are synchronous** and will hitch: first fill is 32 tiles in one call.
  Needs a budgeted queue before it wires into the frame loop.
- **`ALLEYS` colour data is dead** (worker 1): `tickSigns` calls `setScalar()` over
  `#1e4d6b` / `#5b1e4d` every frame, so those glows have always rendered neutral grey.
  Pre-existing; reproduced exactly rather than "fixed" mid-refactor.
- **Union bounds break with two districts** (worker 3): `WALK_BOUNDS`/`DRIVE_BOUNDS` are
  a union box, exact for one district. With two, you can walk through the gap between
  them. Needs per-district containment.

## Definition of done

- Plank 0: measured frame peak drops by a reported amount; signs and lamp glows visually
  identical in a play-camera screenshot, day and night.
- Plank 1: one bounds constant in the codebase; `check:boundary` green; the 52-vs-70
  discrepancy resolved and the resolution stated.
- Plank 2: ground carries height; the street frame is unchanged where relief is zero.
- Plank 3: chunk lifecycle demonstrated in a test; unwired from the frame loop.
- All planks: `npm run gate` green, screenshot evidence in `docs/shots/`.

## Risks

- **Plank 0 may under-deliver** if sprite billboarding or per-sign uniforms resist
  instancing. Mitigation: report the blocker rather than forcing it; the plank is
  additive, so a partial reclaim still funds part of the work.
- **Plank 1 is the highest-value and highest-blast-radius plank.** Confining wave 1 to
  `sim/` keeps a bad graph away from the shipped renderer.
- **Plank 2 can break the street** if relief is applied under the roads. Roads stay flat
  in wave 1; relief lives off the carriageway.
- **Scope honesty**: planks 1-3 are engine-level and will not complete in one wave.
  Wave 1 proves the approach and funds it. It does not deliver a drivable Chicago.

---

## Wave 2 — the authority inversion

The river was stopped after four independent faults were found in one feature:
buried under the opaque ground plane, routed through a row of ten towers,
painted darker than its own banks, and sited where no light reaches it. The
first hid the other three for the whole of this project's history. Evidence:
`docs/shots/river-along-day.png`, `docs/shots/river-along-night.png`.

The four are not four bugs. They are one bug seen four times.

**Terrain is currently downstream of building placement.** The ground is
carved, and then patched back up wherever someone has already put a tower —
that is precisely what `CHANNEL_ABUTMENTS` is, a table of ten hand-copied
footprints whose only job is to hold the ground up under buildings that were
placed over water. Every fault above follows from that ordering.

**Wave 2 inverts it: terrain and water are authored first, and placement asks
them.** One predicate in the generator — *does this footprint overlap water or
exceed this gradient?* — removes the entire class permanently, and the abutment
table disappears as a consequence rather than needing to be maintained. The
same applies to `FLAT_RECTS` and `RIVER_STRIP`: both are hand-copied road and
bank geometry that `sim/world.js` should own.

Three placement constraints, each one a fault we actually hit:

1. Nothing may be placed over water.
2. At least two avenues must keep a clear sightline to it. Today only avenue
   −44 has one, southward, because the south tower row blocks x −8…52.
3. It must be lit. This is a siting constraint, not a material one — water
   reads as water because something moves in its reflection.

### Siting the river

**Run it east–west, not north–south.** A N–S river parallels the three avenues
and competes with them for the same corridor, which is exactly how this one
ended up 1 m wide with towers in it. An E–W river *crosses* all three avenues,
which buys three bridges, a reason for them to exist, and the river appearing
across every sightline down every avenue instead of edge-on down one.

Measured fallback on today's map, if a corridor is ever wanted without new
ground: **z −91.5 … −73.5** is the only band clear across every x. It is bounded
by the connector verge slab at z −73.5, `SOUTH_TOWERS` at z −71…−61, and the
silhouette box at (22, 24, −100) with the skyline ring at (−30, −102) and
(58, −100). That gives 18.5 m of corridor — 12 m of water with 3 m banks, twice
what was built. The avenues already span z −100…100, so all three already cross
it and the existing causeway mechanism in `heightAt` would produce three
crossings with no new code. It needs `WALK_BOUNDS.minZ` moved from −68 to about
−95, or it is scenery again.

Generated map, which is the real answer: **reserve a 60 m corridor, water in the
middle ~30 m**. These are targets, not measurements:

| | target | why |
|---|---|---|
| water width | ~30 m | the single biggest lever on whether it reads; at a grazing view the near bank occludes the first several metres, and 6 m gave 4–24% of frame |
| bank run | ~7 m each side | 2.5 m for a 1.1 m drop is a 24° bank, steep for a river; a deeper channel wants a shallower angle |
| building setback | ~8 m each side | the number whose absence caused everything else |

### What carries forward from the terrain branch

- `heightAt` / `displaceToTerrain` — sound. The field moves to `sim/world.js`.
- The flat-corridor blend — roads stay exactly flat, relief ramps off the
  carriageway. Survived four rebuilds without breaking the street. Reuse as-is.
- The channel profile and causeway behaviour — the causeway *is* the bridge site.
- The water material — a correct starting point (dielectric, albedo bounded
  between the ground plane at 0.0085 and the grass banks at 0.0247, not leaning
  on a constant environment term). Do not re-tune it before the river is
  somewhere with light and something worth reflecting; every number will move.
- **The non-negative invariant becomes a placement rule, not a terrain rule.**
  The field was made non-negative so relief could never undercut a hand-placed
  base. Once placement queries terrain, that constraint is unnecessary — and
  dropping it is what allows a valley you descend into, and the subway, which is
  the same feature at negative Y.

One lighting fact that constrains all of the above: the only dynamic lights in
the scene are two spotlights at x = 0, z = ±9 throwing a ~3.8 m pool, plus the
hero car's headlights. The lamps are emissive geometry, not lights. Anything
that needs to look lit at night must either be sited against a lit street or
come with lights of its own, and lights cost frame time against a 175 budget.
