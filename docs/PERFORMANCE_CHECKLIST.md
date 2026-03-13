# Performance Checklist

## Overview

This checklist ensures the game maintains optimal performance across all systems, particularly after the visual/audio polish updates. Use this guide to verify performance before releases and during development.

## Quick Reference

| Check | Status | Notes |
|-------|--------|-------|
| FPS on MEGA map | ⬜ | Target: 60 FPS minimum |
| Memory usage | ⬜ | Target: < 500MB after 1 hour |
| VFX pooling | ⬜ | No memory leaks |
| Audio crossfading | ⬜ | Smooth transitions |
| Day/night transitions | ⬜ | No frame drops |
| Particle system | ⬜ | Efficient pooling |

## Visual Performance

### VFX System

- [ ] **Object Pooling**: All VFX objects are pooled and reused
  - Floating text pool: max 100 objects
  - Particle burst pool: max 50 objects
  - Progress ring pool: max 30 objects
  - Highlight pulse pool: max 20 objects

- [ ] **DOM Cleanup**: Inactive VFX elements are removed from DOM
  - Check for orphaned elements after VFX completion
  - Verify no memory leaks in long sessions

- [ ] **Reduced Motion**: VFX respects accessibility settings
  - Screen shake disabled when reduced motion enabled
  - Particle count reduced when reduced motion enabled
  - Transitions become instant when reduced motion enabled

### Particle System

- [ ] **Pool Efficiency**: Particle pools are properly managed
  - Pre-allocated pools prevent garbage collection
  - Inactive particles are returned to pool
  - No memory growth over time

- [ ] **Update Performance**: Particle updates are efficient
  - Batch updates where possible
  - Early exit for inactive particles
  - Minimal per-particle overhead

### Lighting System

- [ ] **Day/Night Transitions**: Smooth transitions without frame drops
  - Color interpolation is efficient
  - Star layer visibility toggled appropriately
  - Moon light intensity updated smoothly

- [ ] **Fog Updates**: Fog color transitions are performant
  - No unnecessary fog recreation
  - Color updates use efficient methods

### Renderer

- [ ] **Render Loop**: Clean and efficient
  - No unnecessary operations in render loop
  - VFX and particle systems update efficiently
  - Lighting updates are batched

## Audio Performance

### Audio Mixer

- [ ] **Channel Management**: Audio channels are properly managed
  - No orphaned audio nodes
  - Crossfading is smooth and efficient
  - Volume updates don't cause glitches

- [ ] **Memory Usage**: Audio buffers are managed correctly
  - Ambient loops are properly disposed when changed
  - No memory growth from audio playback

### Soundscape

- [ ] **District Transitions**: Smooth ambience transitions
  - Crossfading between districts is seamless
  - No audio glitches during transitions
  - Time-of-day updates are efficient

- [ ] **Crisis Audio**: Crisis sounds don't interfere with ambience
  - Proper ducking of ambient sounds
  - Crisis stingers play without glitches

## Integration Performance

### Settings System

- [ ] **Theme Changes**: Instant theme application
  - CSS variable updates are immediate
  - No layout thrashing during theme changes
  - Accessibility settings apply without lag

- [ ] **Audio Settings**: Volume changes are responsive
  - Slider updates are smooth
  - No audio glitches during volume changes

### Game Loop

- [ ] **Update Order**: Systems update in correct order
  1. Game state updates
  2. Lighting updates
  3. VFX updates
  4. Particle updates
  5. Audio updates
  6. Render

- [ ] **Delta Time**: All systems use delta time correctly
  - Animations are frame-rate independent
  - Audio updates use accurate timing
  - No speed variations with FPS changes

## Testing Procedures

### Memory Leak Test

1. Start a new game
2. Record initial memory usage
3. Play for 1 hour with active VFX and audio
4. Record final memory usage
5. **Pass**: Memory growth < 50MB

### FPS Test

1. Load MEGA map size
2. Enable all VFX and audio
3. Navigate around the map
4. Perform operations that trigger VFX
5. **Pass**: Maintain 60 FPS minimum, 50 FPS acceptable

### Audio Test

1. Enable all audio channels
2. Walk between different districts
3. Trigger crisis events
4. Adjust volume sliders
5. **Pass**: No glitches, smooth transitions

### Theme Test

1. Cycle through all themes
2. Adjust font scale from 0.8 to 1.5
3. Toggle reduced motion
4. Toggle high contrast
5. **Pass**: All changes apply instantly, no visual glitches

## Performance Metrics

### Target Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| FPS (average) | 60 | 50 |
| FPS (minimum) | 50 | 30 |
| Memory (1 hour) | < 500MB | < 700MB |
| Load time | < 5s | < 10s |
| VFX update time | < 5ms | < 10ms |
| Audio update time | < 2ms | < 5ms |

### Measurement Tools

- **Browser DevTools**: Performance tab for FPS and frame timing
- **Memory Profiler**: Heap snapshot for memory leaks
- **Audio Context**: Monitor active nodes and buffers
- **Custom Overlay**: Use debug overlay for in-game metrics

## Common Issues and Solutions

### Issue: FPS Drops During VFX

**Symptoms**: Frame rate drops when multiple VFX are active

**Solutions**:
1. Reduce maximum pool sizes
2. Simplify VFX geometry
3. Batch VFX updates
4. Use reduced motion setting

### Issue: Memory Growth Over Time

**Symptoms**: Memory usage increases steadily during gameplay

**Solutions**:
1. Check for orphaned DOM elements
2. Verify audio buffer disposal
3. Ensure particle pool cleanup
4. Check for event listener leaks

### Issue: Audio Glitches

**Symptoms**: Popping, crackling, or silence during audio playback

**Solutions**:
1. Increase audio context size
2. Check for audio node leaks
3. Verify crossfade timing
4. Reduce simultaneous audio sources

### Issue: Theme Changes Lag

**Symptoms**: Delay when switching themes or adjusting settings

**Solutions**:
1. Minify CSS variable updates
2. Batch DOM updates
3. Avoid layout thrashing
4. Use requestAnimationFrame for updates

## Pre-Release Checklist

Before any release, verify:

- [ ] All performance tests pass
- [ ] Memory usage is stable
- [ ] FPS targets are met on target hardware
- [ ] Audio plays without glitches
- [ ] Theme changes are instant
- [ ] Accessibility settings work correctly
- [ ] No console errors related to performance
- [ ] Debug overlay shows healthy metrics

## Hardware Requirements

### Minimum

- **CPU**: Dual-core 2.0 GHz
- **RAM**: 4 GB
- **GPU**: WebGL 2.0 support
- **Browser**: Modern browser (Chrome 90+, Firefox 88+, Safari 14+)

### Recommended

- **CPU**: Quad-core 3.0 GHz
- **RAM**: 8 GB
- **GPU**: Dedicated GPU with 2GB VRAM
- **Browser**: Latest version of Chrome, Firefox, or Edge

## Notes

- Performance may vary based on map size and city complexity
- MEGA maps require higher-end hardware for optimal performance
- Reduced motion setting significantly improves performance on low-end devices
- Audio performance depends on browser audio context implementation

## References

- [VFX System](src/render/fx/fx_system.js:1)
- [Particle Pool](src/world/particle_pool.js:1)
- [Lighting Manager](src/render/lighting/day_night.js:1)
- [Audio Mixer](src/audio/mixer.js:1)
- [Soundscape](src/audio/soundscape.js:1)
- [Theme Manager](src/ui/theme.js:1)
