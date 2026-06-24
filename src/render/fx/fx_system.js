/**
 * VFX System - Centralized Visual Effects Management
 * 
 * Provides pooled VFX management for:
 * - Floating text (damage, notifications, feedback)
 * - Particle bursts (explosions, impacts, celebrations)
 * - Progress rings (operations, timers)
 * - Highlight pulses (selection, focus)
 * - Screen shake (impacts, crises)
 */

import { createParticleSystem, PARTICLE_TYPES, PARTICLE_FLOATING_TEXT, PARTICLE_BURST, PARTICLE_PROGRESS_RING, PARTICLE_GLASS_SHARD } from '../../world/particle_pool.js';

// VFX effect types
export const VFX_TYPES = {
    FLOATING_TEXT: 'floating_text',
    PARTICLE_BURST: 'particle_burst',
    PROGRESS_RING: 'progress_ring',
    HIGHLIGHT_PULSE: 'highlight_pulse',
    SCREEN_SHAKE: 'screen_shake'
};

// Default VFX configurations
export const DEFAULT_VFX_CONFIG = {
    floatingText: {
        fontSize: 24,
        fontColor: 0xffffff,
        backgroundColor: 0x000000,
        backgroundOpacity: 0.7,
        duration: 2000,
        riseSpeed: 50, // pixels per second
        maxPoolSize: 100
    },
    particleBurst: {
        particleCount: 16,
        spread: Math.PI * 2,
        speed: 100, // pixels per second
        duration: 500,
        maxPoolSize: 50
    },
    progressRing: {
        radius: 30,
        lineWidth: 3,
        duration: 1500,
        maxPoolSize: 30
    },
    highlightPulse: {
        radius: 40,
        duration: 800,
        maxPoolSize: 20
    },
    screenShake: {
        maxIntensity: 10,
        maxDuration: 500
    }
};

/**
 * Floating Text VFX
 */
class FloatingTextVFX {
    constructor(config) {
        this.config = config;
        this.text = '';
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.color = 0xffffff;
        this.duration = config.duration;
        this.riseSpeed = config.riseSpeed;
        this.life = 0;
        this.active = false;
        this.element = null;
    }

    init(text, x, y, z, color, duration) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.z = z;
        this.color = color || this.config.fontColor;
        this.duration = duration || this.config.duration;
        this.life = 0;
        this.active = true;
        return this;
    }

    update(dt, camera, scene) {
        if (!this.active) return false;

        this.life += dt;
        const progress = this.life / this.duration;

        // Fade out in last 30%
        if (progress > 0.7) {
            const fadeProgress = (progress - 0.7) / 0.3;
            if (this.element) {
                this.element.style.opacity = 1 - fadeProgress;
            }
        }

        // Check if completed
        return this.life < this.duration;
    }

    deactivate() {
        this.active = false;
        this.life = this.duration;
    }
}

/**
 * Particle Burst VFX
 */
class ParticleBurstVFX {
    constructor(config) {
        this.config = config;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.color = 0xffffff;
        this.particleCount = config.particleCount;
        this.speed = config.speed;
        this.duration = config.duration;
        this.life = 0;
        this.active = false;
        this.particles = [];
    }

    init(x, y, z, color, particleCount, speed) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.color = color || 0xffffff;
        this.particleCount = particleCount || this.config.particleCount;
        this.speed = speed || this.config.speed;
        this.life = 0;
        this.active = true;
        this.particles = [];
        return this;
    }

    update(dt) {
        if (!this.active) return false;

        this.life += dt;
        return this.life < this.duration;
    }

    deactivate() {
        this.active = false;
        this.life = this.duration;
    }
}

/**
 * Progress Ring VFX
 */
class ProgressRingVFX {
    constructor(config) {
        this.config = config;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.progress = 0;
        this.color = 0x4a90e2;
        this.duration = config.duration;
        this.life = 0;
        this.active = false;
    }

    init(x, y, z, progress, color, duration) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.progress = progress || 0;
        this.color = color || 0x4a90e2;
        this.duration = duration || this.config.duration;
        this.life = 0;
        this.active = true;
        return this;
    }

    update(dt) {
        if (!this.active) return false;

        this.life += dt;
        return this.life < this.duration;
    }

    deactivate() {
        this.active = false;
        this.life = this.duration;
    }
}

