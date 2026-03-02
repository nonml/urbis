// Crisis Director v2 - Dynamic crisis management system
// Handles crisis generation, escalation, and resolution with context-aware responses

import { CRISIS_TYPES } from '../../constants.js';
import { EVENT_TYPES as GAME_EVENT_TYPES, eventBus } from '../events.js';

// Crisis severity levels
export const CRISIS_SEVERITY = {
    LOW: 1,
    MODERATE: 2,
    HIGH: 3,
    SEVERE: 4,
    CRITICAL: 5
};

// Crisis state types
export const CRISIS_STATE = {
    DETECTED: 'detected',
    ESCALATING: 'escalating',
    ACTIVE: 'active',
    RESOLVING: 'resolving',
    RESOLVED: 'resolved',
    ESCALATED: 'escalated'
};

export class Crisis {
    constructor(id, type, name, severity, location = null) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.severity = severity;
        this.location = location; // { x, y } tile coordinates if applicable
        this.state = CRISIS_STATE.DETECTED;
        this.dayCreated = 0;
        this.dayResolved = null;
        this.escalationCount = 0;
        this.heat = 0; // Attention/ panic level
        this.damage = { gold: 0, food: 0, wood: 0, population: 0 };
        this.impactScore = 0;
        this.attributes = {}; // Type-specific attributes
    }

    // Apply damage to resources
    applyDamage(damage) {
        for (const [resource, amount] of Object.entries(damage)) {
            this.damage[resource] = (this.damage[resource] || 0) + amount;
        }
        this.impactScore += Object.values(damage).reduce((s, a) => s + Math.abs(a), 0);
    }

    // Escalate the crisis
    escalate() {
        this.escalationCount++;
        this.state = CRISIS_STATE.ESCALATING;
        this.heat += 15;

        // Increase severity up to CRITICAL
        if (this.severity < CRISIS_SEVERITY.CRITICAL) {
            this.severity++;
        }

        // Escalation damage
        this.applyDamage({
            gold: -10 * this.severity,
            food: -5 * this.severity,
            wood: -3 * this.severity
        });
    }

    // Resolve the crisis
    resolve(responseType, success = true) {
        this.state = success ? CRISIS_STATE.RESOLVED : CRISIS_STATE.ESCALATED;
        this.dayResolved = this.dayCreated + this.escalationCount;

        // Success reduces impact
        if (success) {
            this.impactScore = Math.floor(this.impactScore * 0.3);
        } else {
            this.impactScore = Math.floor(this.impactScore * 1.5);
        }
    }
}

export class CrisisDirector {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;
        this.crisisCounter = 0;
        this.activeCrises = [];
        this.completedCrises = [];
        this.crisisChanceBase = 0.01; // Base daily chance
        this.escalationChance = 0.25; // Chance to escalate each tick
        this.minCrisisInterval = 5; // Minimum ticks between new crises

        // Crisis configuration
        this.crisisConfig = this.getCrisisConfig();

        // Monitoring
        this.lastCrisisTick = 0;
        this.cumulativeDamage = { gold: 0, food: 0, wood: 0, population: 0 };

