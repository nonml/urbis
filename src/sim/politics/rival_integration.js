// Rival AI Integration with Politics System
// Connects rival AI behavior with political decisions, policies, and faction influence

import { eventBus, EVENT_TYPES } from '../events.js';
import { RIVAL_ACTION_CATALOG } from '../rival/rival_actions.js';

// Political responses to rival actions
export const POLITICAL_RESPONSES = {
    // Economic responses
    ECONOMIC_SPYING: {
        policy: 'trade_embargo',
        reputationImpact: {
            citizens: -5,
            corp: 10,
            police: 5
        },
        rivalPenalty: 0.3 // 30% reduction in rival effectiveness
    },
    SABOTAGE_GRID: {
        policy: 'emergency_measures',
        reputationImpact: {
            citizens: -10,
            police: 15,
            corp: -5
        },
        rivalPenalty: 0.4,
        emergencyDuration: 15
    },
    BRIBE_OFFICIALS: {
        policy: 'anti_corruption_drive',
        reputationImpact: {
            citizens: 5,
            police: 20,
            corp: -15
        },
        rivalPenalty: 0.25
    },
    // Social responses
    SPREAD_PROPAGANDA: {
        policy: 'media_campaign',
        reputationImpact: {
            citizens: 15,
            police: -5,
            corp: -5
        },
        rivalPenalty: 0.35
    },
    TRIGGER_GANG_ACTIVITY: {
        policy: 'crime_crackdown',
        reputationImpact: {
            citizens: -5,
            police: 20,
            gangs: -25
        },
        rivalPenalty: 0.3,
        policeEffectivenessBonus: 0.2
    },
    POACH_WORKERS: {
        policy: 'job_creation_program',
        reputationImpact: {
            citizens: 10,
            corp: 5,
            gangs: -5
        },
        rivalPenalty: 0.2,
        jobProductionBonus: 10
    },
    MEDIA_BLACKOUT: {
        policy: 'transparency_initiative',
        reputationImpact: {
            citizens: 12,
            corp: -8,
            police: -5
        },
        rivalPenalty: 0.3
    }
};

// Rival political threat levels
export const RIVAL_THREAT_LEVELS = {
    LOW: 'low',        // < 30 - Rival is weak, can be ignored
    MODERATE: 'moderate',  // 30-60 - Rival is growing, need attention
    HIGH: 'high',        // 60-80 - Rival is strong, active counter needed
    CRITICAL: 'critical'    // > 80 - Rival is dominant, emergency measures needed
};

// Rival Integration Manager class
export class RivalIntegrationManager {
    constructor(game, rivalAI, policyManager, pressureMap) {
        this.game = game;
        this.rivalAI = rivalAI;
        this.policyManager = policyManager;
        this.pressureMap = pressureMap;
        this.rivalThreat = 0;
        this.lastRivalActionTick = 0;
        this.politicalResponses = {}; // Track player political responses to rival actions
        this.rivalInfluenceResistance = 1.0;
        this.emergencyMode = false;
        this.emergencyTicksRemaining = 0;
    }

    /**
     * Initialize the rival integration manager
     */
    initialize() {
        this.rivalThreat = this.rivalAI?.getThreatLevel(this.game.state) || 0;
        this.政治_responses = {};
        this.emergencyMode = false;
    }

    /**
     * Get current rival threat level
     * @returns {string} Threat level
     */
    getThreatLevel() {
        if (this.emergencyMode) return RIVAL_THREAT_LEVELS.CRITICAL;

        if (this.rivalThreat < 30) return RIVAL_THREAT_LEVELS.LOW;
        if (this.rivalThreat < 60) return RIVAL_THREAT_LEVELS.MODERATE;
        if (this.rivalThreat < 80) return RIVAL_THREAT_LEVELS.HIGH;
        return RIVAL_THREAT_LEVELS.CRITICAL;
    }

    /**
     * Get threat level string
     * @param {number} threat - Threat value
     * @returns {string} Threat level
     */
    static getThreatLevelString(threat) {
        if (threat < 30) return 'Low';
        if (threat < 60) return 'Moderate';
        if (threat < 80) return 'High';
        return 'Critical';
    }

    /**
     * Apply rival action impact on politics
     * @param {string} actionType - Rival action type
     * @param {Object} action - Action definition
     * @param {Object} state - Game state
     */
    applyRivalActionImpact(actionType, action, state) {
        // Apply rival's political pressure based on action
        const rivalInfluence = state.rival?.influence || 0;
        const pressureMultiplier = 0.5;

        // Apply pressure to political systems
        this.applyPoliticalPressure(actionType, rivalInfluence * pressureMultiplier);

        // Update resistance based on political responses
        this.updateInfluenceResistance(actionType);

        // Track the action for political response history
        this.lastRivalActionTick = state.time?.tick || 0;
        this.政治_responses[actionType] = {
            action: actionType,
            name: action.name,
            tick: this.lastRivalActionTick,
            responseApplied: false,
            effectiveness: 1.0
        };
    }

