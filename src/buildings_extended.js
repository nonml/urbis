// Extended Buildings - Additional building types with advanced gameplay mechanics
// These buildings unlock as the city grows and provide new strategic options

import {
    BUILDING_POWER_PLANT,
    BUILDING_SUBSTATION,
    BUILDING_POLICE_STATION,
    BUILDING_CCTV_NETWORK,
    BUILDING_COUNTERINTEL,
    BUILDING_PROPAGANDA_OFFICE
} from './constants.js';

// Extended building type constants
export const BUILDING_APARTMENT = 'apartment';
export const BUILDING_HOSPITAL = 'hospital';
export const BUILDING_FIRE_STATION = 'fire-station';
export const BUILDING_PARK = 'park';
export const BUILDING_STADIUM = 'stadium';
export const BUILDING_UNIVERSITY = 'university';
export const BUILDING_RESEARCH_LAB = 'research-lab';
export const BUILDING_AIRPORT = 'airport';
export const BUILDING_PORT = 'port';
export const BUILDING_NUCLEAR_PLANT = 'nuclear-plant';
export const BUILDING_SOLAR_FARM = 'solar-farm';
export const BUILDING_WIND_FARM = 'wind-farm';
export const BUILDING_RECYCLING_PLANT = 'recycling-plant';
export const BUILDING_PRISON = 'prison';
export const BUILDING_COURTHOUSE = 'courthouse';
export const BUILDING_LIBRARY = 'library';
export const BUILDING_THEATER = 'theater';
export const BUILDING_MUSEUM = 'museum';
export const BUILDING_SHOPPING_MALL = 'shopping-mall';
export const BUILDING_HOTEL = 'hotel';
export const BUILDING_RESTAURANT = 'restaurant';
export const BUILDING_NIGHTCLUB = 'nightclub';
export const BUILDING_BUS_STOP      = 'bus-stop';
export const BUILDING_BUS_DEPOT     = 'bus-depot';
export const BUILDING_METRO_STATION = 'metro-station';
export const BUILDING_TOLLWAY_GATE  = 'tollway-gate';
export const BUILDING_HIGHWAY_RAMP  = 'highway-ramp';
export const BUILDING_SUBWAY_SHAFT  = 'subway-shaft';

