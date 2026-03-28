/**
 * Player Combat System
 * Handles weapons (pistol + melee), aiming, firing, ammo, and heat generation.
 */

import { eventBus, EVENT_TYPES } from '../sim/events.js';

export const WEAPONS = {
    fist: {
        name: 'Fists',
        damage: 10,
        range: 2,       // tiles
        fireRate: 500,   // ms between attacks
        ammo: Infinity,
        heatGain: 5,
        type: 'melee'
    },
    pistol: {
        name: 'Pistol',
        damage: 25,
        range: 15,       // tiles
        fireRate: 300,    // ms between shots
        ammo: 12,
        maxAmmo: 60,
        heatGain: 15,
        type: 'ranged'
    }
};

export class CombatSystem {
    constructor(game) {
        this.game = game;
        this.currentWeapon = 'fist';
        this.ammo = { pistol: 12 };
        this._lastFireTime = 0;
        this._muzzleFlash = false;
        this._muzzleFlashTimer = 0;
    }

    get weapon() {
        return WEAPONS[this.currentWeapon];
    }

    /**
     * Switch to next weapon
     */
    cycleWeapon() {
        const keys = Object.keys(WEAPONS);
        const idx = keys.indexOf(this.currentWeapon);
        this.currentWeapon = keys[(idx + 1) % keys.length];
        this.game.ui?.showMessage?.(`Equipped: ${this.weapon.name}`, 'normal');
    }

    /**
     * Attempt to fire/attack
     * @param {number} targetX - Target tile X (from mouse raycast)
     * @param {number} targetY - Target tile Y (from mouse raycast)
     * @returns {{ hit: boolean, target?: object }}
     */
    fire(targetX, targetY) {
        const now = performance.now();
        if (now - this._lastFireTime < this.weapon.fireRate) return { hit: false };

        // Check ammo
        if (this.weapon.type === 'ranged') {
            const ammoKey = this.currentWeapon;
            if ((this.ammo[ammoKey] || 0) <= 0) {
                this.game.ui?.showMessage?.('No ammo!', 'warning');
                return { hit: false };
            }
            this.ammo[ammoKey]--;
        }

        this._lastFireTime = now;

        const player = this.game.state.player;
        const px = player.wx ?? player.x;
        const py = player.wz ?? player.y;

        // Add heat
        const heat = this.weapon.heatGain;
        if (this.game.heatSystem) {
            this.game.heatSystem.addHeat(heat);
        }

        // Muzzle flash
        if (this.weapon.type === 'ranged') {
            this._muzzleFlash = true;
            this._muzzleFlashTimer = 80;
        }

        // Emit gunshot event for NPC reactions
        try {
            eventBus.emit(EVENT_TYPES.PLAYER_FIRED_WEAPON, { x: px, y: py, weapon: this.currentWeapon });
        } catch {}

        // Find target — check citizens within range along the aim direction
        const range = this.weapon.range;
        const dx = targetX - px;
        const dy = targetY - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > range) return { hit: false };

        // Check citizens for hit
        const citizens = this.game.citizens?.citizens || [];
        let bestHit = null;
        let bestDist = range;

        for (const c of citizens) {
            const cx = c.x ?? 0;
            const cy = c.y ?? 0;
            const cdx = cx - px;
            const cdy = cy - py;
            const cDist = Math.sqrt(cdx * cdx + cdy * cdy);

            if (cDist > range) continue;

            // For melee, just check proximity
            if (this.weapon.type === 'melee') {
                if (cDist < bestDist) {
                    bestDist = cDist;
                    bestHit = c;
                }
                continue;
            }

            // For ranged, check if citizen is near the aim line
            // Project citizen position onto aim vector
            const aimNormX = dx / dist;
            const aimNormY = dy / dist;
            const dot = cdx * aimNormX + cdy * aimNormY;
            if (dot < 0) continue; // behind player

            // Perpendicular distance from aim line
            const perpDist = Math.abs(cdx * aimNormY - cdy * aimNormX);
            if (perpDist < 1.0 && dot < bestDist) {
                bestDist = dot;
                bestHit = c;
            }
        }

        // Also check traffic vehicles for ranged hits
        if (this.weapon.type === 'ranged' && this.game.vehicleSystem) {
            for (const v of this.game.vehicleSystem.vehicles) {
                const vdx = v.x - px;
                const vdy = v.y - py;
                const vDist = Math.sqrt(vdx * vdx + vdy * vdy);
                if (vDist > range) continue;

                const aimNormX = dx / dist;
                const aimNormY = dy / dist;
                const dot = vdx * aimNormX + vdy * aimNormY;
                if (dot < 0) continue;

                const perpDist = Math.abs(vdx * aimNormY - vdy * aimNormX);
                if (perpDist < 1.5 && dot < bestDist) {
                    bestDist = dot;
                    bestHit = v;
                    bestHit._isVehicle = true;
                }
            }
        }

        if (bestHit) {
            if (bestHit._isVehicle) {
                bestHit.health = (bestHit.health || 100) - this.weapon.damage;
                delete bestHit._isVehicle;
            }
            return { hit: true, target: bestHit };
        }

        return { hit: false };
    }

    /**
     * Add ammo (from pickups, hack rewards, etc.)
     * @param {string} weapon - Weapon key
     * @param {number} amount - Rounds to add
     */
    addAmmo(weapon, amount) {
        const max = WEAPONS[weapon]?.maxAmmo || 60;
        this.ammo[weapon] = Math.min(max, (this.ammo[weapon] || 0) + amount);
    }

    /**
     * Update per frame (muzzle flash timer)
     * @param {number} dt - Frame delta in ms
     */
    update(dt) {
        if (this._muzzleFlashTimer > 0) {
            this._muzzleFlashTimer -= dt;
            if (this._muzzleFlashTimer <= 0) {
                this._muzzleFlash = false;
            }
        }
    }

    /**
     * Get current ammo count for HUD
     */
    getAmmoDisplay() {
        if (this.weapon.ammo === Infinity) return '\u221E'; // infinity symbol
        return this.ammo[this.currentWeapon] || 0;
    }
}