/**
 * Highlight Pulse VFX
 */
class HighlightPulseVFX {
    constructor(config) {
        this.config = config;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.color = 0xe6b800;
        this.duration = config.duration;
        this.life = 0;
        this.active = false;
    }

    init(x, y, z, color, duration) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.color = color || 0xe6b800;
        this.duration = duration || this.config.duration;
        this.life = 0;
        this.active = true;
        return this;
    }

    update(dt) {
        if (!this.active) return false;

        this.life += dt;
        return this.life < this.duration;
    }

    deactivate() {
        this.active = false;
        this.life = this.duration;
    }
}

/**
 * Screen Shake Effect
 */
class ScreenShake {
    constructor(config) {
        this.config = config;
        this.intensity = 0;
        this.duration = 0;
        this.life = 0;
        this.active = false;
    }

    start(intensity, duration) {
        this.intensity = Math.min(intensity, this.config.maxIntensity);
        this.duration = Math.min(duration, this.config.maxDuration);
        this.life = 0;
        this.active = true;
    }

    update(dt) {
        if (!this.active) return { x: 0, y: 0 };

        this.life += dt;
        const progress = this.life / this.duration;

        // Ease out
        const remainingIntensity = this.intensity * (1 - progress);

        // Generate shake offset
        const angle = Date.now() * 0.01;
        const shakeX = (Math.sin(angle) * 0.7 + Math.cos(angle * 0.3) * 0.3) * remainingIntensity;
        const shakeY = (Math.cos(angle) * 0.7 + Math.sin(angle * 0.3) * 0.3) * remainingIntensity;

        if (this.life >= this.duration) {
            this.active = false;
            return { x: 0, y: 0 };
        }

        return { x: shakeX, y: shakeY };
    }
}

/**
 * FX System - Main VFX manager
 */
export class FXSystem {
    constructor(config = {}) {
        this.config = { ...DEFAULT_VFX_CONFIG, ...config };
        
        // Particle system for 3D particles
        this.particleSystem = createParticleSystem();
        
        // VFX pools
        this.floatingTextPool = [];
        this.particleBurstPool = [];
        this.progressRingPool = [];
        this.highlightPulsePool = [];
        
        // Active VFX
        this.activeFloatingText = [];
        this.activeParticleBursts = [];
        this.activeProgressRings = [];
        this.activeHighlightPulses = [];
        
        // Tracers (bullet trails)
        this._tracers = [];

        // Decals — managed by DecalManager when attached
        this._decals = [];
        this._decalManager = null;

        // Glass shatter animations
        this._glassAnimations = [];

        // Screen shake
        this.screenShake = new ScreenShake(this.config.screenShake);
        
        // Settings
        this.reducedMotion = false;
        this.enabled = true;
        
        // Optional renderer callback for camera shake
        this.onShakeCamera = null;
        
        // Initialize pools
        this._initPools();
    }

    _initPools() {
        // Initialize floating text pool
        for (let i = 0; i < this.config.floatingText.maxPoolSize; i++) {
            this.floatingTextPool.push(new FloatingTextVFX(this.config.floatingText));
        }
        
        // Initialize particle burst pool
        for (let i = 0; i < this.config.particleBurst.maxPoolSize; i++) {
            this.particleBurstPool.push(new ParticleBurstVFX(this.config.particleBurst));
        }
        
        // Initialize progress ring pool
        for (let i = 0; i < this.config.progressRing.maxPoolSize; i++) {
            this.progressRingPool.push(new ProgressRingVFX(this.config.progressRing));
        }
        
        // Initialize highlight pulse pool
        for (let i = 0; i < this.config.highlightPulse.maxPoolSize; i++) {
            this.highlightPulsePool.push(new HighlightPulseVFX(this.config.highlightPulse));
        }
    }

