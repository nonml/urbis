// State validation module - comprehensive validators for GameState
// Each validator returns { ok: boolean, errors: string[] }

/**
 * Validates that a value is a non-negative integer
 * @param {number} value
 * @param {string} fieldPath
 * @param {number[]} range Optional [min, max] range
 * @returns {Object} { ok: boolean, errors: string[] }
 */
export function validateNonNegativeInt(value, fieldPath, range = null) {
    const errors = [];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push(`${fieldPath} must be an integer, got ${typeof value}`);
    } else if (value < 0) {
        errors.push(`${fieldPath} must be non-negative, got ${value}`);
    } else if (range && (value < range[0] || value > range[1])) {
        errors.push(`${fieldPath} must be between ${range[0]} and ${range[1]}, got ${value}`);
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Validates that a value is a non-negative number
 * @param {number} value
 * @param {string} fieldPath
 * @param {number} min Optional minimum value
 * @param {number} max Optional maximum value
 * @returns {Object} { ok: boolean, errors: string[] }
 */
export function validateNonNegativeNumber(value, fieldPath, min = 0, max = null) {
    const errors = [];
    if (typeof value !== 'number') {
        errors.push(`${fieldPath} must be a number, got ${typeof value}`);
    } else if (value < min) {
        errors.push(`${fieldPath} must be >= ${min}, got ${value}`);
    } else if (max !== null && value > max) {
        errors.push(`${fieldPath} must be <= ${max}, got ${value}`);
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Validates that a value is a string
 * @param {string} value
 * @param {string} fieldPath
 * @param {number} maxLength Optional max length
 * @returns {Object} { ok: boolean, errors: string[] }
 */
export function validateString(value, fieldPath, maxLength = 255) {
    const errors = [];
    if (typeof value !== 'string') {
        errors.push(`${fieldPath} must be a string, got ${typeof value}`);
    } else if (value.length > maxLength) {
        errors.push(`${fieldPath} must be <= ${maxLength} characters, got ${value.length}`);
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Validates that a value is an array of a specific type
 * @param {Array} value
 * @param {string} fieldPath
 * @param {function} itemValidator Validator function for each item
 * @param {Object} options Validation options
 * @returns {Object} { ok: boolean, errors: string[] }
 */
export function validateArray(value, fieldPath, itemValidator, options = {}) {
    const errors = [];
    const { minLength = 0, maxLength = Infinity } = options;

    if (!Array.isArray(value)) {
        errors.push(`${fieldPath} must be an array, got ${typeof value}`);
        return { ok: false, errors };
    }

    if (value.length < minLength) {
        errors.push(`${fieldPath} must have at least ${minLength} items, got ${value.length}`);
    }
    if (value.length > maxLength) {
        errors.push(`${fieldPath} must have at most ${maxLength} items, got ${value.length}`);
    }

    // Validate each item
    for (let i = 0; i < value.length; i++) {
        const itemError = itemValidator(value[i], `${fieldPath}[${i}]`);
        if (itemError.errors && itemError.errors.length > 0) {
            errors.push(...itemError.errors);
        }
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Validates the GameState schema
 * @param {Object} state
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateGameState(state) {
    const errors = [];

    // Check state is an object
    if (!state || typeof state !== 'object') {
        errors.push('State must be an object');
        return { valid: false, errors };
    }

    // Check schema version
    const schemaVersionResult = validateNonNegativeInt(state.schemaVersion, 'schemaVersion');
    if (!schemaVersionResult.ok) {
        errors.push(...schemaVersionResult.errors);
    }

    // Check required top-level fields
    const requiredFields = ['meta', 'time', 'resources', 'map', 'buildings', 'citizens', 'crises', 'quests', 'cases', 'factions', 'player'];
    for (const field of requiredFields) {
        if (state[field] === undefined) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    // Validate meta
    if (state.meta) {
        const metaErrors = validateMeta(state.meta);
        errors.push(...metaErrors);
    }

    // Validate time
    if (state.time) {
        const timeErrors = validateTime(state.time);
        errors.push(...timeErrors);
    }

    // Validate resources
    if (state.resources) {
        const resourceErrors = validateResources(state.resources);
        errors.push(...resourceErrors);
    }

    // Validate map
    if (state.map) {
        const mapErrors = validateMap(state.map);
        errors.push(...mapErrors);
    }

    // Validate buildings
    if (state.buildings) {
        const buildingErrors = validateBuildings(state.buildings);
        errors.push(...buildingErrors);
    }

    // Validate citizens
    if (state.citizens) {
        const citizenErrors = validateCitizens(state.citizens);
        errors.push(...citizenErrors);
    }

    // Validate crises
    if (state.crises) {
        const crisisErrors = validateCrises(state.crises);
        errors.push(...crisisErrors);
    }

    // Validate quests
    if (state.quests) {
        const questErrors = validateQuests(state.quests);
        errors.push(...questErrors);
    }

    // Validate cases
    if (state.cases) {
        const caseErrors = validateCases(state.cases);
        errors.push(...caseErrors);
    }

    // Validate player
    if (state.player) {
        const playerErrors = validatePlayer(state.player);
        errors.push(...playerErrors);
    }

    // Validate rival
    if (state.rival) {
        const rivalErrors = validateRival(state.rival);
        errors.push(...rivalErrors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates the meta section
 */
function validateMeta(meta) {
    const errors = [];

    if (!meta) {
        errors.push('meta section is required');
        return errors;
    }

    // Validate seed
    const seedResult = validateNonNegativeInt(meta.seed, 'meta.seed');
    if (!seedResult.ok) {
        errors.push(...seedResult.errors);
    }

    // Validate mapPreset
    if (meta.mapPreset) {
        const presetResult = validateString(meta.mapPreset, 'meta.mapPreset');
        if (!presetResult.ok) {
            errors.push(...presetResult.errors);
        }
        const validPresets = ['SMALL', 'CITY', 'MEGA'];
        if (!validPresets.includes(meta.mapPreset)) {
            errors.push(`meta.mapPreset must be one of ${validPresets.join(', ')}, got ${meta.mapPreset}`);
        }
    }

    // Validate map dimensions
    if (meta.mapWidth !== undefined) {
        const widthResult = validateNonNegativeInt(meta.mapWidth, 'meta.mapWidth', [1, 1000]);
        if (!widthResult.ok) {
            errors.push(...widthResult.errors);
        }
    }
    if (meta.mapHeight !== undefined) {
        const heightResult = validateNonNegativeInt(meta.mapHeight, 'meta.mapHeight', [1, 1000]);
        if (!heightResult.ok) {
            errors.push(...heightResult.errors);
        }
    }

    // Validate createdAt
    if (meta.createdAt !== undefined) {
        const createdAtResult = validateNonNegativeNumber(meta.createdAt, 'meta.createdAt');
        if (!createdAtResult.ok) {
            errors.push(...createdAtResult.errors);
        }
    }

    // Validate runId
    if (meta.runId !== undefined) {
        const runIdResult = validateString(meta.runId, 'meta.runId', 64);
        if (!runIdResult.ok) {
            errors.push(...runIdResult.errors);
        }
    }

    // Validate rngStreamSeeds (if present)
    if (meta.rngStreams) {
        const streamErrors = validateRNGStreams(meta.rngStreams);
        errors.push(...streamErrors);
    }

    return errors;
}

/**
 * Validates the RNG streams seeds
 */
function validateRNGStreams(rngStreams) {
    const errors = [];
    const streamNames = ['worldSeed', 'simSeed', 'questSeed', 'rivalSeed', 'vfxSeed'];

    if (!rngStreams || typeof rngStreams !== 'object') {
        errors.push('rngStreams must be an object');
        return errors;
    }

    for (const name of streamNames) {
        if (rngStreams[name] !== undefined) {
            const result = validateNonNegativeInt(rngStreams[name], `rngStreams.${name}`);
            if (!result.ok) {
                errors.push(...result.errors);
            }
        }
    }

    return errors;
}

/**
 * Validates the time section
 */
function validateTime(time) {
    const errors = [];

    if (!time) {
        errors.push('time section is required');
        return errors;
    }

    const tickResult = validateNonNegativeInt(time.tick, 'time.tick');
    if (!tickResult.ok) {
        errors.push(...tickResult.errors);
    }

    if (time.paused !== undefined && typeof time.paused !== 'boolean') {
        errors.push('time.paused must be a boolean');
    }

    if (time.simDt !== undefined) {
        const simDtResult = validateNonNegativeNumber(time.simDt, 'time.simDt', 0.001, 10);
        if (!simDtResult.ok) {
            errors.push(...simDtResult.errors);
        }
    }

    if (time.tickPerDay !== undefined) {
        const tickPerDayResult = validateNonNegativeInt(time.tickPerDay, 'time.tickPerDay', [1, 1000]);
        if (!tickPerDayResult.ok) {
            errors.push(...tickPerDayResult.errors);
        }
    }

    if (time.timeOfDay !== undefined) {
        const timeOfDayResult = validateNonNegativeNumber(time.timeOfDay, 'time.timeOfDay', 0, 1);
        if (!timeOfDayResult.ok) {
            errors.push(...timeOfDayResult.errors);
        }
    }

    return errors;
}

/**
 * Validates the resources section
 */
function validateResources(resources) {
    const errors = [];

    if (!resources) {
        errors.push('resources section is required');
        return errors;
    }

    // Gold
    const goldResult = validateNonNegativeInt(resources.gold, 'resources.gold');
    if (!goldResult.ok) {
        errors.push(...goldResult.errors);
    }

    // Food
    const foodResult = validateNonNegativeInt(resources.food, 'resources.food');
    if (!foodResult.ok) {
        errors.push(...foodResult.errors);
    }

    // Wood
    const woodResult = validateNonNegativeInt(resources.wood, 'resources.wood');
    if (!woodResult.ok) {
        errors.push(...woodResult.errors);
    }

    // Population
    const popResult = validateNonNegativeInt(resources.population, 'resources.population', [0, 100000]);
    if (!popResult.ok) {
        errors.push(...popResult.errors);
    }

    // Housing
    const housingResult = validateNonNegativeInt(resources.housing, 'resources.housing');
    if (!housingResult.ok) {
        errors.push(...housingResult.errors);
    }

    // Day
    const dayResult = validateNonNegativeInt(resources.day, 'resources.day');
    if (!dayResult.ok) {
        errors.push(...dayResult.errors);
    }

    // Job production (if present)
    if (resources.jobProduction) {
        const jobProdResult = validateJobProduction(resources.jobProduction);
        if (!jobProdResult.ok) {
            errors.push(...jobProdResult.errors);
        }
    }

    // Total earned/produced
    const totalFields = ['totalGoldEarned', 'totalFoodProduced', 'totalWoodProduced'];
    for (const field of totalFields) {
        const result = validateNonNegativeInt(resources[field], `resources.${field}`);
        if (!result.ok) {
            errors.push(...result.errors);
        }
    }

    return errors;
}

/**
 * Validates the job production section
 */
function validateJobProduction(jobProduction) {
    const errors = [];
    if (!jobProduction || typeof jobProduction !== 'object') {
        return { ok: false, errors: ['jobProduction must be an object'] };
    }

    const fields = ['gold', 'food', 'wood'];
    for (const field of fields) {
        if (jobProduction[field] !== undefined) {
            const result = validateNonNegativeInt(jobProduction[field], `jobProduction.${field}`);
            if (!result.ok) {
                errors.push(...result.errors);
            }
        }
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Validates the map section
 */
function validateMap(map) {
    const errors = [];

    if (!map) {
        errors.push('map section is required');
        return errors;
    }

    const widthResult = validateNonNegativeInt(map.width, 'map.width', [1, 1000]);
    if (!widthResult.ok) {
        errors.push(...widthResult.errors);
    }

    const heightResult = validateNonNegativeInt(map.height, 'map.height', [1, 1000]);
    if (!heightResult.ok) {
        errors.push(...heightResult.errors);
    }

    // Tiles array validation
    if (map.tiles !== undefined) {
        if (!Array.isArray(map.tiles)) {
            errors.push('map.tiles must be an array');
        } else {
            // Check that it's a 2D array
            const is2DArray = map.tiles.every(row => Array.isArray(row));
            if (!is2DArray) {
                errors.push('map.tiles must be a 2D array');
            }
        }
    }

    return errors;
}

/**
 * Validates the buildings section
 */
function validateBuildings(buildings) {
    const errors = [];

    if (!buildings) {
        errors.push('buildings section is required');
        return errors;
    }

    const nextIdResult = validateNonNegativeInt(buildings.nextId, 'buildings.nextId', [1, Infinity]);
    if (!nextIdResult.ok) {
        errors.push(...nextIdResult.errors);
    }

    if (buildings.list !== undefined) {
        const listResult = validateArray(buildings.list, 'buildings.list', validateBuilding);
        if (!listResult.ok) {
            errors.push(...listResult.errors);
        }
    }

    return errors;
}

/**
 * Validates a single building entry
 */
function validateBuilding(building, fieldPath) {
    const errors = [];
    if (!building || typeof building !== 'object') {
        errors.push(`${fieldPath} must be an object`);
        return { ok: false, errors };
    }

    const idResult = validateNonNegativeInt(building.id, `${fieldPath}.id`);
    if (!idResult.ok) {
        errors.push(...idResult.errors);
    }

    if (building.type !== undefined) {
        const typeResult = validateString(building.type, `${fieldPath}.type`);
        if (!typeResult.ok) {
            errors.push(...typeResult.errors);
        }
    }

    const xResult = validateNonNegativeInt(building.x, `${fieldPath}.x`);
    if (!xResult.ok) {
        errors.push(...xResult.errors);
    }

    const yResult = validateNonNegativeInt(building.y, `${fieldPath}.y`);
    if (!yResult.ok) {
        errors.push(...yResult.errors);
    }

    if (building.level !== undefined) {
        const levelResult = validateNonNegativeInt(building.level, `${fieldPath}.level`);
        if (!levelResult.ok) {
            errors.push(...levelResult.errors);
        }
    }

    if (building.population !== undefined) {
        const popResult = validateNonNegativeInt(building.population, `${fieldPath}.population`);
        if (!popResult.ok) {
            errors.push(...popResult.errors);
        }
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Validates the citizens section
 */
function validateCitizens(citizens) {
    const errors = [];

    if (!citizens) {
        errors.push('citizens section is required');
        return errors;
    }

    const nextIdResult = validateNonNegativeInt(citizens.nextId, 'citizens.nextId', [1, Infinity]);
    if (!nextIdResult.ok) {
        errors.push(...nextIdResult.errors);
    }

    if (citizens.list !== undefined) {
        const listResult = validateArray(citizens.list, 'citizens.list', validateCitizen);
        if (!listResult.ok) {
            errors.push(...listResult.errors);
        }
    }

    if (citizens.birthRate !== undefined) {
        const birthRateResult = validateNonNegativeNumber(citizens.birthRate, 'citizens.birthRate', 0, 1);
        if (!birthRateResult.ok) {
            errors.push(...birthRateResult.errors);
        }
    }

    if (citizens.deathRate !== undefined) {
        const deathRateResult = validateNonNegativeNumber(citizens.deathRate, 'citizens.deathRate', 0, 1);
        if (!deathRateResult.ok) {
            errors.push(...deathRateResult.errors);
        }
    }

    return errors;
}

/**
 * Validates a single citizen entry
 */
function validateCitizen(citizen, fieldPath) {
    const errors = [];
    if (!citizen || typeof citizen !== 'object') {
        errors.push(`${fieldPath} must be an object`);
        return { ok: false, errors };
    }

    const idResult = validateNonNegativeInt(citizen.id, `${fieldPath}.id`);
    if (!idResult.ok) {
        errors.push(...idResult.errors);
    }

    const xResult = validateNonNegativeInt(citizen.x, `${fieldPath}.x`);
    if (!xResult.ok) {
        errors.push(...xResult.errors);
    }

    const yResult = validateNonNegativeInt(citizen.y, `${fieldPath}.y`);
    if (!yResult.ok) {
        errors.push(...yResult.errors);
    }

    const ageResult = validateNonNegativeInt(citizen.age, `${fieldPath}.age`, [0, 120]);
    if (!ageResult.ok) {
        errors.push(...ageResult.errors);
    }

    const happinessResult = validateNonNegativeInt(citizen.happiness, `${fieldPath}.happiness`, [0, 100]);
    if (!happinessResult.ok) {
        errors.push(...happinessResult.errors);
    }

    const foodLevelResult = validateNonNegativeInt(citizen.foodLevel, `${fieldPath}.foodLevel`, [0, 100]);
    if (!foodLevelResult.ok) {
        errors.push(...foodLevelResult.errors);
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Validates the crises section
 */
function validateCrises(crises) {
    const errors = [];

    if (!crises) {
        errors.push('crises section is required');
        return errors;
    }

    // active crisis (optional)
    if (crises.active !== undefined && crises.active !== null) {
        if (typeof crises.active !== 'object') {
            errors.push('crises.active must be an object or null');
        }
    }

    // history
    if (crises.history !== undefined) {
        if (!Array.isArray(crises.history)) {
            errors.push('crises.history must be an array');
        }
    }

    return errors;
}

/**
 * Validates the quests section
 */
function validateQuests(quests) {
    const errors = [];

    if (!quests) {
        errors.push('quests section is required');
        return errors;
    }

    if (quests.active !== undefined) {
        const listResult = validateArray(quests.active, 'quests.active', validateQuest);
        if (!listResult.ok) {
            errors.push(...listResult.errors);
        }
    }

    if (quests.completed !== undefined) {
        const listResult = validateArray(quests.completed, 'quests.completed', validateQuest);
        if (!listResult.ok) {
            errors.push(...listResult.errors);
        }
    }

    return errors;
}

function validateCases(cases) {
    const errors = [];
    if (!cases || typeof cases !== 'object') {
        errors.push('cases must be an object');
        return errors;
    }

    if (cases.active !== undefined && !Array.isArray(cases.active)) {
        errors.push('cases.active must be an array');
    }
    if (cases.completed !== undefined && !Array.isArray(cases.completed)) {
        errors.push('cases.completed must be an array');
    }
    if (cases.evidence !== undefined && !Array.isArray(cases.evidence)) {
        errors.push('cases.evidence must be an array');
    }
    if (cases.nextCaseSeed !== undefined) {
        const r = validateNonNegativeInt(cases.nextCaseSeed, 'cases.nextCaseSeed');
        if (!r.ok) errors.push(...r.errors);
    }

    return errors;
}

/**
 * Validates a single quest entry
 */
function validateQuest(quest, fieldPath) {
    const errors = [];
    if (!quest || typeof quest !== 'object') {
        errors.push(`${fieldPath} must be an object`);
        return { ok: false, errors };
    }

    if (quest.id !== undefined) {
        const idResult = validateString(quest.id, `${fieldPath}.id`);
        if (!idResult.ok) {
            errors.push(...idResult.errors);
        }
    }

    if (quest.status !== undefined) {
        const validStatuses = ['active', 'blocked', 'completed', 'failed'];
        if (!validStatuses.includes(quest.status)) {
            errors.push(`${fieldPath}.status must be one of ${validStatuses.join(', ')}, got ${quest.status}`);
        }
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Validates the player section
 */
function validatePlayer(player) {
    const errors = [];

    if (!player) {
        errors.push('player section is required');
        return errors;
    }

    const xResult = validateNonNegativeInt(player.x, 'player.x');
    if (!xResult.ok) {
        errors.push(...xResult.errors);
    }

    const yResult = validateNonNegativeInt(player.y, 'player.y');
    if (!yResult.ok) {
        errors.push(...yResult.errors);
    }

    if (player.wx !== undefined) {
        const wxResult = validateNonNegativeNumber(player.wx, 'player.wx', 0);
        if (!wxResult.ok) {
            errors.push(...wxResult.errors);
        }
    }

    if (player.wz !== undefined) {
        const wzResult = validateNonNegativeNumber(player.wz, 'player.wz', 0);
        if (!wzResult.ok) {
            errors.push(...wzResult.errors);
        }
    }

    if (player.yaw !== undefined) {
        const yawResult = validateNonNegativeNumber(player.yaw, 'player.yaw', -Math.PI, Math.PI);
        if (!yawResult.ok) {
            errors.push(...yawResult.errors);
        }
    }

    if (player.pitch !== undefined) {
        const pitchResult = validateNonNegativeNumber(player.pitch, 'player.pitch', -Math.PI / 2, Math.PI / 2);
        if (!pitchResult.ok) {
            errors.push(...pitchResult.errors);
        }
    }

    const heatResult = validateNonNegativeInt(player.heat, 'player.heat', [0, 100]);
    if (!heatResult.ok) {
        errors.push(...heatResult.errors);
    }
    if (player.heatState !== undefined) {
        const validHeatStates = ['calm', 'alert', 'search', 'pursuit'];
        if (!validHeatStates.includes(player.heatState)) {
            errors.push(`player.heatState must be one of ${validHeatStates.join(', ')}, got ${player.heatState}`);
        }
    }

    if (player.exposure !== undefined) {
        const exposureResult = validateNonNegativeInt(player.exposure, 'player.exposure', [0, 100]);
        if (!exposureResult.ok) {
            errors.push(...exposureResult.errors);
        }
    }

    const reputationResult = validateNonNegativeInt(player.reputation, 'player.reputation', [0, 100]);
    if (!reputationResult.ok) {
        errors.push(...reputationResult.errors);
    }

    return errors;
}

/**
 * Validates the rival section
 */
function validateRival(rival) {
    const errors = [];

    if (!rival) {
        // Rival is optional
        return errors;
    }

    if (typeof rival !== 'object') {
        errors.push('rival must be an object');
        return errors;
    }

    const influenceResult = validateNonNegativeInt(rival.influence, 'rival.influence', [0, 100]);
    if (!influenceResult.ok) {
        errors.push(...influenceResult.errors);
    }

    const budgetResult = validateNonNegativeInt(rival.budget, 'rival.budget', [0, Infinity]);
    if (!budgetResult.ok) {
        errors.push(...budgetResult.errors);
    }

    const heatResult = validateNonNegativeInt(rival.heat, 'rival.heat', [0, 100]);
    if (!heatResult.ok) {
        errors.push(...heatResult.errors);
    }

    const intelResult = validateNonNegativeInt(rival.intel, 'rival.intel', [0, Infinity]);
    if (!intelResult.ok) {
        errors.push(...intelResult.errors);
    }

    const lastActionTickResult = validateNonNegativeInt(rival.lastActionTick, 'rival.lastActionTick');
    if (!lastActionTickResult.ok) {
        errors.push(...lastActionTickResult.errors);
    }

    if (rival.currentAction !== undefined && rival.currentAction !== null) {
        if (typeof rival.currentAction !== 'string' && typeof rival.currentAction !== 'object') {
            errors.push('rival.currentAction must be a string or object');
        }
    }

    if (rival.pastActions !== undefined) {
        if (!Array.isArray(rival.pastActions)) {
            errors.push('rival.pastActions must be an array');
        }
    }

    return errors;
}

/**
 * Dev-only assertion that throws on invalid state
 * This is more aggressive than validateGameState and is meant for development/debugging
 * @param {Object} state
 * @param {string} context Optional context for error messages
 * @throws {Error} If state is invalid
 */
export function assertStateShape(state, context = 'GameState') {
    const validation = validateGameState(state);
    if (!validation.valid) {
        const msg = `${context} validation failed:\n${validation.errors.join('\n')}`;
        console.error(msg);
        // In dev mode, throw; in prod, just log
        if (import.meta.env?.DEV) {
            throw new Error(msg);
        }
    }
}
