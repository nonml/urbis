// Economy Balancer System
// Provides tools for analyzing and balancing the game economy
// Helps identify imbalances and suggests adjustments

import { ECONOMY_CURVE, ECONOMY_GOALS } from '../constants.js';
import { BUILDING_TYPES, BUILDING_SECURITY, DIFFICULTY } from '../constants.js';
import { BUILDING_EXTENDED } from '../buildings_extended.js';

/**
 * Resource balance metrics
 */
export class ResourceMetrics {
    constructor() {
        this.gold = { income: 0, expenditure: 0, net: 0, trend: [] };
        this.food = { income: 0, expenditure: 0, net: 0, trend: [] };
        this.wood = { income: 0, expenditure: 0, net: 0, trend: [] };
        this.population = { current: 0, housing: 0, demand: 0 };
        this.history = [];
    }

    /**
     * Record a tick's metrics
     */
    recordTick(metrics) {
        // Update current values
        this.gold.income = metrics.goldIncome || 0;
        this.gold.expenditure = metrics.goldExpenditure || 0;
        this.gold.net = this.gold.income - this.gold.expenditure;

        this.food.income = metrics.foodIncome || 0;
        this.food.expenditure = metrics.foodExpenditure || 0;
        this.food.net = this.food.income - this.food.expenditure;

        this.wood.income = metrics.woodIncome || 0;
        this.wood.expenditure = metrics.woodExpenditure || 0;
        this.wood.net = this.wood.income - this.wood.expenditure;

        this.population.current = metrics.population || 0;
        this.population.housing = metrics.housing || 0;
        this.population.demand = metrics.housingDemand || 0;

        // Add to trend (keep last 100 ticks)
        this.trend.push({
            gold: this.gold.net,
            food: this.food.net,
            wood: this.wood.net,
            population: this.population.current
        });
        if (this.trend.length > 100) {
            this.trend.shift();
        }

        // Add to history (keep last 1000 ticks)
        this.history.push({
            ...this.gold,
            food: { ...this.food },
            wood: { ...this.wood },
            population: { ...this.population }
        });
        if (this.history.length > 1000) {
            this.history.shift();
        }
    }

    /**
     * Get trend analysis for a resource
     */
    analyzeTrend(resource) {
        const data = this[resource]?.trend || [];
        if (data.length < 5) return { stable: true, direction: 'unknown', volatility: 0 };

        const recent = data.slice(-20);
        const positives = recent.filter(v => v[resource] > 0).length;
        const negatives = recent.filter(v => v[resource] < 0).length;
        const volatility = this.calculateVolatility(recent.map(v => v[resource]));

        let direction = 'stable';
        if (positives > negatives * 1.5) direction = 'increasing';
        else if (negatives > positives * 1.5) direction = 'decreasing';

        return {
            stable: Math.abs(positives - negatives) < 5,
            direction,
            volatility,
            average: recent.reduce((sum, v) => sum + v[resource], 0) / recent.length
        };
    }

    /**
     * Calculate volatility (standard deviation)
     */
    calculateVolatility(values) {
        if (values.length < 2) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Get overall balance status
     */
    getStatus() {
        const goldTrend = this.analyzeTrend('gold');
        const foodTrend = this.analyzeTrend('food');
        const woodTrend = this.analyzeTrend('wood');

        const issues = [];

        if (goldTrend.direction === 'decreasing' || this.gold.net < 0) {
            issues.push({
                type: 'gold_deficit',
                severity: this.gold.net < -20 ? 'critical' : 'warning',
                message: `Gold deficit: ${this.gold.net} per tick`,
                suggestion: 'Add more income-generating buildings or reduce upkeep costs'
            });
        }

        if (foodTrend.direction === 'decreasing' || this.food.net < 0) {
            issues.push({
                type: 'food_shortage',
                severity: this.food.net < -10 ? 'critical' : 'warning',
                message: `Food shortage: ${this.food.net} per tick`,
                suggestion: 'Build more farms or food-producing buildings'
            });
        }

        if (this.population.current > this.population.housing) {
            issues.push({
                type: 'overcrowding',
                severity: 'warning',
                message: `Overcrowding: ${this.population.current}/${this.population.housing} housing`,
                suggestion: 'Build more residential buildings'
            });
        }

        return {
            healthy: issues.length === 0,
            issues,
            summary: this.generateSummary()
        };
    }

    /**
     * Generate human-readable summary
     */
    generateSummary() {
        const parts = [];
        parts.push(`Gold: ${this.gold.net >= 0 ? '+' : ''}${this.gold.net}/tick`);
        parts.push(`Food: ${this.food.net >= 0 ? '+' : ''}${this.food.net}/tick`);
        parts.push(`Wood: ${this.wood.net >= 0 ? '+' : ''}${this.wood.net}/tick`);
        parts.push(`Population: ${this.population.current}/${this.population.housing} housing`);
        return parts.join(' | ');
    }
}

/**
 * Building economy analyzer
 */
export class BuildingAnalyzer {
    constructor() {
        this.buildingCache = new Map();
        this.buildAllBuildingTypes();
    }

