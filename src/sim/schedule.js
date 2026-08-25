// Daily schedule system - manages citizen movement and activities
import { NavGrid } from './nav/nav_grid.js';
import { PathfindingProxy } from './nav/pathfinding_proxy.js';

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
        // Async pathfinding proxy (WebWorker A* with SharedArrayBuffer fallback)
        this.pfProxy = (map && this.nav) ? new PathfindingProxy(this.nav, map) : null;
        // Schedule worker (Q12.A q12-wk-schedule-worker) — target selection off main thread
        this._schedWorker = null;
        this._schedReady = false;
        this._schedFallback = false;
        this._schedCache = new Map(); // citizenId -> { target, phaseName }
        this._schedInflight = new Map(); // citizenId -> phaseName
        this._schedPending = new Map(); // id -> resolve
        this._schedNextId = 1;
        this._schedBuildings = [];
        this._schedDirty = true;
        this._schedLastCount = -1;
        this._schedPendingList = null;
        this._initSchedWorker(map);
        if (this.nav && buildings) {
            this.syncNavBuildings(buildings);
        }
    }

    _initSchedWorker(map) {
        if (typeof Worker === 'undefined') { this._schedFallback = true; return; }
        try {
            this._schedWorker = new Worker(new URL('../workers/schedule_worker.js', import.meta.url), { type: 'module' });
            this._schedWorker.onmessage = (e) => this._onSchedMessage(e);
            const w = map?.width ?? this.width;
            const h = map?.height ?? this.height;
            this._schedWorker.postMessage({ type: 'INIT', width: w, height: h });
        } catch { this._schedFallback = true; }
    }

    _onSchedMessage(e) {
        const { type, id, citizenId, target } = e.data || {};
        if (type === 'READY') {
            this._schedReady = true;
            if (this._schedDirty && this._schedPendingList) {
                this._schedBuildings = this._schedPendingList.slice();
                this._schedDirty = false;
                this._schedPendingList = null;
                this._schedWorker.postMessage({ type: 'UPDATE_BUILDINGS', buildings: this._schedBuildings });
            }
            return;
        }
        if (type !== 'TARGET_RESULT' && type !== 'SCHEDULE_BATCH_RESULT') return;
        if (type === 'TARGET_RESULT') {
            const prom = this._schedPending.get(id);
            if (prom) { this._schedPending.delete(id); prom.resolve(target); }
            const phase = this._schedInflight.get(citizenId);
            if (citizenId !== undefined) {
                this._schedCache.set(citizenId, { target: target ?? null, phaseName: phase || '' });
            }
            if (citizenId !== undefined) this._schedInflight.delete(citizenId);
        } else if (type === 'SCHEDULE_BATCH_RESULT') {
            const prom = this._schedPending.get(id);
            if (prom) { this._schedPending.delete(id); prom.resolve(e.data.results); }
            for (const r of e.data.results || []) {
                this._schedCache.set(r.id, { target: r.target ?? null, phaseName: '' });
                this._schedInflight.delete(r.id);
            }
        }
    }

    isSchedWorkerActive() { return !!this._schedWorker && this._schedReady && !this._schedFallback; }

    _pushSchedBuildings(buildings) {
        const list = (buildings.buildings || []).map(b => ({ type: b.type, x: b.x, y: b.y }));
        this._schedPendingList = list.slice();
        if (!this._schedWorker || !this._schedReady) { this._schedDirty = true; return; }
        this._schedBuildings = list;
        this._schedDirty = false;
        this._schedPendingList = null;
        this._schedWorker.postMessage({ type: 'UPDATE_BUILDINGS', buildings: list });
    }

    _consumeSchedTarget(citizenId, phaseName) {
        const entry = this._schedCache.get(citizenId);
        if (!entry) return undefined;
        if (entry.phaseName && entry.phaseName !== phaseName) return undefined;
        return entry.target ?? null;
    }

    _prefetchSchedTarget(citizen, phaseName) {
        if (!this.isSchedWorkerActive() || this._schedInflight.has(citizen.id)) return;
        if (this._schedDirty && this._schedPendingList) {
            this._schedBuildings = this._schedPendingList.slice();
            this._schedDirty = false;
            this._schedPendingList = null;
            this._schedWorker.postMessage({ type: 'UPDATE_BUILDINGS', buildings: this._schedBuildings });
        }
        this._schedInflight.set(citizen.id, phaseName);
        const id = this._schedNextId++;
        this._schedWorker.postMessage({ type: 'FIND_TARGET', id, citizenId: citizen.id, x: citizen.x, y: citizen.y, job: citizen.job, phaseName });
    }

    /**
     * Get current day phase based on normalized time (0.0 to 1.0)
     */
    getPhaseAt(timeOfDay) {
        for (const key in DAY_PHASES) {
            const phase = DAY_PHASES[key];
            if (timeOfDay >= phase.start && timeOfDay <= phase.end) {
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

        // Schedule worker (Q12.A): target selection off main thread when active
        let target = null;
        let fromWorker = false;
        if (this.isSchedWorkerActive()) {
            const cached = this._consumeSchedTarget(citizen.id, currentPhase.name);
            if (cached !== undefined) {
                target = cached;
                fromWorker = true;
            } else {
                this._prefetchSchedTarget(citizen, currentPhase.name);
                return { moved: false, target: null, phase: currentPhase.name };
            }
        }
        if (!fromWorker) {
            target = this.getTargetLocation(citizen, currentPhase, map, buildings);
        }

        if (target && (citizen.x !== target.x || citizen.y !== target.y)) {
            const start = { x: citizen.x, y: citizen.y };

            // 1. Try worker-cached path (free — no computation)
            const workerNext = this.pfProxy?.consumeStep(citizen.id, start, target);
            if (workerNext && this.isWalkable(workerNext.x, workerNext.y)) {
                citizen.x = workerNext.x;
                citizen.y = workerNext.y;
                // Pre-warm cache for the step after this one
                this.pfProxy?.prefetch(citizen.id, { x: citizen.x, y: citizen.y }, target);
                return { moved: true, target, phase: currentPhase.name };
            }

            // 2. Worker-only when active: prefetch and stall 1 tick (0-blocking)
            if (this.pfProxy?.isWorkerActive?.()) {
                this.pfProxy.prefetch(citizen.id, start, target);
                return { moved: false, target, phase: currentPhase.name };
            }

            // 3. Sync NavGrid fallback — only when worker unavailable (headless / fallback)
            const path = this.findPath(start, target);
            if (path.length > 1) {
                const nextPos = path[1];
                if (this.isWalkable(nextPos.x, nextPos.y)) {
                    citizen.x = nextPos.x;
                    citizen.y = nextPos.y;
                    // Fire worker prefetch so next tick is a cache hit
                    this.pfProxy?.prefetch(citizen.id, { x: citizen.x, y: citizen.y }, target);
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
            if (!this.pfProxy) this.pfProxy = new PathfindingProxy(this.nav, map);
        }
        this.syncNavBuildings(buildings);
    }

    syncNavBuildings(buildings) {
        if (!this.nav || !buildings) return;
        const count = buildings.buildings?.length ?? 0;
        if (count !== this._lastBuildingCount) {
            this.nav.setBlockedTilesFromBuildings(buildings.buildings || []);
            this.pfProxy?.invalidate();
            this._lastBuildingCount = count;
        }
        // Schedule worker buildings sync (Q12.A)
        if (count !== this._schedLastCount) {
            this._schedCache.clear();
            this._schedInflight.clear();
            this._schedDirty = true;
            this._pushSchedBuildings(buildings);
            this._schedLastCount = count;
        }
    }

    /** Async path query — uses WebWorker when available, sync NavGrid otherwise. */
    findPathAsync(a, b) {
        if (this.pfProxy) return this.pfProxy.findPath(a, b);
        return Promise.resolve(this.nav?.findPath(a, b) ?? { path: [], success: false });
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
        this._schedCache.clear();
        this._schedInflight.clear();
    }

    destroy() {
        try { this._schedWorker?.terminate(); } catch {}
        try { this.pfProxy?.destroy?.(); } catch {}
    }
}

/**
 * Get day phase info at a specific time
 */
export function getDayPhase(timeOfDay) {
    for (const key in DAY_PHASES) {
        const phase = DAY_PHASES[key];
        if (timeOfDay >= phase.start && timeOfDay <= phase.end) {
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
