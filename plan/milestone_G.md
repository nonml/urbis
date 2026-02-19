# Milestone G: Hacking gameplay v1 (scan, breach, cameras, traffic control, heat)

## Objective
Deliver a Watch Dogs-like hacking loop tied to exploration and city systems.

## Exit criteria (acceptance for milestone)
- Player can scan nearby hackables and see security levels.
- At least 4 hack actions work: camera view, traffic light, door/gate, district ping.
- Hacks generate heat; heat affects police response later.
- Security upgrades increase difficulty (breach mini-game).

## Phases
- G1: Hackable taxonomy + scanning UI
- G2: Breach mini-game stub + success/fail outcomes
- G3: Hack actions + heat plumbing

## Tickets

## Ticket G-1: Hackable system: types, security, ownership
- **Phase:** G1
- **Depends on:** B-3, C-4

### Objective
Standardize what can be hacked and how difficulty is represented.

### Design
Hackable objects implement `{id,type,pos,securityLevel,ownerFaction,state}`. Scanning shows outline + tooltip and adds to nearby list.

### Specs
- Security levels: 1..5.
- Scan radius: 25m; line-of-sight optional.
- Owners: city, corp, gang, police.

### Implementation details
- Extend `InteractableManager` with hackables registry.
- Add UI panel `HackList` sorted by distance and priority.
- Persist discovered hackables in state (optional).

### Acceptance
- Approaching a camera shows it in scan list.
- Security level shown consistently.

### DoD (Definition of Done)
- No per-frame DOM re-creation.
- Hackables serialized or regenerated deterministically.

### QA checklist
- Scan in 3 districts; ensure list updates correctly.
- Pause/unpause; scan list stable.

## Ticket G-2: Breach mini-game v1 (timed lock)
- **Phase:** G2
- **Depends on:** G-1

### Objective
Create a repeatable challenge for hacks without building full puzzle complexity.

### Design
Timed “match the node” or “hold-to-sync” with moving needle; difficulty scales speed + window size. Fail increases heat.

### Specs
- Difficulty scales by security level.
- Fail penalty: +5 heat; cooldown 10s on that node.
- Success reward: 0..-heat for stealth hacks.

### Implementation details
- Add `src/ui/breach_minigame.js` as modal.
- Game pauses world sim or slows time to 0.2x during breach.
- Emit `player_hacked_node` event with success/fail.

### Acceptance
- Player can succeed/fail and see consequences.
- Mini-game never softlocks input.

### DoD (Definition of Done)
- Keyboard + mouse usable.
- Accessibility: optional “easy hack” in dev menu.

### QA checklist
- Attempt 20 hacks; ensure no memory leak (modal removed).
- Fail 5 times; confirm cooldown works.

## Ticket G-3: Hack actions v1 + heat system
- **Phase:** G3
- **Depends on:** G-2

### Objective
Make hacks affect the world meaningfully and feed chase loop later.

### Design
Implement discrete actions with durations and cooldowns. Heat is a 0..100 meter with decay. Certain hacks are “loud”.

### Specs
- Actions: camera takeover, traffic light switch, door unlock, district blackout ping.
- Heat decay: 0.5 per tick if not seen.
- Heat thresholds: 25 alert, 50 search, 75 pursuit.

### Implementation details
- Add `src/sim/heat/heat_system.js`.
- Implement camera view as render overlay switching to camera node position.
- Traffic light hack toggles vehicle AI later and can cause crashes event.

### Acceptance
- Hacking camera changes view and provides intel.
- Heat increases on loud hacks and is visible in HUD.

### DoD (Definition of Done)
- Heat state saved/loaded.
- Heat never goes negative or above max.

### QA checklist
- Trigger heat > 50; verify UI changes state.
- Restart with same seed; repeat hacks; heat behaves consistently.
