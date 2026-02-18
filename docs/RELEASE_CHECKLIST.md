# Release Checklist

This checklist ensures Milestone E requirements are met before shipping version 1.0.0.

---

## 1.0.0 Exit Criteria

- [ ] **0 critical bugs in checklist** - All critical bugs fixed or documented with workarounds
- [ ] **30-minute MEGA soak test passes** - No memory/perf collapse, no crashes
- [ ] **Tutorial works** - New player can reach "main case started" reliably
- [ ] **Build has version `1.0.0`** - Version visible in UI + save meta
- [ ] **Save compatibility** - Migrations work for previous save versions

---

## Pre-Release Checklist

### Build & Packaging
- [ ] Run `npm run build` successfully
- [ ] Version string is `1.0.0`
- [ ] Build output runs offline
- [ ] Release zip produced and validated

### Automated Tests
- [ ] All smoke tests pass (`node scripts/smoke_test.mjs`)
- [ ] 10 fixed balance seeds produce consistent results
- [ ] Save/load works on each seed

### Manual Testing
- [ ] **E-01 Settings Menu**
  - [ ] Settings toggle (Shift+O)
  - [ ] Mouse sensitivity applies immediately
  - [ ] Invert Y axis works
  - [ ] Volume controls work
  - [ ] Render scale adjusts
  - [ ] Settings persist in localStorage

- [ ] **E-02 Feedback Polish**
  - [ ] Building placement shows floating text
  - [ ] Build success/fail feedback is clear
  - [ ] Hack progress ring shows during hacking
  - [ ] Hack success/fail effects visible

- [ ] **E-03 Audio**
  - [ ] Audio can be muted/unmuted
  - [ ] Volume controls work
  - [ ] No audio clipping
  - [ ] Fallback synthesized audio works

- [ ] **E-04 Tutorial**
  - [ ] Tutorial starts on new game
  - [ ] Can be skipped with keyboard shortcut
  - [ ] Tutorial quest shows in quest log
  - [ ] Can reach "main case started"

- [ ] **E-05 QA + Regression**
  - [ ] QA checklist runs without critical issues
  - [ ] 30-minute MEGA test passes
  - [ ] Known issues documented

- [ ] **E-06 Build Pipeline**
  - [ ] Version stamping works
  - [ ] Build produces consistent artifact
  - [ ] CHANGELOG is up to date

---

## Critical Bug Checklist

| ID | Description | Reproduction Steps | Status |
|----|-------------|-------------------|--------|
| - | None | - | - |

---

## Performance Requirements

| Test | Target | Status |
|------|--------|--------|
| Map generation (MEGA 256x256) | < 5 seconds | [ ] |
| 30-min MEGA soak test | No crash | [ ] |
| Memory after test | < 500MB | [ ] |
| FPS (idle) | > 50 | [ ] |
| FPS (building) | > 30 | [ ] |

---

## Known Issues (See `KNOWN_ISSUES.md`)

- [ ] All known issues are documented
- [ ] High-priority issues have workarounds

---

## Final Sign-off

| Role | Name | Date |
|------|------|------|
| QA | | |
| Lead Dev | | |

---

## Release Steps (After Checklist Passes)

1. Create release branch
2. Update version to `1.0.0`
3. Tag release in git
4. Build release artifact
5. Upload to hosting
6. Announce release
7. Archive release notes