# Milestone M: Police + Heat + Chase v1 (detection, pursuit, evasion, hacks)

## Objective
Make vehicles meaningful by adding police response and chases tied to hacking/rep.

## Exit criteria (acceptance for milestone)
- Heat states (alert/search/pursuit) cause police spawning and pursuit behavior.
- Player can evade by breaking line-of-sight, hiding, or using hacks.
- Chase loop feels complete: detection -> pursuit -> escape -> cooldown.
- At least 3 chase hacks work (traffic lights, roadblock disable, blackout).

## Phases
- M1: Police agents + spawning
- M2: Pursuit behavior + LOS
- M3: Evasion tools + hacking integration

## Tickets

## Ticket M-1: Police unit entity + spawn manager
- **Phase:** M1
- **Depends on:** G-3, J-2, L-2

### Objective
Create police units that appear based on heat and district rules.

### Design
Spawn manager picks spawn points on roads near player but out of view. Police units have type: patrol car, interceptor, drone (optional).

### Specs
- Spawn rate scales with heat band.
- Max active units: SMALL 6, CITY 12, MEGA 20.
- Police rep modifies thresholds and spawn aggressiveness.

### Implementation details
- Add `src/sim/police/police_system.js`.
- Spawn points: road tiles within ring radius.
- Persist police state in save (optional) or respawn deterministically.

### Acceptance
- At heat >= 50, police units spawn within 30 seconds and move toward player area.

### DoD (Definition of Done)
- No spawn inside water/buildings.
- Spawn respects chunk streaming.

### QA checklist
- Set heat to 60 in dev menu; verify police appear.
- Lower heat to 0; police despawn/cool down.

## Ticket M-2: Pursuit behavior v1 (seek, follow, ram) + LOS
- **Phase:** M2
- **Depends on:** M-1

### Objective
Core chase AI that feels Watch Dogs-ish without full traffic sim.

### Design
Police uses simple steering to pursue target position; if LOS lost, go to last known position and search pattern. In pursuit, try to stay behind/side and occasionally ram at high heat.

### Specs
- LOS check: raycast in tile grid (roads/buildings).
- Search state lasts 20–40 seconds.
- Ramming only above heat 75.

### Implementation details
- Add `src/sim/police/los.js` and `pursuit_ai.js`.
- Police uses the same vehicle controller with different params.
- Add UI: “WANTED” banner with heat band.

### Acceptance
- Police follow player vehicle; losing LOS transitions to search mode.
- If player stays hidden, heat decays and chase ends.

### DoD (Definition of Done)
- AI deterministic given same inputs and seed.
- No jittering oscillation when close to player.

### QA checklist
- Drive around buildings to break LOS; verify search behavior.
- Stop in alley; verify cooldown to 0 over time.

## Ticket M-3: Chase hacks: traffic lights, blackout, roadblock disable
- **Phase:** M3
- **Depends on:** G-3, M-2

### Objective
Give player active tools to escape instead of just driving.

### Design
During chase, expose hackable nodes in area. Hacking traffic lights causes NPC police to slow/crash; blackout disables nearby cameras; roadblock disable opens gates.

### Specs
- Each hack has cooldown 30s.
- Success reduces heat by 5–15 depending on hack.
- Fail increases heat by 5.

### Implementation details
- Extend hack actions with chase context modifiers.
- Add `src/sim/police/roadblocks.js` that spawns barriers at high heat.
- Add camera network effect: if blackout, LOS detection weaker.

### Acceptance
- Using hacks changes chase outcome noticeably.
- Roadblocks can be avoided or disabled.

### DoD (Definition of Done)
- Hacks available from both on-foot and in-vehicle modes.
- All hacks have clear UI feedback.

### QA checklist
- Start chase; use traffic hack; verify at least one police unit is disrupted.
- Use blackout; verify reduced detection for duration.
