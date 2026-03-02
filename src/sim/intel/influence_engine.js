// Influence Operations Engine (Milestone K-03)
// Manages influence operations, reputation manipulation,
// and public perception control.

import { EVENT_TYPES } from '../events.js';

// Influence operation types
export const INFLUENCE_TYPES = {
    // Media manipulation
    POSITIVE_MEDIA: 'positive_media',
    NEGATIVE_MEDIA: 'negative_media',
    OPINION_SHAPING: 'opinion_shaping',

    // Political operations
    LEBY_SUPPORT: 'lobby_support',
    POLITICAL_DONATION: 'political_donation',
    POLICY_INFLUENCE: 'policy_influence',

    // Citizen manipulation
    PROPAGANDA: 'propaganda',
    RUMOR_SPREAD: 'rumor_spread',
    DISINFORMATION: 'disinformation',

    // Economic influence
    MARKET_MANIPULATION: 'market_manipulation',
    INFLATION_CAMPAIGN: 'inflation_campaign',
    ECONOMIC_STIMULUS: 'economic_stimulus',

    // Direct action
    PUBLIC_EVENT: 'public_event',
    PROTEST_SUPPORT: 'protest_support',
    VOTER_SUPPRESSION: 'voter_suppression',
};

// Influence operation costs and effects
export const INFLUENCE_OPERATIONS = {
    POSITIVE_MEDIA: {
        name: 'Positive Media Coverage',
        cost: 100,
        heatCost: 5,
        effect: {
            reputationChange: 10,
            sentimentChange: 0.05,
            duration: 100,
        },
        description: 'Buy positive news coverage for the city',
    },
    NEGATIVE_MEDIA: {
        name: 'Negative Media Smear',
        cost: 150,
        heatCost: 8,
        effect: {
            reputationChange: -15,
            sentimentChange: -0.08,
            duration: 80,
        },
        description: 'Launch a smear campaign against a rival',
    },
    OPINION_SHAPING: {
        name: 'Opinion Shaping Campaign',
        cost: 200,
        heatCost: 10,
        effect: {
            reputationChange: 8,
            sentimentChange: 0.04,
            duration: 150,
        },
        description: 'Long-term campaign to shape public opinion',
    },
    LOBBY_SUPPORT: {
        name: 'Lobby Support',
        cost: 300,
        heatCost: 12,
        effect: {
            reputationChange: 12,
            sentimentChange: 0.06,
            duration: 200,
        },
        description: 'Pay lobbyists to support your policies',
    },
    POLITICAL_DONATION: {
        name: 'Political Donation',
        cost: 500,
        heatCost: 15,
        effect: {
            reputationChange: 20,
            sentimentChange: 0.10,
            duration: 300,
        },
        description: 'Donate to political campaigns for influence',
    },
    POLICY_INFLUENCE: {
        name: 'Policy Influence',
        cost: 400,
        heatCost: 18,
        effect: {
            reputationChange: 15,
            sentimentChange: 0.07,
            duration: 250,
        },
        description: 'Direct influence on policy decisions',
    },
    PROPAGANDA: {
        name: 'Propaganda Campaign',
        cost: 80,
        heatCost: 4,
        effect: {
            reputationChange: 5,
            sentimentChange: 0.03,
            duration: 60,
        },
        description: 'Distribute propaganda materials',
    },
    RUMOR_SPREAD: {
        name: 'Rumor Spread',
        cost: 60,
        heatCost: 3,
        effect: {
            reputationChange: -5,
            sentimentChange: -0.02,
            duration: 40,
        },
        description: 'Spread rumors to discredit opponents',
    },
    DISINFORMATION: {
        name: 'Disinformation Campaign',
        cost: 120,
        heatCost: 6,
        effect: {
            reputationChange: -10,
            sentimentChange: -0.05,
            duration: 70,
        },
        description: 'Plant false information to confuse the public',
    },
    MARKET_MANIPULATION: {
        name: 'Market Manipulation',
        cost: 250,
        heatCost: 10,
        effect: {
            reputationChange: 8,
            sentimentChange: 0.04,
            duration: 120,
        },
        description: 'Influence market sentiment',
    },
    PUBLIC_EVENT: {
        name: 'Public Event Sponsorship',
        cost: 180,
        heatCost: 7,
        effect: {
            reputationChange: 12,
            sentimentChange: 0.06,
            duration: 90,
        },
        description: 'Sponsor public events for positive PR',
    },
    PROTEST_SUPPORT: {
        name: 'Protest Support',
        cost: 100,
        heatCost: 8,
        effect: {
            reputationChange: -8,
            sentimentChange: -0.04,
            duration: 50,
        },
        description: 'Support or suppress protest movements',
    },
    VOTER_SUPPRESSION: {
        name: 'Voter Suppression',
        cost: 200,
        heatCost: 12,
        effect: {
            reputationChange: -12,
            sentimentChange: -0.06,
            duration: 100,
        },
        description: 'Suppress voter turnout in key areas',
    },
};

