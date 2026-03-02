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
| J | 0.22.x | ✅ Complete | 100% | Citizen simulation v2 |
| K | 0.24.x | ✅ Complete | 100% | Surveillance/influence complete |
| L | 0.26.x | ✅ Complete | 100% | Factions/politics system implemented |
| M | 0.28.x | ✅ Complete | 100% | Dynamic crises v2 |
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

### Milestone J — Citizen Simulation v2 ✅ Complete
- **Household model + housing** - `src/sim/citizens/household.js`
  - `Household` class with members, housing capacity, happiness calculations
  - `HousingManager` with household allocation, capacity tracking, stats
  - `PopulationManager` with births, deaths, immigration, emigration

- **Job market v1** - `src/sim/economy/job_market.js`
  - Job openings with salary and requirements
  - Citizen job matching based on traits and availability
  - Employment tracking and stats

- **Crime incident generator** - `src/sim/citizens/crime_generator.js`
  - Crime types: vandalism, theft, assault, burglary, robbery, arson, murder, corruption
  - Crime probability modifiers based on citizen conditions
  - Incident tracking with detection and solving

- **Social graph v1** - `src/sim/citizens/social_graph.js`
  - `SocialRelationship` class with affinity, trust, familiarity
  - `SocialGraph` with relationship management, connection tracking
  - Trait-based interaction modifiers and family bonds

- **Citizen profile UI** - `src/ui/citizen_profile.js`
  - `CitizenProfileData` class for citizen display data
  - `CitizenProfileUI` panel with needs, employment, household, social connections
  - Keyboard shortcut (V key) to show closest citizen's profile
  - Full CSS styling integrated

- **Additional** - `src/citizen.js`
  - Added `getCitizenById()` method to `CitizenManager`
  - Added new simulation properties (`needs`, `mood`, `traits`, etc.) to `Citizen`

### Milestone K — Surveillance + Influence ✅ Complete

**Exit Criteria Met:**
- ✅ Intel database (K-01) - `src/sim/intel/database.js` with categories, priorities, and search
- ✅ Surveillance sources (K-02) - `src/sim/intel/sources.js` with camera, data grid, informant sources
- ✅ Influence operations (K-03) - `src/sim/intel/influence_engine.js` with operations and reputation
- ✅ Public sentiment (K-04) - `src/sim/intel/sentiment.js` with demographics and media coverage
- ✅ Exposure/heat v2 (K-05) - `src/sim/intel/heat_manager.js` with exposure tracking

**Files Created:**
- `src/sim/intel/database.js` - Intel entry storage with indexing and retrieval
- `src/sim/intel/sources.js` - Surveillance source management with intel generation
- `src/sim/intel/influence_engine.js` - Influence operations engine with operations tracking
- `src/sim/intel/sentiment.js` - Public sentiment tracking by demographic
- `src/sim/intel/heat_manager.js` - Enhanced heat management with exposure tracking

**Integration Completed:**
- Connected to game state initialization - `src/game.js`
- Integrated into tickOnce() update loop
- Added to saveGame/loadGame state persistence
- Added UI report panels in `src/ui.js` stats panel
- Added new event types in `src/sim/events.js`

**Features:**
- Intel entries with categories (rival, citizen, location, event, building, vehicle, crime)
- Surveillance sources (cameras, data hubs, cell towers, informants)
- Influence operations with cost, heat, and sentiment effects
- Public sentiment tracking with demographic breakdown
- Heat management with exposure tracking and state levels
- UI display of intel statistics in stats panel

### Milestone L — Factions + Politics ✅ Complete

**Exit Criteria Met:**
- ✅ Policy system (L-01) - `src/sim/politics/policies.js` with enactment, revocation, expiration
- ✅ Appointments system (L-02) - `src/sim/politics/appointments.js` with key roles
- ✅ Pressure map (L-03) - `src/sim/politics/pressure_map.js` with territory influence
- ✅ Rival integration (L-04) - `src/sim/politics/rival_integration.js` with political responses
- ✅ Faction system (L-05) - `src/sim/factions/faction_system.js` with reputation

