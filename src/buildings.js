// Building management system
import { BUILDING_TYPES, BUILDING_HOUSE, BUILDING_FARM, BUILDING_LUMBER_MILL, BUILDING_MARKET, BUILDING_TOWN_HALL, UPGRADE_COSTS, BUILDING_LEVELS } from './constants.js';

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

    build(type, x, y, level = 1) {
        const buildingData = BUILDING_TYPES[type];
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
            population: Math.floor((buildingData.population || 0) * multiplier),
            income: {
                gold: Math.floor((buildingData.income.gold || 0) * multiplier),
                food: Math.floor((buildingData.income.food || 0) * multiplier),
                wood: Math.floor((buildingData.income.wood || 0) * multiplier)
            },
            upkeep: Math.floor((buildingData.upkeep || 0) * multiplier),
            constructedAt: Date.now()
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
        building.population = Math.floor((BUILDING_TYPES[building.type].population || 0) * multiplier);
        building.income = {
            gold: Math.floor((BUILDING_TYPES[building.type].income.gold || 0) * multiplier),
            food: Math.floor((BUILDING_TYPES[building.type].income.food || 0) * multiplier),
            wood: Math.floor((BUILDING_TYPES[building.type].income.wood || 0) * multiplier)
        };
        building.upkeep = Math.floor((BUILDING_TYPES[building.type].upkeep || 0) * multiplier);

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
        }
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