// Migration functions for save schema versions
// Each function transforms state from oldVersion to oldVersion+1

function newRunId() {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && cryptoObj.randomUUID) return cryptoObj.randomUUID();
    if (cryptoObj && cryptoObj.getRandomValues) {
        const bytes = new Uint8Array(16);
        cryptoObj.getRandomValues(bytes);
        return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return `${Date.now().toString(16)}_${(Date.now() ^ 0x9e3779b9).toString(16)}`;
}

/**
 * Migration v0 -> v1 (initial version)
 * This is a placeholder - original saves didn't have schemaVersion
 */
export function migrateV0ToV1(state) {
    // Add missing schemaVersion
    state.schemaVersion = 1;

    // Add meta if missing
    if (!state.meta) {
        state.meta = {
            seed: state.meta?.seed ?? 123456789,
            mapPreset: state.meta?.mapPreset ?? 'CITY',
            mapWidth: state.meta?.mapWidth ?? 96,
            mapHeight: state.meta?.mapHeight ?? 96,
            createdAt: Date.now(),
            runId: newRunId(),
        };
    }

    // Add time if missing
    if (!state.time) {
        state.time = {
            tick: 0,
            paused: false,
            simDt: 0.2,
        };
    }

    // Normalize resources format
    if (state.resources) {
        if (!state.resources.jobProduction) {
            state.resources.jobProduction = { gold: 0, food: 0, wood: 0 };
        }
        if (!state.resources.totalGoldEarned) {
            state.resources.totalGoldEarned = 0;
        }
        if (!state.resources.totalFoodProduced) {
            state.resources.totalFoodProduced = 0;
        }
        if (!state.resources.totalWoodProduced) {
            state.resources.totalWoodProduced = 0;
        }
    }

    // Normalize buildings format
    if (state.buildings && !state.buildings.nextId) {
        state.buildings.nextId = state.buildings.length + 1;
    }

    // Normalize citizens format
    if (state.citizens && !state.citizens.nextId) {
        state.citizens.nextId = state.citizens.length + 1;
    }

    // Add crises if missing
    if (!state.crises) {
        state.crises = { active: null, history: [] };
    }

    // Add player if missing
    if (!state.player) {
        state.player = {
            x: Math.floor(state.map?.width / 2) || 0,
            y: Math.floor(state.map?.height / 2) || 0,
            wx: 0,
            wz: 0,
            yaw: 0,
            pitch: -0.35,
        };
    }

    return state;
}

/**
 * Migration v1 -> v2 (future)
 * Add this when schema evolves
 */
// export function migrateV1ToV2(state) {
//     // Example: Rename a field
//     if (state.resources && state.resources.goldInFlow) {
//         state.resources.goldIncome = state.resources.goldInFlow;
//         delete state.resources.goldInFlow;
//     }
//     return state;
// }

/**
 * Gets all migration functions in order
 */


/**
 * Migration v2 -> v3 (Q3: stealth + combat systems)
 */
export function migrateV2ToV3(state) {
    // Add stealth system state
    if (!state.stealth) {
        state.stealth = {
            isCrouching: false,
            visibility: 'exposed',
            detectionLevel: 0,
        };
    }
    // Add combat state
    if (!state.combat) {
        state.combat = {
            currentWeapon: 'fist',
            heat: 0,
            wantedLevel: 0,
        };
    }
    state.schemaVersion = 3;
    return state;
}

/**
 * Migration v3 -> v4 (Q4: vehicles + wanted escalation)
 */
export function migrateV3ToV4(state) {
    // Add vehicle system state
    if (!state.vehicles) {
        state.vehicles = { activeId: null, damageStage: 0 };
    }
    // Add wanted escalation
    if (!state.wanted) {
        state.wanted = {
            level: state.combat?.wantedLevel || 0,
            timer: 0,
            responders: [],
        };
    }
    state.schemaVersion = 4;
    return state;
}

/**
 * Migration v4 -> v5 (Q5: content engine + districts)
 */
export function migrateV4ToV5(state) {
    // Add district state
    if (!state.districts) {
        state.districts = {};
    }
    // Add content progress
    if (!state.progress) {
        state.progress = {
            unlocks: { buildings: [], hacks: [] },
            rewardLog: {},
            runFlags: {},
        };
    }
    state.schemaVersion = 5;
    return state;
}

/**
 * Migration v5 -> v6 (Q6: hacking depth — cameras, profiler, chains)
 */
export function migrateV5ToV6(state) {
    // Add camera network state
    if (!state.cameraNetwork) {
        state.cameraNetwork = { hacked: [], traversalPath: [] };
    }
    // Add profiler data
    if (!state.profiler) {
        state.profiler = { targets: [], relationsGraph: {} };
    }
    // Add hack chains
    if (!state.hackChains) {
        state.hackChains = { active: [], cooldowns: {} };
    }
    state.schemaVersion = 6;
    return state;
}

/**
 * Migration v6 -> v7 (Q7: TTS, subtitles, radio, arc missions)
 */
export function migrateV6ToV7(state) {
    // Add TTS/subtitle state
    if (!state.audio) {
        state.audio = {
            ttsEnabled: true,
            subtitlesEnabled: true,
            subtitleSize: 'medium',
            radioChannel: 0,
            radioVolume: 0.7,
        };
    }
    // Add arc progress
    if (!state.arc) {
        state.arc = {
            currentArc: null,
            completedMissions: [],
            missionFlags: {},
        };
    }
    state.schemaVersion = 7;
    return state;
}

/**
 * Migration v7 -> v8 (Q8: tutorial, quest validator, zero-hostilities)
 */
export function migrateV7ToV8(state) {
    // Add tutorial state
    if (!state.tutorial) {
        state.tutorial = {
            completed: false,
            currentStep: 0,
            skipped: false,
        };
    }
    // Add quest zero-hostilities tracking
    if (state.activeQuests) {
        state.activeQuests.forEach((q) => {
            if (q.zeroHostilities === undefined) {
                q.zeroHostilities = true;
            }
        });
    }
    // Add colorblind mode
    if (!state.accessibility) {
        state.accessibility = {
            colorblindMode: 'none',
            reducedMotion: false,
        };
    }
    state.schemaVersion = 8;
    return state;
}


export function getAllMigrations() {
    return [
        migrateV0ToV1,
        migrateV2ToV3,
        migrateV3ToV4,
        migrateV4ToV5,
        migrateV5ToV6,
        migrateV6ToV7,
        migrateV7ToV8,
    ];
}

/**
 * Runs migration chain until current version
 * @param {Object} state
 * @param {number} currentVersion
 * @returns {Object} Migrated state
 */
export function applyMigrations(state, currentVersion) {
    const migrations = getAllMigrations();

    while (state.schemaVersion < currentVersion) {
        const migrationIndex = state.schemaVersion;
        if (migrationIndex < migrations.length) {
            state = migrations[migrationIndex](state);
        } else {
            console.warn(`No migration found for v${state.schemaVersion} -> v${state.schemaVersion + 1}`);
            break;
        }
    }

    return state;
}