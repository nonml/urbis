# Milestone D: Mega-city performance: chunk streaming, instancing, navigation grid

## Objective
Make MEGA playable by streaming world chunks and providing nav data used for citizens/vehicles later.

## Exit criteria (acceptance for milestone)
- MEGA loads with a progress indicator and becomes playable under 10 seconds on typical dev PC.
- Camera/render stays above 30 FPS in dense districts (dev overlay).
- Chunk system streams terrain/buildings/POIs around player.
- Navigation grid exists and basic path queries work.

## Phases
- D1: Chunked world representation
- D2: Renderer instancing + culling
- D3: Navigation grid + path query API

## Tickets

## Ticket D-1: Chunk manager v1 (terrain + road + parcels)
- **Phase:** D1
- **Depends on:** C-3

### Objective
Partition the map into chunks and load/unload chunk render data based on player position.

### Design
Use fixed chunk size (e.g., 32x32). Keep sim data global, but render data per chunk. Maintain active chunk radius (e.g., 3 chunks).

### Specs
- Chunk size: 32 tiles; active radius: 3 chunks.
- Unload far chunks after 2 seconds out of range.
- Never unload chunk containing active quest markers.

### Implementation details
- Add `src/world/chunks.js` with `getChunkId(x,y)` and `getChunkBounds(id)`.
- Renderer requests `getVisibleChunks(playerPos)` each frame.
- Build placement must request parcel data from global map, not render chunks.

### Acceptance
- Walking across the city streams chunks without stutter spikes > 50ms.
- Memory use stabilizes (does not grow endlessly).

### DoD (Definition of Done)
- Dev overlay shows active chunk count.
- MEGA preset: active chunks <= 49 (7x7).

### QA checklist
- Sprint diagonally across map for 3 minutes; no crash/no leak.
- Place buildings then walk away and back; they persist.

## Ticket D-2: Renderer instancing pass (terrain/buildings/citizens)
- **Phase:** D2
- **Depends on:** D-1

### Objective
Keep draw calls low and stable for MEGA.

### Design
Use `THREE.InstancedMesh` per terrain type and per building type per chunk. Update only dirty chunks.

### Specs
- Terrain instanced meshes per chunk: 4 types max.
- Buildings instanced meshes per chunk: per type; keep under 200 instances per mesh when possible.
- Citizens render: pooled instanced spheres; update transforms only.

### Implementation details
- Add dirty flags: `chunk.dirtyTerrain`, `chunk.dirtyBuildings`.
- Batch updates on sim tick, not every frame.
- Add simple frustum culling per chunk.

### Acceptance
- MEGA: draw calls remain under 400 (target) in typical view.
- FPS stays above 30 in dense areas.

### DoD (Definition of Done)
- No per-frame geometry creation for citizens/terrain.
- Profiler note in docs: expected budgets.

### QA checklist
- Rotate camera in place for 60 seconds; FPS stable.
- Spawn 500 citizens; FPS drop is graceful.

## Ticket D-3: Navigation grid API (walkability + A*)
- **Phase:** D3
- **Depends on:** C-2, D-1

### Objective
Provide pathfinding that citizens and missions can rely on.

### Design
Create a grid of walkable tiles (roads+sidewalk+parks). Implement A* with Manhattan/diagonal costs. Cache results per chunk and invalidate when buildings block tiles.

### Specs
- API: `nav.isWalkable(x,y)`, `nav.findPath(a,b)` returns polyline of tiles.
- Max path length hard cap (e.g., 2048 nodes) with fallback.
- Path queries must be deterministic (use stable tie-breaker).

### Implementation details
- Add `src/sim/nav/nav_grid.js`.
- Store blocked tiles from buildings (footprints).
- Add debug mode: render nav grid around player.

### Acceptance
- Citizen can navigate from one district center to another without getting stuck (basic test).
- Building placement updates nav walkability.

### DoD (Definition of Done)
- Unit test: path exists on road graph centers.
- A* tie-breaker documented to avoid nondeterministic choices.

### QA checklist
- Place a building blocking a road; path reroutes or fails gracefully.
- MEGA path query average < 5ms for 100 queries (dev overlay).
