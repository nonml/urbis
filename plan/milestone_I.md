# Milestone I — Traffic Simulation + Player Driving (target: 0.20.x)

## Objective 🎯
- Introduce roads-as-a-graph and traffic metrics (core City Skylines loop).
- Implement citizen commuting and basic vehicle agents with LOD.
- Add drivable vehicles for Street Mode (GTA feel).

---

## Milestone Exit Criteria (Acceptance)
- ✅ Traffic overlay shows congestion hotspots and average commute time.
- ✅ Citizens commute between home and work using the road graph (at least for a sample set).
- ✅ Player can enter a vehicle and drive across the city with collision.
- ✅ MEGA uses traffic LOD: near-player agents + far-field statistics.


## Definition of Done (DoD)
- Road graph generation is deterministic and stable per seed.
- Vehicle sim does not tank performance on City preset.
- Crises can be caused by traffic failures (gridlock impacts services).


---

## Phases
1) Road graph + routing
2) Traffic agents + metrics
3) Player driving
4) LOD + perf


---

## Tickets

### I-01 — Road graph extraction from road tiles
**Objective:** Convert road tiles into a navigable graph for routing.

**Design**
- Nodes at intersections/turns; edges along straight segments.
- Each edge has length and capacity; congestion increases travel time.


**Specs**
- `src/sim/traffic/road_graph.js`
- `state.traffic.roadGraph = { nodes[], edges[] }` (serializable)


**Implementation details**
1. Scan road tilemap to find junctions and build nodes.
2. Build edges between nodes along road segments.
3. Store adjacency lists for routing.


**Acceptance**
- Graph is connected for typical generated cities.
- Pathfinding between two random road nodes succeeds.


**DoD**
- Graph rebuild is incremental (only when roads change).


---

### I-02 — Routing system (A* / Dijkstra) + caching
**Objective:** Make routing fast enough for many agents.

**Design**
- Use Dijkstra/A* with heuristic on node positions.
- Cache frequently used OD pairs (home↔work) per citizen.


**Specs**
- `src/sim/traffic/router.js`
- `state.traffic.routeCache` (bounded LRU)


**Implementation details**
1. Implement routing on the road graph.
2. Add cache with max entries and eviction.
3. Expose dev command to clear cache and profile routing time.


**Acceptance**
- 1000 route queries on City complete within a reasonable budget (profiling).
- Routes update if roads are bulldozed.


**DoD**
- Cache bounded; no memory leak.


---

### I-03 — Traffic agents v1 (cars) + congestion metrics
**Objective:** Create visible traffic and meaningful congestion numbers.

**Design**
- Spawn a capped number of simulated cars representing commutes.
- Edge occupancy drives congestion; increases travel time.


**Specs**
- `src/sim/traffic/traffic_agents.js`
- `state.traffic.metrics = { avgCommute, congestionIndex }`


**Implementation details**
1. Spawn cars for a subset of citizens and simulate along edges.
2. Accumulate per-edge occupancy and compute congestion.
3. Render cars near player as instanced meshes; far field uses stats only.


**Acceptance**
- Congestion increases when roads are insufficient for population.
- Traffic overlay correlates with visible car density.


**DoD**
- Agent count scales by preset and is capped.


---

### I-04 — Player vehicle system (enter/exit, driving, collisions)
**Objective:** Add GTA-like street agency.

**Design**
- Spawn a few vehicles near roads.
- Player can enter with `F`, drive with WASD, exit with `F`.
- Simple collision with buildings/props; no physics engine required initially.


**Specs**
- `src/sim/player/vehicle_controller.js`
- `src/render/vehicle_render.js`


**Implementation details**
1. Implement vehicle entity and controller.
2. Switch camera follow target between avatar and vehicle.
3. Add basic collision resolution (AABB or capsule vs obstacles).


**Acceptance**
- Player can drive across the map without falling through geometry.
- Vehicle speed feels controllable (tunable).


**DoD**
- Driving input does not interfere with God Mode tools.


---

### I-05 — Public services routing dependency (ambulance/fire response time)
**Objective:** Tie traffic back into city-builder stakes.

**Design**
- Service response time depends on road travel time.
- High congestion increases fatality/damage in crises.


**Specs**
- `src/sim/services/response_time.js`
- Crisis outcomes reference response time metric.


**Implementation details**
1. Compute travel time between service building and incident node.
2. Apply modifier to crisis resolution outcomes.
3. Add UI 'Response time' badge per district.


**Acceptance**
- Gridlock measurably worsens fire/medical outcomes.
- Player can improve outcomes by adding roads or services.


**DoD**
- Calculations cached to avoid per-tick heavy routing.


---
