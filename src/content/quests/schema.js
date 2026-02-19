const ALLOWED_STEP_KINDS = new Set([
    'trigger',
    'hack_node',
    'go_to',
    'choice',
    'investigate',
    'interact',
    'outcome',
    'conditional',
    'spawn_clue',
]);

const ALLOWED_REWARD_TYPES = new Set([
    'add_resource',
    'set_flag',
    'modify_heat',
    'rep_delta',
    'unlock_building',
    'unlock_hack',
]);

function err(errors, path, message) {
    errors.push(`${path}: ${message}`);
}

function validateStep(step, index, errors) {
    const p = `steps[${index}]`;
    if (!step || typeof step !== 'object') {
        err(errors, p, 'must be an object');
        return;
    }
    if (!step.id || typeof step.id !== 'string') err(errors, p, 'missing string id');
    if (!step.kind || typeof step.kind !== 'string') err(errors, p, 'missing string kind');
    else if (!ALLOWED_STEP_KINDS.has(step.kind)) err(errors, p, `unsupported kind "${step.kind}"`);

    if (step.kind === 'choice') {
        if (!Array.isArray(step.choices) || step.choices.length < 2 || step.choices.length > 4) {
            err(errors, p, 'choice steps require choices[2..4]');
        } else {
            step.choices.forEach((c, i) => {
                const cp = `${p}.choices[${i}]`;
                if (!c?.id || typeof c.id !== 'string') err(errors, cp, 'missing string id');
                if (!c?.label || typeof c.label !== 'string') err(errors, cp, 'missing string label');
            });
        }
    }

    if (step.kind === 'go_to' && !Number.isFinite(step.targetX) && !Number.isFinite(step.targetY) && !step.marker) {
        err(errors, p, 'go_to requires targetX/targetY or marker fallback');
    }
}

function validateReward(reward, index, errors) {
    const p = `rewards[${index}]`;
    if (!reward || typeof reward !== 'object') {
        err(errors, p, 'must be an object');
        return;
    }
    if (!reward.type || typeof reward.type !== 'string') {
        err(errors, p, 'missing reward type');
        return;
    }
    if (!ALLOWED_REWARD_TYPES.has(reward.type)) {
        err(errors, p, `unsupported reward type "${reward.type}"`);
    }
}

export function validateQuestDefinition(quest) {
    const errors = [];
    const warnings = [];

    if (!quest || typeof quest !== 'object') {
        return { valid: false, errors: ['quest must be an object'], warnings };
    }

    if (!quest.id || typeof quest.id !== 'string') err(errors, 'id', 'required string');
    if (!quest.title || typeof quest.title !== 'string') err(errors, 'title', 'required string');
    if (!Array.isArray(quest.tags)) err(errors, 'tags', 'required array');
    if (quest.trigger !== undefined && typeof quest.trigger !== 'string') err(errors, 'trigger', 'must be a string');
    if (!Array.isArray(quest.steps) || quest.steps.length === 0) err(errors, 'steps', 'required non-empty array');
    else quest.steps.forEach((step, i) => validateStep(step, i, errors));

    if (quest.rewards !== undefined) {
        if (!Array.isArray(quest.rewards)) err(errors, 'rewards', 'must be an array');
        else quest.rewards.forEach((reward, i) => validateReward(reward, i, errors));
    }

    if (quest.poiId && typeof quest.poiId !== 'string') warnings.push('poiId should be string; fallback marker resolution will be used');
    if (quest.citizenId && typeof quest.citizenId !== 'string') warnings.push('citizenId should be string; fallback citizen selection will be used');

    return { valid: errors.length === 0, errors, warnings };
}

export function getQuestSchemaSupport() {
    return {
        stepKinds: Array.from(ALLOWED_STEP_KINDS),
        rewardTypes: Array.from(ALLOWED_REWARD_TYPES),
    };
}
