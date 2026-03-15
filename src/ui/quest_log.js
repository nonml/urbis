// Quest Log UI - delegates rendering to QuestLog.svelte
import { eventBus } from '../sim/events.js';
import { questLogStore } from '../stores/quest_log.js';

export class QuestLogUI {
    constructor(game) {
        this.game = game;
        this.isPanelOpen = false;

        this.game.ui?.onKey?.('J', () => this.togglePanel());

        eventBus.on('quest_started',       (d) => this._onQuestStarted(d), this);
        eventBus.on('quest_step_completed',(d) => this._syncQuest(d.questId), this);
        eventBus.on('quest_completed',     (d) => this._syncQuest(d.questId), this);
        eventBus.on('quest_blocked',       (d) => this._syncQuest(d.questId), this);
        eventBus.on('clue_discovered',     ()  => this._syncAll(), this);
    }

    togglePanel(forceOpen = null) {
        this.isPanelOpen = forceOpen !== null ? forceOpen : !this.isPanelOpen;
        questLogStore.update(s => ({ ...s, open: this.isPanelOpen }));
        if (this.isPanelOpen) this._syncAll();
    }

    hide() { this.togglePanel(false); }

    _onQuestStarted({ questId }) {
        this._syncAll();
        questLogStore.update(s => s.selectedId ? s : { ...s, selectedId: questId });
    }

    _syncQuest(questId) {
        this._syncAll();
    }

    _syncAll() {
        const engine = this.game.questEngine;
        if (!engine) return;
        const activeIds = engine.getActiveQuestIds?.() ?? [];
        const quests = activeIds.map(id => this._buildQuestData(engine.getQuestById(id))).filter(Boolean);
        questLogStore.update(s => ({ ...s, quests }));
    }

    _buildQuestData(quest) {
        if (!quest) return null;
        const totalSteps     = quest.steps?.length ?? 0;
        const completedSteps = quest.completedSteps?.length ?? 0;
        const progress       = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
        const currentStep    = quest.steps?.[quest.currentStepIndex];
        const waypoint       = currentStep?.kind === 'go_to' ? { target: currentStep.marker || 'Location', distance: '?' } : null;
        return {
            id:             quest.id,
            title:          quest.title,
            description:    quest.description || '',
            status:         quest.status,
            progress,
            totalSteps,
            completedSteps,
            currentStep:    currentStep?.text || (currentStep ? `Step ${quest.currentStepIndex + 1}` : null),
            clues:          quest.data?.clues ?? [],
            waypoint,
        };
    }

    markCurrentComplete(questId) {
        const quest = this.game.questEngine?.getQuestById(questId);
        if (!quest) return;
        quest.status = 'completed';
        quest.currentStepIndex = quest.steps?.length ?? 0;
        eventBus.emit('quest_completed', { questId: quest.id, outcome: 'manual_complete', tick: Date.now() });
        this._syncAll();
    }

    cancelQuest(questId) {
        const quest = this.game.questEngine?.getQuestById(questId);
        if (quest) {
            quest.status = 'failed';
            eventBus.emit('quest_failed', { questId: quest.id, reason: 'Cancelled by player', tick: Date.now() });
        }
        this._syncAll();
        questLogStore.update(s => ({ ...s, selectedId: null }));
    }

    render() {}

    // Legacy compat
    addQuest()    {}
    selectQuest() {}
    addEvidence() {}
    createElements() {}
    setupEventListeners() {}
}

export function createQuestLogUI(game) { return new QuestLogUI(game); }
