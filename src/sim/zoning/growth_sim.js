/**
 * Organic Zone Growth Simulation
 * Zones trigger building growth over time based on demand, road access, and service coverage.
 * Buildings appear in stages: empty lot → construction → small building → upgrade.
 *
 * Cities: Skylines-style organic city growth.
 */

import { ZONE_TYPES } from './zoning.js';

/** Growth stages per lot */
export const GROWTH_STAGE = {
    EMPTY: 0,         // bare zone, waiting for conditions
    CONSTRUCTION: 1,  // under construction (scaffolding)
    SMALL: 2,         // low-density building
    MEDIUM: 3,        // mid-density building
    LARGE: 4,         // high-density building
};

/** Building types spawned by zone + density level */
const ZONE_BUILDINGS = {
    [ZONE_TYPES.RESIDENTIAL]: {
        [GROWTH_STAGE.SMALL]: 'house',
        [GROWTH_STAGE.MEDIUM]: 'house',
        [GROWTH_STAGE.LARGE]: 'apartment',
    },
    [ZONE_TYPES.COMMERCIAL]: {
        [GROWTH_STAGE.SMALL]: 'market',
        [GROWTH_STAGE.MEDIUM]: 'restaurant',
        [GROWTH_STAGE.LARGE]: 'shopping-mall',
    },
    [ZONE_TYPES.INDUSTRIAL]: {
        [GROWTH_STAGE.SMALL]: 'warehouse',
        [GROWTH_STAGE.MEDIUM]: 'factory',
        [GROWTH_STAGE.LARGE]: 'factory',
    },
};

export class GrowthSimulator {
    constructor(game) {
        this.game = game;
        /** Map<tileIndex, { zone, stage, ticksInStage, buildingId }> */
        this.lots = new Map();
        this._tickCounter = 0;
    }

    /**
     * Run growth simulation once per N ticks for performance
     */
    update(tick) {
        this._tickCounter++;
        if (this._tickCounter % 5 !== 0) return; // every 5 ticks

        const zoning = this.game.zoning;
        const demand = this.game.demandCalculator;
        if (!zoning || !demand) return;

        const w = zoning.width;
        const h = zoning.height;
        const map = this.game.map;
        const buildings = this.game.buildings;

        // Process dirty zones first (newly painted)
        for (const idx of zoning.dirtyIndices) {
            const x = idx % w;
            const y = Math.floor(idx / w);
            const zone = zoning.zoneMap[idx];

            if (zone === ZONE_TYPES.NONE) {
                // Zone removed: schedule demolition
                if (this.lots.has(idx)) {
                    const lot = this.lots.get(idx);
                    if (lot.buildingId) {
                        buildings.removeBuilding?.(lot.buildingId);
                    }
                    this.lots.delete(idx);
                }
                continue;
            }

            // Register new lot if not already tracked and no building exists here
            if (!this.lots.has(idx)) {
                const existingBuilding = (buildings.buildings || []).find(b => b.x === x && b.y === y);
                if (!existingBuilding) {
                    this.lots.set(idx, { zone, stage: GROWTH_STAGE.EMPTY, ticksInStage: 0, buildingId: null });
                }
            }
        }
        zoning.dirtyIndices.clear();

        // Process lot growth (batch: max 20 per tick for perf)
        let processed = 0;
        for (const [idx, lot] of this.lots) {
            if (processed >= 20) break;
            const x = idx % w;
            const y = Math.floor(idx / w);

            // Check if zone is still valid
            if (zoning.zoneMap[idx] !== lot.zone) {
                this.lots.delete(idx);
                continue;
            }

            lot.ticksInStage++;
            processed++;

            // Growth logic based on stage
            if (lot.stage === GROWTH_STAGE.EMPTY) {
                // Conditions to start construction: positive demand + road adjacent
                const demandVal = this._getDemandForZone(lot.zone, demand);
                const hasRoad = this._hasAdjacentRoad(x, y, map);
                if (demandVal > 0.1 && hasRoad && lot.ticksInStage > 3) {
                    lot.stage = GROWTH_STAGE.CONSTRUCTION;
                    lot.ticksInStage = 0;
                }
            } else if (lot.stage === GROWTH_STAGE.CONSTRUCTION) {
                // Construction takes 5-10 ticks
                if (lot.ticksInStage > 5 + Math.floor(this.game.rng.next() * 5)) {
                    lot.stage = GROWTH_STAGE.SMALL;
                    lot.ticksInStage = 0;
                    // Spawn building
                    this._spawnBuilding(x, y, lot);
                }
            } else if (lot.stage === GROWTH_STAGE.SMALL || lot.stage === GROWTH_STAGE.MEDIUM) {
                // Upgrade over time if demand remains positive and services are available
                const demandVal = this._getDemandForZone(lot.zone, demand);
                const upgradeThreshold = lot.stage === GROWTH_STAGE.SMALL ? 30 : 60;
                if (demandVal > 0.3 && lot.ticksInStage > upgradeThreshold) {
                    // Remove old building, place upgraded one
                    if (lot.buildingId) {
                        buildings.removeBuilding?.(lot.buildingId);
                    }
                    lot.stage = lot.stage + 1;
                    lot.ticksInStage = 0;
                    this._spawnBuilding(x, y, lot);
                }
            }
            // LARGE is max — no further upgrades

            // Abandonment: negative demand for extended period
            if (lot.stage >= GROWTH_STAGE.SMALL) {
                const demandVal = this._getDemandForZone(lot.zone, demand);
                if (demandVal < -0.2 && lot.ticksInStage > 50) {
                    // Downgrade or abandon
                    if (lot.buildingId) {
                        buildings.removeBuilding?.(lot.buildingId);
                    }
                    lot.stage = GROWTH_STAGE.EMPTY;
                    lot.ticksInStage = 0;
                    lot.buildingId = null;
                }
            }
        }
    }

