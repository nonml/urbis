// Campaign model - Manages case progression, dialogue, and narrative structure
import { eventBus, EVENT_TYPES } from '../events.js';

/**
 * Campaign state management for case-driven narrative progression
 */
export class CampaignModel {
    constructor(game) {
        this.game = game;
        this.cases = [];
        this.activeCase = null;
        this.dialogueHistory = [];
        this.briefings = [];
        this.setupListeners();
    }

    /**
     * Initialize campaign state
     */
    ensureState() {
        if (!this.game.state.campaign) {
            this.game.state.campaign = {
                cases: [],
                activeCaseId: null,
                briefingCount: 0,
                lastBriefingTick: 0,
                dialogueHistory: [],
            };
        }
        this.cases = this.game.state.campaign.cases || [];
        this.activeCaseId = this.game.state.campaign.activeCaseId || null;
        this.dialogueHistory = this.game.state.campaign.dialogueHistory || [];
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        eventBus.on(EVENT_TYPES.QUEST_COMPLETED, (data) => {
            this.onQuestCompleted(data.questId);
        }, this);

        eventBus.on(EVENT_TYPES.QUEST_STEP_COMPLETED, (data) => {
            this.onQuestStepCompleted(data.questId, data.stepId);
        }, this);
    }

    /**
     * Start a new case
     * @param {Object} caseData - Case definition data
     * @returns {Object} Started case
     */
    startCase(caseData) {
        this.ensureState();

        const caseObj = {
            id: caseData.id || `case_${Date.now()}`,
            type: caseData.type || 'investigation',
            title: caseData.title || 'Case',
            description: caseData.description || '',
            status: 'active',
            currentChapter: 0,
            chapters: caseData.chapters || [],
            questIds: [],
            clues: [],
            evidence: [],
            createdTick: this.game.state.time?.tick || 0,
            createdAt: Date.now(),
        };

        this.cases.push(caseObj);
        this.activeCaseId = caseObj.id;
        this.game.state.campaign.cases = this.cases;
        this.game.state.campaign.activeCaseId = caseObj.id;

        // Generate initial briefing
        this.generateBriefing(caseObj, 'case_started');

        // Auto-advance if trigger present
        if (caseObj.chapters[0]?.trigger) {
            this.triggerChapter(caseObj, 0);
        }

        eventBus.emit(EVENT_TYPES.CAMPAIGN_CASE_STARTED, {
            caseId: caseObj.id,
            caseType: caseObj.type,
            tick: this.game.state.time?.tick || 0,
        });

        return caseObj;
    }

    /**
     * Trigger a specific chapter
     * @param {Object} caseObj - Case object
     * @param {number} chapterIndex - Chapter index to trigger
     */
    triggerChapter(caseObj, chapterIndex) {
        const chapter = caseObj.chapters[chapterIndex];
        if (!chapter) return;

        const questDef = {
            id: chapter.id || `${caseObj.id}_chapter_${chapterIndex}`,
            type: 'case_chapter',
            title: chapter.title || `Chapter ${chapterIndex + 1}`,
            description: chapter.description || '',
            steps: chapter.steps || [],
            rewards: chapter.rewards || [],
        };

        const quest = this.game.questEngine.addQuest(questDef, {
            caseId: caseObj.id,
            caseType: caseObj.type,
        });

        caseObj.questIds.push(quest.id);

        // Generate briefing for chapter start
        this.generateBriefing(caseObj, 'chapter_started', {
            chapterIndex,
            chapterTitle: chapter.title,
        });

        caseObj.currentChapter = chapterIndex;
    }

    /**
     * Handle quest completion
     * @param {string} questId - Completed quest ID
     */
    onQuestCompleted(questId) {
        this.ensureState();

        // Find the case associated with this quest
        for (const caseObj of this.cases) {
            if (caseObj.questIds.includes(questId)) {
                this.advanceCaseChapter(caseObj);
                break;
            }
        }
    }

    /**
     * Handle quest step completion for dialogue triggers
     * @param {string} questId - Quest ID
     * @param {string} stepId - Completed step ID
     */
    onQuestStepCompleted(questId, stepId) {
        this.ensureState();

        // Check for dialogue triggers in completed steps
        for (const caseObj of this.cases) {
            if (caseObj.questIds.includes(questId)) {
                const quest = this.game.questEngine.getQuestById(questId);
                const step = quest?.steps?.find(s => s.id === stepId);
                if (step?.dialogue) {
                    this.triggerDialogue(caseObj, step.dialogue);
                }
                break;
            }
        }
    }

