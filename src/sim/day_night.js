/**
 * Day/Night Cycle System
 * Manages lighting transitions throughout the game day
 */

export const DAY_PHASES = {
    DAWN: 'dawn',
    DAY: 'day',
    DUSK: 'dusk',
    NIGHT: 'night'
};

/**
 * Default day/night cycle configuration
 */
export const DEFAULT_CYCLE_CONFIG = {
    cycleLength: 24, // Game hours per full cycle
    phases: {
        dawn: { 
            start: 0, 
            end: 6, 
            skyColor: 0xff6b6b,
            ambientIntensity: 0.3,
            sunIntensity: 0.5
        },
        day: { 
            start: 6, 
            end: 18, 
            skyColor: 0x87ceeb,
            ambientIntensity: 0.7,
            sunIntensity: 1.0
        },
        dusk: { 
            start: 18, 
            end: 21, 
            skyColor: 0xffa500,
            ambientIntensity: 0.5,
            sunIntensity: 0.3
        },
        night: { 
            start: 21, 
            end: 24, 
            skyColor: 0x1a1a2e,
            ambientIntensity: 0.15,
            sunIntensity: 0.0
        }
    }
};

/**
 * Create a day/night cycle manager
 * @param {Object} config - Configuration options
 * @returns {DayNightCycle} The cycle manager instance
 */
export function createDayNightCycle(config = {}) {
    return new DayNightCycle(config);
}

/**
 * Day/Night Cycle Manager
 * Handles time progression and lighting state
 */