// Influence channels
export const INFLUENCE_CHANNELS = {
    SOCIAL_MEDIA: 'social_media',
    NEWS_MEDIA: 'news_media',
    RADIO_TV: 'radio_tv',
    STREET_LEVEL: 'street_level',
    POLITICAL: 'political',
    ECONOMIC: 'economic',
};

/**
 * Represents an active influence operation
 */
export class InfluenceOperation {
    constructor(data) {
        this.id = data.id || `influence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = data.type;
        this.name = data.name || 'Unknown Operation';
        this.startTime = data.startTime || 0;
        this.duration = data.duration || 100;
        this.cost = data.cost || 0;
        this.heatCost = data.heatCost || 0;
        this.effect = data.effect || {};
        this.completedTicks = data.completedTicks || 0;
        this.isExpired = data.isExpired || false;
        this.channel = data.channel || INFLUENCE_CHANNELS.SOCIAL_MEDIA;
        this.source = data.source || 'unknown';
    }

    /**
     * Get remaining duration
     */
    getRemainingTicks() {
        return this.duration - this.completedTicks;
    }

    /**
     * Get remaining time percentage
     */
    getTimeRemainingPct() {
        return Math.max(0, this.getRemainingTicks() / this.duration);
    }

    /**
     * Check if operation is complete
     */
    isComplete() {
        return this.completedTicks >= this.duration || this.isExpired;
    }

    /**
     * Tick the operation
     */
    tick(currentTick) {
        if (!this.isComplete()) {
            this.completedTicks++;
        }
        return this.isComplete();
    }

    /**
     * Get operation info for UI
     */
    getInfo() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            startTime: this.startTime,
            duration: this.duration,
            completedTicks: this.completedTicks,
            remainingTicks: this.getRemainingTicks(),
            timeRemainingPct: this.getTimeRemainingPct(),
            cost: this.cost,
            heatCost: this.heatCost,
            effect: this.effect,
            channel: this.channel,
            source: this.source,
            isComplete: this.isComplete(),
        };
    }
}

/**
 * Manages influence operations
 */
export class InfluenceEngine {
    constructor(game) {
        this.game = game;
        this.activeOperations = [];
        this.completedOperations = [];
        this._operationMap = new Map(); // id -> operation
        this.influenceScore = 0;
        this.publicSentiment = 0.5; // 0.0 to 1.0 (negative to positive)
        this.reputationScore = 50; // 0 to 100
        this.influenceHistory = [];
        this.ensureState();
    }

    ensureState() {
        const influenceState = this.game.state.influence || (this.game.state.influence = {});
        influenceState.active = influenceState.active || [];
        influenceState.completed = influenceState.completed || [];
        influenceState.score = influenceState.score ?? 0;
        influenceState.sentiment = influenceState.sentiment ?? 0.5;
        influenceState.reputation = influenceState.reputation ?? 50;
    }

    /**
     * Start a new influence operation
     */
    startOperation(type, channel = INFLUENCE_CHANNELS.SOCIAL_MEDIA, metadata = {}) {
        const opConfig = INFLUENCE_OPERATIONS[type];
        if (!opConfig) return null;

        // Check if player can afford the operation
        const budget = this.game.budgetManager?.getBalance() ?? 0;
        if (budget < opConfig.cost) {
            return null; // Not enough funds
        }

        // Deduct cost
        if (this.game.budgetManager) {
            this.game.budgetManager.spend(opConfig.cost, 'influence_operation');
        }

        const operation = new InfluenceOperation({
            type,
            name: opConfig.name,
            cost: opConfig.cost,
            heatCost: opConfig.heatCost,
            effect: opConfig.effect,
            duration: opConfig.effect.duration,
            startTime: this.game.state.time?.tick || 0,
            channel,
            source: 'player',
            metadata,
        });

        this.activeOperations.push(operation);
        this._operationMap.set(operation.id, operation);

        // Update state
        this.influenceScore += opConfig.effect.reputationChange;
        this.publicSentiment = Math.max(0, Math.min(1, this.publicSentiment + opConfig.effect.sentimentChange));
        this.reputationScore = Math.max(0, Math.min(100, this.reputationScore + opConfig.effect.reputationChange));

        // Add heat
        if (this.game.heatSystem) {
            this.game.heatSystem.addHeat(opConfig.heatCost);
        }

        // Record in history
        this.influenceHistory.push({
            operationId: operation.id,
            type,
            tick: this.game.state.time?.tick || 0,
            cost: opConfig.cost,
            heatCost: opConfig.heatCost,
            effect: opConfig.effect,
        });
        while (this.influenceHistory.length > 100) {
            this.influenceHistory.shift();
        }

        this.updateState();

        // Emit event
        this.game.eventBus.emit(EVENT_TYPES.INFLUENCE_OP_STARTED, {
            operationId: operation.id,
            type,
            cost: opConfig.cost,
            heatCost: opConfig.heatCost,
        });

        return operation;
    }

    /**
     * Cancel an influence operation
     */
    cancelOperation(operationId) {
        const operation = this._operationMap.get(operationId);
        if (!operation || operation.isComplete()) return false;

        this.activeOperations = this.activeOperations.filter(op => op.id !== operationId);
        this._operationMap.delete(operationId);
        operation.isExpired = true;

        this.updateState();

        this.game.eventBus.emit(EVENT_TYPES.INFLUENCE_OP_CANCELLED, {
            operationId,
            type: operation.type,
        });

        return true;
    }

    /**
     * Complete an operation and move to completed list
     */
    completeOperation(operationId) {
        const operation = this._operationMap.get(operationId);
        if (!operation || operation.isComplete()) return false;

        this.activeOperations = this.activeOperations.filter(op => op.id !== operationId);
        this._operationMap.delete(operationId);
        operation.isExpired = true;
        this.completedOperations.push(operation);

        // Apply effects
        const effect = operation.effect;
        this.influenceScore += effect.reputationChange || 0;
        this.publicSentiment = Math.max(0, Math.min(1, this.publicSentiment + (effect.sentimentChange || 0)));
        this.reputationScore = Math.max(0, Math.min(100, this.reputationScore + (effect.reputationChange || 0)));

        this.updateState();

        this.game.eventBus.emit(EVENT_TYPES.INFLUENCE_OP_COMPLETED, {
            operationId,
            type: operation.type,
            effect,
        });

        return true;
    }

    /**
     * Get active operation by ID
     */
    getOperation(operationId) {
        return this._operationMap.get(operationId);
    }

    /**
     * Get all active operations
     */
    getActiveOperations() {
        return this.activeOperations;
    }

    /**
     * Get all completed operations
     */
    getCompletedOperations() {
        return this.completedOperations;
    }

    /**
     * Get operations by type
     */
    getByType(type) {
        return this.activeOperations.filter(op => op.type === type);
    }

    /**
     * Tick all active operations
     */
    update() {
        const currentTick = this.game.state.time?.tick || 0;

        // Process active operations
        const completed = [];
        for (const operation of this.activeOperations) {
            if (operation.tick(currentTick)) {
                completed.push(operation.id);
            }
        }

        // Move completed operations to completed list
        for (const opId of completed) {
            this.completeOperation(opId);
        }

        // Natural decay of influence effects
        this._decayInfluence();

        this.updateState();
    }

    /**
     * Decay influence effects over time
     */
    _decayInfluence() {
        const decayRate = 0.001; // Slow decay
        this.influenceScore = Math.max(0, this.influenceScore * (1 - decayRate));

        // Sentiment reverts toward neutral (0.5)
        const sentimentReversion = 0.0005;
        this.publicSentiment = this.publicSentiment + (0.5 - this.publicSentiment) * sentimentReversion;
        this.publicSentiment = Math.max(0, Math.min(1, this.publicSentiment));

        // Reputation reverts toward 50
        const reputationReversion = 0.0003;
        this.reputationScore = this.reputationScore + (50 - this.reputationScore) * reputationReversion;
        this.reputationScore = Math.max(0, Math.min(100, this.reputationScore));
    }

    /**
     * Get influence overview
     */
    getOverview() {
        return {
            score: this.influenceScore,
            sentiment: this.publicSentiment,
            reputation: this.reputationScore,
            activeCount: this.activeOperations.length,
            completedCount: this.completedOperations.length,
            historyCount: this.influenceHistory.length,
        };
    }

    /**
     * Update state for save/load
     */
    updateState() {
        const influenceState = this.game.state.influence || (this.game.state.influence = {});
        influenceState.active = this.activeOperations.map(o => o.getInfo());
        influenceState.completed = this.completedOperations.map(o => o.getInfo());
        influenceState.score = this.influenceScore;
        influenceState.sentiment = this.publicSentiment;
        influenceState.reputation = this.reputationScore;
    }

    /**
     * Load state from save
     */
    loadState() {
        const influenceState = this.game.state.influence || (this.game.state.influence = {});
        this.activeOperations = (influenceState.active || []).map(data => new InfluenceOperation(data));
        this._operationMap.clear();
        for (const op of this.activeOperations) {
            this._operationMap.set(op.id, op);
        }
        this.completedOperations = (influenceState.completed || []).map(data => new InfluenceOperation(data));
        this.influenceScore = influenceState.score ?? 0;
        this.publicSentiment = influenceState.sentiment ?? 0.5;
        this.reputationScore = influenceState.reputation ?? 50;

        // Rebuild completed operations map (read-only)
        for (const op of this.completedOperations) {
            this._operationMap.set(op.id, op);
        }
    }

    /**
     * Get influence operations config for UI
     */
    getAvailableOperations() {
        return Object.entries(INFLUENCE_OPERATIONS).map(([type, config]) => ({
            type,
            ...config,
            canAfford: (this.game.budgetManager?.getBalance() ?? 0) >= config.cost,
        }));
    }

    /**
     * Get sentiment breakdown by district
     */
    getSentimentByDistrict() {
        const sentiment = {};
        for (const district of this.game.map.districts || []) {
            // Base sentiment on influence score
            sentiment[district.id] = this.publicSentiment;
        }
        return sentiment;
    }

    /**
     * Serialize for save
     */
    serialize() {
        this.updateState();
        const influenceState = this.game.state.influence || {};
        return {
            active: influenceState.active || [],
            completed: influenceState.completed || [],
            score: influenceState.score ?? 0,
            sentiment: influenceState.sentiment ?? 0.5,
            reputation: influenceState.reputation ?? 50,
            lastUpdateTick: this.game.state.time?.tick || 0,
        };
    }
}

/**
 * Create influence engine
 */
export function createInfluenceEngine(game) {
    return new InfluenceEngine(game);
}