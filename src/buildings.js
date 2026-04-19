// Building management system
import {
    BUILDING_TYPES,
    BUILDING_SECURITY,
    BUILDING_HOUSE,
    BUILDING_FARM,
    BUILDING_LUMBER_MILL,
    BUILDING_MARKET,
    BUILDING_TOWN_HALL,
    UPGRADE_COSTS,
    BUILDING_LEVELS
} from './constants.js';
import { BUILDING_EXTENDED } from './buildings_extended.js';

// ---------------------------------------------------------------------------
// Tier 2C: Adjacency bonus rules
// Each rule boosts/penalises `source` buildings that have at least one
// `neighbor` type within `radius` tiles (Euclidean distance).
// `multiply` keys map resource fields to output multipliers (e.g. 1.3 = +30%).
// ---------------------------------------------------------------------------
const ADJACENCY_RULES = [
    // --- Supply chains ---
    { source: 'farm',         neighbor: 'market',        radius: 5,  multiply: { food: 1.3  },
      label: 'Market Supply Route'  },
    { source: 'farm',         neighbor: 'warehouse',     radius: 4,  multiply: { food: 1.2  },
      label: 'Farm Storage'          },
    { source: 'lumber-mill',  neighbor: 'warehouse',     radius: 4,  multiply: { wood: 1.2  },
      label: 'Lumber Storage'        },

    // --- Trade hubs (market boosted by transport infrastructure) ---
    { source: 'market',       neighbor: 'port',          radius: 8,  multiply: { gold: 1.3  },
      label: 'Port Trade'            },
    { source: 'market',       neighbor: 'airport',       radius: 10, multiply: { gold: 1.25 },
      label: 'Airport Commerce'      },

    // --- Commercial clustering ---
    { source: 'market',       neighbor: 'market',        radius: 3,  multiply: { gold: 1.1  },
      label: 'Commercial District'   },
    { source: 'market',       neighbor: 'shopping-mall', radius: 5,  multiply: { gold: 1.15 },
      label: 'Retail Hub'            },
    { source: 'market',       neighbor: 'stadium',       radius: 6,  multiply: { gold: 1.15 },
      label: 'Stadium Footfall'      },

    // --- Quality-of-life bonuses for housing ---
    { source: 'house',        neighbor: 'park',          radius: 4,  multiply: { gold: 1.15 },
      label: 'Green Space'           },
    { source: 'house',        neighbor: 'hospital',      radius: 6,  multiply: { gold: 1.1  },
      label: 'Healthcare Access'     },

    // --- Knowledge clusters ---
    { source: 'university',   neighbor: 'research-lab',  radius: 6,  multiply: { gold: 1.25 },
      label: 'Research Cluster'      },
    { source: 'research-lab', neighbor: 'university',    radius: 6,  multiply: { gold: 1.25 },
      label: 'Research Cluster'      },
    { source: 'library',      neighbor: 'university',    radius: 5,  multiply: { gold: 1.2  },
      label: 'Education Hub'         },

    // --- Pollution / negative adjacency ---
    { source: 'house',        neighbor: 'lumber-mill',   radius: 3,  multiply: { gold: 0.9  },
      label: 'Mill Pollution'        },
    { source: 'house',        neighbor: 'barracks',      radius: 3,  multiply: { gold: 0.85 },
      label: 'Military Noise'        },
];

// Condition points lost per tick when city is running a gold deficit.
// Restoration rate when budget is healthy: DECAY_RATES.default * 1.5/tick.
const DECAY_RATES = {
    default:        0.2,
    hospital:       0.3,
    'nuclear-plant':0.5,
    'fire-station': 0.25,
};

// Condition thresholds → income multipliers (applied to full adjusted income)
const CONDITION_MULTIPLIERS = [
    { threshold: 70, multiplier: 1.0  },
    { threshold: 50, multiplier: 0.9  },
    { threshold: 30, multiplier: 0.75 },
    { threshold:  0, multiplier: 0.5  },
];

// ---------------------------------------------------------------------------
// Tier 2C: District specialization income multipliers (2C)
// Maps district theme → { buildingType → { resource: multiplier } }
// ---------------------------------------------------------------------------
const DISTRICT_THEME_BONUSES = {
    commercial: {
        market:       { gold: 1.25 },
        'shopping-mall': { gold: 1.20 },
        office:       { gold: 1.20 },
    },
    residential: {
        house:        { gold: 1.15 },
        apartment:    { gold: 1.15 },
        park:         { gold: 1.10 },
    },
    industrial: {
        factory:      { gold: 1.20, wood: 1.15 },
        'lumber-mill':{ wood: 1.25 },
        warehouse:    { gold: 1.10 },
    },
    waterfront: {
        port:         { gold: 1.30 },
        market:       { gold: 1.15 },
        'water-treatment': { gold: 1.10 },
    },
    elite: {
        house:        { gold: 1.30 },
        apartment:    { gold: 1.25 },
        market:       { gold: 1.15 },
    },
};

