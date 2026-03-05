// Demand System - Calculates R/C/I demand based on city state

const CONFIG = {
  HOUSING_OVERCROWD: 1.0,
  HOUSING_UNDERCROWD: 0.8,
  INDUSTRIAL_SURPLUS_THRESHOLD: 100,
  HAPPINESS_THRESHOLD: 60,
  SMOOTHING_FACTOR: 0.05,
  DEFAULT_DEMAND: 0.5,
  DEFAULT_HAPPINESS: 50,
  MIN_DEMAND: 0.1,
  MAX_DEMAND: 1.0
};

/**
 * Demand Calculator - Computes residential, commercial, industrial demand
 */
export class DemandCalculator {
    constructor() {
        this.demand = {
            residential: CONFIG.DEFAULT_DEMAND,
            commercial: CONFIG.DEFAULT_DEMAND,
            industrial: CONFIG.DEFAULT_DEMAND,
        };
    }

    /**
     * Calculate demand based on city state
     * @param {Object} state - Full game state
     * @returns {Object} Updated demand values
     */
    calculate(state) {
        // Strict input validation and null safety
        if (!state || !state.citizens || !state.citizens.list || !state.buildings || !state.buildings.list) {
            throw new Error("Invalid game state: missing required citizens or buildings data");
        }

        const citizens = state.citizens.list;
        const buildings = state.buildings.list;
        const resources = state.resources || {};

        // Basic metrics
        const population = citizens.length;
        const housing = Number(resources.housing) || 0;
        const jobs = this.countJobs(buildings);
        const unemployed = Math.max(0, population - jobs);

        // Calculate ratios
        const housingRatio = housing > 0 ? population / housing : 0;
        const jobRatio = jobs > 0 ? population / jobs : 0;

        // Residential demand: high when people need housing
        let resDemand = CONFIG.DEFAULT_DEMAND;
        if (housingRatio > CONFIG.HOUSING_OVERCROWD) {
            // Overcrowded - high residential demand
            resDemand = Math.min(CONFIG.MAX_DEMAND, CONFIG.DEFAULT_DEMAND + (housingRatio - CONFIG.HOUSING_OVERCROWD) * 0.5);
        } else if (housingRatio < CONFIG.HOUSING_UNDERCROWD) {
            // Undercrowded - low residential demand
            resDemand = Math.max(CONFIG.MIN_DEMAND, CONFIG.DEFAULT_DEMAND - (CONFIG.HOUSING_UNDERCROWD - housingRatio) * 0.5);
        }

        // Commercial demand: high when people have money and jobs exist
        let comDemand = CONFIG.DEFAULT_DEMAND;
        const avgHappiness = this.getAvgHappiness(citizens);
        if (avgHappiness > CONFIG.HAPPINESS_THRESHOLD && jobRatio < 1.2) {
            // Happy people with jobs want services
            comDemand = Math.min(CONFIG.MAX_DEMAND, CONFIG.DEFAULT_DEMAND + (avgHappiness - CONFIG.HAPPINESS_THRESHOLD) / 100);
        }

        // Industrial demand: high when resources need processing
        let indDemand = CONFIG.DEFAULT_DEMAND;
        const wood = Number(resources.wood) || 0;
        const food = Number(resources.food) || 0;
        if (wood > CONFIG.INDUSTRIAL_SURPLUS_THRESHOLD || food > CONFIG.INDUSTRIAL_SURPLUS_THRESHOLD) {
            // Surplus resources need processing
            indDemand = Math.min(CONFIG.MAX_DEMAND, CONFIG.DEFAULT_DEMAND + Math.min(0.4, (wood + food) / 1000));
        }

        // Apply smoothing (demand doesn't change instantly)
        this.demand.residential = this.smooth(this.demand.residential, resDemand, CONFIG.SMOOTHING_FACTOR);
        this.demand.commercial = this.smooth(this.demand.commercial, comDemand, CONFIG.SMOOTHING_FACTOR);
        this.demand.industrial = this.smooth(this.demand.industrial, indDemand, CONFIG.SMOOTHING_FACTOR);

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
        if (citizens.length === 0) return CONFIG.DEFAULT_HAPPINESS;
        const total = citizens.reduce((sum, c) => sum + (Number(c.happiness) || CONFIG.DEFAULT_HAPPINESS), 0);
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
            // Accept both old ({res,com,ind}) and new ({residential,commercial,industrial}) formats.
            const src = {
                residential: data.residential ?? data.res,
                commercial: data.commercial ?? data.com,
                industrial: data.industrial ?? data.ind,
            };

            const validRes = typeof src.residential === 'number' ? src.residential : CONFIG.DEFAULT_DEMAND;
            const validCom = typeof src.commercial === 'number' ? src.commercial : CONFIG.DEFAULT_DEMAND;
            const validInd = typeof src.industrial === 'number' ? src.industrial : CONFIG.DEFAULT_DEMAND;

            this.demand = {
                residential: validRes,
                commercial: validCom,
                industrial: validInd,
            };
        }
    }
}

/**
 * Create demand calculator instance
 */
export function createDemandCalculator() {
    return new DemandCalculator();
}
