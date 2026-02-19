# Milestone E — Vertical Slice Alpha + Internal QA (target: 0.12.x)

## Objective 🧼
Turn the prototype into a **repeatable “vertical slice”** that is stable enough for daily playtests:
- Clear UX + controls (Street Mode baseline)
- Minimal audio/feedback so actions are readable
- Tutorial that teaches the core loop (build → crisis → intel node → minor case)
- QA discipline: checklists, smoke tests, bug bash workflow
- Build/version stamping for playtest distribution (not final 1.0)

---

## Current State Snapshot
- Prototype already has: terrain + basic building placement, basic citizens/crises, 3D third-person renderer, minimap.
- Missing for playtest: settings, onboarding, consistent feedback, reproducible builds, bug workflow.

---

## Milestone Exit Criteria (Acceptance)
- ✅ 30-minute playtest on **Small** and **City** completes with **0 crashes**
- ✅ MEGA loads and is explorable; no “death spiral” perf/memory collapse in 20 minutes
- ✅ Tutorial reliably gets a new player to:
  1) place housing + a job building
  2) resolve one crisis
  3) use an intel node (scan/surveillance)
  4) complete one minor case step
- ✅ Build displays: version + seed + run id (for bug reports)
- ✅ QA workflow exists (how to reproduce/report/triage)

## Definition of Done (DoD)
- No console errors in a normal session (warnings acceptable if tracked)
- Playtest checklist (E-05) completed and archived for the milestone
- A tagged build artifact exists (zip) and matches the checklist

---

## Phases
1) UX & controls
2) Feedback (audio/VFX/UI messaging)
3) Tutorial
4) QA + regression + bug bash
5) Build/versioning for distribution

---

## Tickets

### E-01 — Settings menu (controls, graphics, audio)
**Objective:** Basic player options so playtests are consistent.

**Design**
- Settings: mouse sensitivity, invert Y, volume, render distance (LOD), toggles for overlays.

**Specs**
- `src/ui/settings.js`
- Persist in `localStorage` (not in save files).
- Expose a `Settings` object for renderer + input.

**Implementation details**
1. Create settings schema + defaults.
2. UI panel + hotkey `Esc` → pause menu → settings.
3. Apply immediately (camera sensitivity, audio volume).

**Acceptance**
- Player can change sensitivity and it applies immediately.
- Settings persist after refresh.

**DoD**
- Defaults documented in `README.md`.

---

### E-02 — Feedback polish (VFX + UI messaging)
**Objective:** Make actions readable without digging into logs.

**Design**
- Build/place: highlight valid parcel/tile, cost preview, confirmation toast.
- Crisis: stinger + “what changed” summary.
- Intel node: progress ring, success/fail, reward popup.

**Specs**
- Lightweight: sprites/billboards + DOM toasts.
- `src/ui/toast.js`, `src/render/fx_billboards.js`

**Implementation details**
1. Add toast queue (rate-limited).
2. Add billboard system for simple markers/effects.
3. Hook into building placement, crisis triggers, intel interactions.

**Acceptance**
- Player can explain consequences of an action from feedback alone.

**DoD**
- No measurable perf regression on City.

---

### E-03 — Audio pass (minimum viable)
**Objective:** Atmosphere + UX clarity.

**Design**
- Ambient loop per district/theme (placeholder OK).
- Footsteps + UI clicks + crisis stingers.

**Specs**
- `assets/audio/*`
- `src/audio/audio_manager.js` with:
  - `playSfx(id)`, `setVolume(v)`, `setMuted(bool)`

**Implementation details**
1. Implement simple audio manager (WebAudio or HTMLAudio).
2. Connect to events: step, place, crisis, intel success/fail.
3. Add mute toggle in settings.

**Acceptance**
- Audio can be muted and doesn’t clip.

**DoD**
- Asset list includes license/attribution notes (even if placeholder).

---

### E-04 — Tutorial + first-time user flow
**Objective:** Teach the loop in under 5 minutes.

**Design**
- Guided objectives with soft locks:
  1) move + rotate camera
  2) place a house
  3) place a job building
  4) resolve a crisis
  5) use an intel node
  6) open quest log and follow marker (if available)

**Specs**
- `src/sim/tutorial/tutorial.js`
- Tutorial uses the same objective system as quests (future-proof).

**Implementation details**
1. Implement tutorial state machine with “wait for event” steps.
2. Add UI objective banner.
3. Add “skip tutorial” + “reset tutorial” option.

**Acceptance**
- New player reaches “free play” reliably.

**DoD**
- Tutorial never blocks experienced players (skip works).

---

### E-05 — QA + regression suite
**Objective:** Fewer surprises during rapid iteration.

**Design**
- Maintain:
  - manual checklist
  - automated smoke test
  - fixed regression seeds

**Specs**
- `docs/TEST_CHECKLIST.md`
- `docs/REGRESSION_SEEDS.md`
- `scripts/smoke_test.mjs`

**Implementation details**
1. Write checklists and seed list.
2. Expand smoke test to run 3 presets (Small/City/Mega) headlessly.
3. Add “assert invariants” (no NaNs, no negative resources if disallowed).

**Acceptance**
- Any dev can run the suite in < 2 minutes.

**DoD**
- Checklist includes “how to attach a save file” for bug reports.

---

### E-06 — Build pipeline + version stamping + changelog
**Objective:** Produce reproducible playtest artifacts.

**Design**
- Add build step (recommended: Vite) and version injection.
- Maintain `CHANGELOG.md` (Keep a Changelog format).

**Specs**
- `package.json` scripts: `dev`, `build`, `preview`
- `src/version.js` exports `{ version, buildTime, gitSha? }`
- Save meta includes version + seed + run id.

**Implementation details**
1. Initialize Vite.
2. Add version stamp in UI footer + pause menu.
3. Add `CHANGELOG.md` template and update every milestone.

**Acceptance**
- Build output runs from `dist/` and shows version.

**DoD**
- Release zip produced + validated with checklist.

---

### E-07 — Bug bash workflow + triage rules
**Objective:** Juniors can run playtests and file actionable bugs.

**Design**
- Define severity levels (S0 crash → S3 cosmetic).
- Define required info:
  - version, seed, run id, preset, steps, expected/actual, save file.

**Specs**
- `docs/BUG_REPORT.md`
- `docs/TRIAGE.md`

**Implementation details**
1. Create templates.
2. Add in-game “Copy debug info” button.

**Acceptance**
- A bug report contains enough info to reproduce 70%+ of the time.

**DoD**
- Templates linked from `README.md`.