export class BuildingManager {
    constructor(game) {
        this.game = game;
        this.buildings = [];
        this.nextId = 1;
        this.totalHousing = 0;
        this.totalFoodProduction = 0;
        this.totalWoodProduction = 0;
        this.totalGoldIncome = 0;
    }

    build(type, x, y, level = 1, rotation = 0) {
        const buildingData = BUILDING_TYPES[type] || BUILDING_SECURITY[type] || BUILDING_EXTENDED[type];
        if (!buildingData) return null;

        const levelData = BUILDING_LEVELS[level] || BUILDING_LEVELS[1];
        const multiplier = levelData.multiplier;

        const building = {
            id: this.nextId++,
            type: type,
            x: x,
            y: y,
            name: buildingData.name,
            icon: buildingData.icon,
            level: level,
            levelName: levelData.name,
            rotation: ((rotation % 4) + 4) % 4,
            population: Math.floor((buildingData.population || 0) * multiplier),
            income: {
                gold: Math.floor((buildingData.income.gold || 0) * multiplier),
                food: Math.floor((buildingData.income.food || 0) * multiplier),
                wood: Math.floor((buildingData.income.wood || 0) * multiplier)
            },
            upkeep: Math.floor((buildingData.upkeep || 0) * multiplier),
            constructedAt: Date.now(),
            condition: 100,          // 0-100; drives decay income penalty
            _adjacencyBonus: null,   // cached; recomputed in updateTotals()
        };

        this.buildings.push(building);
        this.updateTotals();

        return building;
    }

    upgradeBuilding(building) {
        if (building.level >= 4) {
            return { success: false, message: 'Building is already at maximum level' };
        }

        const nextLevel = building.level + 1;
        const cost = UPGRADE_COSTS[nextLevel];
        if (!cost) {
            return { success: false, message: 'Invalid upgrade level' };
        }

        // Check if player can afford upgrade
        const resources = this.game.resources;
        if (!resources.canAfford(cost)) {
            return { success: false, message: `Cannot afford upgrade! Need ${cost.gold} gold, ${cost.wood} wood, ${cost.food} food` };
        }

        // Pay upgrade cost
        resources.pay(cost);

        // Apply upgrade
        const levelData = BUILDING_LEVELS[nextLevel];
        const multiplier = levelData.multiplier;

        building.level = nextLevel;
        building.levelName = levelData.name;
        const base = BUILDING_TYPES[building.type] || BUILDING_SECURITY[building.type] || BUILDING_EXTENDED[building.type];
        building.population = Math.floor((base.population || 0) * multiplier);
        building.income = {
            gold: Math.floor((base.income.gold || 0) * multiplier),
            food: Math.floor((base.income.food || 0) * multiplier),
            wood: Math.floor((base.income.wood || 0) * multiplier)
        };
        building.upkeep = Math.floor((base.upkeep || 0) * multiplier);

        this.updateTotals();
        return { success: true, message: `${building.name} upgraded to Level ${nextLevel}!` };
    }

    destroy(building) {
        this.buildings = this.buildings.filter(b => b !== building);
        this.updateTotals();
    }

    updateTotals() {
        this.totalHousing = 0;
        this.totalFoodProduction = 0;
        this.totalWoodProduction = 0;
        this.totalGoldIncome = 0;

        for (const building of this.buildings) {
            this.totalHousing += (building.population || 0);
            this.totalFoodProduction += (building.income.food || 0);
            this.totalWoodProduction += (building.income.wood || 0);
            this.totalGoldIncome += (building.income.gold || 0);
            // Recompute cached adjacency bonuses whenever structure changes
            building._adjacencyBonus = this._computeAdjacencyBonuses(building);
        }
    }

    // -----------------------------------------------------------------------
    // Tier 2C: Adjacency helpers
    // -----------------------------------------------------------------------

    /** All buildings within Euclidean `radius` of (cx, cy), excluding self. */
    getBuildingsInRadius(cx, cy, radius) {
        const r2 = radius * radius;
        return this.buildings.filter(b => {
            const dx = b.x - cx, dy = b.y - cy;
            return (dx * dx + dy * dy) <= r2;
        });
    }

    /** Compute additive income bonuses from adjacency rules for one building. */
    _computeAdjacencyBonuses(building) {
        const bonus = { gold: 0, food: 0, wood: 0 };
        for (const rule of ADJACENCY_RULES) {
            if (rule.source !== building.type) continue;
            const inRange = this.getBuildingsInRadius(building.x, building.y, rule.radius);
            const hasNeighbor = inRange.some(
                b => b !== building && (
                    Array.isArray(rule.neighbor)
                        ? rule.neighbor.includes(b.type)
                        : b.type === rule.neighbor
                )
            );
            if (!hasNeighbor) continue;
            for (const [field, mult] of Object.entries(rule.multiply || {})) {
                const delta = Math.floor((building.income[field] || 0) * (mult - 1));
                bonus[field] += delta;
            }
        }
        return bonus;
    }

    /** Per-building condition → income multiplier (Tier 2C: decay). */
    static _conditionMultiplier(condition) {
        for (const { threshold, multiplier } of CONDITION_MULTIPLIERS) {
            if (condition >= threshold) return multiplier;
        }
        return 0.5;
    }

