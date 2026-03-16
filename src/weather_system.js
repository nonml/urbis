/**
 * Weather System - Dynamic weather simulation and rendering
 * 
 * Provides weather effects including rain, snow, fog, and storms
 * with proper integration into the game simulation and rendering.
 */

import { WEATHER_TYPES, WEATHER_CLEAR, WEATHER_RAIN, WEATHER_STORM, WEATHER_FOG, WEATHER_SNOW } from './constants.js';

/**
 * WeatherState represents the current weather condition
 */
export class WeatherState {
    constructor() {
        this.type = WEATHER_CLEAR;
        this.intensity = 0; // 0-1, where 1 is maximum intensity
        this.targetIntensity = 0;
        this.transitionSpeed = 0.01; // Per tick
        this.duration = 0;
        this.maxDuration = 0;
        this.season = 'spring'; // spring, summer, autumn, winter
        this.temperature = 15; // Celsius
        this.windSpeed = 0;
        this.windDirection = 0; // Radians
    }

    /**
     * Serialize weather state
     */
    serialize() {
        return {
            type: this.type,
            intensity: this.intensity,
            targetIntensity: this.targetIntensity,
            duration: this.duration,
            maxDuration: this.maxDuration,
            season: this.season,
            temperature: this.temperature,
            windSpeed: this.windSpeed,
            windDirection: this.windDirection
        };
    }

    /**
     * Deserialize weather state
     */
    deserialize(data) {
        this.type = data.type || WEATHER_CLEAR;
        this.intensity = data.intensity || 0;
        this.targetIntensity = data.targetIntensity || 0;
        this.duration = data.duration || 0;
        this.maxDuration = data.maxDuration || 0;
        this.season = data.season || 'spring';
        this.temperature = data.temperature ?? 15;
        this.windSpeed = data.windSpeed || 0;
        this.windDirection = data.windDirection || 0;
    }
}

/**
 * WeatherSystem manages weather simulation and effects
 */
export class WeatherSystem {
    constructor(game) {
        this.game = game;
        this.state = new WeatherState();
        this.rng = game?.rngStreams?.weather || game?.rng || null;
        
        // Weather transition queue
        this.transitionQueue = [];
        
        // Weather effects cache
        this.currentEffects = {
            visibility: 1.0,
            speedModifier: 1.0,
            ambientColor: 0xffffff,
            fogDensity: 0.0001
        };
        
        // Seasonal temperature modifiers
        this.seasonalTemp = {
            spring: { min: 10, max: 20 },
            summer: { min: 20, max: 30 },
            autumn: { min: 5, max: 18 },
            winter: { min: -5, max: 10 }
        };
        
        // Weather probability by season
        this.weatherProbabilities = {
            spring: { clear: 0.5, rain: 0.35, storm: 0.1, fog: 0.05, snow: 0.0 },
            summer: { clear: 0.7, rain: 0.2, storm: 0.1, fog: 0.0, snow: 0.0 },
            autumn: { clear: 0.5, rain: 0.3, storm: 0.05, fog: 0.15, snow: 0.0 },
            winter: { clear: 0.3, rain: 0.2, storm: 0.05, fog: 0.15, snow: 0.3 }
        };
        
        // Particle system reference (set during game initialization)
        this.particleSystem = null;
    }

    /**
     * Initialize weather system
     */
    init() {
        // Set initial season based on day
        this.updateSeason();
        
        // Set initial weather
        this.generateNewWeather();
    }

    /**
     * Update season based on game day
     */
    updateSeason() {
        const day = this.game?.resources?.day || 1;
        const seasonLength = 30; // Days per season
        const seasonIndex = Math.floor((day - 1) / seasonLength) % 4;
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        this.state.season = seasons[seasonIndex];
        
        // Update temperature range
        const tempRange = this.seasonalTemp[this.state.season];
        if (this.rng) {
            this.state.temperature = tempRange.min + this.rng.float(0, tempRange.max - tempRange.min);
        } else {
            this.state.temperature = (tempRange.min + tempRange.max) / 2;
        }
    }

    /**
     * Generate new weather based on current season
     */
    generateNewWeather() {
        const season = this.state.season;
        const probs = this.weatherProbabilities[season];
        
        if (!this.rng) {
            this.setWeather(WEATHER_CLEAR, 60);
            return;
        }
        
        const roll = this.rng.next();
        let newWeather = WEATHER_CLEAR;
        let duration = 60; // Default duration in ticks
        
        if (roll < probs.clear) {
            newWeather = WEATHER_CLEAR;
            duration = 120;
        } else if (roll < probs.clear + probs.rain) {
            newWeather = WEATHER_RAIN;
            duration = 90;
        } else if (roll < probs.clear + probs.rain + probs.storm) {
            newWeather = WEATHER_STORM;
            duration = 60;
        } else if (roll < probs.clear + probs.rain + probs.storm + probs.fog) {
            newWeather = WEATHER_FOG;
            duration = 120;
        } else if (roll < 1) {
            newWeather = WEATHER_SNOW;
            duration = 90;
        }
        
        this.setWeather(newWeather, duration);
    }

    /**
     * Set weather to a specific type with given duration
     * @param {string} weatherType - Weather type constant
     * @param {number} duration - Duration in ticks
     * @param {number} intensity - Initial intensity (0-1)
     */
    setWeather(weatherType, duration = 60, intensity = 1.0) {
        if (!WEATHER_TYPES[weatherType]) {
            console.warn(`Unknown weather type: ${weatherType}`);
            return;
        }
        
        // Queue the transition
        this.transitionQueue.push({
            type: weatherType,
            duration: duration,
            intensity: intensity
        });
        
        // Process immediately if no other transition
        if (this.transitionQueue.length === 1) {
            this.processTransition();
        }
    }

