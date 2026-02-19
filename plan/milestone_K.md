# Milestone K: Rival AI v2 (strategic pressure + counterplay + intel)

## Objective
Make the rival controller a real antagonist: applies pressure, reacts to your strategy, and can be countered via hacks/cases.

## Exit criteria (acceptance for milestone)
- Rival performs actions at intervals and telegraphs via intel clues.
- Actions target weak points (power deficit, low police coverage, high inequality).
- Player can counter at least 3 rival actions via quests/hacks/policies.
- Rival is deterministic per seed.

## Phases
- K1: Strategic evaluator + action selection
- K2: Action execution + counterplay hooks
- K3: Intel system

## Tickets

## Ticket K-1: Rival strategy evaluator (city weakness scoring)
- **Phase:** K1
- **Depends on:** J-1, E-3

### Objective
Choose actions based on meaningful city metrics, not random.

### Design
Compute weakness vector per tick: economy, services, public opinion, security, heat. Actions have preconditions and utility functions.

### Specs
- Weakness metrics normalized 0..1.
- Each action defines: preconditions, base utility weights, cooldown.
- At least 8 actions implemented with distinct impacts.

### Implementation details
- Update `src/sim/rival/rival_actions.js` to use weakness vector.
- Add `src/sim/rival/weakness.js`.
- Keep deterministic tie-breakers.

### Acceptance
- If power deficit is high, sabotage-grid is chosen more often.
- If police rep is hostile, rival uses propaganda less (already aligned).

### DoD (Definition of Done)
- Utility calculations logged in dev overlay (top 3).
- No action triggers if preconditions fail.

### QA checklist
- Create power deficit then wait; observe sabotage bias.
- Fix deficit; observe different action selection.

## Ticket K-2: Counterplay quests/hacks for rival actions
- **Phase:** K2
- **Depends on:** H-3, I-1

### Objective
Give players agency: detect and undo rival damage.

### Design
Each rival action creates a “counter objective” (quest/case hook) with a timer. Success mitigates effects and yields rewards.

### Specs
- Counter objective available within 1 tick of action.
- Timer: 10–30 ticks based on difficulty.
- At least 3 actions have counterplay in 1.0 path.

### Implementation details
- Emit event `rival_action_started` with payload.
- Case manager or quest engine spawns counter quest.
- Apply mitigation by reducing duration or reversing impact.

### Acceptance
- Player can complete counter quest and see effects reduced.
- Failing timer makes effects worse (optional) but consistent.

### DoD (Definition of Done)
- No duplicate counter quests.
- Counter status saved/loaded.

### QA checklist
- Force rival sabotage via dev menu; complete counter; verify recovery.

## Ticket K-3: Intel system (signals, surveillance, safehouse)
- **Phase:** K3
- **Depends on:** G-3, C-4

### Objective
Telegraph rival moves and create exploration incentives.

### Design
Intel points are gained by hacking cameras, using safehouses, completing cases. Intel reveals rival plans and improves counter windows.

### Specs
- Intel meter 0..100; spend intel to reveal target district/poi.
- Safehouses provide daily intel regen.
- Intel affects: action delay, detection chance, counter timer.

### Implementation details
- Add `src/sim/intel/intel_system.js`.
- UI: intel bar + ‘spend to reveal’ button.
- Tie into hack actions (camera takeover gives +intel).

### Acceptance
- Gather intel via play; spend intel reveals upcoming rival action.

### DoD (Definition of Done)
- Intel is deterministic and saved.
- Intel sources are logged with reasons.

### QA checklist
- Hack 5 cameras; confirm intel increases.
- Spend intel; confirm UI and reveal marker.
