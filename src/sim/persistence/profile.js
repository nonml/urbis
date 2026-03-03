// Profile persistence system for roguelike meta progression
// Stores unlocked content, stats, and high scores across runs

const STORAGE_KEY = 'city_rogue_profile_v1';
const PROFILE_VERSION = 1;

// Default profile data structure
const DEFAULT_PROFILE = {
    version: PROFILE_VERSION,
    lastRunId: null,
    lastSeed: null,
    lastEnded: null,
    totalRuns: 0,
    wins: 0,
    losses: 0,
    totalDaysSurvived: 0,
    totalGoldEarned: 0,
    totalPopulationReached: 0,
    unlocks: {
        // Building unlocks
        buildings: {
            basic_housing: false,
            advanced_housing: false,
            commercial_center: false,
            industrial_zone: false,
            power_plant: false,
            water_treatment: false,
            police_station: false,
            hospital: false,
            school: false,
            entertainment: false,
        },
        // Mutation/ability unlocks
        mutators: {
            starting_gold_bonus: false,
            faster_growth: false,
            reduced_crime: false,
            better_coverage: false,
        },
        // Game mode unlocks
        modes: {
            sandbox: true,  // Always unlocked
            challenges: false,
            time_trial: false,
        },
        // UI unlocks
        ui_features: {
            advanced_stats: false,
            replay_system: false,
            mutator_customization: false,
        },
    },
    stats: {
        bestDayReached: 1,
        bestPopulation: 0,
        bestHappiness: 0,
        highestGoldBalance: 0,
        totalBuildingsConstructed: 0,
        totalCrisesAVerted: 0,
        totalCasesCompleted: 0,
        mostEfficientRun: null,  // Days to win
    },
    highScores: [
        // { seed, score, date, days, population, happiness }
    ],
    runHistory: [
        // { runId, seed, days, ended, endState, score, mutators }
    ],
};

// Unlocks with their costs and requirements
const UNLOCK_TREE = {
    buildings: {
        basic_housing: {
            name: 'Basic Housing Template',
            description: 'Unlock basic residential building templates',
            cost: { runs: 1, days: 0 },
        },
        advanced_housing: {
            name: 'Advanced Housing',
            description: 'Unlock high-density residential buildings',
            cost: { runs: 3, days: 50 },
        },
        commercial_center: {
            name: 'Commercial Hub',
            description: 'Unlock large commercial complex buildings',
            cost: { runs: 5, days: 100 },
        },
        industrial_zone: {
            name: 'Industrial Complex',
            description: 'Unlock heavy industry buildings',
            cost: { runs: 7, days: 150 },
        },
        power_plant: {
            name: 'Power Infrastructure',
            description: 'Unlock multiple power generation options',
            cost: { runs: 4, days: 80 },
        },
        water_treatment: {
            name: 'Water Systems',
            description: 'Unlock advanced water treatment facilities',
            cost: { runs: 4, days: 80 },
        },
        police_station: {
            name: 'Law Enforcement',
            description: 'Unlock specialized police facilities',
            cost: { runs: 3, days: 60 },
        },
        hospital: {
            name: 'Medical Facilities',
            description: 'Unlock large medical centers',
            cost: { runs: 5, days: 100 },
        },
        school: {
            name: 'Education System',
            description: 'Unlock schools and universities',
            cost: { runs: 5, days: 100 },
        },
        entertainment: {
            name: 'Entertainment',
            description: 'Unlock parks and entertainment venues',
            cost: { runs: 6, days: 120 },
        },
    },
    mutators: {
        starting_gold_bonus: {
            name: 'Gold Start',
            description: 'Start runs with +50% initial gold',
            cost: { runs: 2, days: 0 },
        },
        faster_growth: {
            name: 'Rapid Expansion',
            description: 'Citizens arrive 25% faster',
            cost: { runs: 4, days: 80 },
        },
        reduced_crime: {
            name: 'Low Crime',
            description: 'Initial crime rates reduced by 30%',
            cost: { runs: 6, days: 120 },
        },
        better_coverage: {
            name: 'Extended Coverage',
            description: 'Services have 20% larger radius',
            cost: { runs: 8, days: 160 },
        },
    },
    modes: {
        challenges: {
            name: 'Challenge Mode',
            description: 'Unlock special challenge scenarios',
            cost: { runs: 10, days: 200 },
        },
        time_trial: {
            name: 'Time Trial',
            description: 'Unlock time-limited runs',
            cost: { runs: 12, days: 250 },
        },
    },
};

