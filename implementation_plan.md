# Implementation Plan

## Overview
Enhance the City Builder game with visual polish, gameplay improvements, quality-of-life features, and technical refinements to create a more engaging and polished player experience.

## Scope
This implementation focuses on four key areas:
1. Visual & Audio Polish - Day/night cycle, improved animations, particle effects
2. Gameplay Depth - New buildings, improved economy balancing, victory conditions
3. Quality of Life - Better tutorials, improved UI feedback, accessibility features
4. Technical Improvements - Performance optimizations, better error handling

---

## [Types]
New data structures and type definitions:

### DayNightCycle Config
```javascript
{
  cycleLength: number,        // Total cycle duration in game ticks
  phases: {
    dawn: { start: number, end: number, color: string },
    day: { start: number, end: number, color: string },
    dusk: { start: number, end: number, color: string },
    night: { start: number, end: number, color: string }
  }
}
```

### BuildingTier Enum
```javascript
{
  BASIC: 1,      // Starting buildings
  ADVANCED: 2,   // Unlocked through progression
  SPECIAL: 3,    // Special/landmark buildings
  UPGRADE: 4     // Building upgrades
}
```

### VictoryCondition Schema
```javascript
{
  type: string,           // 'population', 'economy', 'influence', 'survival'
  threshold: number,      // Required value
  progress: number,       // Current progress (0-100)
  unlocked: boolean       // Whether condition is active
}
```

---

## [Files]

### New Files to Create
1. `src/sim/day_night.js` - Day/night cycle manager with lighting transitions
2. `src/sim/victory_conditions.js` - Victory condition tracking and evaluation
3. `src/ui/victory_screen.js` - Victory/defeat screen with statistics
4. `src/buildings_extended.js` - Additional building types and upgrades
5. `src/economy/balancer.js` - Economy balancing utilities and adjustments
6. `src/ui/tutorial_overlay.js` - Enhanced tutorial tooltips and guidance
7. `src/audio/soundscape.js` - Dynamic ambient audio based on city state
8. `assets/i18n/en_extended.json` - Additional localization strings

### Files to Modify
1. `src/game.js` - Integrate day/night cycle, victory conditions, extended buildings
2. `src/ui.js` - Add victory screen, tutorial overlay integration
3. `src/renderer3d.js` - Add lighting transitions, particle effects
4. `src/constants.js` - Add new building types, building tiers
5. `src/audio/audio_manager.js` - Add soundscape integration
6. `src/sim/citizens/household.js` - Add happiness modifiers from city services
7. `src/sim/economy/demand.js` - Balance adjustments for better gameplay
8. `index.html` - Add victory/defeat screen HTML elements
9. `src/style.css` - Add styles for new UI elements

---

## [Functions]

### New Functions to Add

1. **`src/sim/day_night.js`**
   - `createDayNightCycle(config)` - Factory function creating cycle manager
   - `update(dt)` - Update cycle progress and return current lighting state
   - `getPhase()` - Return current phase (dawn/day/dusk/night)
   - `getLightColor()` - Return current ambient light color

2. **`src/sim/victory_conditions.js`**
   - `createVictoryManager(state)` - Create victory condition tracker
   - `checkConditions(state)` - Evaluate all victory conditions
   - `getProgress(type)` - Get progress for specific condition
   - `triggerVictory(condition)` - Trigger victory sequence

3. **`src/ui/victory_screen.js`**
   - `createVictoryScreen(game)` - Create victory screen UI
   - `show(condition, stats)` - Display victory screen with statistics
   - `hide()` - Hide victory screen

4. **`src/ui/tutorial_overlay.js`**
   - `createTutorialOverlay(game)` - Create tutorial overlay manager
   - `showTip(element, message, position)` - Show contextual tooltip
   - `highlightElement(selector, options)` - Highlight UI element
   - `startSequence(steps)` - Start tutorial sequence

5. **`src/audio/soundscape.js`**
   - `createSoundscape(audioManager, game)` - Create dynamic soundscape
   - `update(cityState)` - Update audio based on city state
   - `setIntensity(level)` - Set ambient intensity (0-1)

### Functions to Modify

1. **`src/game.js`**
   - `constructor()` - Initialize dayNightCycle, victoryManager
   - `tickOnce()` - Update day/night cycle, check victory conditions
   - `init()` - Initialize soundscape, tutorial system