        // Event listeners
        this.registerEvents();
    }

    getCrisisConfig() {
        return {
            [CRISIS_TYPES.FIRE]: {
                name: 'City Fire',
                baseSeverity: CRISIS_SEVERITY.MODERATE,
                maxSeverity: CRISIS_SEVERITY.CRITICAL,
                escalationSpeed: 2,
                impactFactors: {
                    distanceToWater: 1.5,
                    buildingDensity: 1.3,
                    fireDepartmentCoverage: 0.5
                },
                mitigationCost: { gold: 30, wood: 20 },
                mitigationEffect: { wood: -10, heat: -20 },
                description: 'A fire has broken out in the city. Response required immediately.'
            },
            [CRISIS_TYPES.FLOOD]: {
                name: 'Flooding',
                baseSeverity: CRISIS_SEVERITY.MODERATE,
                maxSeverity: CRISIS_SEVERITY.SEVERE,
                escalationSpeed: 3,
                impactFactors: {
                    rainfall: 2.0,
                    drainageCapacity: 0.3,
                    elevation: 1.2
                },
                mitigationCost: { wood: 25, gold: 15 },
                mitigationEffect: { food: -10, heat: -15 },
                description: 'Heavy rainfall has caused flooding. Drainage systems overwhelmed.'
            },
            [CRISIS_TYPES.DROUGHT]: {
                name: 'Drought',
                baseSeverity: CRISIS_SEVERITY.HIGH,
                maxSeverity: CRISIS_SEVERITY.CRITICAL,
                escalationSpeed: 1,
                impactFactors: {
                    reservoirLevels: 2.5,
                    agricultureCoverage: 1.8
                },
                mitigationCost: { gold: 40 },
                mitigationEffect: { food: +20, heat: -10 },
                description: 'Severe drought conditions affecting water supply and agriculture.'
            },
            [CRISIS_TYPES.PLAGUE]: {
                name: 'Outbreak',
                baseSeverity: CRISIS_SEVERITY.HIGH,
                maxSeverity: CRISIS_SEVERITY.CRITICAL,
                escalationSpeed: 4,
                impactFactors: {
                    populationDensity: 2.0,
                    healthcareCoverage: 0.4
                },
                mitigationCost: { gold: 35, food: 10 },
                mitigationEffect: { population: -1, heat: -25 },
                description: 'A disease outbreak is spreading. Quarantine measures needed.'
            },
            [CRISIS_TYPES.INFLATION]: {
                name: 'Economic Instability',
                baseSeverity: CRISIS_SEVERITY.MODERATE,
                maxSeverity: CRISIS_SEVERITY.SEVERE,
                escalationSpeed: 2,
                impactFactors: {
                    budgetBalance: 1.5,
                    unemployment: 1.3
                },
                mitigationCost: { gold: 25 },
                mitigationEffect: { gold: -5, heat: -15 },
                description: 'Market instability causing prices to surge.'
            },
            [CRISIS_TYPES.RIOT]: {
                name: 'Citizen Riot',
                baseSeverity: CRISIS_SEVERITY.HIGH,
                maxSeverity: CRISIS_SEVERITY.CRITICAL,
                escalationSpeed: 5,
                impactFactors: {
                    happiness: 2.0,
                    policeCoverage: 0.3,
                    unemployment: 1.5
                },
                mitigationCost: { gold: 20 },
                mitigationEffect: { gold: -5, heat: -30 },
                description: 'Citizens are protesting in the streets. Order breaking down.'
            },
            [CRISIS_TYPES.MIGRATION]: {
                name: 'Refugee Wave',
                baseSeverity: CRISIS_SEVERITY.MODERATE,
                maxSeverity: CRISIS_SEVERITY.HIGH,
                escalationSpeed: 3,
                impactFactors: {
                    housingAvailability: 2.0,
                    foodSupply: 1.8,
                    unemployment: 1.2
                },
                mitigationCost: { food: 20 },
                mitigationEffect: { population: +5, heat: -10 },
                description: 'A large group of refugees has arrived seeking shelter.'
            },
            // New crisis types
            [CRISIS_TYPES.BLACKOUT]: {
                name: 'Power Grid Collapse',
                baseSeverity: CRISIS_SEVERITY.HIGH,
                maxSeverity: CRISIS_SEVERITY.CRITICAL,
                escalationSpeed: 1,
                impactFactors: {
                    powerSupply: 2.0,
                    demand: 1.5
                },
                mitigationCost: { gold: 30, wood: 10 },
                mitigationEffect: { heat: -20 },
                description: 'The power grid has collapsed. Critical services affected.'
            },
            [CRISIS_TYPES.BRIDGE_FAILURE]: {
                name: 'Bridge Collapse',
                baseSeverity: CRISIS_SEVERITY.SEVERE,
                maxSeverity: CRISIS_SEVERITY.CRITICAL,
                escalationSpeed: 2,
                impactFactors: {
                    roadConnectivity: 2.5,
                    trafficLoad: 1.3
                },
                mitigationCost: { wood: 40, gold: 25 },
                mitigationEffect: { heat: -25 },
                description: 'A major bridge has collapsed. Transportation routes severed.'
            },
            [CRISIS_TYPES.MARKET_CRASH]: {
                name: 'Market Crash',
                baseSeverity: CRISIS_SEVERITY.HIGH,
                maxSeverity: CRISIS_SEVERITY.CRITICAL,
                escalationSpeed: 1,
                impactFactors: {
                    commercialZoneCount: 2.0,
                    merchantCount: 1.5
                },
                mitigationCost: { gold: 50 },
                mitigationEffect: { gold: +10, heat: -20 },
                description: 'Commercial markets have collapsed. Economy in freefall.'
            }
        };
    }

    registerEvents() {
        // Register crisis-related event types
        this.eventTypes = {
            CRISIS_DETECTED: 'crisis_detected',
            CRISIS_ESCALATED: 'crisis_escalated',
            CRISIS_RESOLVED: 'crisis_resolved',
            CRISIS_DAMAGE: 'crisis_damage',
            CRISIS_MITIGATION: 'crisis_mitigation'
        };
    }

    // Check for new crisis opportunities
    checkForCrisis(tick) {
        // Minimum interval between crises
        if (tick - this.lastCrisisTick < this.minCrisisInterval) {
            return;
        }

        // Base chance with pressure modifiers
        const pressure = this.calculateCityStress();
        const chance = this.crisisChanceBase * pressure;

        if (this.rng.chance(chance) && this.activeCrises.length < 3) {
            const newCrisis = this.generateRandomCrisis();
            this.triggerCrisis(newCrisis);
        }
    }

    // Calculate city stress multiplier
    calculateCityStress() {
        let stress = 1.0;
        const resources = this.game.resources || {};
        const citizens = this.game.citizens || {};

        // Resource scarcity
        if (resources.food && resources.food < 20) stress += 0.5;
        if (resources.gold && resources.gold < 20) stress += 0.3;

        // Population pressure
        const populationManager = citizens.populationManager || {};
        const housing = citizens.housingManager || {};
        if (populationManager.population > housing.capacity) stress += 0.4;

        // Happiness impact
        const avgHappy = citizens.getAverageHappiness ? citizens.getAverageHappiness() : 50;
        if (avgHappy < 40) stress += 0.4;

        // Active crises compound stress
        stress += this.activeCrises.length * 0.3;

        return Math.min(5.0, stress);
    }

    // Generate a random crisis
    generateRandomCrisis() {
        const types = Object.keys(this.crisisConfig);
        const type = this.rng.pick(types);
        const config = this.crisisConfig[type];

        const id = `crisis_${++this.crisisCounter}`;
        const severity = config.baseSeverity + this.rng.int(0, 1);

        // Determine location if applicable (for localized crises)
        let location = null;
        if ([CRISIS_TYPES.FIRE, CRISIS_TYPES.FLOOD, CRISIS_TYPES.RIOT].includes(type)) {
            location = this.getRandomLocation();
        }

        return new Crisis(id, type, config.name, severity, location);
    }

    // Get a random location on the map
    getRandomLocation() {
        const map = this.game.map;
        if (!map) return null;

        const x = this.rng.int(0, map.width - 1);
        const y = this.rng.int(0, map.height - 1);
        return { x, y };
    }

    // Trigger a new crisis
    triggerCrisis(crisis) {
        crisis.dayCreated = this.game.getDay();
        this.activeCrises.push(crisis);
        this.lastCrisisTick = this.game.state.time.tick;

        // Log the crisis
        eventBus.emit(this.eventTypes.CRISIS_DETECTED, {
            crisisId: crisis.id,
            crisisType: crisis.type,
            name: crisis.name,
            severity: crisis.severity,
            location: crisis.location
        });

        // Show notification
        this.game.showMessage(`🚨 CRISIS DETECTED: ${crisis.name}`, 'crisis');

        // Add to intel database if available
        if (this.game.intel && this.game.intel.database) {
            this.game.intel.database.addEntry({
                category: 'event',
                priority: crisis.severity >= CRISIS_SEVERITY.HIGH ? 'high' : 'medium',
                title: crisis.name,
                description: this.crisisConfig[crisis.type]?.description || 'A crisis has occurred',
                location: crisis.location,
                tags: ['crisis', crisis.type],
                heat: crisis.heat
            });
        }

        // UI notification
        if (this.game.ui.showCrisisAlert) {
            this.game.ui.showCrisisAlert(crisis, this.buildMitigationOptions(crisis));
        }
    }

    // Build mitigation options for a crisis
    buildMitigationOptions(crisis) {
        const config = this.crisisConfig[crisis.type];
        if (!config) return [];

        return [
            {
                label: 'Emergency Response',
                cost: config.mitigationCost,
                effect: { ...config.mitigationEffect, heat: -crisis.severity * 5 },
                description: 'Deploy resources to contain the crisis',
                successChance: 0.7 + (crisis.severity * 0.05)
            },
            {
                label: 'Full Containment',
                cost: { gold: config.mitigationCost.gold * 1.5, ...config.mitigationCost },
                effect: { ...config.mitigationEffect, heat: -crisis.severity * 10 },
                description: 'Aggressive response with maximum resources',
                successChance: 0.9
            },
            {
                label: 'Monitor and Wait',
                cost: {},
                effect: { heat: +crisis.severity * 5 },
                description: 'Allow the crisis to play out - lower immediate cost',
                successChance: 0.3
            }
        ];
    }

    // Process crisis escalation each tick
    updateCrises(tick) {
        for (const crisis of this.activeCrises) {
            // Chance to escalate
            if (this.rng.chance(this.escalationChance)) {
                crisis.escalate();

                eventBus.emit(this.eventTypes.CRISIS_ESCALATED, {
                    crisisId: crisis.id,
                    escalationCount: crisis.escalationCount,
                    newSeverity: crisis.severity,
                    newHeat: crisis.heat
                });

                this.game.showMessage(`⚠️ ${crisis.name} is escalating!`, 'warning');
            }

            // Accumulate passive damage
            this.applyPassiveDamage(crisis);
        }
    }

    // Apply passive damage based on crisis type and severity
    applyPassiveDamage(crisis) {
        const damage = {};

        switch (crisis.type) {
            case CRISIS_TYPES.FIRE:
                damage.wood = -crisis.severity * 2;
                damage.gold = -crisis.severity;
                break;
            case CRISIS_TYPES.FLOOD:
                damage.food = -crisis.severity * 3;
                damage.gold = -crisis.severity * 2;
                break;
            case CRISIS_TYPES.DROUGHT:
                damage.food = -crisis.severity * 5;
                break;
            case CRISIS_TYPES.PLAGUE:
                damage.population = -Math.ceil(crisis.severity / 2);
                damage.gold = -crisis.severity * 2;
                break;
            case CRISIS_TYPES.INFLATION:
                damage.gold = -crisis.severity * 3;
                break;
            case CRISIS_TYPES.RIOT:
                damage.gold = -crisis.severity * 4;
                damage.wood = -crisis.severity;
                break;
            case CRISIS_TYPES.MIGRATION:
                damage.food = -crisis.severity * 2;
                break;
            case CRISIS_TYPES.BLACKOUT:
                damage.gold = -crisis.severity * 3;
                damage.wood = -crisis.severity;
                break;
            case CRISIS_TYPES.BRIDGE_FAILURE:
                damage.gold = -crisis.severity * 2;
                damage.wood = -crisis.severity * 3;
                break;
            case CRISIS_TYPES.MARKET_CRASH:
                damage.gold = -crisis.severity * 5;
                break;
        }

        crisis.applyDamage(damage);

        // Track cumulative damage
        for (const [resource, amount] of Object.entries(damage)) {
            this.cumulativeDamage[resource] = (this.cumulativeDamage[resource] || 0) + amount;
        }

        // Log damage event
        eventBus.emit(this.eventTypes.CRISIS_DAMAGE, {
            crisisId: crisis.id,
            damage: damage
        });
    }

    // Resolve a crisis
    resolveCrisis(crisisId, responseIndex) {
        const crisis = this.activeCrises.find(c => c.id === crisisId);
        if (!crisis) return false;

        const options = this.buildMitigationOptions(crisis);
        const response = options[responseIndex];

        if (!response) return false;

        // Check if player can afford the response
        if (!this.game.resources.canAfford(response.cost)) {
            this.game.showMessage('Not enough resources for this response!', 'warning');
            return false;
        }

        // Apply cost
        this.game.resources.pay(response.cost);

        // Check success
        const success = this.rng.chance(response.successChance);

        // Apply effects
        if (response.effect) {
            this.game.applyEffect(response.effect);
        }

        // Resolve the crisis
        crisis.resolve('mitigation', success);

        // Remove from active crises
        this.activeCrises = this.activeCrises.filter(c => c.id !== crisisId);
        this.completedCrises.push(crisis);

        // Log resolution
        eventBus.emit(this.eventTypes.CRISIS_RESOLVED, {
            crisisId: crisis.id,
            success: success,
            damage: crisis.damage,
            impactScore: crisis.impactScore
        });

        eventBus.emit(this.eventTypes.CRISIS_MITIGATION, {
            crisisId: crisis.id,
            responseIndex: responseIndex,
            success: success
        });

        // Notification
        if (success) {
            this.game.showMessage(`✅ ${crisis.name} resolved successfully!`, 'success');
        } else {
            this.game.showMessage(`❌ ${crisis.name} resolution failed - conditions worsened`, 'warning');
        }

        // Update intel database
        if (this.game.intel && this.game.intel.database) {
            this.game.intel.database.updateEntry(crisis.id, {
                status: success ? 'resolved' : 'failed',
                resolution: 'mitigation'
            });
        }

        return success;
    }

    // Get crisis statistics
    getStats() {
        return {
            activeCount: this.activeCrises.length,
            completedCount: this.completedCrises.length,
            cumulativeDamage: this.cumulativeDamage,
            avgSeverity: this.activeCrises.length > 0
                ? this.activeCrises.reduce((s, c) => s + c.severity, 0) / this.activeCrises.length
                : 0,
            recentCrisisCount: this.completedCrises.length
        };
    }

    // Get active crises for UI
    getActiveCrisesForUI() {
        return this.activeCrises.map(c => ({
            id: c.id,
            type: c.type,
            name: c.name,
            severity: c.severity,
            heat: c.heat,
            damage: c.damage,
            dayCreated: c.dayCreated,
            escalationCount: c.escalationCount
        }));
    }

    // Serialize for save
    serialize() {
        return {
            crisisCounter: this.crisisCounter,
            activeCrises: this.activeCrises.map(c => ({
                id: c.id,
                type: c.type,
                name: c.name,
                severity: c.severity,
                location: c.location,
                state: c.state,
                dayCreated: c.dayCreated,
                dayResolved: c.dayResolved,
                escalationCount: c.escalationCount,
                heat: c.heat,
                damage: c.damage,
                impactScore: c.impactScore
            })),
            completedCrises: this.completedCrises.map(c => ({
                id: c.id,
                type: c.type,
                name: c.name,
                severity: c.severity,
                state: c.state,
                dayCreated: c.dayCreated,
                dayResolved: c.dayResolved,
                escalationCount: c.escalationCount,
                heat: c.heat,
                damage: c.damage,
                impactScore: c.impactScore
            })),
            lastCrisisTick: this.lastCrisisTick,
            cumulativeDamage: this.cumulativeDamage
        };
    }

    // Deserialize from save
    deserialize(data) {
        this.crisisCounter = data.crisisCounter;
        this.activeCrises = data.activeCrises.map(d => new Crisis(
            d.id, d.type, d.name, d.severity, d.location
        ));

        for (let i = 0; i < this.activeCrises.length; i++) {
            const crisis = this.activeCrises[i];
            const source = data.activeCrises[i];
            crisis.state = source.state;
            crisis.dayCreated = source.dayCreated;
            crisis.dayResolved = source.dayResolved;
            crisis.escalationCount = source.escalationCount;
            crisis.heat = source.heat;
            crisis.damage = source.damage;
            crisis.impactScore = source.impactScore;
        }

        this.completedCrises = data.completedCrises.map(d => new Crisis(
            d.id, d.type, d.name, d.severity, d.location
        ));

        for (let i = 0; i < this.completedCrises.length; i++) {
            const crisis = this.completedCrises[i];
            const source = data.completedCrises[i];
            crisis.state = source.state;
            crisis.dayCreated = source.dayCreated;
            crisis.dayResolved = source.dayResolved;
            crisis.escalationCount = source.escalationCount;
            crisis.heat = source.heat;
            crisis.damage = source.damage;
            crisis.impactScore = source.impactScore;
        }

        this.lastCrisisTick = data.lastCrisisTick;
        this.cumulativeDamage = data.cumulativeDamage;
    }
}