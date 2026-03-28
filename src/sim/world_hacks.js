/**
 * World Hack Effects — makes hack actions physically affect the game world
 * Reads world.blackouts, world.trafficSwitches from game state and applies effects.
 */

export class WorldHackEffects {
    constructor(game) {
        this.game = game;
        this._blackoutDistricts = new Set();
        this._trafficFrozenUntil = 0;
        this._cctvDisabledUntil = 0;
    }

    /**
     * Update per tick — apply world hack effects
     */
    update(tick) {
        const world = this.game.state.world || {};

        // Process blackouts
        this._blackoutDistricts.clear();
        if (world.blackouts) {
            for (const b of world.blackouts) {
                if (tick < b.untilTick) {
                    this._blackoutDistricts.add(b.districtId);
                }
            }
            // Clean up expired
            world.blackouts = world.blackouts.filter(b => tick < b.untilTick);
        }

        // Process traffic switches — freeze nearby traffic vehicles
        if (world.trafficSwitches) {
            const vs = this.game.vehicleSystem;
            for (const ts of world.trafficSwitches) {
                if (tick < ts.untilTick && vs) {
                    for (const v of vs.vehicles) {
                        if (v._playerDriven) continue;
                        const dx = v.x - ts.x;
                        const dy = v.y - ts.y;
                        if (Math.sqrt(dx * dx + dy * dy) < 8) {
                            v.speed = 0;
                        }
                    }
                }
            }
            world.trafficSwitches = world.trafficSwitches.filter(t => tick < t.untilTick);
        }

        // CCTV hack reduces police detection range
        if (this._cctvDisabledUntil > tick) {
            // Police units in range lose tracking
            const ps = this.game.policeSystem;
            if (ps) {
                for (const u of ps.units) {
                    if (u.state === 'pursuit') {
                        // Downgrade to search — they lose sight
                        const distToPlayer = Math.abs(u.x - this.game.state.player.x) + Math.abs(u.y - this.game.state.player.y);
                        if (distToPlayer > 10) {
                            u.state = 'search';
                            u.lastKnownX = this.game.state.player.x;
                            u.lastKnownY = this.game.state.player.y;
                            u.searchProgress = 0;
                        }
                    }
                }
            }
        }
    }

    /**
     * Quick-hack: instantly hack the nearest available interactable
     * @returns {{ ok: boolean, node?: object, action?: string }}
     */
    quickHack() {
        const game = this.game;
        const px = game.player.wx ?? game.player.x;
        const py = game.player.wz ?? game.player.y;
        const tick = game.state.time.tick;

        const im = game.interactables;
        if (!im) return { ok: false, reason: 'No interactables' };

        // Find nearest available node within range
        const range = 6;
        let best = null;
        let bestDist = range;

        for (const node of im.interactables || []) {
            if (node.state !== 'available') continue;
            const dx = node.x - px;
            const dy = node.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                best = node;
            }
        }

        if (!best) return { ok: false, reason: 'No hackable node nearby' };

        // Determine effect based on node type
        let action;
        switch (best.type) {
            case 'POWER_SUBSTATION':
                action = 'district_blackout_ping';
                break;
            case 'CCTV_POLE':
                action = 'cctv_disable';
                // Custom effect: disable CCTV for 60 seconds (60 ticks)
                this._cctvDisabledUntil = tick + 60;
                best.state = 'success';
                best.lastUsedTick = tick;
                game.heatSystem?.addHeat?.(-10); // Reduce heat when disabling CCTV
                game.ui?.showMessage?.('CCTV disabled — police LOS reduced', 'success');
                return { ok: true, node: best, action: 'cctv_disable' };
            case 'TELECOM_BOX':
                action = 'traffic_light_switch';
                break;
            default:
                action = 'camera_takeover';
                break;
        }

        // Perform the standard hack action
        const result = im.performHackAction(best, action, tick);
        if (result.ok) {
            best.state = 'success';
            best.lastUsedTick = tick;
            game.ui?.showMessage?.(result.msg || 'Hacked!', 'success');

            // Give rewards
            const rewards = im.getRewards(best);
            if (rewards?.gold) {
                game.state.resources.gold += rewards.gold;
            }

            // Ammo reward for combat nodes
            if (best.type === 'SERVER_RACK' || best.type === 'DATA_VAULT') {
                if (game.combat) {
                    game.combat.addAmmo('pistol', 6);
                    game.ui?.showMessage?.('Found ammo (+6)', 'success');
                }
            }
        }

        return { ok: result.ok, node: best, action };
    }

    /**
     * Check if a district is blacked out
     * @param {number} districtId
     * @returns {boolean}
     */
    isBlackedOut(districtId) {
        return this._blackoutDistricts.has(districtId);
    }

    /**
     * Check if CCTV is disabled
     */
    get isCCTVDisabled() {
        return this._cctvDisabledUntil > (this.game.state.time.tick || 0);
    }
}
