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

## [Unreleased]

### Planned
- Full audio asset library
- Additional tutorial scenarios
- Expanded QA test suite
- Performance optimization for large maps

### Known Issues
See `docs/KNOWN_ISSUES.md` for current known issues.

---

## Version Format

Version: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

Build info: `(Build BUILD_NUMBER)` appended to version string.