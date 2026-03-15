# Game Improvement Master Plan

**Created**: 2026-03-15
**Status**: Planning
**Goal**: Push the game from shipped 1.0 to best-in-class across all dimensions.

---

## Table of Contents

- [Assessment Summary](#assessment-summary)
- [Tier 0: Start Over?](#tier-0-start-over)
- [Tier 1: Visual & Feel Overhaul](#tier-1-visual--feel-overhaul-biggest-impact)
- [Tier 2: Gameplay Depth](#tier-2-gameplay-depth)
- [Tier 3: Architecture Modernization](#tier-3-architecture-modernization)
- [Tier 4: Production Quality](#tier-4-production-quality)
- [Tier 5: Distribution & Community](#tier-5-distribution--community)
- [Tier 6: Exceptional Polish](#tier-6-exceptional-polish)
- [VFX Event Integration](#vfx-event-integration-migrated-from-plansvfx_event_integrationmd)
- [Execution Order](#recommended-execution-order)

---

## Assessment Summary

- **Codebase**: ~50K lines of JavaScript, 150+ files
- **Stack**: Three.js + vanilla JS + Vite, no UI framework
- **Architecture**: Manager-based with event bus, deterministic RNG, chunked simulation
- **Milestones**: All 21 (A-U) complete, 1.0.0 shipped 2026-03-04
- **Tests**: 165 smoke tests passing, Playwright E2E tests
- **Strengths**: Simulation depth (25+ systems), deterministic seeding, save/load/migrations, modular organization
- **Weaknesses**: Placeholder visuals, no audio files, monolithic UI/Game classes, no TypeScript, raw DOM UI

---

## Tier 0: Start Over?

**Verdict: No.**

- 50K lines of working, tested, well-organized code
- 25+ simulation systems that interact correctly
- Deterministic seeding, save/load, migrations all working
- 165 passing tests

**Instead**: Targeted modernization of weak layers (rendering, UI, player experience) while keeping simulation core intact. The simulation logic is the hardest part and it works.

---

## Tier 1: Visual & Feel Overhaul (Biggest Impact)

### 1A. Replace Placeholder 3D with Real Art Direction

Currently uses colored boxes/instanced geometry. Single biggest thing holding the game back.

**Options:**

| Approach | Effort | Result |
|----------|--------|--------|
| **Low-poly stylized models** (Kenney assets or custom) | Medium | Immediate visual upgrade, fits browser perf |
| **Voxel aesthetic** (MagicaVoxel -> glTF) | Medium | Distinctive look, good for city builders |
| **2.5D isometric rewrite** (PixiJS or canvas) | High | Proven genre aesthetic (SimCity, Tropico) |
| **Shader-driven procedural** (keep Three.js, add custom shaders) | Medium | Unique look, no asset pipeline needed |

**Recommendation**: Low-poly stylized with consistent palette. Import `.glb` models via Three.js `GLTFLoader`. One model per building type x upgrade level = ~32 models.

### 1B. Camera System Overhaul

- **God Mode**: Smooth orbital camera with zoom limits, edge-pan, rotation
- **Street Mode**: Third-person camera with collision avoidance, smooth follow, FOV shifts
- Smooth camera transitions between modes (lerp, not instant swap)
- Cinematic camera for crisis events (auto-zoom to incident)

### 1C. UI Framework Migration

`src/ui.js` (1,829 lines) managing everything through raw DOM is a scaling bottleneck.

**Recommendation**: Migrate UI panels to **Svelte** or **Preact**:
- Keep Three.js canvas as-is
- Wrap each panel (build menu, settings, stats, quest log) as a component
- Reactive state binding eliminates manual DOM updates
- Enables transitions, animations, responsive layout
- Vite has first-class Svelte/Preact support

### 1D. Juice & Game Feel

The difference between "functional" and "addictive":

- **Building placement**: Ghost preview, snap animation, dust particles on place, satisfying SFX
- **Resource changes**: Numbers count up/down with easing, flash color on change
- **Camera shake**: Tiered by crisis severity (subtle rumble -> heavy shake)
- **Time-of-day ambience**: Gradual color grading shifts, not just light color
- **Citizen activity**: Visible movement patterns (commuting, idle, fleeing during crisis)
- **Hover feedback**: Buildings glow/highlight, info tooltip with slide-in animation

---

## Tier 2: Gameplay Depth

### 2A. Hacking Loop Overhaul

Make the breach minigame compelling:
- Visual hacking interface (node graph like Deus Ex / Hacknet)
- Time pressure with police detection meter
- Skill progression -- harder nodes require upgrades
- Meaningful intel rewards that change gameplay options
- Make hacking *the reason* to play street mode

### 2B. Emergent Narrative System

Wire quests, cases, factions, politics, rival AI together:
- **Rival AI should visibly act** -- you see their buildings, faction influence grow
- **Faction conflicts cascade** -- helping one faction angers another, creating crises
- **Cases connect** -- solving one reveals connections to larger conspiracy
- **News feed tells a story** -- narrative arcs with named NPCs, not just events
- **Procedural NPC names, faces, backstories** that persist across runs

### 2C. Strategic Depth for City Building

Current building system is functional but shallow:
- **Supply chains**: Farm -> Market (not just flat income)
- **Adjacency bonuses**: Buildings near parks get happiness boost, near industry get pollution penalty
- **District specialization**: Themed districts (tech hub, market quarter, residential suburb)
- **Infrastructure decay**: Buildings degrade without maintenance budget
- **Unlockable building tiers** tied to tech tree progression

### 2D. Difficulty & Balance Pass

- Professional game balance spreadsheet (export constants.js to CSV, tune, reimport)
- Multiple difficulty presets with clear descriptions
- Dynamic difficulty adjustment (detect struggling players, offer easier crisis options)
- Sandbox mode with full cheats and creative tools

---

## Tier 3: Architecture Modernization

### 3A. TypeScript Migration (Incremental)

50K lines of untyped JS is a refactoring minefield.

1. Rename files to `.ts` one module at a time (Vite supports natively)
2. Start with `sim/` (most critical for correctness)
3. Add interfaces for GameState, BuildingDef, CitizenState, etc.
4. Enable `strict: true` progressively
5. Catches bugs at compile time, enables fearless refactoring

### 3B. Split God Objects

| File | Lines | Split Into |
|------|-------|-----------|
| `src/game.js` | 1,407 | `SystemRegistry`, `GameLoop`, `GameConfig` |
| `src/ui.js` | 1,829 | `InputManager`, `PanelManager`, `RendererBridge` |
| `src/renderer3d.js` | Large | `SceneManager`, `CameraController`, `TerrainRenderer`, `BuildingRenderer` |
| `src/style.css` | 2,967 | Component-scoped CSS modules |

### 3C. ECS Consideration (Long-term, 2.0)

- Consider lightweight ECS (bitECS or custom) for citizens, vehicles, buildings
- Enables: composition over inheritance, cache-friendly iteration, easier serialization
- Keep manager pattern for high-level systems (economy, politics), use ECS for entities

### 3D. WebWorker Simulation

Move heavy simulation off main thread:
- Pathfinding (A*) in a worker
- Citizen AI batch updates in a worker
- Network coverage calculations in a worker
- Main thread only handles rendering + input
- Eliminates frame drops during heavy simulation ticks

---

## Tier 4: Production Quality

### 4A. Audio (Currently Empty)

Audio system exists but **no actual audio files**. Massive gap.

- **Music**: Ambient synthwave/lo-fi tracks (license from OpenGameArt or commission)
- **SFX**: Building place, demolish, UI clicks, crisis alerts, hacking sounds
- **Ambience**: District-based (already coded in soundscape.js, just needs files)
- **Dynamic music**: Layer intensity based on crisis level
- Consider **Tone.js** for procedural audio generation (no files needed, no licensing issues)

### 4B. Textures & Sprites

- Terrain: texture variety (grass variants, road markings, water animation)
- Buildings: colored facades with windows (can be procedural via shader)
- Citizens: visible representation (colored capsules with direction indicators at minimum)
- Minimap: district coloring and building footprints

### 4C. Accessibility

- Full keyboard navigation for all menus
- Screen reader announcements for key events
- Colorblind modes (deuteranopia/protanopia palettes via existing theme system)
- Scalable UI (font size slider)
- Comprehensive reduced motion support (partially exists)

### 4D. Performance Targets

- Target **60 FPS** on mid-range hardware (not 30-50)
- **LOD (Level of Detail)** for buildings at distance
- **Frustum culling** for off-screen objects
- **Occlusion culling** for dense city areas
- **GPU instancing** improvements (batch by material, not just mesh)
- Verify **render scale** slider works correctly

---

## Tier 5: Distribution & Community

### 5A. Desktop Wrapper (Electron/Tauri)

Browser-only limits reach. Package as desktop app:
- **Tauri** recommended (Rust-based, tiny binary, native feel)
- Enables: file system saves, notifications, fullscreen, Steam integration
- Keep web version as demo/lite version

### 5B. Steam Release Pipeline

- Steamworks SDK integration via Tauri
- Achievements (map to existing victory conditions)
- Cloud saves
- Trading cards
- Workshop support for community scenarios/mods

### 5C. Modding Support

- Expose building definitions as JSON (partially exists via constants.js)
- Scenario format for custom win conditions
- Content packs: new quests, cases, factions loadable from files
- Custom theme support (CSS variables already exist)

### 5D. Multiplayer (2.0 Vision)

- Shared map with rival controlled by another player
- Async multiplayer: take turns, see results
- Competitive: two cities on same map, race to victory conditions
- Uses existing deterministic RNG for replay synchronization

---

## Tier 6: Exceptional Polish

### 6A. Procedural Storytelling Engine

Go beyond template quests. Generate stories from simulation state:
- "Mayor's daughter caught in corruption scandal" -- generated from social graph + crime nodes
- Headlines reference actual game events with actual NPC names
- Player choices create ripple effects tracked over in-game months

### 6B. Living City Feel

- Citizens have visible daily routines (commute, work, shop, sleep)
- Traffic congestion you can *see* (vehicles slow, honk)
- Weather affects gameplay (rain -> floods more likely, snow -> slower traffic)
- Seasons with visual changes
- Construction animations (buildings go up over multiple ticks, scaffolding visible)

### 6C. Photo Mode

- Pause game, free camera, depth of field, filters
- Screenshot sharing (export to PNG with game watermark)
- Timelapse replay of city growth (uses deterministic seed)

### 6D. Procedural Music (Tone.js)

Generate music from city state:
- Tempo from game speed
- Harmony from citizen happiness
- Tension from crisis level
- District themes blend based on camera position
- No licensing issues, infinitely varied

---

## VFX Event Integration (Migrated from plans/vfx_event_integration.md)

### Overview

Centralized `VFXTriggerManager` listens to game events and dispatches VFX based on configurable rules.

### Architecture

```
Event Bus -> VFXTriggerManager -> Event-to-VFX Rules -> Position Resolver -> FXSystem -> Particle System
```

**Key Components:**
1. **VFXTriggerManager** - Central event listener and VFX dispatcher
2. **Event-to-VFX Rules** - Configuration mapping events to VFX types
3. **Position Resolver** - Converts game coordinates to world/screen positions
4. **VFX Configuration** - Per-event customization of VFX parameters

**Status**: `src/render/fx/vfx_triggers.js` exists (partially implemented). FXSystem and event bus are ready.

### Event-to-VFX Mapping

#### Player Actions

| Event | VFX Type | Description |
|-------|----------|-------------|
| `PLAYER_HACKED_NODE` (success) | `PARTICLE_BURST` + `FLOATING_TEXT` | Green burst + "Hacked!" text |
| `PLAYER_HACKED_NODE` (failure) | `PARTICLE_BURST` | Red burst at node position |
| `PLAYER_BUILT_BUILDING` | `PARTICLE_BURST` + `HIGHLIGHT_PULSE` | Celebration burst + building highlight |
| `PLAYER_ENTERED_DISTRICT` | `FLOATING_TEXT` | District name appears |
| `PLAYER_INTERACT` | `HIGHLIGHT_PULSE` | Brief pulse on interactable |

#### Crisis Events

| Event | VFX Type | Description |
|-------|----------|-------------|
| `CRISIS_STARTED` | `SCREEN_SHAKE` + `FLOATING_TEXT` | Shake + crisis type text |
| `CRISIS_ESCALATED` | `SCREEN_SHAKE` + `PARTICLE_BURST` | Stronger shake + red particles |
| `CRISIS_RESOLVED` | `PARTICLE_BURST` + `FLOATING_TEXT` | Celebration burst + "Resolved" |
| `CRISIS_DAMAGE` | `FLOATING_TEXT` | Damage number at affected location |

#### Quest Events

| Event | VFX Type | Description |
|-------|----------|-------------|
| `QUEST_STARTED` | `FLOATING_TEXT` | Quest title appears |
| `QUEST_COMPLETED` | `PARTICLE_BURST` + `FLOATING_TEXT` | Gold burst + "Quest Complete!" |
| `QUEST_STEP_COMPLETED` | `FLOATING_TEXT` | Step completion text |
| `CLUE_DISCOVERED` | `HIGHLIGHT_PULSE` + `FLOATING_TEXT` | Pulse + "Clue Found!" |

#### Interactable Events

| Event | VFX Type | Description |
|-------|----------|-------------|
| `INTERACTABLE_SUCCESS` | `PARTICLE_BURST` | Green success burst |
| `INTERACTABLE_FAILED` | `PARTICLE_BURST` | Red failure burst |
| `INTERACTABLE_AVAILABLE` | `HIGHLIGHT_PULSE` | Brief pulse to draw attention |

#### Incident Events

| Event | VFX Type | Description |
|-------|----------|-------------|
| `INCIDENT_CREATED` | `FLOATING_TEXT` + `SCREEN_SHAKE` | Incident name + mild shake |
| `INCIDENT_CONTAINED` | `PARTICLE_BURST` + `FLOATING_TEXT` | Blue burst + "Contained" |
| `INCIDENT_SPREAD` | `FLOATING_TEXT` | Spread notification |

#### Intel Events

| Event | VFX Type | Description |
|-------|----------|-------------|
| `INTEL_REVEALED` | `HIGHLIGHT_PULSE` + `FLOATING_TEXT` | Pulse + "Intel Revealed" |
| `INTEL_PING` | `PROGRESS_RING` | Ring at ping location |
| `INTEL_GENERATED` | `FLOATING_TEXT` | "New Intel" notification |

#### Heat Events

| Event | VFX Type | Description |
|-------|----------|-------------|
| `HEAT_CHANGED` (increase) | `FLOATING_TEXT` | Red heat increase text |
| `HEAT_CHANGED` (decrease) | `FLOATING_TEXT` | Green heat decrease text |

#### Influence Operations

| Event | VFX Type | Description |
|-------|----------|-------------|
| `INFLUENCE_OP_STARTED` | `PROGRESS_RING` | Ring at target location |
| `INFLUENCE_OP_COMPLETED` | `PARTICLE_BURST` + `FLOATING_TEXT` | Success burst + result |
| `INFLUENCE_OP_CANCELLED` | `FLOATING_TEXT` | "Cancelled" text |

#### UI Feedback Events

| Event | VFX Type | Description |
|-------|----------|-------------|
| `UI_RESOURCE_GAINED` | `FLOATING_TEXT` | Green resource gain text |
| `UI_RESOURCE_LOST` | `FLOATING_TEXT` | Red resource loss text |
| `UI_NOTIFICATION` | `FLOATING_TEXT` | System notification text |
| `UI_ERROR` | `SCREEN_SHAKE` + `FLOATING_TEXT` | Error shake + text |

### VFX Implementation Phases

**Phase 1: Core VFX Trigger System**
- Create/update `src/render/fx/vfx_triggers.js` with VFXTriggerManager class
- Implement event listener registration
- Add position resolution helpers (tile to world, screen to world)
- Wire up to game instance

**Phase 2: Player Action VFX**
- `PLAYER_HACKED_NODE` (success/failure branching)
- `PLAYER_BUILT_BUILDING` (position from data)
- `PLAYER_ENTERED_DISTRICT` (district name display)
- `PLAYER_INTERACT` (highlight pulse)

**Phase 3: Crisis & Incident VFX**
- Crisis handlers with screen shake for severity
- Incident handlers with appropriate colors
- Shake intensity based on crisis severity

**Phase 4: Quest & Intel VFX**
- Quest handlers with celebration effects for completion
- Clue discovery with highlight pulse
- Intel handlers with progress rings for pings

**Phase 5: Heat & Influence VFX**
- Heat change handler with color-coded text
- Influence operation handlers with progress rings

**Phase 6: UI Feedback Integration**
- Add UI event emission in `UIManager.updateResources()`
- Resource gain/loss floating text
- Notification and error handlers

**Phase 7: Configuration & Polish**
- Configuration options for VFX intensity
- Reduced motion support (already in FXSystem)
- Test all event triggers
- Tune VFX parameters for visual balance

### VFX Testing Checklist

- [ ] Player hack success shows green burst and text
- [ ] Player hack failure shows red burst
- [ ] Building construction shows celebration burst
- [ ] District entry shows district name
- [ ] Crisis start triggers screen shake
- [ ] Crisis resolution shows celebration
- [ ] Quest completion shows gold burst
- [ ] Clue discovery shows highlight pulse
- [ ] Intel ping shows progress ring
- [ ] Heat changes show color-coded text
- [ ] Influence operations show progress rings
- [ ] All VFX respect reduced motion setting
- [ ] No performance impact on mid-range hardware

### VFX Dependencies

- `src/render/fx/fx_system.js` - VFX system (existing)
- `src/world/particle_pool.js` - Particle system (existing)
- `src/sim/events.js` - Event system (existing)
- `src/renderer3d.js` - Camera shake integration

---

## Recommended Execution Order

| Phase | Focus | Priority |
|-------|-------|----------|
| **Phase 1** | Audio files + building models + camera polish + game feel juice | Highest |
| **Phase 2** | UI framework migration (Svelte/Preact) + split god objects | High |
| **Phase 3** | VFX event integration (see section above) | High |
| **Phase 4** | Hacking loop overhaul + emergent narrative wiring | High |
| **Phase 5** | TypeScript migration (incremental) + WebWorker sim | Medium |
| **Phase 6** | Tauri desktop wrapper + Steam pipeline | Medium |
| **Phase 7** | Balance pass + accessibility + performance to 60fps | Medium |
| **Phase 8** | Modding support + community features | Lower |
| **Phase 9** | Procedural storytelling + living city + photo mode | Lower |

---

## Bottom Line

The simulation core is genuinely impressive -- 25+ interlocking systems with deterministic replay, save/load, and 165 passing tests. The gap to "highest level" is almost entirely in presentation, feel, and player experience:

1. **It needs to look like a game** (models, textures, animations)
2. **It needs to sound like a game** (music, SFX, ambience)
3. **It needs to feel like a game** (juice, transitions, camera work)
4. **It needs to tell stories** (wire the narrative systems together)

The engine is built. Now it needs a soul.
