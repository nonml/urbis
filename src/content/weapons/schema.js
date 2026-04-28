export const WEAPON_TYPES = new Set(['melee', 'ranged']);

function err(errors, path, msg) {
    errors.push(`${path}: ${msg}`);
}

function checkNum(obj, key, path, errors, opts = {}) {
    const v = obj[key];
    if (v === undefined) {
        if (opts.required) err(errors, `${path}.${key}`, 'required');
        return;
    }
    if (typeof v !== 'number' || (!Number.isFinite(v) && v !== Infinity)) {
        err(errors, `${path}.${key}`, 'must be a number');
        return;
    }
    if (opts.min !== undefined && v < opts.min) err(errors, `${path}.${key}`, `must be >= ${opts.min}`);
    if (opts.max !== undefined && v > opts.max) err(errors, `${path}.${key}`, `must be <= ${opts.max}`);
}

export function validateWeaponDefinition(def) {
    const errors = [];
    const warnings = [];

    if (!def || typeof def !== 'object') {
        return { valid: false, errors: ['weapon definition must be an object'], warnings };
    }

    const p = def.id || '(unknown)';

    if (!def.id || typeof def.id !== 'string') err(errors, `${p}.id`, 'required non-empty string');
    if (!def.name || typeof def.name !== 'string') err(errors, `${p}.name`, 'required non-empty string');

    if (!def.type || !WEAPON_TYPES.has(def.type)) {
        err(errors, `${p}.type`, `required, must be one of: ${[...WEAPON_TYPES].join(', ')}`);
    }

    checkNum(def, 'damage', p, errors, { required: true, min: 1 });
    checkNum(def, 'range', p, errors, { required: true, min: 0.5 });
    checkNum(def, 'fireRate', p, errors, { required: true, min: 1 });
    checkNum(def, 'heatGain', p, errors, { required: true, min: 0 });
    checkNum(def, 'spread', p, errors, { min: 0 });
    checkNum(def, 'pellets', p, errors, { min: 1 });

    if (def.type === 'ranged') {
        checkNum(def, 'ammo', p, errors, { required: true, min: 1 });
        checkNum(def, 'maxAmmo', p, errors, { required: true, min: 1 });
        checkNum(def, 'soundRadius', p, errors, { min: 0 });

        if (def.ammo !== undefined && def.maxAmmo !== undefined && def.ammo > def.maxAmmo) {
            err(errors, `${p}`, 'ammo cannot exceed maxAmmo');
        }
    }

    checkNum(def, 'recoilGain', p, errors, { min: 0 });
    checkNum(def, 'recoilMax', p, errors, { min: 0 });
    checkNum(def, 'recoilRecovery', p, errors, { min: 0 });
    checkNum(def, 'adsFov', p, errors, { min: 0, max: 120 });
    checkNum(def, 'adsSpreadMul', p, errors, { min: 0, max: 1 });
    checkNum(def, 'knockback', p, errors, { min: 0 });

    if (def.damage > 100) {
        warnings.push(`${p}: damage ${def.damage} is very high — verify intentional`);
    }
    if (def.type === 'ranged' && def.spread === 0) {
        warnings.push(`${p}: ranged weapon with zero spread — perfect accuracy`);
    }

    return { valid: errors.length === 0, errors, warnings };
}
