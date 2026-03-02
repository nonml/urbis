// Job Market System - Milestone J
// Manages job creation, matching, and labor economics

import { ensureCitizenState } from '../citizens/citizen_state.js';

// Job types with skill requirements and wage ranges
export const JOB_TYPES = Object.freeze({
    UNEMPLOYED: { id: 'unemployed', skill: 0, wage: 0, category: 'unskilled' },
    FARMER: { id: 'farmer', skill: 1, wageMin: 3, wageMax: 6, category: 'primary' },
    LUMBERJACK: { id: 'lumberjack', skill: 1, wageMin: 3, wageMax: 6, category: 'primary' },
    MERCHANT: { id: 'merchant', skill: 2, wageMin: 4, wageMax: 8, category: 'secondary' },
    CRAFTSMAN: { id: 'craftsman', skill: 2, wageMin: 4, wageMax: 8, category: 'secondary' },
    OFFICIAL: { id: 'official', skill: 3, wageMin: 5, wageMax: 10, category: 'public' },
    SOLDIER: { id: 'soldier', skill: 3, wageMin: 6, wageMax: 12, category: 'public' },
    TEACHER: { id: 'teacher', skill: 4, wageMin: 5, wageMax: 10, category: 'public' },
    DOCTOR: { id: 'doctor', skill: 5, wageMin: 8, wageMax: 15, category: 'public' },
    ENGINEER: { id: 'engineer', skill: 5, wageMin: 8, wageMax: 16, category: 'technical' },
    RESEARCHER: { id: 'researcher', skill: 6, wageMin: 10, wageMax: 20, category: 'research' },
});

// Job requirements based on skill level
export const SKILL_REQUIREMENTS = {
    0: { literacy: 0, training: 0 },
    1: { literacy: 20, training: 0 },
    2: { literacy: 40, training: 20 },
    3: { literacy: 60, training: 40 },
    4: { literacy: 70, training: 60 },
    5: { literacy: 80, training: 70 },
    6: { literacy: 90, training: 80 },
};

/**
 * Job Opening - represents an available job position
 */
export class JobOpening {
    constructor(id, buildingId, role, wage, x, y) {
        this.id = id;
        this.buildingId = buildingId;
        this.role = role;
        this.wage = wage;
        this.x = x;
        this.y = y;
        this.occupiedBy = null;
        this.createdTick = 0;
        this.filledTick = null;
    }

    /**
     * Fill the job opening
     */
    fill(citizenId) {
        this.occupiedBy = citizenId;
        this.filledTick = 0; // Will be set by job market
    }

    /**
     * Vacate the job opening
     */
    vacate() {
        this.occupiedBy = null;
        this.filledTick = null;
    }

    /**
     * Serialize job opening
     */
    serialize() {
        return {
            id: this.id,
            buildingId: this.buildingId,
            role: this.role,
            wage: this.wage,
            x: this.x,
            y: this.y,
            occupiedBy: this.occupiedBy,
            createdTick: this.createdTick,
            filledTick: this.filledTick,
        };
    }

    /**
     * Deserialize job opening
     */
    static deserialize(data) {
        const opening = new JobOpening(
            data.id,
            data.buildingId,
            data.role,
            data.wage,
            data.x,
            data.y
        );
        opening.occupiedBy = data.occupiedBy;
        opening.createdTick = data.createdTick || 0;
        opening.filledTick = data.filledTick || null;
        return opening;
    }
}

/**
 * Job Market - manages job creation, matching, and labor economics
 */
export class JobMarket {
    constructor(game) {
        this.game = game;
        this.jobOpenings = new Map();
        this.nextJobId = 1;
        this.jobStats = {
            totalOpenings: 0,
            filled: 0,
            unemployed: 0,
            averageWage: 0,
            sectorBreakdown: {},
        };
        this.unemploymentHistory = [];
        this.wageHistory = [];
    }

    /**
     * Rebuild all job openings based on current buildings and citizens
     */
    rebuild() {
        this.jobOpenings.clear();
        this.nextJobId = 1;

        const buildings = this.game.buildings.buildings;
        const citizens = this.game.citizens.citizens;

        // Build job configuration per building type
        const jobConfig = this._getJobConfig();

        // Create job openings for each building
        for (const building of buildings) {
            const jobs = jobConfig[building.type] || [];
            let totalSlots = 0;

            for (const job of jobs) {
                for (let i = 0; i < job.slots; i++) {
                    const opening = new JobOpening(
                        this.nextJobId++,
                        building.id,
                        job.role,
                        job.wage,
                        building.x,
                        building.y
                    );
                    opening.createdTick = this.game.state.time.tick;
                    this.jobOpenings.set(opening.id, opening);
                    totalSlots++;
                }
            }
        }

        // Release invalid assignments
        const buildingIds = new Set(buildings.map(b => b.id));
        for (const citizen of citizens) {
            if (!buildingIds.has(citizen.workBuildingId)) {
                citizen.workBuildingId = null;
                citizen.job = 'unemployed';
            }
        }

        // Fill existing jobs
        for (const citizen of citizens) {
            if (!citizen.workBuildingId || citizen.job === 'unemployed') continue;

            const opening = this._findOpening(
                citizen.workBuildingId,
                citizen.job,
                citizen.id
            );

            if (opening) {
                opening.fill(citizen.id);
            } else {
                citizen.workBuildingId = null;
                citizen.job = 'unemployed';
            }
        }

        // Assign unemployed citizens to open jobs
        this._matchUnemployed();

        // Compute stats
        this._computeStats();
    }

