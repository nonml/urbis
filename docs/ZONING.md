# Zoning + growth — the plan

Feature slice 1 (first) in `docs/CHARTER.md`. Read `AGENTS.md` first; this document assumes it.

## Why this exists

Pillar 1 says *the city lives*, and its test is: **sit idle for two minutes — does the
world change?** Today the honest answer is "things move." Traffic loops, walkers loop,
the clock glides. Nothing in the district is different after two minutes than before it.
Motion is not life. Until the skyline changes because the city decided to change it,
the Cities:Skylines leg of the three-game pitch is a claim, not a feature.

The gate already has a test named `the world changes while the player stands still`.
It currently passes on pixel churn from traffic and rain. When this lands, it should
pass on a building that was not there when the player arrived.

## The constraint that shapes the whole design

Read this before proposing anything, because it kills the obvious approach.

The 68 towers in `src/render/block.js` are **static tables merged into a handful of
meshes at load** (`TOWERS` × 3 avenues, plus `SOUTH_TOWERS`, `INFILL_TOWERS`,
`TERMINUS_TOWERS`). Merging is what buys the draw budget: 68 buildings for 8 draws.
A merged `BufferGeometry` cannot change without rebuilding and re-uploading it, which
is a frame hitch exactly when the player is looking at the thing that changed.

Two consequences:

1. **Do not convert the existing skyline to instancing.** It would work — an
   `InstancedMesh` is draw-equivalent and its matrices are mutable — but the shafts
   bake world-space UVs (`worldUVs(box, w, h, d, 11)`) so texture density stays
   constant across differently-sized towers. Instancing a unit box and scaling by
   matrix stretches those UVs, and fixing that needs a per-instance UV-scale attribute
   plus another shader patch. That is a real cost with zero gameplay return, and it
   puts every shipped VGA item on the existing skyline at risk of regression.
2. **Grow on empty land instead.** The district has interior lots that no tower
   occupies. Those become a separate instanced group that the sim owns outright. The
   existing skyline is the backdrop; the growable lots are the living part.

Draw budget: **155 / 175** as of slice 023. This design must fit in the remaining 20,
and it is expected to spend about 6.

## The model

### Sim — `src/sim/zoning.js` (new, pure, zero `three`, zero DOM)

```js
export const STAGES = ['EMPTY', 'SITE', 'LOW', 'MID', 'HIGH'];
```

A **parcel** is `{ x, z, w, d, use, stage, progress, powerZone }`. `use` is one of
`'res' | 'com' | 'ind'`. `progress` is 0..1 within the current stage. `powerZone` is
`zoneAt(z)` from `street.js` and is what couples growth to the blackout hack.

A **district** carries `demand` per use, 0..1. Slice 5 (district economy) will drive
demand from jobs and wealth; until then it is a slow deterministic oscillation seeded
from the `world` stream, so the city still breathes without the economy existing yet.

`tickZoning(state, dt)`:
- Each parcel accrues `progress += dt * rate(use, demand, stage)`.
- At `progress >= 1` the parcel advances one stage and `progress` resets. `EMPTY`
  advances to `SITE` only if demand for its use clears a threshold.
- Demand below a lower threshold decays `progress` and can drop a stage. **Decline
  must be implemented in the same slice as growth.** A city that only ever grows is a
  progress bar, not a simulation, and retrofitting decline later means rewriting the
  rate function.
- **A parcel in a blacked-out power zone does not accrue progress.** This is the
  cascade hook and it is the cheapest pillar-3 win in the codebase: kill the lights,
  and construction on that side of the street stops until power returns.

Determinism: parcel layout and per-parcel rate jitter come from the `world` stream;
demand oscillation comes from `sim`. Add a `city` stream to `createStreams` in
`src/sim/rng.js` if the two existing ones prove too entangled — but only if, and say
so in the commit. `Math.random()` stays banned.

### Render — `src/render/zoning.js` (new)

