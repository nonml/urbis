// Resources class for tracking and managing game resources
export class Resources {
    constructor(stateResources = null, audioManager = null) {
        this.gold = 100;
        this.food = 100;
        this.wood = 100;
        this.population = 0;
        this.housing = 0;
        this.day = 1;

        // UI / telemetry (optional)
        this.jobProduction = { gold: 0, food: 0, wood: 0 };
        this.totalGoldEarned = 0;
        this.totalFoodProduced = 0;
        this.totalWoodProduced = 0;

        // If stateResources provided, sync with it
        this.stateResources = stateResources;

        // Audio manager for resource change sounds
        this.audioManager = audioManager;

        // Track previous resource values for low threshold detection
        this._previousValues = {
            gold: this.gold,
            food: this.food,
            wood: this.wood
        };
    }

    // Sync state resources if provided
    _syncState() {
        if (this.stateResources) {
            this.stateResources.gold = this.gold;
            this.stateResources.food = this.food;
            this.stateResources.wood = this.wood;
            this.stateResources.population = this.population;
            this.stateResources.housing = this.housing;
            this.stateResources.day = this.day;
        }
    }

    // Sync resources from state (one-way from state to resources)
    syncFromState() {
        if (this.stateResources) {
            this.gold = this.stateResources.gold;
            this.food = this.stateResources.food;
            this.wood = this.stateResources.wood;
            this.population = this.stateResources.population;
            this.housing = this.stateResources.housing;
            this.day = this.stateResources.day;
        }
    }

    add(resource, amount) {
        if (amount < 0) {
            return this.remove(resource, Math.abs(amount));
        }
        const prevValue = this[resource];
        this[resource] += amount;
        this._syncState();

        // Play audio feedback for resource gain
        if (this.audioManager && amount > 0) {
            this.audioManager.playSFX('resource_gain', {
                volume: Math.min(1, amount / 100) // Scale volume with amount
            });
        }

        // Track for low threshold detection
        this._previousValues[resource] = this[resource];

        return true;
    }

    remove(resource, amount) {
        const prevValue = this[resource];
        // Clamp at 0 (keeps simulation stable even with negative event effects)
        this[resource] = Math.max(0, this[resource] - amount);
        this._syncState();

        // Play audio feedback for resource loss
        if (this.audioManager && amount > 0) {
            // Check if resource dropped to low threshold (<= 10)
            if (this[resource] <= 10 && prevValue > 10) {
                this.audioManager.playSFX('resource_low', {
                    resource: resource
                });
            } else if (amount >= 50) {
                // Significant loss
                this.audioManager.playSFX('resource_loss', {
                    volume: Math.min(1, amount / 100)
                });
            }
        }

        // Track for low threshold detection
        this._previousValues[resource] = this[resource];

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

    recordJobProduction(production) {
        const p = production || { gold: 0, food: 0, wood: 0 };
        this.jobProduction = {
            gold: p.gold || 0,
            food: p.food || 0,
            wood: p.wood || 0
        };
        this.totalGoldEarned += this.jobProduction.gold;
        this.totalFoodProduced += this.jobProduction.food;
        this.totalWoodProduced += this.jobProduction.wood;
    }

    // Set audio manager reference (called after Game initialization)
    setAudioManager(audioManager) {
        this.audioManager = audioManager;
    }
}