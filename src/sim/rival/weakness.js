// Rival weakness calculator - computes city weakness vector for action selection
import { RIVAL_ACTION_CATALOG } from './rival_actions.js';

// Action categories and their weakness triggers
const ACTION_WEAKNESS_TRIGGERS = {
    sabotage_grid: ['low_power', 'high_income'],
    spread_propaganda: ['low_happiness', 'high_heat'],
    poach_workers: ['low_employment', 'high_wages'],
    trigger_gang_activity: ['low_police', 'high_inequality'],
    bribe_officials: ['high_heat', 'low_trust'],
    economic_spying: ['high_market', 'low_security'],
    media_blackout: ['positive_media', 'low_popularity'],
    cooldown: ['high_heat']
};

/**
 * Calculate weakness vector based on city state
 * @param {Object} state - Full game state
 * @returns {Object} Weakness scores 0-1 for each weakness type
 */
export function calculateWeaknessVector(state) {
    const vector = {
        economy: 0,
        services: 0,
        public_opinion: 0,
        security: 0,
        heat: 0
    };

    // Economy weakness (power deficit, resource shortages)
    const resources = state.resources || {};
    const jobProd = resources.jobProduction || {};
    const income = (jobProd.gold || 0) + (jobProd.food || 0) + (jobProd.wood || 0);
    const powerDemand = (state.buildings?.list?.length || 0) * 7;
    const powerSupply = state.world?.powerSupply || 0;
    const powerDeficit = powerSupply < powerDemand ? (powerDemand - powerSupply) / powerDemand : 0;
    vector.economy = Math.min(1, (income < 0 ? 0.5 : 0) + powerDeficit);

    // Services weakness (police coverage, health coverage)
    const services = state.servicesManager?.metrics?.city || {};
    vector.services = 1 - (services.police || 0.5);

    // Public opinion (happiness, trust)
    const citizens = state.citizens?.list || [];
    if (citizens.length > 0) {
        const avgHappiness = citizens.reduce((sum, c) => sum + (c.happiness || 50), 0) / citizens.length;
        vector.public_opinion = 1 - (avgHappiness / 100);
    }

    // Security weakness (heat, crime)
    const playerHeat = state.player?.heat || 0;
    vector.security = playerHeat / 100;

    // Heat factor (affects rival ability to act)
    vector.heat = playerHeat / 100;

    return vector;
}

/**
 * Calculate action utility based on weakness
 * @param {Object} state - Full game state
 * @param {string} actionType - Action to evaluate
 * @returns {number} Action utility score (higher = better match to weakness)
 */
export function calculateActionUtilityByWeakness(state, actionType) {
    const action = RIVAL_ACTION_CATALOG[actionType];
    const weakness = calculateWeaknessVector(state);

    if (!action) return -100;

    // Base utility
    let utility = 50;

    // Match action to city weaknesses
    if (actionType === 'sabotage_grid') {
        utility += weakness.economy * 40;
    }

    if (actionType === 'spread_propaganda') {
        utility += weakness.public_opinion * 40;
        utility += (state.player?.heat || 0) < 30 ? 20 : 0; // More effective against low-heat players
    }

    if (actionType === 'poach_workers') {
        const employed = state.citizens?.list?.filter(c => c.job && c.job !== 'unemployed').length || 0;
        utility += (employed > 10 ? 30 : 0);
        utility += weakness.economy * 20;
    }

    if (actionType === 'trigger_gang_activity') {
        utility += weakness.security * 40;
        utility += (state.factions?.reputation?.police || 0) < -40 ? 20 : 0; // Police hostility helps
    }

    if (actionType === 'bribe_officials') {
        utility += (state.player?.heat || 0) > 40 ? 30 : 0;
        utility += weakness.economy * 20;
    }

    if (actionType === 'economic_spying') {
        utility += weakness.economy * 30;
        utility += (state.factions?.reputation?.corp || 0) > 0 ? 20 : 0; // Corp friendly helps
    }

    if (actionType === 'media_blackout') {
        utility += weakness.public_opinion * 30;
    }

    // Rival heat affects aggression
    const rivalHeat = state.rival?.heat || 0;
    if (rivalHeat > 60) {
        utility += 20; // More aggressive when under pressure
    }

    // Budget constraint
    if (state.rival?.budget < action.cost) {
        utility -= 100;
    }

    return utility;
}

/**
 * Get top weakness categories for UI/dev
 * @param {Object} state - Full game state
 * @returns {Array} Top 3 weakness categories
 */
export function getTopWeaknesses(state) {
    const vector = calculateWeaknessVector(state);
    const entries = Object.entries(vector).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 3).map(([name, value]) => ({
        category: name,
        score: Math.round(value * 100)
    }));
}