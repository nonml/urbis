// Network Core Framework (Milestone H-01)
// Abstract network that supports sources, consumers, and propagation.
// Two operation modes: simple radius coverage (early) and connected graph (later).

import { clamp01 } from '../services/services.js';

// Coverage constants
const COVERAGE_MAX = 255;
const COVERAGE_MIN = 0;

/**
 * Base class for utility networks (power, water, sewage, data)
 */
export class NetworkCore {
    constructor(game, config) {
        this.game = game;
        this.name = config.name;
        this.map = game.map;
        this.width = game.map.width;
        this.height = game.map.height;
        this.size = this.width * this.height;

        // Configuration
        this.config = {
            coverageType: config.coverageType || 'radius', // 'radius' or 'graph'
            defaultRadius: config.defaultRadius || 10,
            decayRate: config.decayRate || 0.9, // Falloff factor per tile
            ...config.options,
        };

        // Network state
        this.sources = []; // Array of {x, y, capacity, quality}
        this.consumers = []; // Array of {x, y, demand, id}

        // Coverage map: packed Uint8 (0..255)
        this.coverage = new Uint8Array(this.size);

        // Metrics
        this.metrics = {
            supply: 0,
            demand: 0,
            coveragePct: 0,
            shortagePct: 0,
        };

        // Chunk cache for incremental updates
        this._chunkCache = new Map();
        this._dirty = true;
    }

    /**
     * Add a network source (generator, water plant, etc.)
     */
    addSource(x, y, capacity, quality = 1.0) {
        const source = { x, y, capacity, quality, active: true };
        this.sources.push(source);
        this._dirty = true;
        return source;
    }

    /**
     * Remove a network source
     */
    removeSource(source) {
        this.sources = this.sources.filter(s => s !== source);
        this._dirty = true;
    }

    /**
     * Add a network consumer (building that uses the service)
     */
    addConsumer(x, y, demand, id) {
        const consumer = { x, y, demand, id, active: true };
        this.consumers.push(consumer);
        this._dirty = true;
        return consumer;
    }

    /**
     * Remove a network consumer
     */
    removeConsumer(consumer) {
        this.consumers = this.consumers.filter(c => c !== consumer);
        this._dirty = true;
    }

    /**
     * Get coverage at a specific tile
     */
    getCoverage(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
        return this.coverage[y * this.width + x];
    }

    /**
     * Get normalized coverage (0..1)
     */
    getCoverageNorm(x, y) {
        return clamp01(this.getCoverage(x, y) / COVERAGE_MAX);
    }

    /**
     * Recompute coverage for specific chunks
     */
    recomputeChunks(chunkIds) {
        // Clear coverage if full rebuild
        if (!chunkIds || chunkIds.size === 0) {
            this.coverage.fill(0);
            this._chunkCache.clear();
        }

        const chunks = chunkIds || this._getAllChunks();
        this._dirty = false;

        for (const chunkId of chunks) {
            this._recomputeChunk(chunkId);
        }

        this._updateMetrics();
    }

    /**
     * Get all chunks that have sources
     */
    _getAllChunks() {
        const chunks = new Set();
        const { chunks: chunkManager } = this.game;
        if (!chunkManager) return chunks;

        for (const source of this.sources) {
            const chunkId = chunkManager.getChunkId(source.x, source.y);
            chunks.add(chunkId);
        }
        return chunks;
    }

