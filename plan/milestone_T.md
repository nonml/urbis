# Milestone T: Balance + tutorial + QA hardening (pre-1.0)

## Objective
Turn the prototype into a coherent, learnable game with stability and balanced progression.

## Exit criteria (acceptance for milestone)
- Tutorial covers: move, build, hack, start/complete a case, escape a chase.
- Difficulty tuning exists (casual/normal/hard).
- No P0/P1 bugs from QA checklist.
- Performance budgets met for CITY; MEGA acceptable with streaming.

## Phases
- T1: Tutorial + onboarding
- T2: Difficulty + balance knobs
- T3: QA passes + bug triage

## Tickets

## Ticket T-1: Tutorial flow (guided goals + scripted moments)
- **Phase:** T1
- **Depends on:** H-3, I-2, M-3, P-2

### Objective
Make first 15 minutes teach the whole game loop.

### Design
Tutorial quests that set goals and spawn controlled situations: place building, hack node, collect evidence, start chase, escape.

### Specs
- Tutorial duration: 12–18 minutes.
- Skippable after first completion.

### Implementation details
- Add `src/content/tutorial/*.json` and a tutorial controller.
- Use goal tracker UI from E-4.

### Acceptance
- A new player can reach a successful loop without external docs.

### DoD (Definition of Done)
- Tutorial does not break determinism (scripted events use quest rng stream).

### QA checklist
- Run tutorial start-to-finish on SMALL and CITY.

## Ticket T-2: Balance sheet + tuning config
- **Phase:** T2
- **Depends on:** Q-1

### Objective
Expose balancing knobs for economy, heat, police, and rewards.

### Design
Centralize tuning in `src/content/balance.json` loaded at runtime with defaults.

### Specs
- Knobs: resource rates, wages, heat deltas, police spawn, reward sizes.

### Implementation details
- Add `BalanceManager` to read and provide values.
- Dev menu allows hot-reload in dev.

### Acceptance
- Adjusting balance config changes gameplay without code changes.

### DoD (Definition of Done)
- Balance config validated (ranges).

### QA checklist
- Increase police aggressiveness; confirm chases harder.

## Ticket T-3: QA checklist + bug triage gates
- **Phase:** T3
- **Depends on:** T-1, T-2

### Objective
Ensure stable release quality.

### Design
Create a repeatable checklist and enforce “no known P0/P1” before 1.0.0.

### Specs
- Soak tests: 30 minutes CITY, 15 minutes MEGA.
- Chase test: 3 chases in a row without crash.
- Save/load: 10 cycles without corruption.

### Implementation details
- Add `docs/QA_CHECKLIST.md` and `docs/KNOWN_ISSUES.md`.
- Update smoke test with longer-run mode (optional flag).

### Acceptance
- All checklist items pass.

### DoD (Definition of Done)
- Release candidate tag created and tested.

### QA checklist
- Run checklist on two machines if possible (team).
