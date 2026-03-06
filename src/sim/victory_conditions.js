/**
 * Victory Conditions System
 * Extended victory tracking with achievements and milestones
 */

export const VICTORY_TYPES = {
    STANDARD: 'standard',
    POPULATION: 'population',
    ECONOMIC: 'economic',
    CULTURAL: 'cultural',
    MILITARY: 'military',
    TECHNOLOGICAL: 'technological',
    CUSTOM: 'custom'
};

export const ACHIEVEMENT_CATEGORIES = {
    BUILDING: 'building',
    POPULATION: 'population',
    ECONOMY: 'economy',
    EXPLORE: 'explore',
    SOCIAL: 'social',
    MISC: 'misc'
};

/**
 * Default victory configuration
 */
export const DEFAULT_VICTORY_CONFIG = {
    // Standard victory (existing system)
    standard: {
        population: 50,
        avgHappiness: 60,
        holdTicks: 3
    },
    // Population victory
    population: {
        targetPopulation: 200,
        description: 'Reach a population of 200 citizens'
    },
    // Economic victory
    economic: {
        accumulatedGold: 5000,
        description: 'Accumulate 5000 gold over the course of the game'
    },
    // Cultural victory
    cultural: {
        monumentsBuilt: 5,
        happinessAverage: 80,
        description: 'Build 5 monuments and maintain 80% average happiness'
    },
    // Military victory
    military: {
        barracksCount: 3,
        maxDefense: 50,
        description: 'Build 3 barracks and reach 50 defense rating'
    },
    // Technological victory
    technological: {
        buildingsResearched: 10,
        description: 'Research and unlock 10 building types'
    }
};

/**
 * Default achievements
 */
export const DEFAULT_ACHIEVEMENTS = [
    // Building achievements
    {
        id: 'first_house',
        name: 'First Home',
        description: 'Build your first house',
        category: ACHIEVEMENT_CATEGORIES.BUILDING,
        check: (game) => game.buildings.buildings.some(b => b.type === 'house')
    },
    {
        id: 'master_builder',
        name: 'Master Builder',
        description: 'Build 50 structures',
        category: ACHIEVEMENT_CATEGORIES.BUILDING,
        check: (game) => game.buildings.buildings.length >= 50
    },
    {
        id: 'city_planner',
        name: 'City Planner',
        description: 'Build one of each building type',
        category: ACHIEVEMENT_CATEGORIES.BUILDING,
        check: (game) => {
            const types = new Set(game.buildings.buildings.map(b => b.type));
            return types.size >= 5;
        }
    },
    // Population achievements
    {
        id: 'growing_town',
        name: 'Growing Town',
        description: 'Reach a population of 25',
        category: ACHIEVEMENT_CATEGORIES.POPULATION,
        check: (game) => (game.resources.population || 0) >= 25
    },
    {
        id: 'thriving_city',
        name: 'Thriving City',
        description: 'Reach a population of 100',
        category: ACHIEVEMENT_CATEGORIES.POPULATION,
        check: (game) => (game.resources.population || 0) >= 100
    },
    {
        id: 'metropolis',
        name: 'Metropolis',
        description: 'Reach a population of 200',
        category: ACHIEVEMENT_CATEGORIES.POPULATION,
        check: (game) => (game.resources.population || 0) >= 200
    },
    // Economy achievements
    {
        id: 'first_gold',
        name: 'First Coin',
        description: 'Earn your first gold',
        category: ACHIEVEMENT_CATEGORIES.ECONOMY,
        check: (game) => (game.resources.gold || 0) > 0
    },
    {
        id: 'wealthy_trader',
        name: 'Wealthy Trader',
        description: 'Accumulate 1000 gold',
        category: ACHIEVEMENT_CATEGORIES.ECONOMY,
        check: (game) => (game.resources.gold || 0) >= 1000
    },
    {
        id: 'tycoon',
        name: 'Tycoon',
        description: 'Accumulate 5000 gold',
        category: ACHIEVEMENT_CATEGORIES.ECONOMY,
        check: (game) => (game.resources.gold || 0) >= 5000
    },
    // Social achievements
    {
        id: 'happy_citizen',
        name: 'Happy Citizens',
        description: 'Reach 80% average happiness',
        category: ACHIEVEMENT_CATEGORIES.SOCIAL,
        check: (game) => (game.citizens.getAverageHappiness?.() || 0) >= 80
    },
    {
        id: 'utopia',
        name: 'Utopia',
        description: 'Reach 95% average happiness',
        category: ACHIEVEMENT_CATEGORIES.SOCIAL,
        check: (game) => (game.citizens.getAverageHappiness?.() || 0) >= 95
    },
    // Exploration achievements
    {
        id: 'explorer',
        name: 'Explorer',
        description: 'Explore 25% of the map',
        category: ACHIEVEMENT_CATEGORIES.EXPLORE,
        check: (game) => {
            const totalTiles = game.map.width * game.map.height;
            const explored = game.map.exploredTiles?.size || 0;
            return explored >= totalTiles * 0.25;
        }
    },
    {
        id: 'cartographer',
        name: 'Cartographer',
        description: 'Explore 75% of the map',
        category: ACHIEVEMENT_CATEGORIES.EXPLORE,
        check: (game) => {
            const totalTiles = game.map.width * game.map.height;
            const explored = game.map.exploredTiles?.size || 0;
            return explored >= totalTiles * 0.75;
        }
    },
    // Miscellaneous achievements
    {
        id: 'survivor',
        name: 'Survivor',
        description: 'Survive for 7 days',
        category: ACHIEVEMENT_CATEGORIES.MISC,
        check: (game) => (game.resources.day || 1) >= 7
    },
    {
        id: 'veteran',
        name: 'Veteran',
        description: 'Survive for 30 days',
        category: ACHIEVEMENT_CATEGORIES.MISC,
        check: (game) => (game.resources.day || 1) >= 30
    }
];

