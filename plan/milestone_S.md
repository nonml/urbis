# Milestone S: VFX + feedback pass (hacks, chases, crises, UI polish)

## Objective
Make outcomes readable with clear feedback and satisfying effects.

## Exit criteria (acceptance for milestone)
- Hacks have VFX: scan outlines, success burst, fail sparks.
- Chases have feedback: sirens, wanted level, roadblock indicators.
- Crises have district-level markers and visual cues.
- UI polish: consistent typography and spacing.

## Phases
- S1: Hack VFX
- S2: Chase VFX
- S3: Crisis markers + UI polish

## Tickets

## Ticket S-1: Hack VFX suite (scan, ping, success/fail)
- **Phase:** S1
- **Depends on:** G-3

### Objective
Instant feedback for hacking actions.

### Design
Outline shader substitute (cheap) or emissive tint, plus particle bursts and screen-space ping rings.

### Specs
- Scan outline visible up to 30m.
- Ping ring lasts 1.2s.

### Implementation details
- Expand `renderer3d.showParticleBurst` with pooled particles.
- Add `src/render/fx/pings.js`.

### Acceptance
- Player can tell what got hacked and whether it succeeded.

### DoD (Definition of Done)
- No per-hack geometry allocation; use pools.

### QA checklist
- Perform 50 hacks; no FPS decay over time.

## Ticket S-2: Chase feedback (sirens, indicators, roadblocks)
- **Phase:** S2
- **Depends on:** M-3, P-3

### Objective
Make chases readable and tense.

### Design
HUD wanted level, police direction indicators, roadblock warning icon, camera shake on collision.

### Specs
- Directional indicator updates at 10Hz.
- Camera shake max amplitude clamped.

### Implementation details
- Add `src/ui/chase_hud.js`.
- Add roadblock marker integration with minimap.

### Acceptance
- Player knows where police are and where roadblocks are.

### DoD (Definition of Done)
- No motion sickness defaults; shake can be disabled in settings.

### QA checklist
- Chase with 10 police units; HUD remains readable.

## Ticket S-3: Crisis visual markers + UI cohesion
- **Phase:** S3
- **Depends on:** O-2, P-2

### Objective
Let players see city problems spatially.

### Design
District tint/heatmap for affected areas; crisis icons at district center; consistent HUD styling across panels.

### Specs
- Heatmap toggles per service and per crisis type.

### Implementation details
- Integrate with `services` and `crisis` data.
- Create shared UI style tokens in CSS.

### Acceptance
- Player can locate crises and service gaps visually.

### DoD (Definition of Done)
- All UI panels share common styles and spacing rules.

### QA checklist
- Toggle heatmap while moving; no flicker.
