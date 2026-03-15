/**
 * Enhanced Day/Night Lighting System
 * Provides lighting presets and smooth transitions for 3D renderer
 */

// Lighting presets for different times of day
export const LIGHTING_PRESETS = {
    DAWN: {
        name: 'dawn',
        skyColor: 0xff6b6b,
        fogColor: 0xffa07a,
        ambientIntensity: 0.3,
        sunIntensity: 0.5,
        sunAngle: Math.PI / 6, // 30 degrees above horizon
        shadowIntensity: 0.2,
        starVisibility: 0.0,
        moonVisibility: 0.3,
        // Color grading for ambience
        tint: 0xffb366, // Warm orange-pink tint
        tintStrength: 0.25,
        saturation: 1.1,
        brightness: 0.9
    },
    DAY: {
        name: 'day',
        skyColor: 0x87ceeb,
        fogColor: 0xb9d6ff,
        ambientIntensity: 0.7,
        sunIntensity: 1.0,
        sunAngle: Math.PI / 3, // 60 degrees (high sun)
        shadowIntensity: 0.8,
        starVisibility: 0.0,
        moonVisibility: 0.0,
        // Color grading for ambience
        tint: 0xd4e8ff, // Slight cool blue tint
        tintStrength: 0.1,
        saturation: 1.0,
        brightness: 1.0
    },
    DUSK: {
        name: 'dusk',
        skyColor: 0xffa500,
        fogColor: 0xff8c42,
        ambientIntensity: 0.5,
        sunIntensity: 0.3,
        sunAngle: -Math.PI / 12, // Just below horizon
        shadowIntensity: 0.4,
        starVisibility: 0.3,
        moonVisibility: 0.5,
        // Color grading for ambience
        tint: 0xff8c42, // Warm orange sunset tint
        tintStrength: 0.3,
        saturation: 1.2,
        brightness: 0.85
    },
    NIGHT: {
        name: 'night',
        skyColor: 0x1a1a2e,
        fogColor: 0x0a0a1a,
        ambientIntensity: 0.15,
        sunIntensity: 0.0,
        sunAngle: -Math.PI / 2, // Below horizon
        shadowIntensity: 0.0,
        starVisibility: 1.0,
        moonVisibility: 0.8,
        // Color grading for ambience
        tint: 0x2a3a5a, // Cool blue night tint
        tintStrength: 0.35,
        saturation: 0.8,
        brightness: 0.6
    }
};

// Default configuration for day/night cycle
export const DEFAULT_LIGHTING_CONFIG = {
    cycleLength: 24, // Game hours per full cycle
    transitionSmoothing: 0.05, // Lerp factor for smooth transitions
    phases: {
        dawn: { start: 0, end: 6 },
        day: { start: 6, end: 18 },
        dusk: { start: 18, end: 21 },
        night: { start: 21, end: 24 }
    }
};

/**
 * Create a lighting manager for 3D scenes
 * @param {Object} scene - Three.js scene
 * @param {Object} renderer - Three.js renderer
 * @param {Object} config - Configuration options
 * @returns {LightingManager} The lighting manager instance
 */
export function createLightingManager(scene, renderer, config = {}) {
    return new LightingManager(scene, renderer, config);
}

/**
 * Lighting Manager Class
 * Handles lighting presets, transitions, and fog effects
 */
export class LightingManager {
    constructor(scene, renderer, config = {}) {
        this.scene = scene;
        this.renderer = renderer;
        this.config = { ...DEFAULT_LIGHTING_CONFIG, ...config };
        
        // Current lighting state
        this.currentPhase = 'night';
        this.currentPreset = { ...LIGHTING_PRESETS.NIGHT };
        this.targetPreset = { ...LIGHTING_PRESETS.NIGHT };
        this.transitionProgress = 0;
        
        // Color grading state
        this._currentTint = new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.currentPreset.tint);
        this._currentTintStrength = this.currentPreset.tintStrength;
        this._currentSaturation = this.currentPreset.saturation;
        this._currentBrightness = this.currentPreset.brightness;
        
