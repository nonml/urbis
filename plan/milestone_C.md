# Milestone C — Side-Stories / “Case Files” (target: 0.9.x)

## Objective 🕵️
Deliver Watch Dogs-like **unique side-story chains** that emerge from the sim:
- Data-driven quests (“case files”) generated per seed
- Storylets that branch based on city state + citizen relationships
- Breadcrumb gameplay: hack → clue → travel → confront → outcome
- Outcomes permanently modify districts/systems (replayability)

---

## Milestone Exit Criteria (Acceptance)
- ✅ Each new run generates at least **1 main Case File** + several minor cases
- ✅ Cases are followable via Quest Log + waypoint markers
- ✅ Player actions branch outcomes and change city modifiers
- ✅ Save/load preserves quest progress and outcomes

## DoD for Milestone C
- At least 15 storylets implemented and reused across cases
- No dead-end quests (every case resolves or fails gracefully)
- Debug tools exist to force-trigger cases

---

## Phases
1) **Quest system foundation**
2) **Storylet library**
3) **Case File generator**
4) **UI + Debugging**
5) **Persistence**

---

## Tickets

### C-01 — Quest content format + loader
**Phase:** 1 — Quest system foundation
**Objective:** Quests authored as data, not code.

**Design**
- Store quests/storylets as JSON in `src/content/quests/`.
- Load at startup, validate schema.

**Specs**
- Folder:
  - `src/content/quests/*.json`
- Minimal schema:
```json
{
  "id": "case_missing_person",
  "type": "casefile",
  "tags": ["missing", "cctv", "district_residential"],
  "steps": [
    { "id": "start", "kind": "trigger", "trigger": "ANOMALY_MISSING_PERSON" },
    { "id": "clue1", "kind": "hack_node", "nodeType": "CCTV", "onComplete": ["spawn_clue:cctv_clip"] },
    { "id": "travel", "kind": "go_to", "marker": "last_seen" },
    { "id": "resolve", "kind": "choice", "choices": [...] }
  ]
}
```

**Implementation details**
1. Implement loader in `src/content/loader.js`.
2. Validate required fields and log errors clearly.

**Acceptance**
- Game boots even if one quest file is invalid (skips invalid with warning).

**DoD**
- Schema documented in `docs/QUEST_SCHEMA.md`.

---

### C-02 — Quest runtime engine
**Phase:** 1 — Quest system foundation
**Objective:** Execute quests step-by-step, event-driven.

**Design**
- Event bus emits events:
  - `PLAYER_HACKED_NODE`, `PLAYER_ENTERED_DISTRICT`, `CRISIS_STARTED`, etc.
- Quest engine listens and advances steps.

**Specs**
- `src/sim/events.js` (simple pub/sub)
- `src/sim/quests/quest_engine.js`
- Quest state stored in:
  - `state.quests.active[]`
  - `state.quests.completed[]`

**Implementation details**
1. Implement event bus.
2. Implement step handlers per `kind`.
3. Add safe fallback: if step cannot complete, mark quest “blocked” with reason.

**Acceptance**
- A test quest advances from start → clue → travel → resolve.

**DoD**
- Engine does not hard-crash on malformed content; errors are surfaced in dev overlay.

---

### C-03 — Quest Log UI + waypoint markers
**Phase:** 4 — UI + Debugging
**Objective:** Player can follow story without guessing.

**Design**
- Quest log panel: `J`
- Shows:
  - active case files
  - current objective text
  - distance to marker
- World marker (billboard) + minimap icon.

**Specs**
- `src/ui/quest_log.js`
- `src/render/markers.js` (or integrate into renderer3d)

**Implementation details**
1. Add UI panel with list and selection.
2. Add one “current objective” marker in-world.

**Acceptance**
- Player can complete a case file without external instructions.

**DoD**
- UI scales for MEGA (search/filter optional).

---

### C-04 — Breadcrumb objects (clues) and evidence board
**Phase:** 4 — UI + Debugging
**Objective:** Make cases feel investigative.