    /**
     * Get job configuration for building types
     */
    _getJobConfig() {
        return {
            farm: [
                { role: 'farmer', slots: 2, wage: 5 },
                { role: 'assistant', slots: 2, wage: 3 },
            ],
            'lumber-mill': [
                { role: 'lumberjack', slots: 2, wage: 5 },
                { role: 'assistant', slots: 2, wage: 3 },
            ],
            market: [
                { role: 'merchant', slots: 3, wage: 6 },
                { role: 'salesperson', slots: 2, wage: 4 },
            ],
            warehouse: [
                { role: 'craftsman', slots: 2, wage: 6 },
                { role: 'laborer', slots: 2, wage: 4 },
            ],
            'town-hall': [
                { role: 'official', slots: 2, wage: 7 },
                { role: 'clerk', slots: 2, wage: 5 },
            ],
            barracks: [
                { role: 'soldier', slots: 4, wage: 8 },
                { role: 'officer', slots: 1, wage: 10 },
            ],
            school: [
                { role: 'teacher', slots: 2, wage: 7 },
                { role: 'assistant', slots: 2, wage: 4 },
            ],
            'police-station': [
                { role: 'soldier', slots: 3, wage: 8 },
                { role: 'officer', slots: 1, wage: 10 },
            ],
            'cctv-network': [
                { role: 'official', slots: 1, wage: 6 },
                { role: 'monitor', slots: 2, wage: 5 },
            ],
            hospital: [
                { role: 'doctor', slots: 2, wage: 12 },
                { role: 'nurse', slots: 3, wage: 8 },
                { role: 'orderly', slots: 2, wage: 5 },
            ],
            lab: [
                { role: 'researcher', slots: 3, wage: 15 },
                { role: 'engineer', slots: 2, wage: 10 },
            ],
            'power-plant': [
                { role: 'engineer', slots: 2, wage: 10 },
                { role: 'technician', slots: 2, wage: 7 },
            ],
        };
    }

    /**
     * Find a job opening
     */
    _findOpening(buildingId, role, citizenId) {
        for (const opening of this.jobOpenings.values()) {
            if (opening.buildingId === buildingId &&
                opening.role === role &&
                opening.occupiedBy === citizenId) {
                return opening;
            }
        }
        return null;
    }

    /**
     * Match unemployed citizens to open jobs
     */
    _matchUnemployed() {
        const openJobs = Array.from(this.jobOpenings.values())
            .filter(o => o.occupiedBy === null);

        const unemployed = this.game.citizens.citizens
            .filter(c => c.job === 'unemployed' || !c.workBuildingId);

        if (openJobs.length === 0 || unemployed.length === 0) return;

        // Sort unemployed by skill and seniority
        unemployed.sort((a, b) => {
            const skillDiff = (this._getCitizenSkill(b) || 0) - (this._getCitizenSkill(a) || 0);
            if (skillDiff !== 0) return skillDiff;
            return a.id - b.id;
        });

        // Sort jobs by wage (highest first)
        openJobs.sort((a, b) => b.wage - a.wage);

        // Match jobs to citizens
        for (const citizen of unemployed) {
            const citizenSkill = this._getCitizenSkill(citizen);
            const minWage = 3 + (citizenSkill * 2); // Base wage + skill bonus

            const bestJob = openJobs.find(j => {
                const job = JOB_TYPES[j.role] || JOB_TYPES.UNEMPLOYED;
                return citizenSkill >= job.skill && j.wage >= minWage;
            });

            if (bestJob) {
                bestJob.fill(citizen.id);
                citizen.workBuildingId = bestJob.buildingId;
                citizen.job = bestJob.role;
                citizen.salary = bestJob.wage;
            }
        }
    }

    /**
     * Get citizen skill level
     */
    _getCitizenSkill(citizen) {
        // Calculate skill based on education and experience
        let skill = 0;
        if (citizen.education?.years) skill += citizen.education.years;
        if (citizen.job !== 'unemployed') skill += citizen.experience?.years || 0;
        return Math.min(6, skill);
    }