    /**
     * Dynamic income: static income + adjacency bonuses, scaled by decay condition.
     * Called every tick in place of getIncome().
     */
    getDynamicIncome() {
        const total = { gold: 0, food: 0, wood: 0 };
        const map = this.game?.map;
        for (const building of this.buildings) {
            const adj = building._adjacencyBonus || { gold: 0, food: 0, wood: 0 };
            const condMult = BuildingManager._conditionMultiplier(building.condition ?? 100);

            // Tier 2C: District specialization bonus
            let districtMult = { gold: 1, food: 1, wood: 1 };
            if (map?.districtMap && map?.districts) {
                const distId = map.districtMap[building.y * map.width + building.x];
                const dist = map.districts.find(d => d.id === distId);
                const theme = dist?.theme;
                if (theme) {
                    const bonuses = DISTRICT_THEME_BONUSES[theme]?.[building.type];
                    if (bonuses) {
                        if (bonuses.gold) districtMult.gold = bonuses.gold;
                        if (bonuses.food) districtMult.food = bonuses.food;
                        if (bonuses.wood) districtMult.wood = bonuses.wood;
                    }
                }
            }

            total.gold += Math.floor((building.income.gold + adj.gold) * condMult * districtMult.gold);
            total.food += Math.floor((building.income.food + adj.food) * condMult * districtMult.food);
            total.wood += Math.floor((building.income.wood + adj.wood) * condMult * districtMult.wood);
        }
        return total;
    }

    /**
     * Update building conditions each tick.
     * @param {boolean} inDebt - true when city gold balance is negative
     * @param {number} [difficultyMult=1] - from difficulty preset's decayMultiplier
     */
    updateDecay(inDebt, difficultyMult = 1) {
        if (difficultyMult === 0) return; // sandbox: no decay ever
        for (const building of this.buildings) {
            if (building.condition === undefined) building.condition = 100;
            if (inDebt) {
                const rate = (DECAY_RATES[building.type] ?? DECAY_RATES.default) * difficultyMult;
                building.condition = Math.max(0, building.condition - rate);
            } else if (building.condition < 100) {
                building.condition = Math.min(100, building.condition + DECAY_RATES.default * 0.5);
            }
        }
    }

    /**
     * Returns a summary of building conditions for the UI.
     * @returns {{ degraded: number, critical: number, healthy: number }}
     */
    getConditionSummary() {
        let healthy = 0, degraded = 0, critical = 0;
        for (const b of this.buildings) {
            const c = b.condition ?? 100;
            if (c >= 70) healthy++;
            else if (c >= 30) degraded++;
            else critical++;
        }
        return { healthy, degraded, critical };
    }

    /**
     * Returns all active adjacency bonus labels for a building (for tooltip).
     * @param {Object} building
     * @returns {string[]}
     */
    getAdjacencyLabels(building) {
        const labels = [];
        for (const rule of ADJACENCY_RULES) {
            if (rule.source !== building.type) continue;
            const inRange = this.getBuildingsInRadius(building.x, building.y, rule.radius);
            const hasNeighbor = inRange.some(
                b => b !== building && (
                    Array.isArray(rule.neighbor)
                        ? rule.neighbor.includes(b.type)
                        : b.type === rule.neighbor
                )
            );
            if (hasNeighbor) labels.push(rule.label);
        }
        return labels;
    }

    getBuildingsAt(x, y) {
        return this.buildings.filter(b => b.x === x && b.y === y);
    }

    getBuildingCount(type) {
        return this.buildings.filter(b => b.type === type).length;
    }

    getTotalUpkeep() {
        let total = 0;
        for (const building of this.buildings) {
            total += (building.upkeep || 0);
        }
        return total;
    }

    getIncome() {
        return {
            gold: this.totalGoldIncome,
            food: this.totalFoodProduction,
            wood: this.totalWoodProduction
        };
    }

    // Check if building placement is valid
    isValidPlacement(x, y, map) {
        // Must be valid terrain
        if (!map.isValidPlacement(x, y)) return false;

        // No other buildings at this location
        const existing = this.getBuildingsAt(x, y);
        if (existing.length > 0) return false;

        // Must be near an existing building (except first one)
        if (this.buildings.length > 0 && !this.isNearOtherBuilding(x, y)) {
            return false;
        }

        return true;
    }

    isNearOtherBuilding(x, y) {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                if (dx === 0 && dy === 0) continue;
                const neighbors = this.getBuildingsAt(x + dx, y + dy);
                if (neighbors.length > 0) return true;
            }
        }
        return false;
    }

    // Calculate victory progress
    getVictoryProgress() {
        return {
            military: this.getBuildingCount(BUILDING_TOWN_HALL) * 25,
            economic: Math.min(100, this.totalGoldIncome * 5),
            cultural: Math.min(100, this.buildings.length * 10),
            technological: Math.min(100, this.getBuildingCount(BUILDING_MARKET) * 25)
        };
    }
}
