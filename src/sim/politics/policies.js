// Policy/Law System - Manages enacted policies, their effects, and player influence
// Policies provide long-term gameplay mechanics and faction modifiers

import { eventBus, EVENT_TYPES } from '../events.js';

// Policy categories
export const POLICY_CATEGORIES = {
    ECONOMIC: 'economic',
    SOCIAL: 'social',
    SECURITY: 'security',
    INFRASTRUCTURE: 'infrastructure',
    DIPLOMACY: 'diplomacy'
};

// Policy definitions with effects and costs
export const POLICY_DEFINITIONS = {
    // Economic Policies
    tax_reduction: {
        id: 'tax_reduction',
        name: 'Tax Reduction',
        description: 'Lower taxes to boost citizen happiness and economic activity',
        category: POLICY_CATEGORIES.ECONOMIC,
        cost: 50, // Budget cost to enact
        monthlyCost: 0, // Ongoing cost
        duration: 30, // Ticks duration (30 days)
        requiredReputation: -30, // Minimum reputation to enact
        effects: {
            citizens: 10, // Reputation change
            corp: 5,
            economy: {
                wageMultiplier: 0.95,
                incomeMultiplier: 1.05,
                jobProduction: 5
            },
            happinessBias: 2
        },
        factionImpact: {
            citizens: 15, // +15 reputation
            corp: 8,
            gangs: -5
        }
    },
    corporate_incentives: {
        id: 'corporate_incentives',
        name: 'Corporate Incentives',
        description: 'Tax breaks for corporations to stimulate job growth',
        category: POLICY_CATEGORIES.ECONOMIC,
        cost: 75,
        monthlyCost: 10,
        duration: 45,
        requiredReputation: -20,
        effects: {
            corp: 20,
            citizens: -5,
            economy: {
                wageMultiplier: 0.98,
                jobProduction: 10
            }
        },
        factionImpact: {
            corp: 25,
            citizens: -8,
            gangs: -2
        }
    },
    wealth_redistribution: {
        id: 'wealth_redistribution',
        name: 'Wealth Redistribution',
        description: 'Redistributive policies to reduce inequality',
        category: POLICY_CATEGORIES.ECONOMIC,
        cost: 60,
        monthlyCost: 20,
        duration: 30,
        requiredReputation: -40,
        effects: {
            citizens: 15,
            corp: -15,
            economy: {
                wageMultiplier: 1.05,
                incomeMultiplier: 0.95
            }
        },
        factionImpact: {
            citizens: 20,
            corp: -20,
            gangs: -5
        }
    },
    // Social Policies
    public_health_initiative: {
        id: 'public_health_initiative',
        name: 'Public Health Initiative',
        description: 'Invest in public health to improve citizen well-being',
        category: POLICY_CATEGORIES.SOCIAL,
        cost: 100,
        monthlyCost: 15,
        duration: 60,
        requiredReputation: -35,
        effects: {
            citizens: 12,
            health: 10,
            crimeRate: -5
        },
        factionImpact: {
            citizens: 18,
            police: -5
        }
    },
    education_expansion: {
        id: 'education_expansion',
        name: 'Education Expansion',
        description: 'Expand education programs for long-term benefits',
        category: POLICY_CATEGORIES.SOCIAL,
        cost: 120,
        monthlyCost: 10,
        duration: 90,
        requiredReputation: -30,
        effects: {
            citizens: 10,
            education: 15,
            jobProduction: 8
        },
        factionImpact: {
            citizens: 15,
            corp: 5
        }
    },
    curfew_enforcement: {
        id: 'curfew_enforcement',
        name: 'Curfew Enforcement',
        description: 'Strict curfew to reduce nighttime crime',
        category: POLICY_CATEGORIES.SOCIAL,
        cost: 40,
        monthlyCost: 5,
        duration: 30,
        requiredReputation: -10,
        effects: {
            citizens: -10,
            police: 10,
            crimeRate: -10
        },
        factionImpact: {
            citizens: -15,
            police: 15,
            gangs: -15
        }
    },
    // Security Policies
    police_surveillance: {
        id: 'police_surveillance',
        name: 'Police Surveillance',
        description: 'Expand police surveillance capabilities',
        category: POLICY_CATEGORIES.SECURITY,
        cost: 80,
        monthlyCost: 10,
        duration: 45,
        requiredReputation: -25,
        effects: {
            police: 15,
            citizens: -8,
            heatDecayMultiplier: 0.7
        },
        factionImpact: {
            police: 20,
            citizens: -10,
            gangs: -20
        }
    },
    military_curfew: {
        id: 'military_curfew',
        name: 'Military Curfew',
        description: 'Deploy military for strict order maintenance',
        category: POLICY_CATEGORIES.SECURITY,
        cost: 150,
        monthlyCost: 25,
        duration: 30,
        requiredReputation: 0,
        effects: {
            police: 25,
            citizens: -20,
            gangs: -30,
            crimeRate: -15
        },
        factionImpact: {
            police: 30,
            citizens: -25,
            gangs: -35
        }
    },
    // Infrastructure Policies
    infrastructure_investment: {
        id: 'infrastructure_investment',
        name: 'Infrastructure Investment',
        description: 'Major investment in city infrastructure',
        category: POLICY_CATEGORIES.INFRASTRUCTURE,
        cost: 200,
        monthlyCost: 15,
        duration: 60,
        requiredReputation: -20,
        effects: {
            citizens: 8,
            economy: {
                jobProduction: 15
            },
            coverage: 5
        },
        factionImpact: {
            citizens: 12,
            corp: 5
        }
    },
    green_zones: {
        id: 'green_zones',
        name: 'Green Zones',
        description: 'Create green spaces for citizen well-being',
        category: POLICY_CATEGORIES.INFRASTRUCTURE,
        cost: 90,
        monthlyCost: 5,
        duration: 45,
        requiredReputation: -15,
        effects: {
            citizens: 10,
            happinessBias: 3,
            crimeRate: -3
        },
        factionImpact: {
            citizens: 15,
            police: -2
        }
    },
    // Diplomacy Policies
    trade_agreements: {
        id: 'trade_agreements',
        name: 'Trade Agreements',
        description: 'Establish favorable trade agreements',
        category: POLICY_CATEGORIES.DIPLOMACY,
        cost: 60,
        monthlyCost: 0,
        duration: 90,
        requiredReputation: -30,
        effects: {
            economy: {
                incomeMultiplier: 1.1,
                wageMultiplier: 1.02
            },
            corp: 10,
            citizens: 5
        },
        factionImpact: {
            corp: 15,
            citizens: 8,
            gangs: -5
        }
    },
    rival_aid: {
        id: 'rival_aid',
        name: 'Rival Aid',
        description: 'Provide aid to rival city for diplomatic stability',
        category: POLICY_CATEGORIES.DIPLOMACY,
        cost: 100,
        monthlyCost: 15,
        duration: 60,
        requiredReputation: 20,
        effects: {
            rivalInfluence: 10,
            heatDecayMultiplier: 1.2,
            stability: 10
        },
        factionImpact: {
            citizens: 5,
            rival: 15
        }
    },
    trade_embargo: {
        id: 'trade_embargo',
        name: 'Trade Embargo',
        description: 'Ban trade with rival cities for security',
        category: POLICY_CATEGORIES.DIPLOMACY,
        cost: 50,
        monthlyCost: 0,
        duration: 30,
        requiredReputation: -20,
        effects: {
            rivalInfluence: -10,
            police: 5,
            security: 5
        },
        factionImpact: {
            citizens: -5,
            police: 8,
            gangs: 5
        }
    }
};

