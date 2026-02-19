// Event system - Simple pub/sub for game events
// Events drive quest progression

/**
 * Event types for the game
 */
export const EVENT_TYPES = {
    // Player actions
    PLAYER_HACKED_NODE: 'player_hacked_node',
    PLAYER_ENTERED_DISTRICT: 'player_entered_district',
    PLAYER_MOVED: 'player_moved',
    PLAYER_INTERACT: 'player_interact',
    PLAYER_PICKED_INTERACTABLE: 'player_picked_interactable',
    PLAYER_DECISION: 'player_decision',

    // System events
    CRISIS_STARTED: 'crisis_started',
    CRISIS_RESOLVED: 'crisis_resolved',
    TIME_PHASE_CHANGED: 'time_phase_changed',
    DAY_START: 'day_start',
    ANOMALY_FOUND: 'anomaly_found',

    // Quest-specific
    QUEST_STARTED: 'quest_started',
    QUEST_STEP_COMPLETED: 'quest_step_completed',
    QUEST_BLOCKED: 'quest_blocked',
    QUEST_COMPLETED: 'quest_completed',
    QUEST_FAILED: 'quest_failed',

    // Interactable events
    INTERACTABLE_AVAILABLE: 'interactable_available',
    INTERACTABLE_SUCCESS: 'interactable_success',
    INTERACTABLE_FAILED: 'interactable_failed',

    // District events
    DISTRICT_CHANGE: 'district_change',
    DISTRICT_MODIFIER_APPLIED: 'district_modifier_applied',

    // Citizen events
    CITIZEN_TRAIT_CHANGED: 'citizen_trait_changed',
    CITIZEN_RELATIONSHIP_CHANGED: 'citizen_relationship_changed',

    // Evidence events
    CLUE_DISCOVERED: 'clue_discovered',
    EVIDENCE_ADDED: 'evidence_added',

    // Intel events
    INTEL_REVEALED: 'intel_revealed',

    // Rival events
    RIVAL_ACTION_STARTED: 'rival_action_started',
    RIVAL_ACTION_COMPLETED: 'rival_action_completed',

    // Police events
    POLICE_UNIT_SPAWNED: 'police_unit_spawned',
    POLICE_UNIT_DESPAWNED: 'police_unit_despawned',
    POLICE_ENCOUNTER: 'police_encounter',
};

/**
 * Event emitter class
 */
export class EventEmitter {
    constructor() {
        this.listeners = {};
        this.globalListeners = [];
    }

    /**
     * Register an event listener
     * @param {string} eventType - The event type to listen for
     * @param {Function} callback - Function to call when event fires
     * @param {Object} [context] - Context to bind callback to
     * @returns {Function} Unsubscribe function
     */
    on(eventType, callback, context) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }

        const handler = {
            callback: callback.bind(context || this),
            context: context || this
        };

        this.listeners[eventType].push(handler);
        return () => this.off(eventType, callback, context);
    }

    /**
     * Register a global listener (receives all events)
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    onAll(callback) {
        this.globalListeners.push(callback);
        return () => this.offAll(callback);
    }

    /**
     * Remove an event listener
     */
    off(eventType, callback, context) {
        if (!this.listeners[eventType]) return;

        this.listeners[eventType] = this.listeners[eventType].filter(
            handler => handler.callback !== (callback.bind(context || this))
        );
    }

    /**
     * Remove a global listener
     */
    offAll(callback) {
        this.globalListeners = this.globalListeners.filter(
            listener => listener !== callback
        );
    }

    /**
     * Emit an event
     * @param {string} eventType - The event type
     * @param {Object} [data] - Event data
     */
    emit(eventType, data = {}) {
        // Call global listeners first
        for (const listener of this.globalListeners) {
            try {
                listener(eventType, data);
            } catch (e) {
                console.error('Event bus: Global listener error:', e);
            }
        }

        // Call specific listeners
        if (this.listeners[eventType]) {
            for (const handler of this.listeners[eventType]) {
                try {
                    handler.callback(data);
                } catch (e) {
                    console.error(`Event bus: Listener for ${eventType} error:`, e);
                }
            }
        }
    }

    /**
     * Clear all listeners
     */
    clear() {
        this.listeners = {};
        this.globalListeners = [];
    }

    /**
     * Check if any listeners exist for an event type
     */
    hasListeners(eventType) {
        return !!this.listeners[eventType] && this.listeners[eventType].length > 0;
    }
}

/**
 * Create a default event bus instance
 */
export const eventBus = new EventEmitter();

/**
 * Event helper functions for common game events
 */
export const Events = {
    /**
     * Player hacks a node successfully
     */
    playerHackedNode(interactable, success) {
        eventBus.emit(EVENT_TYPES.PLAYER_HACKED_NODE, {
            interactable,
            success,
            tick: Date.now()
        });
    },

    /**
     * Player enters a district
     */
    playerEnteredDistrict(districtId, districtName) {
        eventBus.emit(EVENT_TYPES.PLAYER_ENTERED_DISTRICT, {
            districtId,
            districtName,
            tick: Date.now()
        });
    },

    /**
     * Player moves to a new tile
     */
    playerMoved(x, y) {
        eventBus.emit(EVENT_TYPES.PLAYER_MOVED, {
            x,
            y,
            tick: Date.now()
        });
    },

    /**
     * Crisis event starts
     */
    crisisStarted(crisis) {
        eventBus.emit(EVENT_TYPES.CRISIS_STARTED, {
            crisis,
            tick: Date.now()
        });
    },

    /**
     * Crisis event resolved
     */
    crisisResolved(crisis, outcome) {
        eventBus.emit(EVENT_TYPES.CRISIS_RESOLVED, {
            crisis,
            outcome,
            tick: Date.now()
        });
    },

    /**
     * Anomaly detected (quest trigger)
     */
    anomalyFound(anomalyType, details) {
        eventBus.emit(EVENT_TYPES.ANOMALY_FOUND, {
            anomalyType,
            details,
            tick: Date.now()
        });
    },

    /**
     * Quest step completed
     */
    questStepCompleted(questId, stepId) {
        eventBus.emit(EVENT_TYPES.QUEST_STEP_COMPLETED, {
            questId,
            stepId,
            tick: Date.now()
        });
    },

    /**
     * Quest blocked
     */
    questBlocked(questId, reason) {
        eventBus.emit(EVENT_TYPES.QUEST_BLOCKED, {
            questId,
            reason,
            tick: Date.now()
        });
    },

    /**
     * Quest completed
     */
    questCompleted(questId, outcome) {
        eventBus.emit(EVENT_TYPES.QUEST_COMPLETED, {
            questId,
            outcome,
            tick: Date.now()
        });
    },

    /**
     * Clue discovered
     */
    clueDiscovered(clue) {
        eventBus.emit(EVENT_TYPES.CLUE_DISCOVERED, {
            clue,
            tick: Date.now()
        });
    },

    /**
     * Player interacts with an interactable
     */
    playerInteract(interactable) {
        eventBus.emit(EVENT_TYPES.PLAYER_INTERACT, {
            interactable,
            tick: Date.now()
        });
    }
};