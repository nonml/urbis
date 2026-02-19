# Milestone A: Foundation: deterministic core, state/schema, dev workflow

## Objective
Stabilize the codebase so every run is reproducible by seed, saves are forward-compatible, and juniors can develop safely (tests + CI-style discipline).

## Exit criteria (acceptance for milestone)
- No `Math.random()` in `src/` (determinism + auditability).
- Single source of truth: `GameState` validated on load and before save.
- Save schema migration works: can load previous saves and auto-upgrade.
- Smoke test passes locally via `npm run test`.
- Dev overlay shows FPS + sim tick + seed + runId.

## Phases
- A1: Code hygiene + architecture boundaries
- A2: Determinism + RNG streams
- A3: Save schema + migrations
- A4: Tests + smoke suite + debug overlay

## Tickets

## Ticket A-1: Enforce deterministic RNG streams (world/sim/quest/rival/vfx)
- **Phase:** A2

### Objective
Prevent accidental RNG consumption (e.g., UI/render affecting simulation) by splitting RNG streams and documenting rules.

### Design
Derive independent RNG seeds from `meta.seed` via XOR constants. Store stream seeds in `state.meta.rngStreams` for save/load. Simulation-only code uses `rngSim`, quest logic uses `rngQuest`, rival uses `rngRival`. Rendering uses `rngVfx` and must not touch sim RNG.

### Specs
- Add `state.meta.rngStreams = { worldSeed, simSeed, questSeed, rivalSeed, vfxSeed }`.
- Add `game.rng = { world, sim, quest, rival, vfx }` object.
- Map generation uses `world` only. Daily events/crises use `sim` only.
- QuestEngine uses `quest` (not sim). RivalAI uses `rival`.

### Implementation details
- Update `src/game.js` init to create all RNGs from `this.state.meta.seed`.
- Update `src/map.js` to accept RNG in constructor (`new Map(..., rngWorld)`), remove internal RNG creation.
- Update `QuestEngine` to store `this.rng = game.rng.quest` and pass into quest context.
- Update `RivalAI` to store `this.rng = game.rng.rival` instead of new RNG; keep current code if needed but prefer shared stream.
- Update VFX helper in `renderer3d.js` to use `game.rng.vfx` *without* advancing on frame; only advance on VFX spawn.

### Acceptance
- Running the same seed twice produces identical map + initial citizens + first 10 sim ticks outcomes (resources/population/happiness).
- Toggling UI elements does not change sim outcome for the same seed.
- Quest target selection is stable for the same seed and same trigger order.

### DoD (Definition of Done)
- All modified files pass `node --check` and `npm run test`.
- Documented in `docs/DETERMINISM.md` (rules + examples).
- No regression in MEGA preset load time (±10%).

### QA checklist
- Start seed=123 on SMALL and CITY, compare map hashes (log hash).
- Trigger 3 anomalies from dev menu; ensure same targets on restart with same seed.
- Save + reload after 5 ticks; continue and compare to uninterrupted run.

## Ticket A-2: GameState validation + strict schema boundaries
- **Phase:** A1/A3

### Objective
Guarantee that state is always well-formed and future migrations don’t silently corrupt runs.

### Design
Use `validateGameState(state)` as a hard gate for load/new/save. Introduce `assertStateShape()` dev-only checks. Store schema version in save root and migrate step-by-step.

### Specs
- `validateGameState()` returns `{ ok: boolean, errors: string[] }`.
- Any `ok=false` blocks load and shows a UI error with copyable details.
- State updates go through `game.mutate(fn)` wrapper (central place for invariants).

### Implementation details
- Add `src/state/validate.js` with small composable validators (numbers, arrays, bounds).
- Update `src/save/save_manager.js` to call validate before write and after read+migrate.
- Add `docs/SAVE_SCHEMA.md` describing fields and invariants.
- Add `scripts/state_fuzz_test.mjs` generating random-ish states and ensuring validator catches bad ones.

### Acceptance
- Corrupt save (manually edited JSON) is rejected with a readable error.
- Valid save loads without console errors.
- Migration runs automatically and increments schema.

### DoD (Definition of Done)
- All new docs exist and are referenced from `README.md`.
- Smoke test includes a migrate path test.

### QA checklist
- Edit save: delete `meta.seed` → load must fail with message.
- Load old schema save → verify schemaVersion increments.

## Ticket A-3: Smoke tests: headless sim + determinism snapshot
- **Phase:** A4
- **Depends on:** A-1, A-2

### Objective
Give juniors a fast “red/green” loop to detect breaking changes.

### Design
Use `src/headless_game.js` to run 200 ticks without rendering. Compute a stable snapshot hash of key state fields each N ticks. Compare to expected hash for fixed seeds.

### Specs
- Test seeds: 1, 42, 123, 999.
- Record snapshots at ticks: 0, 10, 50, 100, 200.
- Fields hashed: resources, population, avg happiness, building counts, crisis count, rival heat/budget.

### Implementation details
- Add `scripts/smoke_test.mjs` if missing; ensure `npm run test` runs it.
- Add `scripts/hash_state.mjs` with stable ordering (no JSON key nondeterminism).
- On mismatch, print diff summary (expected vs actual).

### Acceptance
- `npm run test` passes on clean checkout.
- Changing non-sim code (UI text) does not change snapshot hashes.

### DoD (Definition of Done)
- Test runtime under 5 seconds on typical dev machine.
- Document how to update snapshots (only when intended).

### QA checklist
- Run smoke test twice in a row; confirm identical output.
- Force a small sim change; confirm test fails with clear message.

## Ticket A-4: Dev overlay + log discipline
- **Phase:** A4

### Objective
Provide always-on visibility for performance + state to prevent juniors guessing.

### Design
A small overlay UI (toggle with F1) shows FPS, frametime, seed, tick, day, player pos, district, heat, active quest count, active crisis count.

### Specs
- Toggle: F1
- Overlay never allocates per-frame (no GC spikes).
- Log categories: `SIM`, `GEN`, `QUEST`, `RIVAL`, `SAVE`.

### Implementation details
- Add `src/dev/overlay.js`.
- Expose `game.getDebugStats()` to return stable object.
- Replace noisy `console.log` with `devLog(category, msg)`.

### Acceptance
- Overlay updates correctly and can be toggled.
- No noticeable FPS drop when overlay is hidden.

### DoD (Definition of Done)
- No console spam during normal play (except warnings/errors).
- Overlay is disabled in production build (`import.meta.env.DEV`).

### QA checklist
- Run MEGA preset and verify overlay stays responsive.
- Toggle overlay 20 times; ensure no input lockups.
