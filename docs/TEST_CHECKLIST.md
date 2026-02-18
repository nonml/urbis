# Testing Checklist

This checklist ensures consistent testing across Milestone A work.

## Automated Tests

### Smoke Test
```bash
node scripts/smoke_test.mjs
```
**Checks:**
- Resources stay non-negative
- No NaNs in citizen stats
- Tile bounds valid
- No infinite loops

## Manual Testing

### By Map Size

#### Small (40×40)
- [ ] Game loads in < 2 seconds
- [ ] Save/load works
- [ ] 15-minute play session without crashes
- [ ] FPS stays above 30

#### City (96×96)
- [ ] Game loads in < 5 seconds
- [ ] Save/load works
- [ ] 15-minute play session without crashes
- [ ] FPS stays above 30

#### Mega (256×256)
- [ ] Game loads in < 15 seconds
- [ ] Save/load works
- [ ] Place 10 buildings - FPS doesn't drop significantly
- [ ] Move player around - no stuttering
- [ ] FPS stays above 30

### By Feature

#### Resources
- [ ] Gold/food/wood increase from buildings
- [ ] Gold/food/wood decrease with upkeep
- [ ] Cannot build when under-resourced (shows error)
- [ ] Food consumption reduces food supply
- [ ] Empty food causes unhappiness

#### Buildings
- [ ] Can place house on grass
- [ ] Cannot place on water
- [ ] Cannot place too far from existing buildings
- [ ] Buildings provide correct income/upkeep
- [ ] Upgrade works (if implemented)
- [ ] Destroy works (if implemented)

#### Citizens
- [ ] Spawns when housing available
- [ ] Ages increment randomly
- [ ] Jobs assigned based on building availability
- [ ] Unemployed citizens lose happiness
- [ ] Death triggers at age > 80 or happiness <= 0

#### Crises
- [ ] Crisis triggers under pressure (low food/gold, overcrowding, low happiness)
- [ ] Crisis options display correctly
- [ ] Selecting option affects resources
- [ ] Ignoring crisis can cause escalation

#### UI
- [ ] Message log updates
- [ ] Stats panel shows correct data
- [ ] Map changes trigger minimap update
- [ ] Camera controls work (right-drag)
- [ ] WASD movement works
- [ ] Click tile to inspect info

#### Save/Load
- [ ] Save creates localStorage entry
- [ ] Load restores all state
- [ ] Loaded game continues from saved day
- [ ] Loaded game has same seed

### Performance Testing

#### F3 Overlay (if implemented)
Enable with `F3` key:
- [ ] FPS displays correctly (smoothed)
- [ ] Draw calls shown
- [ ] Instance counts accurate
- [ ] Tick time shown in ms

#### Profiling Checks
- [ ] No memory leaks after 30 minutes
- [ ] Chunk counts stable (not increasing)
- [ ] Canvas size appropriate for display
- [ ] Three.js cleanup removes old meshes

## Regression Testing

Before each release:
1. Run smoke test
2. Test with all map sizes
3. Test save/load cycle 3x
4. Play 15-minute session
5. Check F3 overlay for perf issues

## Filing Bugs

When filing a bug:
1. **Title:** Clear, one-line description
2. **Steps:** Numbered reproduction steps
3. **Expected:** What should happen
4. **Actual:** What actually happened
5. **Environment:**
   - Map size
   - Seed (if known)
   - Day number
   - Browser version
6. **Console Output:** Any error messages
7. **Screenshot:** If visual issue