    /**
     * Apply political pressure from rival actions
     * @param {string} actionType - Rival action type
     * @param {number} basePressure - Base pressure value
     */
    applyPoliticalPressure(actionType, basePressure) {
        // Map action types to political pressures
        const pressureMap = {
            SABOTAGE_GRID: {
                crime: basePressure * 0.3,
                economic: basePressure * 0.5,
                service: -basePressure * 0.2
            },
            SPREAD_PROPAGANDA: {
                faction: -basePressure * 0.6,
                citizens: -basePressure * 0.4
            },
            POACH_WORKERS: {
                economic: basePressure * 0.4,
                faction: -basePressure * 0.2
            },
            TRIGGER_GANG_ACTIVITY: {
                crime: basePressure * 0.8,
                police: -basePressure * 0.3
            },
            BRIBE_OFFICIALS: {
                faction: -basePressure * 0.7,
                corruption: basePressure * 0.5
            },
            ECONOMIC_SPYING: {
                economic: basePressure * 0.6,
                corruption: basePressure * 0.3
            },
            MEDIA_BLACKOUT: {
                faction: -basePressure * 0.4,
                reputation: -basePressure * 0.3
            }
        };

        const pressures = pressureMap[actionType] || {};
        for (const [pressureType, value] of Object.entries(pressures)) {
            // Apply pressure to map (simplified - would need x/y in production)
            this.pressureMap?.applyPressure(50, 50, pressureType, value);
        }
    }

    /**
     * Update influence resistance based on political state
     */
    updateInfluenceResistance(actionType) {
        // Calculate baseline resistance from reputation
        const rep = this.game.state.factions?.reputation || {};
        const baseResistance = 1.0 + (rep.citizens || 0) / 200;

        // Apply policy multipliers
        const policyModifiers = this.game.state.policyEconomyModifiers || {};
        if (policyModifiers.resistanceMultiplier) {
            this.rivalInfluenceResistance = policyModifiers.resistanceMultiplier;
        } else {
            this.rivalInfluenceResistance = baseResistance;
        }

        // Emergency mode boosts resistance
        if (this.emergencyMode) {
            this.rivalInfluenceResistance *= 1.5;
        }
    }

    /**
     * Calculate rival effectiveness multiplier based on political state
     * @returns {number} Effectiveness multiplier (0-1)
     */
    calculateRivalEffectiveness() {
        let effectiveness = 1.0;

        // Emergency mode reduces rival effectiveness
        if (this.emergencyMode) {
            effectiveness *= 0.5;
        }

        // High reputation reduces rival effectiveness
        const rep = this.game.state.factions?.reputation || {};
        effectiveness -= (rep.citizens || 0) / 500;

        // Police pressure reduces rival effectiveness
        const policeRep = rep.police || 0;
        if (policeRep > 20) {
            effectiveness -= (policeRep - 20) / 200;
        }

        // Apply resistance multiplier
        effectiveness *= this.rivalInfluenceResistance;

        return Math.max(0.2, Math.min(1.0, effectiveness));
    }

    /**
     * Check if emergency mode should be activated
     * @param {number} tick - Current tick
     * @returns {boolean} True if emergency mode should activate
     */
    checkEmergencyMode(tick) {
        if (this.emergencyMode) {
            this.emergencyTicksRemaining--;
            if (this.emergencyTicksRemaining <= 0) {
                this.emergencyMode = false;
                this.game.ui?.showMessage?.('Emergency mode deactivated', 'politics');
            }
            return true;
        }

        const threatLevel = this.getThreatLevel();
        if (threatLevel === RIVAL_THREAT_LEVELS.CRITICAL) {
            // Activate emergency mode
            this.emergencyMode = true;
            this.emergencyTicksRemaining = 30; // 30 ticks default
            this.game.ui?.showMessage?.('CRITICAL: Emergency mode activated!', 'crisis');
            this.game.ui?.showMessage?.('Rival threat at maximum - special measures in effect', 'politics');

            // Apply emergency political effects
            this.applyEmergencyEffects();

            return true;
        }

        return false;
    }

    /**
     * Apply emergency political effects
     */
    applyEmergencyEffects() {
        // Temporary emergency policy effects
        this.game.state.emergencyModifiers = {
            policeEffectiveness: 1.5,
            heatDecayMultiplier: 0.5,
            budgetRegenMultiplier: 1.2,
            policyCostMultiplier: 0.8
        };

        // Boost police reputation temporarily
        this.game.factionSystem?.modifyRep('police', 15, 'emergency_police_boost', 'politics');
    }

