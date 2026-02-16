// Game Constants
export const TILE_SIZE = 40;

// Map presets (tiles)
export const MAP_PRESETS = {
    SMALL: { label: 'Small', width: 40, height: 40 },
    CITY: { label: 'City', width: 96, height: 96 },
    MEGA: { label: 'Mega', width: 256, height: 256 }
};

// Terrain types
export const TERRAIN_WATER = 0;
export const TERRAIN_GRASS = 1;
export const TERRAIN_FOREST = 2;
export const TERRAIN_MOUNTAIN = 3;

export const TERRAIN_COLORS = {
    [TERRAIN_WATER]: '#4da6ff',
    [TERRAIN_GRASS]: '#66cdaa',
    [TERRAIN_FOREST]: '#2d6a4f',
    [TERRAIN_MOUNTAIN]: '#8b4513'
};

export const TERRAIN_ICONS = {
    [TERRAIN_WATER]: '💧',
    [TERRAIN_GRASS]: '🟩',
    [TERRAIN_FOREST]: '🌲',
    [TERRAIN_MOUNTAIN]: '⛰️'
};

// Building types
export const BUILDING_HOUSE = 'house';
export const BUILDING_FARM = 'farm';
export const BUILDING_LUMBER_MILL = 'lumber-mill';
export const BUILDING_MARKET = 'market';
export const BUILDING_TOWN_HALL = 'town-hall';
export const BUILDING_WAREHOUSE = 'warehouse';
export const BUILDING_BARRACKS = 'barracks';
export const BUILDING_SCHOOL = 'school';

export const BUILDING_TYPES = {
    [BUILDING_HOUSE]: {
        name: 'House',
        icon: '🏠',
        description: 'Provides housing for 4 citizens',
        cost: { gold: 10, wood: 20 },
        population: 4,
        income: { gold: 1, food: 0, wood: 0 },
        upkeep: 0
    },
    [BUILDING_FARM]: {
        name: 'Farm',
        icon: '🚜',
        description: 'Produces 10 food per day',
        cost: { gold: 5, wood: 10 },
        population: 0,
        income: { gold: 0, food: 10, wood: 0 },
        upkeep: 1
    },
    [BUILDING_LUMBER_MILL]: {
        name: 'Lumber Mill',
        icon: '🪓',
        description: 'Produces 8 wood per day',
        cost: { gold: 20, wood: 30 },
        population: 0,
        income: { gold: 0, food: 0, wood: 8 },
        upkeep: 2
    },
    [BUILDING_MARKET]: {
        name: 'Market',
        icon: '🏪',
        description: 'Generates 15 gold per day',
        cost: { gold: 50, wood: 40 },
        population: 0,
        income: { gold: 15, food: 0, wood: 0 },
        upkeep: 3
    },
    [BUILDING_TOWN_HALL]: {
        name: 'Town Hall',
        icon: '🏛️',
        description: 'Generates 25 gold, increases victory progress',
        // NOTE: "house" is not a tracked resource; keep costs purely in tracked resources.
        cost: { gold: 120, wood: 100, food: 30 },
        population: 0,
        income: { gold: 25, food: 0, wood: 0 },
        upkeep: 5
    },
    [BUILDING_WAREHOUSE]: {
        name: 'Warehouse',
        icon: '📦',
        description: 'Stores extra resources (no upkeep)',
        cost: { gold: 30, wood: 50 },
        population: 0,
        income: { gold: 0, food: 5, wood: 5 },
        upkeep: 0
    },
    [BUILDING_BARRACKS]: {
        name: 'Barracks',
        icon: '⚔️',
        description: 'Trains soldiers, increases military victory',
        cost: { gold: 80, wood: 60, food: 40 },
        population: 0,
        income: { gold: 10, food: -5, wood: 0 },
        upkeep: 8
    },
    [BUILDING_SCHOOL]: {
        name: 'School',
        icon: '📚',
        description: 'Educates citizens, boosts culture and tech',
        cost: { gold: 60, wood: 50, food: 30 },
        population: 0,
        income: { gold: 5, food: 0, wood: 0 },
        upkeep: 5
    }
};

// Resource names
export const RESOURCE_NAMES = {
    gold: 'Gold',
    food: 'Food',
    wood: 'Wood',
    housing: 'Housing'
};

