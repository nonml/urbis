// Resources class for tracking and managing game resources
export class Resources {
    constructor() {
        this.gold = 50;
        this.food = 50;
        this.wood = 50;
        this.population = 0;
        this.housing = 0;
        this.day = 1;
    }

    add(resource, amount) {
        if (amount < 0) {
            return this.remove(resource, Math.abs(amount));
        }
        this[resource] += amount;
        return true;
    }

    remove(resource, amount) {
        // Clamp at 0 (keeps simulation stable even with negative event effects)
        this[resource] = Math.max(0, this[resource] - amount);
        return true;
    }

    has(resource, amount) {
        return this[resource] >= amount;
    }

    canAfford(cost) {
        for (const [resource, amount] of Object.entries(cost)) {
            if (!this.has(resource, amount)) {
                return false;
            }
        }
        return true;
    }

    pay(cost) {
        for (const [resource, amount] of Object.entries(cost)) {
            this.remove(resource, amount);
        }
    }

    updateDailyIncome(income) {
        for (const [resource, amount] of Object.entries(income)) {
            if (amount > 0) {
                this.add(resource, amount);
            }
        }
    }

    getDailyCost(upkeep) {
        let totalCost = 0;
        for (const [resource, amount] of Object.entries(upkeep)) {
            totalCost += amount;
        }
        return totalCost;
    }

    // Check for crisis conditions
    isStarving() {
        return this.food <= 0 && this.population > 0;
    }

    isBankrupt() {
        return this.gold <= 0;
    }

    hasOvercrowding() {
        return this.population > this.housing;
    }
}