    /**
     * Show floating text at world position
     */
    showFloatingText(x, y, z, text, color, duration) {
        if (!this.enabled || this.reducedMotion) return null;

        // Try to get from pool
        let vfx = this.floatingTextPool.find(v => !v.active);
        if (!vfx) {
            // Pool exhausted, deactivate oldest
            const oldest = this.activeFloatingText.shift();
            if (oldest) {
                oldest.deactivate();
                vfx = oldest;
            }
        }

        if (vfx) {
            vfx.init(text, x, y, z, color, duration);
            this.activeFloatingText.push(vfx);
        }

        return vfx;
    }

    /**
     * Show particle burst at world position
     */
    showParticleBurst(x, y, z, color, count, speed) {
        if (!this.enabled || this.reducedMotion) return null;

        // Use particle system for 3D particles
        const particles = this.particleSystem.burst(
            PARTICLE_BURST,
            x, y, z,
            count || this.config.particleBurst.particleCount,
            {
                color: color || 0xffffff,
                speed: speed || this.config.particleBurst.speed / 1000
            }
        );

        return particles;
    }

    /**
     * Show progress ring at world position
     */
    showProgressRing(x, y, z, progress, color, duration) {
        if (!this.enabled || this.reducedMotion) return null;

        let vfx = this.progressRingPool.find(v => !v.active);
        if (!vfx) {
            const oldest = this.activeProgressRings.shift();
            if (oldest) {
                oldest.deactivate();
                vfx = oldest;
            }
        }

        if (vfx) {
            vfx.init(x, y, z, progress, color, duration);
            this.activeProgressRings.push(vfx);
        }

        return vfx;
    }

    /**
     * Show highlight pulse at world position
     */
    showHighlightPulse(x, y, z, color, duration) {
        if (!this.enabled || this.reducedMotion) return null;

        let vfx = this.highlightPulsePool.find(v => !v.active);
        if (!vfx) {
            const oldest = this.activeHighlightPulses.shift();
            if (oldest) {
                oldest.deactivate();
                vfx = oldest;
            }
        }

        if (vfx) {
            vfx.init(x, y, z, color, duration);
            this.activeHighlightPulses.push(vfx);
        }

        return vfx;
    }

    /**
     * Trigger screen shake
     */
    shakeCamera(intensity, duration) {
        if (!this.enabled || this.reducedMotion) return;
        this.screenShake.start(intensity, duration);
        
        // Call renderer callback if provided
        if (this.onShakeCamera) {
            this.onShakeCamera(intensity, duration);
        }
    }

    setDecalManager(dm) {
        this._decalManager = dm;
    }

    spawnDecal(x, y, z, color, duration) {
        if (!this.enabled || this.reducedMotion) return;
        if (this._decalManager) {
            this._decalManager.spawnGround(x, z, {
                color: color || 0x880000,
                duration: duration || 15000,
                weatherFade: true,
                size: 0.12 + (typeof crypto !== 'undefined' ? crypto.getRandomValues(new Uint8Array(1))[0] / 255 : 0.5) * 0.1,
            });
            return;
        }
        this._decals.push({ x, y, z, color: color || 0x880000, duration: duration || 5000, life: 0 });
    }

    getDecals() {
        return this._decals;
    }

    showTracer(sx, sy, sz, ex, ey, ez, color, duration, length) {
        if (!this.enabled || this.reducedMotion) return;
        this._tracers.push({
            sx, sy, sz, ex, ey, ez,
            color: color || 0xffff88,
            duration: duration || 120,
            length: length || 0.6,
            life: 0,
        });
    }

    getTracers() {
        return this._tracers;
    }