/**
 * Create a victory conditions manager
 * @param {Object} game - The game instance
 * @param {Object} config - Optional configuration
 * @returns {VictoryManager} The victory manager instance
 */
export function createVictoryManager(game, config = {}) {
    return new VictoryManager(game, config);
}

/**
 * Victory Manager
 * Handles victory condition checking, achievements, and milestones
 */
export class VictoryManager {
    constructor(game, config = {}) {
        this.game = game;
        this.config = { ...DEFAULT_VICTORY_CONFIG, ...config };
        this.achievements = [...DEFAULT_ACHIEVEMENTS];
        
        this.state = {
            unlockedAchievements: [],
            milestoneProgress: {},
            victoryUnlocked: false,
            victoryType: null,
            victoryDetails: null
        };
        
        // Track progress towards milestones
        this._milestoneTrackers = new Map();
    }

    /**
     * Update victory conditions and check for completion
     * @returns {Object|null} Victory state if won, null otherwise
     */
    update() {
        if (this.state.victoryUnlocked) return null;
        
        // Check all victory types
        for (const [type, condition] of Object.entries(this.config)) {
            if (type === 'standard') continue; // Standard handled by GoalsManager
            
            if (this._checkVictoryCondition(type, condition)) {
                return this._triggerVictory(type, condition);
            }
        }
        
        // Check achievements
        this._updateAchievements();
        
        return null;
    }

    /**
     * Check if a victory condition is met
     * @param {string} type - Victory type
     * @param {Object} condition - Condition configuration
     * @returns {boolean} True if victory condition is met
     */
    _checkVictoryCondition(type, condition) {
        const resources = this.game.resources;
        
        switch (type) {
            case 'population':
                return (resources.population || 0) >= condition.targetPopulation;
                
            case 'economic':
                return (this.state.milestoneProgress.accumulatedGold || 0) >= condition.accumulatedGold;
                
            case 'cultural':
                const monuments = this.game.buildings.buildings.filter(
                    b => b.category === 'monument' || b.type.includes('monument')
                ).length;
                const happiness = this.game.citizens.getAverageHappiness?.() || 0;
                return monuments >= condition.monumentsBuilt && happiness >= condition.happinessAverage;
                
            case 'military':
                const barracks = this.game.buildings.buildings.filter(
                    b => b.type === 'barracks' || b.type.includes('barracks')
                ).length;
                const defense = resources.defense || 0;
                return barracks >= condition.barracksCount && defense >= condition.maxDefense;
                
            case 'technological':
                const researched = new Set(
                    this.game.buildings.buildings.map(b => b.type)
                ).size;
                return researched >= condition.buildingsResearched;
                
            default:
                return false;
        }
    }

    /**
     * Trigger victory
     * @param {string} type - Victory type
     * @param {Object} condition - Victory condition
     * @returns {Object} Victory state
     */
    _triggerVictory(type, condition) {
        this.state.victoryUnlocked = true;
        this.state.victoryType = type;
        this.state.victoryDetails = {
            type,
            title: this._getVictoryTitle(type),
            description: condition.description || 'Victory achieved!',
            timestamp: this.game.state.time.tick,
            day: this.game.resources.day
        };
        
        return this.state;
    }

