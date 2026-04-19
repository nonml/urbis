/**
 * Procedural SFX Generator
 * Uses Web Audio API to generate sound effects without external files
 */

import { SFX, SFX_PARAMS } from '../constants.js';

export class SFXGenerator {
    constructor(audioContext, masterGainNode, rng) {
        this.context = audioContext;
        this.masterGain = masterGainNode || null;
        this.rng = rng || null;
        this.internalGain = null;
        this._init();
    }
    
    _init() {
        // Create internal gain for volume control
        this.internalGain = this.context.createGain();
        this.internalGain.gain.value = 0.5;
        
        // Connect to provided master gain or directly to destination
        if (this.masterGain) {
            this.internalGain.connect(this.masterGain);
        } else {
            this.internalGain.connect(this.context.destination);
        }
    }
    
    /**
     * Play a sound effect by name
     * @param {string} sfxName - SFX identifier from SFX constant
     * @param {object} options - Optional overrides for parameters
     */
    play(sfxName, options = {}) {
        if (!this.context) return null;
        
        const baseParams = SFX_PARAMS[sfxName];
        if (!baseParams) {
            console.warn(`[SFXGenerator] Unknown SFX: ${sfxName}`);
            return null;
        }
        
        // Merge base params with options (options override base)
        const params = { ...baseParams, ...options };
        const now = this.context.currentTime;
        
        if (params.type === 'synth') {
            return this._playSynth(params, now);
        } else if (params.type === 'noise') {
            return this._playNoise(params, now);
        } else if (params.type === 'arpeggio') {
            return this._playArpeggio(params, now);
        }
        
        return null;
    }
    
    _playSynth(params, time) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = params.oscillator || 'sine';
        
        // Base frequency with optional pitch variation
        const baseFreq = params.frequency;
        const pitchVar = params.pitchVariation || 0;
        const rngVal = this.rng ? this.rng.next() : (Math.random?.() ?? 0.5);
        const actualFreq = baseFreq * (1 + (rngVal * 2 - 1) * pitchVar);
        
        osc.frequency.setValueAtTime(actualFreq, time);
        
