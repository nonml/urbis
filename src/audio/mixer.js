/**
 * Audio Mixer System
 * Provides channel mixing, volume envelopes, and crossfading for audio
 */

/**
 * Audio channel types for mixing
 */
export const AUDIO_CHANNELS = {
    AMBIENT: 'ambient',
    UI: 'ui',
    SFX: 'sfx',
    MUSIC: 'music',
    CRISIS: 'crisis'
};

/**
 * Default channel configurations
 */
export const DEFAULT_CHANNEL_CONFIG = {
    [AUDIO_CHANNELS.AMBIENT]: {
        name: 'Ambient',
        volume: 0.7,
        muted: false,
        solo: false,
        priority: 1
    },
    [AUDIO_CHANNELS.UI]: {
        name: 'UI',
        volume: 0.8,
        muted: false,
        solo: false,
        priority: 3
    },
    [AUDIO_CHANNELS.SFX]: {
        name: 'Sound Effects',
        volume: 0.6,
        muted: false,
        solo: false,
        priority: 2
    },
    [AUDIO_CHANNELS.MUSIC]: {
        name: 'Music',
        volume: 0.5,
        muted: false,
        solo: false,
        priority: 0
    },
    [AUDIO_CHANNELS.CRISIS]: {
        name: 'Crisis',
        volume: 1.0,
        muted: false,
        solo: false,
        priority: 4
    }
};

/**
 * Create an audio mixer instance
 * @param {AudioContext} context - Web Audio API context
 * @param {Object} masterGain - Master gain node
 * @param {Object} config - Optional configuration overrides
 * @returns {AudioMixer} The audio mixer instance
 */
export function createAudioMixer(context, masterGain, config = {}) {
    return new AudioMixer(context, masterGain, config);
}

/**
 * Audio Mixer Class
 * Manages audio channels with individual volume control and crossfading
 */
export class AudioMixer {
    constructor(context, masterGain, config = {}) {
        this.context = context;
        this.masterGain = masterGain;
        this.config = { ...DEFAULT_CHANNEL_CONFIG, ...config };
        
        // Channel state
        this.channels = new Map();
        this.activeSources = new Map();
        this.crossfadeDuration = 0.5; // seconds
        
        // Initialize channel gains
        this._initChannels();
    }
    
    /**
     * Initialize channel gain nodes
     */
    _initChannels() {
        for (const [channelId, channelConfig] of Object.entries(this.config)) {
            const channelGain = this.context.createGain();
            channelGain.gain.value = channelConfig.volume;
            channelGain.connect(this.masterGain);
            
            this.channels.set(channelId, {
                ...channelConfig,
                gainNode: channelGain,
                targetVolume: channelConfig.volume
            });
        }
    }
    
    /**
     * Get a channel's current state
     * @param {string} channelId - Channel identifier
     * @returns {Object} Channel state
     */
    getChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (!channel) return null;
        
