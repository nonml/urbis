/**
 * World Hack Effects — makes hack actions physically affect the game world
 * Reads world.blackouts, world.trafficSwitches from game state and applies effects.
 * Phase 5: adds traffic light chaos, barriers, environmental explosions, NPC profiler.
 */

import { eventBus, EVENT_TYPES } from './events.js';

export class WorldHackEffects {
    constructor(game) {
        this.game = game;
        this._blackoutDistricts = new Set();
        this._trafficFrozenUntil = 0;
        this._cctvDisabledUntil = 0;

        // Traffic light hacking state
        this._trafficLightChaos = []; // { x, y, untilTick }
        // Barrier state
        this._raisedBarriers = [];    // { x, y, untilTick }
        // Environmental explosions
        this._explosions = [];         // { x, y, radius, tick }
        // Quick-hack cooldowns per category
        this._cooldowns = new Map();   // hackType -> untilTick
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

        // Clean up expired traffic light chaos / barriers / explosions
        this._trafficLightChaos = this._trafficLightChaos.filter(t => tick < t.untilTick);
        this._raisedBarriers = this._raisedBarriers.filter(b => tick < b.untilTick);
        this._explosions = this._explosions.filter(e => tick - e.tick < 10);

        // Barrier enforcement: keep blocking vehicles each tick
        for (const barrier of this._raisedBarriers) {
            const vs = this.game.vehicleSystem;
            if (!vs) break;
            for (const v of vs.vehicles) {
                if (v._playerDriven) continue;
                const dx = v.x - barrier.x;
                const dy = v.y - barrier.y;
                if (Math.sqrt(dx * dx + dy * dy) < 2.5) {
                    v.speed = 0;
                }
            }
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

    // ── Phase 5: World-Affecting Hacks ──────────────────────────────────

    /**
     * Hack traffic lights — all lights at intersection go green, causing NPC vehicle collisions
     * @param {number} x - Intersection tile X
     * @param {number} y - Intersection tile Y
     */
    hackTrafficLights(x, y) {
        const tick = this.game.state.time.tick;
        if (this._isOnCooldown('traffic_lights', tick)) return { ok: false, reason: 'On cooldown' };

        this._trafficLightChaos.push({ x, y, untilTick: tick + 15, radius: 8 });
        this._setCooldown('traffic_lights', tick, 30);

        // Freeze/confuse NPC vehicles near the intersection
        const vs = this.game.vehicleSystem;
        if (vs) {
            for (const v of vs.vehicles) {
                if (v._playerDriven) continue;
                const dx = v.x - x;
                const dy = v.y - y;
                if (Math.sqrt(dx * dx + dy * dy) < 6) {
                    // Vehicles entering intersection don't stop → collide
                    v.speed = Math.min(v.speed + 3, v.maxSpeed || 15);
                    v._chaosUntil = tick + 10;
                }
            }
        }

        if (this.game.heatSystem) this.game.heatSystem.addHeat(12);
        this.game.ui?.showMessage?.('Traffic lights hacked — chaos at intersection!', 'success');

        try { eventBus.emit(EVENT_TYPES.HACK_SUCCESS, { type: 'traffic_lights', x, y }); } catch {}
        return { ok: true };
    }

    /**
     * Raise a barrier — blocks vehicles at the specified location
     * @param {number} x - Barrier tile X
     * @param {number} y - Barrier tile Y
     */
    raiseBarrier(x, y) {
        const tick = this.game.state.time.tick;
        if (this._isOnCooldown('barrier', tick)) return { ok: false, reason: 'On cooldown' };

        this._raisedBarriers.push({ x, y, untilTick: tick + 30 });
        this._setCooldown('barrier', tick, 45);

        // Stop vehicles at barrier
        const vs = this.game.vehicleSystem;
        if (vs) {
            for (const v of vs.vehicles) {
                if (v._playerDriven) continue;
                const dx = v.x - x;
                const dy = v.y - y;
                if (Math.sqrt(dx * dx + dy * dy) < 3) {
                    v.speed = 0;
                    v._barrierBlocked = true;
                }
            }
        }

        if (this.game.heatSystem) this.game.heatSystem.addHeat(8);
        this.game.ui?.showMessage?.('Barrier raised — road blocked!', 'success');

        try { eventBus.emit(EVENT_TYPES.HACK_SUCCESS, { type: 'barrier', x, y }); } catch {}
        return { ok: true };
    }

    /**
     * Trigger environmental explosion (steam pipe, electrical junction, gas pipe)
     * @param {number} x - Explosion center X
     * @param {number} y - Explosion center Y
     * @param {string} type - 'steam' | 'electrical' | 'gas'
     */
    triggerEnvironmentalExplosion(x, y, type = 'steam') {
        const tick = this.game.state.time.tick;
        if (this._isOnCooldown(`explosion_${type}`, tick)) return { ok: false, reason: 'On cooldown' };

        const config = {
            steam:      { radius: 4, damage: 30, cooldown: 40, heatCost: 15, msg: 'Steam pipe exploded!' },
            electrical: { radius: 3, damage: 40, cooldown: 50, heatCost: 20, msg: 'Electrical junction overloaded!' },
            gas:        { radius: 5, damage: 50, cooldown: 60, heatCost: 25, msg: 'Gas pipe ignited!' },
        }[type] || { radius: 4, damage: 30, cooldown: 40, heatCost: 15, msg: 'Explosion!' };

        this._explosions.push({ x, y, radius: config.radius, tick, type });
        this._setCooldown(`explosion_${type}`, tick, config.cooldown);

        // Damage nearby citizens
        const citizens = this.game.citizens?.citizens || [];
        for (const c of citizens) {
            const dx = (c.x ?? 0) - x;
            const dy = (c.y ?? 0) - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < config.radius) {
                c.health = (c.health ?? 100) - config.damage * (1 - dist / config.radius);
                // Knockback
                if (dist > 0.1) {
                    c.x += (dx / dist) * 1.5;
                    c.y += (dy / dist) * 1.5;
                }
            }
        }

        // Damage nearby vehicles
        const vs = this.game.vehicleSystem;
        if (vs) {
            for (const v of vs.vehicles) {
                const dx = v.x - x;
                const dy = v.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < config.radius) {
                    v.health = (v.health ?? 100) - config.damage * (1 - dist / config.radius);
                }
            }
        }

        if (this.game.heatSystem) this.game.heatSystem.addHeat(config.heatCost);
        this.game.ui?.showMessage?.(config.msg, 'warning');

        try { eventBus.emit(EVENT_TYPES.HACK_SUCCESS, { type: `explosion_${type}`, x, y }); } catch {}
        return { ok: true, config };
    }

