// Household Model + Housing System - Milestone J
// Manages citizen households, housing allocation, and population dynamics

import { ensureCitizenState, getCitizenCapForPreset, deriveMood } from './citizen_state.js';

// Housing tiers based on building type
export const HOUSING_TIERS = Object.freeze({
    SHACK: { capacity: 1, quality: 10, name: 'Shack' },
    HOUSE: { capacity: 4, quality: 25, name: 'House' },
    APARTMENT: { capacity: 12, quality: 45, name: 'Apartment' },
    LUXURY: { capacity: 20, quality: 70, name: 'Luxury' },
});

// Housing capacity per building type
export const BUILDING_HOUSING = {
    house: HOUSING_TIERS.HOUSE.capacity,
    shack: HOUSING_TIERS.SHACK.capacity,
    apartment: HOUSING_TIERS.APARTMENT.capacity,
    luxury: HOUSING_TIERS.LUXURY.capacity,
};

/**
 * Household - represents a group of citizens living together
 */
export class Household {
    constructor(id) {
        this.id = id;
        this.members = []; // Array of citizen IDs
        this.homeBuildingId = null;
        this.homeX = null;
        this.homeY = null;
        this.createdTick = 0;
        this.updatedTick = 0;
        this.housingQuality = 0;
        this.occupancy = 0;
        this.capacity = 0;
    }

    /**
     * Add a member to the household
     */
    addMember(citizenId) {
        if (!this.members.includes(citizenId)) {
            this.members.push(citizenId);
            this.updatedTick = this.members.length;
        }
    }

    /**
     * Remove a member from the household
     */
    removeMember(citizenId) {
        const idx = this.members.indexOf(citizenId);
        if (idx > -1) {
            this.members.splice(idx, 1);
            this.updatedTick = this.members.length;
        }
    }

    /**
     * Check if household has room for more members
     */
    hasRoom() {
        return this.members.length < this.capacity;
    }

    /**
     * Get current occupancy ratio
     */
    getOccupancyRatio() {
        return this.capacity > 0 ? this.members.length / this.capacity : 0;
    }

    /**
     * Calculate household happiness based on quality and occupancy
     */
    getHappiness() {
        const qualityFactor = this.housingQuality / 100;
        const occupancyFactor = this.getOccupancyRatio() * 0.5 + 0.5; // 0.5-1.0
        const baseHappiness = 50;
        return Math.round(baseHappiness * qualityFactor * occupancyFactor);
    }

    /**
     * Serialize household state
     */
    serialize() {
        return {
            id: this.id,
            members: this.members,
            homeBuildingId: this.homeBuildingId,
            homeX: this.homeX,
            homeY: this.homeY,
            createdTick: this.createdTick,
            housingQuality: this.housingQuality,
            occupancy: this.occupancy,
            capacity: this.capacity,
        };
    }

    /**
     * Deserialize household state
     */
    static deserialize(data) {
        const household = new Household(data.id);
        household.members = data.members || [];
        household.homeBuildingId = data.homeBuildingId;
        household.homeX = data.homeX;
        household.homeY = data.homeY;
        household.createdTick = data.createdTick || 0;
        household.housingQuality = data.housingQuality || 0;
        household.occupancy = data.occupancy || 0;
        household.capacity = data.capacity || 0;
        return household;
    }
}

/**
 * Housing Manager - manages all households and housing allocation
 */
export class HousingManager {
    constructor(game) {
        this.game = game;
        this.households = new Map();
        this.nextHouseholdId = 1;
        this.housingStats = {
            totalHousing: 0,
            occupiedHousing: 0,
            availableHousing: 0,
            households: 0,
            overCrowded: 0,
        };
    }

