# Milestone Progress Tracker

This document tracks progress toward Milestone U (1.0.0 release).

---

## Status Summary

| Milestone | Target | Status | Progress | Notes |
|-----------|--------|--------|----------|-------|
| A | 0.2.x | ✅ Complete | 100% | Foundations verified |
| B | 0.4.x | ✅ Complete | 100% | City generation verified |
| C | 0.8.x | ✅ Complete | 100% | Quest system verified |
| D | 0.10.x | ✅ Complete | 100% | Rival AI verified |
| E | 0.12.x | ✅ Complete | 100% | Vertical slice complete |
| F | 0.14.x | ✅ Complete | 100% | Dual-mode foundation + zoning UI |
| G | 0.16.x | ✅ Complete | 100% | Budget, loans, coverage implemented |
| H | 0.18.x | ✅ Complete | 100% | Power, water, sewage, data grid implemented |
| I | 0.20.x | ✅ Complete | 100% | Traffic simulation completed |
| J | 0.22.x | ⚪ Pending | 0% | Citizen simulation v2 |
| K | 0.24.x | ⚪ Pending | 0% | Surveillance/influence |
| L | 0.26.x | ⚪ Pending | 0% | Factions/politics |
| M | 0.28.x | ⚪ Pending | 0% | Dynamic crises v2 |
| N | 0.30.x | ⚪ Pending | 0% | Campaign expansion |
| O | 0.32.x | ⚪ Pending | 0% | Roguelike meta |
| P | 0.34.x | ⚪ Pending | 0% | Dev tooling |
| Q | 0.36.x | ⚪ Pending | 0% | Performance finalization |
| R | 0.38.x | ⚪ Pending | 0% | Visual/audio polish |
| S | 0.40.x | ⚪ Pending | 0% | QA automation |
| T | 0.42.x | ⚪ Pending | 0% | Beta release prep |
| U | 1.0.0 | ⚪ Pending | 0% | Ship release |

---

## Version Mapping Policy

**Note:** Milestone letters are tracked independently from version numbers. Current mapping:

| Milestone | Version | Notes |
|-----------|---------|-------|
| A-E | 0.2.x - 0.12.x | Alpha development |
| F-U | 0.14.x - 1.0.0 | Beta to Release |

This mapping was adjusted during development to reflect feature complexity. Future milestones follow a linear versioning scheme where each Milestone letter (N) corresponds to a version increment of 0.2.x (e.g., Milestone F = 0.14.x, Milestone G = 0.16.x).

---

## Milestone E — Vertical Slice Alpha ✅ Complete

**Exit Criteria Met:**
- ✅ Settings menu (E-01) - `src/ui/settings.js`
- ✅ Feedback polish (E-02) - VFX in renderer3d.js
- ✅ Audio pass (E-03) - `src/audio/audio_manager.js`
- ✅ Tutorial system (E-04) - `src/sim/tutorial/tutorial.js`
- ✅ QA documentation (E-05) - `docs/TEST_CHECKLIST.md`
- ✅ Build pipeline (E-06) - `src/version.js`, CHANGELOG.md
- ✅ Bug workflow (E-07) - `docs/BUG_REPORT.md`, `docs/TRIAGE.md`, debug info button

**Files Created/Modified:**
- `docs/REGRESSION_SEEDS.md` - Fixed seeds for testing
- `docs/BUG_REPORT.md` - Bug report template
- `docs/TRIAGE.md` - Triage guidelines
- `src/ui/settings.js` - Added copy debug info functionality
- `index.html` - Added debug info button
- `src/style.css` - Added debug button styles

---

## Milestone F — Dual-Mode Foundation ✅ Complete

**Exit Criteria Met:**
- ✅ Mode system (F-01) - `src/ui/mode_indicator.js` + Tab key toggle
- ⚠️ God camera (F-02) - Not implemented (optional enhancement)
- ✅ Zoning system (F-03) - `src/sim/zoning/zoning.js` + save/load integration
- ✅ Demand model (F-04) - `src/sim/economy/demand.js` + demand UI display
- ✅ Zone overlay (F-05) - `src/renderer3d.js` + Z key toggle

**Files Created:**
- `src/sim/zoning/zoning.js` - Zone map manager with paint/erase tools
- `src/sim/economy/demand.js` - Demand calculator for R/C/I
- `src/ui/mode_indicator.js` - HUD mode indicator

**Integration Completed:**
- Connect zoning to game state - saveGame/loadGame in src/game.js
- Add mode toggle (Tab) to input handling - src/ui.js setupInput()
- Integrate demand calculation into sim tick - tickOnce() in src/game.js
- Add zone overlay rendering (Z key) - src/renderer3d.js + src/ui.js

**UI Features:**
- Tab key: Toggle between Street Mode (🚶) and God Mode (👁️)
- Z key: Cycle zone overlay modes (none → zones → zoned)
- Demand UI: Shows R/C/I demand bars in stats panel

