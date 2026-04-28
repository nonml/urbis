import { sequence, selector, condition, action, tick as btTick, SUCCESS, FAILURE } from './bt.js';
import { eventBus, EVENT_TYPES } from '../events.js';

const ENGAGE_RADIUS = 10;
const FIRE_TICKS = 3;
const DUCK_TICKS = 5;
const NPC_DAMAGE = 8;
const NPC_FIRE_RANGE = 12;
const DISENGAGE_DIST = 25;

const engagedTree = selector(
    sequence(
        condition(ctx => ctx.citizen._sim.engCover != null),
        selector(
            sequence(condition(ctx => ctx.citizen._sim.engFireTimer > 0), action(ctx => tickFire(ctx))),
            sequence(condition(ctx => ctx.citizen._sim.engDuckTimer > 0), action(ctx => tickDuck(ctx))),
            action(ctx => startFireCycle(ctx))
        )
    ),
    sequence(
        condition(ctx => hasCoverNearby(ctx)),
        action(ctx => seekCover(ctx))
    ),
    action(ctx => strafeAndFire(ctx))
);

let _pendingHits = [];

export function initEngagedSystem() {
    eventBus.on(EVENT_TYPES.PLAYER_FIRED_WEAPON, (data) => {
        if (data.hits) {
            for (const h of data.hits) _pendingHits.push({ x: h.x, y: h.y });
        }
        _pendingHits.push({ x: data.x, y: data.y, area: true });
        if (_pendingHits.length > 16) _pendingHits.length = 16;
    });
}

export function flushEngagedHits(citizens, game) {
    if (_pendingHits.length === 0) return;
    const px = game.player?.x ?? 0;
    const py = game.player?.y ?? 0;
    for (const hit of _pendingHits) {
        markEngaged(citizens, hit.x, hit.y, px, py, hit.area);
    }
    _pendingHits.length = 0;
}

function markEngaged(citizens, hx, hy, px, py, isArea) {
    const radius = isArea ? ENGAGE_RADIUS : 2;
    for (const c of citizens) {
        if (!c._sim || c._sim.engState) continue;
        const dx = (c.x ?? 0) - hx;
        const dy = (c.y ?? 0) - hy;
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        c._sim.engState = 'active';
        c._sim.engThreatX = px;
        c._sim.engThreatY = py;
    }
}

function hasCoverNearby(ctx) {
    const cs = ctx.game.coverSystem;
    if (!cs) return false;
    const c = ctx.citizen;
    const cp = cs.findCoverFor(c.x, c.y, c._sim.engThreatX, c._sim.engThreatY, 6);
    if (cp) ctx._coverPoint = cp;
    return cp != null;
}

function seekCover(ctx) {
    const cp = ctx._coverPoint;
    if (!cp) return SUCCESS;
    const c = ctx.citizen;
    moveToward(c, cp.x, cp.y, ctx.game);
    if (Math.abs(c.x - cp.x) + Math.abs(c.y - cp.y) <= 1) {
        c._sim.engCover = cp;
        c._sim.engDuckTimer = DUCK_TICKS;
        c._sim.engFireTimer = 0;
    }
    return SUCCESS;
}

function startFireCycle(ctx) {
    ctx.citizen._sim.engFireTimer = FIRE_TICKS;
    ctx.citizen._sim.engDuckTimer = 0;
    return SUCCESS;
}

function tickFire(ctx) {
    const c = ctx.citizen;
    c._sim.engFireTimer--;
    const px = ctx.game.player?.x ?? 0;
    const py = ctx.game.player?.y ?? 0;
    c._sim.engThreatX = px;
    c._sim.engThreatY = py;
    const dist = Math.sqrt((c.x - px) ** 2 + (c.y - py) ** 2);
    if (dist < NPC_FIRE_RANGE && ctx.game.rng.next() < 0.3) {
        ctx.game.playerHealth?.takeDamage(NPC_DAMAGE, 'npc_gunfire');
    }
    if (c._sim.engFireTimer <= 0) {
        c._sim.engDuckTimer = DUCK_TICKS;
    }
    return SUCCESS;
}

function tickDuck(ctx) {
    ctx.citizen._sim.engDuckTimer--;
    if (ctx.citizen._sim.engDuckTimer <= 0) {
        ctx.citizen._sim.engFireTimer = FIRE_TICKS;
    }
    return SUCCESS;
}

function strafeAndFire(ctx) {
    const c = ctx.citizen;
    const px = ctx.game.player?.x ?? 0;
    const py = ctx.game.player?.y ?? 0;
    c._sim.engThreatX = px;
    c._sim.engThreatY = py;
    const dx = px - c.x;
    const dy = py - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > DISENGAGE_DIST) {
        c._sim.engState = null;
        c._sim.engCover = null;
        return SUCCESS;
    }

    const perpX = -dy;
    const perpY = dx;
    const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
    const dir = ctx.game.rng.next() < 0.5 ? 1 : -1;
    const nx = c.x + Math.round(dir * perpX / len);
    const ny = c.y + Math.round(dir * perpY / len);
    if (ctx.game.scheduleManager?.isWalkable(nx, ny)) {
        c.x = nx;
        c.y = ny;
    }

    if (dist < NPC_FIRE_RANGE && ctx.game.rng.next() < 0.2) {
        ctx.game.playerHealth?.takeDamage(NPC_DAMAGE, 'npc_gunfire');
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

export function isEngaged(citizen) {
    return citizen._sim?.engState != null;
}

export function tickEngaged(citizen, game, tick) {
    if (!citizen._sim?.engState) return false;
    const ctx = { citizen, game, tick };
    btTick(engagedTree, ctx);
    return true;
}
