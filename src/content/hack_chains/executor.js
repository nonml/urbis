/**
 * Hack Chain Executor — runs a validated chain definition step-by-step,
 * scheduling each action at the correct tick offset.
 */

export class HackChainExecutor {
    constructor(game) {
        this.game = game;
        this._pending = [];
        this._cooldowns = new Map();
    }

    execute(chain, originX, originY) {
        const tick = this.game.state?.time?.tick ?? 0;
        const cdUntil = this._cooldowns.get(chain.id) ?? 0;
        if (tick < cdUntil) {
            return { ok: false, reason: 'Chain on cooldown' };
        }

        for (const step of chain.steps) {
            this._pending.push({
                action: step.action,
                x: originX + (step.offsetX || 0),
                y: originY + (step.offsetY || 0),
                fireTick: tick + (step.delay || 0),
            });
        }

        this._cooldowns.set(chain.id, tick + (chain.cooldown || 60));
        return { ok: true, stepsQueued: chain.steps.length };
    }

    update(tick) {
        const wh = this.game.worldHacks;
        if (!wh) return;

        const remaining = [];
        for (const p of this._pending) {
            if (tick >= p.fireTick) {
                this._fireAction(wh, p);
            } else {
                remaining.push(p);
            }
        }
        this._pending = remaining;
    }

    _fireAction(wh, p) {
        switch (p.action) {
            case 'steam_pipe':
                wh.hackSteamPipe(p.x, p.y);
                break;
            case 'crane_drop':
                wh.hackCraneDrop(p.x, p.y);
                break;
            case 'traffic_lights':
                wh.hackTrafficLights(p.x, p.y);
                break;
            case 'barrier':
                wh.raiseBarrier(p.x, p.y);
                break;
            case 'explosion_steam':
            case 'explosion_electrical':
            case 'explosion_gas':
                wh.triggerEnvironmentalExplosion(
                    p.x, p.y,
                    p.action.replace('explosion_', '')
                );
                break;
            case 'blackout':
                wh.hackTrafficLights(p.x, p.y);
                break;
            case 'cctv_disable': {
                const tick = this.game.state?.time?.tick ?? 0;
                wh._cctvDisabledUntil = tick + 60;
                break;
            }
        }
    }

    get pendingCount() {
        return this._pending.length;
    }

    serialize() {
        return {
            pending: this._pending.slice(),
            cooldowns: Array.from(this._cooldowns.entries()),
        };
    }

    deserialize(data) {
        if (!data) return;
        this._pending = data.pending || [];
        this._cooldowns = new Map(data.cooldowns || []);
    }
}
