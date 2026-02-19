# Milestone P — Developer Tooling + Content Pipeline (for scaling to 1.0) (target: 0.34.x)

## Objective 🎯
- Add internal tools so juniors can build content fast without breaking systems.
- Standardize asset pipeline, validation, and debug utilities.
- Prepare for larger content volume (quests, ops, policies, districts).

---

## Milestone Exit Criteria (Acceptance)
- ✅ Dev console/menu supports spawning incidents, toggling overlays, teleporting, fast-forwarding.
- ✅ Content validation runs on build and catches broken references.
- ✅ Asset folder structure exists and is referenced consistently.
- ✅ A 'content authoring guide' exists with examples.


## Definition of Done (DoD)
- Tools are gated behind a dev flag and off by default in release builds.
- All tooling is deterministic-safe (no random side effects unless using RNG).
- Tooling does not ship heavy debug UIs into production bundle.


---

## Phases
1) Dev tools
2) Validation + scripts
3) Asset pipeline
4) Authoring docs


---

## Tickets

### P-01 — Dev menu/console v2 (fast-forward, teleport, spawn)
**Objective:** Reduce iteration time from minutes to seconds.

**Design**
- Dev menu toggled by `F1` (only in dev builds).
- Actions: teleport to marker, spawn incident, trigger main case, grant resources, simulate days.


**Specs**
- `src/dev/dev_menu.js`
- `state.dev = { enabled }`
- Build flag: `__DEV__` injected by bundler


**Implementation details**
1. Implement menu with buttons and keybinds.
2. Wire to safe APIs in systems (no direct state mutation from UI).
3. Add 'seed reseed' option only for new runs (not mid-run).


**Acceptance**
- A dev can reach any district and trigger a crisis in < 30 seconds.
- Fast-forward does not desync state.


**DoD**
- Dev menu removed/hidden in production build.


---

### P-02 — Content validation + CI-lite scripts
**Objective:** Prevent content-driven crashes.

**Design**
- Validation checks all content JSON for schema + references.
- Optional: a lightweight Git hook or npm script for pre-commit.


**Specs**
- `scripts/validate_content.mjs` (expand from Milestone N)
- `scripts/check_no_math_random.mjs`
- NPM scripts: `validate`, `lint:basic`


**Implementation details**
1. Add validators for all content types: quests, campaigns, ops, policies, unlocks, factions.
2. Add 'no Math.random' scan for src/.
3. Document scripts in `docs/CONTRIBUTING.md`.


**Acceptance**
- Broken references fail validation with actionable output.
- Validators run in < 2 seconds.


**DoD**
- Scripts work on Windows and macOS (path-safe).


---

### P-03 — In-game placement tools for landmarks/nodes (authoring helper)
**Objective:** Make world authoring possible without external editors.

**Design**
- Dev tool: place landmark, intel source, quest marker and export JSON.
- Export includes coordinates and district id.


**Specs**
- `src/dev/placement_tool.js`
- Exports to clipboard or downloads JSON file.


**Implementation details**
1. Add placement mode with snapping and preview.
2. Collect placed objects into list and export.
3. Add import ability to load a pack into the run (dev only).


**Acceptance**
- A junior can create a small landmark pack in 5 minutes.
- Exported JSON validates with scripts.


**DoD**
- Placement tool does not ship in release builds.


---

### P-04 — Asset pipeline + folder conventions (audio, textures, models)
**Objective:** Stop ad-hoc asset placement and broken paths.

**Design**
- Standard folders: `assets/audio`, `assets/textures`, `assets/models`, `assets/ui`.
- Asset manifest maps ids to paths and metadata.


**Specs**
- `assets/manifest.json`
- `src/assets/assets.js` loader
- Docs: `docs/ASSETS.md`


**Implementation details**
1. Create asset manifest and loader helper.
2. Refactor audio manager to use manifest ids.
3. Add placeholders and mark licensing status.


**Acceptance**
- No hard-coded asset paths in gameplay code.
- Missing asset results in graceful fallback.


**DoD**
- Manifest validated by scripts.


---

### P-05 — Localization-ready text system (minimal)
**Objective:** Prevent hard-coded strings from blocking later shipping.

**Design**
- Simple `t(key, params)` function with English table.
- UI strings and quest text can reference keys or raw text (transition plan).


**Specs**
- `src/i18n/i18n.js`
- `assets/i18n/en.json`


**Implementation details**
1. Implement i18n table loader.
2. Replace core UI labels with keys (top 50 strings).
3. Add guideline for content authors.


**Acceptance**
- Switching language (even if only EN exists) doesn’t break UI.
- Missing keys fall back with visible marker in dev.


**DoD**
- No runtime exceptions from missing i18n keys.


---
