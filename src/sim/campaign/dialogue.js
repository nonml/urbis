// Dialogue System - Manages narrative choices and player responses
// Integrates with Quest Engine for in-quest dialogue

import { eventBus, EVENT_TYPES } from '../events.js';
import { randomId } from '../../rng.js';

/**
 * Dialogue manager for case-driven narrative choices
 */
export class DialogueManager {
    constructor(game) {
        this.game = game;
        this.activeDialogue = null;
        this.dialogueHistory = [];
        this.pendingChoices = [];
        this.setupListeners();
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        eventBus.on(EVENT_TYPES.QUEST_STEP_COMPLETED, (data) => {
            this.checkDialogueTrigger(data.questId, data.stepId);
        }, this);
    }

    /**
     * Check if a step completion triggers dialogue
     * @param {string} questId - Quest ID
     * @param {string} stepId - Completed step ID
     */
    checkDialogueTrigger(questId, stepId) {
        const quest = this.game.questEngine.getQuestById(questId);
        if (!quest) return;

        const completedStep = quest.steps.find(s => s.id === stepId);
        if (!completedStep?.dialogue) return;

        // Start the dialogue
        this.startDialogue(questId, completedStep.dialogue);
    }

    /**
     * Start a new dialogue sequence
     * @param {string} questId - Associated quest ID
     * @param {Object} dialogueDef - Dialogue definition
     */
    startDialogue(questId, dialogueDef) {
        const dialogue = {
            id: randomId('dialogue'),
            questId: questId,
            type: dialogueDef.type || 'narrative',
            speaker: dialogueDef.speaker || 'narrator',
            text: dialogueDef.text || '',
            choices: dialogueDef.choices || [],
            timestamp: Date.now(),
            completed: false,
            selectedChoice: null,
        };

        this.activeDialogue = dialogue;
        this.dialogueHistory.push(dialogue);

        // If choices present, show UI prompt
        if (dialogue.choices?.length > 0) {
            this.showChoicePrompt(dialogue);
        } else {
            // No choices - auto complete
            dialogue.completed = true;
            this.game.ui?.showMessage?.(`Narrative: ${dialogue.text}`, 'normal');
        }

        eventBus.emit(EVENT_TYPES.CAMPAIGN_DIALOGUE_STARTED, {
            dialogueId: dialogue.id,
            questId: questId,
            type: dialogue.type,
            tick: this.game.state.time?.tick || 0,
        });
    }

    /**
     * Show choice prompt UI
     * @param {Object} dialogue - Dialogue object with choices
     */
    showChoicePrompt(dialogue) {
        if (!this.game.ui?.showQuestChoice) return;

        // Convert dialogue choices to quest choice format
        const choices = dialogue.choices.map((choice, index) => ({
            id: choice.id || `choice_${index}`,
            label: choice.label || 'Choose',
            description: choice.description || '',
            heatDelta: Number(choice.heatDelta) || 0,
            reputationDelta: Number(choice.reputationDelta) || 0,
            effect: choice.effect || null,
        }));

        this.game.ui.showQuestChoice(
            dialogue.text || 'Choose your response',
            choices,
            (choice) => {
                this.resolveChoice(dialogue, choice);
            }
        );
    }

    /**
     * Resolve a choice selection
     * @param {Object} dialogue - Dialogue object
     * @param {Object} choice - Selected choice
     */
    resolveChoice(dialogue, choice) {
        dialogue.selectedChoice = choice.id;
        dialogue.completed = true;

        // Apply choice effects
        this.applyChoiceEffects(choice, dialogue);

        // Log choice
        console.log(`Dialogue choice: ${choice.label} (dialogue: ${dialogue.id})`);

        // Emit event
        eventBus.emit(EVENT_TYPES.CAMPAIGN_DIALOGUE_RESOLVED, {
            dialogueId: dialogue.id,
            choiceId: choice.id,
            tick: this.game.state.time?.tick || 0,
        });

        // Clear active dialogue
        this.activeDialogue = null;
    }

    /**
     * Apply choice effects
     * @param {Object} choice - Selected choice
     * @param {Object} dialogue - Dialogue object
     */
    applyChoiceEffects(choice, dialogue) {
        // Heat changes
        if (Number.isFinite(choice.heatDelta)) {
            this.game.heatSystem?.addHeat(choice.heatDelta);
        }

        // Reputation changes
        if (Number.isFinite(choice.reputationDelta)) {
            const prev = this.game.state.player.reputation || 0;
            this.game.state.player.reputation = Math.max(0, Math.min(100, prev + choice.reputationDelta));
        }

        // Effect effects (quest flags, clues, etc.)
        if (choice.effect) {
            this.applyEffect(choice.effect, dialogue.questId);
        }

        // Set flags if provided
        if (choice.setFlags) {
            const flags = this.game.state.progress?.runFlags || (this.game.state.progress.runFlags = {});
            for (const [key, value] of Object.entries(choice.setFlags)) {
                flags[key] = value;
            }
        }
    }