// Policy enforcement states
export const POLICY_STATES = {
    DRAFT: 'draft',
    ENACTED: 'enacted',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
};

// Policy Manager class
export class PolicyManager {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;
        this.activePolicies = []; // Array of { policyId, tickEnacted, ticksRemaining }
        this.policyHistory = []; // Past policies with outcomes
        this.pendingPolicies = []; // Policies being considered
    }

    /**
     * Get all policy definitions
     * @returns {Object} Policy definitions
     */
    getPolicyDefinitions() {
        return POLICY_DEFINITIONS;
    }

    /**
     * Get active policies
     * @returns {Array} Active policy objects
     */
    getActivePolicies() {
        return this.activePolicies;
    }

    /**
     * Get enacted policies (for UI compatibility)
     * @returns {Array} Array of policy objects with full definition
     */
    getEnactedPolicies() {
        return this.activePolicies.map(ap => {
            const def = POLICY_DEFINITIONS[ap.policyId];
            return def ? { ...def, ...ap } : null;
        }).filter(Boolean);
    }

    /**
     * Get available/pending policies (for UI compatibility)
     * @returns {Array} Array of pending policy IDs
     */
    getAvailablePolicies() {
        return this.pendingPolicies.map(pid => POLICY_DEFINITIONS[pid]).filter(Boolean);
    }

    /**
     * Get policy by ID
     * @param {string} policyId - Policy identifier
     * @returns {Object|null} Policy definition or null
     */
    getPolicyById(policyId) {
        return POLICY_DEFINITIONS[policyId] || null;
    }

    /**
     * Check if player can enact a policy
     * @param {string} policyId - Policy to check
     * @returns {Object} { canEnact: boolean, reason?: string }
     */
    canEnactPolicy(policyId) {
        const policy = POLICY_DEFINITIONS[policyId];
        if (!policy) {
            return { canEnact: false, reason: 'Policy not found' };
        }

        const rep = this.game.state.factions?.reputation || {};
        const playerRep = rep.citizens || 0;

        if (playerRep < policy.requiredReputation) {
            return {
                canEnact: false,
                reason: `Citizen reputation too low (need ${policy.requiredReputation}, have ${playerRep})`
            };
        }

        const budget = this.game.state.resources?.gold || 0;
        if (budget < policy.cost) {
            return {
                canEnact: false,
                reason: `Insufficient budget (need ${policy.cost}, have ${budget})`
            };
        }

        // Check for conflicting policies
        const conflicts = this.getConflictingPolicies(policy);
        if (conflicts.length > 0) {
            return {
                canEnact: false,
                reason: `Conflicts with active policies: ${conflicts.join(', ')}`
            };
        }

        return { canEnact: true };
    }

    /**
     * Get policies that conflict with a given policy
     * @param {Object} policy - Policy definition
     * @returns {Array} Array of conflicting policy IDs
     */
    getConflictingPolicies(policy) {
        const conflicts = {
            [POLICY_CATEGORIES.ECONOMIC]: ['tax_reduction', 'corporate_incentives', 'wealth_redistribution'],
            [POLICY_CATEGORIES.SOCIAL]: ['public_health_initiative', 'education_expansion', 'curfew_enforcement'],
            [POLICY_CATEGORIES.SECURITY]: ['police_surveillance', 'military_curfew'],
            [POLICY_CATEGORIES.INFRASTRUCTURE]: ['infrastructure_investment', 'green_zones'],
            [POLICY_CATEGORIES.DIPLOMACY]: ['trade_agreements', 'rival_aid']
        };

        const categoryConflicts = conflicts[policy.category] || [];
        return this.activePolicies
            .map(ap => ap.policyId)
            .filter(pid => categoryConflicts.includes(pid));
    }

    /**
     * Enact a new policy
     * @param {string} policyId - Policy to enact
     * @returns {Object} { success: boolean, error?: string, policy?: Object }
     */
    enactPolicy(policyId) {
        const validation = this.canEnactPolicy(policyId);
        if (!validation.canEnact) {
            return { success: false, error: validation.reason };
        }

        const policy = POLICY_DEFINITIONS[policyId];
        const budget = this.game.state.resources.gold;

        // Deduct cost
        this.game.state.resources.gold -= policy.cost;

        // Add to active policies
        const activePolicy = {
            policyId,
            tickEnacted: this.game.state.time.tick,
            ticksRemaining: policy.duration,
            state: POLICY_STATES.ENACTED
        };
        this.activePolicies.push(activePolicy);

        // Apply initial effects
        this.applyPolicyEffects(policy, activePolicy);

        // Log to history
        this.policyHistory.push({
            policyId,
            enactedTick: this.game.state.time.tick,
            duration: policy.duration,
            state: POLICY_STATES.ENACTED
        });

        // Emit event
        eventBus.emit(EVENT_TYPES.POLICY_ENACTED, {
            policyId,
            policyName: policy.name,
            tick: this.game.state.time.tick
        });

        // Notify player
        this.game.ui?.showMessage?.(`Policy enacted: ${policy.name}`, 'policy');

        return { success: true, policy: activePolicy };
    }

    /**
     * Apply policy effects to game state
     * @param {Object} policy - Policy definition
     * @param {Object} activePolicy - Active policy entry
     */
    applyPolicyEffects(policy, activePolicy) {
        // Faction reputation changes
        if (policy.factionImpact) {
            for (const [factionId, delta] of Object.entries(policy.factionImpact)) {
                this.game.factionSystem?.modifyRep?.(factionId, delta, `policy_${policy.id}`, 'politics');
            }
        }

        // Economy modifiers
        if (policy.effects?.economy) {
            if (!this.game.state.policyEconomyModifiers) {
                this.game.state.policyEconomyModifiers = {};
            }
            Object.assign(this.game.state.policyEconomyModifiers, policy.effects.economy);
        }

        // Other effects
        if (policy.effects?.health) {
            this.game.state.policyHealthBonus = (this.game.state.policyHealthBonus || 0) + policy.effects.health;
        }
        if (policy.effects?.crimeRate) {
            this.game.state.policyCrimeModifier = (this.game.state.policyCrimeModifier || 0) + policy.effects.crimeRate;
        }
        if (policy.effects?.happinessBias) {
            this.game.state.policyHappinessBias = (this.game.state.policyHappinessBias || 0) + policy.effects.happinessBias;
        }
    }

    /**
     * Revoke a policy early
     * @param {string} policyId - Policy to revoke
     * @returns {Object} { success: boolean, error?: string }
     */
    revokePolicy(policyId) {
        const idx = this.activePolicies.findIndex(ap => ap.policyId === policyId);
        if (idx === -1) {
            return { success: false, error: 'Policy not active' };
        }

        const activePolicy = this.activePolicies[idx];
        const policy = POLICY_DEFINITIONS[policyId];

        // Remove from active
        this.activePolicies.splice(idx, 1);

        // Reverse effects
        this.revokePolicyEffects(policy);

        // Update history
        const historyIdx = this.policyHistory.findIndex(ph => ph.policyId === policyId);
        if (historyIdx !== -1) {
            this.policyHistory[historyIdx].state = POLICY_STATES.REVOKED;
            this.policyHistory[historyIdx].revokedTick = this.game.state.time.tick;
        }

        // Emit event
        eventBus.emit(EVENT_TYPES.POLICY_REVOKED, {
            policyId,
            policyName: policy.name,
            tick: this.game.state.time.tick
        });

        this.game.ui?.showMessage?.(`Policy revoked: ${policy.name}`, 'policy');

        return { success: true };
    }

    /**
     * Revoke policy effects
     * @param {Object} policy - Policy definition
     */
    revokePolicyEffects(policy) {
        // Faction reputation reversals
        if (policy.factionImpact) {
            for (const [factionId, delta] of Object.entries(policy.factionImpact)) {
                this.game.factionSystem?.modifyRep?.(factionId, -delta, `policy_${policy.id}_revoked`, 'politics');
            }
        }

        // Clear economy modifiers (simplified - would need more sophisticated handling in production)
        if (policy.effects?.economy) {
            // Remove policy modifiers - in production, track which modifier came from where
        }
    }

    /**
     * Update policies each tick
     * @param {number} tick - Current tick
     */
    update(tick) {
        // Check for expired policies
        for (let i = this.activePolicies.length - 1; i >= 0; i--) {
            const ap = this.activePolicies[i];
            ap.ticksRemaining--;

            if (ap.ticksRemaining <= 0) {
                const policy = POLICY_DEFINITIONS[ap.policyId];
                ap.state = POLICY_STATES.EXPIRED;

                // Remove from active
                this.activePolicies.splice(i, 1);

                // Update history
                const historyIdx = this.policyHistory.findIndex(ph => ph.policyId === ap.policyId);
                if (historyIdx !== -1) {
                    this.policyHistory[historyIdx].state = POLICY_STATES.EXPIRED;
                }

                // Revoke effects
                this.revokePolicyEffects(policy);

                // Emit event
                eventBus.emit(EVENT_TYPES.POLICY_EXPIRED, {
                    policyId: ap.policyId,
                    policyName: policy.name,
                    tick
                });

                this.game.ui?.showMessage?.(`Policy expired: ${policy.name}`, 'policy');
            } else {
                // Check ongoing monthly costs
                const policy = POLICY_DEFINITIONS[ap.policyId];
                if (policy.monthlyCost > 0 && tick % 30 === 0) {
                    const budget = this.game.state.resources.gold;
                    if (budget >= policy.monthlyCost) {
                        this.game.state.resources.gold -= policy.monthlyCost;
                    } else {
                        // Policy fails due to lack of funding
                        this.revokePolicy(ap.policyId);
                        this.game.ui?.showMessage?.(`${policy.name} failed due to funding shortfall`, 'crisis');
                    }
                }
            }
        }
    }

    /**
     * Get policy telemetry for UI
     * @returns {Object} Policy telemetry
     */
    getTelemetry() {
        return {
            activePolicies: this.activePolicies.map(ap => ({
                policyId: ap.policyId,
                name: POLICY_DEFINITIONS[ap.policyId]?.name || ap.policyId,
                ticksRemaining: ap.ticksRemaining,
                totalDuration: POLICY_DEFINITIONS[ap.policyId]?.duration || 0,
                state: ap.state
            })),
            policyHistory: this.policyHistory.slice(-20).reverse(),
            pendingPolicies: this.pendingPolicies
        };
    }

    /**
     * Add policy to pending list (for UI consideration)
     * @param {string} policyId - Policy to consider
     */
    considerPolicy(policyId) {
        if (!this.pendingPolicies.includes(policyId)) {
            this.pendingPolicies.push(policyId);
            eventBus.emit(EVENT_TYPES.POLICY_CONSIDERED, { policyId });
        }
    }

    /**
     * Get remaining ticks for a policy
     * @param {string} policyId - Policy ID
     * @returns {number} Remaining ticks
     */
    getPolicyRemainingTicks(policyId) {
        const ap = this.activePolicies.find(p => p.policyId === policyId);
        return ap ? ap.ticksRemaining : 0;
    }

    /**
     * Get monthly cost of all enacted policies
     * @returns {number} Total monthly cost
     */
    getMonthlyCost() {
        let total = 0;
        for (const ap of this.activePolicies) {
            const policy = POLICY_DEFINITIONS[ap.policyId];
            if (policy) {
                total += policy.monthlyCost || 0;
            }
        }
        return total;
    }

    /**
     * Generate policies based on game state
     * @returns {Array} Available policies
     */
    generateAvailablePolicies() {
        const available = [];
        const rep = this.game.state.factions?.reputation || {};
        const playerRep = rep.citizens || 0;
        const budget = this.game.state.resources?.gold || 0;
        const tick = this.game.state.time.tick || 0;

        // Generate new policy opportunities
        if (tick % 10 === 0 && this.pendingPolicies.length < 5) {
            const categories = Object.values(POLICY_CATEGORIES);
            const randomCategory = categories[Math.floor(this.rng.float(0, categories.length))];

            const candidates = Object.values(POLICY_DEFINITIONS).filter(
                p => p.category === randomCategory && !this.activePolicies.find(ap => ap.policyId === p.id)
            );

            if (candidates.length > 0) {
                const candidate = candidates[Math.floor(this.rng.float(0, candidates.length))];
                if (!this.pendingPolicies.includes(candidate.id)) {
                    this.pendingPolicies.push(candidate.id);
                }
            }
        }

        return this.pendingPolicies;
    }
}

// Event type additions
EVENT_TYPES.POLICY_ENACTED = 'policy_enacted';
EVENT_TYPES.POLICY_REVOKED = 'policy_revoked';
EVENT_TYPES.POLICY_EXPIRED = 'policy_expired';
EVENT_TYPES.POLICY_CONSIDERED = 'policy_considered';