// Extended building definitions
export const BUILDING_EXTENDED = {
    [BUILDING_APARTMENT]: {
        name: 'Apartment',
        icon: '🏢',
        description: 'High-density housing for 20 citizens',
        cost: { gold: 150, wood: 100 },
        income: { gold: 8, food: 0, wood: 0 },
        upkeep: 8,
        population: 20,
        effects: { housingDensity: 0.4 },
        unlockRequirement: { population: 30 }
    },
    // Infrastructure buildings
    [BUILDING_HOSPITAL]: {
        name: 'Hospital',
        icon: '🏥',
        description: 'Improves citizen health, reduces plague risk',
        cost: { gold: 200, wood: 150, food: 100 },
        income: { gold: -10, food: 0, wood: 0 },
        upkeep: 15,
        population: 0,
        effects: {
            healthBonus: 20,
            plagueResistance: 0.3
        },
        unlockRequirement: { population: 50 }
    },
    [BUILDING_FIRE_STATION]: {
        name: 'Fire Station',
        icon: '🚒',
        description: 'Reduces fire risk and response time',
        cost: { gold: 150, wood: 100, food: 50 },
        income: { gold: -5, food: 0, wood: 0 },
        upkeep: 10,
        population: 0,
        effects: {
            fireReduction: 0.5,
            crisisResponse: 0.25
        },
        unlockRequirement: { population: 30 }
    },
    [BUILDING_PARK]: {
        name: 'Park',
        icon: '🌳',
        description: 'Boosts citizen happiness, reduces crime',
        cost: { gold: 80, wood: 60, food: 20 },
        income: { gold: 2, food: 0, wood: 0 },
        upkeep: 5,
        population: 0,
        effects: {
            happinessBonus: 10,
            crimeReduction: 0.15
        },
        unlockRequirement: { population: 20 }
    },
    [BUILDING_STADIUM]: {
        name: 'Stadium',
        icon: '🏟️',
        description: 'Major happiness boost, hosts events',
        cost: { gold: 500, wood: 400, food: 200 },
        income: { gold: 20, food: 0, wood: 0 },
        upkeep: 30,
        population: 0,
        effects: {
            happinessBonus: 25,
            eventCapacity: 1000
        },
        unlockRequirement: { population: 200 }
    },
    // Education buildings
    [BUILDING_UNIVERSITY]: {
        name: 'University',
        icon: '🎓',
        description: 'Advanced education, research boost',
        cost: { gold: 300, wood: 250, food: 150 },
        income: { gold: 5, food: 0, wood: 0 },
        upkeep: 20,
        population: 0,
        effects: {
            researchBonus: 0.5,
            educationBonus: 0.3
        },
        unlockRequirement: { population: 100 }
    },
    [BUILDING_RESEARCH_LAB]: {
        name: 'Research Lab',
        icon: '🔬',
        description: 'Develops new technologies',
        cost: { gold: 400, wood: 300, food: 200 },
        income: { gold: -15, food: 0, wood: 0 },
        upkeep: 25,
        population: 0,
        effects: {
            researchBonus: 1.0,
            techProgress: 5
        },
        unlockRequirement: { population: 150, techLevel: 3 }
    },
    [BUILDING_LIBRARY]: {
        name: 'Library',
        icon: '📚',
        description: 'Education and culture boost',
        cost: { gold: 120, wood: 100, food: 50 },
        income: { gold: 3, food: 0, wood: 0 },
        upkeep: 8,
        population: 0,
        effects: {
            educationBonus: 0.2,
            cultureBonus: 0.15
        },
        unlockRequirement: { population: 40 }
    },
    // Transportation buildings
    [BUILDING_AIRPORT]: {
        name: 'Airport',
        icon: '✈️',
        description: 'Boosts trade, enables international relations',
        cost: { gold: 800, wood: 600, food: 400 },
        income: { gold: 50, food: 0, wood: 0 },
        upkeep: 50,
        population: 0,
        effects: {
            tradeBonus: 0.5,
            tourismBonus: 0.3
        },
        unlockRequirement: { population: 300 }
    },
    [BUILDING_PORT]: {
        name: 'Port',
        description: 'Enables maritime trade and fishing',
        icon: '🚢',
        cost: { gold: 600, wood: 500, food: 200 },
        income: { gold: 40, food: 5, wood: 0 },
        upkeep: 40,
        population: 0,
        effects: {
            tradeBonus: 0.4,
            fishingBonus: 0.3
        },
        unlockRequirement: { population: 200, waterAccess: true }
    },
    // Energy buildings
    [BUILDING_NUCLEAR_PLANT]: {
        name: 'Nuclear Plant',
        icon: '⚛️',
        description: 'Massive power output, risk of meltdown',
        cost: { gold: 1000, wood: 500, food: 200 },
        income: { gold: -20, food: 0, wood: 0 },
        upkeep: 30,
        population: 0,
        effects: {
            powerOutput: 1000,
            meltdownRisk: 0.001
        },
        unlockRequirement: { population: 400, techLevel: 5 }
    },
    [BUILDING_SOLAR_FARM]: {
        name: 'Solar Farm',
        icon: '☀️',
        description: 'Clean energy, works during day only',
        cost: { gold: 300, wood: 200, food: 100 },
        income: { gold: -5, food: 0, wood: 0 },
        upkeep: 10,
        population: 0,
        effects: {
            powerOutput: 200,
            cleanEnergy: true,
            dayOnly: true
        },
        unlockRequirement: { population: 100, techLevel: 2 }
    },
    [BUILDING_WIND_FARM]: {
        name: 'Wind Farm',
        icon: '💨',
        description: 'Clean energy, weather dependent',
        cost: { gold: 350, wood: 250, food: 100 },
        income: { gold: -5, food: 0, wood: 0 },
        upkeep: 12,
        population: 0,
        effects: {
            powerOutput: 250,
            cleanEnergy: true,
            weatherDependent: true
        },
        unlockRequirement: { population: 120, techLevel: 2 }
    },
    [BUILDING_RECYCLING_PLANT]: {
        name: 'Recycling Plant',
        icon: '♻️',
        description: 'Converts waste into resources',
        cost: { gold: 250, wood: 200, food: 100 },
        income: { gold: 5, food: 2, wood: 3 },
        upkeep: 15,
        population: 0,
        effects: {
            wasteReduction: 0.5,
            resourceRecycling: 0.2
        },
        unlockRequirement: { population: 100 }
    },
    // Justice buildings
    [BUILDING_PRISON]: {
        name: 'Prison',
        icon: '⛓️',
        description: 'Houses criminals, reduces crime rate',
        cost: { gold: 300, wood: 250, food: 150 },
        income: { gold: -10, food: 0, wood: 0 },
        upkeep: 20,
        population: 0,
        effects: {
            crimeReduction: 0.25,
            capacity: 100
        },
        unlockRequirement: { population: 80 }
    },
    [BUILDING_COURTHOUSE]: {
        name: 'Courthouse',
        icon: '⚖️',
        description: 'Justice system, reduces corruption',
        cost: { gold: 250, wood: 200, food: 100 },
        income: { gold: -5, food: 0, wood: 0 },
        upkeep: 15,
        population: 0,
        effects: {
            corruptionReduction: 0.2,
            legalBonus: 0.15
        },
        unlockRequirement: { population: 60 }
    },
    // Culture buildings
    [BUILDING_THEATER]: {
        name: 'Theater',
        icon: '🎭',
        description: 'Entertainment, boosts culture',
        cost: { gold: 200, wood: 150, food: 80 },
        income: { gold: 10, food: 0, wood: 0 },
        upkeep: 12,
        population: 0,
        effects: {
            cultureBonus: 0.2,
            happinessBonus: 8
        },
        unlockRequirement: { population: 70 }
    },
    [BUILDING_MUSEUM]: {
        name: 'Museum',
        icon: '🏛️',
        description: 'Preserves history, boosts culture significantly',
        cost: { gold: 350, wood: 300, food: 150 },
        income: { gold: 8, food: 0, wood: 0 },
        upkeep: 15,
        population: 0,
        effects: {
            cultureBonus: 0.35,
            artifactDisplay: true
        },
        unlockRequirement: { population: 120 }
    },
    // Commercial buildings
    [BUILDING_SHOPPING_MALL]: {
        name: 'Shopping Mall',
        icon: '🛒',
        description: 'Major commercial hub, high income',
        cost: { gold: 500, wood: 400, food: 200 },
        income: { gold: 40, food: 0, wood: 0 },
        upkeep: 25,
        population: 0,
        effects: {
            commerceBonus: 0.3,
            happinessBonus: 5
        },
        unlockRequirement: { population: 150 }
    },
    [BUILDING_HOTEL]: {
        name: 'Hotel',
        icon: '🏨',
        description: 'Accommodates tourists, boosts tourism',
        cost: { gold: 300, wood: 250, food: 150 },
        income: { gold: 25, food: 0, wood: 0 },
        upkeep: 18,
        population: 0,
        effects: {
            tourismBonus: 0.2,
            roomCapacity: 50
        },
        unlockRequirement: { population: 100 }
    },
    [BUILDING_RESTAURANT]: {
        name: 'Restaurant',
        icon: '🍽️',
        description: 'Food service, boosts happiness',
        cost: { gold: 100, wood: 80, food: 50 },
        income: { gold: 8, food: -2, wood: 0 },
        upkeep: 6,
        population: 0,
        effects: {
            happinessBonus: 5,
            foodVariety: 0.1
        },
        unlockRequirement: { population: 40 }
    },
    [BUILDING_NIGHTCLUB]: {
        name: 'Nightclub',
        icon: '🌙',
        description: 'Nightlife entertainment, attracts youth',
        cost: { gold: 200, wood: 150, food: 100 },
        income: { gold: 15, food: 0, wood: 0 },
        upkeep: 12,
        population: 0,
        effects: {
            happinessBonus: 10,
            nightlifeRating: 0.25
        },
        unlockRequirement: { population: 80 }
    },
    [BUILDING_BUS_STOP]: {
        name: 'Bus Stop',
        icon: '🚌',
        description: 'Public bus stop, increases citizen mobility',
        cost: { gold: 40, wood: 20, food: 0 },
        income: { gold: 3, food: 0, wood: 0 },
        upkeep: 3,
        population: 0,
        effects: { mobilityBonus: 0.10, transitCoverage: 0.05 },
        unlockRequirement: { population: 20 }
    },
    [BUILDING_BUS_DEPOT]: {
        name: 'Bus Depot',
        icon: '🚌',
        description: 'Maintains bus fleet, required for bus routes',
        cost: { gold: 200, wood: 150, food: 50 },
        income: { gold: -8, food: 0, wood: 0 },
        upkeep: 15,
        population: 0,
        effects: { busRoutes: 3, mobilityBonus: 0.20 },
        unlockRequirement: { population: 60 }
    },
    [BUILDING_METRO_STATION]: {
        name: 'Metro Station',
        icon: '🚇',
        description: 'Underground metro stop, high-capacity urban transit',
        cost: { gold: 500, wood: 200, food: 100 },
        income: { gold: 15, food: 0, wood: 0 },
        upkeep: 25,
        population: 0,
        effects: { mobilityBonus: 0.35, transitCoverage: 0.20, congestionReduction: 0.15 },
        unlockRequirement: { population: 150, techLevel: 2 }
    },
    [BUILDING_TOLLWAY_GATE]: {
        name: 'Tollway Gate',
        icon: '🚧',
        description: 'Toll collection booth on highway, generates revenue',
        cost: { gold: 150, wood: 80, food: 0 },
        income: { gold: 20, food: 0, wood: 0 },
        upkeep: 5,
        population: 0,
        effects: { tollRevenue: 20, trafficControl: 0.10 },
        unlockRequirement: { population: 100 }
    },
    [BUILDING_HIGHWAY_RAMP]: {
        name: 'Highway Ramp',
        icon: '🛣️',
        description: 'On/off ramp connecting local roads to highway',
        cost: { gold: 120, wood: 60, food: 0 },
        income: { gold: 0, food: 0, wood: 0 },
        upkeep: 4,
        population: 0,
        effects: { connectivityBonus: 0.15 },
        unlockRequirement: { population: 80 }
    },
    [BUILDING_SUBWAY_SHAFT]: {
        name: 'Subway Shaft',
        icon: '🚇',
        description: 'Ventilation/access shaft for underground subway line',
        cost: { gold: 80, wood: 40, food: 0 },
        income: { gold: 0, food: 0, wood: 0 },
        upkeep: 3,
        population: 0,
        effects: { subwayAccess: true },
        unlockRequirement: { population: 120, techLevel: 2 }
    },
};

