// Territory/Pressure Map System - Manages district pressure, influence zones, and territorial control
// Creates dynamic territory effects based on faction presence and control

import { getDistrictAt, getDistrictName } from '../gen/districts.js';

// Pressure levels
export const PRESSURE_LEVELS = {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// Pressure types
export const PRESSURE_TYPES = {
    FACTION: 'faction',
    CRIME: 'crime',
    ECONOMIC: 'economic',
    SERVICE: 'service',
    SURVEILLANCE: 'surveillance'
};

// Default pressure influence map (how each faction affects each pressure type)
export const FACTION_PRESSURE_INFLUENCE = {
    citizens: {
        [PRESSURE_TYPES.FACTION]: 1.0,
        [PRESSURE_TYPES.CRIME]: -0.5, // Happy citizens reduce crime pressure
        [PRESSURE_TYPES.ECONOMIC]: 0.3,
        [PRESSURE_TYPES.SERVICE]: 0.2,
        [PRESSURE_TYPES.SURVEILLANCE]: -0.3
    },
    police: {
        [PRESSURE_TYPES.FACTION]: 0.5,
        [PRESSURE_TYPES.CRIME]: -2.0, // Police reduce crime pressure significantly
        [PRESSURE_TYPES.ECONOMIC]: 0.1,
        [PRESSURE_TYPES.SERVICE]: 0.5,
        [PRESSURE_TYPES.SURVEILLANCE]: 1.5
    },
    gangs: {
        [PRESSURE_TYPES.FACTION]: -0.5,
        [PRESSURE_TYPES.CRIME]: 2.0, // Gangs increase crime pressure
        [PRESSURE_TYPES.ECONOMIC]: -0.3,
        [PRESSURE_TYPES.SERVICE]: -0.5,
        [PRESSURE_TYPES.SURVEILLANCE]: -1.0
    },
    corp: {
        [PRESSURE_TYPES.FACTION]: 0.3,
        [PRESSURE_TYPES.CRIME]: 0.2,
        [PRESSURE_TYPES.ECONOMIC]: 1.5,
        [PRESSURE_TYPES.SERVICE]: 0.3,
        [PRESSURE_TYPES.SURVEILLANCE]: 0.5
    }
};

// Pressure Map Manager class
export class PressureMapManager {
    constructor(game, map, rng) {
        this.game = game;
        this.map = map;
        this.rng = rng;
        this.pressureGrid = null; // 2D array of pressure values
        this.factionInfluenceGrid = null; // 2D array of faction influence
        this.pressureHistory = []; // Track pressure changes over time
        this.lastUpdateTick = 0;
        this.gridWidth = map?.width || 100;
        this.gridHeight = map?.height || 100;
        this.districts = map?.districts || [];
        this.districtMap = map?.districtMap || null;
    }

    /**
     * Initialize the pressure map
     */
    initialize() {
        const width = this.gridWidth;
        const height = this.gridHeight;

        // Initialize pressure grid with zeros
        this.pressureGrid = new Float32Array(width * height).fill(0);

        // Initialize faction influence grid
        this.factionInfluenceGrid = {};
        for (const factionId of ['citizens', 'police', 'gangs', 'corp']) {
            this.factionInfluenceGrid[factionId] = new Float32Array(width * height).fill(0);
        }

        // Initialize pressure history
        this.pressureHistory = [];

        // Apply initial pressure from existing game state
        this.applyInitialPressure();

        this.lastUpdateTick = this.game.state.time.tick || 0;
    }

    /**
     * Apply initial pressure based on existing game state
     */
    applyInitialPressure() {
        const width = this.gridWidth;
        const height = this.gridHeight;

        // Apply district-based baseline pressure
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const districtId = getDistrictAt(this.districtMap, x, y, width);

                if (districtId >= 0 && districtId < this.districts.length) {
                    const district = this.districts[districtId];

                    // Apply district bias
                    this.pressureGrid[idx] += district.bias?.crimeBias || 0;

                    // Apply pressure based on district theme
                    const themePressure = this.getThemePressure(district.theme);
                    for (const [type, value] of Object.entries(themePressure)) {
                        this.applyPressure(x, y, type, value);
                    }
                }
            }
        }

        // Apply pressure from existing faction reputation
        const rep = this.game.state.factions?.reputation || {};
        for (const [factionId, reputation] of Object.entries(rep)) {
            this.applyFactionBasePressure(factionId, reputation);
        }
    }

    /**
     * Get baseline pressure for a district theme
     * @param {string} theme - District theme
     * @returns {Object} Pressure values by type
     */
    getThemePressure(theme) {
        const themes = {
            residential: {
                [PRESSURE_TYPES.FACTION]: 0.5,
                [PRESSURE_TYPES.SERVICE]: 0.5,
                [PRESSURE_TYPES.ECONOMIC]: -0.2
            },
            commercial: {
                [PRESSURE_TYPES.FACTION]: -0.3,
                [PRESSURE_TYPES.ECONOMIC]: 0.5,
                [PRESSURE_TYPES.SURVEILLANCE]: 0.3
            },
            industrial: {
                [PRESSURE_TYPES.FACTION]: -0.5,
                [PRESSURE_TYPES.ECONOMIC]: 0.3,
                [PRESSURE_TYPES.CRIME]: 0.2
            },
            waterfront: {
                [PRESSURE_TYPES.FACTION]: -0.2,
                [PRESSURE_TYPES.ECONOMIC]: 0.4,
                [PRESSURE_TYPES.CRIME]: 0.1
            },
            elite: {
                [PRESSURE_TYPES.FACTION]: 0.3,
                [PRESSURE_TYPES.SURVEILLANCE]: 0.5,
                [PRESSURE_TYPES.CRIME]: -0.3
            }
        };
        return themes[theme] || {};
    }

    /**
     * Apply base pressure from faction reputation
     * @param {string} factionId - Faction identifier
     * @param {number} reputation - Faction reputation (-100 to 100)
     */
    applyFactionBasePressure(factionId, reputation) {
        const width = this.gridWidth;
        const height = this.gridHeight;

        // Calculate influence factor based on reputation
        // Negative reputation = more negative influence (opposition)
        // Positive reputation = positive influence
        const influenceFactor = reputation / 100;

        // Apply base influence across the map
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                this.factionInfluenceGrid[factionId][idx] += influenceFactor * 5;
            }
        }
    }

    /**
     * Get faction influence at a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} factionId - Faction identifier
     * @returns {number} Faction influence value
     */
    getFactionInfluence(x, y, factionId) {
        const width = this.gridWidth;
        const idx = y * width + x;
        return this.factionInfluenceGrid[factionId]?.[idx] || 0;
    }

    /**
     * Get total faction pressure at a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Total pressure value
     */
    getTotalPressure(x, y) {
        const width = this.gridWidth;
        const idx = y * width + x;
        return this.pressureGrid[idx] || 0;
    }

    /**
     * Get pressure level at a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string} Pressure level
     */
    getPressureLevel(x, y) {
        const pressure = this.getTotalPressure(x, y);
        if (pressure < -0.2) return PRESSURE_LEVELS.LOW;
        if (pressure < 0.2) return PRESSURE_LEVELS.MODERATE;
        if (pressure < 0.6) return PRESSURE_LEVELS.HIGH;
        return PRESSURE_LEVELS.CRITICAL;
    }

    /**
     * Apply pressure to a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} pressureType - Type of pressure
     * @param {number} value - Pressure value (positive increases, negative decreases)
     * @param {number} radius - Radius of effect (default: 1)
     */
    applyPressure(x, y, pressureType, value, radius = 1) {
        const width = this.gridWidth;
        const height = this.gridHeight;

        // Calculate pressure decay factor
        const decay = 0.5;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;

                // Check bounds
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

                const idx = ny * width + nx;

                // Apply pressure with distance decay
                const distance = Math.sqrt(dx * dx + dy * dy);
                const decayFactor = Math.pow(decay, distance);
                const appliedValue = value * decayFactor;

                this.pressureGrid[idx] += appliedValue;

                // Clamp pressure
                this.pressureGrid[idx] = Math.max(-2, Math.min(2, this.pressureGrid[idx]));
            }
        }
    }

    /**
     * Apply faction pressure at a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} factionId - Faction identifier
     * @param {number} value - Influence value
     * @param {number} radius - Radius of effect
     */
    applyFactionPressure(x, y, factionId, value, radius = 1) {
        const width = this.gridWidth;

        // Calculate faction pressure based on influence map
        const influenceMap = FACTION_PRESSURE_INFLUENCE[factionId] || {};
        for (const [pressureType, multiplier] of Object.entries(influenceMap)) {
            const pressureValue = value * multiplier;
            this.applyPressure(x, y, pressureType, pressureValue, radius);
        }

        // Track faction-specific influence
        const idx = y * width + x;
        this.factionInfluenceGrid[factionId][idx] += value;
    }

    /**
     * Apply service pressure (police, medical, etc.)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} serviceType - Type of service
     * @param {number} coverage - Service coverage (0-1)
     * @param {number} radius - Service radius
     */
    applyServicePressure(x, y, serviceType, coverage, radius = 3) {
        // Positive coverage reduces crime pressure
        const basePressure = coverage * 2;

        switch (serviceType) {
            case 'police':
                this.applyPressure(x, y, PRESSURE_TYPES.CRIME, -basePressure, radius);
                this.applyPressure(x, y, PRESSURE_TYPES.SURVEILLANCE, coverage, radius);
                break;
            case 'fire':
                this.applyPressure(x, y, PRESSURE_TYPES.SERVICE, coverage, radius);
                break;
            case 'medical':
                this.applyPressure(x, y, PRESSURE_TYPES.SERVICE, coverage, radius);
                this.applyPressure(x, y, PRESSURE_TYPES.FACTION, coverage * 0.5, radius);
                break;
        }
    }

    /**
     * Get district pressure summary
     * @param {number} districtId - District ID
     * @returns {Object} District pressure data
     */
    getDistrictPressure(districtId) {
        const district = this.districts.find(d => d.id === districtId);
        if (!district) return null;

        let totalPressure = 0;
        let crimePressure = 0;
        let factionPressure = 0;
        let servicePressure = 0;
        let count = 0;

        for (const tile of district.tiles) {
            const pressure = this.getTotalPressure(tile.x, tile.y);
            totalPressure += pressure;
            count++;

            // Calculate pressure breakdown
            const idx = tile.y * this.gridWidth + tile.x;
            const breakdown = this.getPressureBreakdown(idx);
            crimePressure += breakdown.crime;
            factionPressure += breakdown.faction;
            servicePressure += breakdown.service;
        }

        return {
            districtId,
            districtName: district.name,
            averagePressure: totalPressure / (count || 1),
            crimePressure: crimePressure / (count || 1),
            factionPressure: factionPressure / (count || 1),
            servicePressure: servicePressure / (count || 1),
            pressureLevel: this.getPressureLevel(district.center.x, district.center.y)
        };
    }

    /**
     * Get pressure breakdown at an index
     * @param {number} idx - Grid index
     * @returns {Object} Pressure breakdown by type
     */
    getPressureBreakdown(idx) {
        const pressure = this.pressureGrid[idx] || 0;

        // Estimate breakdown based on pressure sources
        return {
            crime: pressure * 0.3,
            faction: pressure * 0.4,
            economic: pressure * 0.2,
            service: pressure * 0.1,
            total: pressure
        };
    }

    /**
     * Get territorial control by faction
     * @returns {Object} Faction territorial control stats
     */
    getTerritorialControl() {
        const control = {
            citizens: 0,
            police: 0,
            gangs: 0,
            corp: 0,
            neutral: 0,
            total: 0
        };

        const width = this.gridWidth;
        const height = this.gridHeight;
        const totalTiles = width * height;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const pressure = this.pressureGrid[idx] || 0;

                // Determine dominant influence
                const citizensInfluence = this.getFactionInfluence(x, y, 'citizens');
                const policeInfluence = this.getFactionInfluence(x, y, 'police');
                const gangsInfluence = this.getFactionInfluence(x, y, 'gangs');
                const corpInfluence = this.getFactionInfluence(x, y, 'corp');

                const maxInfluence = Math.max(
                    citizensInfluence,
                    policeInfluence,
                    gangsInfluence,
                    corpInfluence
                );

                if (maxInfluence === 0) {
                    control.neutral++;
                } else if (maxInfluence === policeInfluence) {
                    control.police++;
                } else if (maxInfluence === gangsInfluence) {
                    control.gangs++;
                } else if (maxInfluence === corpInfluence) {
                    control.corp++;
                } else {
                    control.citizens++;
                }

                control.total++;
            }
        }

        // Convert to percentages
        for (const key of Object.keys(control)) {
            if (key !== 'total') {
                control[key] = control[key] / (control.total || 1) * 100;
            }
        }

        return control;
    }

    /**
     * Update pressure map each tick
     * @param {number} tick - Current tick
     */
    update(tick) {
        const width = this.gridWidth;
        const height = this.gridHeight;
        const dt = tick - this.lastUpdateTick;

        if (dt <= 0) return;

        // Get current faction reputation
        const rep = this.game.state.factions?.reputation || {};

        // Calculate pressure changes based on faction reputation
        for (const [factionId, reputation] of Object.entries(rep)) {
            const influenceMap = FACTION_PRESSURE_INFLUENCE[factionId] || {};
            const repFactor = reputation / 100;

            // Apply faction influence decay/growth
            for (let i = 0; i < this.factionInfluenceGrid[factionId].length; i++) {
                // Slowly decay influence towards baseline
                const current = this.factionInfluenceGrid[factionId][i];
                const baseline = repFactor * 5;
                this.factionInfluenceGrid[factionId][i] += (baseline - current) * 0.05;

                // Update pressure grid
                for (const [pressureType, multiplier] of Object.entries(influenceMap)) {
                    const pressureValue = this.factionInfluenceGrid[factionId][i] * multiplier;
                    this.pressureGrid[i] += pressureValue * 0.01 * dt;
                }

                // Clamp pressure
                this.pressureGrid[i] = Math.max(-2, Math.min(2, this.pressureGrid[i]));
            }
        }

        // Track pressure changes
        if (tick % 10 === 0) {
            const avgPressure = Array.from(this.pressureGrid).reduce((a, b) => a + b, 0) / (width * height);
            this.pressureHistory.push({
                tick,
                avgPressure,
                maxPressure: Math.max(...this.pressureGrid),
                minPressure: Math.min(...this.pressureGrid)
            });

            // Keep only last 100 entries
            if (this.pressureHistory.length > 100) {
                this.pressureHistory.shift();
            }
        }

        this.lastUpdateTick = tick;
    }

    /**
     * Get pressure telemetry for UI
     * @returns {Object} Pressure telemetry
     */
    getTelemetry() {
        return {
            pressureGrid: this.pressureGrid,
            factionInfluence: Object.entries(this.factionInfluenceGrid).map(([faction, grid]) => ({
                faction,
                average: Array.from(grid).reduce((a, b) => a + b, 0) / grid.length
            })),
            pressureHistory: this.pressureHistory.slice(-30),
            territorialControl: this.getTerritorialControl(),
            districtPressure: this.districts.map(d => this.getDistrictPressure(d.id))
        };
    }

    /**
     * Export pressure data as grid for visualization
     * @returns {Array} 2D array of pressure values
     */
    exportPressureGrid() {
        const grid = [];
        const width = this.gridWidth;
        const height = this.gridHeight;

        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push(this.getTotalPressure(x, y));
            }
            grid.push(row);
        }

        return grid;
    }
}