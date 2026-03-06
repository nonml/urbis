// Soundscape System
// Dynamic audio environment based on city state, time of day, and events
// Integrates with AudioManager for layered audio mixing

/**
 * Soundscape manager - controls ambient audio based on game state
 */
export class Soundscape {
    constructor(audioManager, game) {
        this.audioManager = audioManager;
        this.game = game;
        
        // Current state
        this.currentTimeOfDay = 0; // 0-1 (0 = midnight, 0.5 = noon)
        this.currentCityState = 'normal'; // normal, busy, quiet, crisis
        this.currentDistrict = 'residential';
        this.populationLevel = 0;
        this.crisisLevel = 0;
        
        // Audio layers
        this.baseAmbient = null;
        this.dayNightLayer = null;
        this.cityStateLayer = null;
        this.crisisLayer = null;
        
        // Layer gains
        this.baseGain = 1.0;
        this.dayNightGain = 0.3;
        this.cityStateGain = 0.2;
        this.crisisGain = 0.5;
        
        // Transition state
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.targetState = null;
        
        // Event listeners
        this.eventListeners = new Map();
    }
    
    /**
     * Initialize soundscape
     */
    initialize() {
        this.currentTimeOfDay = this.game?.state?.time?.timeOfDay || 0;
        this.populationLevel = this.game?.resources?.population || 0;
        this.crisisLevel = 0;
        
        // Set initial state
        this.updateTimeOfDay(this.currentTimeOfDay);
        this.updateCityState();
        
        console.log('[Soundscape] Initialized');
    }
    
    /**
     * Update soundscape based on current game state
     * Call this every frame or at regular intervals
     */
    update() {
        if (!this.game) return;
        
        // Update time of day
        const newTimeOfDay = this.game.state.time.timeOfDay || 0;
        if (Math.abs(newTimeOfDay - this.currentTimeOfDay) > 0.01) {
            this.updateTimeOfDay(newTimeOfDay);
        }
        
        // Update population level
        const newPopLevel = this.game.resources.population || 0;
        if (Math.abs(newPopLevel - this.populationLevel) > 5) {
            this.populationLevel = newPopLevel;
            this.updateCityState();
        }
        
        // Update crisis level based on active crises
        const activeCrises = this.game.crisisManager?.activeCrisis ? 1 : 0;
        const incidentCount = this.game.incidentSystem?.incidents?.length || 0;
        const newCrisisLevel = Math.min(1, activeCrises + incidentCount * 0.2);
        
        if (Math.abs(newCrisisLevel - this.crisisLevel) > 0.1) {
            this.crisisLevel = newCrisisLevel;
            this.updateCrisisLayer();
        }
        
        // Handle transitions
        if (this.isTransitioning) {
            this.updateTransitions();
        }
    }
    
    /**
     * Update time of day layer
     */
    updateTimeOfDay(timeOfDay) {
        this.currentTimeOfDay = timeOfDay;
        
        // Determine time period
        let period;
        let ambientType;
        
        if (timeOfDay < 0.1 || timeOfDay > 0.9) {
            period = 'night';
            ambientType = 'night';
        } else if (timeOfDay < 0.25 || timeOfDay > 0.75) {
            period = 'dawn_dusk';
            ambientType = 'twilight';
        } else if (timeOfDay < 0.4 || timeOfDay > 0.6) {
            period = 'afternoon';
            ambientType = 'day';
        } else {
            period = 'morning';
            ambientType = 'morning';
        }
        
        // Update day/night ambient
        this.updateDayNightLayer(ambientType, period);
    }
    
    /**
     * Update city state based on population and activity
     */
    updateCityState() {
        const pop = this.populationLevel;
        const crisis = this.crisisLevel;
        
        let newState;
        
        if (crisis > 0.5) {
            newState = 'crisis';
        } else if (pop < 10) {
            newState = 'quiet';
        } else if (pop > 100) {
            newState = 'busy';
        } else {
            newState = 'normal';
        }
        
        if (newState !== this.currentCityState) {
            this.transitionToCityState(newState);
        }
    }
    
    /**
     * Update crisis layer
     */
    updateCrisisLayer() {
        if (!this.audioManager?.canPlay) return;
        
        const crisis = this.game.crisisManager?.activeCrisis;
        const incidents = this.game.incidentSystem?.incidents || [];
        
        if (crisis || incidents.length > 0) {
            this.playCrisisStinger();
        }
    }
    
