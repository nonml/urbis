# Milestone F — Post‑Launch 1.1.0: Content + QoL + Stability

## Objective 🧩
Expand the shipped 1.0 loop without destabilizing it:
- More “stuff to do” (minor cases + hack activities)
- QoL + accessibility + controller support
- More simulation variety (new crises + modifiers)
- MEGA performance + memory tightening
- Repeatable hotfix workflow (so juniors can ship patches safely)

---

## Exit Criteria (Acceptance)
- ✅ At least **20 new minor cases** (data-driven) ship with 1.1.0
- ✅ At least **3 new hack activity types** ship
- ✅ Accessibility baseline:
  - remappable keys
  - hold/toggle options for sprint/interact
  - colorblind-safe UI contrasts (minimum AA-ish, practical)
- ✅ MEGA city: 45-minute soak test has no steady memory growth
- ✅ Patch workflow documented and followed end-to-end once (dry run)

## DoD
- Patch notes written and verified against changes
- Version shows `1.1.0` and save migrations still pass
- All new content uses the content pipeline (no hard-coded quest chains)

---

## Phases
1) **QoL + Accessibility**
2) **Content pack (cases + activities)**
3) **Systems variety (crises/modifiers)**
4) **Perf + patch workflow**

---

## Tickets

### F-01 — Input remap + controller baseline
**Phase:** 1 — QoL + Accessibility
**Objective:** Make controls usable across keyboard/mouse and controller.

**Design**
- Add an input layer that maps “actions” to keys/buttons:
  - `move, sprint, interact, build, rotateCamera, pause, openMap, openQuestLog`
- Support:
  - keyboard remap UI
  - gamepad mapping defaults (Xbox layout)

**Specs**
- Files:
  - `src/input/input_manager.js`
  - `src/ui/input_settings.js`
- Config stored in `localStorage` (`cityBuilderInput`).

**Implementation details**
1. Create action map with default bindings.
2. Implement polling for gamepads (`navigator.getGamepads()`).
3. Add UI to rebind keys with conflict warnings.
4. Add “restore defaults”.

**Acceptance**
- Player can fully play tutorial with only controller.

**DoD**
- No hard-coded key checks remain outside the input manager.

---

### F-02 — Accessibility + readability pass
**Phase:** 1 — QoL + Accessibility
**Objective:** Reduce friction and improve readability.

**Design**
- Add options:
  - UI scale (90–140%)
  - subtitle toggle (for audio cues)
  - reduce camera shake / motion
- Improve HUD contrast and focus states.

**Specs**
- `src/ui/settings.js` extended
- `src/ui/theme.css` (or consolidated styles) for contrast tokens.

**Implementation details**
1. Add CSS variables for UI scale and apply to HUD root.
2. Add “high contrast” mode toggle that switches tokens.
3. Add focus outlines for keyboard navigation.

**Acceptance**
- UI scale changes apply immediately and persist.

**DoD**
- Settings menu remains responsive on small screens.

---

### F-03 — New hack activities (3 types)
**Phase:** 2 — Content pack (cases + activities)
**Objective:** Make exploration feel less repetitive.

**Design**
- Add 3 activity archetypes:
  1) **Signal Trace:** follow moving beacon through streets
  2) **Camera Hijack:** solve a simple “line of sight” puzzle (rotate cameras)
  3) **Data Cache:** timed “hold zone” while NPCs approach

**Specs**
- `src/sim/activities/activity_manager.js`
- Each activity is data-driven with:
  - `id, type, districtBias, rewards, failPenalty`

**Implementation details**
1. Implement activity manager spawning per district bias.
2. Add minimal UI prompt + progress display.
3. Rewards feed into resources / modifiers / quest triggers.

**Acceptance**
- At least one activity spawns within 2 minutes in MEGA run.

**DoD**
- Activity completion is saved/loaded correctly.

---

### F-04 — Minor case pack #1 (20 cases)
**Phase:** 2 — Content pack (cases + activities)
**Objective:** Increase story variety for replayability.

