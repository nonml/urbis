# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-02-18

### Added
- **Settings Menu (E-01)**: Mouse sensitivity, invert Y, volume controls, render scale, FPS overlay, tutorial toggle
- **Feedback Polish (E-02)**: Floating text for building placement, hack progress rings, success/fail effects
- **Audio System (E-03)**: Web Audio API audio manager with ambient loops, UI sounds, crisis stingers
- **Tutorial System (E-04)**: Guided first-time user experience using quest engine
- **QA Documentation (E-05)**: Release checklist, known issues tracker
- **Build Pipeline (E-06)**: Vite build pipeline, version stamping

### Changed
- Settings persist in localStorage (not in save file)
- UI sounds integrated with settings volume controls

### Technical
- Added `src/ui/settings.js` - SettingsManager class
- Added `src/audio/audio_manager.js` - AudioManager class
- Added `src/sim/tutorial/tutorial.js` - TutorialManager class
- Added `src/version.js` - Version info
- Updated `src/ui.js` - Audio manager integration
- Updated `src/game.js` - Tutorial manager integration
- Updated `src/renderer3d.js` - VFX feedback system
- Updated `src/buildings.js` - Feedback on build
- Updated `src/sim/interactables.js` - Hack progress feedback

---

## [0.3.0] - Prior to Milestone E

- Initial release with core city builder mechanics
- 3D third-person rendering
- Quest system with case files
- Crisis management
- Rival AI
- Progression system

---

## [0.42.0] - 2026-03-04

### Added - Milestone T: Beta Release Prep
- **Release Build Pipeline (T-01)**: Reproducible beta build with `npm run build:beta`, version stamping, and build metadata embedding
- **Error Boundary UX (T-02)**: Global error handler with crash recovery screen, save bundle export, and debug info copying
- **Codex System (T-03)**: In-game help and reference guide with search and categories (Core, Controls, Buildings, Advanced)
- **Content Validation (T-04)**: `tools/check_content.js` script to validate content completeness targets
- **Feedback UX (T-05)**: Known issues display with issue reporting template integration

### Changes
- Updated `package.json` with `build:beta` script and `glob` dependency
- Updated `src/ui.js` with CodexUI and FeedbackUI integration
- Updated `src/ui/settings.js` with Known Issues button in settings menu
- Fixed syntax errors in `src/sim/intel/heat_manager.js`, `src/ui/feedback.js`, `src/vehicles/vehicle_state.js`
- Fixed import paths in `src/sim/politics/pressure_map.js` and `src/sim/services/services.js`

### Technical
- Added `tools/release_build.js` - Build pipeline script
- Added `src/dev/error_capture.js` - Error handling system
- Added `src/ui/codex.js` - Codex reference system
- Added `tools/check_content.js` - Content validation script
- Added `src/ui/feedback.js` - Feedback and known issues system
- Added `build-version.json` - Build metadata in output

---

## [1.0.0] - 2026-03-04

### Added - Milestone U: 1.0.0 Release
- **Release Infrastructure (U-01)**: Complete release candidate checklist, RC gates, and freeze rules documented
- **Performance Certification (U-02)**: Perf targets across Small/City/MEGA presets with certification script
- **Legal/Credits (U-03)**: Credits screen, LICENSES/ folder, third-party license documentation
- **Release Notes (U-04)**: Finalized 1.0.0 notes with feature list and known issues
- **Post-Launch Plan (U-05)**: 1.0.1 hotfix process, triage timeline, and 1.1 roadmap draft

### Added - Feature Summary (Complete v1.0 Feature Set)
- **Dual-Mode City Builder**: Street mode (pedestrian) and God mode (strategic overview)
- **Procedural City Generation**: Districts, roads, parcels with deterministic seeds
- **Economy System**: Budget, taxes (R/C/I), loans with bankruptcy mechanics
- **Infrastructure Networks**: Power, water, sewage, data grid with coverage maps
- **Traffic Simulation**: Road graph, A* routing, congestion-aware pathfinding
- **Citizen v2**: Households, job market, crime incidents, social graph
- **Surveillance/Influence**: Intel database, cameras, influence operations, sentiment
- **Factions + Politics**: Policies, appointments, pressure map, rival integration
- **Dynamic Crises v2**: Blackout, bridge failure, market crash events
- **Campaign Expansion**: Case files, dialogue choices, news feed, briefings
- **Roguelike Meta**: Shop unlocks, seed browser, replays, run summary scoring
- **QA Automation**: 165 smoke tests passing, save/load fuzzing, balance tests

### Changed
- Updated `package.json` with version `1.0.0`
- Updated `src/ui.js` with CodexUI and FeedbackUI integration
- Updated `src/ui/settings.js` with Known Issues button
- Fixed syntax in `src/sim/intel/heat_manager.js`, `src/ui/feedback.js`, `src/vehicles/vehicle_state.js`
- Fixed import paths in `src/sim/politics/pressure_map.js`, `src/sim/services/services.js`

### Technical
- Added `tests/perf_cert.js` - Performance certification script
- Added `docs/RC_CHECKLIST.md` - Release candidate checklist
- Added `docs/CREDITS.md` - Credits and license documentation
- Added `docs/POST_LAUNCH.md` - Post-launch support plan
- Added `build-version.json` - Build metadata (version, commit, timestamp)

### Performance Targets (1.0.0)
| Preset | Grid | Target FPS | Max Memory |
|--------|------|------------|------------|
| Small | 64x64 | 50 | 200MB |
| City | 128x128 | 40 | 400MB |
| MEGA | 256x256 | 30 | 500MB |

### Known Issues
See `docs/KNOWN_ISSUES.md` for current known issues.

---

## [0.42.0] - 2026-03-04

### Added - Milestone T: Beta Release Prep
- **Release Build Pipeline (T-01)**: Reproducible beta build with `npm run build:beta`, version stamping, and build metadata embedding
- **Error Boundary UX (T-02)**: Global error handler with crash recovery screen, save bundle export, and debug info copying
- **Codex System (T-03)**: In-game help and reference guide with search and categories (Core, Controls, Buildings, Advanced)
- **Content Validation (T-04)**: `tools/check_content.js` script to validate content completeness targets
- **Feedback UX (T-05)**: Known issues display with issue reporting template integration

### Changed
- Updated `package.json` with `build:beta` script and `glob` dependency
- Updated `src/ui.js` with CodexUI and FeedbackUI integration
- Updated `src/ui/settings.js` with Known Issues button in settings menu
- Fixed syntax errors in `src/sim/intel/heat_manager.js`, `src/ui/feedback.js`, `src/vehicles/vehicle_state.js`
- Fixed import paths in `src/sim/politics/pressure_map.js` and `src/sim/services/services.js`

### Technical
- Added `tools/release_build.js` - Build pipeline script
- Added `src/dev/error_capture.js` - Error handling system
- Added `src/ui/codex.js` - Codex reference system
- Added `tools/check_content.js` - Content validation script
- Added `src/ui/feedback.js` - Feedback and known issues system
- Added `build-version.json` - Build metadata in output

---

## Version Format

Version: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

Build info: `(Build BUILD_NUMBER)` appended to version string.