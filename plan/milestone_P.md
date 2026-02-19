# Milestone P: UI/UX overhaul (HUD, minimap, menus, accessibility)

## Objective
Make the game readable and usable for real play sessions.

## Exit criteria (acceptance for milestone)
- Main menu: new game (preset+seed), load game, settings.
- HUD: resources, heat, minimap, quest/case tracker, alerts.
- Minimap supports zoom, markers, and chase indicators.
- Keybindings shown and remappable.

## Phases
- P1: Menu + settings
- P2: HUD consolidation
- P3: Minimap v2 + markers

## Tickets

## Ticket P-1: Main menu + settings + keybind remap
- **Phase:** P1
- **Depends on:** E-4

### Objective
Professionalize the entry experience and reduce confusion.

### Design
A simple menu screen with preset selection (small/city/mega), seed input, difficulty, sandbox toggle. Settings include audio levels and keybinds.

### Specs
- Seed field supports “random” button.
- Keybinds stored in localStorage + saved in state optionally.

### Implementation details
- Add `src/ui/screens/main_menu.js`.
- Add `src/input/keybinds.js` with default map and remap UI.

### Acceptance
- Can start a new run with chosen preset/seed and see them in overlay.

### DoD (Definition of Done)
- Menu works in dev and production build.

### QA checklist
- Start game with MEGA seed 123; verify correct map size.

## Ticket P-2: HUD consolidation + alert system
- **Phase:** P2
- **Depends on:** E-2, G-3, O-2

### Objective
Stop UI fragmentation and make alerts actionable.

### Design
Single HUD layout with panels. Alerts have severity and can open related panels (services, crises, cases).

### Specs
- Alert dedupe window: 15s.
- Clickable alerts open the relevant UI view.

### Implementation details
- Add `src/ui/hud/hud_root.js`.
- Create `AlertManager` with queue + dedupe.

### Acceptance
- Player can identify why they’re losing (food/power/heat) quickly.

### DoD (Definition of Done)
- HUD has no overlapping elements at 720p.

### QA checklist
- Trigger multiple alerts; verify dedupe and click-through.

## Ticket P-3: Minimap v2 (markers, zoom, chase)
- **Phase:** P3
- **Depends on:** M-1, H-2

### Objective
A minimap that supports exploration and chases.

### Design
Minimap renders roads, water, districts as colors; overlays markers: player, vehicle, police, quests, cases, crises. Zoom with scroll.

### Specs
- Zoom levels: 3 steps.
- Marker priority: police > quest > case > crisis > POI.

### Implementation details
- Fix any remaining canvas/div issues in minimap implementation.
- Add marker registry interface `registerMarker(type, id, pos)`.

### Acceptance
- Markers show and update smoothly.
- During chase, police markers appear and update.

### DoD (Definition of Done)
- Minimap costs < 1ms per frame.

### QA checklist
- Start chase; confirm police markers update and disappear after cooldown.
