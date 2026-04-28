export const SUCCESS = 'success';
export const FAILURE = 'failure';
export const RUNNING = 'running';

export function sequence(...children) {
    return { type: 'sequence', children };
}

export function selector(...children) {
    return { type: 'selector', children };
}

export function condition(fn) {
    return { type: 'condition', fn };
}

export function action(fn) {
    return { type: 'action', fn };
}

export function inverter(child) {
    return { type: 'inverter', child };
}

export function repeatUntilFail(child) {
    return { type: 'repeatUntilFail', child };
}

export function tick(node, ctx) {
    switch (node.type) {
        case 'sequence': return _tickSequence(node, ctx);
        case 'selector': return _tickSelector(node, ctx);
        case 'condition': return node.fn(ctx) ? SUCCESS : FAILURE;
        case 'action': return node.fn(ctx) ?? SUCCESS;
        case 'inverter': return _tickInverter(node, ctx);
        case 'repeatUntilFail': return _tickRepeatUntilFail(node, ctx);
        default: return FAILURE;
    }
}

function _tickSequence(node, ctx) {
    for (const child of node.children) {
        const result = tick(child, ctx);
        if (result !== SUCCESS) return result;
    }
    return SUCCESS;
}

function _tickSelector(node, ctx) {
    for (const child of node.children) {
        const result = tick(child, ctx);
        if (result !== FAILURE) return result;
    }
    return FAILURE;
}

function _tickInverter(node, ctx) {
    const result = tick(node.child, ctx);
    if (result === SUCCESS) return FAILURE;
    if (result === FAILURE) return SUCCESS;
    return RUNNING;
}

function _tickRepeatUntilFail(node, ctx) {
    const result = tick(node.child, ctx);
    if (result === FAILURE) return SUCCESS;
    return RUNNING;
}