    /**
     * Advance to next chapter if current is complete
     * @param {Object} caseObj - Case object
     */
    advanceCaseChapter(caseObj) {
        const currentChapter = caseObj.currentChapter || 0;

        // Check if all chapters completed
        if (currentChapter >= (caseObj.chapters?.length || 0) - 1) {
            this.completeCase(caseObj);
            return;
        }

        // Start next chapter
        const nextChapter = currentChapter + 1;
        this.triggerChapter(caseObj, nextChapter);

        // Generate briefing for chapter advancement
        this.generateBriefing(caseObj, 'chapter_completed', {
            previousChapter: currentChapter,
            newChapter: nextChapter,
        });
    }

    /**
     * Complete a case
     * @param {Object} caseObj - Case object
     */
    completeCase(caseObj) {
        caseObj.status = 'completed';
        caseObj.completedTick = this.game.state.time?.tick || 0;

        eventBus.emit(EVENT_TYPES.CAMPAIGN_CASE_COMPLETED, {
            caseId: caseObj.id,
            caseType: caseObj.type,
            tick: caseObj.completedTick,
        });

        // Update active case if this was the active one
        if (this.activeCaseId === caseObj.id) {
            this.activeCaseId = null;
            this.game.state.campaign.activeCaseId = null;
        }

        // Generate final briefing
        this.generateBriefing(caseObj, 'case_completed');
    }

    /**
     * Generate a briefing entry
     * @param {Object} caseObj - Case object
     * @param {string} event - Briefing event type
     * @param {Object} details - Additional details
     */
    generateBriefing(caseObj, event, details = {}) {
        const briefing = {
            id: `briefing_${this.game.state.campaign.briefingCount++}`,
            caseId: caseObj.id,
            caseTitle: caseObj.title,
            event: event,
            timestamp: Date.now(),
            tick: this.game.state.time?.tick || 0,
            details: details,
        };

        this.briefings.unshift(briefing);
        this.game.state.campaign.briefingCount = this.game.state.campaign.briefingCount || 0;

        // Keep only last 50 briefings
        if (this.briefings.length > 50) {
            this.briefings = this.briefings.slice(0, 50);
        }

        eventBus.emit(EVENT_TYPES.CAMPAIGN_BRIEFING_GENERATED, {
            briefingId: briefing.id,
            event: event,
            tick: briefing.tick,
        });
    }

    /**
     * Trigger dialogue for a case
     * @param {Object} caseObj - Case object
     * @param {Object|string} dialogue - Dialogue definition or text
     */
    triggerDialogue(caseObj, dialogue) {
        const dialogueEntry = {
            id: `dialogue_${Date.now()}`,
            caseId: caseObj.id,
            type: typeof dialogue === 'string' ? 'text' : dialogue.type || 'text',
            text: typeof dialogue === 'string' ? dialogue : dialogue.text || '',
            speaker: dialogue?.speaker || 'narrator',
            choices: dialogue?.choices || [],
            timestamp: Date.now(),
            completed: false,
        };

        this.dialogueHistory.push(dialogueEntry);

        // If choices provided, show UI prompt
        if (dialogueEntry.choices?.length > 0) {
            this.showDialogueChoices(dialogueEntry);
        } else {
            dialogueEntry.completed = true;
        }

        eventBus.emit(EVENT_TYPES.CAMPAIGN_DIALOGUE_TRIGGERED, {
            dialogueId: dialogueEntry.id,
            caseId: caseObj.id,
            type: dialogueEntry.type,
        });
    }

    /**
     * Show dialogue choices UI
     * @param {Object} dialogueEntry - Dialogue entry with choices
     */
    showDialogueChoices(dialogueEntry) {
        if (!this.game.ui?.showQuestChoice) return;

        const choices = dialogueEntry.choices.map(c => ({
            id: c.id,
            label: c.label,
            heatDelta: c.heatDelta || 0,
            reputationDelta: c.reputationDelta || 0,
        }));

        this.game.ui.showQuestChoice(
            dialogueEntry.text || 'Choose response',
            choices,
            (choice) => {
                this.handleDialogueChoice(dialogueEntry, choice);
            }
        );
    }

