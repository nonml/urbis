// Crime Incident Generator - Milestone J
// Generates and tracks crime incidents based on citizen behavior and conditions

import { deriveMood } from './citizen_state.js';

// Crime types with severity and detection rates
export const CRIME_TYPES = Object.freeze({
    VANDALISM: {
        id: 'vandalism',
        name: 'Vandalism',
        severity: 1,
        baseProbability: 0.02,
        category: 'property',
        maxStolen: 10,
        detectionRate: 0.3,
        policeResponseTime: 30,
    },
    THEFT: {
        id: 'theft',
        name: 'Theft',
        severity: 2,
        baseProbability: 0.015,
        category: 'property',
        maxStolen: 50,
        detectionRate: 0.5,
        policeResponseTime: 20,
    },
    ASSAULT: {
        id: 'assault',
        name: 'Assault',
        severity: 3,
        baseProbability: 0.01,
        category: 'violent',
        maxStolen: 20,
        detectionRate: 0.7,
        policeResponseTime: 15,
    },
    BURGLARY: {
        id: 'burglary',
        name: 'Burglary',
        severity: 3,
        baseProbability: 0.008,
        category: 'property',
        maxStolen: 100,
        detectionRate: 0.4,
        policeResponseTime: 45,
    },
    ROBBERY: {
        id: 'robbery',
        name: 'Robbery',
        severity: 4,
        baseProbability: 0.005,
        category: 'violent',
        maxStolen: 200,
        detectionRate: 0.8,
        policeResponseTime: 10,
    },
    ARSON: {
        id: 'arson',
        name: 'Arson',
        severity: 5,
        baseProbability: 0.002,
        category: 'property',
        maxStolen: 0,
        detectionRate: 0.6,
        policeResponseTime: 25,
    },
    MURDER: {
        id: 'murder',
        name: 'Murder',
        severity: 10,
        baseProbability: 0.001,
        category: 'violent',
        maxStolen: 50,
        detectionRate: 0.9,
        policeResponseTime: 5,
    },
    CORRUPTION: {
        id: 'corruption',
        name: 'Corruption',
        severity: 6,
        baseProbability: 0.001,
        category: 'white-collar',
        maxStolen: 500,
        detectionRate: 0.2,
        policeResponseTime: 60,
    },
});

// Crime probability modifiers based on citizen conditions
const MODIFIERS = {
    desperateMood: 3.0,
    stressedMood: 1.5,
    happyMood: 0.3,
    unemployed: 2.0,
    lowSafety: 2.0,
    lowFood: 1.5,
    lowRest: 1.2,
    highHeat: 2.5,
    highCongestion: 1.3,
};

/**
 * Crime Incident - represents a recorded crime
 */
export class CrimeIncident {
    constructor(id) {
        this.id = id;
        this.type = null;
        this.name = '';
        this.severity = 1;
        this.category = '';
        this.locationX = 0;
        this.locationY = 0;
        this.perpetratorId = null;
        this.victimId = null;
        this.stolenAmount = 0;
        this.reportedAt = 0;
        this.reportedBy = null;
        this.detectedAt = null;
        this.solvedAt = null;
        this.status = 'REPORTED'; // REPORTED, INVESTIGATING, SOLVED, UNSOLVED
        this.policeInvestigation = false;
        this.heatImpact = 0;
    }

    /**
     * Mark incident as detected
     */
    detect() {
        this.detectedAt = 0; // Will be set by incident system
        if (this.status === 'REPORTED') {
            this.status = 'INVESTIGATING';
        }
    }

    /**
     * Mark incident as solved
     */
    solve(perpetratorId) {
        this.solvedAt = 0; // Will be set by incident system
        this.perpetratorId = perpetratorId;
        this.status = 'SOLVED';
    }

    /**
     * Mark incident as unsolved
     */
    markUnsolved() {
        this.status = 'UNSOLVED';
    }

