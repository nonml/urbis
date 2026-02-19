# Milestone L — Factions + Politics + Policy System (target: 0.26.x)

## Objective 🎯
- Add factional pressure (gangs, unions, corporations, reformists).
- Introduce policies/laws as macro levers with tradeoffs.
- Tie influence operations to real political outcomes (appointments, crackdowns, reforms).

---

## Milestone Exit Criteria (Acceptance)
- ✅ At least 4 factions exist with goals, territory/interest areas, and reputation with player.
- ✅ Policies can be enacted at city-wide or district level and have measurable effects.
- ✅ Key roles exist (Mayor/Police Chief/Union Leader) and can change via events/ops.
- ✅ Rival AI uses factions/policies to counter player strategies.


## Definition of Done (DoD)
- Faction interactions are surfaced in UI (no hidden wars).
- Policy effects are reversible only when explicitly designed.
- Save/load preserves faction state and policy history.


---

## Phases
1) Faction model
2) Policies and roles
3) Territory/pressure
4) UI + integration with rival


---

## Tickets

### L-01 — Faction system core (state + goals + reputation)
**Objective:** Create a consistent framework for social conflict.

**Design**
- Faction fields: `id, name, archetype, rep, power, agendaTags`.
- Faction generates 'demands' when conditions met (events).


**Specs**
- `state.factions[]`
- `src/sim/factions/faction_system.js`
- `src/content/factions.json`


**Implementation details**
1. Define 4 factions: Syndicate, Reformists, Union, Corporate.
2. Implement rep changes from events/ops/cases.
3. Add faction screen UI (hotkey `F`).


**Acceptance**
- Player can see faction reps and recent changes.
- Factions generate at least one demand per run on City.


**DoD**
- Rep range and thresholds documented + tested.


---

### L-02 — Policy/law system (city + district scope)
**Objective:** Provide macro knobs that shape the sim and story.

**Design**
- Policies have: scope, cost/upkeep, prerequisites, effects, cooldown.
- Tradeoffs explicit in UI before enactment.


**Specs**
- `src/content/policies.json`
- `src/sim/policies/policy_engine.js`
- `state.policies = { active[], history[] }`


**Implementation details**
1. Implement policy engine and UI.
2. Add baseline policies: curfew, surveillance expansion, welfare boost, tax incentives, anti-corruption unit.
3. Apply effects to demand/crime/sentiment/service costs.


**Acceptance**
- Enacting a policy changes at least 2 subsystems measurably.
- Policies persist across save/load.


**DoD**
- All policies are data-driven (no hard-coded special cases).


---

### L-03 — Key roles & appointments (Mayor/Chief/Union)
**Objective:** Make politics tangible and story-worthy.

**Design**
- Roles are NPCs with traits and faction ties.
- Appointments affect city modifiers (e.g., strict chief reduces crime but increases unrest).


**Specs**
- `state.roles = { mayorId, policeChiefId, unionLeaderId }`
- `src/sim/politics/roles.js`


**Implementation details**
1. Generate role holders from citizen pool or special NPCs.
2. Add events/ops to replace or influence role holders.
3. Expose role screen with current modifiers.


**Acceptance**
- Changing police chief changes crime resolution and public sentiment.
- Role changes are logged and visible in news feed.


**DoD**
- Role effects are deterministic and reversible only by role change.


---

### L-04 — Territory/pressure mapping (district influence)
**Objective:** Make factions spatial and legible.

**Design**
- Each district tracks faction influence weights.
- Influence changes from crime incidents, operations, and policies.


**Specs**
- `state.map.districts[i].factionInfluence{}`
- `src/sim/factions/territory.js`
- Overlay: show dominant faction per district


**Implementation details**
1. Initialize influence from district archetype/seed.
2. Update influence on events.
3. Add overlay and district tooltip: dominant faction + trend.


**Acceptance**
- At least one district can switch dominant faction in a run.
- Overlay matches underlying influence values.


**DoD**
- Influence updates are capped and stable (no oscillation).


---

### L-05 — Rival AI integration with factions/policies
**Objective:** Make the rival feel like an actor in the same systems.

**Design**
- Rival chooses actions to shift faction influence and pass counter-policies.
- Rival telegraphs intentions through leaks/news.


**Specs**
- Extend `src/sim/rival/rival_ai.js`
- Rival actions include: fund faction, pressure role, policy campaign


**Implementation details**
1. Add new rival action types and utilities.
2. Add counterplay hooks (player can respond with ops/policies).
3. Log rival intent and outcomes.


**Acceptance**
- Rival can meaningfully shift a district’s faction influence.
- Player can counter within a reasonable cost.


**DoD**
- No unstoppable snowball: add diminishing returns and cooldowns.


---
