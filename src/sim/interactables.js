// Interactables system - hacking nodes for Watch Dogs-style micro-loops
import { RNG } from '../rng.js';
import { eventBus, EVENT_TYPES } from './events.js';

// Interactable types
export const INTERACTABLE_TYPES = {
    POWER_SUBSTATION: { name: 'Power Substation', difficulty: 1, icon: '⚡', owners: ['city', 'corp'] },
    CCTV_POLE: { name: 'CCTV Pole', difficulty: 2, icon: '📷', owners: ['city', 'police', 'corp'] },
    TELECOM_BOX: { name: 'Telecom Box', difficulty: 3, icon: '📡', owners: ['corp', 'gang'] },
};

// Interactable state
export const INTERACTABLE_STATES = {
    AVAILABLE: 'available',
    COOLDOWN: 'cooldown',
    HACKING: 'hacking',
    SUCCESS: 'success',
    FAILED: 'failed',
};

/**
 * Creates a new hacking node interactable
 */
export function createInteractable(x, y, districtId, typeKey, seed) {
    const rng = new RNG(seed + x + y * 1000);
    const type = INTERACTABLE_TYPES[typeKey];
    const ownerFaction = type.owners[rng.int(0, type.owners.length - 1)];
    const securityLevel = Math.max(1, Math.min(5, type.difficulty + rng.int(0, 2)));
    return {
        id: `node-${x}-${y}-${rng.int(0, 9999)}`,
        type: typeKey,
        name: type.name,
        icon: type.icon,
        pos: { x, y },
        x,
        y,
        districtId,
        securityLevel,
        ownerFaction,
        difficulty: type.difficulty + Math.floor(rng.float(0, 2)), // Base difficulty + variance
        cooldown: 100, // Ticks before re-hackable
        lastUsedTick: -1000, // Start ready
        state: INTERACTABLE_STATES.AVAILABLE,
        progress: 0,
        discovered: false,
        cameraActiveUntil: 0,
        trafficToggledUntil: 0,
        doorUnlockedUntil: 0,
        blackoutPingUntil: 0,
        rewardGold: type.difficulty * 5 + rng.int(5, 15),
        rewardInfo: type.difficulty > 2 ? `Intelligence from ${type.name}` : null,
    };
}

/**
 * Interactables manager
 */
export class InteractableManager {
    constructor(width, height, seed) {
        this.width = width;
        this.height = height;
        this.seed = seed;
        this.interactables = [];
        this.rng = new RNG(seed + 999);
        this.cooldowns = new Map(); // id -> availableAtTick
    }

    /**
     * Generate interactables across the map
     * @param {Object} map - Map object with district info
     */
    generate(map) {
        this.interactables = [];
        let nodeId = 0;

        // Generate based on map size
        const baseCount = Math.floor((this.width * this.height) / 500); // ~1 node per 500 tiles
        const count = Math.max(5, Math.min(baseCount, 30)); // 5-30 nodes

        // Try to place one per district as a minimum
        const districtCenters = map.districts.map(d => d.center);
        const placedFromDistricts = new Set();

        // First pass: place near district centers
        for (const center of districtCenters) {
            if (placedFromDistricts.size >= count) break;

            // Find nearest valid tile to center
            let bestTile = null;
            let bestDist = Infinity;

            for (let dy = -5; dy <= 5; dy++) {
                for (let dx = -5; dx <= 5; dx++) {
                    const x = center.x + dx;
                    const y = center.y + dy;
                    if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

                    // Must be land, not on road
                    const tile = map.grid[y][x];
                    const roadIdx = map.roadMap ? map.roadMap[y * this.width + x] : 0;
                    if (tile !== 0 && roadIdx === 0) {
                        const dist = Math.abs(dx) + Math.abs(dy);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestTile = { x, y };
                        }
                    }
                }
            }

            if (bestTile) {
                const typeKeys = Object.keys(INTERACTABLE_TYPES);
                const typeKey = typeKeys[(this.rng.int(0, typeKeys.length - 1))];
                const interactable = createInteractable(
                    bestTile.x,
                    bestTile.y,
                    map.getDistrictAt(bestTile.x, bestTile.y),
                    typeKey,
                    this.seed + nodeId
                );
                interactable.manager = this;
                this.interactables.push(interactable);
                placedFromDistricts.add(center.id);
                nodeId++;
            }
        }

