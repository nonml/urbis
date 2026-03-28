# Audio System Documentation

## Overview

The audio system provides immersive procedural sound generation and ambient audio for the city builder game. It consists of multiple interconnected components that work together to create a dynamic audio environment.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Game (game.js)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   UIManager (ui.js)                         │
│  - Creates AudioManager on UI initialization                │
│  - Triggers audio initialization on first user interaction  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                AudioManager (audio_manager.js)              │
│  - Web Audio API wrapper                                    │
│  - Manages audio context and master gain                    │
│  - Coordinates SFXGenerator, Mixer, Soundscape              │
└─────────────────────────────────────────────────────────────┘
         │                    │              │
         ▼                    ▼              ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
│ SFXGenerator    │  │  AudioMixer  │  │  Soundscape     │
│ (sfx_generator) │  │  (mixer.js)  │  │ (soundscape.js) │
└─────────────────┘  └──────────────┘  └─────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐
│ Procedural SFX  │                  │ Ambient Audio   │
│ - Oscillators   │                  │ - Time of Day   │
│ - Noise Buffers │                  │ - District      │
│ - Arpeggios     │                  │ - City State    │
└─────────────────┘                  └─────────────────┘
```

## Components

### AudioManager (`src/audio/audio_manager.js`)

The central audio manager that coordinates all audio subsystems.

**Key Responsibilities:**
- Initialize Web Audio API context
- Create and manage gain nodes for volume control
- Coordinate SFX playback through SFXGenerator
- Manage ambient audio through Soundscape
- Handle mute/unmute functionality
- Update volumes based on settings

**Key Methods:**
```javascript
// Initialize audio (must be called after user gesture)
await audioManager.initialize()

// Play procedural SFX
audioManager.playSFX('BUILD_PLACE', { volume: 0.8 })

// Play building-specific placement sound
audioManager.playBuildingPlace('house')

// Update all volumes from settings
audioManager.updateVolumes()

// Mute/unmute
audioManager.mute()
audioManager.unmute()
```

**Audio Channels:**
- `master` - Master volume control
- `sfx` - Sound effects channel
- `ambient` - Ambient/background audio
- `music` - Music channel (procedural)
- `crisis` - Crisis/alert sounds

### SFXGenerator (`src/audio/sfx_generator.js`)

Procedural sound effect generator using Web Audio API oscillators and noise buffers.

**Features:**
- No external audio files required
- Real-time sound synthesis
- Configurable parameters per SFX type

**SFX Types (defined in `src/constants.js`):**
| SFX Type | Description |
|----------|-------------|
| `BUILD_PLACE` | Building placement confirmation |
| `BUILD_DEMOLISH` | Building demolition |
| `BUILD_INVALID` | Invalid building placement |
| `UI_CLICK` | UI click feedback |
| `UI_HOVER` | UI hover feedback |
| `UI_SLIDER` | Slider adjustment |
| `UI_SUCCESS` | Success notification |
| `UI_ERROR` | Error notification |
| `CRISIS_ALERT` | Crisis alert sound |
| `CRISIS_WARNING` | Crisis warning |
| `CRISIS_RESOLVED` | Crisis resolved |
| `HACK_SUCCESS` | Hack success |
| `HACK_FAIL` | Hack failure |
| `HACK_PROGRESS` | Hack in progress |
| `RESOURCE_GAIN` | Resource gain |
| `RESOURCE_LOSS` | Resource loss |
| `RESOURCE_LOW` | Low resource warning |

**Usage:**
```javascript
// Play any SFX type
audioManager.playSFX('UI_CLICK')

