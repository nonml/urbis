# Milestone B — Procedural City + Exploration Loop (target: 0.6.x)

## Objective 🏙️
Turn “terrain + boxes” into a **believable explorable city**:
- Districts with rules (density, building pools, events)
- Road network + blocks + parcels
- Third-person roaming + interactables (intel nodes)
- Citizens move meaningfully through the city (home/work/leisure)
- Supports **Small** and **MEGA** with streaming/chunking

---

## Milestone Exit Criteria (Acceptance)
- ✅ New game generates: districts + roads + parcels + initial buildings
- ✅ Player can roam city and interact with intel nodes
- ✅ Citizens follow a simple daily schedule and visibly move
- ✅ MEGA city loads within a reasonable time and remains playable

## DoD for Milestone B
- No console errors during 30-minute MEGA play
- Chunked rendering remains in place; no full rebuilds on small edits
- District + road generator is deterministic per seed

---

## Phases
1) **City Generation (Districts → Roads → Parcels)**
2) **Exploration + Interaction**
3) **Citizen Movement + Schedules**
4) **Performance / Streaming**

---

## Tickets

### B-01 — District graph generator
**Objective:** Create “neighborhood identity” to drive content + stories.

**Design**
- Generate K districts (based on map size) using seeded Voronoi / flood-fill from seeds.
- District has:
  - `id, name, theme, bounds/tiles, densityTarget`
  - biases: `crimeBias, wealthBias, eventBias`
  - building pools: `allowedBuildingTypes[]`

**Specs**
- `src/gen/districts.js`
- Output stored in `state.map.districts[]`
- Deterministic naming via RNG + name tables.

**Implementation details**
1. Pick district centers.
2. Expand via multi-source BFS until all tiles assigned.
3. Compute per-district stats (area, water %, elevation).

**Acceptance**
- UI can display “District: <name>” when player stands inside it.

**DoD**
- District assignment stable under same seed.

---

### B-02 — Road network + block partitioning
**Objective:** Roads define traversal and parcel boundaries.

**Design**
- Generate a primary road skeleton:
  - connect district centers (MST + some extra edges)
- Rasterize roads onto tiles:
  - road width 1–2 tiles depending on preset
- Blocks are regions separated by roads/water.

**Specs**
- `src/gen/roads.js`
- Tile flags: `TILE_ROAD`, `TILE_SIDEWALK`
- Block id map: `state.map.blockIds` (packed array)

**Implementation details**
1. Build graph connecting centers.
2. Draw lines with Bresenham-ish rasterization.
3. Flood fill blocks (ignore road tiles).

**Acceptance**
- Player walks on roads and can follow them across the map.

**DoD**
- Roads never cut off spawn area completely (ensure connectivity).

---

### B-03 — Parcels + building snapping
**Objective:** Buildings placed on parcels, not arbitrary tiles.

**Design**
- Inside each block, carve parcels (rectangles) aligned to roads.
- Parcels store:
  - `x,y,w,h, zoneType, reserved`
- Building placement chooses a parcel and reserves it.

**Specs**
- `src/gen/parcels.js`
- `state.map.parcels[]`
- Update build UI to highlight valid parcels.

**Implementation details**
1. For each block, detect road-facing edges.
2. Slice block into strips, then rectangles.
3. Tag parcels with zone suggestions (residential/commercial/industrial).

**Acceptance**
- Player cannot place buildings off-parcel.
- Buildings align visually with roads.

**DoD**
- Parcel generation fast enough for MEGA (use chunked processing if needed).

---

### B-04 — Citizen pathing (grid A* with caching)
**Objective:** Citizens move between home/work/leisure.

**Design**
- Simple A* on road/sidewalk tiles.
- Cache paths per `(fromCell,toCell)` with LRU eviction.

**Specs**
- `src/sim/pathfinding.js`
- Walkable rules:
  - roads/sidewalk preferred
  - grass allowed but slower (optional)
- Citizen state:
  - `target`, `path`, `pathIndex`, `speed`

**Implementation details**
1. Implement A* with Manhattan heuristic.
2. Add path cache (Map with key string).
3. Integrate into `CitizenManager.tick()`.

**Acceptance**
- 50+ citizens visibly walk to targets without jitter.

**DoD**
- MEGA city does not freeze due to pathfinding spikes (budget + caching).

---

### B-05 — Daily schedule system
**Objective:** “Living city” feel without heavy AI.

**Design**
- Time-of-day normalized 0..1 repeating each “day”.
- Schedule rules:
  - morning: go to work
  - evening: go home
  - night: leisure (parks/shops) based on happiness

**Specs**
- `state.time.dayPhase`
- Citizen fields:
  - `homeId`, `workId`, `leisureSpotId`

**Implementation details**
1. Assign homes/jobs using parcels/buildings.
2. Each tick: if dayPhase crosses threshold, pick new target.

**Acceptance**
- Citizens relocate at phase changes; jobs affect resources.

**DoD**
- No citizen gets “stuck” forever (fallback teleport if path fails, with debug log).

---

### B-06 — Interactables + intel nodes
**Objective:** Watch Dogs-like micro-loop inside city builder.

**Design**
- Place intel nodes on:
  - power substations
  - CCTV poles
  - telecom boxes
- Interaction:
  - scan prompt when close
  - minigame: timed hold / simple pattern
  - reward: resources/info/quest leads (in Milestone C)

**Specs**
- `state.world.interactables[]`:
```js
{ id, type, x, y, districtId, difficulty, cooldown, lastUsedTick }
```
- `src/sim/interactables.js`
- UI prompt in `ui.js`

**Implementation details**
1. Add proximity detection in player update.
2. Add simple “access progress” UI.
3. Apply reward + cooldown.

**Acceptance**
- Player can use 3 intel node types and see rewards.

**DoD**
- Intel node loop is deterministic; difficulty scales with district.

---

### B-07 — City map UI (district overlay + icons)
**Objective:** Navigation and planning for MEGA.

**Design**
- A map screen toggle: `M`
- Shows districts, roads, building icons, quest markers (later).

**Specs**
- `src/ui/map_screen.js`
- Uses offscreen canvas to draw at lower resolution.

**Implementation details**
1. Add map toggle UI.
2. Render district colors and road lines.
3. Click map to set waypoint for player.

**Acceptance**
- Player can orient themselves in MEGA using map.

**DoD**
- Map render does not allocate every frame.

---

### B-08 — Streaming / progressive generation for MEGA
**Objective:** MEGA should “start fast” and fill in.

**Design**
- Generate city in passes:
  1) terrain
  2) districts
  3) roads
  4) parcels
  5) initial buildings
- Show loading progress.

**Specs**
- `src/gen/pipeline.js` yields progress events.

**Implementation details**
1. Convert generators to step-based functions.
2. Drive pipeline over multiple frames (avoid long main-thread blocks).

**Acceptance**
- MEGA loads without a multi-second browser “freeze”.

**DoD**
- Pipeline progress shown and correct.
