# Milestone A — Stabilize Foundations (target: 0.3.x)

## Objective ✅
Turn the current prototype into a **predictable, debuggable, scalable** base:
- Deterministic simulation (seeded RNG everywhere)
- Clear state ownership (GameState) + versioned saves
- Performance guardrails for **MEGA** maps
- Minimal “project hygiene” so juniors can work in parallel safely

## Current State Snapshot (what exists today)
**Core modules (src/):**
- `game.js`: owns map/resources/citizens/buildings/crises/ui/minimap
- `renderer3d.js`: Three.js instanced rendering + third-person camera
- `map.js`: seeded terrain generation
- `citizen.js`, `buildings.js`, `resources.js`, `crisis.js`: sim systems
- `ui.js`, `minimap.js`: UI layer
- `rng.js`: deterministic RNG (must be the only randomness source)

**Known risks:**
- State is distributed across systems (harder to save/migrate/test)
- Render + sim are loosely coupled (risk of subtle non-determinism)
- No perf instrumentation (MEGA regressions will slip in unnoticed)
- No save schema versioning (future changes will break saves)

---

## Milestone Exit Criteria (Acceptance)
- ✅ No runtime errors in console during a 30-minute play session on **MEGA**
- ✅ Same `seed + same inputs` produces consistent outcomes (within tolerance)
- ✅ Save files include a `schemaVersion` and can load after minor schema changes
- ✅ Perf overlay exists and MEGA map stays within agreed budgets:
  - Target: **30 FPS** on mid-range PC in MEGA map (browser)
- ✅ Codebase supports parallel dev: clear folders + documented conventions

## Definition of Done (DoD) for Milestone A
- All tickets below merged into `dev`, then to `main`
- Manual QA checklist completed (provided in A-10)
- No “TODO: fix later” left in core loop (unless tracked as ticket)

---

## Phase Breakdown
1) **Design/Architecture**
2) **Implementation**
3) **Verification + Regression**
4) **Integration + Docs**

---

## Tickets

### A-01 — Create `/plan` + `/docs` + project conventions
**Objective:** Make the repo self-explanatory for juniors.

**Design**
- Add `docs/CONTRIBUTING.md` with:
  - branch naming, PR checklist, coding style, how to test
- Add `docs/ARCHITECTURE.md` with module responsibilities

**Specs**
- Files:
  - `docs/CONTRIBUTING.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TEST_CHECKLIST.md`

**Implementation details**
1. Create docs folder + templates.
2. Document current controls + run steps (link `README.md`).

**Acceptance**
- A new dev can clone + run + understand folder purposes in 10 minutes.

**DoD**
- Docs reviewed for completeness; no broken paths.

---

### A-02 — Introduce `GameState` as the single source of truth
**Objective:** Reduce hidden coupling and make save/load trivial.

**Design**
- Introduce `src/state/game_state.js` that contains all serializable state.
- Systems read/write through `game.state`, not “free-floating” fields.

**Specs**
- `GameState` shape (minimum):
```js
{
  schemaVersion: 1,
  meta: { seed, mapPreset, createdAt, runId },
  time: { tick, paused, simDt },
  resources: { gold, food, wood, stone, ... },
  map: { width, height, tiles: Uint8Array or packed array },
  buildings: { list: [{ id, type, x, y, level, ... }] },
  citizens: { list: [{ id, name, age, x, y, job, homeId, happiness, traits, ... }] },
  crises: { active: [...], history: [...] },
  player: { x, y, yaw, pitch, ... },
  ui: { selectedTool, ... } // optional
}
```

**Implementation details**
1. Create `src/state/game_state.js` + `createNewGameState(options)`.
2. Update systems to consume `game.state`:
   - `Resources` becomes pure helpers or removed
   - `CitizenManager` reads/writes `state.citizens`
3. Keep wrapper methods for now to avoid huge refactor.

**Acceptance**
- Game runs with state-driven data.
- Save/load uses `state` directly.

**DoD**
- No duplicated state fields exist in `Game` vs `state` for the same concept.

---

### A-03 — Fixed-timestep simulation loop + deterministic ordering
**Objective:** Prevent “FPS changes gameplay”.

**Design**
- Use fixed sim step (e.g., `simDt = 0.2s`) with accumulator.
- Systems update in stable order every tick:
  1) buildings production
  2) citizen needs + movement
  3) crises director
  4) UI messages/log (not affecting sim randomness)

**Specs**
- In `game.js`:
  - `update(realDt)` accumulates
  - loops `while (accum >= simDt)` → `tickOnce(simDt)`

**Implementation details**
1. Separate `tickOnce()` from render frame.
2. Ensure any random draws occur in consistent order:
   - Iterate citizens/buildings in stable `id` order.