// With custom options
audioManager.playSFX('RESOURCE_GAIN', {
    volume: 0.5,
    pitch: 1.2
})
```

### Soundscape (`src/audio/soundscape.js`)

Dynamic ambient audio system based on game state.

**Features:**
- Time-of-day ambient transitions
- District-based ambient switching
- City state (quiet/normal/busy/crisis) audio
- Crisis layer integration
- Smooth crossfading between states

**State Tracking:**
```javascript
soundscape.currentTimeOfDay    // 0-1 (0 = midnight, 0.5 = noon)
soundscape.currentCityState    // 'quiet' | 'normal' | 'busy' | 'crisis'
soundscape.currentDistrict     // 'residential' | 'commercial' | etc.
soundscape.populationLevel     // Current population
soundscape.crisisLevel         // 0-1 crisis intensity
```

**District Audio Configuration:**
| District | Volume | Pitch | Activity |
|----------|--------|-------|----------|
| residential | 0.8 | 1.0 | low |
| commercial | 1.0 | 1.1 | high |
| industrial | 0.9 | 0.9 | medium |
| waterfront | 0.7 | 1.0 | low |
| elite | 0.6 | 1.2 | low |

**Usage:**
```javascript
// Called automatically by audioManager.updateVolumes()
soundscape.update()

// Manual updates
soundscape.updateTimeOfDay(0.5)  // noon
soundscape.updateCityState()      // based on population
soundscape.updateDistrictAmbient('commercial')
```

### AudioMixer (`src/audio/mixer.js`)

Multi-channel audio mixer with crossfading support.

**Features:**
- Independent channel volume control
- Crossfading between states
- Mute/solo per channel
- State export/import for persistence

**Channels:**
- `ambient` - Background ambient sounds
- `ui` - UI feedback sounds
- `sfx` - Game sound effects
- `music` - Procedural music
- `crisis` - Crisis/alert layer

**Usage:**
```javascript
const mixer = audioManager.mixer

// Set volume with crossfade
mixer.setVolume('sfx', 0.5, 1.0)  // volume, duration in seconds

// Mute/unmute
mixer.mute('music')
mixer.unmute('music')

// Crossfade between channels
mixer.crossfade('ambient', 'music', 2.0)
```

### ProceduralMusic (`src/audio/procedural_music.js`)

Tone.js-based procedural music engine (optional, dynamically loaded).

**Features:**
- Dynamic music generation
- Scale-based harmonization (maps game happiness to musical scale)
- Tension layer for crisis states
- BPM adjustment based on city activity

**Usage:**
```javascript
const music = game.ui.proceduralMusic

// Start/stop
music.start()
music.stop()

// Set volume
music.setVolume(0.5)

// Auto-syncs to game state
music._syncToGameState()
```

## Integration Points

### Game Startup Flow

1. `UIManager` is created in `game.js`
2. `audioManager` is instantiated as part of `UIManager`
3. Audio initialization is triggered on first user interaction (click/keydown)
4. Browser autoplay policy compliance

```javascript
// In ui.js
const _initAudio = async () => {
    if (this.audioManager && !this.audioManager.isInitialized) {
        await this.audioManager.initialize();
    }
    window.removeEventListener('click', _initAudio);
    window.removeEventListener('keydown', _initAudio);
};
window.addEventListener('click', _initAudio, { once: true });
window.addEventListener('keydown', _initAudio, { once: true });
```

### Audio Hooks

**Hacking System (`src/game.js`):**
```javascript
// On hack success
this.audioManager?.playHackSuccess();

// On hack fail
this.audioManager?.playHackFail();
```

**Resource Changes (`src/resources.js`):**
```javascript
// On resource gain
this.audioManager?.playSFX('RESOURCE_GAIN', {
    volume: Math.min(1, amount / 100)
});

// On resource loss (significant)
this.audioManager?.playSFX('RESOURCE_LOSS', {
    volume: Math.min(1, amount / 100)
});