        return {
            name: channel.name,
            volume: channel.volume,
            targetVolume: channel.targetVolume,
            muted: channel.muted,
            solo: channel.solo
        };
    }
    
    /**
     * Set channel volume with optional crossfade
     * @param {string} channelId - Channel identifier
     * @param {number} volume - Target volume (0.0 to 1.0)
     * @param {number} duration - Crossfade duration in seconds
     */
    setVolume(channelId, volume, duration = this.crossfadeDuration) {
        const channel = this.channels.get(channelId);
        if (!channel) return;
        
        volume = Math.max(0, Math.min(1, volume));
        channel.targetVolume = volume;
        
        if (duration > 0 && this.context) {
            const gain = channel.gainNode.gain;
            gain.setTargetAtTime(
                channel.muted ? 0 : volume,
                this.context.currentTime,
                duration / 3
            );
        } else {
            channel.gainNode.gain.value = channel.muted ? 0 : volume;
        }
        
        channel.volume = volume;
    }
    
    /**
     * Mute a channel
     * @param {string} channelId - Channel identifier
     * @param {number} duration - Fade out duration
     */
    mute(channelId, duration = 0.1) {
        const channel = this.channels.get(channelId);
        if (!channel) return;
        
        channel.muted = true;
        this.setVolume(channelId, channel.targetVolume, duration);
    }
    
    /**
     * Unmute a channel
     * @param {string} channelId - Channel identifier
     * @param {number} duration - Fade in duration
     */
    unmute(channelId, duration = 0.1) {
        const channel = this.channels.get(channelId);
        if (!channel) return;
        
        channel.muted = false;
        this.setVolume(channelId, channel.targetVolume, duration);
    }
    
    /**
     * Toggle channel mute
     * @param {string} channelId - Channel identifier
     */
    toggleMute(channelId) {
        const channel = this.channels.get(channelId);
        if (!channel) return;
        
        if (channel.muted) {
            this.unmute(channelId);
        } else {
            this.mute(channelId);
        }
    }
    
    /**
     * Set channel solo state (only this channel plays)
     * @param {string} channelId - Channel identifier
     * @param {boolean} solo - Solo state
     */
    setSolo(channelId, solo) {
        const channel = this.channels.get(channelId);
        if (!channel) return;
        
        channel.solo = solo;
        
        // Adjust other channels based on solo state
        for (const [id, ch] of this.channels.entries()) {
            if (id !== channelId) {
                const shouldMute = solo && !ch.solo;
                if (shouldMute && !ch._wasMuted) {
                    ch._wasMuted = ch.muted;
                    this.mute(id, 0.1);
                } else if (!solo && ch._wasMuted !== undefined) {
                    if (!ch._wasMuted) {
                        this.unmute(id, 0.1);
                    }
                    delete ch._wasMuted;
                }
            }
        }
    }
    
    /**
     * Crossfade between two channels
     * @param {string} fromChannel - Source channel
     * @param {string} toChannel - Target channel
     * @param {number} duration - Crossfade duration
     */
    crossfade(fromChannel, toChannel, duration = 1.0) {
        const from = this.channels.get(fromChannel);
        const to = this.channels.get(toChannel);
        
        if (!from || !to) return;
        
        const time = this.context.currentTime;
        const fromGain = from.gainNode.gain;
        const toGain = to.gainNode.gain;
        
        fromGain.setValueAtTime(from.volume, time);
        fromGain.linearRampToValueAtTime(0, time + duration);
        
        toGain.setValueAtTime(0, time);
        toGain.linearRampToValueAtTime(to.targetVolume, time + duration);
    }
    
    /**
     * Create a new audio source on a channel
     * @param {string} channelId - Channel identifier
     * @param {string} sourceId - Unique source identifier
     * @returns {Object} Source control object
     */
    createSource(channelId, sourceId) {
        const channel = this.channels.get(channelId);
        if (!channel) return null;
        
        const source = {
            id: sourceId,
            channelId,
            gainNode: this.context.createGain(),
            volume: 1.0,
            muted: false,
            loop: false,
            startTime: 0,
            stopTime: 0
        };
        
        source.gainNode.gain.value = 1.0;
        source.gainNode.connect(channel.gainNode);
        
        this.activeSources.set(sourceId, source);
        
        return {
            setVolume: (vol) => {
                source.volume = Math.max(0, Math.min(1, vol));
                source.gainNode.gain.value = source.muted ? 0 : source.volume * channel.volume;
            },
            setLoop: (loop) => {
                source.loop = loop;
            },
            fadeIn: (duration = 0.5) => {
                const time = this.context.currentTime;
                source.gainNode.gain.setValueAtTime(0, time);
                source.gainNode.gain.linearRampToValueAtTime(
                    source.volume,
                    time + duration
                );
            },
            fadeOut: (duration = 0.5, callback) => {
                const time = this.context.currentTime;
                source.gainNode.gain.linearRampToValueAtTime(0, time + duration);
                if (callback) {
                    setTimeout(callback, duration * 1000);
                }
            },
            stop: () => {
                source.gainNode.disconnect();
                this.activeSources.delete(sourceId);
            },
            mute: () => {
                source.muted = true;
                source.gainNode.gain.value = 0;
            },
            unmute: () => {
                source.muted = false;
                source.gainNode.gain.value = source.volume;
            }
        };
    }
    
    /**
     * Get active source controls
     * @param {string} sourceId - Source identifier
     * @returns {Object|null} Source controls or null
     */
    getSource(sourceId) {
        return this.activeSources.get(sourceId);
    }
    
    /**
     * Stop all sources on a channel
     * @param {string} channelId - Channel identifier
     */
    stopAll(channelId) {
        for (const [sourceId, source] of this.activeSources.entries()) {
            if (source.channelId === channelId) {
                source.gainNode.disconnect();
                this.activeSources.delete(sourceId);
            }
        }
    }
    
    /**
     * Update all channel volumes (call when settings change)
     */
    update() {
        for (const [channelId, channel] of this.channels.entries()) {
            if (!channel.muted) {
                channel.gainNode.gain.value = channel.volume;
            }
        }
    }
    
    /**
     * Get all channel states
     * @returns {Object} Object with all channel states
     */
    getAllChannels() {
        const result = {};
        for (const [channelId, channel] of this.channels.entries()) {
            result[channelId] = this.getChannel(channelId);
        }
        return result;
    }
    
    /**
     * Export current mixer state for saving
     * @returns {Object} Serializable state
     */
    exportState() {
        const state = {};
        for (const [channelId, channel] of this.channels.entries()) {
            state[channelId] = {
                volume: channel.volume,
                muted: channel.muted,
                solo: channel.solo
            };
        }
        return state;
    }
    
    /**
     * Import mixer state from saved data
     * @param {Object} state - Saved state to restore
     */
    importState(state) {
        for (const [channelId, channelState] of Object.entries(state)) {
            const channel = this.channels.get(channelId);
            if (channel) {
                if (channelState.volume !== undefined) {
                    this.setVolume(channelId, channelState.volume, 0);
                }
                if (channelState.muted !== undefined) {
                    if (channelState.muted) {
                        this.mute(channelId, 0);
                    } else {
                        this.unmute(channelId, 0);
                    }
                }
            }
        }
    }
    
    /**
     * Cleanup and disconnect all channels
     */
    destroy() {
        for (const [, source] of this.activeSources.entries()) {
            source.gainNode.disconnect();
        }
        this.activeSources.clear();
        
        for (const [, channel] of this.channels.entries()) {
            channel.gainNode.disconnect();
        }
        this.channels.clear();
    }
}