    /**
     * Serialize incident
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            severity: this.severity,
            category: this.category,
            locationX: this.locationX,
            locationY: this.locationY,
            perpetratorId: this.perpetratorId,
            victimId: this.victimId,
            stolenAmount: this.stolenAmount,
            reportedAt: this.reportedAt,
            reportedBy: this.reportedBy,
            detectedAt: this.detectedAt,
            solvedAt: this.solvedAt,
            status: this.status,
            policeInvestigation: this.policeInvestigation,
            heatImpact: this.heatImpact,
        };
    }

    /**
     * Deserialize incident
     */
    static deserialize(data) {
        const incident = new CrimeIncident(data.id);
        incident.type = data.type;
        incident.name = data.name;
        incident.severity = data.severity;
        incident.category = data.category;
        incident.locationX = data.locationX;
        incident.locationY = data.locationY;
        incident.perpetratorId = data.perpetratorId;
        incident.victimId = data.victimId;
        incident.stolenAmount = data.stolenAmount;
        incident.reportedAt = data.reportedAt;
        incident.reportedBy = data.reportedBy;
        incident.detectedAt = data.detectedAt;
        incident.solvedAt = data.solvedAt;
        incident.status = data.status;
        incident.policeInvestigation = data.policeInvestigation || false;
        incident.heatImpact = data.heatImpact || 0;
        return incident;
    }
}

/**
 * Crime Generator - generates and manages crime incidents
 */
export class CrimeGenerator {
    constructor(game, rng = null) {
        this.game = game;
        this.rng = rng;
        this.incidents = new Map();
        this.nextIncidentId = 1;
        this.crimeStats = {
            totalIncidents: 0,
            byCategory: {},
            bySeverity: {},
            solvedRate: 0,
            avgResponseTime: 0,
            heatImpact: 0,
        };
        this.incidentHistory = [];
    }

    /**
     * Generate crime incidents based on citizen conditions
     */
    generateIncidents(tick) {
        if (tick % 5 !== 0) return; // Check every 5 ticks

        const citizens = this.game.citizens.citizens;
        const crimeRate = this._calculateBaseCrimeRate();

        for (const citizen of citizens) {
            // Only generate incidents for citizens with high crime propensity
            if (!this._isCrimeProne(citizen)) continue;

            // Roll for crime
            if (this.rng?.next() < crimeRate) {
                this._createIncident(citizen);
            }
        }

        // Generate opportunistic crimes at high-traffic locations
        this._generateOpportunisticCrimes(tick);
    }

    /**
     * Calculate base crime rate based on city conditions
     */
    _calculateBaseCrimeRate() {
        const population = this.game.citizens.getPopulation();
        const cap = this.game.state.meta.mapPreset === 'SMALL' ? 300 :
                    this.game.state.meta.mapPreset === 'MEGA' ? 8000 : 2000;

        // Base rate adjusted by population density
        let baseRate = 0.002;
        const density = population / (this.game.map.width * this.game.map.height);
        if (density > 0.5) baseRate *= 1.5;
        if (density < 0.1) baseRate *= 0.7;

        // Adjust by unemployment
        const unemployment = this.game.jobsManager
            ? this.game.citizens.citizens.filter(c => c.job === 'unemployed').length / population
            : 0;
        if (unemployment > 0.1) baseRate *= 2.0;
        else if (unemployment < 0.05) baseRate *= 0.8;

        // Adjust by average safety
        const avgSafety = this._getAverageSafety();
        if (avgSafety < 30) baseRate *= 1.8;
        else if (avgSafety > 70) baseRate *= 0.6;

        // Adjust by heat
        const heat = this.game.heatSystem.getHeat();
        if (heat > 50) baseRate *= 1.5;
        else if (heat < 20) baseRate *= 0.8;

        return baseRate;
    }

    /**
     * Check if a citizen is crime-prone
     */
    _isCrimeProne(citizen) {
        const mood = citizen.mood || deriveMood(citizen);

        // High crime propensity if:
        // - Mood is desperate or stressed
        // - Has criminal record (not yet implemented)
        // - Low needs
        // - Unemployed for long time
        // - High heat from local area

        let propensity = 0;

        if (mood === 'desperate') propensity += 3;
        if (mood === 'stressed') propensity += 1.5;

        if (citizen.needs?.food < 30) propensity += 2;
        if (citizen.needs?.rest < 30) propensity += 1;
        if (citizen.needs?.safety < 30) propensity += 2;

        if (citizen.job === 'unemployed' && (citizen.unemployedTicks || 0) > 50) {
            propensity += 3;
        }

        // Check local heat
        const localHeat = this.game.heatSystem.getHeatAt?.(Math.floor(citizen.x), Math.floor(citizen.y)) || 0;
        if (localHeat > 30) propensity += localHeat / 20;

        return propensity > 2 && this.rng?.chance(0.1);
    }

