// Data Grid v1 (Milestone H-04)
// Data coverage comes from towers/hubs; cameras are intel sources within coverage.
// No phone hacking required: it's city-owned infrastructure you invest in.

import { NetworkCore, createDataGridNetwork } from './network_core.js';
import { EVENT_TYPES } from '../events.js';

const DEFAULT_DATA_VALUES = {
    cellTower: { capacity: 60, demand: 2, upkeep: 3 },
    cameraPole: { capacity: 0, demand: 1, upkeep: 1 },
    dataHub: { capacity: 100, demand: 5, upkeep: 5 },
};

// Data sources (towers, hubs, etc.)
export class DataDataSource {
    constructor(x, y, capacity, type, id) {
        this.x = x;
        this.y = y;
        this.capacity = capacity;
        this.type = type;
        this.id = id;
        this.active = true;
    }
}

// Data consumers (cameras, sensors)
export class DataDataConsumer {
    constructor(x, y, demand, id) {
        this.x = x;
        this.y = y;
        this.demand = demand;
        this.id = id;
        this.active = true;
        this.covered = false;
    }
}

export class DataGridSystem {
    constructor(game) {
        this.game = game;
        this.network = createDataGridNetwork(game);

        // Data sources and consumers
        this.sources = [];
        this.consumers = [];

        // Coverage percentage
        this.coveragePct = 0;
        this.blindSpotCount = 0;

        // Intel pings (events from covered cameras)
        this.intelPings = [];
    }

    /**
     * Initialize data grid with existing buildings
     */
    initialize() {
        this._rebuildNetwork();
    }

    /**
     * Rebuild data grid from buildings
     */
    _rebuildNetwork() {
        this.sources = [];
        this.consumers = [];
        this.network.sources = [];
        this.network.consumers = [];

        for (const b of this.game.buildings.buildings) {
            const buildingDef = this.game.constants.BUILDING_TYPES[b.type] || {};
            const capacity = buildingDef.dataCapacity || 0;
            const demand = buildingDef.dataDemand || 0;

            if (capacity > 0) {
                const source = new DataDataSource(b.x, b.y, capacity, b.type, b.id);
                this.sources.push(source);
                this.network.addSource(b.x, b.y, capacity, 1.0);
            }

            if (demand > 0) {
                const consumer = new DataDataConsumer(b.x, b.y, demand, b.id);
                this.consumers.push(consumer);
                this.network.addConsumer(b.x, b.y, demand, b.id);
            }
        }

        this.network.recomputeChunks(null);
    }

    /**
     * Get coverage at tile
     */
    getCoverage(x, y) {
        return this.network.getCoverageNorm(x, y);
    }

    /**
     * Check if a tile is covered
     */
    isCovered(x, y, minCoverage = 0.3) {
        return this.network.isCovered(x, y, minCoverage);
    }

    /**
     * Update data grid status
     */
    update() {
        const metrics = this.network.update();

        // Calculate coverage percentage
        this.coveragePct = metrics.coveragePct || 0;
        this.blindSpotCount = metrics.totalTiles - metrics.coveredTiles;

        // Update consumer coverage status
        for (const consumer of this.consumers) {
            consumer.covered = this.network.isCovered(consumer.x, consumer.y, 0.3);
        }

        // Check for intel pings from covered cameras
        this._checkIntelPings();

        return {
            coveragePct: this.coveragePct,
            blindSpotCount: this.blindSpotCount,
            sourceCount: this.sources.length,
            consumerCount: this.consumers.length,
        };
    }

    /**
     * Check for intel pings from active cameras
     */
    _checkIntelPings() {
        // Remove old pings
        const now = this.game.state.time.tick;
        this.intelPings = this.intelPings.filter(p => now - p.tick < 100);

        // Add new pings from covered cameras
        const newPings = [];
        for (const consumer of this.consumers) {
            if (consumer.covered && !consumer.lastPing) {
                consumer.lastPing = now;
                newPings.push({
                    type: 'camera_ping',
                    tick: now,
                    x: consumer.x,
                    y: consumer.y,
                    sourceId: consumer.id,
                    dataLevel: 1,
                });
            }
        }
        this.intelPings.push(...newPings);

        // Emit events for intel pings
        for (const ping of newPings) {
            this.game.eventBus.emit(EVENT_TYPES.INTEL_PING, {
                ping,
                network: 'data',
            });
        }
    }

    /**
     * Add a data source (tower, hub)
     */
    addSource(x, y, type) {
        const values = DEFAULT_DATA_VALUES[type] || DEFAULT_DATA_VALUES.cellTower;
        const source = new DataDataSource(x, y, values.capacity, type, Date.now());
        this.sources.push(source);
        this.network.addSource(x, y, values.capacity, 1.0);
        return source;
    }

    /**
     * Add a data consumer (camera, sensor)
     */
    addConsumer(x, y, type) {
        const values = DEFAULT_DATA_VALUES[type] || DEFAULT_DATA_VALUES.cameraPole;
        const consumer = new DataDataConsumer(x, y, values.demand, Date.now());
        this.consumers.push(consumer);
        this.network.addConsumer(x, y, values.demand, consumer.id);
        return consumer;
    }

    /**
     * Remove a source
     */
    removeSource(source) {
        this.sources = this.sources.filter(s => s !== source);
        this.network.removeSource(source);
    }

    /**
     * Remove a consumer
     */
    removeConsumer(consumer) {
        this.consumers = this.consumers.filter(c => c !== consumer);
        this.network.removeConsumer(consumer);
    }

    /**
     * Get data info for UI
     */
    getInfo() {
        return {
            coveragePct: this.coveragePct,
            blindSpotCount: this.blindSpotCount,
            sourceCount: this.sources.length,
            consumerCount: this.consumers.length,
            intelPings: this.intelPings.length,
        };
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            sources: this.sources.map(s => ({
                x: s.x,
                y: s.y,
                capacity: s.capacity,
                type: s.type,
                id: s.id,
            })),
            consumers: this.consumers.map(c => ({
                x: c.x,
                y: c.y,
                demand: c.demand,
                id: c.id,
                covered: c.covered,
            })),
            network: this.network.serialize(),
            coveragePct: this.coveragePct,
            blindSpotCount: this.blindSpotCount,
            intelPings: this.intelPings,
        };
    }

    /**
     * Deserialize for load
     */
    deserialize(data) {
        if (!data) return;
        this.sources = (data.sources || []).map(s => new DataDataSource(s.x, s.y, s.capacity, s.type, s.id));
        this.consumers = (data.consumers || []).map(c => new DataDataConsumer(c.x, c.y, c.demand, c.id));
        this.network.deserialize(data.network);
        this.coveragePct = data.coveragePct || 0;
        this.blindSpotCount = data.blindSpotCount || 0;
        this.intelPings = data.intelPings || [];
    }
}

/**
 * Create data grid system
 */
export function createDataGridSystem(game) {
    return new DataGridSystem(game);
}