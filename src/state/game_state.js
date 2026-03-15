// GameState - Single source of truth for all serializable game state
import { DIFFICULTY, RIVAL_CONFIG } from '../constants.js';
import { randomSeed32, randomId } from '../rng.js';
import { createRNGStreamSeeds } from '../rng_streams.js';

// v2 adds `economy` (demand/budget/debt) used by multiple sim modules.
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Creates a new GameState with default values
 * @param {Object} options
 * @param {string} options.mapPreset - Map preset name (SMALL/CITY/MEGA)
 * @param {number} options.seed - Random seed for deterministic generation
 * @returns {Object} Complete GameState object
 */
export function createNewGameState(options = {}) {
    const mapPreset = options.mapPreset || 'CITY';
    const seed = (options.seed ?? randomSeed32()) >>> 0;
    const rngStreamSeeds = createRNGStreamSeeds(seed);

    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        meta: {
            seed,
            mapPreset,
            mapWidth: mapPreset === 'SMALL' ? 40 : mapPreset === 'CITY' ? 96 : 256,
            mapHeight: mapPreset === 'SMALL' ? 40 : mapPreset === 'CITY' ? 96 : 256,
            createdAt: Date.now(),
            runId: randomId('run'),
            rngStreams: rngStreamSeeds,
            dev: {
                enabled: true // Enable dev tools in dev builds
            },
            devTuning: {
                factionMultipliers: {
                    hacks: 1,
                    quests: 1,
                    services: 1,
                }
            }
        },
        time: {
            tick: 0,
            paused: false,
            simDt: 0.2, // Fixed simulation delta (seconds)
            tickPerDay: 1, // Ticks per in-game day (1 tick = 1 day)
            timeOfDay: 0.0, // Normalized time (0.0 to 1.0)
        },
        resources: {
            gold: 100,
            food: 100,
            wood: 100,
            population: 0,
            housing: 0,
            day: 1,
            jobProduction: { gold: 0, food: 0, wood: 0 },
            totalGoldEarned: 0,
            totalFoodProduced: 0,
            totalWoodProduced: 0,
        },
        economy: {
            // Demand is normalized to residential/commercial/industrial in [0..1]
            demand: { residential: 0.5, commercial: 0.5, industrial: 0.5 },
            // Budget/debt state (BudgetManager/LoanManager)
            debt: 0,
            lastBudget: {
                income: 0,
                expenses: 0,
                deficit: 0,
                balanced: true,
                tick: 0,
            },
        },
        map: {
            width: mapPreset === 'SMALL' ? 40 : mapPreset === 'CITY' ? 96 : 256,
            height: mapPreset === 'SMALL' ? 40 : mapPreset === 'CITY' ? 96 : 256,
            tiles: [],
        },
        buildings: {
            list: [],
            nextId: 1,
        },
        citizens: {
            list: [],
            nextId: 1,
            birthRate: 0.02,
            deathRate: 0.01,
        },
        crises: {
            active: null,
            history: [],
        },
        quests: {
            active: [],
            completed: [],
        },
        cases: {
            active: [],
            completed: [],
            evidence: [],
            nextCaseSeed: 1,
        },
        factions: {
            list: ['citizens', 'police', 'gangs', 'corp'],
            reputation: {
                citizens: 0,
                police: 0,
                gangs: 0,
                corp: 0,
            },
            recentChanges: [],
        },
        world: {
            anomalies: [],
            blackouts: [],
            trafficSwitches: [],
            unlockedDoors: [],
            factionEncounters: [],
        },
        player: {
            x: 0,
            y: 0,
            wx: 0,
            wz: 0,
            yaw: 0,
            pitch: -0.35,
            heat: 0, // Player heat/wanted level
            heatState: 'calm',
            exposure: 0, // How exposed the player is to rivals
            reputation: 50 // Player reputation with citizens
        },
        rival: {
            influence: RIVAL_CONFIG.baseInfluence,
            budget: RIVAL_CONFIG.baseBudget,
            heat: RIVAL_CONFIG.baseHeat,
            intel: RIVAL_CONFIG.baseIntel,
            lastActionTick: 0,
            currentAction: null,
            actionDuration: 0,
            pastActions: []
        },
        progression: {
            points: 0,
            unlocked: [],
            completedCases: 0,
            districtStability: {},
            // Hacking skill progression
            hackingSkill: 1, // Level 1-10
            hackingXP: 0, // XP toward next level
            totalNodesHacked: 0,
            successfulBreaches: 0
        },
        progress: {
            mode: 'standard',
            runFlags: {},
            unlocks: {
                buildings: [],
                hacks: [],
            },
            rewardLog: {},
            goalState: {
                winStreakTicks: 0,
                bankruptTicks: 0,
                revoltTicks: 0,
                ended: false,
                endState: null
            }
        },
        difficulty: DIFFICULTY.NORMAL,
    };
}

/**
 * Validates basic GameState shape
 * @param {Object} state
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateGameState(state) {
    if (!state || typeof state !== 'object') {
        return { valid: false, error: 'State must be an object' };
    }

    if (state.schemaVersion === undefined) {
        return { valid: false, error: 'Missing schemaVersion' };
    }

    const requiredFields = ['meta', 'time', 'resources', 'economy', 'map', 'buildings', 'citizens', 'crises', 'quests', 'cases', 'factions', 'player'];

    for (const field of requiredFields) {
        if (state[field] === undefined) {
            return { valid: false, error: `Missing required field: ${field}` };
        }
    }

    return { valid: true };
}

/**
 * Migrates state from older schema versions to current
 * Currently only v1 exists, so this handles future migrations
 * @param {Object} state
 * @returns {Object} Migrated state
 */
export function migrateState(state) {
    const from = Number(state.schemaVersion || 0);
    if (from === CURRENT_SCHEMA_VERSION) return state;

    // Migration chain: v1 -> v2 -> ... -> CURRENT
    // For now, we only have v1 so this is a placeholder
    // Add migration steps as schema evolves

    console.warn(`Migrating state from v${state.schemaVersion} to v${CURRENT_SCHEMA_VERSION}`);

    // v1 -> v2: add economy container
    if (from < 2) {
        if (!state.economy || typeof state.economy !== 'object') {
            state.economy = {
                demand: { residential: 0.5, commercial: 0.5, industrial: 0.5 },
                debt: 0,
                lastBudget: { income: 0, expenses: 0, deficit: 0, balanced: true, tick: 0 },
            };
        }
        // Normalize demand keys if older saves used {res,com,ind}
        const d = state.economy.demand;
        if (d && typeof d === 'object') {
            const hasOld = ('res' in d) || ('com' in d) || ('ind' in d);
            const hasNew = ('residential' in d) || ('commercial' in d) || ('industrial' in d);
            if (hasOld && !hasNew) {
                state.economy.demand = {
                    residential: Number(d.res ?? 0.5),
                    commercial: Number(d.com ?? 0.5),
                    industrial: Number(d.ind ?? 0.5),
                };
            }
        }
    }

    // Example migration pattern (uncomment when needed):
    // if (state.schemaVersion === 0) {
    //     state = migrateV0ToV1(state);
    // }

    state.schemaVersion = CURRENT_SCHEMA_VERSION;
    return state;
}

/**
 * Gets the current schema version
 */
export function getSchemaVersion() {
    return CURRENT_SCHEMA_VERSION;
}
