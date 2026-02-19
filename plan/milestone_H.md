# Milestone H: Quest framework v2 (data-driven steps, markers, branching, rewards)

## Objective
Turn anomalies + hacks into structured quests with branching, rewards, and reliable progression tracking.

## Exit criteria (acceptance for milestone)
- Quest definitions are loaded from `src/content/quests/` and validated.
- Quest log shows active/completed quests and current objective.
- Markers/waypoints work and persist across save/load.
- At least 6 quests run end-to-end with branching choices.

## Phases
- H1: Quest schema + validator
- H2: Step handlers + branching
- H3: Rewards + persistence + tooling

## Tickets

## Ticket H-1: Quest schema + validation pipeline
- **Phase:** H1
- **Depends on:** A-2

### Objective
Ensure content errors don’t crash runtime.

### Design
Define JSON schema-like validator in code (lightweight). Validate on load; invalid quests are logged and skipped.

### Specs
- Quest fields: id, title, tags, trigger, steps[], rewards[]
- Step kinds: go_to, hack, investigate, choice, outcome.
- All references (poiId, citizenId markers) must resolve or have fallback.

### Implementation details
- Add `src/content/quests/schema.js` validator.
- Extend `loadQuestsFromDirectory()` to report errors in dev overlay.
- Add `npm run test` quest validation step.

### Acceptance
- Bad quest JSON does not crash game; shows error list.
- Valid quests load and appear in dev menu.

### DoD (Definition of Done)
- Validator has unit tests with fixtures.
- Docs: `docs/QUESTS.md`.

### QA checklist
- Intentionally break a quest file; verify graceful handling.
- Fix it; verify quest appears again.

## Ticket H-2: Branching + choice memory
- **Phase:** H2
- **Depends on:** H-1

### Objective
Make player decisions affect future steps and city state.

### Design
Choices set flags in quest context and global run flags. Conditional steps evaluate flags + city metrics (heat, happiness, district security).

### Specs
- Choice step: 2–4 options, each sets flags and may modify heat/reputation.
- Conditional step supports AND/OR on flags and metrics thresholds.
- Quest context persists in save.

### Implementation details
- Implement `STEP_KINDS.CONDITIONAL` fully (if currently stub).
- Add `state.progress.runFlags`.
- Add UI: choice modal with keybinds 1-4.

### Acceptance
- Making a choice changes later steps reliably.
- Save/load retains choice state.

### DoD (Definition of Done)
- No branching dead-ends unless marked as fail.
- Quest engine has automated test for a branching quest.

### QA checklist
- Run branching quest twice with different choices; verify different outcomes.
- Reload mid-quest; ensure branch remains consistent.

## Ticket H-3: Rewards + unlocks (cash, heat, faction rep, building unlock)
- **Phase:** H3
- **Depends on:** E-2, G-3

### Objective
Tie quests into progression and city-building incentives.

### Design
Reward system applies effects to economy, heat, faction reputation, unlock lists. Rewards are applied once with idempotent guard.

### Specs
- Reward types: add_resource, set_flag, modify_heat, rep_delta, unlock_building, unlock_hack.
- Reward log stored per quest to prevent duplication.

### Implementation details
- Add `src/sim/rewards/reward_system.js`.
- UI: reward toast summary at quest completion.
- Persist unlocks in `state.progress.unlocks`.

### Acceptance
- Quest completion grants rewards and updates UI.
- Reload doesn’t duplicate rewards.

### DoD (Definition of Done)
- Reward definitions validated.
- At least 3 unlockable buildings and 2 unlockable hacks exist.

### QA checklist
- Complete a quest; verify gold changes and unlock appears in build menu.
- Save/load after reward; verify no duplication.
