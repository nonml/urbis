# Milestone R: Audio pass (SFX, ambience, music layers, mix)

## Objective
Add sound to support stealth/chase/emotion and provide polish.

## Exit criteria (acceptance for milestone)
- Footsteps, UI clicks, hack sounds, vehicle engine, police siren exist.
- District ambience changes by theme.
- Heat affects music intensity layers.
- Audio settings and mute work.

## Phases
- R1: Core SFX
- R2: Ambience + district layers
- R3: Music + heat layers

## Tickets

## Ticket R-1: Core SFX library + playback manager
- **Phase:** R1
- **Depends on:** P-1

### Objective
Consistent audio triggers without duplicated code.

### Design
Audio manager loads small set of samples (or oscillator placeholders) and provides `play(name, options)`.

### Specs
- Rate limit repeated sounds to avoid spam.
- Master volume + SFX volume sliders.

### Implementation details
- Extend `src/audio/audio_manager.js` with sample-based support (optional).
- Map events to sounds (hack success/fail, build placed, alert).

### Acceptance
- SFX plays at correct times and respects volume settings.

### DoD (Definition of Done)
- No uncaught promise errors on audio init.

### QA checklist
- Mute/unmute while playing; no glitches.

## Ticket R-2: District ambience + transitions
- **Phase:** R2
- **Depends on:** C-1

### Objective
Make districts feel distinct.

### Design
Each district theme has an ambience loop. Crossfade based on player location; clamp transitions to avoid rapid toggling near borders.

### Specs
- Crossfade time: 2 seconds.
- Hysteresis: require 2s inside district before switching.

### Implementation details
- Add `src/audio/ambience.js` tying into district detection.

### Acceptance
- Walking across border fades ambience smoothly.

### DoD (Definition of Done)
- No memory leak from looping audio nodes.

### QA checklist
- Cross borders repeatedly; transitions remain smooth.

## Ticket R-3: Music layers tied to heat and chase
- **Phase:** R3
- **Depends on:** M-2

### Objective
Support chase loop emotionally.

### Design
Base music layer always on; add intensity layers as heat bands increase; fade out when cooled down.

### Specs
- Layers for bands: neutral, alert, pursuit.

### Implementation details
- Add `src/audio/music_layers.js`.

### Acceptance
- Heat rising triggers noticeable music intensity change.

### DoD (Definition of Done)
- Music respects master volume and pause state.

### QA checklist
- Start chase then escape; layers fade correctly.
