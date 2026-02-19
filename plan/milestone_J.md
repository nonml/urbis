# Milestone J: Factions + reputation + world rules

## Objective
Make the city feel reactive: gangs, police, corps, and citizens respond to your actions and hacks.

## Exit criteria (acceptance for milestone)
- Faction rep meter exists for at least 4 factions.
- Rep changes from hacks, quests, and city conditions.
- Rep unlocks content (buildings, hacks, safehouses) and also causes hostility.
- World rules based on rep affect police/gang behavior.

## Phases
- J1: Faction model + rep math
- J2: Rep-driven unlocks and hostility
- J3: UI + tuning

## Tickets

## Ticket J-1: Faction registry + reputation tracking
- **Phase:** J1
- **Depends on:** G-3, H-3

### Objective
Centralize faction definitions and make rep deterministic and auditable.

### Design
Faction defs in content json. Rep is -100..100 with named bands (hostile, wary, neutral, friendly, allied).

### Specs
- Factions: citizens, police, gangs, corp.
- Rep delta sources include: hack loudness, quest outcomes, service coverage.
- Decay/growth optional; keep simple for now.

### Implementation details
- Add `src/sim/factions/faction_system.js`.
- Expose `modifyRep(factionId, delta, reason)` that logs last 20 changes.
- Persist rep in `state.factions.reputation`.

### Acceptance
- Rep changes show in UI with reason.
- Save/load preserves rep.

### DoD (Definition of Done)
- No uncapped values; always clamp.
- Unit test: rep band transitions.

### QA checklist
- Do loud hacks; police rep decreases.
- Help citizens via quest; citizen rep increases.

## Ticket J-2: Unlocks + hostility rules
- **Phase:** J2
- **Depends on:** J-1

### Objective
Make rep matter in gameplay loops.

### Design
Friendly factions unlock perks; hostile factions trigger encounters/events (police patrols, gang ambush).

### Specs
- Unlock examples: police-friendly -> reduced heat decay penalty; corp-friendly -> better wages; gang-friendly -> black market items.
- Hostility triggers above thresholds: police rep < -40 causes faster pursuit; gangs rep < -40 causes street threats.

### Implementation details
- Add `src/sim/factions/perks.js` mapping rep band -> modifiers.
- Integrate perks into heat system and economy.
- Add encounter spawner stub (fully used later in chase milestone).

### Acceptance
- Changing rep changes at least 2 systems (heat/economy).
- Hostile rep triggers visible changes in world within 5 minutes.

### DoD (Definition of Done)
- Perks are data-driven.
- No circular dependencies (perks read-only modifiers).

### QA checklist
- Set police rep negative via dev menu; verify heat grows faster.
- Set gang rep negative; verify encounter notifications.

## Ticket J-3: Faction UI + tuning tools
- **Phase:** J3
- **Depends on:** J-2

### Objective
Give juniors knobs for balancing without code edits.

### Design
Faction panel in HUD showing reps, bands, and recent changes. Dev sliders to adjust deltas multipliers.

### Specs
- HUD: small rep bars + tooltip details.
- Dev menu: multipliers per rep source category.

### Implementation details
- Add `src/ui/factions_panel.js`.
- Add dev config in `state.meta.devTuning` (dev-only default).

### Acceptance
- Player can understand why rep changed.
- Tuning multipliers affect deltas immediately.

### DoD (Definition of Done)
- UI does not spam; merges repeated messages.
- All faction ids consistent with content.

### QA checklist
- Play 10 minutes; observe at least 3 rep changes with reasons.
