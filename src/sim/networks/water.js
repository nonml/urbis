// Water + Sewage Network v1 (Milestone H-03)
// Water plant provides supply; buildings consume.
// If sewage capacity insufficient, pollution rises and illness crises increase.

import { NetworkCore, createWaterNetwork, createSewageNetwork } from './network_core.js';

const DEFAULT_WATER_VALUES = {
    waterPlant: { capacity: 80, demand: 3, upkeep: 2 },
    townHall: { capacity: 40, demand: 1, upkeep: 1 },
};

const DEFAULT_SEWAGE_VALUES = {
    sewagePlant: { capacity: 60, demand: 2, upkeep: 2 },
    townHall: { capacity: 25, demand: 1, upkeep: 1 },
};

export class WaterSystem {
    constructor(game) {
        this.game = game;
        this.waterNetwork = createWaterNetwork(game);
        this.sewageNetwork = createSewageNetwork(game);

        // Pollution state
        this.pollution = new Uint8Array(game.map.width * game.map.height);
        this.pollutionLevel = 0;
        this.sewageShortage = false;

        // Health impact tracking
        this.illnessRate = 0;
    }

    /**
     * Initialize water system with existing buildings
     */
    initialize() {
        this._rebuildNetworks();
    }

    /**
     * Rebuild both water and sewage networks
     */
    _rebuildNetworks() {
        this.waterNetwork.sources = [];
        this.waterNetwork.consumers = [];
        this.sewageNetwork.sources = [];
        this.sewageNetwork.consumers = [];

        for (const b of this.game.buildings.buildings) {
            const buildingDef = this.game.constants.BUILDING_TYPES[b.type] || {};
            const waterCap = buildingDef.waterCapacity || 0;
            const waterDemand = buildingDef.waterDemand || 0;
            const sewageCap = buildingDef.sewageCapacity || 0;
            const sewageDemand = buildingDef.sewageDemand || 0;

            if (waterCap > 0) {
                this.waterNetwork.addSource(b.x, b.y, waterCap, 1.0);
            }
            if (waterDemand > 0) {
                this.waterNetwork.addConsumer(b.x, b.y, waterDemand, b.id);
            }

            if (sewageCap > 0) {
                this.sewageNetwork.addSource(b.x, b.y, sewageCap, 1.0);
            }
            if (sewageDemand > 0) {
                this.sewageNetwork.addConsumer(b.x, b.y, sewageDemand, b.id);
            }
        }

        this.waterNetwork.recomputeChunks(null);
        this.sewageNetwork.recomputeChunks(null);
    }

    /**
     * Check water and sewage status
     */
    checkStatus() {
        const waterSupply = this.waterNetwork.getSupply();
        const waterDemand = this.getWaterDemand();
        const sewageSupply = this.sewageNetwork.getSupply();
        const sewageDemand = this.getSewageDemand();

        const waterShortage = waterSupply < waterDemand;
        const sewageShortage = sewageSupply < sewageDemand;
        this.sewageShortage = sewageShortage;

        // Calculate pollution from sewage shortage
        if (sewageShortage) {
            this._increasePollution(5);
        } else {
            this._decreasePollution(1);
        }

        // Calculate illness rate from pollution and water quality
        const pollution = this.pollutionLevel;
        const waterQuality = this.waterNetwork.metrics.avgCoverage || 0;
        this.illnessRate = Math.min(100, (pollution * 0.5) + ((1 - waterQuality) * 30));

        return {
            waterSupply,
            waterDemand,
            waterCoverage: this.waterNetwork.metrics.coveragePct,
            sewageSupply,
            sewageDemand,
            sewageCoverage: this.sewageNetwork.metrics.coveragePct,
            sewageShortage,
            pollutionLevel: this.pollutionLevel,
            illnessRate: this.illnessRate,
        };
    }

    /**
     * Get total water demand from buildings
     */
    getWaterDemand() {
        let demand = 0;
        for (const b of this.game.buildings.buildings) {
            demand += (this.game.constants.BUILDING_TYPES[b.type]?.waterDemand || 0) + (b.level * 0.5);
        }
        return demand;
    }

    /**
     * Get total sewage demand from buildings
     */
    getSewageDemand() {
        let demand = 0;
        for (const b of this.game.buildings.buildings) {
            demand += (this.game.constants.BUILDING_TYPES[b.type]?.sewageDemand || 0) + (b.level * 0.3);
        }
        return demand;
    }

    /**
     * Increase pollution level
     */
    _increasePollution(amount) {
        this.pollutionLevel = Math.min(100, this.pollutionLevel + amount);
        this.pollution.fill(Math.min(255, this.pollutionLevel * 2.55));
    }

    /**
     * Decrease pollution level
     */
    _decreasePollution(amount) {
        this.pollutionLevel = Math.max(0, this.pollutionLevel - amount);
        this.pollution.fill(Math.max(0, this.pollutionLevel * 2.55));
    }

    /**
     * Apply pollution to citizens
     */
    applyPollutionEffects() {
        const { citizens } = this.game;

        for (const c of citizens.citizens) {
            const pollution = this.pollution[c.y * this.game.map.width + c.x];
            if (pollution > 128) {
                // High pollution
                c.happiness = Math.max(0, c.happiness - 3);
                c.foodLevel = Math.max(0, c.foodLevel - 1);
            } else if (pollution > 64) {
                // Moderate pollution
                c.happiness = Math.max(0, c.happiness - 1);
            }
        }
    }

    /**
     * Update water system
     */
    update() {
        const status = this.checkStatus();
        this.waterNetwork.update();
        this.sewageNetwork.update();
        return status;
    }

    /**
     * Get water coverage at tile
     */
    getWaterCoverage(x, y) {
        return this.waterNetwork.getCoverageNorm(x, y);
    }

    /**
     * Get pollution at tile
     */
    getPollution(x, y) {
        if (x < 0 || y < 0 || x >= this.game.map.width || y >= this.game.map.height) return 0;
        return this.pollution[y * this.game.map.width + x] / 255;
    }

    /**
     * Get water info for UI
     */
    getInfo() {
        const waterStatus = this.checkStatus();
        return {
            water: waterStatus,
            pollution: this.pollutionLevel,
            sewageShortage: this.sewageShortage,
        };
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            waterNetwork: this.waterNetwork.serialize(),
            sewageNetwork: this.sewageNetwork.serialize(),
            pollution: Array.from(this.pollution),
            pollutionLevel: this.pollutionLevel,
            sewageShortage: this.sewageShortage,
            illnessRate: this.illnessRate,
        };
    }

    /**
     * Deserialize for load
     */
    deserialize(data) {
        if (!data) return;
        this.waterNetwork.deserialize(data.waterNetwork);
        this.sewageNetwork.deserialize(data.sewageNetwork);
        if (data.pollution) {
            this.pollution = new Uint8Array(data.pollution);
        }
        this.pollutionLevel = data.pollutionLevel || 0;
        this.sewageShortage = data.sewageShortage || false;
        this.illnessRate = data.illnessRate || 0;
    }
}

/**
 * Create water system
 */
export function createWaterSystem(game) {
    return new WaterSystem(game);
}