/**
 * Check if a building is unlocked based on city state
 */
export function isBuildingUnlocked(buildingKey, cityState) {
    const building = BUILDING_EXTENDED[buildingKey];
    if (!building || !building.unlockRequirement) {
        return true; // Base buildings always unlocked
    }

    const req = building.unlockRequirement;

    // Check population requirement
    if (req.population && (cityState.population || 0) < req.population) {
        return false;
    }

    // Check tech level requirement
    if (req.techLevel && (cityState.techLevel || 0) < req.techLevel) {
        return false;
    }

    // Check special requirements
    if (req.waterAccess && !cityState.hasWaterAccess) {
        return false;
    }

    return true;
}

/**
 * Get all unlocked buildings for current city state
 */
export function getUnlockedBuildings(cityState) {
    const unlocked = [];
    for (const [key, building] of Object.entries(BUILDING_EXTENDED)) {
        if (isBuildingUnlocked(key, cityState)) {
            unlocked.push({ key, ...building });
        }
    }
    return unlocked;
}

/**
 * Get building requirements as formatted string
 */
export function getBuildingRequirements(buildingKey) {
    const building = BUILDING_EXTENDED[buildingKey];
    if (!building || !building.unlockRequirement) {
        return 'Available';
    }

    const req = building.unlockRequirement;
    const parts = [];

    if (req.population) {
        parts.push(`${req.population} population`);
    }
    if (req.techLevel) {
        parts.push(`Tech Level ${req.techLevel}`);
    }
    if (req.waterAccess) {
        parts.push('Water access required');
    }

    return parts.join(', ');
}

