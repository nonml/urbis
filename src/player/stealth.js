/**
 * Player Stealth System
 * Manages visibility states, crouching, detection modifiers, and stealth kills.
 */

import { eventBus, EVENT_TYPES } from '../sim/events.js';

/** Visibility states */
export const VISIBILITY = {
    EXPOSED: 'exposed',       // full visibility (running, shooting, in light)
    LOW_PROFILE: 'low_profile', // reduced visibility (walking, no weapon drawn)
    HIDDEN: 'hidden',          // near-invisible (crouching at night, behind cover)
};

export class StealthSystem {
    constructor(game) {
        this.game = game;
        this.isCrouching = false;
        this.visibility = VISIBILITY.EXPOSED;
        this._detectionLevel = 0;   // 0-1, how detected the player is
        this._lastNoiseTime = 0;
    }

    /**
     * Toggle crouch state
     */
    toggleCrouch() {
        this.isCrouching = !this.isCrouching;
    }

    /**
     * Set crouch state directly
     */
    setCrouch(crouching) {
        this.isCrouching = crouching;
    }

    /**
     * Get player movement speed modifier based on stealth state
     */
    getSpeedModifier() {
        return this.isCrouching ? 0.5 : 1.0;
    }

    /**
     * Get the detection radius for NPCs based on current state
     * NPCs within this radius may detect the player.
     */
    getDetectionRadius() {
        let base = 8; // tiles — default detection distance

        // Crouching halves detection radius
        if (this.isCrouching) base *= 0.5;

        // Night reduces detection
        const timeOfDay = this.game.state?.time?.timeOfDay ?? 12;
        const isNight = timeOfDay < 6 || timeOfDay > 20;
        const isDuskDawn = (timeOfDay >= 6 && timeOfDay < 8) || (timeOfDay >= 18 && timeOfDay <= 20);
        if (isNight) base *= 0.5;
        else if (isDuskDawn) base *= 0.75;

        // Weapon drawn increases visibility
        const combat = this.game.combatSystem;
        if (combat && combat.currentWeapon !== 'fist') base *= 1.3;

        return base;
    }

    /**
     * Get sound propagation radius for the current weapon
     * NPCs within this radius will hear the shot and react.
     */
    getSoundRadius() {
        const combat = this.game.combatSystem;
        if (!combat) return 0;
        return combat.weapon?.soundRadius || 0;
    }

    /**
     * Check if a silent takedown can be performed on a target
     * Requirements: crouching, behind target, target unaware
     */
    canStealthKill(targetX, targetY, targetFacing) {
        if (!this.isCrouching) return false;
        if (this.visibility === VISIBILITY.EXPOSED) return false;

        const player = this.game.state.player;
        const px = player.wx ?? player.x;
        const py = player.wz ?? player.y;
        const dist = Math.sqrt((targetX - px) ** 2 + (targetY - py) ** 2);

        // Must be within melee range
        if (dist > 2.5) return false;

        // Check if behind target (dot product of approach direction vs target facing)
        if (targetFacing !== undefined) {
            const approachAngle = Math.atan2(targetX - px, -(targetY - py));
            const facingRad = (targetFacing * Math.PI) / 180;
            const dot = Math.cos(approachAngle - facingRad);
            // dot > 0 means approaching from behind
            if (dot < 0.2) return false;
        }

        return true;
    }

    /**
     * Perform a stealth takedown — instant kill with minimal heat
     */
    performStealthKill(target) {
        if (!target) return false;

        // Kill/incapacitate target
        target.health = 0;
        target.incapacitated = true;

        // Minimal heat (silent)
        if (this.game.heatSystem) {
            this.game.heatSystem.addHeat(3);
        }

        try {
            eventBus.emit(EVENT_TYPES.PLAYER_FIRED_WEAPON, {
                x: target.x, y: target.y, weapon: 'stealth_kill', silent: true,
            });
        } catch {}

        this.game.ui?.showMessage?.('Stealth Takedown!', 'success');
        return true;
    }

    /**
     * Update visibility state based on player actions and environment
     */
    update(dt) {
        const player = this.game.state.player;
        const combat = this.game.combatSystem;
        const now = performance.now();

        // Determine visibility state
        const weaponDrawn = combat && combat.currentWeapon !== 'fist';
        const recentShot = combat && (now - combat._lastFireTime < 3000);
        const moving = player._isMoving || false;
        const sprinting = player._isSprinting || false;

        if (recentShot || sprinting) {
            this.visibility = VISIBILITY.EXPOSED;
        } else if (this.isCrouching && !weaponDrawn && !moving) {
            this.visibility = VISIBILITY.HIDDEN;
        } else if (this.isCrouching || (!weaponDrawn && !moving)) {
            this.visibility = VISIBILITY.LOW_PROFILE;
        } else {
            this.visibility = VISIBILITY.EXPOSED;
        }

        // Update detection level (0 = undetected, 1 = fully detected)
        const heat = this.game.state?.player?.heat ?? 0;
        const targetDetection = this.visibility === VISIBILITY.HIDDEN ? 0
            : this.visibility === VISIBILITY.LOW_PROFILE ? 0.3
            : 0.7 + (heat / 100) * 0.3;

        const rate = targetDetection > this._detectionLevel ? 0.15 : 0.05;
        this._detectionLevel += (targetDetection - this._detectionLevel) * rate;
        this._detectionLevel = Math.max(0, Math.min(1, this._detectionLevel));
    }

    /**
     * Get detection level for HUD display (0-1)
     */
    get detectionLevel() {
        return this._detectionLevel;
    }

    /**
     * Get visibility icon for HUD
     */
    getVisibilityIcon() {
        if (this.visibility === VISIBILITY.HIDDEN) return 'eye-closed';
        if (this.visibility === VISIBILITY.LOW_PROFILE) return 'eye-half';
        return 'eye-open';
    }
}
