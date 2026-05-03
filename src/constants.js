// Game Constants
export const TILE_SIZE = 40;

// Extended buildings import for unified exports
export * from './buildings_extended.js';

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
export const TERRAIN_ROAD = 4;
export const TERRAIN_SIDEWALK = 5;
export const TERRAIN_PARK = 6;
export const TERRAIN_HIGHWAY = 7;   // Wide elevated road
export const TERRAIN_BRIDGE  = 8;   // Road bridge over water
export const TERRAIN_TUNNEL  = 9;   // Underground road through mountain

// Interactable node types (stored as tile modifiers)
export const INTERACTABLE_POWER_SUBSTATION = 'power_substation';
export const INTERACTABLE_CCTV_POLE = 'cctv_pole';
export const INTERACTABLE_TELECOM_BOX = 'telecom_box';

export const TERRAIN_COLORS = {
    [TERRAIN_WATER]: '#4da6ff',
    [TERRAIN_GRASS]: '#66cdaa',
    [TERRAIN_FOREST]: '#2d6a4f',
    [TERRAIN_MOUNTAIN]: '#8b4513',
    [TERRAIN_ROAD]: '#888888',
    [TERRAIN_SIDEWALK]: '#dddddd',
    [TERRAIN_PARK]: '#90ee90',
    [TERRAIN_HIGHWAY]: '#555566',  // dark grey-blue asphalt
    [TERRAIN_BRIDGE]:  '#8a7a60',  // concrete tan
    [TERRAIN_TUNNEL]:  '#2a2a2a',  // near-black
};

export const TERRAIN_ICONS = {
    [TERRAIN_WATER]: '💧',
    [TERRAIN_GRASS]: '🟩',
    [TERRAIN_FOREST]: '🌲',
    [TERRAIN_MOUNTAIN]: '⛰️',
    [TERRAIN_ROAD]: '🛣️',
    [TERRAIN_SIDEWALK]: '🚶',
    [TERRAIN_PARK]: '🌳',
    [TERRAIN_HIGHWAY]: '🛣️',
    [TERRAIN_BRIDGE]:  '🌉',
    [TERRAIN_TUNNEL]:  '🚇',
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
export const BUILDING_ROAD = 'road';

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
    },
    [BUILDING_ROAD]: {
        name: 'Road',
        icon: '🛣️',
        description: 'Connects buildings and enables transportation',
        cost: { gold: 5 },
        population: 0,
        income: { gold: 0, food: 0, wood: 0 },
        upkeep: 0
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
    [BUILDING_HOUSE]: { height: 0.22 },      // 1-2 storey residential
    [BUILDING_FARM]: { height: 0.14 },        // low barn
    [BUILDING_LUMBER_MILL]: { height: 0.28 },
    [BUILDING_MARKET]: { height: 0.32, doorway: { side: 'south', interior: 'shop' } },
    [BUILDING_TOWN_HALL]: { height: 0.55 },
    [BUILDING_WAREHOUSE]: { height: 0.30, doorway: { side: 'south', interior: 'safehouse' } },
    [BUILDING_BARRACKS]: { height: 0.35 },
    [BUILDING_SCHOOL]: { height: 0.30 },
    // Transit / infrastructure buildings
    'bus-stop':      { height: 0.30 },
    'bus-depot':     { height: 0.70 },
    'metro-station': { height: 0.90, doorway: { side: 'south', interior: 'subway' } },
    'tollway-gate':  { height: 0.40 },
    'highway-ramp':  { height: 0.30 },
    'subway-shaft':  { height: 0.50, doorway: { side: 'south', interior: 'subway' } },
};

// Crisis events
export const CRISIS_TYPES = {
    FIRE: 'fire',
    FLOOD: 'flood',
    DROUGHT: 'drought',
    PLAGUE: 'plague',
    INFLATION: 'inflation',
    RIOT: 'riot',
    MIGRATION: 'migration',
    BLACKOUT: 'blackout',
    BRIDGE_FAILURE: 'bridge_failure',
    MARKET_CRASH: 'market_crash'
};