    /**
     * Get average citizen safety
     */
    _getAverageSafety() {
        if (this.game.citizens.citizens.length === 0) return 100;
        const total = this.game.citizens.citizens.reduce((sum, c) => sum + (c.needs?.safety || 100), 0);
        return total / this.game.citizens.citizens.length;
    }

    /**
     * Create a new incident
     */
    _createIncident(citizen) {
        // Select crime type based on severity and opportunity
        const crimeType = this._selectCrimeType(citizen);

        if (!crimeType) return;

        const incident = new CrimeIncident(this.nextIncidentId++);
        incident.type = crimeType.id;
        incident.name = crimeType.name;
        incident.severity = crimeType.severity;
        incident.category = crimeType.category;
        incident.locationX = Math.floor(citizen.x);
        incident.locationY = Math.floor(citizen.y);
        incident.perpetratorId = citizen.id;
        incident.reportedAt = this.game.state.time.tick;
        incident.stolenAmount = Math.floor(this.rng?.next() * crimeType.maxStolen);
        incident.heatImpact = Math.floor(incident.severity * 5);

        this.incidents.set(incident.id, incident);
        this.incidentHistory.push(incident);

        // Remove old incidents (keep last 100)
        if (this.incidentHistory.length > 100) {
            const removed = this.incidentHistory.shift();
            this.incidents.delete(removed.id);
        }

        // Report to police
        if (this.rng?.chance(crimeType.detectionRate)) {
            incident.detect();
        }

        // Update stats
        this._updateStats();
    }

    /**
     * Select appropriate crime type
     */
    _selectCrimeType(citizen) {
        const mood = citizen.mood || deriveMood(citizen);
        const safety = citizen.needs?.safety || 100;

        // violent crimes when desperate and low safety
        if (mood === 'desperate' && safety < 20) {
            if (this.rng?.chance(0.4)) return CRIME_TYPES.ASSAULT;
            if (this.rng?.chance(0.1)) return CRIME_TYPES.MURDER;
        }

        // Property crimes when stressed
        if (mood === 'stressed') {
            if (this.rng?.chance(0.5)) return CRIME_TYPES.THEFT;
            if (this.rng?.chance(0.3)) return CRIME_TYPES.BURGLARY;
            if (this.rng?.chance(0.2)) return CRIME_TYPES.VANDALISM;
        }

        // Pick from weighted random
        const weightedTypes = [
            ...Array(5).fill(CRIME_TYPES.VANDALISM),
            ...Array(3).fill(CRIME_TYPES.THEFT),
            ...Array(2).fill(CRIME_TYPES.BURGLARY),
            ...Array(1).fill(CRIME_TYPES.ASSAULT),
        ];

        const idx = this.rng?.int(0, weightedTypes.length - 1);
        return weightedTypes[idx];
    }

    /**
     * Generate opportunistic crimes at high-traffic locations
     */
    _generateOpportunisticCrimes(tick) {
        // Only check during day hours
        const time = this.game.state.time.timeOfDay;
        if (time < 8 || time > 22) return;

        const trafficLocations = this.game.trafficManager?.getHighTrafficLocations?.() || [];

        for (const loc of trafficLocations) {
            if (this.rng?.chance(0.01)) {
                const citizen = this._findVictimNear(loc.x, loc.y);
                if (citizen && citizen.job !== 'unemployed') {
                    const incident = new CrimeIncident(this.nextIncidentId++);
                    incident.type = 'theft';
                    incident.name = 'Theft';
                    incident.severity = 2;
                    incident.category = 'property';
                    incident.locationX = loc.x;
                    incident.locationY = loc.y;
                    incident.victimId = citizen.id;
                    incident.stolenAmount = Math.floor(this.rng?.next() * 30);
                    incident.reportedAt = this.game.state.time.tick;
                    incident.reportedBy = 'bystander';

                    this.incidents.set(incident.id, incident);
                }
            }
        }
    }

