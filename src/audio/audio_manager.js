// Audio Manager - Handles game audio with Web Audio API
// Supports: ambient loops, footsteps, UI sounds, crisis stinger
// Audio assets are loaded from assets/audio/ directory

import { SETTINGS_KEYS, DEFAULT_SETTINGS } from '../stores/settings.js';
import { createSoundscape } from './soundscape.js';
import { createAudioMixer, AUDIO_CHANNELS, MIXER_PRESETS } from './mixer.js';

// Audio source configuration (paths can be placeholders for development)
export const AUDIO_SOURCES = {
    // Ambient loops (real MP3/OGG files downloaded from OpenGameArt CC0)
    ambient_urban: 'assets/audio/ambient/urban_loop.mp3',
    ambient_night: 'assets/audio/ambient/night_loop.ogg',

    // UI sounds (procedurally generated WAV via scripts/gen_sfx.mjs)
    ui_click: 'assets/audio/ui/click.wav',
    ui_slider: 'assets/audio/ui/slider.wav',
    ui_success: 'assets/audio/ui/success.wav',
    ui_error: 'assets/audio/ui/error.wav',

    // Crisis sounds
    crisis_stinger: 'assets/audio/crisis/stinger.wav',
    crisis_warning: 'assets/audio/crisis/warning.wav',

    // Footsteps
    footsteps_grass: 'assets/audio/footsteps/grass.wav',
    footsteps_urban: 'assets/audio/footsteps/urban.wav',

    // Building sounds
    build_success: 'assets/audio/build/build.wav',
};

// District theme mappings
export const DISTRICT_AMBIENT = {
    residential: 'ambient_night',
    commercial: 'ambient_urban',
    industrial: 'ambient_urban',
    mixed: 'ambient_urban',
    default: 'ambient_night',
};

/**
 * Audio Manager class
 * Uses Web Audio API for synthesis where assets aren't available
 */
export class AudioManager {
    constructor(game) {
        this.game = game;
        this.settings = game?.ui?.settings || null;
        if (!this.settings) {
            this.settings = {
                get: (key) => DEFAULT_SETTINGS[key],
                set: () => {}
            };
        }

        this.context = null;
        this.masterGain = null;
        this.ambientSource = null;
        this.ambientGain = null;
        this.footstepGain = null;
        this.uiGain = null;
        this.crisisGain = null;

        this.ambientLoop = null;
        this.ambientLoopGain = null;
        this.ambientGainNode = null;

        this.isInitialized = false;
        this.canPlay = false;

        // Current district theme for ambient
        this.currentTheme = 'residential';
        
        // Soundscape system
        this.soundscape = null;
        
        // Audio mixer for channel management
        this.mixer = null;
    }

    /**
     * Initialize audio context (must be called after user interaction)
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.settings.get('masterVolume');
            this.masterGain.connect(this.context.destination);

            // Create gain nodes for different audio types
            this.ambientGain = this.context.createGain();
            this.ambientGain.gain.value = this.settings.get('audioVolume');
            this.ambientGain.connect(this.masterGain);

            this.footstepGain = this.context.createGain();
            this.footstepGain.gain.value = this.settings.get('masterVolume') * 0.3;
            this.footstepGain.connect(this.masterGain);

            this.uiGain = this.context.createGain();
            this.uiGain.gain.value = this.settings.get('uiVolume');
            this.uiGain.connect(this.masterGain);

            this.crisisGain = this.context.createGain();
            this.crisisGain.gain.value = this.settings.get('masterVolume');
            this.crisisGain.connect(this.masterGain);

            this.isInitialized = true;
            this.canPlay = true;

            // Resume context if suspended
            if (this.context.state === 'suspended') {
                await this.context.resume();
            }

            // Start ambient if available
            await this.startAmbient();

            // Initialize soundscape system
            this.soundscape = createSoundscape(this, game);
            this.soundscape.initialize();

            // Initialize audio mixer
            this.mixer = createAudioMixer(this.context, this.masterGain);

        } catch (e) {
            console.warn('Audio initialization failed:', e);
            this.canPlay = false;
        }
    }

    /**
     * Resume audio context
     */
    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    /**
     * Start ambient loop for current district
     */
    async startAmbient() {
        if (!this.canPlay) return;

        try {
            // Check if we have audio files
            const theme = this.currentTheme;
            const sourceKey = DISTRICT_AMBIENT[theme] || DISTRICT_AMBIENT.default;
            const src = AUDIO_SOURCES[sourceKey];

            // Try to load from assets
            if (await this.checkAudioAsset(src)) {
                await this.loadAmbientLoop(src);
            } else {
                // Fallback to synthesized ambient
                this.ambientLoop = this.createSynthesizedAmbient(60, 'deep'); // 60 BPM
            }
        } catch (e) {
            console.warn('Ambient audio failed:', e);
        }
    }

