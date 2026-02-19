# Milestone F: Citizen simulation v2 (needs, schedules, jobs, pathing, stories)

## Objective
Turn citizens into the core emergent system: schedules, relationships, needs, and predictable responses to city conditions.

## Exit criteria (acceptance for milestone)
- Citizens have daily schedules (home/work/leisure) and move using nav paths.
- Jobs link to buildings; staffing impacts production and services.
- Relationship graph exists and can create conflicts/alliances.
- At least 3 emergent “anomaly” types can be detected from citizen simulation.

## Phases
- F1: Agent model + schedules
- F2: Job system + staffing effects
- F3: Relationship graph + anomalies

## Tickets

## Ticket F-1: Citizen agent model (state + movement + needs)
- **Phase:** F1
- **Depends on:** D-3, E-3

### Objective
Standardize citizen data so future systems don’t diverge.

### Design
Citizen fields: id, homeParcel, workBuildingId, schedule, needs (food/rest/safety), mood, traits, relationships[]. Movement uses nav paths and simple steering.

### Specs
- Max citizens: SMALL 300, CITY 2000, MEGA 8000 (sim may LOD).
- Needs decay per tick; thresholds trigger behavior changes.
- Citizen LOD: simulate full for nearby; coarse for far.

### Implementation details
- Add `src/sim/citizens/citizen_state.js` schema helpers.
- Add `src/sim/citizens/citizen_sim.js` tick update with LOD tiers.
- Integrate with `NavGrid` pathfinding.

### Acceptance
- Citizens move around the city; no stuck oscillation.
- Needs visibly change and affect happiness.

### DoD (Definition of Done)
- Deterministic at fixed seed.
- Performance: CITY 2000 citizens tick < 12ms.

### QA checklist
- Spawn 500 citizens; watch for pathing failures.
- Save/load; citizens resume schedules.

## Ticket F-2: Jobs + staffing + production coupling
- **Phase:** F2
- **Depends on:** E-2, F-1

### Objective
Make buildings depend on citizens (supply/demand).

### Design
Buildings declare job slots by role. Citizens seek jobs based on distance, wage, trait fit. Staffing ratio scales building output and service quality.

### Specs
- Job search radius: 40 tiles default; expands if unemployed.
- Staffing ratio clamps 0..1.
- Wage: drains gold; improves happiness and retention.

### Implementation details
- Add `src/sim/economy/jobs.js` with matchmaker.
- Update building defs to include `jobs: [{role, slots, wage}]`.
- UI: building inspect panel shows staffing.

### Acceptance
- Unemployed citizens gradually find jobs.
- Removing a key building creates unemployment and reduces output.

### DoD (Definition of Done)
- No infinite loops in job assignment.
- Smoke test includes staffing effects.

### QA checklist
- Build 1 factory; confirm jobs fill and resources increase.
- Destroy factory; confirm unemployment rises.

## Ticket F-3: Relationship graph + anomaly detectors
- **Phase:** F3
- **Depends on:** F-1

### Objective
Generate story hooks from simulation.

### Design
Maintain sparse relationship graph (max 8 edges per citizen). Generate events when conditions match patterns (betrayal, missing person, corruption, gang recruitment).

### Specs
- Anomaly types: `missing_person`, `workplace_conflict`, `blackmail`.
- Detectors run every N ticks and output events to eventBus.
- Each anomaly includes: involved citizens, district, severity.

### Implementation details
- Add `src/sim/anomalies/detectors.js`.
- Persist anomaly history in `state.world.anomalies`.
- UI: anomaly notifications + map marker.

### Acceptance
- Anomalies appear naturally within 10–30 minutes of play.
- Anomalies are different across seeds.

### DoD (Definition of Done)
- Detectors are deterministic and rate-limited.
- No duplicate spam for same underlying issue.

### QA checklist
- Run sim 200 ticks; verify anomaly events appear in log.
- Reload save; anomalies persist.
