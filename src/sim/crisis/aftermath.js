// Aftermath System - Manages long-term consequences of crises
// Handles recovery, reputation impacts, and future risk assessment

import { CRISIS_TYPES } from '../../constants.js';
import { EVENT_TYPES as GAME_EVENT_TYPES, eventBus } from '../events.js';

// Aftermath effect types
export const AFTERMATH_TYPES = {
    ECONOMIC: 'economic',
    SOCIAL: 'social',
    INFRASTRUCTURE: 'infrastructure',
    POLITICAL: 'political',
    REPUTATION: 'reputation'
};

// Recovery phases
export const RECOVERY_PHASE = {
    IMMEDIATE: 'immediate', // 0-3 days
    SHORT_TERM: 'short_term', // 3-14 days
    MEDIUM_TERM: 'medium_term', // 14-30 days
    LONG_TERM: 'long_term', // 30+ days
    COMPLETED: 'completed'
};

// Recovery state
export const RECOVERY_STATE = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    SLOW: 'slow',
    MODERATE: 'moderate',
    FAST: 'fast',
    COMPLETE: 'complete'
};

export class CrisisAftermath {
    constructor(crisisId, type, severity, damage) {
        this.crisisId = crisisId;
        this.type = type;
        this.severity = severity;
        this.damage = damage || { gold: 0, food: 0, wood: 0, population: 0 };
        this.phase = RECOVERY_PHASE.IMMEDIATE;
        this.state = RECOVERY_STATE.PENDING;
        this.daysInPhase = 0;
        this.recoveryProgress = 0;
        this.effects = [];
        this.citizensAffected = [];
        this.reputationImpact = 0;
        this.longTermEffects = [];
    }

    // Add an effect
    addEffect(effectType, magnitude, duration) {
        this.effects.push({
            type: effectType,
            magnitude: magnitude,
            duration: duration,
            remaining: duration
        });
    }

    // Tick the aftermath
    tick() {
        this.daysInPhase++;
        this.recoveryProgress = Math.min(100, this.recoveryProgress + this.getRecoveryRate());

        // Progress through phases
        this.updatePhase();

        // Update effects
        this.updateEffects();

        // Check if complete
        if (this.recoveryProgress >= 100) {
            this.state = RECOVERY_STATE.COMPLETE;
        }
    }

    // Update current recovery phase
    updatePhase() {
        if (this.phase === RECOVERY_PHASE.COMPLETED) return;

        if (this.daysInPhase > 30) {
            this.phase = RECOVERY_PHASE.LONG_TERM;
        } else if (this.daysInPhase > 14) {
            this.phase = RECOVERY_PHASE.MEDIUM_TERM;
        } else if (this.daysInPhase > 3) {
            this.phase = RECOVERY_PHASE.SHORT_TERM;
        }
    }

    // Get current recovery rate based on phase and effects
    getRecoveryRate() {
        let baseRate = 1.5; // Base recovery progress per day

        // Adjust by phase
        switch (this.phase) {
            case RECOVERY_PHASE.IMMEDIATE:
                baseRate *= 3.0; // Rapid initial recovery
                break;
            case RECOVERY_PHASE.SHORT_TERM:
                baseRate *= 1.5;
                break;
            case RECOVERY_PHASE.MEDIUM_TERM:
                baseRate *= 0.8;
                break;
            case RECOVERY_PHASE.LONG_TERM:
                baseRate *= 0.5;
                break;
        }

        // Adjust by effects
        for (const effect of this.effects) {
            if (effect.type === AFTERMATH_TYPES.ECONOMIC) {
                baseRate *= (1 + effect.magnitude * 0.1);
            } else if (effect.type === AFTERMATH_TYPES.INFRASTRUCTURE) {
                baseRate *= (1 - effect.magnitude * 0.2);
            } else if (effect.type === AFTERMATH_TYPES.SOCIAL) {
                baseRate *= (1 - effect.magnitude * 0.1);
            }
        }

        return Math.max(0.1, baseRate);
    }

    // Update active effects
    updateEffects() {
        for (const effect of this.effects) {
            effect.remaining--;
            if (effect.remaining <= 0) {
                this.removeEffect(effect);
            }
        }
    }

    // Remove an effect
    removeEffect(effect) {
        this.effects = this.effects.filter(e => e !== effect);
    }

    // Get recovery statistics
    getStats() {
        return {
            crisisId: this.crisisId,
            type: this.type,
            phase: this.phase,
            state: this.state,
            daysInPhase: this.daysInPhase,
            recoveryProgress: this.recoveryProgress,
            damage: this.damage,
            effectsCount: this.effects.length,
            citizensAffected: this.citizensAffected.length
        };
    }

    // Serialize for save
    serialize() {
        return {
            crisisId: this.crisisId,
            type: this.type,
            severity: this.severity,
            damage: this.damage,
            phase: this.phase,
            state: this.state,
            daysInPhase: this.daysInPhase,
            recoveryProgress: this.recoveryProgress,
            effects: this.effects,
            citizensAffected: this.citizensAffected,
            reputationImpact: this.reputationImpact,
            longTermEffects: this.longTermEffects
        };
    }
}

