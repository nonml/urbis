// Run start scenarios and mutators system for roguelike gameplay variation
import { RNG } from '../rng.js';

// Scenario definitions - pre-game configurations
export const SCENARIOS = {
    // Default/Standard scenario
    standard: {
        name: 'Standard City',
        description: 'Classic city-building experience with balanced conditions.',
        difficulty: 'normal',
        startingGold: 100,
        startingPopulation: 10,
        taxRates: { residential: 5, commercial: 8, industrial: 6 },
        mutators: [],
    },
    // Challenge scenarios
    quick_start: {
        name: 'Quick Start',
        description: 'Begin with extra gold for faster expansion.',
        difficulty: 'easy',
        startingGold: 150,
        startingPopulation: 10,
        taxRates: { residential: 5, commercial: 8, industrial: 6 },
        mutators: ['starting_gold_bonus'],
    },
    survival: {
        name: 'Survival Mode',
        description: 'Tight budget with lower starting funds but higher rewards.',
        difficulty: 'hard',
        startingGold: 50,
        startingPopulation: 8,
        taxRates: { residential: 5, commercial: 8, industrial: 6 },
        mutators: [],
    },
    rapid_growth: {
        name: 'Rapid Expansion',
        description: 'Citizens arrive 25% faster for accelerated city growth.',
        difficulty: 'normal',
        startingGold: 100,
        startingPopulation: 10,
        taxRates: { residential: 5, commercial: 8, industrial: 6 },
        mutators: ['faster_growth'],
    },
    low_crime: {
        name: 'Safe City',
        description: 'Starting crime rates reduced for easier early game.',
        difficulty: 'easy',
        startingGold: 100,
        startingPopulation: 10,
        taxRates: { residential: 5, commercial: 8, industrial: 6 },
        mutators: ['reduced_crime'],
    },
    service_bonus: {
        name: 'Service Focus',
        description: 'Services have 20% larger coverage radius.',
        difficulty: 'normal',
        startingGold: 100,
        startingPopulation: 10,
        taxRates: { residential: 5, commercial: 8, industrial: 6 },
        mutators: ['better_coverage'],
    },
    high_stakes: {
        name: 'High Stakes',
        description: 'Tighter bankruptcy timer - watch your treasury closely!',
        difficulty: 'hard',
        startingGold: 100,
        startingPopulation: 10,
        taxRates: { residential: 6, commercial: 9, industrial: 7 },
        mutators: [],
    },
};

// Mutator definitions - run-time modifiers
export const MUTATORS = {
    starting_gold_bonus: {
        name: 'Gold Start',
        description: 'Start runs with +50% initial gold',
        effect: (state, rng) => {
            state.resources.gold = Math.floor(state.resources.gold * 1.5);
            return { goldBonus: 50 };
        },
    },
    faster_growth: {
        name: 'Rapid Expansion',
        description: 'Citizens arrive 25% faster',
        effect: (state, rng) => {
            state.citizens.birthRate = (state.citizens.birthRate || 0.02) * 1.25;
            return { growthMultiplier: 1.25 };
        },
    },
    reduced_crime: {
        name: 'Low Crime',
        description: 'Initial crime rates reduced by 30%',
        effect: (state, rng) => {
            // Store reduced crime flag for crime generator
            state.flags = state.flags || {};
            state.flags.reducedCrime = true;
            return { crimeReduction: 30 };
        },
    },
    better_coverage: {
        name: 'Extended Coverage',
        description: 'Services have 20% larger radius',
        effect: (state, rng) => {
            state.flags = state.flags || {};
            state.flags.betterCoverage = true;
            return { coverageMultiplier: 1.2 };
        },
    },
    higher_taxes: {
        name: 'Tax Boost',
        description: 'Start with higher tax rates (more immediate income)',
        effect: (state, rng) => {
            const rates = state.resources.taxRates || { residential: 5, commercial: 8, industrial: 6 };
            state.resources.taxRates = {
                residential: Math.min(15, rates.residential + 3),
                commercial: Math.min(15, rates.commercial + 3),
                industrial: Math.min(15, rates.industrial + 3),
            };
            return { taxIncrease: 3 };
        },
    },
    slower_growth: {
        name: 'Steady Development',
        description: 'Citizens arrive slower but with higher satisfaction',
        effect: (state, rng) => {
            state.citizens.birthRate = (state.citizens.birthRate || 0.02) * 0.75;
            state.citizens.happinessBonus = 10;
            return { growthReduction: 25, happinessBonus: 10 };
        },
    },
    financial_discipline: {
        name: 'Financial Discipline',
        description: 'Lower starting debt limit but better loan terms',
        effect: (state, rng) => {
            state.flags = state.flags || {};
            state.flags.financialDiscipline = true;
            return { loanTerms: 'better' };
        },
    },
    chaotic_start: {
        name: 'Chaotic Start',
        description: 'Higher initial crime but potential for greater rewards',
        effect: (state, rng) => {
            state.flags = state.flags || {};
            state.flags.chaoticStart = true;
            return { crimeMultiplier: 1.5 };
        },
    },
};

