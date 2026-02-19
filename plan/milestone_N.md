# Milestone N: Traffic + ambient vehicles + pedestrians (city life layer)

## Objective
Populate the city so it feels alive and supports chases and immersion.

## Exit criteria (acceptance for milestone)
- Ambient traffic drives along roads with simple rules.
- Pedestrians (citizens) are visible near roads/POIs and follow schedules.
- Traffic reacts to hacked lights and police chases.
- Performance remains stable on CITY and acceptable on MEGA.

## Phases
- N1: Ambient vehicle spawner + road following
- N2: Interactions with lights + police
- N3: Pedestrian rendering + LOD

## Tickets

## Ticket N-1: Ambient traffic v1 (road-follow + intersections)
- **Phase:** N1
- **Depends on:** C-2, L-2

### Objective
Basic city traffic for ambience and obstacles in chases.

### Design
Traffic vehicles follow road graph edges, choose turns at intersections via weighted randomness (district density). Avoid collisions with simple spacing.

### Specs
- Active traffic cap: SMALL 20, CITY 80, MEGA 150 (streamed).
- Intersection turn choice: 60% straight, 20% left, 20% right (tunable).
- Spacing: keep 2–6m gap.

### Implementation details
- Add `src/sim/traffic/traffic_system.js`.
- Use road graph from C-2 for routing.
- Integrate with chunk streaming; spawn in active chunks only.

### Acceptance
- Traffic moves continuously and doesn’t pile up permanently.

### DoD (Definition of Done)
- Traffic sim cost < 5ms per tick CITY.
- Deterministic routing when seeded.

### QA checklist
- Hack traffic light; see vehicles stop/go accordingly.

## Ticket N-2: Traffic-light system + crash events
- **Phase:** N2
- **Depends on:** G-3, N-1

### Objective
Make traffic light hacks impactful.

### Design
Intersections have light state with cycle timing. Hacking overrides state for duration. Incorrect overrides can trigger crashes as events.

### Specs
- Light cycle: 8–12 seconds per direction.
- Hack override duration: 6 seconds.
- Crash event probability increases during police chase.

### Implementation details
- Add `src/sim/traffic/lights.js`.
- Expose lights as hackables.
- Crash event spawns VFX + blocks road for N seconds.

### Acceptance
- Hacking lights changes traffic flow.
- Crashes can occur and affect pursuit routes.

### DoD (Definition of Done)
- No crashes cause hardlocks; road clears automatically.
- Crash blocks are visible on minimap.

### QA checklist
- Trigger crash; ensure nav reroutes or stops gracefully.

## Ticket N-3: Pedestrian visibility + LOD
- **Phase:** N3
- **Depends on:** F-1, D-2

### Objective
Make citizens visible in third-person view without destroying performance.

### Design
Render nearby citizens as instanced meshes; far citizens as low-cost markers or not rendered.

### Specs
- Render radius: 80m on foot, 120m driving.
- LOD tiers: full mesh, billboard, none.

### Implementation details
- Extend renderer citizen instancing.
- Add per-chunk citizen lists for rendering only.

### Acceptance
- City feels populated in dense districts.
- No major FPS collapse when many citizens exist.

### DoD (Definition of Done)
- Citizen render updates only on sim tick.

### QA checklist
- CITY with 2000 citizens: average FPS stable.
