// Surveillance Sources System (Milestone K-02)
// Manages intel collection from various surveillance sources:
// cameras, data grid, informants, public reports, etc.

import { EVENT_TYPES } from '../events.js';
import { randomId } from '../../rng.js';

// Source types and their characteristics
export const SURVEILLANCE_SOURCES = {
    // Camera-based surveillance
    CAMERA_HACK: {
        id: 'camera_hack',
        name: 'Camera Hack',
        type: 'camera',
        category: 'surveillance',
        baseIntelPerTick: 0.5,
        range: 8,
        costPerTick: 0.1,
        description: 'Hacked city cameras providing passive intel',
    },
    CITY_CAMERA: {
        id: 'city_camera',
        name: 'City Camera',
        type: 'camera',
        category: 'surveillance',
        baseIntelPerTick: 0.3,
        range: 6,
        costPerTick: 0.0,
        description: 'Official city surveillance camera',
    },
    PRIVATE_CAMERA: {
        id: 'private_camera',
        name: 'Private Camera',
        type: 'camera',
        category: 'surveillance',
        baseIntelPerTick: 0.4,
        range: 10,
        costPerTick: 0.0,
        description: 'Private business surveillance',
    },

    // Data grid sources
    DATA_HUB: {
        id: 'data_hub',
        name: 'Data Hub',
        type: 'data',
        category: 'infrastructure',
        baseIntelPerTick: 1.0,
        range: 15,
        costPerTick: 0.2,
        description: 'Data grid hub collecting network traffic intel',
    },
    CELL_TOWER: {
        id: 'cell_tower',
        name: 'Cell Tower',
        type: 'data',
        category: 'infrastructure',
        baseIntelPerTick: 0.6,
        range: 12,
        costPerTick: 0.1,
        description: 'Cell tower intercepting mobile traffic',
    },

    // Human sources
    INFORMANT: {
        id: 'informant',
        name: 'Informant',
        type: 'human',
        category: 'intelligence',
        baseIntelPerTick: 2.0,
        range: 4,
        costPerTick: 0.5,
        description: 'Human informant providing human intelligence',
        maxConfidence: 0.9,
    },
    UNDERCOVER_AGENT: {
        id: 'undercover_agent',
        name: 'Undercover Agent',
        type: 'human',
        category: 'intelligence',
        baseIntelPerTick: 3.0,
        range: 3,
        costPerTick: 1.0,
        description: 'Deep cover agent with high-value intel',
        maxConfidence: 0.95,
    },

    // Public sources
    PUBLIC_REPORT: {
        id: 'public_report',
        name: 'Public Report',
        type: 'public',
        category: 'citizen',
        baseIntelPerTick: 0.2,
        range: 20,
        costPerTick: 0.0,
        description: 'Publicly reported information',
        maxConfidence: 0.6,
    },
    NEWS_MEDIA: {
        id: 'news_media',
        name: 'News Media',
        type: 'public',
        category: 'media',
        baseIntelPerTick: 0.3,
        range: 25,
        costPerTick: 0.0,
        description: 'News reports and media coverage',
        maxConfidence: 0.7,
    },

    // Law enforcement
    POLICE_REPORT: {
        id: 'police_report',
        name: 'Police Report',
        type: 'law_enforcement',
        category: 'official',
        baseIntelPerTick: 1.5,
        range: 10,
        costPerTick: 0.1,
        description: 'Police department intelligence',
        maxConfidence: 0.8,
    },
    WARRANT_RECORD: {
        id: 'warrant_record',
        name: 'Warrant Record',
        type: 'law_enforcement',
        category: 'official',
        baseIntelPerTick: 2.5,
        range: 8,
        costPerTick: 0.3,
        description: 'Legal warrant data and records',
        maxConfidence: 0.95,
    },
};

// Source states
export const SOURCE_STATES = {
    ACTIVE: 'active',
    DORMANT: 'dormant',
    COMPROMISED: 'compromised',
    DESTROYED: 'destroyed',
};

/**
 * Represents a surveillance source that generates intel
 */
export class SurveillanceSource {
    constructor(data, rng = null) {
        this.id = data.id || randomId('source');
        this.type = data.type;
        this.name = data.name || SURVEILLANCE_SOURCES[data.type]?.name || 'Unknown Source';
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.state = data.state || SOURCE_STATES.ACTIVE;
        this.lastTickGenerated = data.lastTickGenerated || 0;
        this.totalIntelGenerated = data.totalIntelGenerated || 0;
        this.confidenceModifier = data.confidenceModifier || 1.0;
        this.owner = data.owner || 'player';
        this.metadata = data.metadata || {};
        this.rng = rng;
    }

    /**
     * Get theintel generation rate for this source
     */
    getIntelRate() {
        const base = SURVEILLANCE_SOURCES[this.type]?.baseIntelPerTick || 0.5;
        return base * this.confidenceModifier;
    }

    /**
     * Check if this source can generate intel
     */
    canGenerateIntel() {
        return this.state === SOURCE_STATES.ACTIVE;
    }

    /**
     * Attempt to generate intel
     */
    generateIntel(game, currentTick) {
        if (!this.canGenerateIntel() || currentTick <= this.lastTickGenerated) {
            return null;
        }

        const intelRate = this.getIntelRate();
        const intelGenerated = this.rng?.chance(intelRate) ? 1 : 0;

        if (intelGenerated > 0) {
            this.lastTickGenerated = currentTick;
            this.totalIntelGenerated += intelGenerated;

            return {
                sourceId: this.id,
                sourceType: this.type,
                intelAmount: intelGenerated,
                x: this.x,
                y: this.y,
                confidence: this.getConfidence(),
            };
        }

        return null;
    }