    /**
     * Apply an effect string
     * @param {string|Array} effect - Effect definition
     * @param {string} questId - Quest ID
     */
    applyEffect(effect, questId) {
        if (!effect) return;

        if (Array.isArray(effect)) {
            for (const e of effect) this.applyEffect(e, questId);
            return;
        }

        const quest = this.game.questEngine.getQuestById(questId);
        if (!quest) return;

        // Gains clue
        if (effect.startsWith('gains_clue:')) {
            const clueId = effect.split(':')[1];
            if (!quest.data.clues.find(c => c.id === clueId)) {
                quest.data.clues.push({ id: clueId, timestamp: Date.now() });
                this.game.evidenceSystem?.registerClueEvidence?.(quest, clueId);
                eventBus.emit(EVENT_TYPES.CLUE_DISCOVERED, { questId, clue: { id: clueId } });
            }
        }

        // Set flag
        if (effect.startsWith('set_flag:')) {
            const key = effect.split(':')[1];
            if (key) {
                const flags = this.game.state.progress?.runFlags || (this.game.state.progress.runFlags = {});
                flags[key] = true;
            }
        }

        // Reputation change
        if (effect === 'reputation_high') {
            this.game.state.player.reputation = Math.min(100, (this.game.state.player.reputation || 0) + 10);
        }
        if (effect === 'reputation_lost') {
            this.game.state.player.reputation = Math.max(0, (this.game.state.player.reputation || 0) - 10);
        }

        // Heat change
        if (effect === 'heat_rival_high') {
            this.game.heatSystem?.addHeat(8);
        }
        if (effect === 'heat_rival_low') {
            this.game.heatSystem?.addHeat(-6);
        }
    }

    /**
     * Cancel active dialogue
     */
    cancelDialogue() {
        if (!this.activeDialogue) return;

        this.activeDialogue.completed = true;
        this.activeDialogue.selectedChoice = null;

        eventBus.emit(EVENT_TYPES.CAMPAIGN_DIALOGUE_CANCELLED, {
            dialogueId: this.activeDialogue.id,
            tick: this.game.state.time?.tick || 0,
        });

        this.activeDialogue = null;
    }

    /**
     * Get active dialogue
     * @returns {Object|null} Active dialogue or null
     */
    getActiveDialogue() {
        return this.activeDialogue;
    }

    /**
     * Get dialogue history for a quest
     * @param {string} questId - Quest ID
     * @returns {Array} Dialogue entries
     */
    getDialogueHistory(questId) {
        return this.dialogueHistory.filter(d => d.questId === questId);
    }

    /**
     * Get all dialogue history
     * @returns {Array} All dialogue entries
     */
    getAllDialogueHistory() {
        return this.dialogueHistory;
    }

    /**
     * Check if dialogue is active
     * @returns {boolean}
     */
    isDialogueActive() {
        return this.activeDialogue !== null;
    }

    /**
     * Update method for periodic checks
     */
    update() {
        if (!this.activeDialogue || this.activeDialogue.completed) return;

        // Auto-complete if no choices and has text
        if (!this.activeDialogue.choices?.length && this.activeDialogue.text) {
            this.activeDialogue.completed = true;
            this.activeDialogue = null;
        }
    }

    /**
     * Serialize dialogue state
     * @returns {Object} Serialized state
     */
    serialize() {
        return {
            activeDialogueId: this.activeDialogue?.id || null,
            dialogueHistory: this.dialogueHistory.map(d => ({
                id: d.id,
                questId: d.questId,
                type: d.type,
                speaker: d.speaker,
                text: d.text,
                choices: d.choices || [],
                selectedChoice: d.selectedChoice,
                completed: d.completed,
                timestamp: d.timestamp,
            })),
        };
    }

    /**
     * Deserialize dialogue state
     * @param {Object} data - Serialized state
     */
    deserialize(data) {
        if (!data) return;

        this.dialogueHistory = data.dialogueHistory || [];

        // Restore active dialogue if still valid
        if (data.activeDialogueId) {
            this.activeDialogue = this.dialogueHistory.find(d => d.id === data.activeDialogueId);
        }
    }

    /**
     * Reset dialogue state
     */
    reset() {
        this.activeDialogue = null;
        this.dialogueHistory = [];
    }
}