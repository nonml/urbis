# Milestone N — Campaign Structure + Case File Expansion (target: 0.30.x)

## Objective 🎯
- Turn the quest system into a real campaign: chapters, branching, and run-defining arcs.
- Expand story content without writing bespoke scripts per seed.
- Make the city feel narratively reactive (news feed, faction reactions).

---

## Milestone Exit Criteria (Acceptance)
- ✅ Each run generates 1 main arc with 3–5 chapters and at least 5 minor cases.
- ✅ Branching outcomes meaningfully change rival/factions/district modifiers.
- ✅ Quest UI supports chapter progression and shows consequences clearly.
- ✅ Story content is validated and can be extended by juniors safely.


## Definition of Done (DoD)
- No dead-end main arc (always resolves or fails with clear state).
- Content validation scripts catch missing ids and broken references.
- Save/load correctly restores quest engine state mid-chapter.


---

## Phases
1) Campaign model
2) Case generator upgrade
3) Reactive presentation (news/briefings)
4) Validation + tooling


---

## Tickets

### N-01 — Campaign model (chapters, gates, branching)
**Objective:** Define the structure of the 'main thread' per run.

**Design**
- Campaign = ordered chapter nodes with gates (conditions).
- Branch picks next chapter based on outcomes/tags.


**Specs**
- `src/content/campaigns/*.json`
- `state.campaign = { id, chapterId, flags{}, history[] }`
- `src/sim/quests/campaign_engine.js`


**Implementation details**
1. Define 2 campaign templates (corruption scandal, missing person network).
2. Implement gates and branching selection.
3. Add campaign screen (briefing) at run start and between chapters.


**Acceptance**
- A run consistently progresses through chapters when objectives completed.
- Branch selection is deterministic from seed + choices.


**DoD**
- Campaign engine shares event bus with quest engine (no duplicate logic).


---

### N-02 — Case generator v2 (district-aware + social-graph-aware)
**Objective:** Make cases feel tied to the city that was generated.

**Design**
- Case selection weights by district tags (industrial, waterfront) and active faction influence.
- Case targets pick from social graph (suspect is connected to victim).


**Specs**
- `src/sim/quests/case_generator.js`
- Storylet tags: `district:*`, `faction:*`, `relationship:*`


**Implementation details**
1. Add tag matcher and weighted selection for storylets.
2. Pick targets using social graph edges and constraints.
3. Generate breadcrumbs: locations, sources, witnesses.


**Acceptance**
- Same seed generates the same case set; different seeds produce meaningfully different cases.
- At least 50% of cases reference a real district modifier or faction influence.


**DoD**
- Generator has fallback paths if constraints can’t be satisfied.


---

### N-03 — Dialogue + choice presentation v1 (lightweight)
**Objective:** Make story steps readable and dramatic without heavy tooling.

**Design**
- Dialogue is simple text cards with choices and consequences summary.
- Choices apply effects via shared outcome system.


**Specs**
- `src/ui/dialogue_modal.js`
- `src/content/dialogue/*.json` (optional)
- Quest steps can reference `dialogueId`


**Implementation details**
1. Implement modal with speaker, body, and choice buttons.
2. Wire choices to quest engine and outcome application.
3. Add 'recent decisions' panel for recap.


**Acceptance**
- Player can complete a story step purely via dialogue choices.
- Outcomes show immediate and long-term effects.


**DoD**
- Modal is keyboard-navigable (accessibility baseline).


---

### N-04 — News feed + briefing system (reactive narrative UI)
**Objective:** Connect simulation events to story tone (Watch Dogs style).

**Design**
- News items generated from: crises, ops, faction shifts, campaign steps.
- Briefing screen highlights 'what changed' every chapter.


**Specs**
- `state.news.items[]` capped
- `src/ui/news_feed.js` (if not already)
- `src/ui/briefing_screen.js`


**Implementation details**
1. Add news item templates and event hooks.
2. Add briefing screen that summarizes last 5 key events and current goals.
3. Allow pinning a news item as investigation lead.


**Acceptance**
- Major events create readable headlines and summaries.
- Player can trace why sentiment or faction power changed.


**DoD**
- News feed items include the run id + tick for debugging.


---

### N-05 — Content validation scripts (quests/campaigns/ops)
**Objective:** Let juniors add content safely without breaking the build.

**Design**
- Validation checks: duplicate ids, missing references, invalid tags, unreachable chapters.
- Fail build (or warn) depending on mode.


**Specs**
- `scripts/validate_content.mjs`
- Docs: `docs/CONTENT_AUTHORING.md`


**Implementation details**
1. Implement validators for JSON schemas and references.
2. Add npm script `npm run validate` and run in CI (optional).
3. Document common mistakes and examples.


**Acceptance**
- A broken content file is flagged with a clear error message and path.
- Game can skip invalid content in dev mode without crashing.


**DoD**
- Validation runs in under 1 second for typical content size.


---
