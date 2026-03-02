// Street Mode Interventions - Player-directed crisis response in Street Mode
// Allows direct control of response teams during crises

import { RESPONSE_TEAM_TYPES, RESPONSE_STATE } from './dispatch.js';
import { EVENT_TYPES as GAME_EVENT_TYPES, eventBus } from '../events.js';

// Intervention types available in Street Mode
export const INTERVENTION_TYPES = {
    DIRECT_RESPONSE: {
        name: 'Direct Response',
        description: 'Take direct control of a response team',
        cooldown: 5,
        range: 15,
        requiresMode: 'street'
    },
    CREATE_CHECKPOINT: {
        name: 'Establish Checkpoint',
        description: 'Set up a checkpoint to manage crowd flow',
        cooldown: 15,
        range: 10,
        requiresMode: 'street'
    },
    PUBLIC_ADDRESS: {
        name: 'Public Address',
        description: 'Use loudspeaker to calm crowds',
        cooldown: 10,
        range: 20,
        requiresMode: 'street'
    },
    EMERGENCY_EVACUATION: {
        name: 'Emergency Evacuation',
        description: 'Organize rapid evacuation of area',
        cooldown: 20,
        range: 25,
        requiresMode: 'street'
    },
    RESOURCE_MANIFEST: {
        name: 'Resource Manifest',
        description: 'Take inventory and call for resources',
        cooldown: 8,
        range: 12,
        requiresMode: 'street'
    }
};

// Intervention states
export const INTERVENTION_STATE = {
    READY: 'ready',
    ACTIVE: 'active',
    COOLDOWN: 'cooldown',
    EXPIRED: 'expired'
};

export class StreetIntervention {
    constructor(id, type, location, duration) {
        this.id = id;
        this.type = type;
        this.location = location; // { x, y }
        this.duration = duration;
        this.remainingDuration = duration;
        this.state = INTERVENTION_STATE.ACTIVE;
        this.effectiveness = 100;
        this.affects = []; // List of affected incidents/areas
        this.coolDownEnd = 0;
    }

    // Tick the intervention
    tick(tick) {
        if (this.state === INTERVENTION_STATE.COOLDOWN) {
            if (tick >= this.coolDownEnd) {
                this.state = INTERVENTION_STATE.READY;
            }
            return;
        }

        if (this.state !== INTERVENTION_STATE.ACTIVE) return;

        // Decrease remaining duration
        this.remainingDuration--;
        this.effectiveness = Math.max(0, this.effectiveness - 0.5);

        // Check if expired
        if (this.remainingDuration <= 0) {
            this.state = INTERVENTION_STATE.EXPIRED;
        }
    }

    // Apply intervention effects
    applyEffects(intendedTarget) {
        const effects = [];

        switch (this.type) {
            case INTERVENTION_TYPES.DIRECT_RESPONSE.name:
                effects.push({ type: 'speed_up', value: 0.3 });
                effects.push({ type: 'heat_reduction', value: 15 });
                break;

            case INTERVENTION_TYPES.CREATE_CHECKPOINT.name:
                effects.push({ type: 'crowd_control', value: 0.4 });
                effects.push({ type: 'entry_prevention', value: true });
                break;

            case INTERVENTION_TYPES.PUBLIC_ADDRESS.name:
                effects.push({ type: 'calming', value: 0.25 });
                effects.push({ type: 'info_dissemination', value: true });
                break;

            case INTERVENTION_TYPES.EMERGENCY_EVACUATION.name:
                effects.push({ type: 'evacuation', value: 1 });
                effects.push({ type: 'speed_up', value: 0.5 });
                break;

            case INTERVENTION_TYPES.RESOURCE_MANIFEST.name:
                effects.push({ type: 'resource_call', value: 1 });
                effects.push({ type: 'coordination_boost', value: 0.2 });
                break;
        }

        this.affects.push(intendedTarget?.id || 'area');
        return effects;
    }

    // Serialize for save
    serialize() {
        return {
            id: this.id,
            type: this.type,
            location: this.location,
            duration: this.duration,
            remainingDuration: this.remainingDuration,
            state: this.state,
            effectiveness: this.effectiveness,
            affects: this.affects,
            coolDownEnd: this.coolDownEnd
        };
    }
}

export class StreetModeManager {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;

        // Active interventions
        this.interventions = [];

        // Intervention counter
        this.interventionCounter = 0;

        // Current player location (for street mode)
        this.playerLocation = { x: 50, y: 50 };

        // Available actions
        this.actions = this.getAvailableActions();