// On low resource threshold
this.audioManager?.playSFX('RESOURCE_LOW', { resource: resource });
```

**Building Placement (`src/game.js`):**
```javascript
// In attemptBuild method
this.audioManager?.playBuildingPlace(buildingType);
```

**UI Interactions (`src/ui.js`):**
```javascript
// In playUISound method
this.audioManager?.playSFX(soundName, options);
```

## Testing

### Audio Test Script

Run `scripts/audio_test.mjs` in the browser console to test all audio systems:

```javascript
// In browser console after game loads
await import('./scripts/audio_test.mjs');
testAudioSystem();
```

**Tests performed:**
1. AudioManager initialization
2. All 17 SFX types
3. Building-specific SFX
4. UI sounds
5. Crisis sounds
6. Ambient control
7. Volume levels (0, 0.25, 0.5, 0.75, 1.0)
8. Mute/unmute
9. Procedural music sync
10. Soundscape updates
11. District-based ambient switching

### Debug Overlay

Access audio debug overlay via Dev Menu (F1):

1. Press F1 to open Dev Menu
2. Select "Toggle Audio Debug"
3. Overlay shows:
   - Audio system status
   - Player position and district
   - Current ambient state
   - Volume levels per channel
   - Quick test buttons

**Keyboard shortcut:** `Ctrl+Alt+A` (if configured)

## Settings

Audio settings are managed through `src/ui/settings.js`:

```javascript
settings.set('audioVolume', 0.7)   // Master volume
settings.set('musicVolume', 0.5)   // Music volume
settings.set('sfxVolume', 0.8)     // SFX volume
settings.set('mute', false)        // Mute state
```

Settings persist via localStorage.

## Adding New SFX

1. Define SFX type in `src/constants.js`:
```javascript
export const SFX = {
    // ... existing
    CUSTOM_EVENT: 'custom_event'
};

export const SFX_PARAMS = {
    // ... existing
    [SFX.CUSTOM_EVENT]: {
        type: 'synth',
        oscillator: {
            type: 'sine',
            frequency: 440,
            attack: 0.1,
            decay: 0.3,
            sustain: 0.5,
            release: 0.2
        },
        volume: 0.5,
        pitch: 1.0
    }
};
```

2. Add method to AudioManager:
```javascript
playCustomEvent(options = {}) {
    return this.playSFX('CUSTOM_EVENT', options);
}
```

3. Integrate into game logic:
```javascript
this.audioManager?.playCustomEvent({ volume: 0.7 });
```

## Performance Considerations

- SFX are generated procedurally, no file loading overhead
- Audio context is created once and reused
- Gain nodes used for volume control (efficient)
- Crossfading uses Web Audio API's `setTargetAtTime` for smooth transitions
- Procedural music is optional and dynamically loaded

## Browser Compatibility

- Web Audio API supported in all modern browsers
- Autoplay policy requires user gesture for initialization
- Tested in Chrome, Firefox, Edge

## Future Enhancements

1. **3D Spatial Audio**: Position-based audio for immersive experience
2. **Reverb Zones**: Different acoustic environments per district
3. **Dynamic Instrument Selection**: Based on city development
4. **Voice Lines**: Procedural or triggered dialogue
5. **Audio Presets**: Quick settings for different play styles
6. **Accessibility**: Mono audio, visual alternatives to audio cues

## Troubleshooting

**Audio not playing:**
- Check `audioManager.isInitialized` - must be true
- Verify browser hasn't muted the tab
- Check `audioManager.isMuted` state
- Ensure user interaction occurred (click/keydown)

**Distorted audio:**
- Reduce volume levels in settings
- Check for multiple audio contexts (should only be one)

**No district ambient change:**
- Verify player position updates
- Check `soundscape.currentDistrict` matches player district
- Ensure `soundscape.update()` is being called

## References

- [`src/audio/audio_manager.js`](../src/audio/audio_manager.js) - Main audio manager
- [`src/audio/sfx_generator.js`](../src/audio/sfx_generator.js) - Procedural SFX
- [`src/audio/soundscape.js`](../src/audio/soundscape.js) - Ambient system
- [`src/audio/mixer.js`](../src/audio/mixer.js) - Channel mixing
- [`src/audio/procedural_music.js`](../src/audio/procedural_music.js) - Music engine
- [`src/constants.js`](../src/constants.js#L531-L663) - SFX parameters
- [`scripts/audio_test.mjs`](../scripts/audio_test.mjs) - Test script
