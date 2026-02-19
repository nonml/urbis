# Milestone R — Visual/Audio Polish Pass (Readability + Tone) (target: 0.38.x)

## Objective 🎯
- Deliver a coherent neo-noir city tone and improve readability of systems.
- Add day/night cycle and basic animations.
- Upgrade audio soundscape and feedback.

---

## Milestone Exit Criteria (Acceptance)
- ✅ Day/night cycle exists and affects lighting and ambient audio.
- ✅ Player/citizen/vehicle animations exist (minimum viable).
- ✅ UI theme is consistent and scalable (no random fonts/colors).
- ✅ VFX communicates ops/crises without heavy GPU cost.


## Definition of Done (DoD)
- All art changes maintain performance budgets (profiled).
- Assets tracked in manifest with licensing notes.
- Accessibility baseline maintained (text size, contrast, keybinds).


---

## Phases
1) Lighting + time of day
2) Animation + character feel
3) Soundscape
4) UI theme polish


---

## Tickets

### R-01 — Day/Night cycle + lighting presets
**Objective:** Establish mood and improve navigation.

**Design**
- Time of day progresses; player can speed up/slow down (dev).
- Lighting presets: day, dusk, night with tuned ambient and directional light.


**Specs**
- `state.timeOfDay` (0..24)
- `src/render/lighting/day_night.js`


**Implementation details**
1. Add time of day state and update loop.
2. Blend light colors/intensity across presets.
3. Hook into ambient audio selection (night quieter).


**Acceptance**
- Lighting transitions are smooth and not nauseating.
- Night is playable (not too dark).


**DoD**
- No per-frame allocations in lighting update.


---

### R-02 — Player + citizen animation baseline
**Objective:** Improve third-person feel and make the city look alive.

**Design**
- Minimal animation set: idle/walk/run for player; walk/idle for citizens.
- Use simple sprite/vertex animation if no skeletal pipeline yet.


**Specs**
- `assets/models` or `assets/ui` for placeholders
- `src/render/anim/anim_controller.js`


**Implementation details**
1. Pick an animation approach (simple or GLTF).
2. Integrate animation controller for player and a subset of citizens.
3. Add speed-based blending.


**Acceptance**
- Player transitions feel responsive.
- Citizens animate when moving near player.


**DoD**
- Animation system is optional and fails gracefully if asset missing.


---

### R-03 — Soundscape v2 (district-based ambience + mixing)
**Objective:** Audio supports immersion and informs gameplay.

**Design**
- Ambience layers per district + time of day (traffic, crowd, industrial hum).
- Mixer with master/music/sfx sliders.


**Specs**
- `src/audio/mixer.js`
- Update `src/audio/audio_manager.js` to route through mixer


**Implementation details**
1. Implement mixer volumes and crossfades.
2. Add 3 district ambience sets as baseline.
3. Tie crisis stingers to severity.


**Acceptance**
- Moving between districts crossfades ambience.
- No clipping or abrupt volume spikes.


**DoD**
- Audio can be disabled entirely for performance.


---

### R-04 — VFX pass (ops, crises, UI feedback)
**Objective:** Make systems readable with minimal visuals.

**Design**
- Use cheap effects: billboards, screen-space pulses, outlines.
- VFX cues for: scan, operation executed, incident escalating.


**Specs**
- `src/render/fx/fx_system.js`
- `assets/textures/fx/*`


**Implementation details**
1. Add FX system with pooled sprites.
2. Trigger FX from events bus.
3. Add settings toggle to reduce FX.


**Acceptance**
- Players can identify incidents and operations visually.
- FX does not reduce FPS materially on City.


**DoD**
- FX uses pooling; no per-event texture loads.


---

### R-05 — UI theme + accessibility pass
**Objective:** Reduce prototype feel and make UI scalable.

**Design**
- Define a UI style guide: spacing, font sizes, colors, icons.
- Add accessibility toggles: larger text, reduce motion.


**Specs**
- `docs/UI_STYLE_GUIDE.md`
- CSS variables in `src/style.css`


**Implementation details**
1. Refactor UI CSS to use variables.
2. Add settings for font scale and reduced motion.
3. Ensure key UI screens have consistent layout.


**Acceptance**
- UI looks consistent across budget/policy/quest screens.
- Text scale works without layout breaking.


**DoD**
- No tables required; list/card layouts used.


---