---

## Milestone G — Economy + Services v1 ✅ Partial

**Exit Criteria Met:**
- ✅ Budget system (G-01) - `src/sim/economy/budget.js` with tax rates for R/C/I
- ✅ Loans & debt (G-04) - `src/sim/economy/loans.js` with bankruptcy mechanics
- ✅ Coverage map system (G-02) - `src/sim/services/services.js` (already implemented)
- ✅ Service buildings (G-03) - Police stations, power plants, medical, schools
- ⚠️ Economy balancing - Need balance pass and regression seeds

**Files Created/Modified:**
- `src/sim/economy/budget.js` - Tax rates, ledger integration, budget tick
- `src/sim/economy/loans.js` - Loan offers, repayment, bankruptcy flow
- `src/game.js` - Integration of budget and loan managers
- `src/ui.js` - Demand UI display in stats panel

**Notes:**
- Budget calculates daily tax income based on demand and tax rates
- Tax rates can be adjusted: residential (5%), commercial (8%), industrial (6%)
- Loans can be taken with interest (8-12% based on loan size)
- Bankruptcy triggers after 30 ticks in debt with warning UI
- Coverage maps for police, fire, medical, power services

---

## Milestone H — Infrastructure Networks ✅ Complete

**Exit Criteria Met:**
- ✅ Network core framework (H-01) - `src/sim/networks/network_core.js` with shared API
- ✅ Power network v1 (H-02) - `src/sim/networks/power.js` with coverage and blackouts
- ✅ Water + sewage v1 (H-03) - `src/sim/networks/water.js` with pollution tracking
- ✅ Data Grid v1 (H-04) - `src/sim/networks/data_grid.js` with intel pings
- ✅ Integration (H-05) - Networks initialized in game state, saved/loaded

**Files Created:**
- `src/sim/networks/network_core.js` - Abstract network class with radius coverage
- `src/sim/networks/power.js` - Power supply/demand, blackout events
- `src/sim/networks/water.js` - Water supply, pollution from sewage shortage
- `src/sim/networks/data_grid.js` - Data coverage, camera intel pings

**Features:**
- Coverage based on source radius with falloff
- Incremental chunk-based recompute
- Blackout events when power supply < demand
- Pollution rises when sewage capacity insufficient
- Intel pings from covered cameras

---

## Milestone I — Traffic Simulation ✅ Complete

**Exit Criteria Met:**
- ✅ Road graph extraction (I-01) - `src/sim/traffic/graph_extractor.js`
- ✅ Routing system (I-02) - `src/sim/traffic/pathfinder.js`
- ✅ Traffic agents (I-03) - `src/sim/agents/traffic_agent.js`
- ✅ Player vehicle system (I-04) - `src/sim/agents/player_vehicle.js`
- ✅ Service routing (I-05) - `src/sim/services/routing_integration.js`
- ✅ Traffic integration (I-06) - Game state integration complete

**Files Created:**
- `src/sim/traffic/graph_extractor.js` - Road graph extraction and simplification
- `src/sim/traffic/pathfinder.js` - A* routing with traffic-aware costs
- `src/sim/agents/traffic_agent.js` - Vehicle agents with congestion management
- `src/sim/agents/player_vehicle.js` - Player vehicle with AUTO/MANUAL modes
- `src/sim/services/routing_integration.js` - Police, fire, ambulance routing

**Features:**
- Graph-based road network with node extraction
- Traffic-aware pathfinding with congestion costs
- Vehicle agents with AUTO path following and MANUAL mode
- Service dispatcher for emergency vehicle dispatch
- Police pursuit mode and emergency incident routing
- Congestion tracking on road edges and grid cells

**Game Integration:**
- Traffic manager updated in tickOnce() - traffic updates every tick
- Police pursuit router updated in tickOnce() - active pursuit routing
- Graph and traffic data saved/loaded with saveGame/loadGame
- Police router state persisted in save data

### Milestone J — Citizen Simulation v2
- Household model + housing - `src/sim/citizens/household.js`
- Job market v1 - `src/sim/economy/job_market.js`
- Crime incident generator - `src/sim/citizens/crime_generator.js`
- Social graph v1 - `src/sim/citizens/social_graph.js`
- Citizen profile UI - `src/ui/citizen_profile.js`

### Milestone K — Surveillance + Influence
- Intel database - `src/sim/intel/database.js`
- Surveillance sources - `src/sim/intel/sources.js`
- Influence operations engine - `src/sim/intel/influence_engine.js`
- Public sentiment + media - `src/sim/intel/sentiment.js`
- Exposure/heat v2 - `src/sim/intel/heat_manager.js`

### Milestone L — Factions + Politics
- Faction system core - `src/sim/politics/factions.js`
- Policy/law system - `src/sim/politics/policies.js`
- Key roles & appointments - `src/sim/politics/appointments.js`
- Territory/pressure mapping - `src/sim/politics/pressure_map.js`
- Rival AI integration - `src/sim/ai/rival_integration.js`

