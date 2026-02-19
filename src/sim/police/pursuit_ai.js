// Police pursuit AI - decision making for police units during chases

import { checkLOS, getSearchPattern, findLoseSpot } from './los.js';

// Pursuit states
export const PURSUIT_STATES = {
    CHASE: 'chase',
    RAM: 'ram',
    INTERCEPT: 'intercept',
    SEARCH: 'search'
};

/**
 * Police pursuit AI controller
 */
export class PursuitAI {
    constructor(game) {
        this.game = game;
        this.pursuitUnits = [];
    }

    /**
     * Get police units in pursuit mode
     */
    getPursuitUnits() {
        const police = this.game.policeSystem?.units || [];
        return police.filter(u => u.state === 'pursuit' || u.state === 'ram');
    }

    /**
     * Make decision for a police unit
     * @param {Object} unit - Police unit
     * @returns {Object} Decision {action, target}
     */
    makeDecision(unit) {
        const playerX = this.game.state.player.x;
        const playerY = this.game.state.player.y;
        const heat = this.game.state.player.heat || 0;
        const policeRep = this.game.factions?.reputation?.police || 0;

        // Check LOS
        const losResult = checkLOS(this.game.map, unit.x, unit.y, playerX, playerY);

        // Ramming decision (only at high heat)
        if (heat >= 75 && unit.type === 'INTERCEPTOR' && unit.speed > 15 && losResult.distance < 10) {
            return { action: 'ram', target: { x: playerX, y: playerY } };
        }

        // Interception (cutting off player)
        if (heat >= 50 && unit.speed > 12 && this.game.rng.int(0, 100) < 15) {
            // Calculate intercept point
            const dx = playerX - unit.x;
            const dy = playerY - unit.y;
            const speedRatio = unit.speed / 22; // Player speed estimate
            const interceptDist = 5 + (speedRatio * 10);
            const interceptX = playerX + (dx / Math.sqrt(dx * dx + dy * dy)) * interceptDist;
            const interceptY = playerY + (dy / Math.sqrt(dx * dx + dy * dy)) * interceptDist;

            return { action: 'intercept', target: { x: interceptX, y: interceptY } };
        }

        // Chase mode (default)
        if (losResult.broken) {
            // Lost LOS, switch to search
            unit.state = 'search';
            unit.lastKnownX = playerX;
            unit.lastKnownY = playerY;
            unit.searchProgress = 0;
            return { action: 'search', target: null };
        }

        return { action: 'chase', target: { x: playerX, y: playerY } };
    }

    /**
     * Apply decision effects
     * @param {Object} unit - Police unit
     * @param {Object} decision - Decision from makeDecision
     */
    applyDecision(unit, decision) {
        if (decision.action === 'chase') {
            unit.targetX = decision.target?.x || this.game.state.player.x;
            unit.targetY = decision.target?.y || this.game.state.player.y;
            unit.state = 'pursuit';
        }

        if (decision.action === 'ram') {
            unit.targetX = decision.target?.x || this.game.state.player.x;
            unit.targetY = decision.target?.y || this.game.state.player.y;
            unit.state = 'ram';
            // Impact heat on ram attempt
            this.game.heatSystem?.addHeat?.(3);
            this.game.ui?.showMessage?.('Police attempting ram!', 'warning');
        }

        if (decision.action === 'intercept') {
            unit.targetX = decision.target?.x;
            unit.targetY = decision.target?.y;
            unit.state = 'intercept';
        }

        if (decision.action === 'search') {
            const searchPos = getSearchPattern(this.game.map, unit.lastKnownX, unit.lastKnownY, unit.searchProgress || 0);
            unit.targetX = searchPos.x;
            unit.targetY = searchPos.y;
        }
    }

    /**
     * Update pursuit decisions for all units
     */
    update() {
        const pursuitUnits = this.getPursuitUnits();
        for (const unit of pursuitUnits) {
            const decision = this.makeDecision(unit);
            this.applyDecision(unit, decision);
        }
    }

    /**
     * Find units that can help lose pursuit
     */
    findHelpingUnits() {
        const police = this.game.policeSystem?.units || [];
        // Find police units near player but not pursuing
        return police.filter(u =>
            u.state === 'patrol' ||
            (u.state === 'search' && (u.searchProgress || 0) > 20)
        );
    }

    /**
     * Create roadblock at position
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createRoadblock(x, y) {
        const roadblock = {
            id: `roadblock_${Date.now()}`,
            x,
            y,
            createdTick: this.game.state.time.tick,
            active: true
        };

        const world = this.game.state.world || (this.game.state.world = {});
        world.roadblocks = world.roadblocks || [];
        world.roadblocks.push(roadblock);

        this.game.ui?.showMessage?.('Roadblock created!', 'warning');
        return roadblock;
    }

    /**
     * Find nearby roadblocks
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} radius - Search radius
     */
    findRoadblocks(x, y, radius = 15) {
        const world = this.game.state.world || {};
        const roadblocks = world.roadblocks || [];
        return roadblocks.filter(b =>
            b.active &&
            Math.abs(b.x - x) < radius &&
            Math.abs(b.y - y) < radius
        );
    }

    /**
     * Disable a roadblock
     * @param {Object} roadblock - Roadblock to disable
     */
    disableRoadblock(roadblock) {
        roadblock.active = false;
        this.game.heatSystem?.addHeat?.(-5);
        this.game.ui?.showMessage?.('Roadblock disabled', 'success');
        return true;
    }
}