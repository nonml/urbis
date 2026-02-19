// Daily schedule system - manages citizen movement and activities
import { NavGrid } from './nav/nav_grid.js';

// Day phases (0.0 to 1.0 normalized time)
export const DAY_PHASES = {
    NIGHT: { start: 0.0, end: 0.2, name: 'Night' },       // 00:00 - 04:59
    MORNING: { start: 0.2, end: 0.4, name: 'Morning' },   // 05:00 - 09:59
    DAY: { start: 0.4, end: 0.7, name: 'Day' },           // 10:00 - 16:59
    EVENING: { start: 0.7, end: 0.85, name: 'Evening' },  // 17:00 - 20:29
    DUSK: { start: 0.85, end: 1.0, name: 'Dusk' }         // 20:30 - 23:59
};

/**
 * Schedule system for citizens
 */
export class ScheduleManager {
    constructor(width, height, map = null, buildings = null) {
        this.width = width;
        this.height = height;
        this.currentPhase = DAY_PHASES.NIGHT;
        this.phaseTimer = 0;
        this.nav = map ? new NavGrid(map) : null;
        this._lastBuildingCount = -1;
        if (this.nav && buildings) {
            this.syncNavBuildings(buildings);
        }
    }

    /**
     * Get current day phase based on normalized time (0.0 to 1.0)
     */
    getPhaseAt(timeOfDay) {
        for (const key in DAY_PHASES) {
            const phase = DAY_PHASES[key];
            if (timeOfDay >= phase.start && timeOfDay < phase.end) {
                return phase;
            }
        }
        return DAY_PHASES.NIGHT; // Default
    }

    /**
     * Determine if a phase transition occurred
     */
    checkPhaseTransition(oldTime, newTime) {
        const oldPhase = this.getPhaseAt(oldTime);
        const newPhase = this.getPhaseAt(newTime);
        return oldPhase !== newPhase;
    }

    /**
     * Update schedule for a single citizen based on current phase
     * @param {Citizen} citizen - The citizen to update
     * @param {Object} gameData - Game state with map, buildings
     * @param {number} timeOfDay - Normalized time (0.0 to 1.0)
     * @returns {Object} Schedule result with movement info
     */
    updateCitizenSchedule(citizen, gameData, timeOfDay) {
        const { map, buildings } = gameData;
        const currentPhase = this.getPhaseAt(timeOfDay);
        this.ensureNav(map, buildings);

        // Determine target based on phase
        let target = this.getTargetLocation(citizen, currentPhase, map, buildings);

        if (target && (citizen.x !== target.x || citizen.y !== target.y)) {
            // Try to move toward target using deterministic nav grid pathfinding.
            const path = this.findPath({ x: citizen.x, y: citizen.y }, target);
            if (path.length > 1) {
                // Move to next position in path
                const nextPos = path[1];
                if (this.isWalkable(nextPos.x, nextPos.y)) {
                    citizen.x = nextPos.x;
                    citizen.y = nextPos.y;
                    return { moved: true, target, phase: currentPhase.name };
                }
            }
        }

        return { moved: false, target, phase: currentPhase.name };
    }

    ensureNav(map, buildings) {
        if (!this.nav && map) {
            this.nav = new NavGrid(map);
            this._lastBuildingCount = -1;
        }
        this.syncNavBuildings(buildings);
    }

    syncNavBuildings(buildings) {
        if (!this.nav || !buildings) return;
        const count = buildings.buildings?.length ?? 0;
        if (count === this._lastBuildingCount) return;
        this.nav.setBlockedTilesFromBuildings(buildings.buildings || []);
        this._lastBuildingCount = count;
    }

    isWalkable(x, y) {
        if (!this.nav) return false;
        return this.nav.isWalkable(x, y);
    }

    findPath(a, b) {
        if (!this.nav) return [];
        return this.nav.findPath(a, b);
    }

