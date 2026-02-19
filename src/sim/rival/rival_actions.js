// Rival AI Action Catalog
// Defines all actions the rival can take and their effects

// Action types
export const RIVAL_ACTION_SABOTAGE_GRID = 'sabotage_grid';
export const RIVAL_ACTION_SPREAD_PROPAGANDA = 'spread_propaganda';
export const RIVAL_ACTION_POACH_WORKERS = 'poach_workers';
export const RIVAL_ACTION_TRIGGER_GANG_ACTIVITY = 'trigger_gang_activity';
export const RIVAL_ACTION_BRIBE_OFFICIALS = 'bribe_officials';
export const RIVAL_ACTION_ECONOMIC_SPYING = 'economic_spying';
export const RIVAL_ACTION_MEDIA_BLACKOUT = 'media_blackout';
export const RIVAL_ACTION_COOLDOWN = 'cooldown';

// Action catalog with definitions
export const RIVAL_ACTION_CATALOG = {
    [RIVAL_ACTION_SABOTAGE_GRID]: {
        name: 'Sabotage Grid',
        description: 'Disrupts resource production across the city',
        cost: 150, // Rival budget cost
        heatCost: 10, // Increases player heat if discovered
        minHeat: 30, // Minimum player heat for success
        impact: {
            gold: -20,
            food: -15,
            wood: -10
        },
        duration: 3, // Days
        message: 'Rival sabotage disrupted your resource grids!'
    },
    [RIVAL_ACTION_SPREAD_PROPAGANDA]: {
        name: 'Spread Propaganda',
        description: 'Reduces citizen loyalty to your rule',
        cost: 100,
        heatCost: 8,
        minHeat: 20,
        impact: {
            happiness: -15,
            population: -5 // Workers leave the city
        },
        duration: 5,
        message: 'Rival propaganda is turning citizens against you!'
    },
    [RIVAL_ACTION_POACH_WORKERS]: {
        name: 'Poach Workers',
        description: 'Steals skilled workers to rival city',
        cost: 80,
        heatCost: 5,
        minHeat: 25,
        impact: {
            jobProduction: { gold: -5, food: -5, wood: -5 },
            population: -8
        },
        duration: 2,
        message: 'Rival has poached skilled workers from your city!'
    },
    [RIVAL_ACTION_TRIGGER_GANG_ACTIVITY]: {
        name: 'Trigger Gang Activity',
        description: 'Incites criminal unrest in your districts',
        cost: 120,
        heatCost: 12,
        minHeat: 40,
        impact: {
            security: -20,
            income: -10
        },
        duration: 4,
        message: 'Gang activity has erupted in your districts!'
    },
    [RIVAL_ACTION_BRIBE_OFFICIALS]: {
        name: 'Bribe Officials',
        description: 'Corrupts your town officials',
        cost: 200,
        heatCost: 15,
        minHeat: 50,
        impact: {
            gold: -30,
            trust: -25
        },
        duration: 6,
        message: 'Your officials have been bribed by the rival!'
    },
    [RIVAL_ACTION_ECONOMIC_SPYING]: {
        name: 'Economic Spying',
        description: 'Steals trade secrets and disrupts markets',
        cost: 180,
        heatCost: 10,
        minHeat: 35,
        impact: {
            marketIncome: -25,
            gold: -15
        },
        duration: 3,
        message: 'Economic espionage has hit your markets!'
    },
    [RIVAL_ACTION_MEDIA_BLACKOUT]: {
        name: 'Media Blackout',
        description: 'Silences positive news about your city',
        cost: 90,
        heatCost: 7,
        minHeat: 15,
        impact: {
            popularity: -10,
            recruitment: -15
        },
        duration: 4,
        message: 'Negative media coverage is damaging your reputation!'
    },
    [RIVAL_ACTION_COOLDOWN]: {
        name: 'Reorganize',
        description: 'Rival regroups and recovers heat',
        cost: 0,
        heatCost: -20, // Reduces rival heat
        minHeat: 0,
        impact: {},
        duration: 1,
        message: 'Rival is reorganizing...'
    }
};

// Action categories for AI decision making
export const RIVAL_ACTION_CATEGORIES = {
    economic: [
        RIVAL_ACTION_SABOTAGE_GRID,
        RIVAL_ACTION_ECONOMIC_SPYING,
        RIVAL_ACTION_BRIBE_OFFICIALS
    ],
    social: [
        RIVAL_ACTION_SPREAD_PROPAGANDA,
        RIVAL_ACTION_MEDIA_BLACKOUT,
        RIVAL_ACTION_TRIGGER_GANG_ACTIVITY
    ],
    workforce: [
        RIVAL_ACTION_POACH_WORKERS
    ],
    defensive: [
        RIVAL_ACTION_COOLDOWN
    ]
};

/**
 * Calculates the utility of an action based on city state
 * @param {Object} state - Current game state
 * @param {string} actionType - Action to evaluate
 * @returns {number} Utility score (higher = more likely to be chosen)
 */
export function calculateActionUtility(state, actionType) {
    const action = RIVAL_ACTION_CATALOG[actionType];
    const playerHeat = state.player?.heat || 0;
    const rival = state.rival;

    if (!rival || rival.budget < action.cost) {
        return -100; // Cannot afford
    }

    // Base utility
    let utility = 50;

    // Check heat threshold
    if (playerHeat < action.minHeat) {
        utility -= 40; // Less effective against low-heat players
    }

    // Bonus for actions that counter player strengths
    const income = state.resources.jobProduction;

    if (actionType === RIVAL_ACTION_SABOTAGE_GRID) {
        // More valuable when player has high income
        utility += (income.gold + income.food + income.wood) / 10;
    }

    if (actionType === RIVAL_ACTION_POACH_WORKERS) {
        // More valuable when player has many employed citizens
        utility += state.citizens?.list?.filter(c => c.job && c.job !== 'unemployed').length * 2;
    }

    if (actionType === RIVAL_ACTION_SPREAD_PROPAGANDA) {
        // More valuable when player has low happiness
        const avgHappiness = state.citizens?.list?.reduce((sum, c) => sum + (c.happiness || 0), 0) / (state.citizens?.list?.length || 1);
        utility += (50 - avgHappiness) / 2;
    }

    // Rival heat adjustment (high heat = more desperate/aggressive)
    if (rival.heat > 60) {
        utility += 20; // More aggressive when under pressure
    }

    // Random factor for unpredictability
    utility += (rng ? rng.float(0, 20) : 0);

    return utility;
}

/**
 * Selects the best action for the rival AI
 * @param {Object} state - Current game state
 * @returns {string} Selected action type
 */
export function selectBestAction(state, rng) {
    const categories = RIVAL_ACTION_CATEGORIES;
    const allActions = [
        ...categories.economic,
        ...categories.social,
        ...categories.workforce,
        ...categories.defensive
    ];

    let bestAction = RIVAL_ACTION_COOLDOWN;
    let bestUtility = -50;

    for (const actionType of allActions) {
        const utility = calculateActionUtility(state, actionType);
        if (utility > bestUtility) {
            bestUtility = utility;
            bestAction = actionType;
        }
    }

    return bestAction;
}