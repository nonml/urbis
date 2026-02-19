# Milestone J — Citizen Simulation v2 (Households, Jobs, Crime, Social Graph) (target: 0.22.x)

## Objective 🎯
- Upgrade citizens from simple walkers into a simulation that produces stories.
- Add households, jobs, wages, and basic crime dynamics.
- Establish a persistent social graph that feeds quests and influence ops.

---

## Milestone Exit Criteria (Acceptance)
- ✅ Citizens belong to households and occupy housing units.
- ✅ Jobs have wages; unemployment and inequality affect crime and happiness.
- ✅ Crime incidents emerge from conditions and are mitigated by policing/poverty programs.
- ✅ Social graph (friend/enemy/family) exists for at least 10% of population and persists.


## Definition of Done (DoD)
- Citizen data remains stable under save/load and migrations.
- Sim avoids NaNs and runaway growth (hard caps + sanity checks).
- Debug overlays exist for citizen stats and incidents.


---

## Phases
1) Households + housing
2) Jobs + wages
3) Crime incidents
4) Social graph + debug


---

## Tickets

### J-01 — Household model + housing units
**Objective:** Create a scalable way to represent population realistically.

**Design**
- Household is a unit with members, income, home building, and needs.
- Residential buildings provide `units` capacity (not infinite).


**Specs**
- `state.households[]` and `state.citizens[]` reference householdId
- Residential building config includes `units`
- `src/sim/citizens/households.js`


**Implementation details**
1. Create household generator during growth.
2. Assign households to available residential units.
3. Update UI stats: population, households, occupancy %.


**Acceptance**
- Population cannot exceed available housing units (unless homelessness is implemented).
- Vacancy and occupancy are visible in UI.


**DoD**
- No per-citizen expensive searches each tick; use indices/maps.


---

### J-02 — Job market v1 (employment, wages, education)
**Objective:** Make economy human and story-generating.

**Design**
- Each job building provides N jobs with wage bands.
- Citizens seek jobs based on education/skills and distance.


**Specs**
- `state.jobs = { openingsByBuildingId, wageBands }`
- `src/sim/economy/jobs.js`


**Implementation details**
1. Add job slots to building definitions.
2. Implement job assignment pass (batch) each budget cycle.
3. Compute unemployment rate and expose in UI.


**Acceptance**
- Adding job buildings reduces unemployment over time.
- Higher wages improve happiness but increase business expenses (future hook).


**DoD**
- Job assignment deterministic (sorted candidates + RNG only for ties).


---

### J-03 — Crime incident generator + resolution loop
**Objective:** Create emergent conflict and pressure without scripted events.

**Design**
- Crime probability increases with unemployment, inequality, low police coverage.
- Incidents spawn at hotspots and can be resolved by police response or player intervention.


**Specs**
- `state.crime = { incidents[], heatMap }`
- `src/sim/crime/crime_system.js`


**Implementation details**
1. Generate incidents based on district stats and coverage.
2. Create resolution logic (success chance depends on response time and coverage).
3. Add UI feed entries and map markers.


**Acceptance**
- High unemployment districts show more incidents.
- Improving policing reduces incidents within a few cycles.


**DoD**
- Incident list bounded; old incidents archived to history.


---

### J-04 — Social graph v1 (relationships, factions, rumors)
**Objective:** Enable Watch Dogs-like personal stories without hand-authoring everyone.

**Design**
- Sparse graph: each citizen has 2–6 relations from templates.
- Relations have type + strength and can change from events.
- Rumors are small 'facts' that can propagate through the graph.


**Specs**
- `state.social.edges[] = { aId, bId, type, strength }`
- `src/sim/social/social_graph.js`
- `state.rumors[]`


**Implementation details**
1. Generate relations at citizen creation and occasionally over time.
2. Expose a citizen profile panel showing top relations.
3. Add rumor propagation tick (bounded).


**Acceptance**
- At least one minor case can reference social relations (e.g., friend knows suspect).
- Rumors can shift district sentiment slightly.


**DoD**
- Graph operations are O(E) with caps; no runaway propagation.


---

### J-05 — Citizen profile UI + debug inspector
**Objective:** Make the sim understandable to players and devs.

**Design**
- Click a citizen → show panel: name, job, household, mood, secrets (if known), relations.
- Dev mode shows hidden fields; release hides them.


**Specs**
- `src/ui/citizen_panel.js`
- Uses selection system + raycast in Street Mode.


**Implementation details**
1. Implement selection on citizen mesh/instance.
2. Populate panel from state.
3. Add dev toggle to reveal full profile.


**Acceptance**
- Player can inspect at least 10 citizens reliably.
- Panel updates when citizen state changes.


**DoD**
- Panel does not spam DOM updates (diff-based rendering).


---