    /**
     * Check if audio asset exists via HEAD request
     */
    async checkAudioAsset(src) {
        try {
            const r = await fetch(src, { method: 'HEAD' });
            return r.ok;
        } catch {
            return false;
        }
    }

    /**
     * Load ambient loop from audio file
     */
    async loadAmbientLoop(src) {
        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

            const source = this.context.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;

            this.ambientLoopGain = this.context.createGain();
            this.ambientLoopGain.gain.value = this.settings.get('audioVolume');
            this.ambientLoopGain.connect(this.ambientGain);

            source.connect(this.ambientLoopGain);
            source.start();

            this.ambientLoop = source;
        } catch (e) {
            console.warn('Failed to load ambient audio:', src, e);
        }
    }

    /**
     * Create synthesized ambient loop (fallback)
     */
    createSynthesizedAmbient(bpm, type = 'deep') {
        const interval = 60000 / bpm;

        const playTone = (time, freq, type = 'sine', duration = 0.5) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(gain);
            gain.connect(this.ambientGain);
            osc.start(time);
            osc.stop(time + duration);
        };

        // Generate ambient tones periodically
        setInterval(() => {
            const time = this.context.currentTime;
            const baseFreq = type === 'deep' ? 110 : 220;
            const freqs = [
                baseFreq,
                baseFreq * 1.5,
                baseFreq * 1.25
            ];
            const idx = (() => {
            const cryptoObj = globalThis.crypto;
            if (cryptoObj && cryptoObj.getRandomValues) {
                const b = new Uint32Array(1);
                cryptoObj.getRandomValues(b);
                return b[0] % freqs.length;
            }
            return 0;
        })();
        playTone(time, freqs[idx]);
        }, interval);

        return { stop: () => {} };
    }

    /**
     * Stop ambient loop
     */
    stopAmbient() {
        if (this.ambientLoop) {
            try {
                this.ambientLoop.stop();
            } catch (e) {
                // Ignore
            }
        }
        if (this.ambientLoopGain) {
            this.ambientLoopGain.disconnect();
        }
    }

    /**
     * Change ambient based on district
     */
    changeAmbient(theme) {
        this.currentTheme = theme;
        this.stopAmbient();
        this.startAmbient();
    }

    /**
     * Play UI click sound
     */
    playClick() {
        if (!this.canPlay) return;
        this.playSynthSound('click');
    }

    /**
     * Play UI slider sound
     */
    playSlider() {
        if (!this.canPlay) return;
        this.playSynthSound('slider');
    }

    /**
     * Play success sound
     */
    playSuccess() {
        if (!this.canPlay) return;
        this.playSynthSound('success');
    }

    /**
     * Play error sound
     */
    playError() {
        if (!this.canPlay) return;
        this.playSynthSound('error');
    }

    /**
     * Play crisis stinger
     */
    playCrisisStinger() {
        if (!this.canPlay) return;
        this.playSynthSound('stinger');
    }

    /**
     * Play building build sound
     */
    playBuild() {
        if (!this.canPlay) return;
        this.playSynthSound('build');
    }

    /**
     * Play footstep sound
     */
    playFootstep() {
        if (!this.canPlay) return;
        this.playSynthSound('footstep');
    }

    /**
     * Play synthesized sound effect
     */
    playSynthSound(type) {
        if (!this.context) return;

        const time = this.context.currentTime;
        const gainNode = this.context.createGain();
        gainNode.connect(this.uiGain);

        let osc = null;

        switch (type) {
            case 'click':
                osc = this.context.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, time);
                osc.frequency.exponentialRampToValueAtTime(400, time + 0.1);
                gainNode.gain.setValueAtTime(0.2, time);
                gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.1);
                break;

            case 'slider':
                osc = this.context.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, time);
                osc.frequency.linearRampToValueAtTime(300, time + 0.1);
                gainNode.gain.setValueAtTime(0.1, time);
                gainNode.gain.linearRampToValueAtTime(0.01, time + 0.1);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.1);
                break;

            case 'success':
                osc = this.context.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, time); // C5
                osc.frequency.setValueAtTime(659.25, time + 0.1); // E5
                osc.frequency.setValueAtTime(783.99, time + 0.2); // G5
                gainNode.gain.setValueAtTime(0.15, time);
                gainNode.gain.linearRampToValueAtTime(0, time + 0.4);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.4);
                break;

            case 'error':
                osc = this.context.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.linearRampToValueAtTime(100, time + 0.2);
                gainNode.gain.setValueAtTime(0.15, time);
                gainNode.gain.linearRampToValueAtTime(0, time + 0.3);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.3);
                break;

            case 'stinger':
                // Crisis stinger - dramatic downward sweep
                osc = this.context.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, time);
                osc.frequency.exponentialRampToValueAtTime(50, time + 0.8);
                gainNode.gain.setValueAtTime(0.4, time);
                gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.8);

                // Add a second harmony
                const osc2 = this.context.createOscillator();
                osc2.type = 'square';
                osc2.frequency.setValueAtTime(250, time);
                osc2.frequency.exponentialRampToValueAtTime(30, time + 0.8);
                const gain2 = this.context.createGain();
                gain2.gain.setValueAtTime(0.3, time);
                gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
                osc2.connect(gain2);
                gain2.connect(this.crisisGain);
                osc2.start(time);
                osc2.stop(time + 0.8);
                break;

            case 'build':
                osc = this.context.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, time);
                osc.frequency.linearRampToValueAtTime(554, time + 0.1); // A to C#
                osc.frequency.linearRampToValueAtTime(659, time + 0.2); // E
                gainNode.gain.setValueAtTime(0.2, time);
                gainNode.gain.linearRampToValueAtTime(0, time + 0.4);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.4);
                break;

            case 'footstep':
                osc = this.context.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, time);
                gainNode.gain.setValueAtTime(0.08, time);
                gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.1);
                break;
        }
    }

    /**
     * Update volumes based on settings
     */
    updateVolumes() {
        if (!this.context) return;

        const masterVol = this.settings.get('masterVolume');
        const uiVol = this.settings.get('uiVolume');
        const audioVol = this.settings.get('audioVolume');

        if (this.masterGain) {
            this.masterGain.gain.value = masterVol;
        }
        if (this.ambientGain) {
            this.ambientGain.gain.value = audioVol;
        }
        if (this.ambientLoopGain) {
            this.ambientLoopGain.gain.value = audioVol;
        }
        if (this.uiGain) {
            this.uiGain.gain.value = uiVol;
        }
        
        // Update mixer channel volumes
        if (this.mixer) {
            this.mixer.setVolume(AUDIO_CHANNELS.AMBIENT, audioVol, 0);
            this.mixer.setVolume(AUDIO_CHANNELS.UI, uiVol, 0);
            this.mixer.update();
        }
        
        // Update soundscape volumes
        if (this.soundscape) {
            this.soundscape.update();
        }
    }

    /**
     * Mute all audio
     */
    mute() {
        if (this.masterGain) {
            this.masterGain.gain.value = 0;
        }
    }

    /**
     * Unmute audio
     */
    unmute() {
        if (this.masterGain) {
            this.masterGain.gain.value = this.settings.get('masterVolume');
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopAmbient();
        if (this.soundscape) {
            this.soundscape.destroy();
            this.soundscape = null;
        }
        if (this.mixer) {
            this.mixer.destroy();
            this.mixer = null;
        }
        if (this.context) {
            this.context.close();
        }
    }
    
    /**
     * Set mixer preset
     * @param {string} presetName - Name of preset (BALANCED, QUIET, IMMERSIVE, UI_FOCUS)
     */
    setPreset(presetName) {
        if (!this.mixer) return;
        
        const preset = MIXER_PRESETS[presetName.toUpperCase()];
        if (preset) {
            for (const [channel, volume] of Object.entries(preset)) {
                if (channel !== 'name') {
                    this.mixer.setVolume(channel, volume, 0.5);
                }
            }
        }
    }
    
    /**
     * Get current mixer state
     * @returns {Object} Mixer state
     */
    getMixerState() {
        if (!this.mixer) return null;
        return this.mixer.exportState();
    }
    
    /**
     * Restore mixer state
     * @param {Object} state - Saved mixer state
     */
    restoreMixerState(state) {
        if (!this.mixer) return;
        this.mixer.importState(state);
    }
}

/**
 * Create audio manager instance
 */
export function createAudioManager(game) {
    return new AudioManager(game);
}