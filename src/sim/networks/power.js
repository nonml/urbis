// Power Network v1 (Milestone H-02)
// Generators produce MW; buildings consume MW.
// If demand > supply, underpowered districts suffer penalties and blackout crises.

import { NetworkCore, createPowerNetwork } from './network_core.js';
import { BUILDING_POWER_PLANT, BUILDING_SUBSTATION, BUILDING_TOWN_HALL, BUILDING_TYPES } from '../../constants.js';

// Default power values
const DEFAULT_POWER_VALUES = {
    powerPlant: { capacity: 100, demand: 5, upkeep: 2 },
    substation: { capacity: 50, demand: 2, upkeep: 1 },
    townHall: { capacity: 30, demand: 1, upkeep: 1 },
};

// Building demand factors
const BUILDING_POWER_FACTOR = 0.5; // Base demand per building level

export class PowerSystem {
    constructor(game) {
        this.game = game;
        this.network = createPowerNetwork(game);
        this.blackout = false;
        this.blackoutDuration = 0;
        this.blackoutCooldown = 0;
        this.powerEvents = [];
    }

    /**
     * Initialize power system with existing buildings
     */
    initialize() {
        this._rebuildNetwork();
    }

    /**
     * Rebuild power network from buildings
     */
    _rebuildNetwork() {
        this.network.sources = [];
        this.network.consumers = [];

        for (const b of this.game.buildings.buildings) {
            const buildingDef = BUILDING_TYPES[b.type] || {};
            const capacity = buildingDef.powerCapacity || 0;
            const demand = buildingDef.powerDemand || 0;

            if (capacity > 0) {
                this.network.addSource(b.x, b.y, capacity, 1.0);
            }

            if (demand > 0) {
                this.network.addConsumer(b.x, b.y, demand, b.id);
            }
        }

        this.network.recomputeChunks(null);
    }

    /**
     * Get total building demand
     */
    getBuildingDemand() {
        let demand = 0;
        for (const b of this.game.buildings.buildings) {
            const demandFactor = BUILDING_TYPES[b.type]?.powerDemand || 0;
            demand += demandFactor + (b.level * BUILDING_POWER_FACTOR);
        }
        return demand;
    }

    /**
     * Check if power is sufficient
     */
    checkPowerStatus() {
        const supply = this.network.getSupply();
        const demand = this.getBuildingDemand();
        const coverage = this.network.metrics.coveragePct;
        const shortage = supply < demand;

        this.blackout = shortage;

        if (shortage) {
            this.blackoutDuration++;
            if (this.blackoutDuration > 5 && this.blackoutCooldown <= 0) {
                this.triggerBlackout();
            }
        } else {
            if (this.blackoutDuration > 0) {
                this.game.showMessage('Power restored!', 'success');
            }
            this.blackoutDuration = 0;
        }

        // Cooldown between blackout triggers
        if (this.blackoutCooldown > 0) {
            this.blackoutCooldown--;
        }

        return {
            supply,
            demand,
            coverage,
            blackout: this.blackout,
        };
    }

    /**
     * Trigger a blackout event
     */
    triggerBlackout() {
        this.blackoutCooldown = 20; // Prevent spam
        this.blackoutDuration = 0;
        this.game.showMessage('⚠️ BLACKOUT! Power shortage affecting city.', 'crisis');

        const event = {
            type: 'blackout',
            tick: this.game.state.time.tick,
            duration: 30,
            severity: 2,
        };
        this.powerEvents.push(event);

        // Apply penalties to citizens
        this._applyBlackoutPenalties();

        return event;
    }

    /**
     * Apply blackout penalties to citizens
     */
    _applyBlackoutPenalties() {
        const { citizens } = this.game;

        for (const c of citizens.citizens) {
            const power = this.network.getCoverageNorm(c.x, c.y);
            if (power < 0.3) {
                c.happiness = Math.max(0, c.happiness - 5);
                c.foodLevel = Math.max(0, c.foodLevel - 2);
            }
        }
    }

    /**
     * Update power system (called each tick)
     */
    update() {
        const status = this.checkPowerStatus();
        this.network.update();
        return status;
    }

    /**
     * Add a power generator building
     */
    addGenerator(x, y, type = 'powerPlant') {
        const values = DEFAULT_POWER_VALUES[type] || DEFAULT_POWER_VALUES.powerPlant;
        this.network.addSource(x, y, values.capacity, 1.0);
        this.game.economyLedger.addDelta(
            this.game.economyLedger.beginTick(this.game.state.time.tick),
            'gold',
            -values.upkeep,
            'power_plant_upkeep'
        );
    }

    /**
     * Remove a power generator
     */
    removeGenerator(source) {
        this.network.removeSource(source);
    }

    /**
     * Get power coverage at tile
     */
    getCoverage(x, y) {
        return this.network.getCoverageNorm(x, y);
    }

    /**
     * Get power info for UI
     */
    getInfo() {
        const metrics = this.network.metrics;
        return {
            supply: metrics.supply,
            demand: metrics.demand,
            coveragePct: metrics.coveragePct,
            blackout: this.blackout,
            blackoutDuration: this.blackoutDuration,
        };
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            network: this.network.serialize(),
            blackout: this.blackout,
            blackoutDuration: this.blackoutDuration,
            blackoutCooldown: this.blackoutCooldown,
        };
    }

    /**
     * Deserialize for load
     */
    deserialize(data) {
        if (!data) return;
        this.network.deserialize(data.network);
        this.blackout = data.blackout || false;
        this.blackoutDuration = data.blackoutDuration || 0;
        this.blackoutCooldown = data.blackoutCooldown || 0;
    }
}

/**
 * Create power system
 */
export function createPowerSystem(game) {
    return new PowerSystem(game);
}