    /**
     * Initialize or recompute all households
     */
    rebuildHouseholds() {
        this.households.clear();
        this.nextHouseholdId = 1;

        const citizens = this.game.citizens.citizens;
        const buildings = this.game.buildings.buildings;

        // Group citizens by their homeParcel or proximity
        const households = new Map();

        for (const citizen of citizens) {
            ensureCitizenState(citizen, this.game.map);

            // Find or create household for this citizen
            let householdId;

            if (citizen.homeParcel !== undefined && citizen.homeParcel !== null) {
                // Use parcel as household identifier
                householdId = `parcel_${citizen.homeParcel}`;
            } else {
                // Use home position as identifier
                householdId = `home_${Math.floor(citizen.x)}_${Math.floor(citizen.y)}`;
            }

            if (!households.has(householdId)) {
                households.set(householdId, {
                    id: this.nextHouseholdId++,
                    members: [],
                    x: Math.floor(citizen.x),
                    y: Math.floor(citizen.y),
                });
            }

            const hh = households.get(householdId);
            hh.members.push(citizen.id);
            citizen.householdId = hh.id;
        }

        // Convert to Household objects
        for (const [_, hh] of households) {
            const household = new Household(hh.id);
            household.members = hh.members;
            household.homeX = hh.x;
            household.homeY = hh.y;
            household.createdTick = this.game.state.time.tick;
            this.households.set(hh.id, household);
        }

        // Assign housing from buildings
        this._assignHousingFromBuildings(buildings);

        // Compute stats
        this._computeStats();
    }

    /**
     * Assign housing capacity from residential buildings
     */
    _assignHousingFromBuildings(buildings) {
        for (const building of buildings) {
            if (!BUILDING_HOUSING[building.type]) continue;

            // Find or create household for this building
            const householdId = `building_${building.id}`;
            let household = this.households.get(householdId);

            if (!household) {
                household = new Household(householdId);
                household.homeBuildingId = building.id;
                household.homeX = building.x;
                household.homeY = building.y;
                household.createdTick = this.game.state.time.tick;
                this.households.set(householdId, household);
            }

            // Set capacity based on building type
            household.capacity = BUILDING_HOUSING[building.type];
            household.housingQuality = HOUSING_TIERS[building.type.toUpperCase()]?.quality || 25;
        }

        // Assign citizens to building households
        for (const citizen of this.game.citizens.citizens) {
            if (!citizen.homeParcel && citizen.householdId) {
                const household = this.households.get(citizen.householdId);
                if (household && household.homeBuildingId) {
                    // Find the building
                    const building = buildings.find(b => b.id === household.homeBuildingId);
                    if (building) {
                        household.addMember(citizen.id);
                    }
                }
            }
        }
    }

    /**
     * Compute housing statistics
     */
    _computeStats() {
        let totalHousing = 0;
        let occupiedHousing = 0;
        let overCrowded = 0;

        for (const household of this.households.values()) {
            totalHousing += household.capacity;
            if (household.members.length > 0) {
                occupiedHousing += household.members.length;
            }
            if (household.members.length > household.capacity) {
                overCrowded++;
            }
        }

        this.housingStats = {
            totalHousing,
            occupiedHousing,
            availableHousing: totalHousing - occupiedHousing,
            households: this.households.size,
            overCrowded,
        };
    }

    /**
     * Find a household with available capacity near a location
     */
    findAvailableHousehold(x, y, maxDistance = 20) {
        const candidates = [];

        for (const household of this.households.values()) {
            if (household.hasRoom()) {
                const dist = Math.abs(household.homeX - x) + Math.abs(household.homeY - y);
                if (dist <= maxDistance) {
                    candidates.push({
                        household,
                        dist,
                        quality: household.housingQuality,
                    });
                }
            }
        }

        if (candidates.length === 0) return null;

        // Sort by quality (higher first), then distance (closer first)
        candidates.sort((a, b) => {
            if (b.quality !== a.quality) return b.quality - a.quality;
            return a.dist - b.dist;
        });

        return candidates[0].household;
    }

    /**
     * Assign a citizen to a household
     */
    assignToHousehold(citizen, householdId) {
        const household = this.households.get(householdId);
        if (!household) return false;

        if (!household.hasRoom()) return false;

        household.addMember(citizen.id);
        citizen.householdId = householdId;
        return true;
    }