        // Second pass: fill remaining spots
        while (this.interactables.length < count && nodeId < 100) {
            const x = this.rng.int(2, this.width - 3);
            const y = this.rng.int(2, this.height - 3);

            // Check if valid placement
            const tile = map.grid[y][x];
            if (tile === 0) continue; // Water

            const roadIdx = map.roadMap ? map.roadMap[y * this.width + x] : 0;
            if (roadIdx > 0) continue; // On road

            // Check if already has interactable
            const existing = this.interactables.find(n => n.x === x && n.y === y);
            if (existing) continue;

            const typeKeys = Object.keys(INTERACTABLE_TYPES);
            const typeKey = typeKeys[this.rng.int(0, typeKeys.length - 1)];

            const interactable = createInteractable(
                x, y,
                map.getDistrictAt(x, y),
                typeKey,
                this.seed + nodeId
            );
            interactable.manager = this;
            this.interactables.push(interactable);
            nodeId++;
        }
    }

    /**
     * Check if player is near an interactable
     */
    getNearbyInteractable(playerX, playerY, maxDistance = 3) {
        const list = this.scanNearby(playerX, playerY, maxDistance)
            .filter((node) => this.isAvailable(node));
        return list[0] || null;
    }

    scanNearby(playerX, playerY, maxDistance = 25) {
        const scanned = [];
        for (const node of this.interactables) {
            const dist = Math.abs(playerX - node.x) + Math.abs(playerY - node.y);
            if (dist > maxDistance) continue;
            node.discovered = true;
            node.distance = dist;
            scanned.push(node);
        }
        scanned.sort((a, b) => {
            if (a.distance !== b.distance) return a.distance - b.distance;
            if (a.securityLevel !== b.securityLevel) return a.securityLevel - b.securityLevel;
            return a.id.localeCompare(b.id);
        });
        return scanned;
    }

    /**
     * Check if interactable is available for hacking
     */
    isAvailable(interactable) {
        const blockedUntil = this.cooldowns.get(interactable.id);
        if (blockedUntil !== undefined && interactable.manager?.game?.state?.time?.tick < blockedUntil) {
            return false;
        }
        return interactable.state === INTERACTABLE_STATES.AVAILABLE ||
               interactable.state === INTERACTABLE_STATES.SUCCESS ||
               interactable.state === INTERACTABLE_STATES.FAILED;
    }

    /**
     * Start hacking on an interactable
     * @param {Object} interactable - The node to hack
     * @param {number} tick - Current game tick
     * @param {number} difficultyOverride - Optional difficulty override
     */
    startHack(interactable, tick, difficultyOverride) {
        interactable.state = INTERACTABLE_STATES.HACKING;
        interactable.progress = 0;
        interactable.hackStartTick = tick;
        interactable.hackDifficulty = difficultyOverride || interactable.securityLevel || interactable.difficulty;
    }

    /**
     * Process hacking progress
     * @param {Object} interactable - The node being hacked
     * @param {number} tick - Current game tick
     * @param {number} progressRate - Progress per tick (0-1)
     */
    tickHack(interactable, tick, progressRate = 0.1) {
        if (interactable.state !== INTERACTABLE_STATES.HACKING) {
            return interactable.state;
        }

        // Show hack progress feedback
        const game = interactable.game || (interactable.manager?.game);
        if (game?.ui?.renderer3d && interactable.manager) {
            interactable.manager.hackProgress = interactable.progress;
            game.ui.renderer3d.updateHackProgress(interactable.x, interactable.y, interactable.progress);
        }

        interactable.progress += progressRate;

        // Security level scales completion length.
        const targetProgress = interactable.hackDifficulty * 5;

        if (interactable.progress >= targetProgress) {
            interactable.state = INTERACTABLE_STATES.SUCCESS;
            interactable.lastUsedTick = tick;
            interactable.cooldown = Math.max(50, interactable.cooldown - 10); // Success reduces cooldown
            eventBus.emit(EVENT_TYPES.PLAYER_HACKED_NODE, { interactable, success: true });
            eventBus.emit(EVENT_TYPES.INTERACTABLE_SUCCESS, { interactable });

            // Show success feedback
            if (game?.ui?.renderer3d) {
                game.ui.renderer3d.showHackResult(interactable.x, interactable.y, true);
            }
        } else if (interactable.progress < 0) {
            interactable.state = INTERACTABLE_STATES.FAILED;
            interactable.lastUsedTick = tick;
            interactable.cooldown = Math.min(200, interactable.cooldown + 20); // Failure increases cooldown
            eventBus.emit(EVENT_TYPES.PLAYER_HACKED_NODE, { interactable, success: false });
            eventBus.emit(EVENT_TYPES.INTERACTABLE_FAILED, { interactable });

            // Show failure feedback
            if (game?.ui?.renderer3d) {
                game.ui.renderer3d.showHackResult(interactable.x, interactable.y, false);
            }
        }

        return interactable.state;
    }

    /**
     * Cancel hacking attempt
     */
    cancelHack(interactable) {
        if (interactable.state === INTERACTABLE_STATES.HACKING) {
            interactable.state = INTERACTABLE_STATES.FAILED;
            interactable.lastUsedTick = interactable.hackStartTick;
            eventBus.emit(EVENT_TYPES.PLAYER_HACKED_NODE, { interactable, success: false });
            eventBus.emit(EVENT_TYPES.INTERACTABLE_FAILED, { interactable });
        }
    }

    setCooldown(interactable, untilTick) {
        this.cooldowns.set(interactable.id, untilTick);
    }

    performHackAction(interactable, action, tick) {
        const game = interactable.game || (interactable.manager?.game);
        if (!game) return { ok: false, reason: 'Missing game context.' };
        const world = game.state.world || (game.state.world = { anomalies: [] });
        const actions = {
            camera_takeover: () => {
                interactable.cameraActiveUntil = tick + 8;
                game.ui?.renderer3d?.setCameraHackView?.(interactable.x, interactable.y, 8);
                return { loud: false, msg: 'Camera takeover active.' };
            },
            traffic_light_switch: () => {
                interactable.trafficToggledUntil = tick + 10;
                world.trafficSwitches = world.trafficSwitches || [];
                world.trafficSwitches.push({ x: interactable.x, y: interactable.y, untilTick: tick + 10 });
                return { loud: true, msg: 'Traffic lights switched.' };
            },
            door_unlock: () => {
                interactable.doorUnlockedUntil = tick + 12;
                world.unlockedDoors = world.unlockedDoors || [];
                world.unlockedDoors.push({ x: interactable.x, y: interactable.y, untilTick: tick + 12 });
                return { loud: false, msg: 'Nearby doors unlocked.' };
            },
            district_blackout_ping: () => {
                interactable.blackoutPingUntil = tick + 6;
                world.blackouts = world.blackouts || [];
                world.blackouts.push({ districtId: interactable.districtId, untilTick: tick + 6 });
                return { loud: true, msg: 'District blackout pinged.' };
            },
        };
        const run = actions[action];
        if (!run) return { ok: false, reason: `Unknown action: ${action}` };
        const result = run();
        return { ok: true, ...result, action };
    }

    /**
     * Update all interactables (cooldowns, etc.)
     */
    updateAll(tick) {
        for (const node of this.interactables) {
            if (node.state === INTERACTABLE_STATES.SUCCESS || node.state === INTERACTABLE_STATES.FAILED) {
                const ticksSinceUse = tick - node.lastUsedTick;
                if (ticksSinceUse >= node.cooldown) {
                    node.state = INTERACTABLE_STATES.AVAILABLE;
                    node.progress = 0;
                    eventBus.emit(EVENT_TYPES.INTERACTABLE_AVAILABLE, { interactable: node });
                }
            }
        }
    }

    /**
     * Get rewards for successfully hacked node
     */
    getRewards(interactable) {
        if (interactable.state !== INTERACTABLE_STATES.SUCCESS) return null;

        return {
            gold: interactable.rewardGold,
            info: interactable.rewardInfo,
            districtId: interactable.districtId,
        };
    }

    /**
     * Reset node state (for map reloads, etc.)
     */
    resetStates() {
        for (const node of this.interactables) {
            if (node.state !== INTERACTABLE_STATES.AVAILABLE) {
                node.state = INTERACTABLE_STATES.AVAILABLE;
            }
        }
    }
}

/**
 * Gets interactable type info
 */
export function getInteractableTypeInfo(typeKey) {
    return INTERACTABLE_TYPES[typeKey] || INTERACTABLE_TYPES.POWER_SUBSTATION;
}

/**
 * Gets state name for display
 */
export function getInteractableStateName(state) {
    const names = {
        [INTERACTABLE_STATES.AVAILABLE]: 'Ready',
        [INTERACTABLE_STATES.HACKING]: 'Hacking...',
        [INTERACTABLE_STATES.SUCCESS]: 'Success!',
        [INTERACTABLE_STATES.FAILED]: 'Failed',
        [INTERACTABLE_STATES.COOLDOWN]: 'Cooling down',
    };
    return names[state] || state;
}
