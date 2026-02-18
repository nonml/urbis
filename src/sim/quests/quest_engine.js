// Quest Engine - Executes quests step-by-step, event-driven
import { eventBus, Events } from '../events.js';
import { getInteractableTypeInfo, getInteractableStateName } from '../interactables.js';

/**
 * Quest step kinds and their handlers
 */
export const STEP_KINDS = {
    TRIGGER: 'trigger',
    HACK_NODE: 'hack_node',
    GO_TO: 'go_to',
    CHOICE: 'choice',
    INVESTIGATE: 'investigate',
    INTERACT: 'interact',
    OUTCOME: 'outcome',
    CONDITIONAL: 'conditional',
    SPAWN_CLUE: 'spawn_clue'
};

/**
 * Creates a new quest instance from a quest definition
 * @param {Object} questDef - Quest definition from JSON
 * @param {Object} context - Runtime context (citizens, districts, etc.)
 * @returns {Object} Quest instance
 */
export function createQuestInstance(questDef, context) {
    // Resolve any placeholders in the quest definition
    const resolvedSteps = questDef.steps.map(step => resolveStep(step, context));

    return {
        id: questDef.id,
        title: questDef.title || questDef.id,
        description: questDef.description || '',
        type: questDef.type || 'casefile',
        tags: questDef.tags || [],
        status: 'active', // active, blocked, completed, failed
        currentStepIndex: 0,
        steps: resolvedSteps,
        completedSteps: [],
        blockedReason: null,
        context: context || {},
        data: {
            clues: [],
            choices: [],
            markers: [],
            evidence: []
        },
        createdAt: Date.now(),
        lastUpdated: Date.now()
    };
}

/**
 * Resolves placeholders in a step definition
 */
function resolveStep(step, context) {
    // Clone the step
    const resolved = { ...step };

    // Resolve marker if it references a district or building
    if (step.marker && context) {
        if (step.marker === 'last_seen' && context.lastSeenLocation) {
            resolved.targetX = context.lastSeenLocation.x;
            resolved.targetY = context.lastSeenLocation.y;
        } else if (step.marker === 'suspicious_building' && context.suspiciousBuilding) {
            resolved.targetX = context.suspiciousBuilding.x;
            resolved.targetY = context.suspiciousBuilding.y;
        }
    }

    // Resolve interact type
    if (step.interactType === 'citizen' && context.citizens) {
        // Find a random citizen as target
        if (context.citizens.length > 0) {
            resolved.targetCitizen = context.citizens[Math.floor(Math.random() * context.citizens.length)];
        }
    }

    return resolved;
}

/**
 * Quest Engine class
 */
