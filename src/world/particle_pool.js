/**
 * Particle Pool System - Object Pooling for VFX Performance
 * 
 * Provides efficient particle management by reusing particle objects
 * instead of constantly creating and destroying them.
 */

// Particle types
export const PARTICLE_FLOATING_TEXT = 'floating_text';
export const PARTICLE_BURST = 'particle_burst';
export const PARTICLE_PROGRESS_RING = 'progress_ring';
export const PARTICLE_RAIN = 'rain';
export const PARTICLE_SNOW = 'snow';
export const PARTICLE_SPARKLE = 'sparkle';
export const PARTICLE_GLASS_SHARD = 'glass_shard';

export const PARTICLE_TYPES = {
    [PARTICLE_FLOATING_TEXT]: {
        maxSize: 50,
        lifetime: 2000,
        blendMode: 'normal'
    },
    [PARTICLE_BURST]: {
        maxSize: 100,
        lifetime: 500,
        blendMode: 'additive'
    },
    [PARTICLE_PROGRESS_RING]: {
        maxSize: 30,
        lifetime: 1500,
        blendMode: 'normal'
    },
    [PARTICLE_RAIN]: {
        maxSize: 500,
        lifetime: 1000,
        blendMode: 'normal'
    },
    [PARTICLE_SNOW]: {
        maxSize: 300,
        lifetime: 3000,
        blendMode: 'normal'
    },
    [PARTICLE_SPARKLE]: {
        maxSize: 50,
        lifetime: 800,
        blendMode: 'additive'
    },
    [PARTICLE_GLASS_SHARD]: {
        maxSize: 80,
        lifetime: 600,
        blendMode: 'normal'
    }
};

/**
 * Particle class representing a single particle instance
 */
export class Particle {
    constructor(type) {
        this.type = type;
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.life = 0;
        this.maxLife = 1000;
        this.size = 1;
        this.color = 0xffffff;
        this.alpha = 1;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.data = null; // Custom data for specific particle types
    }

    /**
     * Initialize particle with given parameters
     */
    init(x, y, z, options = {}) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.z = z;
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;
        this.vz = options.vz || 0;
        this.life = 0;
        this.maxLife = options.lifetime || PARTICLE_TYPES[this.type]?.lifetime || 1000;
        this.size = options.size || 1;
        this.color = options.color !== undefined ? options.color : 0xffffff;
        this.alpha = options.alpha !== undefined ? options.alpha : 1;
        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        this.data = options.data || null;
    }

    /**
     * Update particle state
     */
    update(dt) {
        if (!this.active) return;

        this.life += dt;
        
        // Update position with velocity
        this.x += this.vx * (dt / 1000);
        this.y += this.vy * (dt / 1000);
        this.z += this.vz * (dt / 1000);
        
        // Update rotation
        this.rotation += this.rotationSpeed * (dt / 1000);
        
        // Calculate alpha based on life
        const lifeRatio = this.life / this.maxLife;
        if (lifeRatio > 0.8) {
            this.alpha = 1 - (lifeRatio - 0.8) * 5; // Fade out last 20%
        }
        
        return this.life < this.maxLife;
    }

    /**
     * Deactivate particle and return to pool
     */
    deactivate() {
        this.active = false;
        this.life = this.maxLife;
        this.alpha = 0;
    }
}

/**
 * ParticlePool class managing pooled particles of a specific type
 */
export class ParticlePool {
    constructor(type) {
        this.type = type;
        this.maxSize = PARTICLE_TYPES[type]?.maxSize || 100;
        this.particles = [];
        this.activeParticles = [];
        
        // Pre-allocate particles
        for (let i = 0; i < this.maxSize; i++) {
            this.particles.push(new Particle(type));
        }
    }

    /**
     * Acquire a particle from the pool
     */
    acquire() {
        // First try to reuse an inactive particle
        for (const particle of this.particles) {
            if (!particle.active) {
                return particle;
            }
        }
        // Pool exhausted, return null
        return null;
    }

    /**
     * Spawn a new particle at position
     */
    spawn(x, y, z, options = {}) {
        const particle = this.acquire();
        if (particle) {
            particle.init(x, y, z, options);
        }
        return particle;
    }

    /**
     * Spawn multiple particles in a burst pattern
     */
    burst(x, y, z, count, options = {}) {
        const spawned = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = options.speed || 2;
            const particle = this.spawn(x, y, z, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                vz: options.vz || 1,
                ...options
            });
            if (particle) {
                spawned.push(particle);
            }
        }
        return spawned;
    }

    /**
     * Update all active particles
     */
    update(dt) {
        this.activeParticles = this.particles.filter(p => {
            if (!p.active) return false;
            const stillAlive = p.update(dt);
            if (!stillAlive) {
                p.deactivate();
            }
            return stillAlive;
        });
        return this.activeParticles;
    }

    /**
     * Get count of active particles
     */
    getActiveCount() {
        return this.activeParticles ? this.activeParticles.length : 
            this.particles.filter(p => p.active).length;
    }

    /**
     * Clear all particles
     */
    clear() {
        for (const particle of this.particles) {
            particle.deactivate();
        }
    }

    /**
     * Reset pool (for testing/debugging)
     */
    reset() {
        this.clear();
    }
}

/**
 * ParticleSystem class managing all particle pools
 */
export class ParticleSystem {
    constructor() {
        this.pools = new Map();
        this.initialized = false;
    }

    /**
     * Initialize particle system with all particle types
     */
    init() {
        if (this.initialized) return;
        
        for (const type of Object.keys(PARTICLE_TYPES)) {
            this.pools.set(type, new ParticlePool(type));
        }
        this.initialized = true;
    }

    /**
     * Get pool for a specific particle type
     */
    getPool(type) {
        if (!this.initialized) this.init();
        return this.pools.get(type);
    }

    /**
     * Spawn particle of specific type
     */
    spawn(type, x, y, z, options = {}) {
        const pool = this.getPool(type);
        return pool ? pool.spawn(x, y, z, options) : null;
    }

    /**
     * Spawn particle burst
     */
    burst(type, x, y, z, count, options = {}) {
        const pool = this.getPool(type);
        return pool ? pool.burst(x, y, z, count, options) : [];
    }

    /**
     * Update all particle pools
     */
    update(dt) {
        if (!this.initialized) return;
        
        const results = {};
        for (const [type, pool] of this.pools) {
            results[type] = pool.update(dt);
        }
        return results;
    }

    /**
     * Get statistics for all pools
     */
    getStats() {
        if (!this.initialized) return {};
        
        const stats = {};
        for (const [type, pool] of this.pools) {
            stats[type] = {
                active: pool.getActiveCount(),
                max: pool.maxSize
            };
        }
        return stats;
    }

    /**
     * Clear all particles
     */
    clear() {
        for (const pool of this.pools.values()) {
            pool.clear();
        }
    }
}

// Singleton instance
let particleSystemInstance = null;

/**
 * Create or get the global particle system instance
 */
export function getParticleSystem() {
    if (!particleSystemInstance) {
        particleSystemInstance = new ParticleSystem();
    }
    return particleSystemInstance;
}

/**
 * Create a new independent particle system instance
 */
export function createParticleSystem() {
    const system = new ParticleSystem();
    system.init();
    return system;
}