/**
 * Player Combat System
 * Handles weapons (pistol + melee), aiming, firing, ammo, and heat generation.
 */

import { eventBus, EVENT_TYPES } from '../sim/events.js';

export const WEAPONS = {
    fist: {
        name: 'Fists',
        damage: 10,
        range: 2,
        fireRate: 500,
        ammo: Infinity,
        heatGain: 5,
        type: 'melee',
        spread: 0,
        pellets: 1,
        recoilGain: 0,
        recoilMax: 0,
        recoilRecovery: 0,
        adsFov: 0,
        adsSpreadMul: 1,
    },
    bat: {
        name: 'Baseball Bat',
        damage: 22,
        range: 2.5,
        fireRate: 600,
        ammo: Infinity,
        heatGain: 8,
        type: 'melee',
        spread: 0,
        pellets: 1,
        knockback: 1.5,
        recoilGain: 0,
        recoilMax: 0,
        recoilRecovery: 0,
        adsFov: 0,
        adsSpreadMul: 1,
    },
    pistol: {
        name: 'Pistol',
        damage: 25,
        range: 15,
        fireRate: 300,
        ammo: 12,
        maxAmmo: 60,
        heatGain: 15,
        type: 'ranged',
        spread: 0.5,
        pellets: 1,
        soundRadius: 12,
        recoilGain: 1.2,
        recoilMax: 4.0,
        recoilRecovery: 3.0,
        adsFov: 50,
        adsSpreadMul: 0.4,
    },
    shotgun: {
        name: 'Shotgun',
        damage: 12,
        range: 8,
        fireRate: 800,
        ammo: 6,
        maxAmmo: 30,
        heatGain: 20,
        type: 'ranged',
        spread: 8,
        pellets: 6,
        knockback: 2.0,
        soundRadius: 18,
        recoilGain: 3.5,
        recoilMax: 8.0,
        recoilRecovery: 5.0,
        adsFov: 55,
        adsSpreadMul: 0.7,
    },
    smg: {
        name: 'SMG',
        damage: 12,
        range: 12,
        fireRate: 80,
        ammo: 30,
        maxAmmo: 120,
        heatGain: 8,
        type: 'ranged',
        spread: 3,
        pellets: 1,
        soundRadius: 14,
        recoilGain: 0.8,
        recoilMax: 6.0,
        recoilRecovery: 2.0,
        adsFov: 50,
        adsSpreadMul: 0.5,
    },
};

export class CombatSystem {
    constructor(game) {
        this.game = game;
        this.currentWeapon = 'fist';
        this.ammo = { pistol: 12 };
        this.reserve = { pistol: 48, shotgun: 24, smg: 90 };
        this._lastFireTime = 0;
        this._muzzleFlash = false;
        this._muzzleFlashTimer = 0;
        this._reloading = false;
        this._reloadTimer = 0;
        this._reloadDuration = 0;
        this._recoilLevel = 0;
        this._adsActive = false;
        this._adsFov = 0;
    }

    get weapon() {
        return WEAPONS[this.currentWeapon];
    }

    /**
     * Switch to a specific weapon by key
     * @param {string} key - Weapon key from WEAPONS
     */
    setWeapon(key) {
        if (WEAPONS[key]) {
            this.currentWeapon = key;
            this._adsActive = false;
            this._recoilLevel = 0;
            this.game.ui?.showMessage?.(`Equipped: ${this.weapon.name}`, 'normal');
        }
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
        if (this._reloading) return { hit: false };
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

        // Find targets — multiple pellets for shotgun, single for others
        const range = this.weapon.range;
        const dx = targetX - px;
        const dy = targetY - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > range && this.weapon.type === 'melee') return { hit: false };

        const pellets = this.weapon.pellets || 1;
        const adsMul = this._adsActive ? (this.weapon.adsSpreadMul || 1) : 1;
        const baseSpread = ((this.weapon.spread || 0) + this._recoilLevel) * adsMul;
        const spread = baseSpread * (Math.PI / 180);
        const baseAngle = Math.atan2(dx, -dy);
        const hits = [];

        for (let p = 0; p < pellets; p++) {
            // Apply random spread per pellet
            const angle = baseAngle + (this.game.rng.next() - 0.5) * spread;
            const aimX = Math.sin(angle);
            const aimY = -Math.cos(angle);

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

                if (this.weapon.type === 'melee') {
                    if (cDist < bestDist) { bestDist = cDist; bestHit = c; }
                    continue;
                }

                const dot = cdx * aimX + cdy * aimY;
                if (dot < 0) continue;
                const perpDist = Math.abs(cdx * aimY - cdy * aimX);
                if (perpDist < 1.0 && dot < bestDist) {
                    bestDist = dot; bestHit = c;
                }
            }