    /**
     * Get target location for citizen based on current phase
     */
    getTargetLocation(citizen, phase, map, buildings) {
        // Find citizen's home building
        const homeBuildings = buildings.getBuildingsAt(citizen.x, citizen.y);
        const homeBuilding = homeBuildings.find(b => b.type === 'house') ||
                            this.findNearestBuilding(citizen, buildings, 'house');

        // Find citizen's work building
        const workBuilding = this.findWorkBuilding(citizen, buildings);

        // Find nearest park/leisure area
        const leisureBuilding = this.findNearestBuilding(citizen, buildings, 'park') ||
                                this.findNearestBuilding(citizen, buildings, 'market') ||
                                this.findNearestBuilding(citizen, buildings, 'town-hall');

        switch (phase.name) {
            case 'Night':
                // Return home if has one, otherwise stay put
                return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;

            case 'Morning':
                // Go to work
                if (workBuilding) {
                    return { x: workBuilding.x, y: workBuilding.y };
                }
                // No work, go to leisure or stay put
                return leisureBuilding ? { x: leisureBuilding.x, y: leisureBuilding.y } : null;

            case 'Day':
                // Work during day if employed
                if (workBuilding) {
                    return { x: workBuilding.x, y: workBuilding.y };
                }
                // No work, leisure or idle
                return leisureBuilding ? { x: leisureBuilding.x, y: leisureBuilding.y } : null;

            case 'Evening':
                // Return home after work
                return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;

            case 'Dusk':
                // Head home before night
                return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;

            default:
                return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
        }
    }

    /**
     * Find the nearest building of a specific type
     */
    findNearestBuilding(citizen, buildings, type) {
        const citizenBuildings = buildings.getBuildingsAt(citizen.x, citizen.y);
        if (citizenBuildings.length > 0) {
            return citizenBuildings.find(b => b.type === type) || citizenBuildings[0];
        }

        // Search nearby tiles
        const searchRadius = 5;
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const x = citizen.x + dx;
                const y = citizen.y + dy;
                if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;

                const buildingsAtTile = buildings.getBuildingsAt(x, y);
                const match = buildingsAtTile.find(b => b.type === type);
                if (match) return match;
            }
        }

        return null;
    }

    /**
     * Find work building for employed citizen
     */
    findWorkBuilding(citizen, buildings) {
        if (citizen.job === 'unemployed') return null;

        // Map jobs to building types
        const jobToBuilding = {
            'farmer': 'farm',
            'lumberjack': 'lumber-mill',
            'merchant': 'market',
            'craftsman': 'warehouse',
            'official': 'town-hall',
            'soldier': 'barracks',
            'teacher': 'school'
        };

        const targetBuilding = jobToBuilding[citizen.job];
        if (!targetBuilding) return null;

        // Find building of this type
        for (const building of buildings.buildings) {
            if (building.type === targetBuilding) {
                // Prefer buildings closer to citizen's current location
                const dist = Math.abs(building.x - citizen.x) + Math.abs(building.y - citizen.y);
                if (dist <= 10) { // Reasonable walking distance
                    return building;
                }
            }
        }

        // Return first matching building if none nearby
        return buildings.buildings.find(b => b.type === targetBuilding) || null;
    }

    /**
     * Process phase transitions and schedule updates
     */
    updateSchedules(citizens, gameData, oldTime, newTime) {
        const results = [];
        const transition = this.checkPhaseTransition(oldTime, newTime);

        if (transition) {
            const newPhase = this.getPhaseAt(newTime);
            // Log phase change (in headless mode, just track it)
            for (const citizen of citizens) {
                const result = this.updateCitizenSchedule(citizen, gameData, newTime);
                result.timeOfDay = newTime;
                result.phase = newPhase.name;
                results.push(result);
            }
        } else {
            // Just update movement for current phase
            for (const citizen of citizens) {
                const result = this.updateCitizenSchedule(citizen, gameData, newTime);
                result.timeOfDay = newTime;
                results.push(result);
            }
        }

        return { transition, results };
    }

    /**
     * Clear pathfinding cache (e.g., when map changes)
     */
    clearCache() {
        if (this.nav) {
            this.nav.cache.clear();
        }
    }
}

/**
 * Get day phase info at a specific time
 */
export function getDayPhase(timeOfDay) {
    for (const key in DAY_PHASES) {
        const phase = DAY_PHASES[key];
        if (timeOfDay >= phase.start && timeOfDay < phase.end) {
            return phase;
        }
    }
    return DAY_PHASES.NIGHT;
}

/**
 * Convert tick to normalized time of day
 */
export function tickToTimeOfDay(tick, tickPerDay = 24) {
    const day = Math.floor(tick / tickPerDay);
    const hour = (tick % tickPerDay);
    // Normalize 0-24 hours to 0.0-1.0
    return hour / tickPerDay;
}

/**
 * Get phase name from normalized time
 */
export function getPhaseName(timeOfDay) {
    return getDayPhase(timeOfDay).name;
}
