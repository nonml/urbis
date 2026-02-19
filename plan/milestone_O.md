# Milestone O: Dynamic crisis director v2 + world events (systems-driven storytelling)

## Objective
Make crises feel like consequences of management choices and fuel missions/cases.

## Exit criteria (acceptance for milestone)
- Crisis director chooses events based on city pressure (not pure random).
- Event chains branch based on player response.
- At least 8 crisis types exist with 3 multi-step chains.
- Crises can spawn side missions and change district modifiers.

## Phases
- O1: Pressure model + crisis selection
- O2: Chain system + branching responses
- O3: Integration with quests/cases

## Tickets

## Ticket O-1: Pressure model + crisis selection
- **Phase:** O1
- **Depends on:** E-3, F-2

### Objective
Replace random disasters with state-based selection.

### Design
Compute pressures: power, water, health, crime, inequality, traffic. Use weighted selector with cooldowns and severity scaling.

### Specs
- Pressures 0..1 with smoothing (EMA).
- Cooldown per crisis type: 20–60 ticks.
- Severity tiers: 1..5 affects duration and impact.

### Implementation details
- Add `src/sim/crisis/pressure.js`.
- Update `CrisisManager` to use `rngSim` and pressure weights.

### Acceptance
- Running a power deficit increases blackout crisis frequency.

### DoD (Definition of Done)
- Crisis selection deterministic per seed.

### QA checklist
- Create traffic congestion; see traffic-related crises increase.

## Ticket O-2: Crisis chains + response UI
- **Phase:** O2
- **Depends on:** O-1

### Objective
Make crises interactive with branching outcomes.

### Design
Crisis chain has stages. Player picks response options with costs and effects. Outcomes set district modifiers and faction rep changes.

### Specs
- Response window: 30–90 seconds depending on severity.
- At least 3 options per crisis stage.
- Option effects include: resources, heat, rep, service modifiers.

### Implementation details
- Add `src/content/crises/*.json` with chain definitions.
- UI: crisis panel lists active crises and response buttons.
- Persist crisis stage in save.

### Acceptance
- Choosing different responses leads to different results.
- Ignoring a crisis worsens state predictably.

### DoD (Definition of Done)
- Crisis UI never blocks critical inputs.

### QA checklist
- Trigger crisis; choose each option across retries; compare outcomes.

## Ticket O-3: Crisis → mission hooks
- **Phase:** O3
- **Depends on:** I-3, O-2

### Objective
Use crises as story fuel for cases and quests.

### Design
Certain crisis stages emit triggers that spawn quests/cases (e.g., blackout reveals corruption, hospital outbreak leads to missing person).

### Specs
- At least 4 hooks implemented.
- Hooks include district and involved citizens.

### Implementation details
- Integrate with `CaseManager` and `QuestEngine` triggers.
- Add “case spawned from crisis” label in UI.

### Acceptance
- Crises can produce at least one case per 10–20 minutes on average.

### DoD (Definition of Done)
- Hooks are deterministic and rate-limited.

### QA checklist
- Run sim 200 ticks; verify at least one crisis-generated quest.
