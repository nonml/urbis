# Milestone M — Dynamic Crises v2 + Emergency Response (target: 0.28.x)

## Objective 🎯
- Evolve crises from random events into **state-driven chains** with forecasting.
- Add emergency response units and response-time mechanics that tie to traffic and services.
- Create dramatic but fair failure/recovery loops.

---

## Milestone Exit Criteria (Acceptance)
- ✅ Crises have multi-step chains (warning → incident → aftermath).
- ✅ Emergency response (dispatch) exists for fire/medical/police incidents.
- ✅ Player can intervene in Street Mode to affect at least 2 crisis types.
- ✅ Crisis severity and frequency scale with city state (not pure RNG).


## Definition of Done (DoD)
- Every crisis has: trigger, escalation rules, resolution, aftermath effects.
- Crisis history is logged and saved.
- No soft-locks from crises (always at least one recovery path).


---

## Phases
1) Crisis director upgrade
2) Dispatch + response loop
3) Street interventions
4) Balance + UX


---

## Tickets

### M-01 — Crisis Director v2 (pressure-based + chain model)
**Objective:** Generate believable crises from the city’s condition.

**Design**
- Pressures: powerShortage, waterShortage, unemployment, inequality, congestion, pollution.
- Director picks chain templates weighted by pressures.


**Specs**
- `src/sim/crises/crisis_director.js`
- `state.crises = { active[], history[], pressures{} }`
- `src/content/crisis_chains.json`


**Implementation details**
1. Compute pressure signals each budget cycle.
2. Select and start crisis chain steps deterministically.
3. Add forecasting UI: 'risk meter' per crisis category.


**Acceptance**
- If power supply is low, blackout-related chains become more likely.
- Risk meter correlates with later crises.


**DoD**
- Chain templates are data-driven and validated at load.


---

### M-02 — Incident system (spawn, location, timers, damage)
**Objective:** Standardize how crises appear in world and progress over time.

**Design**
- Incident has type, location, severity, timer, and affected entities.
- Incidents can damage buildings, reduce sentiment, or kill citizens (optional).


**Specs**
- `state.incidents[]`
- `src/sim/incidents/incidents.js`
- Map marker + minimap icon per incident


**Implementation details**
1. Add incident spawner from crisis chain steps.
2. Implement ticking progression and outcomes.
3. Render markers and allow selecting incident to view details.


**Acceptance**
- Incidents appear with clear markers and countdown/impact info.
- Unresolved incidents escalate or resolve with consequences.


**DoD**
- Incident list bounded; old incidents archived.


---

### M-03 — Dispatch/response v1 (police/fire/ambulance)
**Objective:** Tie services + traffic into crisis outcomes.

**Design**
- Service buildings generate response units (virtual or visible).
- Response time computed via traffic routing; modifies outcome success.


**Specs**
- `src/sim/services/dispatch.js`
- `state.dispatch = { units[], assignments[] }`


**Implementation details**
1. For each incident, find nearest capable service building.
2. Compute response time using traffic router cache.
3. Apply success modifiers and show ETA in incident UI.


**Acceptance**
- Adding a fire station reduces average fire response time locally.
- Gridlock increases ETA and worsens outcomes.


**DoD**
- Dispatch uses cached routing; no per-tick heavy pathfinding.


---

### M-04 — Street Mode interventions (player can help/hinder)
**Objective:** Deliver the GTA-ish agency during crises.

**Design**
- At least two interventions:
- 1) deliver supplies / escort evac vehicle
- 2) secure area / calm crowd (influence mini-action)


**Specs**
- `src/sim/player/interventions.js`
- Interventions triggered from incident UI 'Respond in person'


**Implementation details**
1. Add incident interaction prompt when near marker.
2. Implement two mini-objectives with timers and success/fail effects.
3. Tie results into incident resolution.


**Acceptance**
- Player intervention can swing an incident outcome measurably.
- Interventions are optional; city systems still matter.


**DoD**
- No forced failure if player ignores interventions.


---

### M-05 — Aftermath system (rebuild, insurance, narrative consequences)
**Objective:** Make crises feed the long-term story and economy.

**Design**
- After an incident, apply district modifiers and building damage.
- Allow rebuilding; optionally add insurance policy that reduces cost.


**Specs**
- `src/sim/crises/aftermath.js`
- `state.map.districts[i].modifiers[]` extended


**Implementation details**
1. Apply damage levels to buildings; reduce output until repaired.
2. Add repair tool and cost model.
3. Write news feed entry summarizing aftermath.


**Acceptance**
- Player sees persistent consequences after major incident.
- Repair restores function and updates economy.


**DoD**
- Damage/repair survives save/load.


---
