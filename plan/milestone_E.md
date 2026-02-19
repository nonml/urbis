# Milestone E: Core city-builder loop v1 (build, zone, services, economy, goals)

## Objective
Deliver a playable management loop: build and expand, keep citizens alive/happy, respond to shortages, and have clear short-term goals.

## Exit criteria (acceptance for milestone)
- Player can place and upgrade buildings with valid placement rules.
- Resources change predictably (production/consumption visible).
- Basic services affect citizen metrics (happiness/health/safety).
- At least one victory condition and one failure condition exist (sandbox optional).
- UI includes a city dashboard with key metrics + alerts.

## Phases
- E1: Placement + build mode UX
- E2: Economy (production/consumption) + budgets
- E3: Services + effects on citizens
- E4: Goals + win/lose scaffolding

## Tickets

## Ticket E-1: Build mode UX (ghost preview + rotation + validity)
- **Phase:** E1
- **Depends on:** C-3, D-3

### Objective
Make building placement fast and unambiguous.

### Design
When in build mode, show a ghost mesh aligned to parcel/road, colored by validity. Allow rotate (Q/E). Show cost + projected upkeep.

### Specs
- Rotate steps: 90°.
- Validity checks: inside parcel, not overlapping roads/water, not overlapping other buildings.
- Hotkeys: B open build menu, Esc cancel.

### Implementation details
- Add `src/ui/build_menu.js`.
- Placement logic in `src/build/placement.js` returns `{ok, reason}`.
- Renderer draws ghost using transparent material.

### Acceptance
- Invalid placement shows reason and prevents confirm.
- Confirm places building and updates state/save.

### DoD (Definition of Done)
- No duplicated buildings on double-click.
- Placement is deterministic with same seed + same inputs.

### QA checklist
- Try placing on roads/water → blocked.
- Place 20 buildings quickly → no lag spikes.

## Ticket E-2: Economy ledger v1 (production/consumption + upkeep)
- **Phase:** E2
- **Depends on:** A-2

### Objective
Make resources intelligible and debuggable.

### Design
Introduce per-tick ledger that sums sources/sinks per resource. UI shows breakdown. Buildings contribute production and upkeep; citizens consume food/needs.

### Specs
- Resources: gold, food, power, water, materials (wood/steel optional).
- Ledger keeps last 30 ticks for graphs (dev-only if needed).
- Upkeep drains gold; insufficient gold triggers service degradation.

### Implementation details
- Add `src/sim/economy/ledger.js`.
- Update building definitions to include `outputs`, `inputs`, `upkeep`.
- Expose `game.getResourceReport()` for UI.

### Acceptance
- UI shows per-resource net change and top contributors.
- Negative resources trigger clear alerts.

### DoD (Definition of Done)
- No NaN resources ever (clamp + validator).
- Smoke test snapshots include ledger-derived totals.

### QA checklist
- Build a farm, observe food increase; demolish, observe decrease.
- Run 50 ticks with zero food; citizens react (see E-3).

## Ticket E-3: Services v1 (power/water/health/police) + citizen effects
- **Phase:** E3
- **Depends on:** C-1, D-1

### Objective
Tie city-builder choices to citizen outcomes and mission hooks.

### Design
Each service has coverage radius and quality level. Citizens in uncovered zones lose happiness/health; crime rises without police; outages create crisis triggers.

### Specs
- Coverage: radius in tiles; quality scales with staffing.
- Service metrics per district: coverage %, average quality.
- Outages: power < demand triggers brownouts -> happiness drop.

### Implementation details
- Add `src/sim/services/services.js` with service registry.
- Compute per-district coverage each tick (cached per chunk).
- Expose overlay: press F2 to show service heatmaps.

### Acceptance
- Adding a police station improves safety metric in nearby districts.
- Power shortage causes visible consequences within 10 ticks.

### DoD (Definition of Done)
- Service computation cost bounded (< 5ms per tick CITY).
- Service data serialized or recomputed deterministically.

### QA checklist
- Create power deficit; verify brownout alert and citizen impact.
- Remove police; verify crime metric rises.

## Ticket E-4: Goals + win/lose v1 (sandbox toggle)
- **Phase:** E4
- **Depends on:** E-2, E-3

### Objective
Give players direction and an endpoint for 0.x builds.

### Design
Add short-term goals (tutorial-like) and a simple win condition (population + stability) and lose conditions (bankrupt, mass death, revolt). Sandbox mode disables win/lose.

### Specs
- Win: population >= X and avg happiness >= Y for Z days.
- Lose: gold < 0 for 10 ticks OR population < 10 after day 3 OR revolt event fires.
- Sandbox toggle in new game menu.

### Implementation details
- Add `src/sim/goals/goals.js`.
- UI: goal tracker panel and end screen.
- State: `state.progress.mode`, `state.progress.goalState`.

### Acceptance
- Win/lose screens appear and are replayable (return to main menu).
- Sandbox does not trigger game over.

### DoD (Definition of Done)
- Goals are data-driven (`src/content/goals.json`).
- End state saved in run summary.

### QA checklist
- Force bankrupt by spamming buildings; verify lose condition.
- Achieve win by building up; verify win condition.