/**
 * Preset mixing configurations
 */
export const MIXER_PRESETS = {
    BALANCED: {
        name: 'Balanced',
        [AUDIO_CHANNELS.AMBIENT]: 0.7,
        [AUDIO_CHANNELS.UI]: 0.8,
        [AUDIO_CHANNELS.SFX]: 0.6,
        [AUDIO_CHANNELS.MUSIC]: 0.5,
        [AUDIO_CHANNELS.CRISIS]: 1.0
    },
    QUIET: {
        name: 'Quiet',
        [AUDIO_CHANNELS.AMBIENT]: 0.4,
        [AUDIO_CHANNELS.UI]: 0.6,
        [AUDIO_CHANNELS.SFX]: 0.4,
        [AUDIO_CHANNELS.MUSIC]: 0.3,
        [AUDIO_CHANNELS.CRISIS]: 0.8
    },
    IMMERSIVE: {
        name: 'Immersive',
        [AUDIO_CHANNELS.AMBIENT]: 0.9,
        [AUDIO_CHANNELS.UI]: 0.7,
        [AUDIO_CHANNELS.SFX]: 0.8,
        [AUDIO_CHANNELS.MUSIC]: 0.7,
        [AUDIO_CHANNELS.CRISIS]: 1.0
    },
    UI_FOCUS: {
        name: 'UI Focus',
        [AUDIO_CHANNELS.AMBIENT]: 0.3,
        [AUDIO_CHANNELS.UI]: 1.0,
        [AUDIO_CHANNELS.SFX]: 0.5,
        [AUDIO_CHANNELS.MUSIC]: 0.2,
        [AUDIO_CHANNELS.CRISIS]: 0.8
    }
};