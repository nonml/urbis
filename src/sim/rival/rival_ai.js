// Rival AI Core - Manages the adversarial city controller
import { selectBestAction, RIVAL_ACTION_CATALOG, RIVAL_ACTION_COOLDOWN } from './rival_actions.js';

// Default rival config
export const RIVAL_CONFIG = {
    baseInfluence: 50,
    baseBudget: 500,
    baseHeat: 10,
    baseIntel: 30,
    actionInterval: 5, // Minimum ticks between actions
    heatDecay: 2, // Heat decreases per tick
    budgetRegen: 20, // Budget regenerates per tick
    maxHeat: 100,
    maxBudget: 2000,
    maxInfluence: 100
};

// Rival AI class
export class RivalAI {
    constructor(seed) {
        this.rngSeed = seed;
        this.lastActionTick = 0;
        this.actionHistory = [];
        this.nextActionDelay = RIVAL_CONFIG.actionInterval;
    }

    /**
     * Creates initial rival state
     * @returns {Object} Rival state object
     */
    createInitialState() {
        return {
            influence: RIVAL_CONFIG.baseInfluence,
            budget: RIVAL_CONFIG.baseBudget,
            heat: RIVAL_CONFIG.baseHeat,
            intel: RIVAL_CONFIG.baseIntel,
            lastActionTick: 0,
            currentAction: null,
            actionDuration: 0,
            pastActions: []
        };
    }

    /**
     * Update rival state each tick
     * @param {Object} state - Full game state
     * @param {number} tick - Current tick number
     */
    update(state, tick) {
        const rival = state.rival || this.createInitialState();

        // Decay heat over time
        rival.heat = Math.max(0, (rival.heat || 0) - RIVAL_CONFIG.heatDecay);

        // Regenerate budget
        rival.budget = Math.min(RIVAL_CONFIG.maxBudget, (rival.budget || 0) + RIVAL_CONFIG.budgetRegen);

        // Update influence based on city state
        rival.influence = this.calculateInfluence(state);

        // Check if we can/should take an action
        if (tick - rival.lastActionTick >= this.nextActionDelay) {
            if (this.canTakeAction(state, rival)) {
                this.takeAction(state, tick);
            }
        }

        // Decrease action duration if ongoing
        if (rival.actionDuration > 0) {
            rival.actionDuration--;
            if (rival.actionDuration <= 0) {
                rival.currentAction = null;
            }
        }

        // Store in state
        state.rival = rival;
    }

    /**
     * Calculate rival influence based on city state
     * @param {Object} state - Full game state
     * @returns {number} Influence score (0-100)
     */
    calculateInfluence(state) {
        const playerHeat = state.player?.heat || 0;
        const avgHappiness = this.getAvgHappiness(state);
        const totalBuildings = state.buildings?.list?.length || 0;

        // Base influence
        let influence = RIVAL_CONFIG.baseInfluence;

        // Higher heat = lower rival influence (they can't act as much)
        influence -= playerHeat * 0.5;

        // Happiness affects rival influence (unhappy = more vulnerable)
        influence -= (50 - avgHappiness) * 0.3;

        // More buildings = more influence (they want to counter your growth)
        influence += totalBuildings * 0.2;

        // Cap influence
        return Math.max(0, Math.min(100, influence));
    }

    /**
     * Get average citizen happiness
     * @param {Object} state - Full game state
     * @returns {number} Average happiness
     */
    getAvgHappiness(state) {
        const citizens = state.citizens?.list || [];
        if (citizens.length === 0) return 50;
        const total = citizens.reduce((sum, c) => sum + (c.happiness || 50), 0);
        return total / citizens.length;
    }

    /**
     * Check if rival can take an action
     * @param {Object} state - Full game state
     * @param {Object} rival - Rival state
     * @returns {boolean} Can take action
     */
    canTakeAction(state, rival) {
        if (rival.budget < RIVAL_CONFIG.baseBudget / 2) return false;
        return true;
    }

    /**
     * Execute a rival action
     * @param {Object} state - Full game state
     * @param {number} tick - Current tick
     */
    takeAction(state, tick) {
        const rival = state.rival;

        // Select best action
        const actionType = selectBestAction(state);
        const action = RIVAL_ACTION_CATALOG[actionType];

        // Deduct cost
        rival.budget -= action.cost;
        rival.heat = Math.min(RIVAL_CONFIG.maxHeat, (rival.heat || 0) + action.heatCost);

        // Record action
        rival.currentAction = actionType;
        rival.actionDuration = action.duration;
        rival.lastActionTick = tick;

        // Log to history
        rival.pastActions.push({
            type: actionType,
            tick: tick,
            name: action.name,
            success: true
        });

        // Apply action effects
        this.applyActionEffects(state, action);

        // Notify player
        this.notifyPlayer(state, action);

        // Update state
        state.rival = rival;
    }

    /**
     * Apply action effects to game state
     * @param {Object} state - Full game state
     * @param {Object} action - Action definition
     */
    applyActionEffects(state, action) {
        const resources = state.resources;

        // Apply resource impacts
        if (action.impact.gold) {
            resources.gold = Math.max(0, resources.gold + action.impact.gold);
        }
        if (action.impact.food) {
            resources.food = Math.max(0, resources.food + action.impact.food);
        }
        if (action.impact.wood) {
            resources.wood = Math.max(0, resources.wood + action.impact.wood);
        }

        // Apply population impact
        if (action.impact.population) {
            state.citizens.list = state.citizens.list.slice(0, Math.max(0, state.citizens.list.length + action.impact.population));
            state.resources.population = state.citizens.list.length;
        }

        // Apply happiness impact (reduces all citizens' happiness)
        if (action.impact.happiness) {
            const impact = action.impact.happiness;
            for (const citizen of state.citizens.list) {
                citizen.happiness = Math.max(0, (citizen.happiness || 50) + impact);
            }
        }

        // Job production impact
        if (action.impact.jobProduction) {
            if (!resources.jobProduction) resources.jobProduction = { gold: 0, food: 0, wood: 0 };
            resources.jobProduction.gold = Math.max(0, (resources.jobProduction.gold || 0) + action.impact.jobProduction.gold);
            resources.jobProduction.food = Math.max(0, (resources.jobProduction.food || 0) + action.impact.jobProduction.food);
            resources.jobProduction.wood = Math.max(0, (resources.jobProduction.wood || 0) + action.impact.jobProduction.wood);
        }
    }

    /**
     * Send notification about rival action to player
     * @param {Object} state - Full game state
     * @param {Object} action - Action definition
     */
    notifyPlayer(state, action) {
        if (state.game?.ui) {
            state.game.ui.showMessage(action.message, 'rival');
            state.game.ui.showRivalActivity(action);
        }
    }

    /**
     * Get rival threat level (0-100)
     * @param {Object} state - Full game state
     * @returns {number} Threat level
     */
    getThreatLevel(state) {
        const rival = state.rival || this.createInitialState();
        return Math.min(100, Math.max(0, rival.influence + rival.heat / 2));
    }

    /**
     * Get telemetry data for UI
     * @param {Object} state - Full game state
     * @returns {Object} Rival telemetry
     */
    getTelemetry(state) {
        const rival = state.rival || this.createInitialState();
        return {
            influence: rival.influence,
            budget: rival.budget,
            heat: rival.heat,
            intel: rival.intel,
            threatLevel: this.getThreatLevel(state),
            currentAction: rival.currentAction,
            actionDuration: rival.actionDuration,
            actionHistory: rival.pastActions.slice(-10).reverse()
        };
    }
}