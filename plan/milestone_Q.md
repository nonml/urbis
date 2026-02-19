# Milestone Q: Content pipeline + tooling (editors, validation, debug spawners)

## Objective
Let juniors (and designers) add content safely and quickly.

## Exit criteria (acceptance for milestone)
- Quest/case/crisis/poi content has validators and CI-like checks in `npm test`.
- Dev menu can spawn key systems (case, crisis, police chase).
- A simple in-game content inspector exists (view loaded json, errors).

## Phases
- Q1: Validation gates
- Q2: Dev tooling
- Q3: Inspector UI

## Tickets

## Ticket Q-1: Content validators integrated into `npm run test`
- **Phase:** Q1
- **Depends on:** H-1, I-3, O-2, J-1

### Objective
Stop broken content from reaching main.

### Design
Each content type has a validator returning errors with file+path. Test fails if any errors exist.

### Specs
- Validators: quests, cases, crises, pois, factions.
- Error format: `file: path.to.field - message`.

### Implementation details
- Add validators in `src/content/validate/*.js`.
- Update `scripts/smoke_test.mjs` to run validators.

### Acceptance
- Invalid content makes tests fail with clear errors.

### DoD (Definition of Done)
- Docs: `docs/CONTENT_PIPELINE.md`.

### QA checklist
- Break a json field; verify test failure includes file and path.

## Ticket Q-2: Dev menu spawners for all core loops
- **Phase:** Q2
- **Depends on:** A-4

### Objective
Enable rapid testing of features without playing 30 minutes.

### Design
Dev menu actions: spawn case type, spawn crisis type, set heat, start chase, spawn rival action, teleport to district.

### Specs
- All spawners are dev-only and do not affect production build.

### Implementation details
- Extend `src/dev/dev_menu.js` with sections per system.
- Log each command in dev overlay.

### Acceptance
- Junior dev can reproduce any bug scenario in < 1 minute using dev tools.

### DoD (Definition of Done)
- Dev menu does not mutate sim RNG streams unexpectedly (use dedicated dev RNG or deterministic injection).

### QA checklist
- Use each spawner once; ensure no crashes and expected behavior occurs.

## Ticket Q-3: In-game content inspector + error viewer
- **Phase:** Q3
- **Depends on:** Q-1

### Objective
Make validation and tuning visible without terminal access.

### Design
Inspector lists loaded content counts and validation errors. Clicking error focuses source file path (copy).

### Specs
- Toggle: F3

### Implementation details
- Add `src/dev/content_inspector.js`.
- Expose `contentManager.getReport()`.

### Acceptance
- Errors are visible in-game.

### DoD (Definition of Done)
- Inspector has no effect on sim outcomes.

### QA checklist
- Inject a known invalid content item; confirm inspector shows it.