    /**
     * Recompute coverage for a single chunk
     */
    _recomputeChunk(chunkId) {
        const bounds = this.game.chunks.getChunkBounds(chunkId);
        if (!bounds) return;

        // Clear chunk area in coverage
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const idx = y * this.width + x;
                this.coverage[idx] = 0;
            }
        }

        // Stamp sources into chunk
        for (const source of this.sources) {
            if (!source.active) continue;
            this._stampSource(source, bounds);
        }

        this._chunkCache.set(chunkId, true);
    }

    /**
     * Stamp a source's coverage into an area
     */
    _stampSource(source, bounds) {
        const { defaultRadius, decayRate } = this.config;
        const radius = defaultRadius * source.quality;

        const minX = Math.max(bounds.minX, source.x - radius);
        const maxX = Math.min(bounds.maxX, source.x + radius);
        const minY = Math.max(bounds.minY, source.y - radius);
        const maxY = Math.min(bounds.maxY, source.y + radius);

        const width = this.width;

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const idx = y * width + x;

                const dx = x - source.x;
                const dy = y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= radius) {
                    const falloff = 1 - (dist / radius);
                    const coverage = Math.floor(COVERAGE_MAX * source.quality * Math.pow(falloff, 2));

                    if (coverage > this.coverage[idx]) {
                        this.coverage[idx] = coverage;
                    }
                }
            }
        }
    }

    /**
     * Update metrics based on current coverage
     */
    _updateMetrics() {
        const totalTiles = this.size;
        let coveredTiles = 0;
        let totalCoverage = 0;
        let totalDemand = 0;

        // Calculate demand from consumers
        for (const consumer of this.consumers) {
            if (consumer.active) {
                totalDemand += consumer.demand;
            }
        }

        // Calculate coverage metrics
        for (let i = 0; i < this.size; i++) {
            if (this.coverage[i] > 0) {
                coveredTiles++;
                totalCoverage += this.coverage[i];
            }
        }

        const coveragePct = (coveredTiles / totalTiles) * 100;
        const avgCoverage = totalCoverage / totalTiles;
        const shortagePct = Math.max(0, (totalDemand - this.getSupply()) / totalDemand * 100);

        this.metrics = {
            supply: this.getSupply(),
            demand: totalDemand,
            coveragePct,
            avgCoverage: avgCoverage / COVERAGE_MAX,
            shortagePct,
            totalTiles,
            coveredTiles,
        };
    }

    /**
     * Get total supply from all sources
     */
    getSupply() {
        return this.sources.reduce((sum, s) => sum + (s.active ? s.capacity : 0), 0);
    }

    /**
     * Check if a tile is covered
     */
    isCovered(x, y, minCoverage = 0.3) {
        return this.getCoverageNorm(x, y) >= minCoverage;
    }

    /**
     * Get tile coverage info for UI
     */
    getTileInfo(x, y) {
        const norm = this.getCoverageNorm(x, y);
        const raw = this.getCoverage(x, y);
        return {
            covered: norm > 0,
            coverage: norm,
            rawValue: raw,
            sourceCount: this._getSourceCountAt(x, y),
        };
    }

    /**
     * Count sources affecting a tile
     */
    _getSourceCountAt(x, y) {
        let count = 0;
        for (const source of this.sources) {
            if (!source.active) continue;
            const dx = x - source.x;
            const dy = y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.config.defaultRadius * source.quality) {
                count++;
            }
        }
        return count;
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            name: this.name,
            sources: this.sources,
            consumers: this.consumers,
            metrics: this.metrics,
            lastUpdateTick: this.game.state.time.tick,
        };
    }

    /**
     * Deserialize for load
     */
    deserialize(data) {
        if (!data) return;
        this.sources = data.sources || [];
        this.consumers = data.consumers || [];
        this.metrics = data.metrics || { supply: 0, demand: 0, coveragePct: 0 };
        this._dirty = true;
        this.recomputeChunks(null);
    }

    /**
     * Update network (called each tick)
     */
    update() {
        if (this._dirty || this.game.state.time.tick % 5 === 0) {
            this._dirty = true;
            this.recomputeChunks(null);
        }
        return this.metrics;
    }
}

/**
 * Create a power network
 */
export function createPowerNetwork(game) {
    return new NetworkCore(game, {
        name: 'power',
        defaultRadius: 18,
        options: {
            coverageType: 'radius',
            decayRate: 0.9,
        },
    });
}

/**
 * Create a water network
 */
export function createWaterNetwork(game) {
    return new NetworkCore(game, {
        name: 'water',
        defaultRadius: 14,
        options: {
            coverageType: 'radius',
            decayRate: 0.85,
        },
    });
}

/**
 * Create a sewage network
 */
export function createSewageNetwork(game) {
    return new NetworkCore(game, {
        name: 'sewage',
        defaultRadius: 12,
        options: {
            coverageType: 'radius',
            decayRate: 0.8,
        },
    });
}

/**
 * Create a data grid network
 */
export function createDataGridNetwork(game) {
    return new NetworkCore(game, {
        name: 'data',
        defaultRadius: 16,
        options: {
            coverageType: 'radius',
            decayRate: 0.95,
        },
    });
}

/**
 * Create all networks
 */
export function createNetworks(game) {
    return {
        power: createPowerNetwork(game),
        water: createWaterNetwork(game),
        sewage: createSewageNetwork(game),
        data: createDataGridNetwork(game),
    };
}