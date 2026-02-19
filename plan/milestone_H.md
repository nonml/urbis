# Milestone H — Infrastructure Networks (Power / Water / Sewage / Data Grid) (target: 0.18.x)

## Objective 🎯
- Add core utility networks that create systemic constraints like City Skylines.
- Introduce the **Data Grid** as the Watch Dogs-ish information layer foundation (not just hacking).
- Provide overlays so players can reason about failures.

---

## Milestone Exit Criteria (Acceptance)
- ✅ Power and water coverage are simulated and can fail (brownouts, water shortage).
- ✅ Sewage/garbage (choose one for v1) creates pollution/health pressure when insufficient.
- ✅ Data Grid (towers/cameras) exists, can be expanded, and powers intel gameplay later.
- ✅ Overlays show network coverage and bottlenecks.


## Definition of Done (DoD)
- Network updates are incremental (chunk/graph based).
- All network state is saved/loaded with schema versioning.
- At least one crisis chain is caused by each network failure type.


---

## Phases
1) Network data model
2) Placement + propagation
3) Overlays + UX
4) Crisis integration


---

## Tickets

### H-01 — Utility graph/coverage framework (shared)
**Objective:** Avoid implementing each network from scratch.

**Design**
- Abstract 'network' that supports sources, consumers, and propagation (grid BFS or graph).
- Two operation modes: simple radius coverage (early) and connected graph (later).


**Specs**
- `src/sim/networks/network_core.js`
- `state.networks = { power:{...}, water:{...}, data:{...} }`


**Implementation details**
1. Create network core with API: `addSource`, `addConsumer`, `recomputeChunks(chunks)`.
2. Implement packed coverage buffer for fast queries (0..255).
3. Add debug overlay toggles.


**Acceptance**
- Network core can be reused for power and water with different configs.
- Coverage queries are O(1) per tile.


**DoD**
- MEGA recompute only touches affected chunks.


---

### H-02 — Power network v1 (generation + consumption + outages)
**Objective:** Make growth constrained by electricity.

**Design**
- Generators produce MW; buildings consume MW.
- If demand > supply, underpowered districts suffer penalties and blackout crises.


**Specs**
- New buildings: `PowerPlant`, optional `Substation`
- `state.networks.power = { supply, demand, coverage }`
- `src/sim/networks/power.js`


**Implementation details**
1. Add generator building + upkeep.
2. Compute demand from placed buildings.
3. Trigger blackout events when supply short and apply penalties.


**Acceptance**
- Turning off/losing a plant reduces powered area and impacts citizens.
- UI shows power supply vs demand.


**DoD**
- Blackout penalty is reversible when power restored.


---

### H-03 — Water + sewage v1 (supply, pollution, health)
**Objective:** Add classic city-builder pressure tied to health/crises.

**Design**
- Water plant provides supply; buildings consume.
- If sewage capacity insufficient, pollution rises and illness crises increase.


**Specs**
- Buildings: `WaterPlant`, `SewagePlant`
- `src/sim/networks/water.js`, `src/sim/networks/sewage.js`


**Implementation details**
1. Implement supply/demand and coverage like power.
2. Add pollution map affected by sewage shortage.
3. Integrate with citizen health and crisis director.


**Acceptance**
- Water shortage slows growth and reduces happiness.
- Sewage shortage increases pollution overlay and illness rate.


**DoD**
- Overlays render at reduced resolution for perf.


---

### H-04 — Data Grid v1 (towers + cameras + coverage)
**Objective:** Foundation for surveillance and influence gameplay (Watch Dogs element).

**Design**
- Data coverage comes from towers/hubs; cameras are intel sources within coverage.
- No phone hacking required: it's city-owned infrastructure you invest in.


**Specs**
- Buildings/props: `CellTower`, `CameraPole`, `DataHub`
- `state.networks.data.coverage` + `state.intel.sources[]`
- `src/sim/networks/data_grid.js`


**Implementation details**
1. Add tower building type that expands data coverage.
2. Spawn/allow placement of camera props; active only when covered.
3. Expose 'Grid' overlay showing coverage % and blind spots.


**Acceptance**
- Player can expand data coverage and see blind spots shrink.
- Covered cameras provide 'intel pings' (placeholder event).


**DoD**
- Data grid does not break existing renderer performance.


---

### H-05 — Utility overlays + UX integration
**Objective:** Make networks legible and debuggable.

**Design**
- Overlay hotkeys: `1` power, `2` water, `3` sewage, `4` data.
- HUD shows summary bars: coverage %, supply/demand.


**Specs**
- `src/ui/overlays/network_overlay.js`
- Reuse perf overlay style for debug info.


**Implementation details**
1. Implement overlay toggles and render tinted ground tiles (instanced attribute or decal).
2. Add HUD summary widgets.
3. Add tooltips when hovering a building: its demand/production.


**Acceptance**
- Player can identify why a district is failing (power/water/etc.) in < 30 seconds.
- Overlays update within 1 second of building changes.


**DoD**
- Overlay rendering avoids per-tile DOM; uses GPU-friendly approach.


---
