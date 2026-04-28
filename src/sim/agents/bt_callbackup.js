import { sequence, condition, action, tick as btTick, SUCCESS } from './bt.js';

const BACKUP_COOLDOWN = 90;
const BACKUP_RANGE = 15;
const BACKUP_UNITS = 2;
const CALL_CHANCE = 0.08;

let _lastBackupTick = -Infinity;

const callbackupTree = sequence(
    condition(ctx => canCallBackup(ctx)),
    action(ctx => callBackup(ctx))
);

function canCallBackup(ctx) {
    const { citizen, game, tick } = ctx;
    if (tick - _lastBackupTick < BACKUP_COOLDOWN) return false;
    if (!citizen._sim?.engState) return false;
    if (!game.policeSystem) return false;
    const px = game.player?.x ?? 0;
    const py = game.player?.y ?? 0;
    const dx = citizen.x - px;
    const dy = citizen.y - py;
    if (Math.sqrt(dx * dx + dy * dy) > BACKUP_RANGE) return false;
    return game.rng.next() < CALL_CHANCE;
}

function callBackup(ctx) {
    const { game, tick } = ctx;
    game.policeSystem.spawnNearPlayer(BACKUP_UNITS);
    game.heatSystem?.addHeat(5);
    _lastBackupTick = tick;
    return SUCCESS;
}

export function tryCallBackup(citizen, game, tick) {
    if (!citizen._sim?.engState) return false;
    const ctx = { citizen, game, tick };
    const result = btTick(callbackupTree, ctx);
    return result === SUCCESS;
}

export function resetBackupCooldown() {
    _lastBackupTick = -Infinity;
}
