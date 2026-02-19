# Milestone F — Dual-Mode Foundation + God Mode Tools (target: 0.14.x)

## Objective 🎯
- Introduce **dual-mode gameplay**: God Mode (macro city control) + Street Mode (third-person avatar).
- Implement zoning, bulldoze, and planning tools as the core City Builder loop.
- Create a mode-safe input/UX system so controls don’t conflict.

---

## Milestone Exit Criteria (Acceptance)
- ✅ Player can toggle God/Street modes seamlessly; mode is visible at all times.
- ✅ Player can zone Residential/Commercial/Industrial areas and see demand indicators change.
- ✅ Bulldoze, rotate, and snap-to-parcel/road placement works in God Mode.
- ✅ Save/load preserves zoning and mode-related state.


## Definition of Done (DoD)
- All tools have tooltips + hotkeys and appear in the build menu.
- No console errors during 30-minute City preset play session.
- Core systems are deterministic with the seed (zoning layouts reproducible).


---

## Phases
1) Mode switching + input routing
2) God Mode camera + tool framework
3) Zoning + demand hooks
4) Save/load integration


---

## Tickets

### F-01 — Mode system (God Mode ↔ Street Mode) + input router
**Objective:** Prevent control conflicts and establish a clean foundation for dual-mode play.

**Design**
- Two explicit modes: `MODE_STREET`, `MODE_GOD`.
- Input is routed through a single dispatcher that checks current mode and active tool.
- Mode toggle key: `Tab` (configurable).


**Specs**
- `state.mode = 'street' | 'god'`
- `src/input/input_router.js`
- `src/ui/mode_indicator.js` (HUD label + icon)


**Implementation details**
1. Create input router and register handlers (camera, movement, build tools).
2. Implement mode toggle and lock out invalid actions (no avatar movement in God Mode).
3. Add HUD mode indicator and quick help overlay key `H`.


**Acceptance**
- Switching modes never leaves controls 'stuck' (no phantom mouse capture).
- Street movement and God camera controls work independently.


**DoD**
- All hotkeys documented in `README.md` and in-game help overlay.


---

### F-02 — God Mode camera (orbit/pan/zoom) + selection/raycast
**Objective:** Make macro planning usable on Small → MEGA.

**Design**
- God camera is top-down angled orbit with pan and smooth zoom.
- Selection raycasts against ground/parcel mesh; highlights tile/parcel under cursor.
- Optional grid overlay toggle.


**Specs**
- `src/render/god_camera.js`
- `src/render/selection.js` outputs `{tileX,tileY,parcelId}`
- Hotkeys: `MMB drag` pan, `scroll` zoom, `RMB drag` rotate


**Implementation details**
1. Add a dedicated camera rig for God Mode and swap active camera in renderer.
2. Implement ground picking with Three.js raycaster.
3. Render highlight decal/outline for selected tile/parcel.


**Acceptance**
- User can zoom out to see the whole Small map and navigate quickly on City.
- Cursor highlight is stable and doesn’t jitter.


**DoD**
- No per-frame allocations in selection loop (reuse vectors).


---

### F-03 — Zoning system v1 (R/C/I) + brush tools
**Objective:** Introduce the City Skylines-style macro lever that drives growth.

**Design**
- Zoning is a per-tile attribute separate from buildings.
- Brush sizes: 1, 3, 5 (hotkeys 1/2/3).
- Zones can be painted and erased.


**Specs**
- `state.map.zoneMap` as packed array (Uint8).
- Zone enums: `ZONE_NONE, ZONE_RES, ZONE_COM, ZONE_IND`
- `src/sim/zoning/zoning.js`


**Implementation details**
1. Add zone map to state and include in save/load.
2. Implement paint/erase tools using the God Mode selection + brush.
3. Render zone overlay in God Mode (toggle `Z`).


**Acceptance**
- Zoned tiles persist after reload.
- Zone overlay matches saved data.


**DoD**
- Brush operations are deterministic and chunk-updated for MEGA.


---

### F-04 — Demand model v1 + simple growth hooks
**Objective:** Make zoning meaningful by driving new buildings/citizens.

**Design**
- Compute R/C/I demand from ratios: jobs, housing, wealth, services.
- When demand is high, the sim can auto-spawn buildings onto valid parcels (optional toggle).


**Specs**
- `state.economy.demand = { res, com, ind }` (0..1)
- `src/sim/economy/demand.js`


**Implementation details**
1. Calculate demand each tick from city stats.
2. Expose demand bars in UI.
3. Implement minimal auto-growth: if RES demand high → spawn a house on a RES-zoned parcel.


**Acceptance**
- Changing zoning visibly changes demand within ~1 minute of sim time.
- Auto-growth can be toggled off for sandbox.


**DoD**
- Growth chooses targets deterministically (stable ordering + RNG).


---

### F-05 — Build tool overhaul (bulldoze, rotate, cost preview)
**Objective:** Make building placement feel like a real builder.

**Design**
- Unified build menu with categories and search.
- Bulldoze tool removes buildings and clears parcels.
- Cost preview and affordability check before placement.


**Specs**
- `src/ui/build_menu.js`
- `src/sim/buildings/build_tool.js`
- `state.ui.activeTool`


**Implementation details**
1. Refactor build placement into a tool state machine (preview → confirm).
2. Add rotate key `Q/E` for applicable buildings.
3. Implement bulldoze tool with undo buffer (last 10 actions).


**Acceptance**
- Player cannot place buildings without enough resources.
- Bulldoze refunds a configurable % and updates sim immediately.


**DoD**
- Undo buffer does not corrupt state; save/load ignores undo history.


---
