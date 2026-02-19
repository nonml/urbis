# Milestone T — Beta Release Prep (Packaging, Tutorial, Stability) (target: 0.42.x (Beta))

## Objective 🎯
- Prepare a beta build that is easy to install/run and hard to break.
- Finalize onboarding flow and ensure content completeness for a full play session.
- Lock release engineering basics (versioning, changelog, known issues).

---

## Milestone Exit Criteria (Acceptance)
- ✅ Beta build is generated with one command and runs offline from `dist/`.
- ✅ Tutorial + help screens cover both God Mode and Street Mode.
- ✅ A full run can be completed (win or lose) with at least one main arc and multiple minors.
- ✅ Known issues are documented and visible in-game.


## Definition of Done (DoD)
- Release checklist is executed for each beta drop.
- Crash/critical error handling shows user-facing guidance.
- Build artifacts include version, build time, and commit id (if available).


---

## Phases
1) Release engineering
2) Onboarding finalization
3) Content completeness pass
4) Stability + error handling


---

## Tickets

### T-01 — Release build pipeline hardening
**Objective:** Make builds reproducible and easy for testers.

**Design**
- Vite build outputs `dist/` with hashed assets.
- Optional: single-file build for easier sharing.


**Specs**
- `npm run build:beta`
- Version stamp displayed in main menu and pause menu.


**Implementation details**
1. Add beta build script and ensure assets included.
2. Embed build metadata.
3. Add sanity checks post-build (open dist and run smoke).


**Acceptance**
- Beta build runs without internet (except optional CDN for Three.js if not bundled).
- Version stamp matches changelog.


**DoD**
- Build instructions documented for Windows/macOS.


---

### T-02 — Error boundary + crash recovery UX
**Objective:** Prevent 'white screen' failures for testers.

**Design**
- Global error handler shows an error screen with: version, seed, run id, copy button.
- Option to reload and optionally upload/export save + telemetry.


**Specs**
- `src/ui/error_screen.js`
- `src/dev/error_capture.js`


**Implementation details**
1. Implement window.onerror and unhandledrejection capture.
2. Display error screen and offer recovery actions.
3. Add export of current save + telemetry bundle.


**Acceptance**
- A thrown error results in controlled UI, not blank page.
- Tester can export debug bundle.


**DoD**
- Error handler avoids infinite loops (guard).


---

### T-03 — Onboarding finalization (tutorial + codex/help)
**Objective:** Make the game playable without explanation.

**Design**
- Tutorial teaches both modes and core loops.
- Codex/Help screen lists concepts: zoning, utilities, ops, factions, crises.


**Specs**
- `src/ui/codex.js`
- Content in `assets/codex/en.json`


**Implementation details**
1. Expand tutorial to include utilities and one influence op.
2. Add codex UI with search.
3. Link help hints contextually (e.g., first time opening Grid overlay).


**Acceptance**
- New tester can reach mid-game without getting stuck.
- Help content matches current controls and systems.


**DoD**
- Codex entries are i18n-ready.


---

### T-04 — Content completeness pass (main arcs, minors, operations, policies)
**Objective:** Ensure a beta session has enough variety to evaluate replayability.

**Design**
- Minimum content targets:
- - 3 main campaign templates
- - 30+ minor storylets
- - 10+ operations
- - 12+ policies


**Specs**
- Validation script checks target counts and missing fields.
- `docs/CONTENT_TARGETS.md`


**Implementation details**
1. Write/curate content packs (can be placeholder text but functional).
2. Run validation and fix errors.
3. Add 'content pack version' field in profile.


**Acceptance**
- Across 5 seeds, testers see different arcs and minors.
- No content-driven crashes.


**DoD**
- Content authorship guide updated with new examples.


---

### T-05 — Known issues + feedback collection UX
**Objective:** Guide testers and collect actionable feedback.

**Design**
- Known issues screen from main menu.
- In-game feedback prompt optionally exports bundle and opens template text.


**Specs**
- `docs/KNOWN_ISSUES.md` synced to `assets/known_issues.json`
- `src/ui/feedback.js`


**Implementation details**
1. Create known issues UI and update process.
2. Add 'Report issue' button that copies template with debug info.
3. Add optional survey link placeholder (text only).


**Acceptance**
- Testers can easily include seed/version/run id in feedback.
- Known issues visible so duplicates reduce.


**DoD**
- No external network calls required; template only.


---