    /**
     * Get victory title
     * @param {string} type - Victory type
     * @returns {string} Victory title
     */
    _getVictoryTitle(type) {
        const titles = {
            population: 'Population Victory',
            economic: 'Economic Victory',
            cultural: 'Cultural Victory',
            military: 'Military Victory',
            technological: 'Technological Victory',
            custom: 'Custom Victory'
        };
        return titles[type] || 'Victory!';
    }

    /**
     * Update achievement tracking
     */
    _updateAchievements() {
        for (const achievement of this.achievements) {
            if (this.state.unlockedAchievements.includes(achievement.id)) continue;
            
            try {
                if (achievement.check(this.game)) {
                    this._unlockAchievement(achievement);
                }
            } catch (e) {
                console.error(`Achievement check failed for ${achievement.id}:`, e);
            }
        }
    }

    /**
     * Unlock an achievement
     * @param {Object} achievement - Achievement to unlock
     */
    _unlockAchievement(achievement) {
        this.state.unlockedAchievements.push(achievement.id);
        
        // Store unlock timestamp
        this.state.milestoneProgress[`achievement_${achievement.id}`] = {
            unlockedAt: this.game.state.time.tick,
            day: this.game.resources.day
        };
        
        // Notify UI if available
        if (this.game.ui && this.game.ui.showAchievementNotification) {
            this.game.ui.showAchievementNotification(achievement);
        }
        
        // Play achievement sound
        if (this.game.audio?.playSound) {
            this.game.audio.playSound('achievement_unlocked');
        }
    }

    /**
     * Check if an achievement is unlocked
     * @param {string} achievementId - Achievement ID
     * @returns {boolean} True if unlocked
     */
    isAchievementUnlocked(achievementId) {
        return this.state.unlockedAchievements.includes(achievementId);
    }

    /**
     * Get all achievements
     * @param {string} category - Optional category filter
     * @returns {Array} Array of achievements
     */
    getAchievements(category = null) {
        let achievements = this.achievements.map(a => ({
            ...a,
            unlocked: this.state.unlockedAchievements.includes(a.id)
        }));
        
        if (category) {
            achievements = achievements.filter(a => a.category === category);
        }
        
        return achievements;
    }

    /**
     * Get victory progress
     * @param {string} victoryType - Victory type to check progress for
     * @returns {Object} Progress information
     */
    getVictoryProgress(victoryType = null) {
        const resources = this.game.resources;
        const progress = {};
        
        if (!victoryType || victoryType === 'population') {
            progress.population = {
                current: resources.population || 0,
                required: this.config.population.targetPopulation,
                percentage: Math.min(100, ((resources.population || 0) / this.config.population.targetPopulation) * 100)
            };
        }
        
        if (!victoryType || victoryType === 'economic') {
            progress.economic = {
                current: this.state.milestoneProgress.accumulatedGold || 0,
                required: this.config.economic.accumulatedGold,
                percentage: Math.min(100, ((this.state.milestoneProgress.accumulatedGold || 0) / this.config.economic.accumulatedGold) * 100)
            };
        }
        
        if (!victoryType || victoryType === 'cultural') {
            const monuments = this.game.buildings.buildings.filter(
                b => b.category === 'monument' || b.type.includes('monument')
            ).length;
            progress.cultural = {
                monuments: {
                    current: monuments,
                    required: this.config.cultural.monumentsBuilt,
                    percentage: Math.min(100, (monuments / this.config.cultural.monumentsBuilt) * 100)
                },
                happiness: {
                    current: this.game.citizens.getAverageHappiness?.() || 0,
                    required: this.config.cultural.happinessAverage,
                    percentage: Math.min(100, ((this.game.citizens.getAverageHappiness?.() || 0) / this.config.cultural.happinessAverage) * 100)
                }
            };
        }
        
        return progress;
    }

    /**
     * Update milestone progress (called by game when relevant changes occur)
     * @param {string} milestone - Milestone name
     * @param {number} value - Value to add
     */
    updateMilestone(milestone, value = 1) {
        const current = this.state.milestoneProgress[milestone] || 0;
        this.state.milestoneProgress[milestone] = current + value;
    }

    /**
     * Get victory state
     * @returns {Object} Current victory state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Check if game is won
     * @returns {boolean} True if victory is achieved
     */
    isVictory() {
        return this.state.victoryUnlocked;
    }

    /**
     * Reset victory state (for new game)
     */
    reset() {
        this.state = {
            unlockedAchievements: [],
            milestoneProgress: {},
            victoryUnlocked: false,
            victoryType: null,
            victoryDetails: null
        };
    }
}