    /**
     * Handle dialogue choice selection
     * @param {Object} dialogueEntry - Dialogue entry
     * @param {Object} choice - Selected choice
     */
    handleDialogueChoice(dialogueEntry, choice) {
        dialogueEntry.selectedChoice = choice.id;
        dialogueEntry.completed = true;

        // Apply choice effects
        if (Number.isFinite(choice.heatDelta)) {
            this.game.heatSystem?.addHeat(choice.heatDelta);
        }
        if (Number.isFinite(choice.reputationDelta)) {
            const prev = this.game.state.player.reputation || 0;
            this.game.state.player.reputation = Math.max(0, Math.min(100, prev + choice.reputationDelta));
        }

        // Record the choice in case history
        const caseObj = this.cases.find(c => c.id === dialogueEntry.caseId);
        if (caseObj) {
            caseObj.dialogueChoices = caseObj.dialogueChoices || [];
            caseObj.dialogueChoices.push({
                dialogueId: dialogueEntry.id,
                choiceId: choice.id,
                timestamp: Date.now(),
            });
        }

        eventBus.emit(EVENT_TYPES.CAMPAIGN_DIALOGUE_CHOICE, {
            dialogueId: dialogueEntry.id,
            choiceId: choice.id,
            tick: this.game.state.time?.tick || 0,
        });
    }

    /**
     * Get active case
     * @returns {Object|null} Active case or null
     */
    getActiveCase() {
        this.ensureState();
        if (!this.activeCaseId) return null;
        return this.cases.find(c => c.id === this.activeCaseId) || null;
    }

    /**
     * Get case by ID
     * @param {string} caseId - Case ID
     * @returns {Object|null} Case object or null
     */
    getCaseById(caseId) {
        this.ensureState();
        return this.cases.find(c => c.id === caseId) || null;
    }

    /**
     * Get all cases by status
     * @param {string} status - Status filter ('active', 'completed')
     * @returns {Object[]} Filtered cases
     */
    getCasesByStatus(status) {
        this.ensureState();
        return this.cases.filter(c => c.status === status);
    }

    /**
     * Get recent briefings
     * @param {number} count - Number of briefings to retrieve
     * @returns {Object[]} Briefings
     */
    getRecentBriefings(count = 10) {
        this.ensureState();
        return this.briefings.slice(0, count);
    }

    /**
     * Get dialogue history for a case
     * @param {string} caseId - Case ID
     * @returns {Object[]} Dialogue entries
     */
    getDialogueHistory(caseId) {
        this.ensureState();
        return this.dialogueHistory.filter(d => d.caseId === caseId);
    }

    /**
     * Update method for periodic checks
     */
    update() {
        this.ensureState();
    }

    /**
     * Serialize campaign state
     * @returns {Object} Serialized state
     */
    serialize() {
        this.ensureState();
        return {
            cases: this.cases.map(c => ({
                id: c.id,
                type: c.type,
                title: c.title,
                status: c.status,
                currentChapter: c.currentChapter,
                questIds: c.questIds || [],
                clues: c.clues || [],
                evidence: c.evidence || [],
                dialogueChoices: c.dialogueChoices || [],
                createdAt: c.createdAt,
                completedTick: c.completedTick,
            })),
            activeCaseId: this.activeCaseId,
            briefingCount: this.game.state.campaign.briefingCount || 0,
            briefingHistory: this.briefings.map(b => ({
                id: b.id,
                caseId: b.caseId,
                event: b.event,
                details: b.details,
                timestamp: b.timestamp,
                tick: b.tick,
            })),
            dialogueHistory: this.dialogueHistory.map(d => ({
                id: d.id,
                caseId: d.caseId,
                type: d.type,
                text: d.text,
                speaker: d.speaker,
                choices: d.choices || [],
                selectedChoice: d.selectedChoice,
                completed: d.completed,
                timestamp: d.timestamp,
            })),
        };
    }

    /**
     * Deserialize campaign state
     * @param {Object} data - Serialized state
     */
    deserialize(data) {
        if (!data) return;

        this.cases = data.cases || [];
        this.activeCaseId = data.activeCaseId || null;
        this.briefings = data.briefingHistory || [];
        this.dialogueHistory = data.dialogueHistory || [];

        if (this.game.state.campaign) {
            this.game.state.campaign.cases = this.cases;
            this.game.state.campaign.activeCaseId = this.activeCaseId;
            this.game.state.campaign.briefingCount = data.briefingCount || this.briefings.length;
        }
    }

    /**
     * Reset campaign state
     */
    reset() {
        this.cases = [];
        this.activeCaseId = null;
        this.dialogueHistory = [];
        this.briefings = [];
        this.game.state.campaign = {
            cases: [],
            activeCaseId: null,
            briefingCount: 0,
            dialogueHistory: [],
        };
    }
}