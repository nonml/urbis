# Milestone G — Economy + Services v1 (Taxes, Upkeep, Coverage) (target: 0.16.x)

## Objective 🎯
- Implement a readable city economy: income, expenses, and budgets.
- Add core service buildings with coverage effects (police/fire/medical/schools).
- Introduce failure pressure: loans, upkeep, bankruptcy path.

---

## Milestone Exit Criteria (Acceptance)
- ✅ Budget screen shows line items and updates live as you build.
- ✅ At least 4 service types affect citizens/crises via coverage maps.
- ✅ Player can take a loan; bankruptcy is a clear lose condition (or near-lose).
- ✅ Economy behaves consistently across Small and City presets.


## Definition of Done (DoD)
- All new numbers are surfaced in UI (no hidden modifiers without tooltips).
- No negative resources unless explicitly allowed (debt).
- Smoke test includes economy invariants.


---

## Phases
1) Economy accounting
2) Services and coverage maps
3) Failure/loan mechanics
4) Balance pass v1


---

## Tickets

### G-01 — Budget & taxes system (income/expense accounting)
**Objective:** Create the backbone for City Skylines-style management.

**Design**
- Monthly (or daily) budget tick calculates income and expenses.
- Tax sliders for R/C/I; affects demand and citizen happiness.
- Transparent ledger: every system writes to `state.economy.ledger` with reasons.


**Specs**
- `state.economy = { cash, debt, taxRates, ledger, lastBudgetTick }`
- `src/sim/economy/budget.js`
- `src/ui/budget_screen.js` (hotkey `B`)


**Implementation details**
1. Add economy state + baseline starting cash.
2. Implement income from households/jobs; expenses from upkeep/services.
3. Create budget screen with sliders + tooltips and a 'last cycle' summary.


**Acceptance**
- Changing tax rates changes net income and demand within one budget cycle.
- Budget screen matches the underlying ledger totals.


**DoD**
- Ledger entries include stable `code` strings for debugging and tests.


---

### G-02 — Coverage map system (influence radius on grid)
**Objective:** Enable service buildings to have spatial effects cheaply.

**Design**
- Services generate coverage 'heat' on a grid (0..1) via radius falloff.
- Coverage is chunked and recomputed only when service buildings change.


**Specs**
- `state.map.coverage = { police, fire, medical, education }` (packed floats or Uint8)
- `src/sim/services/coverage.js`


**Implementation details**
1. Implement coverage buffers per service.
2. On service building add/remove, recompute affected chunks.
3. Expose debug overlay to visualize coverage.


**Acceptance**
- Placing a police station increases police coverage around it.
- Coverage overlay matches expected radius.


**DoD**
- MEGA recompute is incremental; no full-map rebuild for one station.


---

### G-03 — Service buildings v1 (police/fire/medical/schools)
**Objective:** Connect macro building to citizen well-being and crisis mitigation.

**Design**
- Each service type modifies citizen stats and crisis probabilities.
- Services have upkeep costs and staffing requirements (future-proof).


**Specs**
- Building types added to `BUILDING_TYPES` with `serviceType` and `radius`
- `src/sim/services/services_system.js`


**Implementation details**
1. Add the four buildings + UI category.
2. Hook coverage into citizen happiness/health and crisis thresholds.
3. Add monthly upkeep to economy ledger.


**Acceptance**
- Adding medical coverage reduces illness-related crises frequency.
- Upkeep visibly increases expenses.


**DoD**
- Services effects documented with in-game tooltip math.


---

### G-04 — Loans, debt, and bankruptcy flow
**Objective:** Add stakes and a clear lose condition that feels fair.

**Design**
- Player can take loans with interest; monthly payment deducted automatically.
- If cash < 0 beyond grace period → bankruptcy warning → collapse.
- Provide recovery paths: sell assets, raise taxes, cut budgets.


**Specs**
- `state.economy.debt` and `state.economy.loans[]`
- `src/sim/economy/loans.js`
- `src/ui/bank_screen.js`


**Implementation details**
1. Implement loan offers and repayment schedule.
2. Add warning UI and grace timer.
3. Integrate with run lose conditions.


**Acceptance**
- Player can recover from low cash using loans and policy changes.
- Bankruptcy ends run with clear summary.


**DoD**
- No soft-locks: player always has an exit path (restart/end run).


---

### G-05 — Economy balancing pass v1 + regression seeds
**Objective:** Make early game stable and teachable.

**Design**
- Define target ranges for: income, upkeep, crisis rate, growth rate.
- Use 10 regression seeds and record expected outcomes.


**Specs**
- `docs/BALANCE_SEEDS.md` updated
- Dev tool: 'simulate 90 days' fast-forward


**Implementation details**
1. Add fast-forward tool and summary printout.
2. Tune constants iteratively using seeds.
3. Document tuned values and rationale.


**Acceptance**
- Small preset is winnable without expert play.
- City preset is challenging but recoverable.


**DoD**
- Balance changes tracked in `CHANGELOG.md`.


---
