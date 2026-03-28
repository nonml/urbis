// Crisis event system for dynamic game events (stable + deterministic)
import { CRISIS_TYPES } from './constants.js';

export class CrisisManager {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;
        this.activeCrisis = null;
        this.crisisChance = 0.01; // base per day
        this.eventHistory = [];
    }

    setDifficulty(difficulty) {
        this.crisisChance = difficulty.crisisChance;
    }

    // Pressure-based chance modifier: crises become more likely under stress.
    getPressureMultiplier() {
        const r = this.game.resources;
        const avgHappy = this.game.citizens.getAverageHappiness();
        let m = 1.0;
        if (r.food < 20) m += 0.5;
        if (r.gold < 20) m += 0.3;
        if (r.population > r.housing) m += 0.4;
        if (avgHappy < 40) m += 0.4;
        return Math.min(3.0, m);
    }

    checkForCrises() {
        if (this.activeCrisis) return;
        const p = this.crisisChance * this.getPressureMultiplier();
        if (this.rng.chance(p)) {
            const crisis = this.generateRandomCrisis();
            this.triggerCrisis(crisis);
        }
    }

    generateRandomCrisis() {
        const crises = [
            { type: CRISIS_TYPES.FIRE, name: 'City Fire', severity: 3 },
            { type: CRISIS_TYPES.FLOOD, name: 'Flooding', severity: 4 },
            { type: CRISIS_TYPES.DROUGHT, name: 'Drought', severity: 5 },
            { type: CRISIS_TYPES.PLAGUE, name: 'Plague', severity: 6 },
            { type: CRISIS_TYPES.INFLATION, name: 'Inflation Spike', severity: 4 },
            { type: CRISIS_TYPES.RIOT, name: 'Citizen Riot', severity: 5 },
            { type: CRISIS_TYPES.MIGRATION, name: 'Migration Wave', severity: 3 }
        ];

        const total = crises.reduce((s, c) => s + c.severity, 0);
        let roll = this.rng.float(0, total);
        for (const c of crises) {
            roll -= c.severity;
            if (roll <= 0) return { ...c, day: this.game.getDay() };
        }
        return { ...crises[0], day: this.game.getDay() };
    }

    buildOptions(crisis) {
        // All effects are in tracked resources for now (gold/food/wood/population)
        switch (crisis.type) {
            case CRISIS_TYPES.FIRE:
                return [
                    { label: 'Emergency Response (pay)', cost: { gold: 25 }, effect: { wood: -10 } },
                    { label: 'Let it burn', cost: {}, effect: { wood: -25, food: -10 } }
                ];
            case CRISIS_TYPES.FLOOD:
                return [
                    { label: 'Pump & Repair', cost: { wood: 20, gold: 10 }, effect: { food: -10 } },
                    { label: 'Do nothing', cost: {}, effect: { food: -30, gold: -10 } }
                ];
            case CRISIS_TYPES.DROUGHT:
                return [
                    { label: 'Import Food', cost: { gold: 35 }, effect: { food: +40 } },
                    { label: 'Rationing', cost: {}, effect: { food: -15 } }
                ];
            case CRISIS_TYPES.PLAGUE:
                return [
                    { label: 'Quarantine', cost: { gold: 30, food: 10 }, effect: { population: -2 } },
                    { label: 'Ignore', cost: {}, effect: { population: -8 } }
                ];
            case CRISIS_TYPES.INFLATION:
                return [
                    { label: 'Subsidize Essentials', cost: { gold: 25 }, effect: { gold: -10 } },
                    { label: 'Let market adapt', cost: {}, effect: { gold: -20 } }
                ];
            case CRISIS_TYPES.RIOT:
                return [
                    { label: 'Police Response', cost: { gold: 25 }, effect: { gold: -5 } },
                    { label: 'Concessions', cost: { food: 20, gold: 15 }, effect: { population: +1 } }
                ];
            case CRISIS_TYPES.MIGRATION:
                return [
                    { label: 'Welcome them', cost: { food: 20 }, effect: { population: +6 } },
                    { label: 'Turn away', cost: {}, effect: { gold: -10 } }
                ];
            default:
                return [{ label: 'Acknowledge', cost: {}, effect: {} }];
        }
    }

    triggerCrisis(crisis) {
        this.activeCrisis = crisis;
        this.eventHistory.push({ type: 'crisis', crisis, day: this.game.getDay() });

        // Play crisis alert sound
        if (this.game.audioManager) {
            this.game.audioManager.playCrisisAlert();
        }

        const options = this.buildOptions(crisis);
        this.game.ui.showCrisis(crisis, options, (choice) => this.resolveCrisis(choice));
        this.game.showMessage(`🚨 CRISIS: ${crisis.name}`, 'crisis');
    }

    resolveCrisis(choice) {
        if (!this.activeCrisis) return;

        if (!this.game.resources.canAfford(choice.cost || {})) {
            this.game.showMessage('Not enough resources for that response. Picking the fallback option.', 'crisis');
            // Fallback: option with lowest cost
            // (guaranteed to exist)
            choice = { label: 'Fallback', cost: {}, effect: { gold: -10 } };
        }

        this.game.resources.pay(choice.cost || {});
        this.game.applyEffect(choice.effect || {});
        
        // Play crisis resolved sound
        if (this.game.audioManager) {
            this.game.audioManager.playCrisisResolved();
        }
        
        this.game.showMessage(`✅ Crisis resolved: ${this.activeCrisis.name} → ${choice.label}`, 'success');

        this.activeCrisis = null;
    }

    update() {
        // Active crisis may worsen if ignored for too long (simple prototype).
        if (!this.activeCrisis) return;

        // Every day, small chance the crisis escalates.
        if (this.rng.chance(0.2)) {
            this.game.showMessage(`⚠️ ${this.activeCrisis.name} is getting worse...`, 'crisis');

            // Escalation effect (light-touch, deterministic)
            const t = this.activeCrisis.type;
            if (t === CRISIS_TYPES.FIRE) this.game.applyEffect({ wood: -5 });
            else if (t === CRISIS_TYPES.FLOOD) this.game.applyEffect({ food: -8 });
            else if (t === CRISIS_TYPES.DROUGHT) this.game.applyEffect({ food: -10 });
            else if (t === CRISIS_TYPES.PLAGUE) this.game.applyEffect({ population: -1 });
            else if (t === CRISIS_TYPES.INFLATION) this.game.applyEffect({ gold: -8 });
            else if (t === CRISIS_TYPES.RIOT) this.game.applyEffect({ gold: -10 });
            else if (t === CRISIS_TYPES.MIGRATION) this.game.applyEffect({ food: -6 });
        }
    }

    getActiveCrisisCount() {
        return this.activeCrisis ? 1 : 0;
    }

    /**
     * Calculate accumulated damage from crises (for lose conditions)
     */
    getAccumulatedDamage() {
        let damage = 0;
        for (const event of this.eventHistory) {
            if (event.crisis && event.crisis.severity) {
                damage += event.crisis.severity * 20;
            }
        }
        // Also add damage from escalation
        if (this.activeCrisis) {
            damage += this.activeCrisis.severity * 10;
        }
        return damage;
    }
}