    /**
     * Update day/night ambient layer
     */
    updateDayNightLayer(ambientType, period) {
        // This would crossfade between different ambient tracks
        // For now, we'll just log the change
        console.log(`[Soundscape] Time period: ${period}, ambient: ${ambientType}`);
        
        // Adjust ambient volume based on time
        if (this.audioManager?.ambientGain) {
            let volumeMultiplier = 1.0;
            
            if (period === 'night') {
                volumeMultiplier = 0.7; // Quieter at night
            } else if (period === 'dawn_dusk') {
                volumeMultiplier = 0.8;
            }
            
            // Smooth transition
            const targetVol = this.audioManager.settings?.get('audioVolume') * volumeMultiplier || 0.5;
            if (this.audioManager.ambientGain.gain.value !== targetVol) {
                this.audioManager.ambientGain.gain.setTargetAtTime(
                    targetVol,
                    this.audioManager.context.currentTime,
                    2.0
                );
            }
        }
    }
    
    /**
     * Transition to new city state
     */
    transitionToCityState(newState) {
        if (newState === this.currentCityState) return;
        
        this.isTransitioning = true;
        this.targetState = newState;
        this.transitionProgress = 0;
        
        console.log(`[Soundscape] Transitioning to: ${newState}`);
    }
    
    /**
     * Update transition progress
     */
    updateTransitions() {
        this.transitionProgress += 0.01; // 1% per frame approx
        
        if (this.transitionProgress >= 1) {
            this.isTransitioning = false;
            this.currentCityState = this.targetState;
            this.applyCityState();
        } else {
            // Crossfade between states
            this.applyCrossfade();
        }
    }
    
    /**
     * Apply crossfade between old and new city states
     */
    applyCrossfade() {
        if (!this.audioManager?.canPlay) return;
        
        const progress = this.transitionProgress;
        
        // Adjust layer gains based on transition
        if (this.audioManager.ambientGain) {
            const baseVol = this.audioManager.settings?.get('audioVolume') || 0.5;
            
            let targetVol = baseVol;
            if (this.currentCityState === 'quiet') {
                targetVol = baseVol * 0.7;
            } else if (this.currentCityState === 'busy') {
                targetVol = baseVol * 1.2;
            }
            
            const currentTarget = this.targetState === 'quiet' ? baseVol * 0.7 :
                                 this.targetState === 'busy' ? baseVol * 1.2 : baseVol;
            
            const interpolated = baseVol + (currentTarget - baseVol) * progress;
            
            this.audioManager.ambientGain.gain.setTargetAtTime(
                interpolated,
                this.audioManager.context.currentTime,
                0.5
            );
        }
    }
    
    /**
     * Apply city state changes
     */
    applyCityState() {
        console.log(`[Soundscape] Applied state: ${this.currentCityState}`);
        
        // Play state-specific sound
        switch (this.currentCityState) {
            case 'crisis':
                this.playCrisisStinger();
                break;
            case 'busy':
                this.playCityBusySound();
                break;
            case 'quiet':
                this.playCityQuietSound();
                break;
        }
    }
    
    /**
     * Play crisis stinger
     */
    playCrisisStinger() {
        if (this.audioManager?.playCrisisStinger) {
            this.audioManager.playCrisisStinger();
        }
    }
    
    /**
     * Play city busy sound
     */
    playCityBusySound() {
        if (this.audioManager?.playSynthSound) {
            // Subtle upbeat sound for busy city
            this.audioManager.playSynthSound('success');
        }
    }
    
    /**
     * Play city quiet sound
     */
    playCityQuietSound() {
        // Subtle downward tone for quiet city
        if (this.audioManager?.context) {
            const time = this.audioManager.context.currentTime;
            const osc = this.audioManager.context.createOscillator();
            const gain = this.audioManager.context.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, time);
            osc.frequency.exponentialRampToValueAtTime(100, time + 0.5);
            
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
            
            osc.connect(gain);
            gain.connect(this.audioManager.masterGain);
            osc.start(time);
            osc.stop(time + 0.5);
        }
    }
    
    /**
     * Register event listener for soundscape events
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    /**
     * Emit soundscape event
     */
    emit(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        for (const callback of listeners) {
            callback(data);
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.eventListeners.clear();
        console.log('[Soundscape] Destroyed');
    }
}

/**
 * Create soundscape manager
 */
export function createSoundscape(audioManager, game) {
    return new Soundscape(audioManager, game);
}