2. **`src/renderer3d.js`**
   - `render()` - Apply day/night lighting, add particle effects
   - `syncPlayer()` - Update player position for lighting calculations

3. **`src/ui.js`**
   - `render()` - Integrate tutorial overlay rendering
   - `showMessage()` - Add animated toast notifications
   - `updateStats()` - Add victory progress indicators

---

## [Classes]

### New Classes

1. **DayNightCycle** (`src/sim/day_night.js`)
   - Properties: `phase`, `progress`, `config`, `lightColor`
   - Methods: `update()`, `getPhase()`, `getLightColor()`, `setSpeed()`

2. **VictoryManager** (`src/sim/victory_conditions.js`)
   - Properties: `conditions`, `completedConditions`, `gameState`
   - Methods: `checkConditions()`, `getProgress()`, `triggerVictory()`

3. **Soundscape** (`src/audio/soundscape.js`)
   - Properties: `audioManager`, `layers`, `intensity`
   - Methods: `update()`, `setLayerVolume()`, `crossfade()`

### Modified Classes

1. **UIManager** (`src/ui.js`)
   - Add properties: `victoryScreen`, `tutorialOverlay`, `soundscape`
   - Add methods: `showVictoryScreen()`, `showTutorialTip()`

2. **Renderer3D** (`src/renderer3d.js`)
   - Add properties: `dayNightCycle`, `particleSystem`
   - Modify: `render()` to apply lighting and particles

---

## [Dependencies]

### New Dependencies
- None required (using existing Three.js and Web Audio API)

### Modified Dependencies
- No package.json changes needed

---

## [Testing]

### Test Coverage Required
1. Day/night cycle transitions (visual verification)
2. Victory condition evaluation (unit tests)
3. Soundscape intensity changes (audio verification)
4. Tutorial overlay positioning (visual tests)
5. Building placement with new types (integration tests)

### Existing Test Modifications
- Update `scripts/smoke_test.mjs` to verify new systems initialize
- Add `scripts/victory_test.mjs` for victory condition testing
- Update `tests/playwright/ui.spec.js` for new UI elements

---

## [Implementation Order]

1. **Phase 1: Visual Foundation**
   - Create `src/sim/day_night.js` with basic cycle
   - Integrate into `src/renderer3d.js` for lighting
   - Test visual transitions

2. **Phase 2: Victory System**
   - Create `src/sim/victory_conditions.js`
   - Add victory screen UI in `src/ui/victory_screen.js`
   - Integrate into `src/game.js` for condition checking

3. **Phase 3: Audio Enhancement**
   - Create `src/audio/soundscape.js`
   - Integrate with existing AudioManager
   - Add city-state-based audio layers

4. **Phase 4: Building Expansion**
   - Create `src/buildings_extended.js` with new buildings
   - Add to `src/constants.js` building definitions
   - Integrate into build menu

5. **Phase 5: Tutorial & QoL**
   - Create `src/ui/tutorial_overlay.js`
   - Add contextual tips for new features
   - Improve existing tutorial flow

6. **Phase 6: Economy Balancing**
   - Create `src/economy/balancer.js`
   - Adjust building costs and outputs
   - Test with various seeds

7. **Phase 7: Polish & Testing**
   - Add particle effects to renderer
   - Test all systems together
   - Fix bugs and edge cases

---

## Implementation Notes

### Day/Night Cycle
- Cycle should complete every 24 game hours (configurable)
- Smooth transitions between phases
- Affects lighting color and intensity
- Citizens should have different behavior at night (reduced movement)

### Victory Conditions
- Population Victory: Reach 1000 citizens
- Economy Victory: Accumulate 10,000 gold
- Influence Victory: Reach 100 influence score
- Survival Victory: Survive 100 days without bankruptcy

### New Buildings
- **Wind Turbine**: Renewable power, lower output but no fuel cost
- **School**: Increases citizen education, improves job matching
- **Park**: Increases happiness, reduces crime in area
- **Market**: Boosts commercial revenue, creates jobs
- **Data Center**: High power usage, generates intel income

### Economy Adjustments
- Increase base tax income by 15%
- Reduce building maintenance costs by 10%
- Add diminishing returns on large populations
- Balance job creation vs housing capacity

### Quality of Life
- First-time player tutorial with step-by-step guidance
- Contextual tooltips on hover
- Improved error messages for failed actions
- Quick save/load with F5/F9 keys
- Auto-save every 10 game days