# Milestone K — Surveillance + Influence Operations (Watch Dogs layer, not just hacking) (target: 0.24.x)

## Objective 🎯
- Add the **information/influence layer**: surveillance, intel, blackmail, leaks, bribery.
- Make actions have tradeoffs: heat/exposure vs influence vs stability.
- Integrate with Data Grid (Milestone H) and social graph (Milestone J).

---

## Milestone Exit Criteria (Acceptance)
- ✅ Player can collect intel on citizens/factions via surveillance sources (cameras, informants).
- ✅ Player can run at least 6 influence operations (bribe/leak/smear/recruit/blackmail/protect).
- ✅ Public sentiment exists per district and changes from operations and crises.
- ✅ Operations affect rival/factions and can trigger retaliation events.


## Definition of Done (DoD)
- All operations are data-driven and logged (for debugging and balancing).
- Heat/exposure system has clear UI feedback and counterplay.
- Save/load preserves intel inventory and ongoing operations.


---

## Phases
1) Intel model
2) Operations system
3) Sentiment + media loop
4) UI + balancing hooks


---

## Tickets

### K-01 — Intel database (profiles, evidence, secrets)
**Objective:** Represent knowledge as a first-class gameplay resource.

**Design**
- Intel items have type, subject, source, reliability, and expiry.
- Citizen profiles reveal fields gradually (unknown → partial → verified).


**Specs**
- `state.intel = { items[], knownProfiles{} }`
- `src/sim/intel/intel_db.js`
- Intel item schema documented in `docs/INTEL_SCHEMA.md`


**Implementation details**
1. Implement intel item creation and storage.
2. Add basic reliability/expiry mechanics.
3. Integrate with citizen panel to show known fields.


**Acceptance**
- Using a camera source can generate a new intel item about a citizen.
- Intel can be viewed in an 'Intel' screen.


**DoD**
- Intel list is capped; old items archived with summary.


---

### K-02 — Surveillance sources (cameras, drones, informants)
**Objective:** Enable information gathering without phone hacking.

**Design**
- Sources exist on the map and have coverage constraints (Data Grid).
- Actions: 'observe area', 'tail target', 'stakeout'.


**Specs**
- `state.intel.sources[] = { id, type, x,y, active }`
- `src/sim/intel/surveillance.js`
- UI: Grid overlay + 'Scan' tool


**Implementation details**
1. Add a Scan tool that uses sources within coverage to reveal nearby entities.
2. Implement 'tail' as a timed objective (keep target in range).
3. Add drones as consumable/limited devices (optional).


**Acceptance**
- Scanning reveals at least: citizen names, faction presence, incident markers.
- Tail objective can succeed/fail with clear feedback.


**DoD**
- Surveillance tick cost bounded (no N^2 scans).


---

### K-03 — Influence operations engine (data-driven actions)
**Objective:** Make player feel like a fixer/shadow mayor.

**Design**
- Operations are templates with requirements, costs, and effects.
- Effects can target: district modifiers, faction rep, specific NPC status.


**Specs**
- `src/content/operations.json`
- `src/sim/influence/operations_engine.js`
- `state.ops.active[]` and `state.ops.history[]`


**Implementation details**
1. Define 6 baseline operations: bribe, leak, smear, recruit, blackmail, protect.
2. Implement requirements (needs intel item tags) and costs (cash/influence/heat).
3. Apply effects via a pure `applyEffect(effect, context)` function.


**Acceptance**
- Player can run an operation end-to-end and see a measurable city change.
- Operation history shows what happened and why.


**DoD**
- Operations engine never mutates state outside approved effect functions.


---

### K-04 — Public sentiment + media cycle
**Objective:** Give operations systemic consequences and make the city 'react'.

**Design**
- Sentiment per district: trust/fear/approval axes (simplify to 1–2 first).
- Media cycle periodically amplifies events/operations into sentiment shifts.


**Specs**
- `state.sentiment.district[]`
- `src/sim/influence/sentiment.js`
- `src/ui/news_feed.js`


**Implementation details**
1. Add sentiment values and visualize as overlay/mini widgets.
2. Implement media tick that converts events into sentiment changes.
3. Add news feed entries (headline + short text).


**Acceptance**
- A smear/leak operation changes sentiment and affects demand/crime within a few cycles.
- Player can monitor sentiment changes via UI.


**DoD**
- Sentiment math documented with tooltips.


---

### K-05 — Exposure/heat v2 (counterplay and retaliation)
**Objective:** Balance power fantasy with risk.

**Design**
- Heat increases from aggressive ops and surveillance.
- Counterplay: lay low, invest in legal cover, public programs, or pay down exposure.


**Specs**
- Extend `state.player.heat` and add `state.player.exposure`
- `src/sim/influence/exposure.js`


**Implementation details**
1. Differentiate heat (short-term) vs exposure (long-term).
2. Add retaliation events from rival/factions at thresholds.
3. Add UI meter + warnings + mitigation actions.


**Acceptance**
- High exposure triggers at least 2 types of retaliation events.
- Mitigation actions can reduce exposure over time.


**DoD**
- Retaliation events are deterministic and logged for QA.


---