        // Events
        this.eventTypes = {
            INTERVENTION_CREATED: 'intervention_created',
            INTERVENTION_EFFECT: 'intervention_effect',
            INTERVENTION_EXPIRED: 'intervention_expired'
        };
    }

    // Get available actions based on current mode and context
    getAvailableActions() {
        const mode = this.game.ui?.getCurrentMode?.() || 'street';

        return Object.entries(INTERVENTION_TYPES).map(([key, config]) => ({
            id: key,
            ...config,
            available: config.requiresMode === mode
        }));
    }

    // Update player location
    updatePlayerLocation(x, y) {
        this.playerLocation = { x, y };
    }

    // Create a new intervention
    createIntervention(typeKey) {
        const action = this.actions.find(a => a.id === typeKey);
        if (!action || !action.available) return null;

        // Check cooldowns for this type
        const recentInterventions = this.interventions.filter(
            i => i.type === action.name && i.state === INTERVENTION_STATE.COOLDOWN
        );

        if (recentInterventions.length > 0) {
            this.game.showMessage('Intervention is still on cooldown', 'warning');
            return null;
        }

        // Create intervention
        const id = `intervention_${++this.interventionCounter}`;
        const intervention = new StreetIntervention(
            id,
            action.name,
            this.playerLocation,
            action.cooldown * 5 // Duration based on cooldown
        );

        this.interventions.push(intervention);

        eventBus.emit(this.eventTypes.INTERVENTION_CREATED, {
            interventionId: id,
            interventionType: action.name,
            location: this.playerLocation
        });

        this.game.showMessage(`Intervention deployed: ${action.name}`, 'info');

        return intervention;
    }

    // Apply intervention effects to nearby incidents
    applyInterventionEffects(intervention) {
        const incidentSystem = this.game.crisis?.incidentSystem;
        if (!incidentSystem) return [];

        const effectsApplied = [];

        // Find nearby incidents
        const nearbyIncidents = incidentSystem.incidents.filter(
            i => Math.hypot(i.location.x - intervention.location.x,
                i.location.y - intervention.location.y) <= 15
        );

        for (const incident of nearbyIncidents) {
            const effects = intervention.applyEffects(incident);

            for (const effect of effects) {
                this.applyEffectToIncident(incident, effect);
                effectsApplied.push({ incidentId: incident.id, effect });
            }

            eventBus.emit(this.eventTypes.INTERVENTION_EFFECT, {
                interventionId: intervention.id,
                incidentId: incident.id,
                effects: effects
            });
        }

        return effectsApplied;
    }

    // Apply a single effect to an incident
    applyEffectToIncident(incident, effect) {
        switch (effect.type) {
            case 'speed_up':
                // Reduce remaining resolution time
                incident.heat = Math.max(0, incident.heat - effect.value * 10);
                break;

            case 'heat_reduction':
                incident.heat = Math.max(0, incident.heat - effect.value);
                break;

            case 'crowd_control':
                // Reduce riot spread chance
                break;

            case 'calming':
                // Reduce heat over time
                break;

            case 'evacuation':
                // Move people away from area
                break;

            case 'resource_call':
                // Call for external resources
                this.game.crisis?.director?.checkForCrisis(this.game.state.time.tick);
                break;

            case 'coordination_boost':
                // Boost dispatch system efficiency
                break;
        }
    }

    // Process all interventions
    updateInterventions(tick) {
        const expired = [];

        for (const intervention of this.interventions) {
            intervention.tick(tick);

            if (intervention.state === INTERVENTION_STATE.ACTIVE) {
                // Apply effects periodically
                if (tick % 5 === 0) {
                    this.applyInterventionEffects(intervention);
                }
            }

            if (intervention.state === INTERVENTION_STATE.EXPIRED) {
                expired.push(intervention.id);
                eventBus.emit(this.eventTypes.INTERVENTION_EXPIRED, {
                    interventionId: intervention.id,
                    interventionType: intervention.type
                });
            }
        }

        // Remove expired interventions
        this.interventions = this.interventions.filter(
            i => !expired.includes(i.id)
        );
    }

    // Get interventions at player location
    getInterventionsAtLocation(location) {
        return this.interventions.filter(
            i => Math.hypot(i.location.x - location.x,
                i.location.y - location.y) < 5
        );
    }

    // Get active interventions for UI
    getActiveInterventions() {
        return this.interventions.map(i => ({
            id: i.id,
            type: i.type,
            location: i.location,
            duration: i.duration,
            remainingDuration: i.remainingDuration,
            state: i.state,
            effectiveness: i.effectiveness,
            affects: i.affects
        }));
    }

    // Get intervention availability
    getInterventionAvailability() {
        const result = {};

        for (const action of this.actions) {
            const recent = this.interventions.filter(
                i => i.type === action.name && i.state === INTERVENTION_STATE.COOLDOWN
            );
            result[action.id] = {
                available: action.available && recent.length === 0,
                cooldownEnd: recent[0]?.coolDownEnd || 0
            };
        }

        return result;
    }

    // Serialize for save
    serialize() {
        return {
            interventions: this.interventions.map(i => i.serialize()),
            interventionCounter: this.interventionCounter,
            playerLocation: this.playerLocation
        };
    }

    // Deserialize from save
    deserialize(data) {
        this.interventions = data.interventions.map(d => {
            const intervention = new StreetIntervention(
                d.id, d.type, d.location, d.duration
            );
            intervention.remainingDuration = d.remainingDuration;
            intervention.state = d.state;
            intervention.effectiveness = d.effectiveness;
            intervention.affects = d.affects;
            intervention.coolDownEnd = d.coolDownEnd;
            return intervention;
        });

        this.interventionCounter = data.interventionCounter;
        this.playerLocation = data.playerLocation || { x: 50, y: 50 };
    }

    // Perform intervention action (for UI button)
    performIntervention(typeKey) {
        const intervention = this.createIntervention(typeKey);
        if (intervention) {
            // Immediate effect
            const effects = this.applyInterventionEffects(intervention);
            return { success: true, intervention, effects };
        }
        return { success: false, reason: 'cooldown_or_unavailable' };
    }
}