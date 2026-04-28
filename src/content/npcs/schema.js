export const NPC_ROLES = new Set([
    'corporate', 'government', 'criminal', 'civilian',
]);

export const PERSONALITIES = new Set([
    'ambitious', 'corrupt', 'honest', 'greedy', 'altruistic', 'paranoid',
    'charismatic', 'intimidating', 'mysterious', 'friendly', 'hostile',
    'neutral', 'deceptive', 'loyal', 'treacherous',
]);

export const MOTIVATIONS = new Set([
    'power', 'wealth', 'revenge', 'justice', 'survival', 'fame',
    'knowledge', 'control', 'protection', 'freedom', 'reputation',
    'legacy', 'greed', 'ideology',
]);

function err(errors, path, msg) {
    errors.push(`${path}: ${msg}`);
}

export function validateNPCArchetype(def) {
    const errors = [];
    const warnings = [];

    if (!def || typeof def !== 'object') {
        return { valid: false, errors: ['NPC archetype must be an object'], warnings };
    }

    const p = def.id || '(unknown)';

    if (!def.id || typeof def.id !== 'string') err(errors, `${p}.id`, 'required non-empty string');
    if (!def.name || typeof def.name !== 'string') err(errors, `${p}.name`, 'required non-empty string');
    if (!def.role || !NPC_ROLES.has(def.role)) {
        err(errors, `${p}.role`, `required, must be one of: ${[...NPC_ROLES].join(', ')}`);
    }
    if (!def.title || typeof def.title !== 'string') err(errors, `${p}.title`, 'required non-empty string');

    if (!def.personality || typeof def.personality !== 'string') {
        err(errors, `${p}.personality`, 'required non-empty string');
    } else if (!PERSONALITIES.has(def.personality)) {
        warnings.push(`${p}: personality "${def.personality}" is not in standard set`);
    }

    if (!def.motivation || typeof def.motivation !== 'string') {
        err(errors, `${p}.motivation`, 'required non-empty string');
    } else if (!MOTIVATIONS.has(def.motivation)) {
        warnings.push(`${p}: motivation "${def.motivation}" is not in standard set`);
    }

    if (def.age !== undefined) {
        if (typeof def.age !== 'number' || def.age < 18 || def.age > 100) {
            err(errors, `${p}.age`, 'must be 18-100');
        }
    }

    if (def.income !== undefined) {
        if (typeof def.income !== 'number' || def.income < 0) {
            err(errors, `${p}.income`, 'must be >= 0');
        }
    }

    if (def.secret !== undefined && typeof def.secret !== 'string') {
        err(errors, `${p}.secret`, 'must be a string');
    }

    if (def.schedule !== undefined) {
        if (typeof def.schedule !== 'object') {
            err(errors, `${p}.schedule`, 'must be an object');
        }
    }

    if (def.relations !== undefined) {
        if (!Array.isArray(def.relations)) {
            err(errors, `${p}.relations`, 'must be an array');
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}
