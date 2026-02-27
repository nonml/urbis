// Demand System - Calculates R/C/I demand based on city state

/**
 * Demand Calculator - Computes residential, commercial, industrial demand
 */
export class DemandCalculator {
    constructor() {
        this.demand = {
            res: 0.5,  // Residential demand (0-1)
            com: 0.5,  // Commercial demand (0-1)
            ind: 0.5   // Industrial demand (0-1)
        };
    }

    /**
     * Calculate demand based on city state
     * @param {Object} state - Full game state
     * @returns {Object} Updated demand values
     */
    calculate(state) {
        const citizens = state.citizens?.list || [];
        const buildings = state.buildings?.list || [];
        const resources = state.resources || {};

        // Basic metrics
        const population = citizens.length;
        const housing = resources.housing || 0;
        const jobs = this.countJobs(buildings);
        const unemployed = Math.max(0, population - jobs);

        // Calculate ratios
        const housingRatio = housing > 0 ? population / housing : 0;
        const jobRatio = jobs > 0 ? population / jobs : 0;

        // Residential demand: high when people need housing
        let resDemand = 0.5;
        if (housingRatio > 1.0) {
            // Overcrowded - high residential demand
            resDemand = Math.min(1.0, 0.5 + (housingRatio - 1.0) * 0.5);
        } else if (housingRatio < 0.8) {
            // Undercrowded - low residential demand
            resDemand = Math.max(0.1, 0.5 - (0.8 - housingRatio) * 0.5);
        }

        // Commercial demand: high when people have money and jobs exist
        let comDemand = 0.5;
        const avgHappiness = this.getAvgHappiness(citizens);
        if (avgHappiness > 60 && jobRatio < 1.2) {
            // Happy people with jobs want services
            comDemand = Math.min(1.0, 0.5 + (avgHappiness - 60) / 100);
        }

        // Industrial demand: high when resources need processing
        let indDemand = 0.5;
        const wood = resources.wood || 0;
        const food = resources.food || 0;
        if (wood > 100 || food > 100) {
            // Surplus resources need processing
            indDemand = Math.min(1.0, 0.5 + Math.min(0.4, (wood + food) / 1000));
        }

        // Apply smoothing (demand doesn't change instantly)
        this.demand.res = this.smooth(this.demand.res, resDemand, 0.05);
        this.demand.com = this.smooth(this.demand.com, comDemand, 0.05);
        this.demand.ind = this.smooth(this.demand.ind, indDemand, 0.05);

        return { ...this.demand };
    }

    /**
     * Count total jobs from buildings
     */
    countJobs(buildings) {
        let jobs = 0;
        for (const b of buildings) {
            if (b.jobs) jobs += b.jobs;
        }
        return jobs;
    }

    /**
     * Get average happiness from citizens
     */
    getAvgHappiness(citizens) {
        if (citizens.length === 0) return 50;
        const total = citizens.reduce((sum, c) => sum + (c.happiness || 50), 0);
        return total / citizens.length;
    }

    /**
     * Smooth demand value (simple interpolation)
     */
    smooth(current, target, factor) {
        return current + (target - current) * factor;
    }

    /**
     * Get current demand
     */
    getDemand() {
        return { ...this.demand };
    }

    /**
     * Serialize demand for save
     */
    serialize() {
        return { ...this.demand };
    }

    /**
     * Deserialize demand from save
     */
    deserialize(data) {
        if (data) {
            this.demand = { ...this.demand, ...data };
        }
    }
}

/**
 * Create demand calculator instance
 */
export function createDemandCalculator() {
    return new DemandCalculator();
}