    /**
     * Find a victim near a location
     */
    _findVictimNear(x, y) {
        return this.game.citizens.citizens.find(c =>
            Math.abs(c.x - x) < 10 && Math.abs(c.y - y) < 10 &&
            c.job !== 'unemployed' &&
            this.rng?.chance(0.3)
        );
    }

    /**
     * Report a crime (from player action or witness)
     */
    reportCrime(type, x, y, perpetratorId = null) {
        const incident = new CrimeIncident(this.nextIncidentId++);
        incident.type = type;
        incident.name = CRIME_TYPES[type]?.name || type;
        incident.severity = CRIME_TYPES[type]?.severity || 1;
        incident.category = CRIME_TYPES[type]?.category || 'unknown';
        incident.locationX = x;
        incident.locationY = y;
        incident.perpetratorId = perpetratorId;
        incident.reportedAt = this.game.state.time.tick;
        incident.reportedBy = 'player';
        incident.policeInvestigation = true;

        this.incidents.set(incident.id, incident);
        this._updateStats();

        return incident;
    }

    /**
     * Update incident statistics
     */
    _updateStats() {
        const incidents = Array.from(this.incidents.values());
        const byCategory = {};
        const bySeverity = {};

        let solved = 0;
        let totalResponseTime = 0;
        let responseCount = 0;

        for (const incident of incidents) {
            // Category count
            if (!byCategory[incident.category]) byCategory[incident.category] = 0;
            byCategory[incident.category]++;

            // Severity count
            if (!bySeverity[incident.severity]) bySeverity[incident.severity] = 0;
            bySeverity[incident.severity]++;

            // Solved count
            if (incident.status === 'SOLVED') solved++;

            // Response time
            if (incident.detectedAt && incident.reportedAt) {
                totalResponseTime += incident.detectedAt - incident.reportedAt;
                responseCount++;
            }
        }

        this.crimeStats = {
            totalIncidents: incidents.length,
            byCategory,
            bySeverity,
            solvedRate: incidents.length > 0 ? solved / incidents.length : 0,
            avgResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
            heatImpact: incidents.reduce((sum, i) => sum + (i.heatImpact || 0), 0),
        };
    }

    /**
     * Handle police solving an incident
     */
    handleSolved(incidentId, perpetratorId) {
        const incident = this.incidents.get(incidentId);
        if (incident) {
            incident.solve(perpetratorId);
            this._updateStats();
        }
    }

    /**
     * Get crime trend
     */
    getTrend() {
        const history = this.incidentHistory.slice(-30);
        const recent = history.slice(-10);
        const older = history.slice(0, -10);

        const recentCount = recent.length;
        const olderCount = older.length;

        let trend = 'stable';
        if (recentCount > olderCount * 1.3) trend = 'increasing';
        else if (recentCount < olderCount * 0.7) trend = 'decreasing';

        return {
            trend,
            recentCount,
            olderCount,
            total: this.incidentHistory.length,
        };
    }

    /**
     * Serialize crime generator state
     */
    serialize() {
        return {
            incidents: Array.from(this.incidents.values()).map(i => i.serialize()),
            nextIncidentId: this.nextIncidentId,
            crimeStats: this.crimeStats,
            incidentHistory: this.incidentHistory.map(i => i.id),
        };
    }

    /**
     * Deserialize crime generator state
     */
    deserialize(data) {
        if (!data) return;

        this.incidents.clear();
        this.nextIncidentId = data.nextIncidentId || 1;

        for (const incidentData of data.incidents || []) {
            const incident = CrimeIncident.deserialize(incidentData);
            this.incidents.set(incident.id, incident);
        }

        // Rebuild incident history
        this.incidentHistory = [];
        for (const incidentId of data.incidentHistory || []) {
            const incident = this.incidents.get(incidentId);
            if (incident) this.incidentHistory.push(incident);
        }

        if (data.crimeStats) {
            this.crimeStats = data.crimeStats;
        }
    }
}