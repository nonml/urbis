import { sequence, selector, condition, action, tick as btTick, SUCCESS } from './bt.js';

const SURRENDER_HEALTH = 20;
const SURRENDER_DURATION = 30;
const SURRENDER_HEAT_REDUCTION = 2;

const surrenderTree = selector(
    sequence(
        condition(ctx => ctx.citizen._sim.surrenderTimer > 0),
        action(ctx => tickSurrender(ctx))
    ),
    action(ctx => endSurrender(ctx))
);

function tickSurrender(ctx) {
    const { citizen, game } = ctx;
    citizen._sim.surrenderTimer--;
    if (citizen._sim.surrenderTimer <= 0) {
        citizen._sim.surrendered = false;
        game.heatSystem?.addHeat(-SURRENDER_HEAT_REDUCTION);
    }
    return SUCCESS;
}

function endSurrender(ctx) {
    ctx.citizen._sim.surrendered = false;
    ctx.citizen._sim.surrenderTimer = 0;
    ctx.citizen._sim.engState = null;
    ctx.citizen._sim.engCover = null;
    return SUCCESS;
}

export function checkSurrender(citizen, game) {
    if (citizen._sim?.surrendered) return true;
    if (!citizen._sim?.engState) return false;
    const health = citizen.health ?? 100;
    if (health > SURRENDER_HEALTH) return false;
    citizen._sim.surrendered = true;
    citizen._sim.surrenderTimer = SURRENDER_DURATION;
    citizen._sim.engState = null;
    citizen._sim.engCover = null;
    citizen._sim.engFireTimer = 0;
    citizen._sim.engDuckTimer = 0;
    return true;
}

export function isSurrendered(citizen) {
    return citizen._sim?.surrendered === true;
}

export function tickSurrenderTree(citizen, game, tick) {
    if (!isSurrendered(citizen)) return false;
    btTick(surrenderTree, { citizen, game, tick });
    return true;
}
