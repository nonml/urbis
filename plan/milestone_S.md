# Milestone S — QA Automation + Balancing (toward Beta) (target: 0.40.x)

## Objective 🎯
- Harden the game with repeatable tests and balancing workflows.
- Add telemetry-style logs (local) for tuning economy/crises/AI.
- Prepare for external playtesting (beta).

---

## Milestone Exit Criteria (Acceptance)
- ✅ Automated tests cover: content validation, smoke sims, save/load fuzz.
- ✅ Balance seeds list expanded and tracked with expected ranges.
- ✅ Telemetry log can be exported with key metrics and event timeline.
- ✅ Critical bug rate reduced (bug bash shows no S0/S1 issues).


## Definition of Done (DoD)
- Tests run in CI-like fashion locally with one command.
- Balancing changes documented and traceable.
- Telemetry is opt-in and does not collect personal data.


---

## Phases
1) Test suite expansion
2) Telemetry + analysis helpers
3) Balance process
4) Bug bash iterations


---

## Tickets

### S-01 — Automated sim regression tests (seeded scenarios)
**Objective:** Catch major logic regressions early.

**Design**
- Run N seeds across presets and assert ranges for metrics (not exact numbers).
- Metrics: population, cash, crises count, sentiment.


**Specs**
- `scripts/regression_test.mjs`
- `docs/REGRESSION_METRICS.md`


**Implementation details**
1. Implement regression runner using headless mode.
2. Define expected ranges per seed/preset (tunable).
3. Fail if metrics outside range or NaN appears.


**Acceptance**
- A deliberate bug causes test failure.
- Normal tuning changes can update ranges with documentation.


**DoD**
- Runner completes in < 5 minutes.


---

### S-02 — Save/load fuzz testing
**Objective:** Prevent corrupt saves from breaking builds.

**Design**
- Generate random valid-ish states and roundtrip save/load.
- Mutate saved JSON slightly and ensure loader fails gracefully.


**Specs**
- `scripts/fuzz_save_load.mjs`
- `docs/SAVE_ROUNDTRIP.md`


**Implementation details**
1. Create state generator with caps and invariants.
2. Roundtrip test and compare key fields.
3. Add corrupted save tests and verify error messages.


**Acceptance**
- Loader never hard-crashes on fuzzed inputs.
- Corrupt save yields readable error and recovery option.


**DoD**
- Fuzz tests are deterministic (seeded).


---

### S-03 — Telemetry logging + export bundle
**Objective:** Make balancing evidence-based.

**Design**
- Log key metrics every N ticks and major events (ops, crises, wins).
- Export creates a JSON bundle attached to bug reports.


**Specs**
- `src/dev/telemetry.js`
- `state.telemetry.enabled`
- Export button in pause menu (dev/beta)


**Implementation details**
1. Implement ring-buffer telemetry storage.
2. Add export to file (download) and copy summary to clipboard.
3. Document fields for analysis.


**Acceptance**
- Exported log can reproduce 'what happened' in a run at high level.
- Telemetry can be disabled.


**DoD**
- No sensitive data; only game state ids and numbers.


---

### S-04 — Balance process v2 (economy/crises/rival/factions)
**Objective:** Tune for fun and fairness.

**Design**
- Define difficulty bands and target experience per preset.
- Use telemetry + seeds to tune thresholds and pacing.


**Specs**
- `docs/BALANCE_GUIDE.md`
- Expanded `docs/BALANCE_SEEDS.md` (20 seeds)


**Implementation details**
1. Run telemetry on seeds and identify pain points.
2. Tune in small increments and record changes.
3. Add automated report summary (optional).


**Acceptance**
- Small preset: approachable; City: strategic; Mega: long-run challenge.
- Rival pressure feels counterable, not random.


**DoD**
- Balance changes accompanied by patch note entry.


---

### S-05 — Beta bug bash rounds + exit gates
**Objective:** Lock quality before calling it beta-ready.

**Design**
- Define exit gates: 0 S0, <3 S1, <10 S2 open issues.
- Conduct 3 bug bash rounds with fixed test scripts.


**Specs**
- `docs/BETA_EXIT_GATES.md`
- `docs/BUG_BASH_SCRIPT.md`


**Implementation details**
1. Write scripts and assign roles for bug bash.
2. Run sessions and triage issues.
3. Retest fixes and update known issues list.


**Acceptance**
- Exit gates satisfied for one full week of development.
- Known issues list is accurate and prioritized.


**DoD**
- Bug bash artifacts archived (logs, seeds, saves).


---
