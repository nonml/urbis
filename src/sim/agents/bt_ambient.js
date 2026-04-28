import { sequence, selector, condition, action, tick as btTick, SUCCESS } from './bt.js';

const CHAT_DURATION = 8;
const CHAT_PROXIMITY = 3;
const CHAT_CHANCE = 0.15;

const ambientTree = selector(
    sequence(
        condition(ctx => ctx.citizen._sim.chatTimer > 0),
        action(ctx => tickChat(ctx))
    ),
    sequence(
        condition(ctx => isAtDestination(ctx)),
        condition(ctx => maybeStartChat(ctx)),
        action(ctx => beginChat(ctx))
    ),
    action(ctx => walkToSchedule(ctx))
);

function isAtDestination(ctx) {
    const { citizen, game, timeOfDay } = ctx;
    const phase = game.scheduleManager.getPhaseAt(timeOfDay);
    const target = game.scheduleManager.getTargetLocation(
        citizen, phase, game.map, game.buildings
    );
    if (!target) return true;
    return citizen.x === target.x && citizen.y === target.y;
}

function findNearbyIdlePeer(ctx) {
    const { citizen, game } = ctx;
    const citizens = game.citizens?.citizens;
    if (!citizens) return null;
    for (const other of citizens) {
        if (other.id === citizen.id) continue;
        if (other._sim?.chatTimer > 0) continue;
        const dx = Math.abs(other.x - citizen.x);
        const dy = Math.abs(other.y - citizen.y);
        if (dx + dy <= CHAT_PROXIMITY) return other;
    }
    return null;
}

function maybeStartChat(ctx) {
    const peer = findNearbyIdlePeer(ctx);
    if (!peer) return false;
    ctx._chatPeer = peer;
    return ctx.game.rng.next() < CHAT_CHANCE;
}

function beginChat(ctx) {
    const { citizen } = ctx;
    const peer = ctx._chatPeer;
    if (!peer) return SUCCESS;
    citizen._sim.chatTimer = CHAT_DURATION;
    citizen._sim.chatPartnerId = peer.id;
    peer._sim.chatTimer = CHAT_DURATION;
    peer._sim.chatPartnerId = citizen.id;
    return SUCCESS;
}

function tickChat(ctx) {
    ctx.citizen._sim.chatTimer--;
    if (ctx.citizen._sim.chatTimer <= 0) {
        ctx.citizen._sim.chatPartnerId = null;
    }
    return SUCCESS;
}

function walkToSchedule(ctx) {
    const { citizen, game, timeOfDay } = ctx;
    const result = game.scheduleManager.updateCitizenSchedule(
        citizen,
        { map: game.map, buildings: game.buildings },
        timeOfDay
    );
    updateStuckState(citizen, game);
    if (!result.moved && citizen._sim.stuckTicks > 6) {
        nudgeStuck(citizen, game);
    }
    return SUCCESS;
}

function updateStuckState(citizen, game) {
    if (citizen.x === citizen._sim.lastX && citizen.y === citizen._sim.lastY) {
        citizen._sim.stuckTicks++;
    } else {
        citizen._sim.stuckTicks = 0;
    }
    citizen._sim.lastX = citizen.x;
    citizen._sim.lastY = citizen.y;
}

function nudgeStuck(citizen, game) {
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (const dir of dirs) {
        const nx = citizen.x + dir.x;
        const ny = citizen.y + dir.y;
        if (game.scheduleManager.isWalkable(nx, ny)) {
            citizen.x = nx;
            citizen.y = ny;
            citizen._sim.stuckTicks = 0;
            return;
        }
    }
}

export function tickAmbient(citizen, game, timeOfDay, tick, tier) {
    if (tier === 'far' && (tick % 4 !== 0)) return;
    if (tier === 'mid' && (tick % 2 !== 0)) return;
    const ctx = { citizen, game, timeOfDay, tick, tier };
    btTick(ambientTree, ctx);
}