    /**
     * Process the next weather transition
     */
    processTransition() {
        if (this.transitionQueue.length === 0) return;
        
        const transition = this.transitionQueue[0];
        this.state.targetIntensity = transition.intensity;
        this.state.duration = transition.duration;
        this.state.maxDuration = transition.duration;
        
        // If transitioning from clear, start at 0 intensity
        // If transitioning between weather types, start from current intensity
        if (this.state.type === WEATHER_CLEAR) {
            this.state.intensity = 0;
        }
        
        this.state.type = transition.type;
    }

    /**
     * Update weather system for a tick
     */
    update(dt) {
        const tick = this.game?.state?.time?.tick || 0;
        
        // Update season periodically
        if (tick % 30 === 0) {
            this.updateSeason();
        }
        
        // Process weather transitions
        if (this.transitionQueue.length > 0) {
            // Smooth transition
            const transitionSpeed = 0.05;
            if (this.state.intensity < this.state.targetIntensity) {
                this.state.intensity = Math.min(
                    this.state.targetIntensity,
                    this.state.intensity + transitionSpeed
                );
            } else if (this.state.intensity > this.state.targetIntensity) {
                this.state.intensity = Math.max(
                    this.state.targetIntensity,
                    this.state.intensity - transitionSpeed
                );
            }
        }
        
        // Update current weather duration
        if (this.state.type !== WEATHER_CLEAR && this.state.duration > 0) {
            this.state.duration--;
            
            // Check if weather should end or transition
            if (this.state.duration <= 0) {
                this.transitionQueue.shift();
                
                if (this.transitionQueue.length > 0) {
                    this.processTransition();
                } else {
                    // Transition back to clear
                    this.state.targetIntensity = 0;
                    if (this.state.intensity <= 0) {
                        this.state.type = WEATHER_CLEAR;
                        this.generateNewWeather();
                    }
                }
            }
        }
        
        // Update effects based on current weather
        this.updateEffects();
        
        // Random weather change chance (small chance each tick)
        if (this.rng && this.rng.chance(0.001)) {
            this.generateNewWeather();
        }
    }

    /**
     * Update weather effects cache
     */
    updateEffects() {
        const weatherConfig = WEATHER_TYPES[this.state.type];
        if (!weatherConfig) {
            this.currentEffects = {
                visibility: 1.0,
                speedModifier: 1.0,
                ambientColor: 0xffffff,
                fogDensity: 0.0001
            };
            return;
        }
        
        const intensity = this.state.intensity;
        
        this.currentEffects = {
            visibility: weatherConfig.visibility,
            speedModifier: weatherConfig.citizenSpeedModifier,
            ambientColor: weatherConfig.ambientColor,
            fogDensity: weatherConfig.fogDensity * intensity,
            rawConfig: weatherConfig
        };
    }

    /**
     * Get weather conditions at a specific tile
     * Can be overridden for regional weather in future
     */
    getWeatherAt(x, y) {
        return {
            type: this.state.type,
            intensity: this.state.intensity,
            effects: this.currentEffects
        };
    }

    /**
     * Get current weather effects
     */
    getEffects() {
        return this.currentEffects;
    }

    /**
     * Get weather type name
     */
    getWeatherName() {
        const config = WEATHER_TYPES[this.state.type];
        return config?.name || 'Unknown';
    }

    /**
     * Get weather icon
     */
    getWeatherIcon() {
        const config = WEATHER_TYPES[this.state.type];
        return config?.icon || '☀️';
    }

    /**
     * Check if current weather affects visibility
     */
    isLowVisibility() {
        return this.currentEffects.visibility < 0.7;
    }

    /**
     * Check if precipitation is active
     */
    hasPrecipitation() {
        return (
            this.state.type === WEATHER_RAIN ||
            this.state.type === WEATHER_STORM ||
            this.state.type === WEATHER_SNOW
        );
    }

    /**
     * Check if weather is severe
     */
    isSevere() {
        return this.state.type === WEATHER_STORM;
    }

    /**
     * Force weather change (for events/quests)
     */
    forceWeather(weatherType, duration = 60) {
        this.transitionQueue = [];
        this.setWeather(weatherType, duration, 1.0);
    }

    /**
     * Clear all weather immediately
     */
    clearWeather() {
        this.transitionQueue = [];
        this.state.targetIntensity = 0;
        this.state.intensity = 0;
        this.state.type = WEATHER_CLEAR;
        this.updateEffects();
    }

    /**
     * Serialize weather system state
     */
    serialize() {
        return {
            state: this.state.serialize(),
            transitionQueue: this.transitionQueue,
            currentEffects: this.currentEffects
        };
    }

    /**
     * Deserialize weather system state
     */
    deserialize(data) {
        if (data.state) {
            this.state.deserialize(data.state);
        }
        if (data.transitionQueue) {
            this.transitionQueue = data.transitionQueue;
        }
        if (data.currentEffects) {
            this.currentEffects = data.currentEffects;
        }
    }
}

/**
 * Create a weather system instance
 */
export function createWeatherSystem(game) {
    const system = new WeatherSystem(game);
    system.init();
    return system;
}