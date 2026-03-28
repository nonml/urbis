/**
 * NPC Reaction System
 * Citizens flee from gunshots, dodge fast vehicles, and report crimes to police.
 */

import { eventBus, EVENT_TYPES } from '../events.js';

const GUNSHOT_FLEE_RADIUS = 12;  // tiles
const VEHICLE_DODGE_RADIUS = 3;  // tiles
const VEHICLE_DODGE_SPEED = 5;   // min vehicle speed to trigger dodge
const FLEE_DURATION = 8;         // ticks before calming down
const REPORT_CHANCE = 0.10;      // 10% chance per fleeing citizen per tick to report
const FLEE_SPEED = 0.8;          // tiles per update

export class NPCReactionSystem {
    constructor(game) {
        this.game = game;
        this._reactions = new Map(); // citizenId -> { state, fleeX, fleeY, timer }

        // Listen for weapon fire events
        eventBus.on(EVENT_TYPES.PLAYER_FIRED_WEAPON, (data) => {
            this._onGunshot(data.x, data.y);
        });
    }

    /**
     * Handle gunshot — nearby citizens flee
     */
    _onGunshot(shotX, shotY) {
        const citizens = this.game.citizens?.citizens || [];
        for (const c of citizens) {
            const dx = (c.x ?? 0) - shotX;
            const dy = (c.y ?? 0) - shotY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < GUNSHOT_FLEE_RADIUS) {
                // Flee away from the shot
                const angle = Math.atan2(dy, dx);
                const fleeX = (c.x ?? 0) + Math.cos(angle) * 8;
                const fleeY = (c.y ?? 0) + Math.sin(angle) * 8;

                this._reactions.set(c.id, {
                    state: 'fleeing',
                    fleeX,
                    fleeY,
                    timer: FLEE_DURATION,
                    reported: false
                });
            }
        }
    }

    /**
     * Check for fast vehicles near citizens and make them dodge
     */
    _checkVehicleDodge() {
        const vs = this.game.vehicleSystem;
        if (!vs) return;

        const citizens = this.game.citizens?.citizens || [];

        for (const v of vs.vehicles) {
            const speed = v.speed || 0;
            if (speed < VEHICLE_DODGE_SPEED) continue;

            for (const c of citizens) {
                if (this._reactions.has(c.id)) continue; // already reacting

                const dx = (c.x ?? 0) - v.x;
                const dy = (c.y ?? 0) - v.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < VEHICLE_DODGE_RADIUS) {
                    // Dodge perpendicular to vehicle direction
                    const vAngle = v.angle ?? 0;
                    const dodgeAngle = vAngle + Math.PI / 2 * (dx * Math.cos(vAngle) + dy * Math.sin(vAngle) > 0 ? 1 : -1);
                    const fleeX = (c.x ?? 0) + Math.cos(dodgeAngle) * 3;
                    const fleeY = (c.y ?? 0) + Math.sin(dodgeAngle) * 3;

                    this._reactions.set(c.id, {
                        state: 'dodging',
                        fleeX,
                        fleeY,
                        timer: 3,
                        reported: false
                    });
                }
            }
        }
    }

    /**
     * Update reactions per tick — move fleeing citizens, handle reporting
     */
    update() {
        this._checkVehicleDodge();

        for (const [citizenId, reaction] of this._reactions) {
            const citizen = this.game.citizens?.citizens?.find(c => c.id === citizenId);
            if (!citizen) {
                this._reactions.delete(citizenId);
                continue;
            }

            // Move toward flee target
            const dx = reaction.fleeX - (citizen.x ?? 0);
            const dy = reaction.fleeY - (citizen.y ?? 0);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0.5) {
                const moveX = (dx / dist) * FLEE_SPEED;
                const moveY = (dy / dist) * FLEE_SPEED;
                const newX = (citizen.x ?? 0) + moveX;
                const newY = (citizen.y ?? 0) + moveY;

                // Clamp to map bounds
                citizen.x = Math.max(0, Math.min(this.game.map.width - 1, Math.round(newX)));
                citizen.y = Math.max(0, Math.min(this.game.map.height - 1, Math.round(newY)));
            }

            // Report to police (adds heat)
            if (!reaction.reported && reaction.state === 'fleeing' && Math.random() < REPORT_CHANCE) {
                reaction.reported = true;
                if (this.game.heatSystem) {
                    this.game.heatSystem.addHeat(3);
                }
            }

            // Timer countdown
            reaction.timer--;
            if (reaction.timer <= 0) {
                this._reactions.delete(citizenId);
            }
        }
    }

    /**
     * Get reaction state for a citizen (for rendering)
     * @param {number} citizenId
     * @returns {string|null} 'fleeing', 'dodging', or null
     */
    getReaction(citizenId) {
        return this._reactions.get(citizenId)?.state || null;
    }

    /**
     * Count of currently reacting citizens
     */
    get activeCount() {
        return this._reactions.size;
    }
}