    /**
     * Compute job market statistics
     */
    _computeStats() {
        const openings = Array.from(this.jobOpenings.values());
        const filled = openings.filter(o => o.occupiedBy !== null).length;
        const total = openings.length;

        // Count unemployed
        const unemployedCount = this.game.citizens.citizens.filter(c => c.job === 'unemployed').length;

        // Calculate average wage
        const filledJobs = openings.filter(o => o.occupiedBy !== null);
        const avgWage = filledJobs.length > 0
            ? filledJobs.reduce((sum, o) => sum + o.wage, 0) / filledJobs.length
            : 0;

        // Sector breakdown
        const sectors = {};
        for (const opening of openings) {
            if (opening.occupiedBy !== null) {
                const job = JOB_TYPES[opening.role];
                const category = job?.category || 'unskilled';
                if (!sectors[category]) sectors[category] = 0;
                sectors[category]++;
            }
        }

        this.jobStats = {
            totalOpenings: total,
            filled,
            unemployed: unemployedCount,
            unemploymentRate: total > 0 ? (unemployedCount / Math.max(1, total + unemployedCount)) : 0,
            averageWage: Math.round(avgWage * 100) / 100,
            sectorBreakdown: sectors,
        };

        // Update history
        this.unemploymentHistory.push(this.jobStats.unemploymentRate);
        if (this.unemploymentHistory.length > 30) this.unemploymentHistory.shift();

        this.wageHistory.push(this.jobStats.averageWage);
        if (this.wageHistory.length > 30) this.wageHistory.shift();
    }

    /**
     * Update job market each tick
     */
    update(tick) {
        if (tick % 10 === 0) {
            this.rebuild();
        }

        // Check for wage adjustments
        if (tick % 50 === 0) {
            this._adjustWages();
        }
    }

    /**
     * Adjust wages based on market conditions
     */
    _adjustWages() {
        const rate = this.jobStats.unemploymentRate;

        // High unemployment - wages decrease
        if (rate > 0.1) {
            for (const opening of this.jobOpenings.values()) {
                if (opening.occupiedBy !== null && opening.wage > 3) {
                    opening.wage = Math.max(3, opening.wage - 0.5);
                }
            }
        }
        // Low unemployment - wages increase
        else if (rate < 0.03 && this.wageHistory.length > 5) {
            const avgWage = this.wageHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
            if (avgWage > 0) {
                for (const opening of this.jobOpenings.values()) {
                    if (opening.occupiedBy !== null) {
                        opening.wage = Math.min(30, opening.wage + 0.5);
                    }
                }
            }
        }
    }

    /**
     * Get job demand by skill level
     */
    getJobDemand() {
        const demand = {};
        for (const [skill, req] of Object.entries(SKILL_REQUIREMENTS)) {
            demand[skill] = {
                literacy: req.literacy,
                training: req.training,
                openings: 0,
                applicants: 0,
            };
        }

        // Count openings per skill level
        for (const opening of this.jobOpenings.values()) {
            const job = JOB_TYPES[opening.role];
            if (job) {
                const skill = job.skill;
                demand[skill]?.openings++;
            }
        }

        // Count applicants per skill level
        for (const citizen of this.game.citizens.citizens) {
            const skill = this._getCitizenSkill(citizen);
            if (skill >= 0 && skill <= 6) {
                demand[skill]?.applicants++;
            }
        }

        return demand;
    }

    /**
     * Create new job openings for a building
     */
    addBuildingJobs(building) {
        const jobConfig = this._getJobConfig();
        const jobs = jobConfig[building.type] || [];

        for (const job of jobs) {
            for (let i = 0; i < job.slots; i++) {
                const opening = new JobOpening(
                    this.nextJobId++,
                    building.id,
                    job.role,
                    job.wage,
                    building.x,
                    building.y
                );
                opening.createdTick = this.game.state.time.tick;
                this.jobOpenings.set(opening.id, opening);
            }
        }
    }

    /**
     * Remove job openings for a building
     */
    removeBuildingJobs(buildingId) {
        for (const [id, opening] of this.jobOpenings) {
            if (opening.buildingId === buildingId) {
                // Release the citizen if job was filled
                if (opening.occupiedBy !== null) {
                    const citizen = this.game.citizens.citizens.find(c => c.id === opening.occupiedBy);
                    if (citizen) {
                        citizen.workBuildingId = null;
                        citizen.job = 'unemployed';
                        citizen.salary = 0;
                    }
                }
                this.jobOpenings.delete(id);
            }
        }
    }

    /**
     * Get job market summary
     */
    getSummary() {
        return {
            ...this.jobStats,
            unemploymentTrend: this.unemploymentHistory.slice(-5),
            wageTrend: this.wageHistory.slice(-5),
        };
    }

    /**
     * Serialize job market state
     */
    serialize() {
        return {
            jobOpenings: Array.from(this.jobOpenings.values()).map(j => j.serialize()),
            nextJobId: this.nextJobId,
            jobStats: this.jobStats,
            unemploymentHistory: this.unemploymentHistory,
            wageHistory: this.wageHistory,
        };
    }

    /**
     * Deserialize job market state
     */
    deserialize(data) {
        if (!data) return;

        this.jobOpenings.clear();
        this.nextJobId = data.nextJobId || 1;

        for (const openingData of data.jobOpenings || []) {
            const opening = JobOpening.deserialize(openingData);
            this.jobOpenings.set(opening.id, opening);
        }

        if (data.jobStats) {
            this.jobStats = data.jobStats;
        }
        if (data.unemploymentHistory) {
            this.unemploymentHistory = data.unemploymentHistory;
        }
        if (data.wageHistory) {
            this.wageHistory = data.wageHistory;
        }
    }
}