    _getDemandForZone(zone, demand) {
        const state = demand.getDemand?.() || demand.demand || {};
        if (zone === ZONE_TYPES.RESIDENTIAL) return (state.residential ?? 0.5) - 0.5;
        if (zone === ZONE_TYPES.COMMERCIAL) return (state.commercial ?? 0.5) - 0.5;
        if (zone === ZONE_TYPES.INDUSTRIAL) return (state.industrial ?? 0.5) - 0.5;
        return 0;
    }

    _hasAdjacentRoad(x, y, map) {
        if (!map?.getTileAt) return true; // assume road access if no map
        const ROAD = 4; // TERRAIN_ROAD
        const HW = 7;   // TERRAIN_HIGHWAY
        return [map.getTileAt(x - 1, y), map.getTileAt(x + 1, y),
                map.getTileAt(x, y - 1), map.getTileAt(x, y + 1)]
            .some(t => t === ROAD || t === HW);
    }

    _spawnBuilding(x, y, lot) {
        const buildings = this.game.buildings;
        const typeMap = ZONE_BUILDINGS[lot.zone];
        if (!typeMap) return;
        const buildingType = typeMap[lot.stage] || 'house';

        const result = buildings.addBuilding?.({
            type: buildingType,
            x,
            y,
            rotation: Math.floor(this.game.rng.next() * 4),
        });

        if (result?.ok && result.building) {
            lot.buildingId = result.building.id;
        }
    }

    /**
     * Get growth statistics for HUD
     */
    getStats() {
        let empty = 0, construction = 0, small = 0, medium = 0, large = 0;
        for (const [, lot] of this.lots) {
            if (lot.stage === GROWTH_STAGE.EMPTY) empty++;
            else if (lot.stage === GROWTH_STAGE.CONSTRUCTION) construction++;
            else if (lot.stage === GROWTH_STAGE.SMALL) small++;
            else if (lot.stage === GROWTH_STAGE.MEDIUM) medium++;
            else if (lot.stage === GROWTH_STAGE.LARGE) large++;
        }
        return { empty, construction, small, medium, large, total: this.lots.size };
    }
}
