# Milestone G — 1.2.0: Modding + Creator Tools + Sharing

## Objective 🛠️
Let players (and juniors) add content safely:
- Data-driven content registry (buildings, storylets, cases, modifiers)
- Mod loader with manifests + versioning
- Creator tools (validator + lightweight editor)
- Shareable “Run Codes” (seed + preset + enabled mods)

---

## Exit Criteria (Acceptance)
- ✅ Mods can be loaded from a `mods/` folder with a manifest
- ✅ Two sample mods ship:
  - “New Buildings Pack”
  - “Storylets Pack”
- ✅ Content validation runs and blocks bad mods with actionable errors
- ✅ Run Code export/import works and reproduces the run reliably

## DoD
- Mods are sandboxed to data (no arbitrary JS execution in 1.2.0)
- Mod compatibility rules documented (load order, overrides)
- Save includes enabled mod list and rejects incompatible loads gracefully

---

## Phases
1) **Content registry + override rules**
2) **Mod loader + validation**
3) **Creator tools**
4) **Sharing + compatibility**

---

## Tickets

### G-01 — Content registry + override semantics
**Phase:** 1 — Content registry + override rules
**Objective:** Make all content discoverable and overrideable.

**Design**
- Add registry that loads base content first, then applies mod overlays.
- Override rules:
  - same `id` replaces (with warning)
  - arrays merge by id (configurable)
  - missing refs cause validator errors

**Specs**
- `src/content/registry.js`
- Registry outputs:
  - `content.buildings`, `content.storylets`, `content.cases`, `content.modifiers`, `content.crises`

**Implementation details**
1. Define schemas (minimal JSON schema-like checks).
2. Load base packs from `src/content/**`.
3. Provide `registry.get(type, id)` and `registry.list(type)`.

**Acceptance**
- Game can run purely from registry content without hard-coded lookups.

**DoD**
- Registry logs clearly what was loaded and overridden (dev only).

---

### G-02 — Mod manifest format + folder loader
**Phase:** 2 — Mod loader + validation
**Objective:** Load mods predictably from disk (local).

**Design**
- `mods/<modId>/manifest.json`:
  - `id, name, version, gameVersionRange, loadOrder, contentPaths[]`
- Loader reads manifests and loads JSON packs.

**Specs**
- `src/mods/mod_loader.js`
- Mods are enabled/disabled via settings UI; saved to `localStorage`.

**Implementation details**
1. Implement mod discovery (list known folders; for web, use file picker / drag-drop zip).
2. Parse manifests, sort by `loadOrder`.
3. Feed content into registry overlays.

**Acceptance**
- Disabling a mod removes its content on next new run.

**DoD**
- Loader errors never crash the game; they show a clear UI message.

---

### G-03 — Content validator (hard gate)
**Phase:** 2 — Mod loader + validation
**Objective:** Catch broken content before runtime.

**Design**
- Validator checks:
  - required fields
  - referenced ids exist (storylet → outcome, case → steps)
  - no cycles in required quest steps (unless explicitly allowed)

**Specs**
- `scripts/validate_content.mjs`
- Output:
  - human-readable errors + machine-readable JSON report.

**Implementation details**
1. Implement schema checks per content type.
2. Implement reference resolver to detect missing ids.
3. Integrate validator into build step or pre-run check.

**Acceptance**
- A bad mod yields a list of actionable errors with file/line context (best effort).

**DoD**
- Validator runs in under 2 seconds for typical packs.

---

### G-04 — Lightweight story/case editor (dev tool)
**Phase:** 3 — Creator tools
**Objective:** Speed up authoring for juniors and modders.

**Design**
- Minimal in-browser editor:
  - create/edit storylets + cases
  - preview step graph
  - “simulate outcome” using mock city state

**Specs**
- `src/dev/content_editor.js`
- Saves JSON to disk via download (web limitations).

**Implementation details**
1. Build a simple UI with forms + JSON preview.
2. Provide “Validate” button that runs the validator logic in-browser.
3. Provide “Export pack” button.

**Acceptance**
- Junior can create a new minor case in under 15 minutes.

**DoD**
- Editor is dev-only and does not ship in release builds by default.

---

### G-05 — Run Code export/import (seed + preset + mods)
**Phase:** 4 — Sharing + compatibility
**Objective:** Share reproducible runs.

**Design**
- Run Code includes:
  - seed
  - map preset
  - difficulty
  - enabled mods + versions
- Encode as base64 JSON (short enough to copy/paste).

**Specs**
- `src/share/run_code.js`
- UI:
  - “Copy Run Code”
  - “Paste Run Code”

**Implementation details**
1. Add serializer/deserializer with validation.
2. Add UI prompts and clipboard integration.
3. On import, warn if required mods missing or version mismatch.

**Acceptance**
- Importing a Run Code recreates the same city generation.

**DoD**
- Invalid codes fail gracefully with helpful error messages.

---

### G-06 — Mod compatibility in saves
**Phase:** 4 — Sharing + compatibility
**Objective:** Prevent corrupted saves.

**Design**
- Save meta includes:
  - enabled mods list + versions
  - content pack hashes (optional)
- On load:
  - if mismatch → warn and block, or offer “attempt load” in dev.

**Specs**
- `src/save/save.js` extended
- `schemaVersion` bump + migration for old saves.

**Implementation details**
1. Add mod metadata to save payload.
2. Add compatibility check + UI prompt.
3. Implement migration path for pre-mod saves.

**Acceptance**
- Loading a save with missing mods does not crash and provides a clear prompt.

**DoD**
- Save version bump documented in changelog.

---

### G-07 — Sample mods + documentation
**Phase:** 3 — Creator tools
**Objective:** Ship examples that juniors can learn from.

**Design**
- Provide:
  - buildings pack with 3 new buildings
  - storylets pack with 10 new storylets

**Specs**
- `mods/sample_buildings/`
- `mods/sample_storylets/`
- `docs/MODDING.md`

**Implementation details**
1. Author packs using the manifest format.
2. Document load order and override rules.
3. Add “mod troubleshooting” section.

**Acceptance**
- Samples load without errors and appear in a new run.

**DoD**
- Docs include a step-by-step “make your first mod”.

---

### G-08 — Release gating for mods
**Phase:** 2 — Mod loader + validation
**Objective:** Avoid shipping a broken mod pipeline.

**Design**
- Add a checklist section:
  - validate base content
  - validate sample mods
  - run 5 reference seeds with mods enabled

**Specs**
- `docs/RELEASE_CHECKLIST.md` extended with “Modding” section.

**Implementation details**
1. Update checklist.
2. Run it once and store results in `qa_runs/`.

**Acceptance**
- Release checklist contains an explicit “Mods OK” gate.

**DoD**
- Failures are reproducible and tracked as tickets.