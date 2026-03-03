# Release Candidate Checklist - Milestone U (1.0.0)

This checklist ensures all requirements are met before shipping version 1.0.0.

---

## 1.0.0 Exit Criteria

### Quality Gate
- [ ] **0 critical bugs** - All critical bugs fixed or documented with workarounds
- [ ] **0 high-priority bugs** - All high-priority bugs fixed or accepted risks
- [ ] **30-minute MEGA soak test passes** - No memory/perf collapse, no crashes
- [ ] **Tutorial works** - New player can reach "main case started" reliably
- [ ] **Build has version `1.0.0`** - Version visible in UI + save meta + build-version.json
- [ ] **Save compatibility** - Migrations work for all previous save versions

### Beta Feedback Integration
- [ ] All beta feedback tickets addressed
- [ ] Known issues doc is current and accurate
- [ ] Codex documentation is complete and searchable
- [ ] Error capture/recovery UX verified

---

## Pre-Release Checklist

### Build & Packaging
- [ ] Run `npm run build` successfully (production build)
- [ ] Run `npm run build:beta 1.0.0` to generate release candidate
- [ ] Version string is `1.0.0` (no `-beta` suffix)
- [ ] Build output runs offline without network access
- [ ] Release zip produced and validated
- [ ] `build-version.json` contains correct metadata

### Automated Tests
- [ ] All smoke tests pass (165/165 expected)
- [ ] `node tests/regression.js` - All regression tests pass
- [ ] `node tests/fuzz_save.js` - Save/load fuzzing passes
- [ ] 10 fixed balance seeds produce consistent results
- [ ] Determinism verified across multiple runs

### Manual Testing - Core Gameplay
- [ ] **City Generation**
  - [ ] New game starts reliably
  - [ ] Map generation completes without errors
  - [ ] Districts, roads, parcels created correctly

- [ ] **Economy System**
  - [ ] Budget management works (taxes, expenses)
  - [ ] Loans can be taken and repaid
  - [ ] Bankruptcy mechanics trigger correctly

- [ ] **Infrastructure**
  - [ ] Power network delivers to consumers
  - [ ] Water supply works with pollution tracking
  - [ ] Sewage system handles waste
  - [ ] Data grid provides intel coverage

- [ ] **Traffic & Agents**
  - [ ] Citizen movement follows routes
  - [ ] Vehicle traffic flows correctly
  - [ ] Emergency services respond to incidents

- [ ] **Citizens**
  - [ ] Household allocation works
  - [ ] Job market matches citizens to jobs
  - [ ] Crime incidents generate and track

- [ ] **Politics & Factions**
  - [ ] Policy enactment/revocation works
  - [ ] Appointments affect gameplay
  - [ ] Pressure map reflects faction influence

### Manual Testing - UI & UX
- [ ] **Main Menu**
  - [ ] Start new game works
  - [ ] Load game list displays correctly
  - [ ] Settings menu opens and saves

- [ ] **Game HUD**
  - [ ] Stats panel updates in real-time
  - [ ] Map navigation works (click-to-move)
  - [ ] Mode toggle (Tab) switches correctly

- [ ] **Keyboard Shortcuts**
  - [ ] `?` opens Codex
  - [ ] `F12` opens Known Issues
  - [ ] `Shift+S` opens Shop
  - [ ] `Shift+B` opens Seed Browser
  - [ ] `Shift+O` opens Settings
  - [ ] `P` pauses/resumes game
  - [ ] `M` toggles map screen

- [ ] **Codex System**
  - [ ] Search works across categories
  - [ ] Help entries display correctly
  - [ ] Keyboard shortcuts documented

- [ ] **Settings Menu**
  - [ ] All settings save to localStorage
  - [ ] Known Issues button works
  - [ ] Debug info copy works

### Manual Testing - Advanced Features
- [ ] **Crisis Management**
  - [ ] Crises generate based on stress levels
  - [ ] Response teams dispatch correctly
  - [ ] Street mode interventions work

- [ ] **Campaign/Quests**
  - [ ] New case starts on new game
  - [ ] Case progression works
  - [ ] Dialogue choices affect outcomes

- [ ] **Rival AI**
  - [ ] Rival actions respond to player progress
  - [ ] Heat tracking works
  - [ ] Rival weakness exploitation works

- [ ] **Roguelike Meta**
  - [ ] Shop unlocks persist across runs
  - [ ] Seed browser replays work
  - [ ] Run summary calculates correctly

---

### Performance Requirements

| Test | Target | Status |
|------|--------|--------|
| Map generation (256x256) | < 5 seconds | [ ] |
| 30-min MEGA soak test | No crash | [ ] |
| Memory after test | < 500MB | [ ] |
| FPS (idle) | > 50 | [ ] |
| FPS (building dense city) | > 30 | [ ] |
| Save file size (large city) | < 5MB | [ ] |
| Load time | < 3 seconds | [ ] |

---

## Known Issues (See `KNOWN_ISSUES.md`)

- [ ] All known issues are documented
- [ ] High-priority issues have workarounds
- [ ] Documentation reflects current state

---

## Legal & Credits

- [ ] `CREDITS.md` created with all contributors
- [ ] `LICENSE.md` present and correct
- [ ] Third-party licenses documented
- [ ] Assets have proper attribution

---

## Documentation

- [ ] `CHANGELOG.md` updated with 1.0.0 changes
- [ ] `MILESTONE_PROGRESS.md` reflects Milestone U complete
- [ ] `README.md` accurate for 1.0.0
- [ ] User guides are complete

---

## Final Sign-off

| Role | Name | Date | Sign-off |
|------|------|------|----------|
| QA Lead | | | |
| Lead Dev | | | |
| Project Owner | | | |

---

## Release Steps (After Checklist Passes)

1. Create release branch `release/v1.0.0`
2. Update `package.json` version to `1.0.0`
3. Run `npm run build:beta 1.0.0`
4. Run final smoke tests on release build
5. Tag release in git: `git tag v1.0.0`
6. Push branch and tags
7. Upload build artifacts to hosting
8. Update `CHANGELOG.md` with release date
9. Announce release
10. Create post-launch monitoring plan

---

## Go/No-Go Criteria

**GO to release if:**
- [ ] All exit criteria met
- [ ] All critical bugs resolved
- [ ] QA sign-off received
- [ ] Documentation complete

**NO GO if:**
- [ ] Any critical bug unresolved
- [ ] Save compatibility broken
- [ ] Build fails or inconsistent
- [ ] Major regressions introduced