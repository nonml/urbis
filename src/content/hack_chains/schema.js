/**
 * Hack Chain schema — declarative file format for chaining environmental
 * hacks together.  Each chain is a JSON object describing a trigger
 * condition and an ordered sequence of hack effects.
 */

export const CHAIN_SCHEMA = {
    required: ['id', 'name', 'steps'],
    properties: {
        id: 'string',
        name: 'string',
        description: 'string',
        cooldown: 'number',
        steps: 'array',
    },
};

const VALID_ACTIONS = new Set([
    'steam_pipe', 'crane_drop', 'traffic_lights',
    'barrier', 'explosion_steam', 'explosion_electrical',
    'explosion_gas', 'blackout', 'cctv_disable',
]);

export function validateChainDefinition(chain) {
    const errors = [];
    if (!chain.id || typeof chain.id !== 'string') {
        errors.push('Missing or invalid id');
    }
    if (!chain.name || typeof chain.name !== 'string') {
        errors.push('Missing or invalid name');
    }
    if (!Array.isArray(chain.steps) || chain.steps.length === 0) {
        errors.push('steps must be a non-empty array');
    } else {
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            if (!step.action || !VALID_ACTIONS.has(step.action)) {
                errors.push(`Step ${i}: unknown action '${step.action}'`);
            }
            if (typeof step.delay !== 'number' || step.delay < 0) {
                errors.push(`Step ${i}: delay must be a non-negative number`);
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