**Design**
- Clues are world objects spawned by quests:
  - CCTV clip, phone dump, witness, hidden cache
- Evidence board (UI) shows discovered clues and connections.

**Specs**
- `state.cases.evidence[]`:
```js
{ id, caseId, type, title, description, source, discoveredTick }
```

**Implementation details**
1. Add clue spawn + pickup interaction.
2. Add “Evidence Board” UI screen.

**Acceptance**
- Completing hacks yields tangible clue items that persist.

**DoD**
- Evidence survives save/load.

---

### C-05 — Storylet library (modular narrative blocks)
**Phase:** 2 — Storylet library
**Objective:** Reuse narrative pieces to create variety per run.

**Design**
- Storylet = small quest fragment with tags + requirements:
  - requires: district theme, citizen trait, crisis type, etc.
- Generator picks storylets to build a case.

**Specs**
- `src/content/storylets/*.json`
- Fields:
  - `tags`, `requires`, `provides`, `weight`

**Implementation details**
1. Build storylet selector:
  - filter by requires
  - weighted pick with RNG
2. Add at least 15 storylets:
  - corruption, missing, gang, whistleblower, sabotage, coverup

**Acceptance**
- Two runs with different seeds produce different storylet chains.

**DoD**
- No storylet causes unwinnable chain (must have exits).

---

### C-06 — Case File generator (per run)
**Phase:** 3 — Case File generator
**Objective:** Auto-create a “main case” and several minors.

**Design**
- At game start:
  - choose 1 “main arc” template
  - fill roles with actual citizens, buildings, districts
- During play:
  - crises/anomalies spawn minor cases.

**Specs**
- `src/sim/cases/case_generator.js`
- Inputs:
  - districts, citizens, buildings, current pressures
- Outputs:
  - runtime quest instances with bound entities

**Implementation details**
1. Build entity selection helpers:
  - pick citizen by trait/job/district
  - pick location building in district
2. Instantiate quest with concrete ids and marker positions.

**Acceptance**
- “Main case file” always exists by minute 2 of a new run.

**DoD**
- Generator never fails silently; if it can’t build a case, it logs why and retries with fallback.

---

### C-07 — Consequence system (district modifiers, factions, heat)
**Phase:** 5 — Persistence
**Objective:** Outcomes matter and replay differs.

**Design**
- Case outcomes apply modifiers:
  - district: `crime +10%`, `income +5%`, etc.
  - factions: reputation shifts
  - heat: increases rival pressure (feeds Milestone D)

**Specs**
- `state.factions[]`
- `state.map.districts[i].modifiers[]`
- `applyOutcome(outcomeId, context)` pure function.

**Implementation details**
1. Add outcome definitions in `src/content/outcomes.json`.
2. Apply outcomes from quest resolve steps.

**Acceptance**
- UI shows district modifier changes after case resolution.

**DoD**
- Outcomes are reversible only if explicitly designed (no hidden coupling).

---

### C-08 — Debug tools for story + quest testing
**Phase:** 4 — UI + Debugging
**Objective:** Avoid slow iteration.

**Design**
- Dev menu (toggle in overlay):
  - spawn main case
  - spawn random minor case
  - complete current step (for testing)
  - teleport to marker

**Specs**
- `src/dev/dev_menu.js`

**Implementation details**
1. Add a dev-only toggle (e.g., `F4`) to open/close the menu.
2. UI: minimal HTML overlay listing actions + hotkeys.
3. Hook into quest runtime:
   - `forceStartMainCase()`
   - `spawnMinorCase()`
   - `completeCurrentStep()` (skips validations only in dev mode)
   - `teleportToCurrentMarker()`
4. Ensure each action logs what it did (quest id, step id, marker id).
**Acceptance**
- Junior dev can test a quest chain in under 2 minutes.

**DoD**
- Dev tools disabled by default in “release build” flag.
