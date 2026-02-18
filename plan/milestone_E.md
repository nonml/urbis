# Milestone E — Polish + QA + Ship 1.0.0 (target: 1.0.0)

## Objective 🧼
Make it shippable:
- UX polish, stability, and performance
- Tutorial/onboarding
- Audio + feedback
- Packaging + versioning + release checklist

---

## 1.0.0 Exit Criteria (Acceptance)
- ✅ 0 critical bugs in checklist
- ✅ 30-minute MEGA soak test passes without memory/perf collapse
- ✅ Tutorial gets player to:
  - place buildings
  - handle one crisis
  - complete one minor case
  - start the main case
- ✅ Build has visible version `1.0.0` + seed/run id
- ✅ Save compatibility documented; migrations work

## DoD
- Release checklist executed and archived
- Patch notes prepared (CHANGELOG)

---

## Phases
1) UX & controls
2) Audio/feedback
3) Tutorial
4) QA + regression
5) Build/release

---

## Tickets

### E-01 — Settings menu (controls, graphics, audio)
**Phase:** 1 — UX & controls
**Objective:** Basic player options.

**Design**
- Settings: mouse sensitivity, invert Y, volume, render scale, toggles.

**Specs**
- `src/ui/settings.js`
- Persist in `localStorage` (not in save file).

**Implementation details**
1. Add `Settings` button to HUD + keybind (e.g., `Esc` opens menu).
2. Store settings in `localStorage` under `cityBuilderSettings`.
3. Wire up controls:
   - mouse sensitivity → camera
   - invert Y → camera pitch
   - volume sliders → `AudioManager`
4. Wire up graphics:
   - render scale / instancing toggles (safe defaults)
5. Add “Reset to defaults”.
**Acceptance**
- Player can change sensitivity and it applies immediately.

**DoD**
- Defaults sensible and documented.

---

### E-02 — Feedback polish (VFX + UI messaging)
**Phase:** 1 — UX & controls
**Objective:** Make actions readable and satisfying.

**Design**
- Place/build: highlight + sound + confirmation text
- Crisis: stinger + clear “what changed”
- Hack: progress ring + success/fail effect

**Specs**
- Keep VFX lightweight (simple sprites/billboards).

**Implementation details**
1. Add hover/placement highlight (tile/parcels) + build confirmation pulse.
2. Add small UI toast for resource delta (e.g., `+10 food`, `-5 gold`).
3. Crisis UI:
   - show “Before → After” preview for selected option
   - show result summary after pick
4. Hack feedback:
   - progress ring / bar
   - success/fail sound + particle (cheap sprite)
**Acceptance**
- Player understands consequences without reading logs.

**DoD**
- No performance regression.

---

### E-03 — Audio pass (minimum viable)
**Phase:** 2 — Audio/feedback
**Objective:** Atmosphere and usability.

**Design**
- Ambient loop per district theme
- Footsteps
- UI clicks and crisis stingers

**Specs**
- `assets/audio/*`
- `src/audio/audio_manager.js`

**Implementation details**
1. Implement `AudioManager` with:
   - master/music/sfx gain nodes
   - lazy load + cache of audio buffers
2. Add a minimal set of triggers:
   - footsteps (rate-limited)
   - UI click
   - build confirm
   - crisis stinger
3. Add district ambient selection (fallback to global ambient).
4. Add safe defaults and “mute all” toggle.
**Acceptance**
- Audio can be muted and doesn’t clip.

**DoD**
- Audio assets licensed/owned or placeholders noted.

---

### E-04 — Tutorial + first-time user flow
**Phase:** 3 — Tutorial
**Objective:** Teach the loop in 5 minutes.

**Design**
- Guided objectives with soft locks:
  1) move camera
  2) place a house
  3) place a job building
  4) handle a crisis
  5) hack a node
  6) open quest log and follow marker

**Specs**
- `src/sim/tutorial/tutorial.js`
- Tutorial uses quest engine under the hood (so it stays maintainable).

**Implementation details**
1. Implement a tutorial state machine:
   - steps with `start()`, `isComplete()`, `onComplete()`
2. Add HUD objective widget + “Next” hint.
3. Soft locks:
   - disable advanced tools until required step completes
   - spawn a guaranteed crisis at step 4 (deterministic)
4. Persist tutorial completion in `localStorage`.
5. Add a “Reset tutorial” button in settings.
**Acceptance**
- New player can reach “main case started” reliably.

**DoD**
- Tutorial can be skipped and never reappears unless reset.

---

### E-05 — QA + regression suite
**Phase:** 4 — QA + regression
**Objective:** Fewer surprises.

**Design**
- Maintain:
  - manual checklist
  - automated smoke test
  - 10 fixed balance seeds

**Specs**
- `docs/RELEASE_CHECKLIST.md`
- `docs/KNOWN_ISSUES.md`

**Implementation details**
1. Add `docs/RELEASE_CHECKLIST.md` if not already present; keep it executable.
2. Define 10 balance seeds in `docs/BALANCE_SEEDS.md`:
   - seed, preset, expected early-day economy range.
3. Extend smoke test:
   - run N ticks for each seed/preset
   - assert no NaNs, no negative resources, no runaway population.
4. Add MEGA soak procedure:
   - start seed, roam, place 100 buildings, save/load, monitor overlay.
**Acceptance**
- 30-min MEGA soak test passes on 2 machines (or 2 browsers).

**DoD**
- All critical bugs tracked with reproduction steps.

---

### E-06 — Build pipeline + version stamping + changelog
**Phase:** 5 — Build/release
**Objective:** Produce a consistent 1.0.0 artifact.

**Design**
- Add build step (recommended: Vite).
- Inject version string into UI + save meta.
- Maintain `CHANGELOG.md` (Keep a Changelog format).

**Specs**
- `package.json` scripts:
  - `dev`, `build`, `preview`
- Version in `src/version.js`.

**Implementation details**
1. Add Vite (or equivalent) build:
   - `npm i -D vite`
   - `npm run dev/build/preview`
2. Add `src/version.js` exporting `VERSION` + `BUILD_DATE`.
3. Inject version into UI (title bar + pause menu) and save meta.
4. Add `CHANGELOG.md` (Keep a Changelog format).
5. Add a release script `scripts/release.mjs` that:
   - bumps version, builds, zips dist, writes checksums.
**Acceptance**
- `build/` output runs offline and shows version.

**DoD**
- Release zip produced and validated with checklist.