// Calculate score from a run
function calculateRunScore(state) {
    const progress = state.progress || {};
    const goalState = progress.goalState || {};
    const resources = state.resources || {};

    let score = 0;

    // Base score from days survived
    score += resources.day * 10;

    // Population bonus
    score += resources.population * 5;

    // Happiness bonus
    const happiness = state.citizens?.getAverageHappiness?.() || 0;
    score += happiness * 2;

    // Gold bonus
    score += resources.gold * 0.5;

    // Win/loss outcome
    if (goalState.kind === 'win') {
        score *= 2;  // Double score for wins
        score += 500;  // Win bonus
    } else if (goalState.kind === 'lose') {
        score *= 0.5;  // Half score for losses
    }

    // Efficiency bonus (days to win)
    if (goalState.kind === 'win') {
        const efficiency = Math.max(1, 100 - resources.day);
        score += efficiency * 10;
    }

    return Math.floor(score);
}

// Profile manager class
export class ProfileManager {
    constructor() {
        this.profile = this.loadProfile();
    }

    loadProfile() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === PROFILE_VERSION) {
                    return { ...DEFAULT_PROFILE, ...parsed };
                }
            }
        } catch (e) {
            console.warn('Failed to load profile:', e);
        }
        return { ...DEFAULT_PROFILE };
    }

    saveProfile() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
        } catch (e) {
            console.warn('Failed to save profile:', e);
        }
    }

    // Update profile after a run completes
    recordRun(gameState, ended) {
        const state = gameState || {};
        const progress = state.progress || {};
        const goalState = progress.goalState || {};
        const resources = state.resources || {};
        const meta = state.meta || {};

        const runId = meta.runId || 'unknown';
        const seed = meta.seed || 0;
        const days = resources.day || 0;
        const endState = goalState.kind || (ended ? 'interrupted' : 'running');

        // Update basic stats
        this.profile.totalRuns++;
        if (endState === 'win') this.profile.wins++;
        else this.profile.losses++;

        this.profile.totalDaysSurvived += days;
        this.profile.totalGoldEarned += resources.totalGoldEarned || 0;
        this.profile.totalPopulationReached = Math.max(
            this.profile.totalPopulationReached,
            resources.population || 0
        );

        // Update best stats
        this.profile.stats.bestDayReached = Math.max(
            this.profile.stats.bestDayReached,
            days
        );
        this.profile.stats.bestPopulation = Math.max(
            this.profile.stats.bestPopulation,
            resources.population || 0
        );
        this.profile.stats.highestGoldBalance = Math.max(
            this.profile.stats.highestGoldBalance,
            resources.gold || 0
        );

        // Calculate and record score
        const score = calculateRunScore(state);

        // Add to high scores (keep top 10)
        const newHighScore = {
            seed,
            score,
            date: Date.now(),
            days,
            population: resources.population || 0,
            happiness: state.citizens?.getAverageHappiness?.() || 0,
            endState,
        };

        this.profile.highScores.push(newHighScore);
        this.profile.highScores.sort((a, b) => b.score - a.score);
        this.profile.highScores = this.profile.highScores.slice(0, 10);

        // Add to run history
        this.profile.runHistory.push({
            runId,
            seed,
            days,
            ended: true,
            endState,
            score,
            mutators: this.profile.mutatorsApplied || [],
        });

        // Keep only last 50 runs
        this.profile.runHistory = this.profile.runHistory.slice(-50);

        // Update unlocks based on progress
        this.checkUnlocks();

        // Save
        this.saveProfile();
    }

    // Check and unlock content based on progress
    checkUnlocks() {
        const { totalRuns, totalDaysSurvived, stats } = this.profile;

        // Unlock buildings
        if (totalRuns >= 1) this.profile.unlocks.buildings.basic_housing = true;
        if (totalDaysSurvived >= 50) this.profile.unlocks.buildings.advanced_housing = true;
        if (totalRuns >= 5) this.profile.unlocks.buildings.commercial_center = true;
        if (totalDaysSurvived >= 150) this.profile.unlocks.buildings.industrial_zone = true;
        if (totalRuns >= 4) this.profile.unlocks.buildings.power_plant = true;
        if (totalDaysSurvived >= 80) this.profile.unlocks.buildings.water_treatment = true;
        if (totalRuns >= 3) this.profile.unlocks.buildings.police_station = true;
        if (totalDaysSurvived >= 100) {
            this.profile.unlocks.buildings.hospital = true;
            this.profile.unlocks.buildings.school = true;
        }
        if (totalRuns >= 6) this.profile.unlocks.buildings.entertainment = true;

        // Unlock mutators
        if (totalRuns >= 2) this.profile.unlocks.mutators.starting_gold_bonus = true;
        if (totalDaysSurvived >= 80) this.profile.unlocks.mutators.faster_growth = true;
        if (totalRuns >= 6) this.profile.unlocks.mutators.reduced_crime = true;
        if (totalDaysSurvived >= 160) this.profile.unlocks.mutators.better_coverage = true;

        // Unlock modes
        if (totalRuns >= 10) this.profile.unlocks.modes.challenges = true;
        if (totalRuns >= 12) this.profile.unlocks.modes.time_trial = true;

        // Unlock UI features
        if (totalRuns >= 5) this.profile.unlocks.ui_features.advanced_stats = true;
        if (totalRuns >= 8) this.profile.unlocks.ui_features.replay_system = true;
        if (totalRuns >= 10) this.profile.unlocks.ui_features.mutator_customization = true;
    }

    // Check if a specific unlock is available
    isUnlocked(category, key) {
        return this.profile.unlocks[category]?.[key] || false;
    }

    // Get unlock requirements
    getUnlockRequirements(category, key) {
        return UNLOCK_TREE[category]?.[key]?.cost || null;
    }

    // Get all unlocked items
    getUnlockedItems() {
        const unlocked = {};
        for (const category in UNLOCK_TREE) {
            unlocked[category] = [];
            for (const key in UNLOCK_TREE[category]) {
                if (this.isUnlocked(category, key)) {
                    unlocked[category].push(key);
                }
            }
        }
        return unlocked;
    }

    // Check if a mutator can be unlocked
    canUnlockMutator(mutatorName) {
        const mutators = UNLOCK_TREE.mutators || {};
        if (!mutators[mutatorName]) return false;

        const cost = mutators[mutatorName].cost;
        const { totalRuns, totalDaysSurvived } = this.profile;

        const runsMet = totalRuns >= cost.runs;
        const daysMet = totalDaysSurvived >= cost.days;

        return runsMet && daysMet && !this.isUnlocked('mutators', mutatorName);
    }

    // Unlock a mutator (paid with runs)
    unlockMutator(mutatorName) {
        if (!this.canUnlockMutator(mutatorName)) return false;

        // Deduct requirements (simplified: unlock directly for now)
        this.profile.unlocks.mutators[mutatorName] = true;
        this.saveProfile();
        return true;
    }

    // Get profile data for UI
    getProfileData() {
        return {
            ...this.profile,
            totalWins: this.profile.wins,
            totalLosses: this.profile.losses,
            winRate: this.profile.totalRuns > 0
                ? ((this.profile.wins / this.profile.totalRuns) * 100).toFixed(1)
                : '0',
            avgDaysPerRun: this.profile.totalRuns > 0
                ? (this.profile.totalDaysSurvived / this.profile.totalRuns).toFixed(1)
                : '0',
            unlockedCount: this.countUnlocked(),
            totalCount: this.countTotalUnlocks(),
        };
    }

    countUnlocked() {
        let count = 0;
        for (const category in this.profile.unlocks) {
            if (Array.isArray(this.profile.unlocks[category])) {
                count += this.profile.unlocks[category].length;
            } else {
                for (const key in this.profile.unlocks[category]) {
                    if (this.profile.unlocks[category][key]) count++;
                }
            }
        }
        return count;
    }

    countTotalUnlocks() {
        let count = 0;
        for (const category in UNLOCK_TREE) {
            count += Object.keys(UNLOCK_TREE[category]).length;
        }
        return count;
    }

    // Reset profile (for testing)
    reset() {
        this.profile = { ...DEFAULT_PROFILE };
        this.saveProfile();
    }
}

// Singleton instance
export const profileManager = new ProfileManager();

// Export utility functions
export { calculateRunScore, UNLOCK_TREE };