// Scenario selection UI helper
export class ScenarioSelector {
    constructor(game) {
        this.game = game;
        this.selectedScenario = 'standard';
        this.activeMutators = [];
    }

    // Get available scenarios
    getScenarios() {
        return Object.entries(SCENARIOS).map(([key, scenario]) => ({
            id: key,
            ...scenario,
        }));
    }

    // Get available mutators
    getMutators() {
        return Object.entries(MUTATORS).map(([key, mutator]) => ({
            id: key,
            ...mutator,
        }));
    }

    // Select a scenario
    selectScenario(scenarioId) {
        if (SCENARIOS[scenarioId]) {
            this.selectedScenario = scenarioId;
            return true;
        }
        return false;
    }

    // Toggle a mutator
    toggleMutator(mutatorId) {
        const index = this.activeMutators.indexOf(mutatorId);
        if (index > -1) {
            this.activeMutators.splice(index, 1);
        } else {
            this.activeMutators.push(mutatorId);
        }
    }

    // Apply selected scenario and mutators to game state
    applyToGameState(state) {
        const scenario = SCENARIOS[this.selectedScenario];
        if (!scenario) return state;

        // Apply scenario defaults
        state.resources.gold = scenario.startingGold;
        state.resources.population = scenario.startingPopulation;
        state.resources.taxRates = scenario.taxRates;

        // Apply mutators
        const results = [];
        const rng = new RNG(state.meta.seed);

        for (const mutatorId of this.activeMutators) {
            const mutator = MUTATORS[mutatorId];
            if (mutator && typeof mutator.effect === 'function') {
                const result = mutator.effect(state, rng);
                results.push({ mutator: mutatorId, result });
            }
        }

        state.flags = state.flags || {};
        state.flags.scenario = this.selectedScenario;
        state.flags.mutators = this.activeMutators;
        state.flags.mutatorResults = results;

        return state;
    }

    // Get scenario description
    getScenarioDescription(scenarioId) {
        return SCENARIOS[scenarioId]?.description || '';
    }

    // Get mutator description
    getMutatorDescription(mutatorId) {
        return MUTATORS[mutatorId]?.description || '';
    }

    // Check if a mutator is active
    isMutatorActive(mutatorId) {
        return this.activeMutators.includes(mutatorId);
    }
}

// Scenario persistence
export class ScenarioPersistence {
    constructor() {
        this.storageKey = 'city_rogue_scenarios_v1';
        this.lastScenario = 'standard';
        this.lastMutators = [];
        this.load();
    }

    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.lastScenario = parsed.lastScenario || 'standard';
                this.lastMutators = parsed.lastMutators || [];
            }
        } catch (e) {
            console.warn('Failed to load scenario persistence:', e);
        }
    }

    save(scenarioId, mutators) {
        this.lastScenario = scenarioId;
        this.lastMutators = mutators || [];

        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                lastScenario: this.lastScenario,
                lastMutators: this.lastMutators,
            }));
        } catch (e) {
            console.warn('Failed to save scenario persistence:', e);
        }
    }

    getDefaultScenario() {
        return this.lastScenario;
    }

    getDefaultMutators() {
        return [...this.lastMutators];
    }

    reset() {
        this.lastScenario = 'standard';
        this.lastMutators = [];
        localStorage.removeItem(this.storageKey);
    }
}

// Scenario selector factory
export function createScenarioSelector(game) {
    return new ScenarioSelector(game);
}

// Scenario persistence factory
export const scenarioPersistence = new ScenarioPersistence();