export class DayNightCycle {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CYCLE_CONFIG, ...config };
        this.progress = 0; // 0 to 1 representing full cycle
        this.currentPhase = DAY_PHASES.NIGHT;
        this.lightColor = new THREE.Color(0x1a1a2e);
        this.ambientIntensity = 0.15;
        this.sunIntensity = 0.0;
        
        // Cache for smooth interpolation
        this._phaseCache = null;
        this._cacheTime = 0;
    }

    /**
     * Update the cycle progress
     * @param {number} timeOfDay - Current time of day (0.0 to 1.0)
     * @returns {Object} Current lighting state
     */
    update(timeOfDay) {
        this.progress = timeOfDay;
        
        const hour = timeOfDay * this.config.cycleLength;
        this._updatePhase(hour);
        this._updateLighting(hour);
        
        return {
            phase: this.currentPhase,
            lightColor: this.lightColor,
            ambientIntensity: this.ambientIntensity,
            sunIntensity: this.sunIntensity
        };
    }

    /**
     * Determine current phase based on hour
     * @param {number} hour - Current hour (0-24)
     */
    _updatePhase(hour) {
        const { phases } = this.config;
        
        if (hour >= phases.dawn.start && hour < phases.dawn.end) {
            this.currentPhase = DAY_PHASES.DAWN;
        } else if (hour >= phases.day.start && hour < phases.day.end) {
            this.currentPhase = DAY_PHASES.DAY;
        } else if (hour >= phases.dusk.start && hour < phases.dusk.end) {
            this.currentPhase = DAY_PHASES.DUSK;
        } else {
            this.currentPhase = DAY_PHASES.NIGHT;
        }
    }

    /**
     * Calculate lighting values based on current time
     * @param {number} hour - Current hour (0-24)
     */
    _updateLighting(hour) {
        const { phases } = this.config;
        
        // Determine current and next phase for interpolation
        let currentPhase, nextPhase, currentHour, nextHour;
        
        if (hour >= phases.dawn.start && hour < phases.dawn.end) {
            currentPhase = phases.dawn;
            nextPhase = phases.day;
            currentHour = phases.dawn.start;
            nextHour = phases.dawn.end;
        } else if (hour >= phases.day.start && hour < phases.day.end) {
            currentPhase = phases.day;
            nextPhase = phases.dusk;
            currentHour = phases.day.start;
            nextHour = phases.day.end;
        } else if (hour >= phases.dusk.start && hour < phases.dusk.end) {
            currentPhase = phases.dusk;
            nextPhase = phases.night;
            currentHour = phases.dusk.start;
            nextHour = phases.dusk.end;
        } else {
            currentPhase = phases.night;
            nextPhase = phases.dawn;
            currentHour = phases.night.start;
            nextHour = phases.dawn.end + 24; // Wrap around
        }
        
        // Handle wrap-around for night to dawn
        if (hour >= 21 && hour < 24) {
            // Night phase - interpolate to dawn
            const normalizedHour = hour - 21;
            const dawnStart = 0;
            const dawnEnd = 6;
            const totalNightDuration = 24 - 21 + 6; // 9 hours from dusk start to dawn end
            
            if (normalizedHour < 3) {
                // Deep night
                this.lightColor.setHex(currentPhase.skyColor);
                this.ambientIntensity = currentPhase.ambientIntensity;
                this.sunIntensity = 0;
            } else {
                // Approaching dawn
                const t = (normalizedHour - 3) / 3;
                this._interpolateLighting(currentPhase, phases.dawn, t);
            }
        } else {
            // Normal interpolation within phase boundaries
            const range = nextHour - currentHour;
            const t = range > 0 ? (hour - currentHour) / range : 0;
            
            this._interpolateLighting(currentPhase, nextPhase, t);
        }
        
        // Clamp values
        this.ambientIntensity = Math.max(0, Math.min(1, this.ambientIntensity));
        this.sunIntensity = Math.max(0, Math.min(1, this.sunIntensity));
    }

    /**
     * Interpolate lighting between two phases
     * @param {Object} from - Starting phase
     * @param {Object} to - Ending phase
     * @param {number} t - Interpolation factor (0-1)
     */
    _interpolateLighting(from, to, t) {
        // Smoothstep for smoother transitions
        const smoothT = t * t * (3 - 2 * t);
        
        // Interpolate color
        const fromColor = new THREE.Color(from.skyColor);
        const toColor = new THREE.Color(to.skyColor);
        this.lightColor.lerpColors(fromColor, toColor, smoothT);
        
        // Interpolate intensities
        this.ambientIntensity = from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * smoothT;
        this.sunIntensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * smoothT;
    }

    /**
     * Get current phase name
     * @returns {string} Current phase
     */
    getPhase() {
        return this.currentPhase;
    }

    /**
     * Get current light color
     * @returns {THREE.Color} Current light color
     */
    getLightColor() {
        return this.lightColor;
    }

    /**
     * Get current hour (0-24)
     * @param {number} timeOfDay - Time of day (0.0 to 1.0)
     * @returns {number} Current hour
     */
    getHour(timeOfDay) {
        return timeOfDay * this.config.cycleLength;
    }

    /**
     * Check if currently daytime
     * @param {number} timeOfDay - Time of day (0.0 to 1.0)
     * @returns {boolean} True if daytime
     */
    isDaytime(timeOfDay) {
        const hour = this.getHour(timeOfDay);
        return hour >= 6 && hour < 18;
    }

    /**
     * Set cycle speed multiplier
     * @param {number} speed - Speed multiplier
     */
    setSpeed(speed) {
        this.speed = speed || 1;
    }
}

// Helper function to create THREE.Color if not available
function ensureTHREE() {
    if (typeof THREE === 'undefined') {
        // Fallback for non-Three.js environments
        return {
            Color: class {
                constructor(hex = 0xffffff) {
                    this.hex = hex;
                    this.r = ((hex >> 16) & 255) / 255;
                    this.g = ((hex >> 8) & 255) / 255;
                    this.b = (hex & 255) / 255;
                }
                lerpColors(a, b, t) {
                    this.r = a.r + (b.r - a.r) * t;
                    this.g = a.g + (b.g - a.g) * t;
                    this.b = a.b + (b.b - a.b) * t;
                    return this;
                }
                setHex(hex) {
                    this.hex = hex;
                    this.r = ((hex >> 16) & 255) / 255;
                    this.g = ((hex >> 8) & 255) / 255;
                    this.b = (hex & 255) / 255;
                    return this;
                }
            }
        };
    }
    return { Color: THREE.Color };
}

// Ensure THREE.Color is available
const TH = ensureTHREE();
if (typeof THREE === 'undefined') {
    globalThis.THREE = TH;
}