    /**
     * Build cache of all building types with their economy impact
     */
    buildAllBuildingTypes() {
        // Add base buildings
        for (const [key, building] of Object.entries(BUILDING_TYPES)) {
            this.buildingCache.set(key, this.analyzeBuilding(key, building));
        }

        // Add security buildings
        for (const [key, building] of Object.entries(BUILDING_SECURITY)) {
            this.buildingCache.set(key, this.analyzeBuilding(key, building));
        }

        // Add extended buildings
        for (const [key, building] of Object.entries(BUILDING_EXTENDED)) {
            this.buildingCache.set(key, this.analyzeBuilding(key, building));
        }
    }

    /**
     * Analyze a single building's economic impact
     */
    analyzeBuilding(key, building) {
        const cost = building.cost || {};
        const income = building.income || {};
        const upkeep = building.upkeep || 0;

        // Calculate ROI (return on investment)
        const totalCost = (cost.gold || 0) + (cost.wood || 0) * 0.5 + (cost.food || 0) * 0.3;
        const netIncome = (income.gold || 0) + (income.wood || 0) * 0.5 + (income.food || 0) * 0.3 - upkeep;
        const roi = totalCost > 0 ? (netIncome / totalCost) * 100 : 0;

        // Calculate payback period (ticks to recoup investment)
        const paybackPeriod = netIncome > 0 ? Math.ceil(totalCost / netIncome) : Infinity;

        return {
            key,
            name: building.name,
            cost: { ...cost },
            income: { ...income },
            upkeep,
            totalCost,
            netIncome,
            roi: Math.round(roi * 100) / 100,
            paybackPeriod: paybackPeriod === Infinity ? 'N/A' : paybackPeriod,
            population: building.population || 0,
            tags: this.getBuildingTags(building)
        };
    }

    /**
     * Get tags for a building based on its properties
     */
    getBuildingTags(building) {
        const tags = [];
        const income = building.income || {};

        if (income.gold > 0) tags.push('income');
        if (income.food > 0) tags.push('food-production');
        if (income.wood > 0) tags.push('wood-production');
        if (building.population > 0) tags.push('housing');
        if (building.upkeep > 10) tags.push('high-maintenance');
        if (building.effects) {
            if (building.effects.happinessBonus) tags.push('happiness');
            if (building.effects.crimeReduction) tags.push('security');
            if (building.effects.researchBonus) tags.push('technology');
        }

        return tags;
    }

    /**
     * Get buildings sorted by ROI
     */
    getBuildingsByROI() {
        return Array.from(this.buildingCache.values())
            .sort((a, b) => b.roi - a.roi);
    }

    /**
     * Get buildings sorted by payback period
     */
    getBuildingsByPayback() {
        return Array.from(this.buildingCache.values())
            .sort((a, b) => {
                if (a.paybackPeriod === 'N/A') return 1;
                if (b.paybackPeriod === 'N/A') return -1;
                return a.paybackPeriod - b.paybackPeriod;
            });
    }

    /**
     * Get buildings by tag
     */
    getBuildingsByTag(tag) {
        return Array.from(this.buildingCache.values())
            .filter(b => b.tags.includes(tag));
    }

