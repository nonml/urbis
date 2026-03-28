/**
 * Player Health System
 * Manages health, armor, damage, death, and respawn.
 */

export class PlayerHealth {
    constructor(game) {
        this.game = game;
        this._respawnTimer = 0;
        this._damageFlashTimer = 0;
    }

    get state() {
        return this.game.state.player;
    }

    get health() {
        return this.state.health;
    }

    get maxHealth() {
        return this.state.maxHealth;
    }

    get armor() {
        return this.state.armor;
    }

    get isDead() {
        return this.state.isDead;
    }

    /**
     * Apply damage to the player
     * @param {number} amount - Raw damage amount
     * @param {string} source - Damage source for logging ('vehicle', 'gunshot', 'melee', 'explosion')
     */
    takeDamage(amount, source = 'unknown') {
        if (this.isDead) return;

        // Armor absorbs 50% of damage
        let effective = amount;
        if (this.state.armor > 0) {
            const absorbed = Math.min(this.state.armor, amount * 0.5);
            this.state.armor -= absorbed;
            effective -= absorbed;
        }

        this.state.health = Math.max(0, this.state.health - effective);
        this._damageFlashTimer = 300; // ms

        if (this.state.health <= 0) {
            this._die(source);
        }
    }

    /**
     * Heal the player
     * @param {number} amount
     */
    heal(amount) {
        if (this.isDead) return;
        this.state.health = Math.min(this.state.maxHealth, this.state.health + amount);
    }

    /**
     * Add armor
     * @param {number} amount
     */
    addArmor(amount) {
        this.state.armor = Math.min(100, this.state.armor + amount);
    }

    /**
     * Handle player death
     */
    _die(source) {
        this.state.isDead = true;
        this._respawnTimer = 3000; // 3 seconds
        this.game.ui?.showMessage?.(`Wasted! (${source})`, 'warning');

        // Drop some money on death
        const goldLoss = Math.min(this.game.state.resources.gold, 50);
        this.game.state.resources.gold -= goldLoss;

        // Reset heat on death
        this.game.state.player.heat = 0;
        this.game.state.player.heatState = 'calm';
        if (this.game.heatSystem) {
            this.game.heatSystem.setHeat(0);
        }

        // Exit vehicle if driving
        const vc = this.game.vehicleController;
        if (vc?.isDriving) {
            vc.exitVehicle();
        }
    }

    /**
     * Update per frame — handles respawn timer and damage flash
     * @param {number} dt - Frame delta in ms
     */
    update(dt) {
        if (this._damageFlashTimer > 0) {
            this._damageFlashTimer -= dt;
        }

        if (this.isDead) {
            this._respawnTimer -= dt;
            if (this._respawnTimer <= 0) {
                this._respawn();
            }
        }
    }

    /**
     * Respawn the player at map center (or hospital if available)
     */
    _respawn() {
        // Find hospital building for respawn point
        let rx = Math.floor(this.game.map.width / 2);
        let ry = Math.floor(this.game.map.height / 2);

        const hospital = (this.game.buildings.buildings || []).find(b => b.type === 'hospital');
        if (hospital) {
            rx = hospital.x;
            ry = hospital.y;
        }

        this.state.health = this.state.maxHealth;
        this.state.armor = 0;
        this.state.isDead = false;
        this.state.x = rx;
        this.state.y = ry;
        this.state.wx = rx + 0.5;
        this.state.wz = ry + 0.5;

        this.game.ui?.showMessage?.('Respawned', 'normal');
        this.game.ui?.renderer3d?.syncPlayer?.();
        if (this.game.ui?.renderer3d?._player) {
            this.game.ui.renderer3d._player.visible = true;
        }
    }

    /**
     * Whether the damage flash should be shown
     */
    get showDamageFlash() {
        return this._damageFlashTimer > 0;
    }

    /**
     * Health ratio 0-1 for HUD
     */
    get healthRatio() {
        return this.state.health / this.state.maxHealth;
    }
}
