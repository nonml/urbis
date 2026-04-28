import { sequence, selector, condition, action, tick as btTick, SUCCESS } from './bt.js';
import { eventBus, EVENT_TYPES } from '../events.js';

const ALERT_RADIUS = 20;
const FLEE_RADIUS = 12;
const SEARCH_DURATION = 15;
const SEARCH_WANDER_RADIUS = 3;
const ALERT_COOLDOWN = 30;

const alertedTree = selector(
    sequence(
        condition(ctx => ctx.citizen._sim.alertState === 'searching'),
        action(ctx => tickSearch(ctx))
    ),
    sequence(
        condition(ctx => ctx.citizen._sim.alertState === 'investigating'),
        action(ctx => tickInvestigate(ctx))
    ),
    action(ctx => { ctx.citizen._sim.alertState = null; return SUCCESS; })
);

let _pendingDisturbances = [];

export function initAlertedSystem() {
    eventBus.on(EVENT_TYPES.PLAYER_FIRED_WEAPON, (data) => {
        _pendingDisturbances.push({ x: data.x, y: data.y, tick: data.tick ?? 0 });
        if (_pendingDisturbances.length > 8) _pendingDisturbances.shift();
    });
}

export function flushDisturbances(citizens, tick) {
    if (_pendingDisturbances.length === 0) return;
    for (const dist of _pendingDisturbances) {
        alertNearbyCitizens(citizens, dist.x, dist.y, tick);
    }
    _pendingDisturbances.length = 0;
}

function alertNearbyCitizens(citizens, sx, sy, tick) {
    for (const c of citizens) {
        if (!c._sim) continue;
        if (c._sim.alertState) continue;
        if (c._sim.alertCooldown > tick) continue;
        const dx = (c.x ?? 0) - sx;
        const dy = (c.y ?? 0) - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= FLEE_RADIUS && dist < ALERT_RADIUS) {
            c._sim.alertState = 'investigating';
            c._sim.alertTargetX = Math.round(sx);
            c._sim.alertTargetY = Math.round(sy);
            c._sim.alertTimer = SEARCH_DURATION + Math.round(dist);
        }
    }
}

function tickInvestigate(ctx) {
    const { citizen, game } = ctx;
    const sim = citizen._sim;
    const tx = sim.alertTargetX;
    const ty = sim.alertTargetY;
    const dx = tx - citizen.x;
    const dy = ty - citizen.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    sim.alertTimer--;
    if (sim.alertTimer <= 0 || dist <= 1) {
        sim.alertState = 'searching';
        sim.alertTimer = SEARCH_DURATION;
        return SUCCESS;
    }

    moveToward(citizen, tx, ty, game);
    return SUCCESS;
}

function tickSearch(ctx) {
    const { citizen, game, tick } = ctx;
    const sim = citizen._sim;

    sim.alertTimer--;
    if (sim.alertTimer <= 0) {
        sim.alertState = null;
        sim.alertCooldown = tick + ALERT_COOLDOWN;
        return SUCCESS;
    }

    if (tick % 3 === 0) {
        const ox = citizen.x + Math.round(game.rng.next() * SEARCH_WANDER_RADIUS * 2 - SEARCH_WANDER_RADIUS);
        const oy = citizen.y + Math.round(game.rng.next() * SEARCH_WANDER_RADIUS * 2 - SEARCH_WANDER_RADIUS);
        moveToward(citizen, ox, oy, game);
    }
    return SUCCESS;
}

function moveToward(citizen, tx, ty, game) {
    const dx = tx - citizen.x;
    const dy = ty - citizen.y;
    if (dx === 0 && dy === 0) return;
    const sx = dx !== 0 ? Math.sign(dx) : 0;
    const sy = dy !== 0 ? Math.sign(dy) : 0;
    const nx = citizen.x + (Math.abs(dx) >= Math.abs(dy) ? sx : 0);
    const ny = citizen.y + (Math.abs(dy) > Math.abs(dx) ? sy : 0);
    if (game.scheduleManager?.isWalkable(nx, ny)) {
        citizen.x = nx;
        citizen.y = ny;
    }
}

export function isAlerted(citizen) {
    return citizen._sim?.alertState != null;
}

export function tickAlerted(citizen, game, tick) {
    if (!citizen._sim?.alertState) return false;
    const ctx = { citizen, game, tick };
    btTick(alertedTree, ctx);
    return true;
}