**Design**
- Add 20 minor cases built from existing storylets:
  - 5 crime, 5 corporate, 5 personal drama, 5 “urban legend”
- Ensure each case has:
  - clear start, 2–4 steps, resolution, consequence.

**Specs**
- Content:
  - `src/content/cases/minor_pack_01.json`
  - `src/content/storylets/storylets_pack_01.json`
- Add validation rules:
  - no missing step ids
  - no unreachable branches

**Implementation details**
1. Author cases using the existing quest format.
2. Add a validator script `scripts/validate_content.mjs`.
3. Add 3 “seed showcase” runs for QA.

**Acceptance**
- Fresh run generates ≥ 5 minor cases in first 10 in-game days.

**DoD**
- Validator runs in CI (or at least documented pre-commit step).

---

### F-05 — Crisis variety pack + modifiers
**Phase:** 3 — Systems variety (crises/modifiers)
**Objective:** Make cities feel different run-to-run.

**Design**
- Add:
  - 3 new crisis types (e.g., blackout, strike, cyberattack)
  - 6 new district modifiers (e.g., “high crime”, “wealthy donors”)
- Crisis outcomes can apply/remove modifiers.

**Specs**
- `src/content/crises.json`
- `src/content/modifiers.json`
- Modifier application is pure and reversible by id.

**Implementation details**
1. Extend crisis director to choose from data.
2. Add UI panel to inspect current modifiers.
3. Add deterministic weighting using RNG.

**Acceptance**
- By day 30, at least 2 modifiers exist in most runs.

**DoD**
- Modifiers never silently stack duplicates.

---

### F-06 — MEGA perf + memory tightening
**Phase:** 4 — Perf + patch workflow
**Objective:** Prevent post-launch performance regressions.

**Design**
- Profile and tighten:
  - instancing rebuilds
  - minimap redraw frequency
  - quest marker updates
- Add a simple memory watchdog (dev only).

**Specs**
- `src/dev/perf_overlay.js` extended:
  - heap estimate (if available)
  - instance counts by chunk

**Implementation details**
1. Add throttles/debounces for UI update loops.
2. Ensure minimap only redraws on map changes.
3. Add “leak check” checklist step.

**Acceptance**
- 45-min MEGA soak shows stable FPS trend and no monotonic memory growth.

**DoD**
- Perf budgets updated in docs.

---

### F-07 — Balance pass + 10 reference seeds update
**Phase:** 4 — Perf + patch workflow
**Objective:** Keep economy and difficulty in a sane range after new content.

**Design**
- Update balance seeds and expected ranges:
  - day 10 resources
  - population growth
  - crisis frequency under normal play

**Specs**
- `docs/BALANCE_SEEDS.md`
- `docs/BALANCE_EXPECTATIONS.md`

**Implementation details**
1. Run 10 reference seeds on Small/City/MEGA.
2. Record metrics and adjust constants/content weights.
3. Update docs and re-run validation.

**Acceptance**
- No seed is “unwinnable” by day 30 under Normal difficulty.

**DoD**
- Balance changes are logged in changelog.

---

### F-08 — Patch/hotfix workflow (dry run)
**Phase:** 4 — Perf + patch workflow
**Objective:** Juniors can ship hotfixes without breaking release discipline.

**Design**
- Define branches:
  - `main` (release), `dev`, `hotfix/x.y.z`
- Define steps:
  - reproduce, fix, test checklist, build, tag, changelog, release zip

**Specs**
- `docs/HOTFIX_PLAYBOOK.md`
- Template for “hotfix PR description”.

**Implementation details**
1. Write playbook and run one simulated hotfix (no functional changes).
2. Ensure version bump workflow is documented.
3. Add “backport to dev” step.

**Acceptance**
- A junior can follow playbook to produce a zip and changelog entry.

**DoD**
- Playbook reviewed and stored with the release artifacts.