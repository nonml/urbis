# Milestone Q — Performance + Streaming Finalization (Small → MEGA) (target: 0.36.x)

## Objective 🎯
- Make MEGA maps genuinely playable: render + sim scaling with LOD/streaming.
- Chunk the simulation so far-away areas are simplified.
- Audit memory and eliminate leaks/regressions.

---

## Milestone Exit Criteria (Acceptance)
- ✅ MEGA loads without >2s main-thread freeze (progressive pipeline).
- ✅ FPS target: 30fps on City, 24fps on MEGA (mid-range PC), with stable frame times.
- ✅ Sim tick time stays within budget (measured in overlay) and doesn’t grow over time.
- ✅ Memory footprint does not continuously increase during a 45-minute soak test.


## Definition of Done (DoD)
- Perf overlay includes tick breakdown by subsystem.
- All streaming/LOD has deterministic behavior (no random popping).
- A documented perf checklist exists.


---

## Phases
1) Render LOD + instancing
2) Simulation chunking
3) Streaming IO + save perf
4) Soak testing


---

## Tickets

### Q-01 — Simulation chunking (active cells high-detail, far cells low-detail)
**Objective:** Prevent MEGA from simulating everything at full fidelity.

**Design**
- Divide map into sim cells (e.g., 64×64).
- Cells near player/camera simulate agents; far cells use aggregate stats.
- Cell transitions are smooth and deterministic.


**Specs**
- `src/sim/streaming/sim_cells.js`
- `state.streaming = { activeCells[], cellStats{} }`


**Implementation details**
1. Implement cell indexing and distance-based activation.
2. Move citizen/vehicle agent simulation into active cells only.
3. Aggregate far-cell metrics (population, jobs, crime) and feed into economy.


**Acceptance**
- MEGA sim time does not scale linearly with total population.
- Entering a new area 'spawns' agents deterministically.


**DoD**
- No popping exploits: aggregated stats match spawned agents over time.


---

### Q-02 — Render LOD for buildings/citizens/vehicles
**Objective:** Keep draw calls and GPU load under control.

**Design**
- Near: full meshes; mid: simplified instanced meshes; far: impostors or none.
- LOD thresholds configurable per preset.


**Specs**
- `src/render/lod/lod_manager.js`
- LOD config in `src/constants.js`


**Implementation details**
1. Implement LOD buckets and distance checks.
2. Convert citizen/vehicle render to instanced meshes with per-instance transforms.
3. Add debug view to show LOD level.


**Acceptance**
- On City, citizen count can be increased without FPS collapse.
- LOD transitions are not distracting.


**DoD**
- No per-frame geometry rebuilds.


---

### Q-03 — Culling + visibility optimization
**Objective:** Avoid rendering what the camera cannot see.

**Design**
- Frustum culling for chunks/instances where possible.
- Optional: occlusion approximation (coarse).


**Specs**
- Chunk bounding boxes stored and tested against camera frustum
- `src/render/culling/frustum.js`


**Implementation details**
1. Compute chunk AABBs.
2. Skip updating/rendering chunks outside frustum distance.
3. Profile to ensure net gain.


**Acceptance**
- God Mode zoomed out does not render unnecessary detail.
- Culling reduces draw calls in debug overlay.


**DoD**
- No visual holes at chunk boundaries.


---

### Q-04 — Save/load performance + compression
**Objective:** Make large cities save quickly and safely.

**Design**
- Use compact formats for large arrays (zone maps, tiles, coverage).
- Optional: base64 + compression (LZ-string or similar) for web.


**Specs**
- `src/save/serialize.js`
- `docs/SAVE_SCHEMA.md` updated with packed fields


**Implementation details**
1. Pack arrays into base64 strings or typed arrays.
2. Add incremental save option (diff-based) as stretch goal.
3. Add load-time validation with clear errors.


**Acceptance**
- City preset saves in < 1s typical, MEGA in < 3s typical.
- Loaded world matches saved world deterministically.


**DoD**
- Corrupt save handling tested (shows message, doesn’t crash).


---

### Q-05 — Soak test suite + memory leak audit
**Objective:** Stability over long play sessions.

**Design**
- 45-minute automated soak with periodic snapshots (counts/heap if possible).
- Manual checklist for memory symptoms.


**Specs**
- `docs/PERF_CHECKLIST.md`
- Dev command: `startSoakTest()`


**Implementation details**
1. Add dev soak runner that simulates time, spawns growth, triggers incidents.
2. Log key metrics every N seconds.
3. Fix leaks found (listeners, arrays, mesh disposal).


**Acceptance**
- No continuous growth in tracked metrics after steady state.
- No WebGL context loss during test.


**DoD**
- Soak test results archived per milestone (log file).


---
