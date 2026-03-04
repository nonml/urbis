// Budget & Taxes System (Milestone G-01)
// Monthly (tick-based) budget calculates income and expenses.
// Tax sliders for R/C/I affect demand and citizen happiness.

import { BUILDING_TYPES } from '../../constants.js';

const DEFAULT_TAX_RATES = {
    residential: 0.05,  // 5%
    commercial: 0.08,   // 8%
    industrial: 0.06,   // 6%
};

const TAX_CAP = 0.20;   // Max 20% tax rate

// Tax impact on demand and happiness
const TAX_DEMAND_MULTIPLIER = 0.85;  // Each 1% tax reduces demand by 0.85%
const TAX_HAPPINESS_PENALTY = 0.2;   // Each 1% tax reduces happiness by 0.2%

export class BudgetManager {
    constructor(game) {
        this.game = game;
        this.taxRates = { ...DEFAULT_TAX_RATES };
        this.budgetTick = 0;
        this.lastBudgetIncome = 0;
        this.lastBudgetExpenses = 0;
        this.balancedBudget = true;
        this.budgetDeficit = 0;
    }

    /**
     * Calculate income from taxes based on current demand
     */
    calculateTaxIncome(demand) {
        const { residential, commercial, industrial } = demand || this.game.state.economy.demand || { residential: 0, commercial: 0, industrial: 0 };

        const resTax = residential * this.taxRates.residential;
        const comTax = commercial * this.taxRates.commercial;
        const indTax = industrial * this.taxRates.industrial;

        return Math.round(resTax + comTax + indTax);
    }

    /**
     * Calculate ongoing expenses (upkeep, services, debt)
     */
    calculateExpenses() {
        const { buildings, citizens } = this.game;
        const { population } = this.game.resources;
        const ledger = this.game.economyLedger;

        // Building upkeep
        let buildingUpkeep = 0;
        for (const b of buildings.buildings) {
            const buildingDef = BUILDING_TYPES[b.type] || {};
            buildingUpkeep += buildingDef.upkeep || 0;
        }

        // Service upkeep (simplified: base cost + per-building)
        const serviceBuildings = buildings.buildings.filter(b => b.type === 'town_hall' || b.type === 'police_station' || b.type === 'school' || b.type === 'farm');
        const serviceUpkeep = serviceBuildings.length * 2;

        // Debt repayment (if any)
        const debtRepayment = this.getDebtPayment();

        this.game.economyLedger.addDelta(ledger.beginTick(this.game.state.time.tick), 'gold', -buildingUpkeep, 'building_upkeep');
        this.game.economyLedger.addDelta(ledger.beginTick(this.game.state.time.tick), 'gold', -serviceUpkeep, 'service_upkeep');
        this.game.economyLedger.addDelta(ledger.beginTick(this.game.state.time.tick), 'gold', -debtRepayment, 'debt_repayment');

        return buildingUpkeep + serviceUpkeep + debtRepayment;
    }

    /**
     * Process budget tick
     */
    processBudgetTick() {
        const { state, resources, citizens, economyLedger } = this.game;
        const demand = state.economy.demand || { residential: 0, commercial: 0, industrial: 0 };

        // Calculate income
        const taxIncome = this.calculateTaxIncome(demand);

        // Calculate expenses
        const expenses = this.calculateExpenses();

        // Update ledger
        if (taxIncome > 0) {
            economyLedger.addDelta(economyLedger.beginTick(state.time.tick), 'gold', taxIncome, 'taxes');
            resources.gold += taxIncome;
        }

        // Update budget state
        this.budgetDeficit = expenses - taxIncome;
        this.balancedBudget = this.budgetDeficit <= 0;
        this.budgetTick = state.time.tick;
        this.lastBudgetIncome = taxIncome;
        this.lastBudgetExpenses = expenses;

        // Check for bankruptcy risk
        if (resources.gold < 0 && !this.budgetDeficitAlertTriggered) {
            this.budgetDeficitAlertTriggered = true;
            this.game.showMessage('⚠️ WARNING: City is in debt!', 'crisis');
        }

        return {
            income: taxIncome,
            expenses,
            deficit: this.budgetDeficit,
            balanced: this.balancedBudget,
        };
    }

    /**
     * Get debt payment amount (simplified: 5% of total debt per tick)
     */
    getDebtPayment() {
        const debt = this.game.state.economy.debt || 0;
        const payment = Math.max(0, Math.floor(debt * 0.05));
        return payment;
    }

    /**
     * Apply tax rate changes
     */
    setTaxRate(zoneType, rate) {
        if (!['residential', 'commercial', 'industrial'].includes(zoneType)) {
            throw new Error(`Invalid zone type: ${zoneType}`);
        }
        const newRate = Math.max(0, Math.min(TAX_CAP, rate));
        this.taxRates[zoneType] = newRate;
    }

    /**
     * Get effective tax rate for a zone
     */
    getTaxRate(zoneType) {
        return this.taxRates[zoneType] || 0;
    }

    /**
     * Calculate demand penalty from tax rate
     */
    getTaxDemandPenalty() {
        // Each 1% tax reduces demand by 0.85%
        const totalTax = Object.values(this.taxRates).reduce((sum, rate) => sum + rate, 0);
        return Math.min(0.5, totalTax * TAX_DEMAND_MULTIPLIER);
    }

    /**
     * Calculate happiness penalty from tax rate
     */
    getTaxHappinessPenalty() {
        // Each 1% tax reduces happiness by 0.2%
        const totalTax = Object.values(this.taxRates).reduce((sum, rate) => sum + rate, 0);
        return totalTax * TAX_HAPPINESS_PENALTY;
    }

    /**
     * Serialize for save
     */
    serialize() {
        return {
            taxRates: { ...this.taxRates },
            budgetTick: this.budgetTick,
            lastBudgetIncome: this.lastBudgetIncome,
            lastBudgetExpenses: this.lastBudgetExpenses,
            balancedBudget: this.balancedBudget,
            budgetDeficit: this.budgetDeficit,
        };
    }

    /**
     * Deserialize for load
     */
    deserialize(data) {
        if (!data) return;
        this.taxRates = { ...data.taxRates };
        this.budgetTick = data.budgetTick || 0;
        this.lastBudgetIncome = data.lastBudgetIncome || 0;
        this.lastBudgetExpenses = data.lastBudgetExpenses || 0;
        this.balancedBudget = data.balancedBudget !== undefined ? data.balancedBudget : true;
        this.budgetDeficit = data.budgetDeficit || 0;
    }
}

/**
 * Create budget manager instance
 */
export function createBudgetManager(game) {
    return new BudgetManager(game);
}