One `InstancedMesh` per (stage-shape × material), matrix scale driven by the parcel's
stage and `progress`, so a building *rises* rather than popping in:

| Stage | What the player sees | Instanced group |
|---|---|---|
| `EMPTY` | Fenced lot, gravel, a skip | hoarding |
| `SITE` | Hoarding + scaffold mast + crane, growing | hoarding + mast |
| `LOW` | 2–3 storey block | shell |
| `MID` | 6–10 storey | shell |
| `HIGH` | Tower, reaches the skyline | shell |

`LOW`/`MID`/`HIGH` are the same shell instance at different Y scale, so stage change
costs a matrix write and nothing else. Reuse the tower materials from
`towerMaterials()` in `block.js` — a grown building must be made of the same city as
the ones around it, and reusing the material keeps the group inside its draw budget.

Growable shells go in `zoneMats[parcel.powerZone]` like every other facade, or they
will stay lit through a blackout and regress **VGA-007**, which is ✅ DONE and must
stay that way.

### Where the land is

The infill band already tells you where buildable interior land sits: `INFILL_TOWERS`
occupies `x = ±22` and `x = 66`. The gaps in that grid are the parcels —
around `x = ±22, z ∈ {-66, -36, 46, 56}` and `x = 66, z ∈ {-60, -40, 0, 10, 50, 70}`.
**Verify every candidate with a capture before committing to it**; these are read off
the tables, not measured, and a parcel that overlaps a road or a sidewalk is worse
than no parcel at all.

Twelve to sixteen parcels is enough. More is not better — the player needs to be able
to notice one change.

## Slices

Each lands on its own, gate-green, with evidence at the play camera.

A note on why this is three slices and not five. The tempting split is "sim first,
headless, render later" — it is cleaner to test and it is how most codebases would do
it. It is also illegal here: law 1 says no screenshot, no tick, and law 6 says no
system that is not visible in a screenshot. An unwired `src/sim/zoning.js` with a green
unit test is exactly the dead tech law 6 exists to stop, however well tested. So the
first slice is bigger than it wants to be, and it carries its own proof.

- **024 — the city builds something.** `src/sim/zoning.js`, `src/render/zoning.js`,
  wired in `main.js`, growth running. The one slice that cannot be subdivided without
  breaking a law. Ships with:
  - a headless gate test that ticks 120 simulated seconds and asserts stages advanced
    and that a blacked-out parcel did not move;
  - two play-camera frames of the same parcel minutes apart, the second taller;
  - a blackout frame proving the site is dark and the crane has stopped;
  - the `world changes while the player stands still` test rewritten to assert on a
    parcel stage instead of on pixel churn.

  Expect to spend the first hour on coordinates. If a parcel clips a road, move the
  parcel — do not move the road.
- **025 — it declines, and the player knows why.** A demand drop visibly regresses a
  parcel. HUD or diegetic signal carrying the reason. Pillar 4 is "zero ambiguity" — a
  building that shrinks with no explanation is a bug to the player, whatever the sim
  thinks. Decline logic itself lands in 024, per the model above; this slice is about
  making it legible.
- **026 — demand stops being a sine wave.** Feature slice 5, the district economy,
  replaces the placeholder oscillation. At that point growth has a cause the player can
  reach, and pillar 3 has something real to cascade into.

## What this deliberately does not do

- **No pathfinding, traffic demand, or per-citizen residency.** That is the rest of
  Cities:Skylines and it is not the point. The point is that the skyline changes on
  its own and the player can affect it.
- **No new npm package.** `three` and the existing instancing patterns cover all of it.
- **No touching the existing 68 towers.** If a slice starts wanting to, stop and
  re-plan; it means the parcel approach was wrong and that is worth knowing early.
- **No raising the 175 draw budget.** If the group does not fit, cut parcels.

## The bar

This is done when a player can stand on the street, watch a lot go from fence to
scaffold to building, blackout the zone and watch the crane stop — and none of that
was scripted for them.