// Difficulty presets (Tier 2D)
// Each preset is fully self-contained and drives all tunable systems.
export const DIFFICULTY = {
    EASY: {
        label: 'Easy',
        description: 'Forgiving economy, rare crises, slow rivals. Good for learning.',
        resourceMultiplier: 1.5,
        crisisChance:    0.004,
        enemyStrength:   0.5,
        startingGold:    200,
        startingFood:    150,
        startingWood:    150,
        incomeBonus:     0.25,   // +25% all building income
        decayMultiplier: 0.5,    // buildings decay at half speed
    },
    NORMAL: {
        label: 'Normal',
        description: 'Balanced challenge. The intended experience.',
        resourceMultiplier: 1.0,
        crisisChance:    0.01,
        enemyStrength:   1.0,
        startingGold:    100,
        startingFood:    100,
        startingWood:    100,
        incomeBonus:     0.0,
        decayMultiplier: 1.0,
    },
    HARD: {
        label: 'Hard',
        description: 'Tight budget, frequent crises, aggressive rivals.',
        resourceMultiplier: 0.7,
        crisisChance:    0.022,
        enemyStrength:   1.5,
        startingGold:    60,
        startingFood:    60,
        startingWood:    60,
        incomeBonus:    -0.10,   // -10% income
        decayMultiplier: 1.5,
    },
    BRUTAL: {
        label: 'Brutal',
        description: 'Near-impossible. Resources scarce, crises relentless, no mercy.',
        resourceMultiplier: 0.5,
        crisisChance:    0.04,
        enemyStrength:   2.5,
        startingGold:    30,
        startingFood:    30,
        startingWood:    30,
        incomeBonus:    -0.20,
        decayMultiplier: 2.0,
    },
    SANDBOX: {
        label: 'Sandbox',
        description: 'No win/lose conditions. Unlimited resources. Build freely.',
        resourceMultiplier: 2.0,
        crisisChance:    0.001,
        enemyStrength:   0.1,
        startingGold:    9999,
        startingFood:    9999,
        startingWood:    9999,
        incomeBonus:     0.5,
        decayMultiplier: 0.0,    // buildings never decay
        sandbox:         true,
    },
};

// Building upgrade levels
export const BUILDING_LEVELS = {
    1: { name: 'Basic', multiplier: 1.0, description: 'Standard efficiency' },
    2: { name: 'Improved', multiplier: 1.3, description: '+30% efficiency' },
    3: { name: 'Advanced', multiplier: 1.6, description: '+60% efficiency' },
    4: { name: 'Premium', multiplier: 2.0, description: '+100% efficiency' }
};

// Weather types
export const WEATHER_CLEAR = 'clear';
export const WEATHER_RAIN = 'rain';
export const WEATHER_STORM = 'storm';
export const WEATHER_FOG = 'fog';
export const WEATHER_SNOW = 'snow';

export const WEATHER_TYPES = {
    [WEATHER_CLEAR]: {
        name: 'Clear',
        icon: '☀️',
        description: 'Pleasant weather',
        visibility: 1.0,
        citizenSpeedModifier: 1.0,
        ambientColor: null,         // don't override sky — let season palette handle it
        fogDensity: 0.005
    },
    [WEATHER_RAIN]: {
        name: 'Rain',
        icon: '🌧️',
        description: 'Light rain',
        visibility: 0.7,
        citizenSpeedModifier: 0.9,
        ambientColor: 0x556677,
        fogDensity: 0.007
    },
    [WEATHER_STORM]: {
        name: 'Storm',
        icon: '⛈️',
        description: 'Heavy storm',
        visibility: 0.5,
        citizenSpeedModifier: 0.7,
        ambientColor: 0x334455,
        fogDensity: 0.012
    },
    [WEATHER_FOG]: {
        name: 'Fog',
        icon: '🌫️',
        description: 'Dense fog',
        visibility: 0.3,
        citizenSpeedModifier: 0.8,
        ambientColor: 0x778888,
        fogDensity: 0.018
    },
    [WEATHER_SNOW]: {
        name: 'Snow',
        icon: '❄️',
        description: 'Snowy conditions',
        visibility: 0.6,
        citizenSpeedModifier: 0.75,
        ambientColor: 0x8899aa,
        fogDensity: 0.008
    }
};

// Shadow configuration
export const SHADOW_CONFIG = {
    enabled: true,
    mapSize: 2048,
    cameraNear: 0.5,
    cameraFar: 50,
    bias: -0.0005,
    softShadows: true,
    shadowOpacity: 0.65
};