export class QuestEngine {
    constructor(game) {
        this.game = game;
        this.activeQuests = [];
        this.completedQuests = [];
        this.rng = game.rng;
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for quest progression
     */
    setupEventListeners() {
        // Listen for player hacking nodes
        eventBus.on('player_hacked_node', (data) => {
            this.handleHackedNode(data.interactable, data.success);
        }, this);

        // Listen for player entering districts
        eventBus.on('player_entered_district', (data) => {
            this.handleEnteredDistrict(data.districtId);
        }, this);

        // Listen for anomalies (quest triggers)
        eventBus.on('anomaly_found', (data) => {
            this.handleAnomaly(data.anomalyType, data.details);
        }, this);

        // Listen for player decisions
        eventBus.on('player_decision', (data) => {
            this.handlePlayerDecision(data);
        }, this);

        // Listen for interactables becoming available
        eventBus.on('interactable_available', (data) => {
            this.handleInteractableAvailable(data.interactable);
        }, this);
    }

    /**
     * Creates and adds a new quest
     * @param {Object} questDef - Quest definition
     * @param {Object} context - Runtime context
     * @returns {Object} The created quest instance
     */
    addQuest(questDef, context = {}) {
        const quest = createQuestInstance(questDef, context);
        this.activeQuests.push(quest);

        // Emit quest started event
        eventBus.emit('quest_started', {
            questId: quest.id,
            questTitle: quest.title,
            tick: Date.now()
        });

        // Try to advance the quest
        this.tryAdvanceQuest(quest);

        return quest;
    }

    /**
     * Finds a quest by ID
     */
    getQuestById(id) {
        return this.activeQuests.find(q => q.id === id) ||
               this.completedQuests.find(q => q.id === id);
    }

    /**
     * Advances a quest by one step
     * @param {Object} quest - Quest instance
     * @returns {boolean} True if advanced, false otherwise
     */
    advanceQuest(quest) {
        if (quest.currentStepIndex >= quest.steps.length) {
            quest.status = 'completed';
            this.completedQuests.push(quest);
            eventBus.emit('quest_completed', {
                questId: quest.id,
                outcome: 'success',
                tick: Date.now()
            });
            return false;
        }

        const currentStep = quest.steps[quest.currentStepIndex];
        const result = this.executeStep(quest, currentStep);

        if (result) {
            quest.currentStepIndex++;
            quest.lastUpdated = Date.now();
            eventBus.emit('quest_step_completed', {
                questId: quest.id,
                stepId: currentStep.id,
                tick: Date.now()
            });
            return true;
        }

        return false;
    }

    /**
     * Tries to advance quest - handles auto-advancing steps
     * @param {Object} quest
     * @returns {boolean} True if step was advanced
     */
    tryAdvanceQuest(quest) {
        // If current step is auto-advancing, do it
        const currentStep = quest.steps[quest.currentStepIndex];

        if (currentStep && currentStep.autoAdvance) {
            return this.advanceQuest(quest);
        }

        return false;
    }

    /**
     * Executes a quest step
     * @param {Object} quest - Quest instance
     * @param {Object} step - Step to execute
     * @returns {boolean} True if step completed successfully
     */
    executeStep(quest, step) {
        switch (step.kind) {
            case STEP_KINDS.TRIGGER:
                return this.handleTriggerStep(quest, step);
            case STEP_KINDS.HACK_NODE:
                return this.handleHackNodeStep(quest, step);
            case STEP_KINDS.GO_TO:
                return this.handleGoToStep(quest, step);
            case STEP_KINDS.CHOICE:
                return this.handleChoiceStep(quest, step);
            case STEP_KINDS.INVESTIGATE:
                return this.handleInvestigateStep(quest, step);
            case STEP_KINDS.INTERACT:
                return this.handleInteractStep(quest, step);
            case STEP_KINDS.OUTCOME:
                return this.handleOutcomeStep(quest, step);
            case STEP_KINDS.CONDITIONAL:
                return this.handleConditionalStep(quest, step);
            case STEP_KINDS.SPAWN_CLUE:
                return this.handleSpawnClueStep(quest, step);
            default:
                console.warn(`Unknown step kind: ${step.kind}`);
                return true; // Skip unknown steps
        }
    }

    /**
     * Handles trigger steps (waiting for event)
     */
    handleTriggerStep(quest, step) {
        // Check if trigger condition is met
        if (quest.data.triggers && quest.data.triggers[step.trigger]) {
            return true;
        }
        // Mark this trigger as waiting
        if (!quest.data.triggers) quest.data.triggers = {};
        quest.data.triggers[step.trigger] = false;
        return false;
    }

    /**
     * Handles hack node steps
     */
    handleHackNodeStep(quest, step) {
        // Check if node has been hacked
        const node = this.findNodeByType(step.nodeType);

        if (node && node.state === 'success') {
            // Execute onComplete effects
            if (step.onComplete) {
                for (const effect of step.onComplete) {
                    if (effect.startsWith('spawn_clue:')) {
                        const clueId = effect.split(':')[1];
                        quest.data.clues.push({
                            id: clueId,
                            nodeId: node.id,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            return true;
        }

        // If player is near a hackable node, prompt them
        const nearbyNode = this.game.interactables.getNearbyInteractable(
            this.game.state.player.x,
            this.game.state.player.y
        );

        if (nearbyNode && nearbyNode.state === 'available' &&
            nearbyNode.type === step.nodeType) {
            // Prompt player to hack this node
            this.game.ui.showMessage(`Press SPACE to hack the ${getInteractableTypeInfo(nearbyNode.type).name}...`, 'normal');
            this.game.ui.showActionPrompt('Hack', () => {
                this.game.interactables.startHack(nearbyNode, this.game.state.time.tick);
            });
        }

        return false;
    }

    /**
     * Handles go_to steps
     */
    handleGoToStep(quest, step) {
        if (step.targetX !== undefined && step.targetY !== undefined) {
            const playerX = this.game.state.player.x;
            const playerY = this.game.state.player.y;
            const dist = Math.abs(playerX - step.targetX) + Math.abs(playerY - step.targetY);

            // Create a world marker
            if (!quest.data.markers.find(m => m.stepId === step.id)) {
                quest.data.markers.push({
                    stepId: step.id,
                    x: step.targetX,
                    y: step.targetY,
                    type: 'waypoint'
                });
            }

            // Check if player arrived
            if (dist <= 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Handles choice steps
     */
    handleChoiceStep(quest, step) {
        // Store choices for player to pick
        quest.data.choices = step.choices || [];

        // Show choice prompt
        this.game.ui.showQuestChoice(step.text, step.choices, (choice) => {
            eventBus.emit('player_decision', {
                questId: quest.id,
                choiceId: choice.id,
                choiceLabel: choice.label,
                effect: choice.effect
            });
        });

        return false; // Wait for player choice
    }

    /**
     * Handles investigate steps
     */
    handleInvestigateStep(quest, step) {
        // Check if player is at target location
        if (quest.data.targetLocation) {
            const playerX = this.game.state.player.x;
            const playerY = this.game.state.player.y;
            const targetX = quest.data.targetLocation.x;
            const targetY = quest.data.targetLocation.y;
            const dist = Math.abs(playerX - targetX) + Math.abs(playerY - targetY);

            if (dist <= 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Handles interact steps (with citizens)
     */
    handleInteractStep(quest, step) {
        if (step.targetCitizen) {
            // Check if player is near the citizen
            const cx = step.targetCitizen.x;
            const cy = step.targetCitizen.y;
            const px = this.game.state.player.x;
            const py = this.game.state.player.y;
            const dist = Math.abs(px - cx) + Math.abs(py - cy);

            if (dist <= 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Handles outcome steps (quest resolution)
     */
    handleOutcomeStep(quest, step) {
        // Apply the outcome effects
        if (step.outcomes && step.outcomes.length > 0) {
            // Pick first outcome or the one matching the context
            const outcome = step.outcomes[0];
            this.applyOutcome(outcome);
            quest.data.outcome = outcome;
        }
        return true;
    }

    /**
     * Handles conditional steps
     */
    handleConditionalStep(quest, step) {
        if (!step.condition) return true;

        // Evaluate condition
        const result = this.evaluateCondition(step.condition);
        if (result) {
            return true;
        }
        return false;
    }

    /**
     * Handles spawn_clue steps
     */
    handleSpawnClueStep(quest, step) {
        // Clue already added by hack_node step
        return true;
    }

    /**
     * Handles player decision (from choice step)
     */
    handlePlayerDecision(data) {
        const quest = this.getQuestById(data.questId);
        if (!quest) return;

        // Apply effect
        if (data.effect) {
            this.applyEffect(data.effect, quest);
        }

        // Advance to next step
        if (quest.currentStepIndex < quest.steps.length) {
            this.advanceQuest(quest);
        }
    }

    /**
     * Handles hacker node completion
     */
    handleHackedNode(interactable, success) {
        // Update quest steps waiting for this node
        for (const quest of this.activeQuests) {
            for (const step of quest.steps) {
                if (step.kind === STEP_KINDS.HACK_NODE &&
                    step.nodeType === interactable.type &&
                    !quest.completedSteps.includes(step.id)) {
                    // Mark step complete
                    quest.completedSteps.push(step.id);
                    eventBus.emit('quest_step_completed', {
                        questId: quest.id,
                        stepId: step.id,
                        tick: Date.now()
                    });
                }
            }
        }
    }

    /**
     * Handles player entering a district
     */
    handleEnteredDistrict(districtId) {
        // Update quests with district requirements
        for (const quest of this.activeQuests) {
            for (const step of quest.steps) {
                if (step.kind === STEP_KINDS.GO_TO &&
                    step.marker === 'last_seen' &&
                    !quest.completedSteps.includes(step.id)) {
                    // Update marker if needed
                    const district = this.game.map.getDistrictAt(0, 0); // Placeholder
                    if (district && district.id === districtId) {
                        quest.data.lastDistrict = districtId;
                    }
                }
            }
        }
    }

    /**
     * Handles anomaly detection (quest trigger)
     */
    handleAnomaly(anomalyType, details) {
        // Check if any quest has this trigger
        for (const quest of this.activeQuests) {
            for (const step of quest.steps) {
                if (step.kind === STEP_KINDS.TRIGGER &&
                    step.trigger === anomalyType &&
                    !quest.completedSteps.includes(step.id)) {
                    // Trigger step complete
                    if (!quest.data.triggers) quest.data.triggers = {};
                    quest.data.triggers[anomalyType] = true;
                }
            }
        }

        // Emit anomaly found event
        eventBus.emit('anomaly_found', {
            anomalyType,
            details,
            tick: Date.now()
        });
    }

    /**
     * Handles interactable becoming available
     */
    handleInteractableAvailable(interactable) {
        // Check if any quest step is waiting for this node
        for (const quest of this.activeQuests) {
            for (const step of quest.steps) {
                if (step.kind === STEP_KINDS.HACK_NODE &&
                    step.nodeType === interactable.type &&
                    !quest.completedSteps.includes(step.id)) {
                    // Check if node is at correct location
                    const dist = Math.abs(this.game.state.player.x - interactable.x) +
                                Math.abs(this.game.state.player.y - interactable.y);

                    if (dist <= 5) {
                        this.game.ui.showMessage(`Hacking node available: ${interactable.name}`, 'normal');
                    }
                }
            }
        }
    }

    /**
     * Finds a node by type
     */
    findNodeByType(nodeType) {
        return this.game.interactables.interactables.find(
            n => n.type === nodeType && n.state === 'success'
        );
    }

    /**
     * Evaluates a condition
     */
    evaluateCondition(condition) {
        if (!condition) return true;

        // Simple condition evaluation
        if (condition.type === 'district_type') {
            const district = this.game.map.getDistrictAt(
                this.game.state.player.x,
                this.game.state.player.y
            );
            return district && district.theme === condition.value;
        }

        if (condition.type === 'has_clue') {
            return this.hasClue(condition.clueId);
        }

        if (condition.type === 'quest_completed') {
            return this.getQuestById(condition.questId)?.status === 'completed';
        }

        return true; // Default to true if unknown condition
    }

    /**
     * Checks if player has a specific clue
     */
    hasClue(clueId) {
        for (const quest of [...this.activeQuests, ...this.completedQuests]) {
            if (quest.data.clues.find(c => c.id === clueId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Applies an effect string (e.g., "gains_clue:witness_account")
     */
    applyEffect(effect, quest) {
        if (typeof effect !== 'string') return;

        if (effect.startsWith('gains_clue:')) {
            const clueId = effect.split(':')[1];
            quest.data.clues.push({
                id: clueId,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Applies an outcome
     */
    applyOutcome(outcome) {
        // Apply district modifiers
        if (outcome.effect) {
            if (Array.isArray(outcome.effect)) {
                for (const mod of outcome.effect) {
                    this.applyDistrictModifier(mod);
                }
            } else if (typeof outcome.effect === 'object') {
                // Apply numeric modifiers
                for (const [key, value] of Object.entries(outcome.effect)) {
                    if (key.startsWith('district_')) {
                        this.applyDistrictModifier(key, value);
                    }
                }
            }
        }

        // Apply faction impacts
        if (outcome.factionImpact) {
            // Update faction reputation
            for (const [faction, impact] of Object.entries(outcome.factionImpact)) {
                this.applyFactionImpact(faction, impact);
            }
        }
    }

    /**
     * Applies a district modifier
     */
    applyDistrictModifier(modifier, value) {
        // Parse modifier string
        let districtId = 0; // Default to current district
        let modifierName = modifier;
        let modifierValue = value;

        if (typeof modifier === 'string') {
            // Handle "district_name_value" format
            const parts = modifier.split('_');
            if (parts.length >= 3) {
                modifierName = parts[2]; // e.g., "stability" from "district_residential_stability_down"
                modifierValue = -0.1; // Default decrement
                if (parts[3] === 'up') modifierValue = 0.1;
                if (parts[3] === 'down') modifierValue = -0.1;
            }
        }

        // Apply to districts
        const districts = this.game.map.districts || [];
        if (districtId < districts.length) {
            const district = districts[districtId];
            if (district.modifiers === undefined) district.modifiers = [];

            // Check if modifier already exists
            const existing = district.modifiers.find(m => m.name === modifierName);
            if (existing) {
                existing.value = (existing.value || 0) + modifierValue;
            } else {
                district.modifiers.push({
                    name: modifierName,
                    value: modifierValue,
                    appliedAt: Date.now()
                });
            }
        }
    }

    /**
     * Applies a faction impact
     */
    applyFactionImpact(faction, impact) {
        // This would update faction reputation in a full implementation
        // For now, just log it
        console.log(`Faction impact: ${faction} ${impact > 0 ? '+' : ''}${impact}`);
    }

    /**
     * Updates all quests (called each tick)
     */
    update() {
        for (const quest of this.activeQuests) {
            // Try to auto-advance quests
            const currentStep = quest.steps[quest.currentStepIndex];

            if (currentStep && currentStep.autoAdvance && currentStep.autoAdvance > 0) {
                quest.autoAdvanceTimer = (quest.autoAdvanceTimer || 0) + 1;
                if (quest.autoAdvanceTimer >= currentStep.autoAdvance) {
                    this.advanceQuest(quest);
                    quest.autoAdvanceTimer = 0;
                }
            }

            // Check for blocked quests
            if (quest.steps[quest.currentStepIndex] &&
                !this.canCompleteStep(quest, quest.steps[quest.currentStepIndex])) {
                if (quest.status !== 'blocked') {
                    quest.status = 'blocked';
                    quest.blockedReason = 'Waiting for player action';
                    eventBus.emit('quest_blocked', {
                        questId: quest.id,
                        reason: quest.blockedReason,
                        tick: Date.now()
                    });
                }
            } else if (quest.status === 'blocked') {
                quest.status = 'active';
                quest.blockedReason = null;
            }
        }
    }

    /**
     * Checks if a step can be completed
     */
    canCompleteStep(quest, step) {
        switch (step.kind) {
            case STEP_KINDS.TRIGGER:
                return quest.data.triggers && quest.data.triggers[step.trigger];
            case STEP_KINDS.HACK_NODE:
                return this.findNodeByType(step.nodeType) !== undefined;
            case STEP_KINDS.GO_TO:
                return step.targetX !== undefined && step.targetY !== undefined;
            case STEP_KINDS.CHOICE:
                return quest.data.choices && quest.data.choices.length > 0;
            case STEP_KINDS.INVESTIGATE:
            case STEP_KINDS.INTERACT:
                return true; // Can always attempt
            case STEP_KINDS.OUTCOME:
                return true; // Can always apply
            default:
                return true;
        }
    }

    /**
     * Returns quests filtered by status
     */
    getQuestsByStatus(status) {
        return status === 'active'
            ? this.activeQuests
            : this.completedQuests;
    }

    /**
     * Serializes quest state for save
     */
    serialize() {
        return {
            activeQuests: this.activeQuests.map(q => ({
                id: q.id,
                status: q.status,
                currentStepIndex: q.currentStepIndex,
                completedSteps: q.completedSteps,
                data: q.data
            })),
            completedQuests: this.completedQuests.map(q => ({
                id: q.id,
                outcome: q.data.outcome
            }))
        };
    }

    /**
     * Restores quest state from save
     */
    deserialize(data) {
        if (!data) return;

        // Restore active quests
        this.activeQuests = data.activeQuests.map(qData => {
            // Find original quest definition
            const questDef = this.game.content.quests.find(q => q.id === qData.id);
            if (!questDef) return null;

            const quest = createQuestInstance(questDef);
            quest.status = qData.status;
            quest.currentStepIndex = qData.currentStepIndex;
            quest.completedSteps = qData.completedSteps;
            quest.data = qData.data;
            quest.lastUpdated = Date.now();
            return quest;
        }).filter(q => q !== null);

        // Restore completed quests
        this.completedQuests = data.completedQuests.map(qData => {
            const questDef = this.game.content.quests.find(q => q.id === qData.id);
            if (!questDef) return null;

            const quest = createQuestInstance(questDef);
            quest.status = 'completed';
            quest.currentStepIndex = quest.steps.length;
            quest.data.outcome = qData.outcome;
            return quest;
        }).filter(q => q !== null);
    }

    /**
     * Cleans up quest state (called on new game)
     */
    reset() {
        this.activeQuests = [];
        this.completedQuests = [];
    }
}