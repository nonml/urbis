# Milestone C: Procedural city generation v1 (districts, roads, parcels, POIs)

## Objective
Generate believable cities from seed with districts, roads, blocks/parcels, and points of interest that support both small and mega presets.

## Exit criteria (acceptance for milestone)
- Given the same seed + preset, city generation is identical.
- Districts are contiguous and cover the whole map.
- Road network connects all districts (no isolated islands except intentional).
- Parcels are generated and usable for building placement.
- POIs spawn per district with minimum spacing rules.

## Phases
- C1: District graph + zoning rules
- C2: Road generation + connectivity
- C3: Parcelization + build snapping
- C4: POIs and spawn points

## Tickets

## Ticket C-1: District generator v1 (graph + contiguous regions)
- **Phase:** C1
- **Depends on:** A-1

### Objective
Create district regions with identity and density targets (downtown vs suburbs etc.).

### Design
Generate N district seeds, run multi-source flood fill with noise bias to form contiguous regions. Store districtId per tile. District metadata contains theme, density, security baseline.

### Specs
- SMALL: 4-6 districts; CITY: 8-12; MEGA: 14-20.
- Each district has: `theme`, `density`, `securityLevel`, `poiBudget`.
- Min district size: 3% of map tiles.

### Implementation details
- Implement in `src/gen/districts.js` (or verify existing and fix).
- Expose `getDistrictAt(x,y)` and `getDistrictName(id)`.
- Add debug overlay: show district id under player.

### Acceptance
- No tile has missing district id.
- District count matches preset target range.

### DoD (Definition of Done)
- Generation time: SMALL < 30ms, CITY < 120ms, MEGA < 600ms on dev machine.
- Unit test: district contiguity (BFS count per district).

### QA checklist
- Generate 10 random seeds, visually verify distribution and no tiny slivers.
- MEGA generation does not freeze UI (use loading spinner).

## Ticket C-2: Road network v1 with connectivity guarantee
- **Phase:** C2
- **Depends on:** C-1

### Objective
Build a road graph that connects district centers and supports vehicle navigation later.

### Design
Pick district centers, connect via minimum spanning tree (MST) in tile space, then add 20-35% extra edges for loops. Carve roads with width rules. Guarantee connectivity with BFS on road tiles.

### Specs
- Primary roads width: 3 tiles, secondary: 2 tiles.
- Every district center is within 8 tiles of a road.
- At least one loop per 3 districts (CITY/MEGA).

### Implementation details
- Implement in `src/gen/roads.js`.
- Provide `isRoad(x,y)` and `roadGraph` (nodes/edges).
- Add debug render mode: roads only.

### Acceptance
- All district centers are connected by road graph.
- No road dead-ends longer than 20 tiles unless at map border.

### DoD (Definition of Done)
- Road generation deterministic and stable.
- Connectivity test passes for fixed seeds.

### QA checklist
- Run BFS connectivity check on 20 seeds per preset.
- Walk player along roads; ensure collision doesn't block roads.

## Ticket C-3: Parcel generation v1 (blocks + buildable lots)
- **Phase:** C3
- **Depends on:** C-2

### Objective
Turn road blocks into parcels/lots usable by the building placement system.

### Design
Flood-fill areas bounded by roads/water to get blocks, then split blocks into parcels based on district density. Store parcelId per tile and parcel bounds.

### Specs
- Parcel must have at least 6 tiles area.
- Parcels prefer rectangular shapes; allow irregular fallback.
- Expose: `getParcelAt(x,y)`, `getParcelById(id)`, `isTileInParcel(x,y,parcelId)`.

### Implementation details
- Implement in `src/gen/parcels.js`.
- Add build placement snapping to parcel centroid + edge alignment.
- Add debug overlay: show parcel outline around player.

### Acceptance
- Building placement can snap to parcels and respects non-buildable tiles (roads/water).
- No overlapping parcels; each buildable tile belongs to at most one parcel.

### DoD (Definition of Done)
- Parcel data serialized in save for fast reload (or regenerate deterministically on load).
- At least 70% of non-road land is parcelized.

### QA checklist
- Attempt to build on road/water → blocked with message.
- Build in different districts; confirm parcel sizes differ.

## Ticket C-4: POI spawner v1 (landmarks + hack nodes + safehouses)
- **Phase:** C4
- **Depends on:** B-3, C-3

### Objective
Place meaningful exploration anchors and hacking infrastructure.

### Design
Per district, allocate POI budget; choose templates (landmark, terminal hub, camera tower, safehouse). Enforce spacing and avoid roads/water.

### Specs
- POI spacing: min 12 tiles (SMALL), 20 (CITY), 30 (MEGA).
- Each district gets: 1 landmark, 2-4 hack nodes, 0-1 safehouse (based on theme).

### Implementation details
- Add templates in `src/content/pois/*.json`.
- Spawn POIs during map generation; store in `state.world.pois`.
- Create interactables for hack nodes.

### Acceptance
- POIs appear in-world and are discoverable by walking.
- Hack nodes are interactable and show prompt.

### DoD (Definition of Done)
- No POI spawns inside non-walkable tiles.
- Dev overlay lists nearest POI and distance.

### QA checklist
- Generate MEGA and ensure POIs are not all clustered.
- Interact with 5 hack nodes in different districts.