            // Check traffic vehicles for ranged hits
            if (this.weapon.type === 'ranged' && this.game.vehicleSystem) {
                for (const v of this.game.vehicleSystem.vehicles) {
                    const vdx = v.x - px;
                    const vdy = v.y - py;
                    const vDist = Math.sqrt(vdx * vdx + vdy * vdy);
                    if (vDist > range) continue;
                    const dot = vdx * aimX + vdy * aimY;
                    if (dot < 0) continue;
                    const perpDist = Math.abs(vdx * aimY - vdy * aimX);
                    if (perpDist < 1.5 && dot < bestDist) {
                        bestDist = dot; bestHit = v; bestHit._isVehicle = true;
                    }
                }
            }

            if (bestHit) {
                if (bestHit._isVehicle) {
                    bestHit.health = (bestHit.health || 100) - this.weapon.damage;
                    delete bestHit._isVehicle;
                }
                // Knockback
                if (this.weapon.knockback && bestHit.x !== undefined) {
                    bestHit.x += aimX * this.weapon.knockback * 0.3;
                    bestHit.y += aimY * this.weapon.knockback * 0.3;
                }
                hits.push(bestHit);
            }
        }

        // Emit weapon fired event with hit results for VFX + NPC reactions
        try {
            eventBus.emit(EVENT_TYPES.PLAYER_FIRED_WEAPON, {
                x: px, y: py, weapon: this.currentWeapon,
                hit: hits.length > 0,
                damage: this.weapon.damage,
                hits: hits.map(h => ({ x: h.x ?? 0, y: h.y ?? 0 })),
                targetX, targetY
            });
        } catch {}

        const rg = this.weapon.recoilGain || 0;
        const rm = this.weapon.recoilMax || 0;
        this._recoilLevel = Math.min(rm, this._recoilLevel + rg);

        if (hits.length > 0) {
            return { hit: true, target: hits[0], allHits: hits, pelletCount: pellets };
        }
        return { hit: false };
    }

    /**
     * Add ammo (from pickups, hack rewards, etc.)
     * @param {string} weapon - Weapon key
     * @param {number} amount - Rounds to add
     */
    reload() {
        if (this._reloading) return;
        if (this.weapon.ammo === Infinity) return;
        const key = this.currentWeapon;
        const clipMax = this.weapon.ammo;
        const current = this.ammo[key] || 0;
        const res = this.reserve[key] || 0;
        if (current >= clipMax || res <= 0) return;

        this._reloading = true;
        this._reloadDuration = this.weapon.type === 'ranged' ? (this.weapon.fireRate * 3) : 500;
        this._reloadTimer = this._reloadDuration;
        this.game.ui?.showMessage?.('Reloading...', 'normal');
    }

    _finishReload() {
        const key = this.currentWeapon;
        const clipMax = this.weapon.ammo;
        const current = this.ammo[key] || 0;
        const res = this.reserve[key] || 0;
        const needed = clipMax - current;
        const transfer = Math.min(needed, res);
        this.ammo[key] = current + transfer;
        this.reserve[key] = res - transfer;
        this._reloading = false;
    }

    get isReloading() {
        return this._reloading;
    }

    get reloadProgress() {
        if (!this._reloading || this._reloadDuration <= 0) return 0;
        return 1 - (this._reloadTimer / this._reloadDuration);
    }

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
        if (this._recoilLevel > 0) {
            const recovery = (this.weapon.recoilRecovery || 2.0) * (dt / 1000);
            this._recoilLevel = Math.max(0, this._recoilLevel - recovery);
        }
        const targetFov = this._adsActive ? (this.weapon.adsFov || 60) : 0;
        const fovRate = 8 * (dt / 1000);
        this._adsFov += (targetFov - this._adsFov) * Math.min(1, fovRate);
        if (this._reloading && this._reloadTimer > 0) {
            this._reloadTimer -= dt;
            if (this._reloadTimer <= 0) {
                this._finishReload();
            }
        }
    }

    get recoilLevel() {
        return this._recoilLevel;
    }

    toggleADS() {
        if (this.weapon.type !== 'ranged') return;
        this._adsActive = !this._adsActive;
    }

    get isADS() {
        return this._adsActive && this.weapon.type === 'ranged';
    }

    get adsFovTarget() {
        if (!this._adsActive) return 0;
        return this.weapon.adsFov || 0;
    }

    getAmmoDisplay() {
        if (this.weapon.ammo === Infinity) return '∞';
        const clip = this.ammo[this.currentWeapon] || 0;
        const res = this.reserve[this.currentWeapon] || 0;
        return `${clip} / ${res}`;
    }
}
