# Milestone I: Case Files v1 (side-story chains, evidence, suspects, investigations)

## Objective
Deliver the Watch Dogs “followable” side-stories: cases with evidence, suspect lists, and multi-step investigations.

## Exit criteria (acceptance for milestone)
- Case File UI exists: overview, objectives, suspects, evidence board.
- Evidence items are collectable and unlock new steps.
- At least 3 case archetypes play end-to-end (missing person, corruption, gang extortion).
- Cases are seeded and differ across runs.

## Phases
- I1: Case data model + UI
- I2: Evidence collection + gating
- I3: Archetypes + procedural assembly

## Tickets

## Ticket I-1: Case File data model + persistence
- **Phase:** I1
- **Depends on:** H-1, F-3

### Objective
Represent cases independently of quests but implemented on top of quest engine for execution.

### Design
Case = seeded template that instantiates one or more quests. Case state includes suspects, evidence, leads, current chapter.

### Specs
- `state.cases.active[]`, `state.cases.completed[]`.
- Case has: id, type, districtId, difficulty, suspects[], evidence[], leads[].

### Implementation details
- Add `src/sim/cases/case_manager.js`.
- Case manager listens to anomalies and spawns cases.
- Save/load includes cases.

### Acceptance
- A case can be created, progressed, saved, and resumed.
- Case list UI updates correctly.

### DoD (Definition of Done)
- Validator for case state in `validateGameState`.
- Dev command: spawn specific case type.

### QA checklist
- Spawn 3 cases; complete 1; verify state lists update.
- Reload mid-case; progress continues.

## Ticket I-2: Evidence system (collect, display, unlock)
- **Phase:** I2
- **Depends on:** B-3, G-2, H-2

### Objective
Make investigations feel tangible.

### Design
Evidence items exist in world (terminal logs, CCTV clip, witness statement). Collecting evidence sets flags and may reveal new locations/suspects.

### Specs
- Evidence types: log, cctv, witness, physical.
- Evidence has `sourcePoiId` and optional `suspectId` link.
- Collect action: interact + optional hack.

### Implementation details
- Add `src/sim/evidence/evidence_system.js`.
- Add UI: evidence board list and detail view.
- Integrate with quest steps: `INVESTIGATE` step requires evidence id.

### Acceptance
- Collecting evidence updates case UI and unlocks next step.
- Evidence cannot be collected twice.

### DoD (Definition of Done)
- Evidence entries have deterministic ids.
- At least 10 evidence templates exist.

### QA checklist
- Collect evidence after failing hack; ensure still works after retry.
- Save/load; evidence stays collected.

## Ticket I-3: Case archetypes + procedural assembly v1
- **Phase:** I3
- **Depends on:** I-1, I-2

### Objective
Ensure each run produces unique cases without authoring 100% by hand.

### Design
Case templates are storylets with tags. Assemble chain based on district theme + citizen graph + rival pressure. Use quest engine for execution.

### Specs
- Archetypes: missing_person, corruption, extortion.
- Each case is 3–6 chapters; each chapter is 1 quest.
- Branch point at chapter 2 or 3 based on player choice.

### Implementation details
- Add `src/content/cases/templates/*.json`.
- Add `src/sim/cases/assembler.js` using `rngQuest`.
- Expose `caseSeed` stored in case.

### Acceptance
- Starting a new seed yields different suspect names/locations.
- Case flow remains coherent (no missing references).

### DoD (Definition of Done)
- Validation prevents impossible assembly.
- At least 9 total cases playable across 3 archetypes.

### QA checklist
- Generate 5 seeds; verify case diversity.
- Complete one of each archetype.