    /**
     * Profile an NPC — scan citizen data (income, record, faction alignment)
     * @param {number} citizenId - Citizen ID to profile
     */
    profileNPC(citizenId) {
        const citizens = this.game.citizens?.citizens || [];
        const citizen = citizens.find(c => c.id === citizenId);
        if (!citizen) return { ok: false, reason: 'Citizen not found' };

        // Build profile from existing citizen data
        const profile = {
            name: citizen.name || `Citizen #${citizenId}`,
            occupation: citizen.job || citizen.occupation || 'Unemployed',
            income: citizen.income ?? Math.floor(this.game.rng.next() * 5000) + 1000,
            incomeHistory: Array.isArray(citizen.incomeHistory)
                ? citizen.incomeHistory.slice()
                : new Array(12).fill(0),
            criminalRecord: citizen.criminalRecord || (this.game.rng.next() < 0.15 ? 'Petty theft' : 'None'),
            criminalRecords: Array.isArray(citizen.criminalRecords)
                ? citizen.criminalRecords.slice()
                : [],
            relationsGraph: this._buildRelationsGraph(citizenId),
            weekSchedule: citizen.weekSchedule || null,
            faction: citizen.faction || 'citizens',
            happiness: citizen.happiness ?? 50,
            traits: citizen.traits || [],
        };

        // Intel gain
        const intel = this.game.intelSystem;
        if (intel) {
            intel.addIntel?.({ type: 'profile', targetId: citizenId, data: profile });
        }

        if (this.game.heatSystem) this.game.heatSystem.addHeat(3);
        return { ok: true, profile };
    }

    /**
     * Hack-steal money from a profiled NPC
     * @param {number} citizenId
     */
    hackStealMoney(citizenId) {
        const citizens = this.game.citizens?.citizens || [];
        const citizen = citizens.find(c => c.id === citizenId);
        if (!citizen) return { ok: false, reason: 'Citizen not found' };

        const stolen = Math.floor(this.game.rng.next() * 200) + 50;
        this.game.state.resources.gold += stolen;
        if (this.game.heatSystem) this.game.heatSystem.addHeat(10);
        this.game.ui?.showMessage?.(`Stole $${stolen} from ${citizen.name || 'citizen'}`, 'success');
        return { ok: true, amount: stolen };
    }

    /**
     * Get all active environmental effects for renderer visualization
     */
    getActiveEffects() {
        const tick = this.game.state.time.tick;
        return {
            trafficLightChaos: this._trafficLightChaos.filter(t => tick < t.untilTick),
            raisedBarriers: this._raisedBarriers.filter(b => tick < b.untilTick),
            recentExplosions: this._explosions.filter(e => tick - e.tick < 5),
        };
    }

    // ── Internal helpers ──

    _buildRelationsGraph(citizenId) {
        const sg = this.game.socialGraph;
        if (!sg) return { nodes: [], edges: [] };

        const hop1 = sg.getCitizenConnections(citizenId);
        const nodeSet = new Set([citizenId]);
        const edges = [];
        const citizens = this.game.citizens?.citizens || [];

        for (const c of hop1) {
            nodeSet.add(c.id);
            edges.push({ from: citizenId, to: c.id, type: c.type });
        }

        for (const c of hop1) {
            const hop2 = sg.getCitizenConnections(c.id);
            for (const c2 of hop2) {
                if (c2.id === citizenId) continue;
                nodeSet.add(c2.id);
                edges.push({ from: c.id, to: c2.id, type: c2.type });
            }
        }

        const nodes = [];
        for (const id of nodeSet) {
            const cit = citizens.find(c => c.id === id);
            nodes.push({
                id,
                name: cit?.name || `#${id}`,
                faction: cit?.faction || 'citizens',
            });
        }

        return { nodes, edges };
    }

    _isOnCooldown(hackType, tick) {
        return (this._cooldowns.get(hackType) || 0) > tick;
    }

    _setCooldown(hackType, tick, duration) {
        this._cooldowns.set(hackType, tick + duration);
    }
}
