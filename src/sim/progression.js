// Progression & Unlocks System
// Manages player progression through the game

// Unlock definitions
export const UNLOCKS = {
    security_buildings: {
        id: 'security_buildings',
        name: 'Security Buildings',
        description: 'Unlocks Police Station, CCTV Network, Counter-Intel Office, and Propaganda Office',
        trigger: 'completed_cases: 3',
        unlocked: false
    },
    tech_tree_level_1: {
        id: 'tech_tree_level_1',
        name: 'Basic Technology',
        description: 'Unlock improved building plans and better infrastructure',
        trigger: 'completed_cases: 5',
        points: 50,
        unlocked: false
    },
    tech_tree_level_2: {
        id: 'tech_tree_level_2',
        name: 'Advanced Technology',
        description: 'Unlock advanced building techniques and research labs',
        trigger: 'completed_cases: 10',
        points: 100,
        unlocked: false
    },
    advanced_buildings: {
        id: 'advanced_buildings',
        name: 'Advanced Buildings',
        description: 'Unlocks Research Lab and Power Plant',
        trigger: 'completed_cases: 15',
        unlocked: false
    },
    victory_influence: {
        id: 'victory_influence',
        name: 'Influence Victory',
        description: 'Unlock Influence victory condition',
        trigger: 'completed_cases: 8',
        unlocked: false
    },
    high_security: {
        id: 'high_security',
        name: 'High Security',
        description: 'Unlocks maximum security capabilities and rival deterrence',
        trigger: 'completed_cases: 20',
        unlocked: false
    }
};

// Unlock triggers (conditions to unlock)
export const UNLOCK_TRIGGERS = {
    // By completed cases
    completed_cases: (state, points) => {
        return (state.progression?.completedCases || 0) >= points;
    },
    // By district stability
    district_stability: (state, stabilityThreshold) => {
        const stability = state.progression?.districtStability;
        if (!stability) return false;
        const avgStability = Object.values(stability).reduce((a, b) => a + b, 0) / Object.keys(stability).length;
        return avgStability >= stabilityThreshold;
    },
    // By gold income
    gold_income: (state, goldPerDay) => {
        return (state.resources?.jobProduction?.gold || 0) >= goldPerDay;
    },
    // By building count
    building_count: (state, count) => {
        return (state.buildings?.list?.length || 0) >= count;
    }
};

/**
 * Progression manager
 */
export class ProgressionManager {
    constructor(game) {
        this.game = game;
        this.progression = game.state.progression || {
            points: 0,
            unlocked: [],
            completedCases: 0,
            districtStability: {}
        };
    }

    /**
     * Update progression based on current state
     */
    update() {
        // Track completed cases
        const completedCases = this.game.state.quests?.completed?.length || 0;
        this.progression.completedCases = completedCases;

        // Track district stability
        this.updateDistrictStability();

        // Update points
        this.progression.points = this.calculatePoints();

        // Check unlocks
        this.checkUnlocks();

        // Store back to state
        this.game.state.progression = this.progression;
    }

    /**
     * Calculate progression points
     */
    calculatePoints() {
        let points = 0;
        points += this.progression.completedCases * 10;
        points += this.game.state.buildings?.list?.length || 0;
        points += this.game.resources?.day || 0;
        return points;
    }

    /**
     * Track district stability
     */
    updateDistrictStability() {
        // Get district info from map
        const map = this.game.map;
        if (!map?.districts) return;

        for (const district of map.districts) {
            if (district.id) {
                // Calculate stability based on:
                // - Happiness of citizens in district
                // - Number of security buildings in district
                // - Crime level
                const districtCitizens = this.game.citizens?.citizens?.filter(c =>
                    Math.abs(c.x - district.center.x) < 5 && Math.abs(c.y - district.center.y) < 5
                ) || [];

                if (districtCitizens.length > 0) {
                    const avgHappiness = districtCitizens.reduce((sum, c) => sum + (c.happiness || 50), 0) / districtCitizens.length;
                    const securityBuildings = this.game.buildings?.getBuildingsAt(district.center.x, district.center.y)?.filter(b =>
                        ['police-station', 'cctv-network', 'counterintel', 'propaganda-office'].includes(b.type)
                    ).length || 0;

                    // Stability score: 0-100
                    let stability = 50;
                    stability += avgHappiness / 2; // Up to +50 from happiness
                    stability += securityBuildings * 15; // +15 per security building
                    stability = Math.max(0, Math.min(100, stability));

                    this.progression.districtStability[district.id] = stability;
                }
            }
        }
    }

    /**
     * Check and apply unlocks
     */
    checkUnlocks() {
        for (const [unlockId, unlock] of Object.entries(UNLOCKS)) {
            if (this.progression.unlocked.includes(unlockId)) continue; // Already unlocked

            // Check trigger condition
            let unlocked = false;
            const parts = unlock.trigger.split(': ');
            const triggerType = parts[0];
            const triggerValue = parseInt(parts[1]);

            switch (triggerType) {
                case 'completed_cases':
                    unlocked = UNLOCK_TRIGGERS.completed_cases(this.game.state, triggerValue);
                    break;
                case 'building_count':
                    unlocked = UNLOCK_TRIGGERS.building_count(this.game.state, triggerValue);
                    break;
                case 'gold_income':
                    unlocked = UNLOCK_TRIGGERS.gold_income(this.game.state, triggerValue);
                    break;
                case 'district_stability':
                    unlocked = UNLOCK_TRIGGERS.district_stability(this.game.state, triggerValue);
                    break;
            }

            if (unlocked) {
                this.unlock(unlockId, unlock);
            }
        }
    }

    /**
     * Unlock a feature
     */
    unlock(id, unlockData) {
        this.progression.unlocked.push(id);
        this.game.ui.showMessage(`Unlock: ${unlockData.name}! ${unlockData.description}`, 'success');
    }

    /**
     * Get list of unlocked features
     */
    getUnlocked() {
        return this.progression.unlocked || [];
    }

    /**
     * Get telemetry for UI
     */
    getTelemetry() {
        return {
            points: this.progression.points,
            unlocked: this.progression.unlocked,
            completedCases: this.progression.completedCases,
            districtStability: this.progression.districtStability || {}
        };
    }

    /**
     * Save state
     */
    serialize() {
        return {
            points: this.progression.points,
            unlocked: this.progression.unlocked,
            completedCases: this.progression.completedCases,
            districtStability: this.progression.districtStability || {}
        };
    }

    /**
     * Load state
     */
    deserialize(data) {
        if (data) {
            this.progression.points = data.points || 0;
            this.progression.unlocked = data.unlocked || [];
            this.progression.completedCases = data.completedCases || 0;
            this.progression.districtStability = data.districtStability || {};
        }
    }
}