    /**
     * Update all VFX
     */
    update(dt, camera, scene) {
        if (!this.enabled) return;

        // Update particle system
        this.particleSystem.update(dt);

        // Update floating text
        this.activeFloatingText = this.activeFloatingText.filter(vfx => {
            const stillActive = vfx.update(dt, camera, scene);
            if (!stillActive) {
                vfx.deactivate();
            }
            return stillActive;
        });

        // Update particle bursts
        this.activeParticleBursts = this.activeParticleBursts.filter(vfx => {
            const stillActive = vfx.update(dt);
            if (!stillActive) {
                vfx.deactivate();
            }
            return stillActive;
        });

        // Update progress rings
        this.activeProgressRings = this.activeProgressRings.filter(vfx => {
            const stillActive = vfx.update(dt);
            if (!stillActive) {
                vfx.deactivate();
            }
            return stillActive;
        });

        // Update highlight pulses
        this.activeHighlightPulses = this.activeHighlightPulses.filter(vfx => {
            const stillActive = vfx.update(dt);
            if (!stillActive) {
                vfx.deactivate();
            }
            return stillActive;
        });

        // Update tracers
        for (const t of this._tracers) t.life += dt;
        this._tracers = this._tracers.filter(t => t.life < t.duration);

        // Update decals — DecalManager handles its own if attached
        if (this._decalManager) {
            this._decalManager.update(dt);
        } else {
            for (const d of this._decals) d.life += dt;
            this._decals = this._decals.filter(d => d.life < d.duration);
        }

        // Update glass shatter animations
        this._glassAnimations = this._glassAnimations.filter(anim => {
            anim.t += dt / anim.duration;
            if (anim.t >= 1.0) {
                if (anim.shaderRef?.uniforms?.uShatter) {
                    anim.shaderRef.uniforms.uShatter.value = 1.0;
                }
                return false;
            }
            if (anim.shaderRef?.uniforms?.uShatter) {
                anim.shaderRef.uniforms.uShatter.value = anim.t;
            }
            return true;
        });

        // Update screen shake
        this.screenShake.update(dt);
    }

    shatterGlass(material, duration = 0.4) {
        const ref = material?.userData?.shatterRef;
        if (!ref) return;
        this._glassAnimations.push({
            shaderRef: ref,
            t: 0,
            duration,
        });
    }

    glassShardBurst(x, y, z, count = 12) {
        const shardColors = [0x88ccff, 0xaaddff, 0x99bbee, 0xccddff];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 1.5 + (i % 3) * 0.5;
            this.particleSystem.spawn(PARTICLE_GLASS_SHARD, x, y, z, {
                vx: Math.cos(angle) * speed,
                vy: 2 + (i % 4) * 0.3,
                vz: Math.sin(angle) * speed,
                size: 0.03 + (i % 3) * 0.01,
                color: shardColors[i % shardColors.length],
                alpha: 0.8,
                rotationSpeed: 3 + i * 0.5,
                maxLife: 400 + (i % 5) * 80,
            });
        }
    }

    /**
     * Get screen shake offset
     */
    getScreenShakeOffset() {
        return this.screenShake.update(0);
    }

    /**
     * Set reduced motion mode
     */
    setReducedMotion(enabled) {
        this.reducedMotion = enabled;
    }

    /**
     * Enable/disable all VFX
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            floatingText: {
                active: this.activeFloatingText.length,
                poolSize: this.floatingTextPool.length
            },
            particleBursts: {
                active: this.activeParticleBursts.length,
                poolSize: this.particleBurstPool.length
            },
            progressRings: {
                active: this.activeProgressRings.length,
                poolSize: this.progressRingPool.length
            },
            highlightPulses: {
                active: this.activeHighlightPulses.length,
                poolSize: this.highlightPulsePool.length
            },
            particleSystem: this.particleSystem.getStats(),
            screenShake: {
                active: this.screenShake.active,
                intensity: this.screenShake.intensity
            }
        };
    }

    /**
     * Clear all VFX
     */
    clear() {
        this.activeFloatingText.forEach(v => v.deactivate());
        this.activeParticleBursts.forEach(v => v.deactivate());
        this.activeProgressRings.forEach(v => v.deactivate());
        this.activeHighlightPulses.forEach(v => v.deactivate());
        this.activeFloatingText = [];
        this.activeParticleBursts = [];
        this.activeProgressRings = [];
        this.activeHighlightPulses = [];
        this.particleSystem.clear();
        this._glassAnimations = [];
        this.screenShake.active = false;
    }
}

/**
 * Create an FX system instance
 */
export function createFXSystem(config = {}) {
    return new FXSystem(config);
}

// Singleton instance
let fxSystemInstance = null;

/**
 * Get the global FX system instance
 */
export function getFXSystem() {
    if (!fxSystemInstance) {
        fxSystemInstance = createFXSystem();
    }
    return fxSystemInstance;
}