### Milestone M — Dynamic Crises v2
- Crisis Director v2 - `src/sim/crisis/director.js`
- Incident system - `src/sim/crisis/incident_system.js`
- Dispatch/response v1 - `src/sim/crisis/dispatch.js`
- Street Mode interventions - `src/sim/crisis/street_mode.js`
- Aftermath system - `src/sim/crisis/aftermath.js`

### Milestone N — Campaign Structure
- Campaign model - `src/sim/campaign/model.js`
- Case generator v2 - `src/sim/campaign/case_generator.js`
- Dialogue + choice presentation - `src/sim/campaign/dialogue.js`
- News feed + briefing - `src/sim/campaign/news_feed.js`
- Content validation scripts - `tools/validate_campaign.js`

### Milestone O — Roguelike Meta
- Run-end summary + scoring - `src/ui/run_summary.js`
- Profile persistence - `src/sim/persistence/profile.js`
- Unlock tree + shop - `src/ui/shop.js`
- Run start scenarios + mutators - `src/sim/scenarios.js`
- Seed browser + replay - `src/ui/seed_browser.js`

### Milestone P — Developer Tooling
- Dev menu/console v2 - `src/ui/dev_menu.js`
- Content validation + CI - `tools/validate_content.js`
- Placement tools - `src/sim/tools/placement.js`
- Asset pipeline - `tools/asset_pipeline.js`
- Localization-ready text - `src/i18n/manager.js`

### Milestone Q — Performance Finalization
- Simulation chunking - `src/sim/chunking.js`
- Render LOD - `src/render/lod_manager.js`
- Culling + visibility - `src/render/culling.js`
- Save/load performance - `src/sim/persistence/saver.js`
- Soak test suite - `tests/soak.js`

### Milestone R — Visual/Audio Polish
- Day/Night cycle - `src/render/day_night.js`
- Player + citizen animation - `src/render/animation.js`
- Soundscape v2 - `src/audio/soundscape.js`
- VFX pass - `src/render/vfx_pass.js`
- UI theme + accessibility - `src/style.css`, `src/ui/a11y.js`

### Milestone S — QA Automation
- Automated sim regression - `tests/regression.js`
- Save/load fuzz testing - `tests/fuzz_save.js`
- Telemetry logging - `src/utils/telemetry.js`
- Balance process v2 - `tests/balance_test.js`
- Beta bug bash - `docs/BETA_PLAN.md`

### Milestone T — Beta Release Prep
- Release build pipeline - `tools/release_build.js`
- Error boundary + crash recovery - `src/utils/error_boundary.js`
- Onboarding finalization - `src/sim/tutorial/onboarding.js`
- Content completeness - `tools/check_content.js`
- Known issues + feedback - `docs/KNOWN_ISSUES.md`

### Milestone U — 1.0.0 Release
- Release candidate checklist - `docs/RC_CHECKLIST.md`
- Final performance certification - `tests/perf_cert.js`
- Legal/credits/licenses - `docs/CREDITS.md`
- Release notes finalization - `CHANGELOG.md`
- Post-launch plan - `docs/POST_LAUNCH.md`

---

## Implementation Priority

### Phase 1: Core Gameplay Loop (Milestones F-G)
1. Complete Milestone F integration (mode switching, zoning UI)
2. Implement economy v2 (budget, taxes, services)
3. Add loans/debt system

### Phase 2: Systems Depth (Milestones H-K)
1. Infrastructure networks (power, water, data)
2. Traffic simulation
3. Citizen v2 (households, crime, social graph)
4. Surveillance/influence operations

### Phase 3: Narrative & Politics (Milestones L-N)
1. Factions + politics
2. Dynamic crises v2
3. Campaign expansion

### Phase 4: Meta & Polish (Milestones O-R)
1. Roguelike meta progression
2. Dev tooling
3. Performance optimization
4. Visual/audio polish

### Phase 5: QA & Release (Milestones S-U)
1. QA automation
2. Beta release prep
3. 1.0.0 release

---

## Next Steps

1. **Immediate**: Complete Milestone J (citizen simulation v2 - households, job market)
2. **Short-term**: Build surveillance/influence systems (Milestone K)
3. **Medium-term**: Implement factions/politics (Milestone L) and dynamic crises v2 (Milestone M)
4. **Long-term**: Complete narrative expansion, meta progression, and release preparation

---

## Notes

- Smoke tests pass: 165/165 tests
- Milestone F complete (dual-mode foundation, zoning, demand)
- Math.random() audit complete (replaced in vehicle_controller.js)
- Save schema versioning exists
- Deterministic RNG streams verified
- Performance overlay available (F3)
- Mode toggle: Tab key (Street/God)
- Zone overlay: Z key (none/zones/zoned)
- Network toggle: 1-4 keys (power/water/sewage/data)
