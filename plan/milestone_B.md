# Milestone B: Third-person playable avatar + camera + interaction baseline

## Objective
Make the game controllable as a third-person character in a 3D city with stable camera, collision, and interact prompts.

## Exit criteria (acceptance for milestone)
- Third-person controller feels solid: move, sprint, jump(optional), rotate camera.
- Camera collision/occlusion mitigation (no clipping into terrain/buildings).
- Interact prompt works with nearest interactable; can trigger a stub action.
- Input remapping file exists and is documented.

## Phases
- B1: Controller + camera
- B2: Collision + ground alignment
- B3: Interaction prompts

## Tickets

## Ticket B-1: Third-person controller v1 (WASD + mouse)
- **Phase:** B1
- **Depends on:** A-1

### Objective
Consistent, frame-rate-independent movement with acceleration and turn smoothing.

### Design
Use a kinematic capsule approximated by cylinder+hemispheres. Compute intended velocity in camera-space, apply acceleration, and resolve ground height from map.

### Specs
- Walk speed: 4 m/s, sprint: 6 m/s.
- Acceleration: 18 m/s², decel: 22 m/s².
- Turn smoothing: slerp ~0.15 per frame.

### Implementation details
- Add `src/player/controller.js` and keep `state.player` as source of truth.
- Controller uses `dt` from fixed sim tick (not render dt).
- Expose `player.forward`, `player.velocity`, `player.isSprinting`.

### Acceptance
- Movement speed consistent at 30fps vs 144fps.
- Diagonal movement is normalized (no faster than forward).

### DoD (Definition of Done)
- No per-frame allocations in movement loop.
- Unit test: controller step updates within expected bounds.

### QA checklist
- Walk/sprint in empty map for 2 minutes; no jitter drift.
- Rotate camera while moving; character follows expected heading.

## Ticket B-2: Camera rig v1 (orbit + follow + collision)
- **Phase:** B1/B2
- **Depends on:** B-1

### Objective
A Watch Dogs-style third-person follow cam that doesn’t clip through objects.

### Design
Use a camera boom with target at player head. Raycast/segment test from target backward to desired camera position; if hit, pull camera forward.

### Specs
- Default distance: 6m; min: 2.5m; max: 10m.
- Pitch clamp: -15° .. 55°.
- Right mouse: rotate; wheel: zoom.

### Implementation details
- Implement in `src/render/camera_rig.js`.
- Use simplified collision: AABB from building instances; terrain is heightfield.

### Acceptance
- Camera never goes inside buildings.
- Zoom feels smooth; no snapping when passing corners.

### DoD (Definition of Done)
- Config values are exposed via `constants.js`.
- Camera settings persisted in save.

### QA checklist
- Run around dense district; verify no wall clipping.
- Spin camera 360° rapidly; no NaN/flip.

## Ticket B-3: Interact prompt + action dispatch
- **Phase:** B3
- **Depends on:** B-1

### Objective
Enable the player to interact with nearby objects (terminals, doors, cameras) with a consistent UI prompt.

### Design
Interaction system exposes `getNearbyInteractable(playerPos, radius)` and `interact(interactableId)` events. UI shows `[E] Interact` prompt with object name.

### Specs
- Interact radius: 2.2m.
- Priority: closest, then highest priority type (terminal > camera > door).
- Input: E

### Implementation details
- Add `Events.PLAYER_INTERACT` in `src/sim/events.js` if missing.
- Update `InteractableManager` to return a stable reference for UI.
- UI prompt uses a single DOM element; no re-create per frame.

### Acceptance
- Approaching a terminal shows prompt and pressing E triggers an event.
- Prompt disappears when moving away.

### DoD (Definition of Done)
- No duplicate prompts and no stuck prompts after pause/unpause.
- One integration test: spawn a terminal, walk to it, interact.

### QA checklist
- Spam E near an interactable; ensure no crashes.
- Interact while camera is rotating; still works.