/**
 * Calculate building effects on city state
 */
export function calculateBuildingEffects(buildings) {
    const effects = {
        healthBonus: 0,
        happinessBonus: 0,
        crimeReduction: 0,
        cultureBonus: 0,
        researchBonus: 0,
        educationBonus: 0,
        tradeBonus: 0,
        tourismBonus: 0,
        powerOutput: 0,
        cleanEnergy: 0,
        fireReduction: 0,
        plagueResistance: 0
    };

    for (const building of buildings) {
        const buildingData = BUILDING_EXTENDED[building.type];
        if (buildingData && buildingData.effects) {
            for (const [key, value] of Object.entries(buildingData.effects)) {
                if (effects[key] !== undefined) {
                    if (typeof value === 'number') {
                        effects[key] += value;
                    }
                }
            }
        }
    }

    return effects;
}

/**
 * Get building category for UI organization
 */
export function getBuildingCategory(buildingKey) {
    const categories = {
        infrastructure: [
            BUILDING_HOSPITAL, BUILDING_FIRE_STATION, BUILDING_PARK, BUILDING_STADIUM
        ],
        education: [
            BUILDING_UNIVERSITY, BUILDING_RESEARCH_LAB, BUILDING_LIBRARY
        ],
        transportation: [
            BUILDING_AIRPORT, BUILDING_PORT
        ],
        energy: [
            BUILDING_NUCLEAR_PLANT, BUILDING_SOLAR_FARM, BUILDING_WIND_FARM, BUILDING_RECYCLING_PLANT
        ],
        justice: [
            BUILDING_PRISON, BUILDING_COURTHOUSE
        ],
        culture: [
            BUILDING_THEATER, BUILDING_MUSEUM
        ],
        commercial: [
            BUILDING_SHOPPING_MALL, BUILDING_HOTEL, BUILDING_RESTAURANT, BUILDING_NIGHTCLUB
        ]
    };

    for (const [category, buildings] of Object.entries(categories)) {
        if (buildings.includes(buildingKey)) {
            return category;
        }
    }

    return 'other';
}

/**
 * Export all extended building constants
 */
export const EXTENDED_BUILDING_KEYS = Object.keys(BUILDING_EXTENDED);