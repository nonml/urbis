import { sequence, selector, condition, action, tick as btTick, SUCCESS } from './bt.js';
import { eventBus, EVENT_TYPES } from '../events.js';

const FLEE_RADIUS = 12;
const PANIC_RADIUS = 6;
const FLEE_DURATION = 12;
const FLEE_SPEED = 1;
const REPORT_CHANCE = 0.10;
const PANIC_SPREAD_INTERVAL = 3;

const fleeTree = selector(
    sequence(
        condition(ctx => ctx.citizen._sim.fleeTimer > 0),
        action(ctx => tickFlee(ctx))
    ),
    action(ctx => endFlee(ctx))
);

let _pendingShots = [];

export function initFleeSystem() {
    eventBus.on(EVENT_TYPES.PLAYER_FIRED_WEAPON, (data) => {
        _pendingShots.push({ x: data.x, y: data.y });
        if (_pendingShots.length > 8) _pendingShots.shift();
    });
}

export function flushFleeEvents(citizens, tick) {
    for (const shot of _pendingShots) {
        markFleeing(citizens, shot.x, shot.y);
    }
    _pendingShots.length = 0;
    if (tick % PANIC_SPREAD_INTERVAL === 0) {
        spreadPanic(citizens);
    }
}

function markFleeing(citizens, sx, sy) {
    for (const c of citizens) {
        if (!c._sim) continue;
        if (c._sim.fleeTimer > 0 || c._sim.engState) continue;
        const dx = (c.x ?? 0) - sx;
        const dy = (c.y ?? 0) - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < FLEE_RADIUS) {
            const angle = Math.atan2(dy, dx);
            c._sim.fleeTimer = FLEE_DURATION;
            c._sim.fleeTargetX = Math.round((c.x ?? 0) + Math.cos(angle) * 10);
            c._sim.fleeTargetY = Math.round((c.y ?? 0) + Math.sin(angle) * 10);
            c._sim.fleeReported = false;
        }
    }
}

function spreadPanic(citizens) {
    const fleeing = citizens.filter(c => c._sim?.fleeTimer > 0);
    for (const panicked of fleeing) {
        for (const c of citizens) {
            if (!c._sim) continue;
            if (c._sim.fleeTimer > 0 || c._sim.engState) continue;
            const dx = (c.x ?? 0) - (panicked.x ?? 0);
            const dy = (c.y ?? 0) - (panicked.y ?? 0);
            if (Math.abs(dx) + Math.abs(dy) > PANIC_RADIUS) continue;
            const angle = Math.atan2(dy, dx);
            c._sim.fleeTimer = FLEE_DURATION;
            c._sim.fleeTargetX = Math.round((c.x ?? 0) + Math.cos(angle) * 8);
            c._sim.fleeTargetY = Math.round((c.y ?? 0) + Math.sin(angle) * 8);
            c._sim.fleeReported = false;
        }
    }
}

function tickFlee(ctx) {
    const { citizen, game } = ctx;
    const sim = citizen._sim;
    const tx = sim.fleeTargetX;
    const ty = sim.fleeTargetY;
    const dx = tx - citizen.x;
    const dy = ty - citizen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.5) {
        const mx = dx / dist;
        const my = dy / dist;
        const nx = citizen.x + Math.round(mx * FLEE_SPEED);
        const ny = citizen.y + Math.round(my * FLEE_SPEED);
        const w = game.map?.width ?? 100;
        const h = game.map?.height ?? 100;
        citizen.x = Math.max(0, Math.min(w - 1, nx));
        citizen.y = Math.max(0, Math.min(h - 1, ny));
    }

    if (!sim.fleeReported && game.rng.next() < REPORT_CHANCE) {
        sim.fleeReported = true;
        game.heatSystem?.addHeat(3);
    }

    sim.fleeTimer--;
    return SUCCESS;
}

function endFlee(ctx) {
    ctx.citizen._sim.fleeTimer = 0;
    return SUCCESS;
}

export function isFleeing(citizen) {
    return (citizen._sim?.fleeTimer ?? 0) > 0;
}

export function tickFleeTree(citizen, game, tick) {
    if (!isFleeing(citizen)) return false;
    btTick(fleeTree, { citizen, game, tick });
    return true;
}
