# Milestone O — Roguelike Meta-Progression + Legacy System (target: 0.32.x)

## Objective 🎯
- Implement run-end meta progression so failure is motivating, not just loss.
- Add unlock trees, starting perks, and run modifiers tied to performance.
- Make seeds + run history first-class so players can share/replay.

---

## Milestone Exit Criteria (Acceptance)
- ✅ At run end, player receives Legacy Points and a summary of major decisions.
- ✅ Legacy unlocks affect next runs (new buildings, policies, starting bonuses).
- ✅ Run history screen shows last 20 runs with seed, outcome, score, and notes.
- ✅ Difficulty mutators exist and can be selected at run start.


## Definition of Done (DoD)
- Meta progression is stored separately from saves (profile file/localStorage).
- Unlocks are deterministic and cannot corrupt run state.
- UI clearly distinguishes 'run save' vs 'profile progression'.


---

## Phases
1) Run-end summary + scoring
2) Profile persistence
3) Unlock trees
4) Mutators + UX


---

## Tickets

### O-01 — Run-end summary + scoring model
**Objective:** Define what success means and feed progression.

**Design**
- Score components: economy, stability, influence, story progress, survival time.
- Show a 'timeline' of major events (crises, policies, ops, chapter outcomes).


**Specs**
- `src/sim/run/scoring.js`
- `src/ui/run_summary.js`
- `state.runSummary` ephemeral at end


**Implementation details**
1. Compute score at end and store snapshot.
2. Render summary screen with breakdown and highlights.
3. Add 'continue to legacy' flow.


**Acceptance**
- Two different play styles produce different score breakdowns.
- Summary includes seed and run id for sharing.


**DoD**
- Scoring math documented in UI tooltip.


---

### O-02 — Profile persistence (legacy points, unlocks, run history)
**Objective:** Persist progress between runs without save-file fragility.

**Design**
- Profile stored in `localStorage` (web) with versioning.
- Separate schema from run save schema.


**Specs**
- `src/profile/profile.js`
- `profile.schemaVersion` + migrations


**Implementation details**
1. Create profile loader/saver and migrations.
2. Store legacy points and unlocked ids.
3. Append run history entries capped to 20.


**Acceptance**
- Profile survives refresh and new runs.
- Profile can be reset from settings.


**DoD**
- Corrupt profile is handled gracefully (fallback to defaults + warning).


---

### O-03 — Unlock tree + shop UI
**Objective:** Give long-term goals and meaningful variety across seeds.

**Design**
- Unlock categories: buildings, policies, starting perks, storylet packs.
- Costs in legacy points; some unlocks gated by achievements.


**Specs**
- `src/content/unlocks.json`
- `src/ui/legacy_shop.js` (hotkey from main menu)
- `state.progression` references profile unlocked ids


**Implementation details**
1. Define initial unlock catalog (20 items).
2. Implement UI with filters and tooltips.
3. Apply unlock effects at run start (available build menu items etc.).


**Acceptance**
- Unlocking a building adds it to build menu in next run.
- Locked items are clearly indicated with requirements.


**DoD**
- Unlocks never retroactively change an ongoing run.


---

### O-04 — Run start scenario + mutator system
**Objective:** Make runs feel distinct beyond map seeds.

**Design**
- Scenario defines starting cash, starting faction rep, starting infrastructure.
- Mutators adjust difficulty: harsher economy, aggressive rival, frequent disasters.


**Specs**
- `src/content/scenarios.json`
- `src/content/mutators.json`
- `src/sim/run/run_start.js`


**Implementation details**
1. Implement scenario picker at new game screen.
2. Apply mutator effects as modifiers to systems (not hard-coded).
3. Save selected scenario/mutators in run meta.


**Acceptance**
- Two scenarios feel meaningfully different in first 10 minutes.
- Mutator effects are visible in UI (icons + tooltip).


**DoD**
- Mutators are deterministic and compatible with saves.


---

### O-05 — Seed browser + replay mode (optional)
**Objective:** Support sharing and deterministic replays at the run level.

**Design**
- Seed browser lists past run seeds and allows quick restart.
- Replay mode (lite): re-run seed with the same scenario/mutators; inputs not replayed.


**Specs**
- `src/ui/seed_browser.js`
- Run history entry stores seed + scenario + mutators


**Implementation details**
1. Add UI from main menu to list run history.
2. Implement 'Restart this run settings' button.
3. Add copy-to-clipboard for seed string.


**Acceptance**
- Player can restart with identical world gen parameters easily.
- Seed display includes map preset.


**DoD**
- UI works without clipboard permission (fallback manual copy).


---
