# QA Checklist

This document outlines manual testing procedures for the city builder game.

## Pre-Flight Checklist

- [ ] All smoke tests pass (`node scripts/smoke_test.mjs`)
- [ ] No console errors when loading game
- [ ] Game renders in browser
- [ ] All keyboard shortcuts work (see [CONTRIBUTING.md](./CONTRIBUTING.md))

---

## Map Size Testing

Test each map preset with a seeded run (seed: 12345):

### SMALL (40x40)
- [ ] Map generates without lag
- [ ] Starting area is centered
- [ ] Terrain types分布 correctly
- [ ] 5x5 grass area at center confirmed
- [ ] Can build houses in starting area

### CITY (96x96)
- [ ] Map loads smoothly
- [ ] Camera pans to center
- [ ] Resource clusters visible
- [ ] Terrain variety is adequate

### MEGA (256x256)
- [ ] Initial load completes within 5 seconds
- [ ] No browser freeze during generation
- [ ] Chunked rendering active if implemented
- [ ] Scroll/pan performance is acceptable

---

## Core Gameplay Flow

### 1. Game Initialization
- [ ] Welcome messages appear
- [ ] Initial house built at center
- [ ] 3 citizens spawned
- [ ] Starting resources shown correctly (110 gold after house)

### 2. Resource Management
- [ ] Gold income from buildings visible
- [ ] Food income from buildings visible
- [ ] Wood income from buildings visible
- [ ] Gold upkeep deducted daily
- [ ] Cannot build when resources insufficient (UI feedback)

### 3. Citizen Management
- [ ] Citizens spawn with jobs automatically
- [ ] Citizens move around map
- [ ] Citizens consume food daily
- [ ] Population grows when housing available
- [ ] Happiness affects productivity

### 4. Building System
- [ ] Building panel opens on click
- [ ] All building types visible
- [ ] Cost tooltips display correctly
- [ ] Placement validation works (green/red indicators)
- [ ] Buildings persist after reload

### 5. Save/Load System
- [ ] Save completes without error
- [ ] Save file created in localStorage
- [ ] Loaded game has same resources
- [ ] Loaded game has same buildings
- [ ] Loaded game has same citizens
- [ ] Tick counter preserved

---

## Crisis Scenarios

### Food Shortage
- [ ] Low food warning appears
- [ ] Citizens become unhappy
- [ ] Population stops growing
- [ ] Food returns to positive after supply restored

### Gold Shortage
- [ ] Bankruptcy warning appears
- [ ] Cannot afford upkeep
- [ ] Building degradation if implemented

### Overcrowding
- [ ] Overcrowding warning appears
- [ ] Happiness penalty applied
- [ ] Population growth halted

---

## Victory Conditions

Test each victory type:

### Military Victory
- [ ] Build military structures
- [ ] Progress bar fills
- [ ] Victory screen appears
- [ ] Game stops after victory

### Economic Victory
- [ ] Build economic structures
- [ ] Progress bar fills
- [ ] Victory screen appears
- [ ] Game stops after victory

### Cultural Victory
- [ ] Build cultural structures
- [ ] Progress bar fills
- [ ] Victory screen appears
- [ ] Game stops after victory

### Technological Victory
- [ ] Build technological structures
- [ ] Progress bar fills
- [ ] Victory screen appears
- [ ] Game stops after victory

---

## Performance Testing

### FPS Monitoring (F3 toggle)
- [ ] Overlay shows FPS
- [ ] FPS stable during idle (~60)
- [ ] FPS acceptable during building placement
- [ ] No FPS drop with multiple citizens

### Memory Monitoring
- [ ] No memory leak after 5 save/load cycles
- [ ] Map generation memory freed after use
- [ ] Buildings properly garbage collected when removed

---

## Browser Compatibility

Test in each browser:

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browser (if responsive)

---

## Edge Cases

- [ ] Build at map edge (95, 95)
- [ ] Build in water (should fail)
- [ ] Build in mountain (check terrain rules)
- [ ] Rapid clicking on building panel
- [ ] Clicking during loading
- [ ] Save with zero resources
- [ ] Load corrupted save file
- [ ] Same seed produces identical results (determinism)

---

## Regression Testing

After any code change, verify:

- [ ] All smoke tests pass (35 tests)
- [ ] Game starts without errors
- [ ] Resources display correctly
- [ ] Buildings can be placed
- [ ] Citizens move and work
- [ ] Save/load works
- [ ] Day cycle advances correctly

---

## Developer Testing

### Headless Mode
- [ ] `headless_game.js` runs without browser
- [ ] `runTicks()` works correctly
- [ ] Deterministic results from same seed
- [ ] Resource sync works between Resources and GameState

### Debug Commands
- [ ] F3 shows performance overlay
- [ ] Debug logging works
- [ ] Logger shows correct levels

---

## Manual Test Run Script

```bash
# Run all automated tests
node scripts/smoke_test.mjs
node scripts/citizen_test.mjs
node scripts/map_test.mjs
node scripts/pay_test.mjs
node scripts/init_gold.mjs

# Then manually verify above checklist items
```