    /**
     * Get confidence modifier for intel from this source
     */
    getConfidence() {
        const baseConfidence = SURVEILLANCE_SOURCES[this.type]?.maxConfidence || 0.7;
        return Math.min(1.0, baseConfidence * this.confidenceModifier);
    }

    /**
     * Set source state
     */
    setState(newState) {
        this.state = newState;
    }

    /**
     * Get source info for UI
     */
    getInfo() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            x: this.x,
            y: this.y,
            state: this.state,
            intelRate: this.getIntelRate(),
            totalGenerated: this.totalIntelGenerated,
            confidence: this.getConfidence(),
            owner: this.owner,
        };
    }
}

/**
 * Manages all surveillance sources
 */
export class SurveillanceSourceManager {
    constructor(game, rng = null) {
        this.game = game;
        this.rng = rng;
        this.sources = [];
        this._sourceMap = new Map(); // id -> source
    }

    /**
     * Initialize with existing buildings/cameras
     */
    initialize() {
        this._rebuildFromBuildings();
    }

    /**
     * Rebuild sources from game buildings
     */
    _rebuildFromBuildings() {
        this.sources = [];
        this._sourceMap.clear();

        const buildingSources = [
            { type: 'PRIVATE_CAMERA', demand: 1 },
            { type: 'DATA_HUB', demand: 2 },
            { type: 'CELL_TOWER', demand: 3 },
        ];

        let idCounter = 0;
        for (const b of this.game.buildings.buildings) {
            for (const sourceDef of buildingSources) {
                // Add source based on building type and capacity
                if (this.rng?.chance(0.3)) {
                    const source = new SurveillanceSource({
                        type: sourceDef.type,
                        x: b.x,
                        y: b.y,
                        id: `source_${b.id}_${idCounter++}`,
                        owner: 'player',
                    });
                    this.sources.push(source);
                    this._sourceMap.set(source.id, source);
                }
            }
        }
    }

    /**
     * Add a new surveillance source
     */
    addSource(x, y, type, metadata = {}) {
        const source = new SurveillanceSource({
            type,
            x,
            y,
            metadata,
            owner: 'player',
        });
        this.sources.push(source);
        this._sourceMap.set(source.id, source);
        return source;
    }

    /**
     * Remove a surveillance source
     */
    removeSource(sourceId) {
        const source = this._sourceMap.get(sourceId);
        if (source) {
            this.sources = this.sources.filter(s => s.id !== sourceId);
            this._sourceMap.delete(sourceId);
            return true;
        }
        return false;
    }

    /**
     * Get source by ID
     */
    getSource(sourceId) {
        return this._sourceMap.get(sourceId);
    }

    /**
     * Get active sources
     */
    getActiveSources() {
        return this.sources.filter(s => s.canGenerateIntel());
    }

    /**
     * Update all sources (called each tick)
     */
    update() {
        const currentTick = this.game.state.time?.tick || 0;
        const intelPings = [];

        for (const source of this.sources) {
            if (source.canGenerateIntel()) {
                const ping = source.generateIntel(this.game, currentTick);
                if (ping) {
                    intelPings.push(ping);

                    // Emit event for intel generation
                    this.game.eventBus.emit(EVENT_TYPES.INTEL_GENERATED, {
                        sourceId: source.id,
                        sourceType: source.type,
                        intelAmount: ping.intelAmount,
                        tick: currentTick,
                    });
                }
            }
        }

        return {
            activeSourceCount: this.getActiveSources().length,
            intelPings: intelPings.length,
        };
    }

    /**
     * Get intel from all sources
     */
    getAllIntel() {
        let total = 0;
        for (const source of this.sources) {
            total += source.totalIntelGenerated;
        }
        return total;
    }

    /**
     * Get sources by type
     */
    getByType(type) {
        return this.sources.filter(s => s.type === type);
    }

    /**
     * Get sources by location (within radius)
     */
    getByLocation(x, y, radius = 10) {
        return this.sources.filter(s => {
            const dx = x - s.x;
            const dy = y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return dist <= radius;
        });
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            sources: this.sources.map(s => ({
                id: s.id,
                type: s.type,
                x: s.x,
                y: s.y,
                state: s.state,
                lastTickGenerated: s.lastTickGenerated,
                totalIntelGenerated: s.totalIntelGenerated,
                confidenceModifier: s.confidenceModifier,
                owner: s.owner,
                metadata: s.metadata,
            })),
        };
    }

    /**
     * Deserialize for load
     */
    deserialize(data) {
        if (!data || !data.sources) return;
        this.sources = [];
        this._sourceMap.clear();
        for (const sourceData of data.sources) {
            const source = new SurveillanceSource(sourceData);
            this.sources.push(source);
            this._sourceMap.set(source.id, source);
        }
    }

    /**
     * Get summary for UI
     */
    getSummary() {
        return {
            totalSources: this.sources.length,
            activeSources: this.getActiveSources().length,
            byType: {},
            intelGenerated: this.getAllIntel(),
        };
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            sources: this.sources.map(s => ({
                id: s.id,
                type: s.type,
                x: s.x,
                y: s.y,
                state: s.state,
                lastTickGenerated: s.lastTickGenerated,
                totalIntelGenerated: s.totalIntelGenerated,
                confidenceModifier: s.confidenceModifier,
                owner: s.owner,
                metadata: s.metadata,
            })),
        };
    }
}

/**
 * Create surveillance source manager
 */
export function createSurveillanceSources(game) {
    return new SurveillanceSourceManager(game);
}