    /**
     * Create a new household for a citizen
     */
    createNewHousehold(citizen, x, y, buildingId = null) {
        const household = new Household(this.nextHouseholdId++);
        household.homeX = x;
        household.homeY = y;
        household.homeBuildingId = buildingId;
        household.createdTick = this.game.state.time.tick;

        // Default to house capacity
        household.capacity = HOUSING_TIERS.HOUSE.capacity;
        household.housingQuality = HOUSING_TIERS.HOUSE.quality;

        household.addMember(citizen.id);
        citizen.householdId = household.id;

        this.households.set(household.id, household);
        this._computeStats();

        return household;
    }

    /**
     * Handle a citizen leaving (death or move out)
     */
    handleCitizenLeave(citizen) {
        if (!citizen.householdId) return;

        const household = this.households.get(citizen.householdId);
        if (household) {
            household.removeMember(citizen.id);

            // If household is empty, remove it
            if (household.members.length === 0) {
                this.households.delete(household.id);
            }
        }

        citizen.householdId = null;
        this._computeStats();
    }

    /**
     * Update households each tick
     */
    update(tick) {
        // Rebuild households periodically or when buildings change
        if (tick % 50 === 0) {
            this.rebuildHouseholds();
        }

        // Update household stats
        this._computeStats();
    }

    /**
     * Get housing demand (unhoused citizens)
     */
    getHousingDemand() {
        const unhoused = this.game.citizens.citizens.filter(c => !c.householdId).length;
        return Math.max(0, unhoused - this.housingStats.availableHousing);
    }

    /**
     * Serialize housing manager state
     */
    serialize() {
        return {
            households: Array.from(this.households.values()).map(h => h.serialize()),
            nextHouseholdId: this.nextHouseholdId,
            housingStats: this.housingStats,
        };
    }

    /**
     * Deserialize housing manager state
     */
    deserialize(data) {
        if (!data) return;

        this.households.clear();
        this.nextHouseholdId = data.nextHouseholdId || 1;

        for (const hhData of data.households || []) {
            const household = Household.deserialize(hhData);
            this.households.set(household.id, household);
        }

        if (data.housingStats) {
            this.housingStats = data.housingStats;
        }
    }
}

/**
 * Population Manager - handles citizen population dynamics
 */
export class PopulationManager {
    constructor(game) {
        this.game = game;
        this.birthRate = 0.001; // Births per tick
        this.deathRate = 0.0005; // Deaths per tick
        this.migrationRate = 0.0002; // Migration rate
        this.lastTickPopulation = 0;
    }

    /**
     * Calculate natural population change
     */
    getNaturalChange() {
        const population = this.game.citizens.getPopulation();
        const births = Math.round(population * this.birthRate);
        const deaths = Math.round(population * this.deathRate);
        return births - deaths;
    }

    /**
     * Calculate migration based on housing and employment
     */
    getMigration() {
        const housingDemand = this.game.housingManager?.getHousingDemand() || 0;
        const unemployment = this.game.jobsManager
            ? this.game.citizens.citizens.filter(c => c.job === 'unemployed').length
            : 0;

        const population = this.game.citizens.getPopulation();
        const cap = getCitizenCapForPreset(this.game.state.meta.mapPreset);

        // Negative migration if over cap or high unemployment
        if (population >= cap) return -Math.round(population * 0.001);
        if (unemployment > population * 0.15) return -Math.round(population * 0.0005);

        // Positive migration if good housing and employment
        if (housingDemand < 0) return Math.round(population * 0.002);
        return 0;
    }

