export const BUILDING_CATEGORIES = new Set([
    'residential', 'commercial', 'industrial', 'infrastructure',
    'education', 'transportation', 'energy', 'justice',
    'culture', 'security', 'other',
]);

export const ZONE_TYPES = new Set([
    'residential', 'commercial', 'industrial', 'none',
]);

export const GROWTH_STAGES = new Set([
    'SMALL', 'MEDIUM', 'LARGE',
]);

const RESOURCE_KEYS = ['gold', 'food', 'wood'];

function err(errors, path, msg) {
    errors.push(`${path}: ${msg}`);
}

function checkNum(obj, key, path, errors, opts = {}) {
    const v = obj[key];
    if (v === undefined) {
        if (opts.required) err(errors, `${path}.${key}`, 'required');
        return;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        err(errors, `${path}.${key}`, 'must be a finite number');
        return;
    }
    if (opts.min !== undefined && v < opts.min) {
        err(errors, `${path}.${key}`, `must be >= ${opts.min}`);
    }
    if (opts.max !== undefined && v > opts.max) {
        err(errors, `${path}.${key}`, `must be <= ${opts.max}`);
    }
}

function checkStr(obj, key, path, errors, opts = {}) {
    const v = obj[key];
    if (v === undefined) {
        if (opts.required) err(errors, `${path}.${key}`, 'required');
        return;
    }
    if (typeof v !== 'string' || v.length === 0) {
        err(errors, `${path}.${key}`, 'must be a non-empty string');
    }
}

function checkCost(cost, path, errors) {
    if (!cost || typeof cost !== 'object') {
        err(errors, path, 'must be an object with gold/food/wood');
        return;
    }
    for (const k of RESOURCE_KEYS) {
        if (cost[k] !== undefined) checkNum(cost, k, path, errors, { min: 0 });
    }
}

function checkIncome(income, path, errors) {
    if (!income || typeof income !== 'object') {
        err(errors, path, 'must be an object with gold/food/wood');
        return;
    }
    for (const k of RESOURCE_KEYS) {
        checkNum(income, k, path, errors);
    }
}

export function validateBuildingDefinition(def) {
    const errors = [];
    const warnings = [];

    if (!def || typeof def !== 'object') {
        return { valid: false, errors: ['building definition must be an object'], warnings };
    }

    const p = def.id || '(unknown)';

    checkStr(def, 'id', p, errors, { required: true });
    checkStr(def, 'name', p, errors, { required: true });
    checkStr(def, 'icon', p, errors, { required: true });
    checkStr(def, 'description', p, errors, { required: true });

    if (def.category !== undefined && !BUILDING_CATEGORIES.has(def.category)) {
        err(errors, `${p}.category`, `must be one of: ${[...BUILDING_CATEGORIES].join(', ')}`);
    }

    if (!def.cost) err(errors, `${p}.cost`, 'required');
    else checkCost(def.cost, `${p}.cost`, errors);

    if (!def.income) err(errors, `${p}.income`, 'required');
    else checkIncome(def.income, `${p}.income`, errors);

    checkNum(def, 'upkeep', p, errors, { required: true, min: 0 });
    checkNum(def, 'population', p, errors, { min: 0 });

    if (def.effects !== undefined) {
        if (typeof def.effects !== 'object') {
            err(errors, `${p}.effects`, 'must be an object');
        }
    }

    if (def.unlockRequirement !== undefined) {
        const ur = def.unlockRequirement;
        if (typeof ur !== 'object') {
            err(errors, `${p}.unlockRequirement`, 'must be an object');
        } else {
            checkNum(ur, 'population', `${p}.unlockRequirement`, errors, { min: 0 });
            checkNum(ur, 'techLevel', `${p}.unlockRequirement`, errors, { min: 0 });
        }
    }

    if (def.zoneType !== undefined && !ZONE_TYPES.has(def.zoneType)) {
        err(errors, `${p}.zoneType`, `must be one of: ${[...ZONE_TYPES].join(', ')}`);
    }

    if (def.growthStage !== undefined && !GROWTH_STAGES.has(def.growthStage)) {
        err(errors, `${p}.growthStage`, `must be one of: ${[...GROWTH_STAGES].join(', ')}`);
    }

    if (def.population > 0 && def.category && def.category !== 'residential') {
        warnings.push(`${p}: population > 0 but category is not residential`);
    }

    const totalIncome = (def.income?.gold || 0) + (def.income?.food || 0) + (def.income?.wood || 0);
    const totalCost = (def.cost?.gold || 0) + (def.cost?.food || 0) + (def.cost?.wood || 0);
    if (totalCost === 0 && totalIncome > 0) {
        warnings.push(`${p}: free building with positive income — verify intentional`);
    }

    return { valid: errors.length === 0, errors, warnings };
}
