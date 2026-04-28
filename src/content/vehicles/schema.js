export const VEHICLE_CATEGORIES = new Set([
    'civilian', 'sport', 'service', 'emergency', 'commercial', 'transit',
]);

export const MODEL_KEYS = new Set([
    'sedan', 'hatchback-sports', 'taxi', 'suv', 'van',
    'delivery', 'police', 'firetruck', 'bus',
]);

const REQUIRED_STRINGS = ['id', 'name', 'modelKey'];
const REQUIRED_PHYSICS = ['maxSpeed', 'acceleration', 'braking', 'turningSpeed', 'mass'];
const REQUIRED_DIMS = ['wheelbase', 'width', 'length'];

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
    if (opts.min !== undefined && v < opts.min) err(errors, `${path}.${key}`, `must be >= ${opts.min}`);
    if (opts.max !== undefined && v > opts.max) err(errors, `${path}.${key}`, `must be <= ${opts.max}`);
}

export function validateVehicleDefinition(def) {
    const errors = [];
    const warnings = [];

    if (!def || typeof def !== 'object') {
        return { valid: false, errors: ['vehicle definition must be an object'], warnings };
    }

    const p = def.id || '(unknown)';

    for (const key of REQUIRED_STRINGS) {
        if (!def[key] || typeof def[key] !== 'string') {
            err(errors, `${p}.${key}`, 'required non-empty string');
        }
    }

    if (def.category !== undefined && !VEHICLE_CATEGORIES.has(def.category)) {
        err(errors, `${p}.category`, `must be one of: ${[...VEHICLE_CATEGORIES].join(', ')}`);
    }

    for (const key of REQUIRED_PHYSICS) {
        checkNum(def, key, p, errors, { required: true, min: 0.01 });
    }

    for (const key of REQUIRED_DIMS) {
        checkNum(def, key, p, errors, { required: true, min: 0.5 });
    }

    checkNum(def, 'traction', p, errors, { min: 0.1, max: 2.0 });
    checkNum(def, 'maxHealth', p, errors, { min: 1 });

    if (def.maxSpeed > 50) {
        warnings.push(`${p}: maxSpeed ${def.maxSpeed} m/s is very fast — verify intentional`);
    }

    if (def.mass !== undefined && def.mass > 10000) {
        warnings.push(`${p}: mass ${def.mass} kg is very heavy — verify intentional`);
    }

    if (def.length !== undefined && def.width !== undefined) {
        if (def.width > def.length) {
            warnings.push(`${p}: width > length — vehicle wider than long`);
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}