// Level of Detail thresholds
export const LOD_THRESHOLDS = {
    HIGH: 15,      // Full detail within 15 tiles
    MEDIUM: 40,    // Reduced detail within 40 tiles
    LOW: 80        // Minimal detail beyond 40 tiles
};

// Rival AI constants
export const RIVAL_CONFIG = {
    baseInfluence: 50,
    baseBudget: 500,
    baseHeat: 10,
    baseIntel: 30,
    actionInterval: 5, // Minimum ticks between actions
    heatDecay: 2, // Heat decreases per tick
    budgetRegen: 20, // Budget regenerates per tick
    maxHeat: 100,
    maxBudget: 2000,
    maxInfluence: 100
};

// Rival action types
export const RIVAL_ACTION_SABOTAGE_GRID = 'sabotage_grid';
export const RIVAL_ACTION_SPREAD_PROPAGANDA = 'spread_propaganda';
export const RIVAL_ACTION_POACH_WORKERS = 'poach_workers';
export const RIVAL_ACTION_TRIGGER_GANG_ACTIVITY = 'trigger_gang_activity';
export const RIVAL_ACTION_BRIBE_OFFICIALS = 'bribe_officials';
export const RIVAL_ACTION_ECONOMIC_SPYING = 'economic_spying';
export const RIVAL_ACTION_MEDIA_BLACKOUT = 'media_blackout';
export const RIVAL_ACTION_COOLDOWN = 'cooldown';

// Security/countermeasure buildings
export const BUILDING_POLICE_STATION = 'police-station';
export const BUILDING_CCTV_NETWORK = 'cctv-network';
export const BUILDING_COUNTERINTEL = 'counterintel';
export const BUILDING_PROPAGANDA_OFFICE = 'propaganda-office';

// Power network buildings
export const BUILDING_POWER_PLANT = 'power-plant';
export const BUILDING_SUBSTATION = 'substation';