    /**
     * Get recommendation for current economy state
     */
    getRecommendation(currentResources, buildingCounts) {
        const recommendations = [];

        // Check for resource deficits
        if (currentResources.gold < 100) {
            const quickIncome = this.getBuildingsByTag('income')
                .filter(b => b.totalCost < 100)
                .sort((a, b) => a.totalCost - b.totalCost);
            if (quickIncome.length > 0) {
                recommendations.push({
                    type: 'quick_income',
                    priority: 'high',
                    building: quickIncome[0],
                    reason: 'Low gold reserves - build income generating building'
                });
            }
        }

        // Check for food shortage
        if (currentResources.food < 50) {
            const foodBuildings = this.getBuildingsByTag('food-production')
                .sort((a, b) => a.paybackPeriod - b.paybackPeriod);
            if (foodBuildings.length > 0) {
                recommendations.push({
                    type: 'food_security',
                    priority: 'high',
                    building: foodBuildings[0],
                    reason: 'Low food reserves - build food production'
                });
            }
        }

        // Check for population demand
        const population = currentResources.population || 0;
        const housing = currentResources.housing || 0;
        if (population >= housing * 0.9) {
            const housingBuildings = this.getBuildingsByTag('housing')
                .sort((a, b) => a.totalCost - b.totalCost);
            if (housingBuildings.length > 0) {
                recommendations.push({
                    type: 'housing_shortage',
                    priority: 'medium',
                    building: housingBuildings[0],
                    reason: 'Near housing capacity - expand housing'
                });
            }
        }

        return recommendations;
    }
}

/**
 * Difficulty adjuster
 * Adjusts economy based on difficulty setting
 */
export class DifficultyAdjuster {
    constructor(difficulty = 'NORMAL') {
        this.difficulty = difficulty;
        this.config = DIFFICULTY[difficulty] || DIFFICULTY.NORMAL;
    }

    /**
     * Apply difficulty multiplier to resource amounts
     */
    applyDifficulty(amount) {
        return Math.floor(amount * this.config.resourceMultiplier);
    }

    /**
     * Get crisis chance for current difficulty
     */
    getCrisisChance() {
        return this.config.crisisChance;
    }

    /**
     * Get enemy/rival strength multiplier
     */
    getEnemyStrength() {
        return this.config.enemyStrength;
    }

    /**
     * Adjust building cost based on difficulty
     */
    adjustBuildingCost(cost) {
        const adjusted = { ...cost };
        if (cost.gold) adjusted.gold = Math.floor(cost.gold * this.config.resourceMultiplier);
        if (cost.wood) adjusted.wood = Math.floor(cost.wood * this.config.resourceMultiplier);
        if (cost.food) adjusted.food = Math.floor(cost.food * this.config.resourceMultiplier);
        return adjusted;
    }

    /**
     * Adjust building income based on difficulty
     */
    adjustBuildingIncome(income) {
        const adjusted = { ...income };
        if (income.gold) adjusted.gold = Math.floor(income.gold * this.config.resourceMultiplier);
        if (income.food) adjusted.food = Math.floor(income.food * this.config.resourceMultiplier);
        if (income.wood) adjusted.wood = Math.floor(income.wood * this.config.resourceMultiplier);
        return adjusted;
    }
}

/**
 * Main Economy Balancer class
 */
export class EconomyBalancer {
    constructor(game) {
        this.game = game;
        this.metrics = new ResourceMetrics();
        this.analyzer = new BuildingAnalyzer();
        this.adjuster = new DifficultyAdjuster();
        
        // Balance goals
        this.goals = {
            targetGoldReserve: 500,
            targetFoodReserve: 200,
            targetWoodReserve: 300,
            maxDebtTicks: 30,
            targetGrowthRate: 0.1
        };

        // Balance history
        this.balanceHistory = [];
    }

    /**
     * Record current economy state
     */
    recordState() {
        const state = this.game.state;
        const resources = state.resources || {};
        const buildings = state.buildings?.list || [];

        // Calculate income/expenditure from buildings
        let goldIncome = 0, goldExpenditure = 0;
        let foodIncome = 0, foodExpenditure = 0;
        let woodIncome = 0, woodExpenditure = 0;

        for (const building of buildings) {
            const buildingData = this.analyzer.buildingCache.get(building.type);
            if (buildingData) {
                goldIncome += buildingData.income.gold || 0;
                foodIncome += buildingData.income.food || 0;
                woodIncome += buildingData.income.wood || 0;
                
                goldExpenditure += buildingData.upkeep || 0;
                foodExpenditure += buildingData.income.food < 0 ? Math.abs(buildingData.income.food) : 0;
            }
        }

        // Record metrics
        this.metrics.recordTick({
            goldIncome,
            goldExpenditure,
            foodIncome,
            foodExpenditure,
            woodIncome,
            woodExpenditure,
            population: resources.population || 0,
            housing: resources.housing || 0,
            housingDemand: this.calculateHousingDemand()
        });
    }

    /**
     * Calculate housing demand based on population
     */
    calculateHousingDemand() {
        const state = this.game.state;
        const population = state.resources?.population || 0;
        const housing = state.resources?.housing || 0;
        return Math.max(0, population - housing) + Math.floor(population * 0.2); // 20% buffer
    }