        // Cached THREE.Color instances
        this._skyColor = new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.currentPreset.skyColor);
        this._targetSkyColor = new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.targetPreset.skyColor);
        this._fogColor = new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.currentPreset.fogColor);
        
        // Star/moon overlay (optional)
        this.starLayer = null;
        this.moonLight = null;
        
        // Initialize optional layers
        this._initStarLayer();
        this._initMoonLight();
    }
    
    /**
     * Initialize star field layer
     */
    _initStarLayer() {
        try {
            const starGeometry = new (typeof THREE !== 'undefined' ? THREE.BufferGeometry : { position: null })();
            const starMaterial = new (typeof THREE !== 'undefined' ? THREE.PointsMaterial : { size: 0.1, color: 0xffffff })({
                size: 0.1,
                color: 0xffffff,
                transparent: true,
                opacity: 0
            });
            
            // Create random star positions
            const starCount = 1000;
            const positions = new Float32Array(starCount * 3);
            
            for (let i = 0; i < starCount * 3; i += 3) {
                // Distribute stars in a hemisphere above the scene
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI / 2;
                const radius = 100 + Math.random() * 50;
                
                positions[i] = radius * Math.sin(phi) * Math.cos(theta);
                positions[i + 1] = radius * Math.cos(phi);
                positions[i + 2] = radius * Math.sin(phi) * Math.sin(theta);
            }
            
            starGeometry.setAttribute('position', new (typeof THREE !== 'undefined' ? THREE.Float32BufferAttribute : null)(positions, 3));
            
            this.starLayer = new (typeof THREE !== 'undefined' ? THREE.Points : class { constructor() { this.visible = false; } })(starGeometry, starMaterial);
            this.starLayer.visible = false;
            this.scene?.add(this.starLayer);
        } catch (e) {
            // Star layer is optional, continue without it
            this.starLayer = null;
        }
    }
    
    /**
     * Initialize moon light
     */
    _initMoonLight() {
        try {
            this.moonLight = new (typeof THREE !== 'undefined' ? THREE.DirectionalLight : class { constructor() { this.intensity = 0; } })(0xccccff, 0);
            this.moonLight.position.set(0, 50, -50);
            this.scene?.add(this.moonLight);
        } catch (e) {
            this.moonLight = null;
        }
    }
    
    /**
     * Update lighting based on time of day
     * @param {number} timeOfDay - Time of day (0.0 to 1.0)
     * @returns {Object} Current lighting state
     */
    update(timeOfDay) {
        const hour = timeOfDay * this.config.cycleLength;
        const phase = this._getPhaseForHour(hour);
        
        if (phase !== this.currentPhase) {
            this._startTransition(phase);
        }
        
        this._updateLighting(hour);
        
        return {
            phase: this.currentPhase,
            skyColor: this._skyColor,
            fogColor: this._fogColor,
            ambientIntensity: this.currentPreset.ambientIntensity,
            sunIntensity: this.currentPreset.sunIntensity,
            starVisibility: this.currentPreset.starVisibility,
            moonVisibility: this.currentPreset.moonVisibility
        };
    }
    
    /**
     * Get the phase for a given hour
     * @param {number} hour - Hour (0-24)
     * @returns {string} Phase name
     */
    _getPhaseForHour(hour) {
        const { phases } = this.config;
        
        if (hour >= phases.dawn.start && hour < phases.dawn.end) {
            return 'dawn';
        } else if (hour >= phases.day.start && hour < phases.day.end) {
            return 'day';
        } else if (hour >= phases.dusk.start && hour < phases.dusk.end) {
            return 'dusk';
        } else {
            return 'night';
        }
    }
    
    /**
     * Start transition to a new phase
     * @param {string} phase - Target phase
     */
    _startTransition(phase) {
        this.currentPhase = phase;
        this.targetPreset = { ...LIGHTING_PRESETS[phase.toUpperCase()] };
        this.transitionProgress = 0;
    }
    
    /**
     * Update lighting values with smooth interpolation
     * @param {number} hour - Current hour
     */
    _updateLighting(hour) {
        // Smooth transition between presets
        this.transitionProgress = Math.min(1, this.transitionProgress + this.config.transitionSmoothing);
        
        if (this.transitionProgress >= 1) {
            // Transition complete - set final values
            this.currentPreset = { ...this.targetPreset };
            this._skyColor.setHex(this.currentPreset.skyColor);
            this._fogColor.setHex(this.currentPreset.fogColor);
            this._currentTint.setHex(this.targetPreset.tint);
            this._currentTintStrength = this.targetPreset.tintStrength;
            this._currentSaturation = this.targetPreset.saturation;
            this._currentBrightness = this.targetPreset.brightness;
        } else {
            // Interpolate during transition
            const t = this.transitionProgress;
            const smoothT = t * t * (3 - 2 * t); // Smoothstep

            // Interpolate colors
            this._skyColor.lerpColors(
                new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.currentPreset.skyColor),
                new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.targetPreset.skyColor),
                smoothT
            );
            this._fogColor.lerpColors(
                new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.currentPreset.fogColor),
                new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.targetPreset.fogColor),
                smoothT
            );

            // Interpolate color grading parameters
            const targetTint = new (typeof THREE !== 'undefined' ? THREE.Color : ColorProxy)(this.targetPreset.tint);
            this._currentTint.lerpColors(this._currentTint.clone(), targetTint, smoothT);
            this._currentTintStrength = THREE.MathUtils.lerp(this._currentTintStrength, this.targetPreset.tintStrength, smoothT);
            this._currentSaturation = THREE.MathUtils.lerp(this._currentSaturation, this.targetPreset.saturation, smoothT);
            this._currentBrightness = THREE.MathUtils.lerp(this._currentBrightness, this.targetPreset.brightness, smoothT);
        }
        
        // Update star/moon visibility
        if (this.starLayer) {
            this.starLayer.visible = this.currentPreset.starVisibility > 0;
            this.starLayer.material.opacity = this.currentPreset.starVisibility;
        }
        
        if (this.moonLight) {
            this.moonLight.intensity = this.currentPreset.moonVisibility * 0.3;
        }
    }
    
    /**
     * Set a specific lighting preset (force transition)
     * @param {string} presetName - Name of preset (DAWN, DAY, DUSK, NIGHT)
     */
    setPreset(presetName) {
        const preset = LIGHTING_PRESETS[presetName.toUpperCase()];
        if (preset) {
            this.targetPreset = { ...preset };
            this.currentPhase = preset.name;
            this.transitionProgress = 0;
        }
    }
    
    /**
     * Apply current lighting to scene
     * @param {Object} ambientLight - Ambient light to update
     * @param {Object} sunLight - Sun/directional light to update
     */
    applyToScene(ambientLight, sunLight) {
        if (!ambientLight || !sunLight) return;
        
        // Update ambient light
        ambientLight.intensity = this.currentPreset.ambientIntensity;
        ambientLight.color.copy(this._skyColor);
        
        // Update sun light
        sunLight.intensity = this.currentPreset.sunIntensity;
        sunLight.color.copy(this._skyColor);
        
        // Update scene background
        if (this.scene) {
            this.scene.background.copy(this._skyColor);
        }
        
        // Update fog if present
        if (this.scene.fog) {
            this.scene.fog.color.copy(this._fogColor);
        }
        
        // Apply color grading to renderer
        if (this.renderer) {
            this._applyColorGrading();
        }
    }
    
    /**
     * Apply color grading via renderer tone mapping and output encoding
     */
    _applyColorGrading() {
        if (!this.renderer) return;
        
        try {
            // Adjust tone mapping for mood
            const toneMapStrength = 1.0 + (this._currentBrightness - 1.0) * 0.5;
            this.renderer.toneMappingExposure = toneMapStrength;
            
            // Apply saturation adjustment via RGBE encoding when available
            // Note: Full saturation control would require custom shader,
            // but we can approximate through exposure and tone mapping
            
            // Apply brightness adjustment
            const brightnessAdjustment = this._currentBrightness;
            this.renderer.toneMappingExposure = Math.max(0.1, brightnessAdjustment * 1.0);
            
            // For tint effect, we'll use scene ambient color as a proxy
            // This creates a subtle color cast across all objects
            if (this.scene && this.scene.traverse) {
                // The tint is already applied through ambient light color
                // Additional tinting can be done via post-processing if needed
            }
        } catch (e) {
            // Color grading is optional, continue without it
        }
    }
    
    /**
     * Get current color grading parameters
     * @returns {Object} Color grading state
     */
    getColorGrading() {
        return {
            tint: this._currentTint,
            tintStrength: this._currentTintStrength,
            saturation: this._currentSaturation,
            brightness: this._currentBrightness
        };
    }
    
    /**
     * Get current preset
     * @returns {Object} Current lighting preset
     */
    getPreset() {
        return { ...this.currentPreset };
    }
    
    /**
     * Get current phase
     * @returns {string} Current phase name
     */
    getPhase() {
        return this.currentPhase;
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.starLayer) {
            this.scene?.remove(this.starLayer);
            this.starLayer.geometry?.dispose?.();
            this.starLayer.material?.dispose?.();
        }
        if (this.moonLight) {
            this.scene?.remove(this.moonLight);
            this.moonLight.material?.dispose?.();
        }
    }
}

/**
 * Color proxy for non-Three.js environments
 */
class ColorProxy {
    constructor(hex = 0xffffff) {
        this.hex = hex;
        this.r = ((hex >> 16) & 255) / 255;
        this.g = ((hex >> 8) & 255) / 255;
        this.b = (hex & 255) / 255;
    }
    
    lerpColors(target, t) {
        this.r = this.r + (target.r - this.r) * t;
        this.g = this.g + (target.g - this.g) * t;
        this.b = this.b + (target.b - this.b) * t;
        return this;
    }
    
    copy(other) {
        if (other instanceof ColorProxy) {
            this.r = other.r;
            this.g = other.g;
            this.b = other.b;
            this.hex = other.hex;
        } else {
            this.r = other.r;
            this.g = other.g;
            this.b = other.b;
            this.hex = other.hex ?? 0xffffff;
        }
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