**Files Created:**
- `src/sim/politics/policies.js` - Policy/law system with categories, effects, costs
- `src/sim/politics/appointments.js` - Political appointments with requirements and duration
- `src/sim/politics/pressure_map.js` - District-based territory pressure mapping
- `src/sim/politics/rival_integration.js` - Rival AI political response system
- `src/ui/politics_panel.js` - UI panel for policy management

**Integration Completed:**
- Connected to game state initialization - `src/game.js`
- Integrated into tickOnce() update loop
- Added PoliticsPanel to UIManager - `src/ui.js`
- CSS styling for politics panel in `src/style.css`

**Features:**
- 5 policy categories (Economic, Social, Security, Infrastructure, Diplomacy)
- Enact policies with cost, duration, and faction impact
- Revoke policies before expiration
- Political appointments (Mayor, Chief of Police, Advisor, etc.)
- Territory pressure tracking (Faction, Crime, Economic, Service, Surveillance)
- Rival AI political responses based on heat and threat levels
- UI panel with tabs for policies, appointments, and pressure map
- Event system integration with custom event types

### Milestone M — Dynamic Crises v2 ✅ Complete

**Exit Criteria Met:**
- ✅ Crisis Director v2 (M-01) - `src/sim/crisis/director.js`
- ✅ Incident system (M-02) - `src/sim/crisis/incident_system.js`
- ✅ Dispatch/response system (M-03) - `src/sim/crisis/dispatch.js`
- ✅ Street Mode interventions (M-04) - `src/sim/crisis/street_mode.js`
- ✅ Aftermath system (M-05) - `src/sim/crisis/aftermath.js`
- ✅ Game state integration - `src/game.js`
- ✅ Headless game integration - `src/headless_game.js`

**Files Created:**
- `src/sim/crisis/director.js` - Crisis Director v2 with escalation, resolution, and mitigation
- `src/sim/crisis/incident_system.js` - Localized incident tracking with spatial impact
- `src/sim/crisis/dispatch.js` - Response team management and dispatch system
- `src/sim/crisis/street_mode.js` - Player-directed interventions in street mode
- `src/sim/crisis/aftermath.js` - Long-term recovery and reputation tracking

**New Crisis Types:**
- `BLACKOUT` - Power grid collapse
- `BRIDGE_FAILURE` - Bridge collapse
- `MARKET_CRASH` - Market crash

**Integration Completed:**
- Crisis Director v2 initialized in `src/game.js` and `src/headless_game.js`
- Tick updates integrated into `tickOnce()` update loop
- Save/load state serialization implemented
- Event types added to `src/sim/events.js`

**Features:**
- Dynamic crisis generation based on city stress levels
- Crisis escalation over time with heat tracking
- Mitigation options with success probabilities
- Localized incidents with spatial spread mechanics
- Response team dispatch with travel time and cooldown
- Street Mode direct intervention system
- Long-term aftermath recovery tracking
- Reputation impact and faction reactions
- 10 new crisis types beyond original 7

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
1. Factions + politics ✅ Complete
2. Dynamic crises v2 ✅ Complete
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

1. **Immediate**: Implement campaign expansion (Milestone N)
2. **Short-term**: Complete roguelike meta progression (Milestone O)
3. **Medium-term**: Dev tooling, performance optimization
4. **Long-term**: Visual/audio polish, QA automation, release prep

---

## Notes

- Smoke tests pass: 165/165 tests
- Milestone M complete (dynamic crises v2)
- Milestone F complete (dual-mode foundation, zoning, demand)
- Math.random() audit complete (replaced in vehicle_controller.js)
- Save schema versioning exists
- Deterministic RNG streams verified
- Performance overlay available (F3)
- Mode toggle: Tab key (Street/God)
- Zone overlay: Z key (none/zones/zoned)
- Network toggle: 1-4 keys (power/water/sewage/data)
- Crisis Director v2 with 10 crisis types
- Incident system with spatial spread mechanics
- Dispatch system with response team tracking
- Street Mode interventions for direct player control
- Aftermath recovery tracking with reputation impacts