    /**
     * Get balance report
     */
    getBalanceReport() {
        this.recordState();
        const status = this.metrics.getStatus();
        const recommendations = this.analyzer.getRecommendation(
            this.game.state.resources,
            this.countBuildings()
        );

        return {
            status,
            recommendations,
            metrics: {
                gold: { ...this.metrics.gold },
                food: { ...this.metrics.food },
                wood: { ...this.metrics.wood }
            },
            goals: this.evaluateGoals()
        };
    }

    /**
     * Count buildings by type
     */
    countBuildings() {
        const counts = {};
        const buildings = this.game.state.buildings?.list || [];
        for (const building of buildings) {
            counts[building.type] = (counts[building.type] || 0) + 1;
        }
        return counts;
    }

    /**
     * Evaluate progress toward goals
     */
    evaluateGoals() {
        const resources = this.game.state.resources || {};
        return {
            goldReserve: {
                current: resources.gold || 0,
                target: this.goals.targetGoldReserve,
                percent: Math.min(100, Math.round(((resources.gold || 0) / this.goals.targetGoldReserve) * 100))
            },
            foodReserve: {
                current: resources.food || 0,
                target: this.goals.targetFoodReserve,
                percent: Math.min(100, Math.round(((resources.food || 0) / this.goals.targetFoodReserve) * 100))
            },
            woodReserve: {
                current: resources.wood || 0,
                target: this.goals.targetWoodReserve,
                percent: Math.min(100, Math.round(((resources.wood || 0) / this.goals.targetWoodReserve) * 100))
            }
        };
    }

    /**
     * Get suggested building additions
     */
    getSuggestedBuildings(limit = 3) {
        const report = this.getBalanceReport();
        return report.recommendations.slice(0, limit);
    }

    /**
     * Simulate adding a building
     */
    simulateBuilding(buildingType) {
        const buildingData = this.analyzer.buildingCache.get(buildingType);
        if (!buildingData) return null;

        const current = this.game.state.resources || {};
        const simulated = {
            gold: (current.gold || 0) + buildingData.netIncome,
            food: (current.food || 0) + (buildingData.income.food || 0),
            wood: (current.wood || 0) + (buildingData.income.wood || 0)
        };

        return {
            building: buildingData,
            projected: simulated,
            roi: buildingData.roi,
            paybackPeriod: buildingData.paybackPeriod
        };
    }

    /**
     * Check if economy is healthy
     */
    isHealthy() {
        const status = this.metrics.getStatus();
        const criticalIssues = status.issues.filter(i => i.severity === 'critical');
        return criticalIssues.length === 0;
    }

    /**
     * Get economy health score (0-100)
     */
    getHealthScore() {
        let score = 100;
        const status = this.metrics.getStatus();

        for (const issue of status.issues) {
            if (issue.severity === 'critical') score -= 25;
            else if (issue.severity === 'warning') score -= 10;
        }

        // Bonus for positive trends
        const goldTrend = this.metrics.analyzeTrend('gold');
        if (goldTrend.direction === 'increasing') score += 10;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get current economy phase based on tick count.
     */
    getEconomyPhase() {
        const tick = this.game.state.time?.tick || 0;
        if (tick < 300) return 'early';
        if (tick < 900) return 'mid';
        return 'late';
    }

    /**
     * Check progress against economy curve targets.
     */
    getCurveProgress() {
        const tick = this.game.state.time?.tick || 0;
        const gold = this.game.state.resources?.gold || 0;
        const phase = this.getEconomyPhase();
        const curve = ECONOMY_CURVE[phase];
        let target = 0;
        if (phase === 'early') target = curve.targetGoldByTick300;
        else if (phase === 'mid') target = curve.targetGoldByTick900;
        else target = ECONOMY_CURVE.late.targetGoldByTick1500;
        return {
            phase,
            current: gold,
            target,
            progress: Math.min(1, Math.max(0, gold / target)),
            message: curve.message,
        };
    }

    /**
     * Check which economy goals have been achieved.
     */
    checkGoals() {
        const tick = this.game.state.time?.tick || 0;
        const achieved = [];
        const pending = [];
        for (const goal of ECONOMY_GOALS) {
            if (tick < goal.tick) {
                pending.push(goal);
            } else {
                achieved.push({ ...goal, achieved: true });
            }
        }
        return { achieved, pending, next: pending[0] || null };
    }
}

/**
 * Create economy balancer instance
 */
export function createEconomyBalancer(game) {
    return new EconomyBalancer(game);
}