    /**
     * Handle rival action response by player
     * @param {string} actionType - Rival action type
     * @param {string} responseAction - Player's response action
     */
    handleRivalResponse(actionType, responseAction) {
        const response = POLITICAL_RESPONSES[actionType];

        if (!response) {
            // Generic response
            this.game.factionSystem?.modifyRep('citizens', -5, 'rival_action_response', 'politics');
            this.game.factionSystem?.modifyRep('police', 5, 'rival_action_response', 'politics');
            return;
        }

        // Apply response reputation impacts
        for (const [faction, delta] of Object.entries(response.reputationImpact)) {
            this.game.factionSystem?.modifyRep(faction, delta, `response_${actionType}`, 'politics');
        }

        // Record response
        this.政治_responses[actionType] = {
            ...this.政治_responses[actionType],
            responseApplied: true,
            responseAction,
            effectiveness: 1.0 - (response.rivalPenalty || 0)
        };

        // Reduce rival effectiveness
        this.rivalThreat = Math.max(0, this.rivalThreat - 10);

        // Notify player
        this.game.ui?.showMessage?.(`Response to ${responseAction.name} applied`, 'politics');
    }

    /**
     * Get rival political telemetry for UI
     * @returns {Object} Rival political telemetry
     */
    getTelemetry() {
        return {
            threatLevel: this.getThreatLevel(),
            threatValue: this.rivalThreat,
            threatString: RivalIntegrationManager.getThreatLevelString(this.rivalThreat),
            rivalInfluenceResistance: this.rivalInfluenceResistance,
            rivalEffectiveness: this.calculateRivalEffectiveness(),
            emergencyMode: this.emergencyMode,
            emergencyTicksRemaining: this.emergencyTicksRemaining,
            politicalResponses: Object.entries(this.政治_responses).map(([type, resp]) => ({
                actionType: type,
                responseApplied: resp.responseApplied,
                effectiveness: resp.effectiveness
            })),
            pressureFromRival: this.pressureMap?.getTelemetry?.().districtPressure || []
        };
    }

    /**
     * Get political action options based on current state
     * @returns {Array} Available political actions
     */
    getPoliticalActions() {
        const actions = [];

        // Only show political actions if rival is a threat
        if (this.rivalThreat >= 30) {
            actions.push({
                id: 'anti_corruption_campaign',
                name: 'Anti-Corruption Campaign',
                description: 'Launch investigation into rival influence operations',
                cost: 50,
                impact: {
                    rivalInfluence: -15,
                    police: 10,
                    citizens: -5
                },
                available: true
            });
        }

        if (this.rivalThreat >= 50) {
            actions.push({
                id: 'economic_sanctions',
                name: 'Economic Sanctions',
                description: 'Impose trade restrictions on rival-supported entities',
                cost: 100,
                impact: {
                    rivalInfluence: -25,
                    corp: 5,
                    citizens: -10
                },
                available: true
            });
        }

        if (this.rivalThreat >= 70) {
            actions.push({
                id: 'security_intensification',
                name: 'Security Intensification',
                description: 'Increase police surveillance and patrols',
                cost: 75,
                impact: {
                    rivalInfluence: -30,
                    police: 20,
                    citizens: -15,
                    heatDecayMultiplier: 0.7
                },
                available: true
            });
        }

        // Emergency actions
        if (this.emergencyMode) {
            actions.push({
                id: 'emergency_decree',
                name: 'Emergency Decree',
                description: 'Invoke emergency powers for immediate action',
                cost: 25,
                impact: {
                    rivalInfluence: -40,
                    police: 25,
                    citizens: -20,
                    duration: 10
                },
                available: true
            });
        }

        return actions;
    }

    /**
     * Execute political action
     * @param {string} actionId - Action to execute
     * @returns {Object} { success: boolean, error?: string }
     */
    executePoliticalAction(actionId) {
        const actions = this.getPoliticalActions();
        const action = actions.find(a => a.id === actionId);

        if (!action) {
            return { success: false, error: 'Action not found' };
        }

        const budget = this.game.state.resources?.gold || 0;
        if (budget < action.cost) {
            return { success: false, error: 'Insufficient budget' };
        }

        // Deduct cost
        this.game.state.resources.gold -= action.cost;

        // Apply impact
        if (action.impact.rivalInfluence) {
            this.rivalThreat = Math.max(0, this.rivalThreat - action.impact.rivalInfluence);
        }

        if (action.impact.police) {
            this.game.factionSystem?.modifyRep('police', action.impact.police, `political_action_${actionId}`, 'politics');
        }

        if (action.impact.citizens) {
            this.game.factionSystem?.modifyRep('citizens', action.impact.citizens, `political_action_${actionId}`, 'politics');
        }

        if (action.impact.corp) {
            this.game.factionSystem?.modifyRep('corp', action.impact.corp, `political_action_${actionId}`, 'politics');
        }

        // Notify player
        this.game.ui?.showMessage?.(`Political action executed: ${action.name}`, 'politics');

        return { success: true, action };
    }
}

// Event type additions
EVENT_TYPES.RIVAL_POLITICAL_RESPONSE = 'rival_political_response';
EVENT_TYPES.POLITICAL_ACTION_EXECUTED = 'political_action_executed';