export class AftermathManager {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;

        // Active aftermaths
        this.aftermaths = [];

        // Recovery resources
        this.recoveryBudget = 100;
        this.recoveryTeams = 5;

        // Long-term risk assessment
        this.riskFactors = {};
        this.futureRiskScore = 0;

        // Reputation impacts
        this.citizenSentiment = {};
        this.factionReactions = {};

        // Events
        this.eventTypes = {
            AFTERMATH_CREATED: 'aftermath_created',
            RECOVERY_PROGRESS: 'recovery_progress',
            RECOVERY_COMPLETE: 'recovery_complete'
        };
    }

    // Create aftermath for a resolved crisis
    createAftermath(crisis) {
        const aftermath = new CrisisAftermath(
            crisis.id,
            crisis.type,
            crisis.severity,
            crisis.damage
        );

        // Add initial effects based on crisis type
        this.addInitialEffects(aftermath, crisis);

        this.aftermaths.push(aftermath);

        eventBus.emit(this.eventTypes.AFTERMATH_CREATED, {
            aftermathId: aftermath.crisisId,
            crisisType: crisis.type,
            severity: crisis.severity
        });

        return aftermath;
    }

    // Add initial effects based on crisis type
    addInitialEffects(aftermath, crisis) {
        switch (crisis.type) {
            case CRISIS_TYPES.FIRE:
                aftermath.addEffect(AFTERMATH_TYPES.INFRASTRUCTURE, 0.3, 10);
                aftermath.addEffect(AFTERMATH_TYPES.ECONOMIC, 0.2, 15);
                break;

            case CRISIS_TYPES.FLOOD:
                aftermath.addEffect(AFTERMATH_TYPES.INFRASTRUCTURE, 0.4, 12);
                aftermath.addEffect(AFTERMATH_TYPES.ECONOMIC, 0.25, 10);
                break;

            case CRISIS_TYPES.PLAGUE:
                aftermath.addEffect(AFTERMATH_TYPES.SOCIAL, 0.35, 20);
                aftermath.addEffect(AFTERMATH_TYPES.REPUTATION, 0.2, 15);
                break;

            case CRISIS_TYPES.RIOT:
                aftermath.addEffect(AFTERMATH_TYPES.POLITICAL, 0.3, 10);
                aftermath.addEffect(AFTERMATH_TYPES.REPUTATION, 0.25, 12);
                break;

            case CRISIS_TYPES.MIGRATION:
                aftermath.addEffect(AFTERMATH_TYPES.SOCIAL, 0.2, 8);
                aftermath.addEffect(AFTERMATH_TYPES.ECONOMIC, 0.15, 20);
                break;

            case CRISIS_TYPES.BLACKOUT:
                aftermath.addEffect(AFTERMATH_TYPES.INFRASTRUCTURE, 0.2, 5);
                aftermath.addEffect(AFTERMATH_TYPES.ECONOMIC, 0.3, 8);
                break;
        }

        // Add reputation impact
        aftermath.reputationImpact = crisis.severity * 5;
    }

    // Process all aftermaths
    updateAftermaths() {
        const completed = [];

        for (const aftermath of this.aftermaths) {
            if (aftermath.state === RECOVERY_STATE.PENDING) {
                aftermath.state = RECOVERY_STATE.IN_PROGRESS;
            }

            if (aftermath.state !== RECOVERY_STATE.COMPLETE) {
                aftermath.tick();

                // Log progress every 5 days
                if (aftermath.daysInPhase % 5 === 0) {
                    eventBus.emit(this.eventTypes.RECOVERY_PROGRESS, {
                        aftermathId: aftermath.crisisId,
                        phase: aftermath.phase,
                        progress: aftermath.recoveryProgress
                    });
                }

                if (aftermath.state === RECOVERY_STATE.COMPLETE) {
                    completed.push(aftermath.crisisId);
                    eventBus.emit(this.eventTypes.RECOVERY_COMPLETE, {
                        aftermathId: aftermath.crisisId,
                        totalDamage: aftermath.damage,
                        reputationImpact: aftermath.reputationImpact
                    });

                    // Apply long-term effects
                    this.applyLongTermEffects(aftermath);
                }
            }
        }

        this.aftermaths = this.aftermaths.filter(a => !completed.includes(a.crisisId));
    }

    // Apply long-term effects when recovery completes
    applyLongTermEffects(aftermath) {
        // Update risk factors
        this.updateRiskFactor(aftermath.type, aftermath.severity);

        // Update citizen sentiment
        this.updateCitizenSentiment(aftermath.type, aftermath.reputationImpact);

        // Update faction reactions
        this.updateFactionReactions(aftermath.type, aftermath.reputationImpact);

        // Add to long-term effects history
        this.game.crisis?.director?.completedCrises.push({
            id: aftermath.crisisId,
            type: aftermath.type,
            longTermEffects: aftermath.longTermEffects
        });
    }

    // Update risk factor for a crisis type
    updateRiskFactor(crisisType, severity) {
        if (!this.riskFactors[crisisType]) {
            this.riskFactors[crisisType] = 0;
        }

        this.riskFactors[crisisType] = Math.min(100,
            this.riskFactors[crisisType] + severity * 2);

        // Recalculate future risk score
        this.recalculateRiskScore();
    }

    // Recalculate overall future risk score
    recalculateRiskScore() {
        let score = 0;

        for (const [type, factor] of Object.entries(this.riskFactors)) {
            // Weight by type severity
            let weight = 1;
            switch (type) {
                case CRISIS_TYPES.PLAGUE:
                case CRISIS_TYPES.RIOT:
                    weight = 1.5;
                    break;
                case CRISIS_TYPES.FIRE:
                case CRISIS_TYPES.FLOOD:
                    weight = 1.2;
                    break;
            }

            score += factor * weight;
        }

        this.futureRiskScore = Math.floor(score / Object.keys(this.riskFactors).length || 1);
    }

    // Update citizen sentiment
    updateCitizenSentiment(crisisType, impact) {
        // Store sentiment by demographic
        const demographics = ['low_income', 'middle_income', 'high_income', 'elderly', 'youth'];

        for (const demo of demographics) {
            if (!this.citizenSentiment[demo]) {
                this.citizenSentiment[demo] = 50; // Neutral
            }

            this.citizenSentiment[demo] -= impact * 0.1;
            this.citizenSentiment[demo] = Math.max(0, Math.min(100, this.citizenSentiment[demo]));
        }
    }

    // Update faction reactions
    updateFactionReactions(crisisType, impact) {
        const factions = this.game.factions?.factions || [];

        for (const faction of factions) {
            if (!this.factionReactions[faction.id]) {
                this.factionReactions[faction.id] = { reactions: [] };
            }

            this.factionReactions[faction.id].reactions.push({
                crisisType: crisisType,
                impact: impact,
                timestamp: this.game.state.time.tick
            });
        }
    }

    // Get recovery statistics
    getStats() {
        let totalDamage = { gold: 0, food: 0, wood: 0, population: 0 };
        let avgProgress = 0;
        let activeCount = 0;

        for (const aftermath of this.aftermaths) {
            for (const [resource, amount] of Object.entries(aftermath.damage)) {
                totalDamage[resource] = (totalDamage[resource] || 0) + amount;
            }
            avgProgress += aftermath.recoveryProgress;
            activeCount++;
        }

        if (activeCount > 0) {
            avgProgress /= activeCount;
        }

        return {
            activeAftermaths: activeCount,
            completedCount: this.aftermaths.filter(a => a.state === RECOVERY_STATE.COMPLETE).length,
            totalDamage: totalDamage,
            avgProgress: avgProgress,
            riskFactors: this.riskFactors,
            futureRiskScore: this.futureRiskScore,
            citizenSentiment: this.citizenSentiment
        };
    }

    // Get active aftermaths for UI
    getActiveAftermaths() {
        return this.aftermaths.map(a => a.getStats());
    }

    // Get recovery speed modifiers
    getRecoveryModifiers() {
        const modifiers = [];

        // Infrastructure recovery bonus
        if (this.game.map) {
            const repairFacilities = this.game.buildings.buildings.filter(b => b.type === 'warehouse') || [];
            if (repairFacilities.length > 0) {
                modifiers.push({ name: 'Repair Facilities', bonus: repairFacilities.length * 0.1 });
            }
        }

        // Economic recovery
        const economy = this.game.economy;
        if (economy && economy.budget?.balance > 0) {
            modifiers.push({ name: 'Budget Surplus', bonus: 0.05 });
        }

        return modifiers;
    }

    // Serialize for save
    serialize() {
        return {
            aftermaths: this.aftermaths.map(a => a.serialize()),
            recoveryBudget: this.recoveryBudget,
            recoveryTeams: this.recoveryTeams,
            riskFactors: this.riskFactors,
            futureRiskScore: this.futureRiskScore,
            citizenSentiment: this.citizenSentiment,
            factionReactions: this.factionReactions
        };
    }

    // Deserialize from save
    deserialize(data) {
        this.aftermaths = data.aftermaths.map(d => {
            const aftermath = new CrisisAftermath(
                d.crisisId, d.type, d.severity, d.damage
            );
            aftermath.phase = d.phase;
            aftermath.state = d.state;
            aftermath.daysInPhase = d.daysInPhase;
            aftermath.recoveryProgress = d.recoveryProgress;
            aftermath.effects = d.effects;
            aftermath.citizensAffected = d.citizensAffected;
            aftermath.reputationImpact = d.reputationImpact;
            aftermath.longTermEffects = d.longTermEffects || [];
            return aftermath;
        });

        this.recoveryBudget = data.recoveryBudget || 100;
        this.recoveryTeams = data.recoveryTeams || 5;
        this.riskFactors = data.riskFactors || {};
        this.futureRiskScore = data.futureRiskScore || 0;
        this.citizenSentiment = data.citizenSentiment || {};
        this.factionReactions = data.factionReactions || {};
    }
}