    /**
     * Update population each tick
     */
    update(tick) {
        if (tick % 10 !== 0) return; // Update every 10 ticks

        const population = this.game.citizens.getPopulation();
        const cap = getCitizenCapForPreset(this.game.state.meta.mapPreset);

        // Check if we need to enforce cap
        if (population > cap) {
            const toRemove = population - cap;
            const citizens = this.game.citizens.citizens;
            citizens.sort((a, b) => a.id - b.id);
            citizens.splice(0, toRemove);
        }

        // Handle births and deaths
        const naturalChange = this.getNaturalChange();
        const migration = this.getMigration();

        if (naturalChange > 0) {
            this._handleBirths(naturalChange);
        } else if (naturalChange < 0) {
            this._handleDeaths(Math.abs(naturalChange));
        }

        if (migration > 0) {
            this._handleImmigration(migration);
        } else if (migration < 0) {
            this._handleEmigration(Math.abs(migration));
        }

        this.game.state.resources.population = this.game.citizens.getPopulation();
        this.game.state.resources.housing = this.game.buildings.totalHousing;
        this.lastTickPopulation = this.game.citizens.getPopulation();
    }

    /**
     * Handle new births
     */
    _handleBirths(count) {
        const households = Array.from(this.game.housingManager.households.values())
            .filter(h => h.hasRoom());

        if (households.length === 0) return;

        for (let i = 0; i < count; i++) {
            const household = households[Math.floor(Math.random() * households.length)];
            const x = household.homeX || Math.floor(this.game.map.width / 2);
            const y = household.homeY || Math.floor(this.game.map.height / 2);

            // Spawn new citizen (baby)
            const newCitizen = this.game.citizens.spawnCitizen(x, y);
            newCitizen.age = 0;
            newCitizen.householdId = household.id;

            // Add to household
            household.addMember(newCitizen.id);
        }
    }

    /**
     * Handle natural deaths
     */
    _handleDeaths(count) {
        const citizens = this.game.citizens.citizens;
        if (citizens.length <= count) return;

        // Sort by age (older first) for realistic mortality
        citizens.sort((a, b) => (a.age || 30) - (b.age || 30));

        for (let i = 0; i < count; i++) {
            if (citizens.length > 0) {
                const citizen = citizens.pop();
                this.game.housingManager?.handleCitizenLeave(citizen);
            }
        }
    }

    /**
     * Handle immigration
     */
    _handleImmigration(count) {
        const x = Math.floor(this.game.map.width / 2);
        const y = Math.floor(this.game.map.height / 2);

        for (let i = 0; i < count; i++) {
            const newCitizen = this.game.citizens.spawnCitizen(x, y);

            // Try to assign to a household
            const household = this.game.housingManager.findAvailableHousehold(x, y);
            if (household) {
                household.addMember(newCitizen.id);
                newCitizen.householdId = household.id;
            } else {
                // Create new household
                this.game.housingManager.createNewHousehold(newCitizen, x, y);
            }
        }
    }

    /**
     * Handle emigration
     */
    _handleEmigration(count) {
        const citizens = this.game.citizens.citizens;
        if (citizens.length <= count) return;

        // Sort by employment (unemployed first)
        citizens.sort((a, b) => {
            if (a.job === 'unemployed' && b.job !== 'unemployed') return -1;
            if (a.job !== 'unemployed' && b.job === 'unemployed') return 1;
            return a.id - b.id;
        });

        for (let i = 0; i < count; i++) {
            if (citizens.length > 0) {
                const citizen = citizens.pop();
                this.game.housingManager?.handleCitizenLeave(citizen);
            }
        }
    }

    /**
     * Get population stats
     */
    getStats() {
        return {
            population: this.game.citizens.getPopulation(),
            birthRate: this.birthRate,
            deathRate: this.deathRate,
            migration: this.getMigration(),
            naturalChange: this.getNaturalChange(),
            cap: getCitizenCapForPreset(this.game.state.meta.mapPreset),
        };
    }

    /**
     * Serialize population manager state
     */
    serialize() {
        return {
            birthRate: this.birthRate,
            deathRate: this.deathRate,
            migrationRate: this.migrationRate,
            lastTickPopulation: this.lastTickPopulation,
        };
    }

    /**
     * Deserialize population manager state
     */
    deserialize(data) {
        if (!data) return;

        this.birthRate = data.birthRate || 0.001;
        this.deathRate = data.deathRate || 0.0005;
        this.migrationRate = data.migrationRate || 0.0002;
        this.lastTickPopulation = data.lastTickPopulation || 0;
    }
}