// Simple 3D presentation config for each building type (used by third-person renderer)
export const BUILDING_3D = {
    [BUILDING_HOUSE]: { height: 0.8 },
    [BUILDING_FARM]: { height: 0.35 },
    [BUILDING_LUMBER_MILL]: { height: 0.6 },
    [BUILDING_MARKET]: { height: 0.9 },
    [BUILDING_TOWN_HALL]: { height: 1.2 },
    [BUILDING_WAREHOUSE]: { height: 0.7 },
    [BUILDING_BARRACKS]: { height: 0.85 },
    [BUILDING_SCHOOL]: { height: 0.8 }
};

// Crisis events
export const CRISIS_TYPES = {
    FIRE: 'fire',
    FLOOD: 'flood',
    DROUGHT: 'drought',
    PLAGUE: 'plague',
    INFLATION: 'inflation',
    RIOT: 'riot',
    MIGRATION: 'migration'
};

// Difficulty levels
export const DIFFICULTY = {
    EASY: { resourceMultiplier: 1.5, crisisChance: 0.005, enemyStrength: 0.5 },
    NORMAL: { resourceMultiplier: 1.0, crisisChance: 0.01, enemyStrength: 1.0 },
    HARD: { resourceMultiplier: 0.7, crisisChance: 0.02, enemyStrength: 1.5 }
};

// Building upgrade levels
export const BUILDING_LEVELS = {
    1: { name: 'Basic', multiplier: 1.0, description: 'Standard efficiency' },
    2: { name: 'Improved', multiplier: 1.3, description: '+30% efficiency' },
    3: { name: 'Advanced', multiplier: 1.6, description: '+60% efficiency' },
    4: { name: 'Premium', multiplier: 2.0, description: '+100% efficiency' }
};

// Upgrade costs by level
export const UPGRADE_COSTS = {
    2: { gold: 50, wood: 30, food: 20 },
    3: { gold: 100, wood: 60, food: 40 },
    4: { gold: 200, wood: 100, food: 80 }
};

// Job types with their production and happiness modifiers
export const JOB_TYPES = {
    unemployed: {
        name: 'Unemployed',
        icon: '无助',
        description: 'No job - receives basic income',
        production: { gold: 0, food: 0, wood: 0 },
        happinessModifier: -5,
        baseSalary: 0
    },
    farmer: {
        name: 'Farmer',
        icon: '🌾',
        description: 'Produces food for the city',
        production: { gold: 0, food: 5, wood: 0 },
        happinessModifier: 5,
        baseSalary: 3,
        requiredBuilding: 'farm'
    },
    lumberjack: {
        name: 'Lumberjack',
        icon: '🪓',
        description: 'Harvests wood from forests',
        production: { gold: 0, food: 0, wood: 4 },
        happinessModifier: 3,
        baseSalary: 3,
        requiredBuilding: 'lumber-mill'
    },
    merchant: {
        name: 'Merchant',
        icon: '🏪',
        description: 'Trades goods for gold',
        production: { gold: 6, food: 0, wood: 0 },
        happinessModifier: 8,
        baseSalary: 4,
        requiredBuilding: 'market'
    },
    craftsman: {
        name: 'Craftsman',
        icon: '🔨',
        description: 'Creates goods for trade',
        production: { gold: 4, food: 0, wood: 2 },
        happinessModifier: 6,
        baseSalary: 4,
        requiredBuilding: 'warehouse'
    },
    official: {
        name: 'Town Official',
        icon: '📜',
        description: 'Manages town affairs',
        production: { gold: 2, food: 0, wood: 0 },
        happinessModifier: 10,
        baseSalary: 5,
        requiredBuilding: 'town-hall'
    },
    soldier: {
        name: 'Soldier',
        icon: '🛡️',
        description: 'Protects the city',
        production: { gold: 0, food: -2, wood: 0 },
        happinessModifier: 7,
        baseSalary: 6,
        requiredBuilding: 'barracks'
    },
    teacher: {
        name: 'Teacher',
        icon: '🎓',
        description: 'Educates citizens',
        production: { gold: 1, food: 0, wood: 0 },
        happinessModifier: 12,
        baseSalary: 4,
        requiredBuilding: 'school'
    }
};