export const BUILDING_SECURITY = {
    [BUILDING_POLICE_STATION]: {
        name: 'Police Station',
        icon: '👮',
        description: 'Reduces heat gain and rival success chance',
        cost: { gold: 100, wood: 80, food: 50 },
        income: { gold: -5, food: 0, wood: 0 },
        upkeep: 10,
        heatReduction: 5,
        rivalChanceReduction: 0.15
    },
    [BUILDING_CCTV_NETWORK]: {
        name: 'CCTV Network',
        icon: '📹',
        description: 'Surveillance reduces sabotage and espionage',
        cost: { gold: 80, wood: 60, food: 30 },
        income: { gold: -3, food: 0, wood: 0 },
        upkeep: 8,
        heatReduction: 2,
        rivalChanceReduction: 0.10
    },
    [BUILDING_COUNTERINTEL]: {
        name: 'Counter-Intel Office',
        icon: '🕵️',
        description: 'Detects and neutralizes rival espionage',
        cost: { gold: 150, wood: 100, food: 70 },
        income: { gold: -8, food: 0, wood: 0 },
        upkeep: 12,
        heatReduction: 8,
        rivalChanceReduction: 0.20
    },
    [BUILDING_PROPAGANDA_OFFICE]: {
        name: 'Propaganda Office',
        icon: '📢',
        description: 'Boosts citizen morale and counters rival propaganda',
        cost: { gold: 70, wood: 50, food: 40 },
        income: { gold: -2, food: 0, wood: 0 },
        upkeep: 6,
        happinessBoost: 5,
        rivalChanceReduction: 0.10
    }
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

// Sound Effect identifiers
export const SFX = {
    // Building interactions
    BUILD_PLACE: 'build_place',
    BUILD_DEMOLISH: 'build_demolish',
    BUILD_INVALID: 'build_invalid',
    
    // UI interactions
    UI_CLICK: 'ui_click',
    UI_HOVER: 'ui_hover',
    UI_SLIDER: 'ui_slider',
    UI_ERROR: 'ui_error',
    UI_SUCCESS: 'ui_success',
    
    // Crisis events
    CRISIS_ALERT: 'crisis_alert',
    CRISIS_WARNING: 'crisis_warning',
    CRISIS_RESOLVED: 'crisis_resolved',
    
    // Hack minigame
    HACK_SUCCESS: 'hack_success',
    HACK_FAIL: 'hack_fail',
    HACK_PROGRESS: 'hack_progress',
    
    // Resources
    RESOURCE_GAIN: 'resource_gain',
    RESOURCE_LOSS: 'resource_loss',
    RESOURCE_LOW: 'resource_low',

    // Breakables
    GLASS_IMPACT: 'glass_impact',
    GLASS_SHATTER: 'glass_shatter',
};

// SFX parameters for procedural generation
export const SFX_PARAMS = {
    [SFX.BUILD_PLACE]: {
        type: 'synth',
        frequency: 220,
        duration: 0.15,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.05 },
        oscillator: 'sine'
    },
    [SFX.BUILD_DEMOLISH]: {
        type: 'noise',
        duration: 0.2,
        volume: 0.8
    },
    [SFX.UI_CLICK]: {
        type: 'synth',
        frequency: 880,
        duration: 0.05,
        envelope: { attack: 0.005, decay: 0.04, sustain: 0.2, release: 0.01 },
        oscillator: 'triangle'
    },
    [SFX.UI_HOVER]: {
        type: 'synth',
        frequency: 1200,
        duration: 0.03,
        envelope: { attack: 0.002, decay: 0.02, sustain: 0.1, release: 0.01 },
        oscillator: 'sine'
    },
    [SFX.CRISIS_ALERT]: {
        type: 'synth',
        frequency: 150,
        duration: 1.0,
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.5 },
        oscillator: 'sawtooth',
        modulate: true
    },
    [SFX.HACK_SUCCESS]: {
        type: 'synth',
        frequency: 1046,
        duration: 0.3,
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.1 },
        oscillator: 'sine',
        arpeggio: [1046, 1244, 1468, 1760]
    },
    [SFX.HACK_FAIL]: {
        type: 'synth',
        frequency: 150,
        duration: 0.4,
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.15 },
        oscillator: 'sawtooth'
    },
    [SFX.BUILD_INVALID]: {
        type: 'synth',
        frequency: 120,
        duration: 0.2,
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.08 },
        oscillator: 'sawtooth',
        frequencyEnd: 80
    },
    [SFX.UI_SLIDER]: {
        type: 'synth',
        frequency: 600,
        duration: 0.08,
        envelope: { attack: 0.005, decay: 0.06, sustain: 0.15, release: 0.02 },
        oscillator: 'triangle'
    },
    [SFX.UI_ERROR]: {
        type: 'synth',
        frequency: 180,
        duration: 0.25,
        envelope: { attack: 0.03, decay: 0.12, sustain: 0.25, release: 0.1 },
        oscillator: 'sawtooth',
        frequencyEnd: 120
    },
    [SFX.UI_SUCCESS]: {
        type: 'arpeggio',
        duration: 0.35,
        volume: 0.12,
        oscillator: 'sine',
        arpeggio: [523, 659, 784, 1046],
        envelope: { attack: 0.02, decay: 0.08, sustain: 0.3, release: 0.05 }
    },
    [SFX.CRISIS_WARNING]: {
        type: 'synth',
        frequency: 200,
        duration: 0.8,
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.35 },
        oscillator: 'square',
        modulate: true,
        modulateRate: 4,
        modulateDepth: 30
    },
    [SFX.CRISIS_RESOLVED]: {
        type: 'arpeggio',
        duration: 0.5,
        volume: 0.15,
        oscillator: 'sine',
        arpeggio: [392, 493, 587, 659, 784],
        envelope: { attack: 0.03, decay: 0.1, sustain: 0.4, release: 0.1 }
    },
    [SFX.HACK_PROGRESS]: {
        type: 'synth',
        frequency: 800,
        duration: 0.08,
        envelope: { attack: 0.005, decay: 0.06, sustain: 0.2, release: 0.02 },
        oscillator: 'sine'
    },
    [SFX.RESOURCE_GAIN]: {
        type: 'synth',
        frequency: 660,
        duration: 0.15,
        envelope: { attack: 0.01, decay: 0.08, sustain: 0.3, release: 0.06 },
        oscillator: 'sine',
        frequencyEnd: 880
    },
    [SFX.RESOURCE_LOSS]: {
        type: 'synth',
        frequency: 300,
        duration: 0.2,
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.25, release: 0.08 },
        oscillator: 'triangle',
        frequencyEnd: 200
    },
    [SFX.RESOURCE_LOW]: {
        type: 'synth',
        frequency: 180,
        duration: 0.4,
        envelope: { attack: 0.05, decay: 0.15, sustain: 0.4, release: 0.2 },
        oscillator: 'sawtooth',
        modulate: true,
        modulateRate: 3,
        modulateDepth: 20
    },
    [SFX.GLASS_IMPACT]: {
        type: 'noise',
        duration: 0.12,
        volume: 0.7,
        filter: { type: 'highpass', frequency: 3000, Q: 1.5 }
    },
    [SFX.GLASS_SHATTER]: {
        type: 'noise',
        duration: 0.45,
        volume: 0.85,
        filter: { type: 'highpass', frequency: 4000, Q: 2 }
    },
};
// Combat difficulty by heat level — smoothed curve
// Level 0 = calm, 1 = alert, 2 = search, 3 = pursuit, 4 = critical, 5 = lockdown
// No spike at level 3, no flat at level 5+
export const COMBAT_DIFFICULTY_LEVELS = [
    // Level 0: Calm — no active police response
    {
        label: 'calm',
        heatMin: 0,
        heatMax: 19,
        spawnCount: 0,
        unitTypes: [],
        aggression: 0,       // NPCs ignore player
        patrolInterval: 0,   // no extra patrols
        specialActions: [],
    },
    // Level 1: Alert — single patrol notices something
    {
        label: 'alert',
        heatMin: 20,
        heatMax: 39,
        spawnCount: 1,
        unitTypes: ['PATROL_CAR'],
        aggression: 0.2,     // cautious, observes first
        patrolInterval: 45,  // slow response
        specialActions: [],
    },
    // Level 2: Search — active investigation, moderate pressure
    {
        label: 'search',
        heatMin: 40,
        heatMax: 59,
        spawnCount: 2,
        unitTypes: ['PATROL_CAR', 'PATROL_CAR'],
        aggression: 0.4,     // will pursue if player is spotted
        patrolInterval: 30,
        specialActions: [],
    },
    // Level 3: Pursuit — full response, but controlled escalation
    {
        label: 'pursuit',
        heatMin: 60,
        heatMax: 79,
        spawnCount: 3,
        unitTypes: ['PATROL_CAR', 'PATROL_CAR', 'INTERCEPTOR'],
        aggression: 0.6,     // active engagement, will use force
        patrolInterval: 20,
        specialActions: ['roadblock'],
    },
    // Level 4: Critical — heavy response, aerial support
    {
        label: 'critical',
        heatMin: 80,
        heatMax: 89,
        spawnCount: 4,
        unitTypes: ['PATROL_CAR', 'PATROL_CAR', 'INTERCEPTOR', 'DRONE'],
        aggression: 0.8,     // aggressive pursuit, drone tracking
        patrolInterval: 15,
        specialActions: ['roadblock', 'helicopter'],
    },
    // Level 5: Lockdown — maximum response, city-wide
    {
        label: 'lockdown',
        heatMin: 90,
        heatMax: 100,
        spawnCount: 5,
        unitTypes: ['PATROL_CAR', 'PATROL_CAR', 'INTERCEPTOR', 'INTERCEPTOR', 'DRONE'],
        aggression: 1.0,     // full engagement, spike strips, helicopter
        patrolInterval: 10,
        specialActions: ['roadblock', 'helicopter', 'spike_strips'],
    },
];

// Stealth detection modifiers by environment
export const STEALTH_DETECTION_MODIFIERS = {
    // Time of day multipliers (applied to base detection radius)
    timeOfDay: {
        night: 0.4,     // 22:00-05:00 — dark, hard to see
        dusk: 0.6,      // 18:00-21:00 — twilight
        dawn: 0.6,      // 05:00-08:00 — twilight
        day: 1.0,       // 08:00-18:00 — full visibility
    },
    // Crowd density multipliers (more NPCs = harder to hide but easier to blend)
    crowdDensity: {
        empty: 1.2,     // no cover, easy to spot
        sparse: 1.0,    // few NPCs, normal detection
        moderate: 0.8,  // some cover, slightly harder to spot player
        dense: 0.6,     // lots of cover, harder to distinguish player
        crowded: 0.4,   // very hard to spot player in crowd
    },
    // Weather multipliers
    weather: {
        clear: 1.0,
        cloudy: 0.9,
        rain: 0.7,      // rain reduces visibility
        storm: 0.5,     // heavy rain, very low visibility
    },
};