        // Frequency sweep if specified
        if (params.frequencyEnd) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(10, params.frequencyEnd),
                time + params.duration
            );
        }
        
        // Modulation for crisis alert and special effects
        if (params.modulate) {
            const lfo = this.context.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = params.modulateRate || 8; // Hz
            const lfoGain = this.context.createGain();
            lfoGain.gain.value = params.modulateDepth || 50;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(time);
            lfo.stop(time + params.duration);
        }
        
        // Envelope (ADSR)
        const { attack, decay, sustain, release } = params.envelope || { 
            attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.05 
        };
        
        const totalDuration = params.duration || (attack + decay + release);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(params.volume || 1, time + attack);
        gain.gain.linearRampToValueAtTime(sustain * (params.volume || 1), time + attack + decay);
        gain.gain.setValueAtTime(sustain * (params.volume || 1), time + totalDuration - release);
        gain.gain.linearRampToValueAtTime(0, time + totalDuration);
        
        // Optional filter
        if (params.filter) {
            const filter = this.context.createBiquadFilter();
            filter.type = params.filter.type || 'lowpass';
            filter.frequency.value = params.filter.frequency || 2000;
            filter.Q.value = params.filter.Q || 0;
            
            osc.connect(filter);
            filter.connect(gain);
        } else {
            osc.connect(gain);
        }
        
        gain.connect(this.internalGain);
        
        osc.start(time);
        osc.stop(time + totalDuration + 0.01);
        
        return { oscillator: osc, gainNode: gain, stopTime: time + totalDuration };
    }
    
    _playNoise(params, time) {
        const bufferSize = this.context.sampleRate * params.duration;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate noise based on type
        const noiseType = params.noiseType || 'white';
        const rngNext = this.rng ? () => this.rng.next() : undefined;
        for (let i = 0; i < bufferSize; i++) {
            const rand = rngNext ? rngNext() : (Math.random?.() ?? 0.5);
            if (noiseType === 'white') {
                data[i] = (rand * 2 - 1);
            } else if (noiseType === 'pink') {
                // Simple pink noise approximation
                data[i] = (lastPink + rand) / 2;
                lastPink = data[i];
                data[i] *= 1.01; // Normalize
            } else if (noiseType === 'burst') {
                // Burst noise that decays
                data[i] = (rand * 2 - 1) * (1 - i / bufferSize);
            } else {
                data[i] = (rand * 2 - 1) * (1 - i / bufferSize);
            }
        }
        
        const noise = this.context.createBufferSource();
        noise.buffer = buffer;
        
        const gain = this.context.createGain();
        const volume = params.volume || 0.8;
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + params.duration);
        
        // Filter for noise shaping
        if (params.filter) {
            const filter = this.context.createBiquadFilter();
            filter.type = params.filter.type || 'lowpass';
            filter.frequency.value = params.filter.frequency || 800;
            filter.Q.value = params.filter.Q || 0;
            
            noise.connect(filter);
            filter.connect(gain);
        } else {
            // Default lowpass for "thud" sound
            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            
            noise.connect(filter);
            filter.connect(gain);
        }
        
        gain.connect(this.internalGain);
        
        noise.start(time);
        
        return { bufferSource: noise, gainNode: gain, stopTime: time + params.duration };
    }
    
    _playArpeggio(params, time) {
        const notes = params.arpeggio || [440, 554, 659, 784];
        const duration = params.duration || 0.4;
        const noteCount = notes.length;
        const noteDuration = duration / noteCount;
        const volume = params.volume || 0.15;
        const oscillatorType = params.oscillator || 'sine';
        
        const masterGain = this.context.createGain();
        masterGain.connect(this.internalGain);
        
        notes.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const noteGain = this.context.createGain();
            
            osc.type = oscillatorType;
            osc.frequency.setValueAtTime(freq, time + i * noteDuration);
            
            const noteTime = i * noteDuration;
            const attack = params.envelope?.attack || 0.02;
            const release = noteDuration - attack;
            
            noteGain.gain.setValueAtTime(0, time + noteTime);
            noteGain.gain.linearRampToValueAtTime(volume, time + noteTime + attack);
            noteGain.gain.linearRampToValueAtTime(0, time + noteTime + noteDuration);
            
            osc.connect(noteGain);
            noteGain.connect(masterGain);
            
            osc.start(time + noteTime);
            osc.stop(time + noteTime + noteDuration + 0.01);
        });
        
        return { masterGain, stopTime: time + duration };
    }
    
    /**
     * Play building placement sound with pitch based on building type
     * @param {string} buildingType - Type of building being placed
     * @param {object} options - Optional overrides
     */
    playBuildingPlace(buildingType, options = {}) {
        // Map building types to base frequencies for variety
        const buildingFrequencies = {
            'house': 220,
            'farm': 261,
            'lumber-mill': 293,
            'market': 329,
            'town-hall': 392,
            'warehouse': 349,
            'barracks': 311,
            'school': 369,
            'police-station': 277,
            'cctv-network': 246,
            'counterintel': 293,
            'propaganda-office': 261,
            'power-plant': 196,
            'substation': 220,
        };
        
        const baseFreq = buildingFrequencies[buildingType] || 261;
        
        return this.play(SFX.BUILD_PLACE, {
            ...options,
            frequency: baseFreq,
            pitchVariation: 0.1 // 10% variation for natural feel
        });
    }
    
    /**
     * Play UI hover sound with subtle pitch variation
     * @param {object} options - Optional overrides
     */
    playUIHover(options = {}) {
        return this.play(SFX.UI_HOVER, {
            ...options,
            pitchVariation: 0.05
        });
    }
    
    /**
     * Set master volume for SFX
     * @param {number} volume - 0.0 to 1.0
     */
    setVolume(volume) {
        if (this.internalGain) {
            this.internalGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    
    /**
     * Stop all active sounds
     */
    stopAll() {
        // Note: Web Audio API doesn't provide a way to stop all oscillators
        // This is a placeholder for future implementation with tracking
        console.warn('[SFXGenerator] stopAll() called - individual sound tracking not implemented');
    }
}

// Pink noise state
let lastPink = 0;

/**
 * Singleton accessor
 */
let _instance = null;
export function createSFXGenerator(audioContext, masterGainNode = null, rng) {
    if (!_instance && audioContext) {
        _instance = new SFXGenerator(audioContext, masterGainNode, rng);
    }
    return _instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetSFXGenerator() {
    _instance = null;
}
