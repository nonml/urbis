# Architecture Overview

This document describes the high-level system architecture of Dynamic City Builder.

## Core Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Layer                                  │
│  - UIManager (3D + DOM + input)                              │
│  - Minimap (canvas rendering)                                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                     Game Loop                                 │
│  - Fixed-timestep simulation (tickRate = 1000ms)            │
│  - Accumulator pattern for frame-rate independence          │
│  - Stable update order per tick                              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   GameState (Single Source of Truth)         │
│  - schemaVersion: 1                                          │
│  - meta: { seed, mapPreset, createdAt, runId }              │
│  - time: { tick, paused, simDt }                            │
│  - resources: { gold, food, wood, ... }                     │
│  - map: { width, height, tiles }                            │
│  - buildings: { list: [...] }                               │
│  - citizens: { list: [...] }                                │
│  - crises: { active, history }                              │
│  - player: { x, y, yaw, pitch }                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Sim Systems                                 │
│  - Resources (helpers on state)                              │
│  - Map (terrain generation + management)                    │
│  - CitizenManager (NPC simulation)                           │
│  - BuildingManager (construction + upgrades)                │
│  - CrisisManager (event system)                              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure                              │
│  - RNG (deterministic xorshift32)                            │
│  - Renderer3D (Three.js instanced rendering)                │
│  - Save/Load (versioned with migrations)                     │
│  - Logger (debug logging with levels)                        │
└─────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### `src/game.js` - Game Coordinator
The main `Game` class orchestrates all systems:
- Initializes systems with reference to `game.state`
- Manages game loop with fixed-timestep simulation
- Exposes public API for UI interaction (`attemptBuild`, `saveGame`, etc.)
- Acts as event bus for cross-system communication

### `src/state/game_state.js` - Single Source of Truth
Contains all serializable state in a single object:
- All data that needs to be saved should be here
- Systems read/write through this object, not their own fields
- Versioned with `schemaVersion` for migration support

### `src/rng.js` - Deterministic RNG
```js
export class RNG {
    constructor(seed)
    next()        // float [0, 1)
    int(min, max) // inclusive integer
    float(min, max)
    chance(p)     // boolean with probability p
}
```
**Must** be used for all randomness. Seed is stored in `game.state.meta.seed`.

### `src/map.js` - Terrain Management
- Generates terrain grid using seeded noise
- Tracks tile types (water, grass, forest, mountain)
- Provides lookup/modification methods
- Uses `RNG` for resource placement

### `src/citizen.js` - NPC Simulation
- `Citizen` class: individual NPC state and daily logic
- `CitizenManager`: population management
- Uses `RNG` for:
  - Birth/death probabilities
  - Personality generation
  - Job assignment
  - Event generation

### `src/buildings.js` - Construction System
- `BuildingManager`: tracks buildings, calculates totals
- Building placement validation
- Upgrade logic
- Victory progress calculation

### `src/resources.js` - Resource Tracking
- `Resources` class: gold, food, wood, population, housing
- Utility methods: `canAfford()`, `pay()`, `add()`, `remove()`
- Crisis condition checks: `isStarving()`, `isBankrupt()`

### `src/crisis.js` - Event System
- `CrisisManager`: triggers and resolves crises
- Pressure-based chance calculation
- Player choice resolution with resource effects

### `src/renderer3d.js` - 3D Rendering
- Three.js instanced rendering for performance
- Terrain: single instanced mesh with color per instance
- Buildings: one instanced mesh per type
- Citizens: single instanced sphere mesh
- Third-person camera with player follow

### `src/ui.js` - UI Manager
- DOM overlay management
- 3D renderer integration
- Input handling (WASD movement, right-drag camera)
- Message log display
- Stats panel

### `src/minimap.js` - 2D Map View
- Canvas-based minimap rendering
- Downsampled terrain display
- Player dot tracking
- Click-to-teleport

## Data Flow

### Initialization
```
index.html → main.js → new Game(options) → game.init()
```

### Game Loop
```
requestAnimationFrame
  ↓
update(realDt)
  ↓
while (accumulator >= tickRate)
  ↓
tickOnce()
  ↓
buildings.production → citizens.update → crises.check → UI.update
```

### Save Flow
```
saveGame()
  ↓
GameState → JSON.stringify
  ↓
localStorage.setItem
```

### Load Flow
```
loadGame()
  ↓
localStorage.getItem → JSON.parse
  ↓
migrate(state) [while schemaVersion < CURRENT]
  ↓
GameState ← state
```

## Key Design Principles

1. **Determinism**: Same seed + same inputs = same outputs
2. **Single Source of Truth**: `GameState` contains all state
3. **Fixed Timestep**: Simulation decoupled from render FPS
4. **Chunked Updates**: Mega maps don't rebuild everything
5. **Versioned Saves**: Migrations enable save compatibility

## Configuration

See `src/constants.js`:
- `MAP_PRESETS`: SMALL, CITY, MEGA (width/height)
- `TERRAIN_*`: Water, Grass, Forest, Mountain
- `BUILDING_TYPES`: All building definitions
- `DIFFICULTY`: Easy, Normal, Hard presets