**Acceptance**
- Same seed + same input timings produce consistent results across different FPS.

**DoD**
- No use of `Date.now()` inside sim decisions (only for UI display).

---

### A-04 — RNG enforcement & audit
**Objective:** Guarantee full determinism.

**Design**
- Replace all `Math.random()` usage with `game.rng.next()` or `rng.rangeInt()`.
- Provide `RNG` helpers:
  - `float()`, `int(min,max)`, `pick(array)`, `chance(p)`.

**Specs**
- Add a basic grep check to `docs/TEST_CHECKLIST.md`:
  - “No `Math.random()` in `src/`”

**Implementation details**
1. Search and replace randomness.
2. Add `RNG.pickWeighted(items, weights)` for content selection.

**Acceptance**
- No `Math.random()` in gameplay code.

**DoD**
- RNG helpers documented + used.

---

### A-05 — Versioned save schema + migrations
**Objective:** Prevent save breaks as the project evolves.

**Design**
- Save file contains `schemaVersion`.
- Loading runs migration chain `migrate(state)`.

**Specs**
- Files:
  - `src/save/save.js`
  - `src/save/migrations/v1_to_v2.js` etc.

**Implementation details**
1. Move current save/load into `src/save/save.js`.
2. Implement `loadState(json)`:
   - validate minimal shape
   - while `schemaVersion < CURRENT` → apply migration
3. Add “incompatible save” user-facing error.

**Acceptance**
- Loading old saves works after at least one intentional schema bump test.

**DoD**
- Migration functions are pure and covered by manual tests.

---

### A-06 — Performance overlay + budget tests (MEGA)
**Objective:** Spot perf regressions early.

**Design**
- Toggle dev overlay key: `F3`
- Show:
  - FPS (smoothed)
  - draw calls (approx)
  - instance counts (terrain/buildings/citizens)
  - tick time (ms)

**Specs**
- UI: DOM overlay (not in-canvas) for simplicity.

**Implementation details**
1. Add `src/dev/perf_overlay.js`.
2. Hook into renderer stats (approx; Three.js doesn’t expose everything easily).

**Acceptance**
- Overlay toggles on/off and updates live.

**DoD**
- Overlay does not allocate heavily each frame.

---

### A-07 — Chunked instancing rebuilds (terrain/buildings)
**Objective:** Mega city shouldn’t rebuild all instances on small changes.

**Design**
- Divide map into chunks (e.g., 32×32).
- Terrain instances built once per chunk.
- Buildings instances rebuilt only for affected chunk.

**Specs**
- `ChunkKey = `${cx},${cy}``
- `chunkSize = 32` (config in constants)

**Implementation details**
1. Update `renderer3d.js` instancing builders:
   - create chunk meshes per terrain type
   - cache building instances per chunk and type
2. Add debug toggle to show chunk boundaries.

**Acceptance**
- Placing 1 building does not rebuild the entire mega mesh.

**DoD**
- Memory use stable; no increasing chunk count leak.

---

### A-08 — Unified error handling + debug logging
**Objective:** Juniors can diagnose issues fast.

**Design**
- Add `src/dev/logger.js` with levels: `error/warn/info/debug`.
- Add `game.debug = { enabled, logLevel }`.

**Specs**
- Production default: warn+
- Dev default: info+

**Implementation details**
1. Replace ad-hoc `console.log`.
2. Catch unhandled promise errors and show UI toast.

**Acceptance**
- When a system crashes, user sees a readable message + stack in console.

**DoD**
- No noisy logs in normal play.

---

### A-09 — Basic automated smoke test (no framework)
**Objective:** Quick verification without manual play every time.

**Design**
- Add `scripts/smoke_test.mjs` that:
  - creates `Game` headlessly (no renderer)
  - runs N ticks
  - asserts invariants:
    - resources non-negative
    - no NaNs in citizen stats
    - tile bounds valid

**Specs**
- Run: `node scripts/smoke_test.mjs`

**Implementation details**
1. Make `Game` support `headless: true` (no DOM/UI).
2. Add minimal assertions.

**Acceptance**
- Smoke test passes locally.

**DoD**
- Script documented in `docs/TEST_CHECKLIST.md`.

---

### A-10 — Manual QA checklist + release discipline
**Objective:** Repeatable testing routine for milestones.

**Design**
- `docs/TEST_CHECKLIST.md` includes:
  - small/city/mega
  - save/load
  - crisis triggers
  - 15-min roam test
  - perf overlay check

**Acceptance**
- Junior dev can run checklist and file bugs consistently.

**DoD**
- Checklist links to where to file issues and what info to include.
