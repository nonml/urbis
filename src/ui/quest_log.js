// Quest Log UI - Shows active quests, objectives, and progress
import { eventBus, Events } from '../sim/events.js';

/**
 * Quest Log UI class
 */
export class QuestLogUI {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.activeQuests = [];
        this.selectedQuestId = null;
        this.isPanelOpen = false;

        // Create DOM elements
        this.createElements();
        this.setupEventListeners();
    }

    /**
     * Create DOM elements for quest log
     */
    createElements() {
        // Quest log container (hidden by default)
        this.container = document.createElement('div');
        this.container.id = 'quest-log';
        this.container.className = 'quest-log-panel';
        this.container.innerHTML = `
            <div class="quest-log-header">
                <h2>Quest Log</h2>
                <button class="quest-log-close" id="quest-log-close">&times;</button>
            </div>
            <div class="quest-log-content">
                <div class="quest-list">
                    <h3>Active Cases</h3>
                    <div id="quest-list-items"></div>
                </div>
                <div class="quest-details">
                    <h3 id="quest-details-title">Select a Case</h3>
                    <p id="quest-details-desc" class="quest-desc"></p>
                    <div id="quest-objectives">
                        <h4>Current Objectives</h4>
                        <ul id="quest-objectives-list"></ul>
                    </div>
                    <div id="quest-progress" class="quest-progress">
                        <div class="quest-progress-bar">
                            <div class="quest-progress-fill"></div>
                        </div>
                        <span class="quest-progress-text"></span>
                    </div>
                    <div id="quest-evidence" class="quest-evidence">
                        <h4>Evidence Collected</h4>
                        <ul id="quest-evidence-list"></ul>
                    </div>
                    <div id="quest-waypoint" class="quest-waypoint">
                        <p>Next destination: <span id="waypoint-target"></span></p>
                        <p>Distance: <span id="waypoint-distance"></span> tiles</p>
                    </div>
                </div>
            </div>
            <div class="quest-log-footer">
                <button id="quest-mark-complete" disabled>Mark Complete</button>
                <button id="quest-cancel" disabled>Cancel Quest</button>
            </div>
        `;

        document.body.appendChild(this.container);

        // Setup close button
        const closeBtn = this.container.querySelector('#quest-log-close');
        closeBtn.addEventListener('click', () => this.togglePanel(false));

        // Setup marker buttons
        this.container.querySelector('#quest-mark-complete').addEventListener('click', () => this.markCurrentComplete());
        this.container.querySelector('#quest-cancel').addEventListener('click', () => this.cancelCurrentQuest());
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Toggle with 'J' key
        this.game.ui.onKey('J', () => this.togglePanel());

        // Quest-related events
        eventBus.on('quest_started', (data) => this.addQuest(data.questId, data.questTitle), this);
        eventBus.on('quest_step_completed', (data) => this.updateQuestProgress(data.questId), this);
        eventBus.on('quest_completed', (data) => this.markQuestCompleted(data.questId), this);
        eventBus.on('quest_blocked', (data) => this.updateQuestStatus(data.questId, data.reason), this);
        eventBus.on('clue_discovered', (data) => this.addEvidence(data.clue), this);
    }

    /**
     * Toggle quest log panel
     */
    togglePanel(forceOpen = null) {
        this.isPanelOpen = forceOpen !== null ? forceOpen : !this.isPanelOpen;

        if (this.isPanelOpen) {
            this.container.style.display = 'block';
            this.updateAllQuests();
        } else {
            this.container.style.display = 'none';
        }
    }

    /**
     * Add a quest to the log
     */
    addQuest(questId, questTitle) {
        const quest = this.game.questEngine.getQuestById(questId);
        if (!quest) return;

        this.activeQuests.push(questId);

        // Add to list
        const list = this.container.querySelector('#quest-list-items');
        const item = document.createElement('div');
        item.className = 'quest-list-item';
        item.id = `quest-item-${questId}`;
        item.innerHTML = `
            <span class="quest-title">${questTitle}</span>
            <span class="quest-status">In Progress</span>
        `;
        item.addEventListener('click', () => this.selectQuest(questId));

        list.appendChild(item);

        // Auto-select if no quest selected
        if (!this.selectedQuestId) {
            this.selectQuest(questId);
        }

        this.updateQuestProgress(questId);
    }

    /**
     * Select a quest to view details
     */
    selectQuest(questId) {
        this.selectedQuestId = questId;
        const quest = this.game.questEngine.getQuestById(questId);

        if (!quest) return;

        // Update title and description
        this.container.querySelector('#quest-details-title').textContent = quest.title;
        this.container.querySelector('#quest-details-desc').textContent = quest.description || '';

        // Update objectives list
        const objectivesList = this.container.querySelector('#quest-objectives-list');
        objectivesList.innerHTML = '';

        const currentStep = quest.steps[quest.currentStepIndex] || quest.steps[quest.steps.length - 1];
        if (currentStep) {
            const li = document.createElement('li');
            li.textContent = currentStep.text || `Step ${quest.currentStepIndex + 1}`;
            objectivesList.appendChild(li);
        }

        // Update evidence list
        const evidenceList = this.container.querySelector('#quest-evidence-list');
        evidenceList.innerHTML = '';

        if (quest.data.clues && quest.data.clues.length > 0) {
            for (const clue of quest.data.clues) {
                const li = document.createElement('li');
                li.textContent = clue.id.replace('_', ' ').toUpperCase();
                evidenceList.appendChild(li);
            }
        }

        // Update waypoint
        if (currentStep && currentStep.kind === 'go_to') {
            const targetName = currentStep.marker || 'Location';
            this.container.querySelector('#waypoint-target').textContent = targetName;
            this.container.querySelector('#waypoint-distance').textContent = '?';
        } else {
            this.container.querySelector('#waypoint-target').textContent = 'No destination';
            this.container.querySelector('#waypoint-distance').textContent = 'N/A';
        }

        // Update progress bar
        this.updateQuestProgress(questId);

        // Enable buttons
        this.container.querySelector('#quest-mark-complete').disabled = false;
        this.container.querySelector('#quest-cancel').disabled = false;
    }

    /**
     * Update quest progress display
     */
    updateQuestProgress(questId) {
        if (questId !== this.selectedQuestId && this.activeQuests.length > 0) return;

        const quest = this.game.questEngine.getQuestById(questId);
        if (!quest) return;

        // Update status in list
        const listItem = this.container.querySelector(`#quest-item-${questId}`);
        if (listItem) {
            listItem.querySelector('.quest-status').textContent = quest.status === 'blocked' ? 'Blocked' : 'In Progress';
        }

        // Update progress bar
        const totalSteps = quest.steps.length;
        const completedSteps = quest.completedSteps.length;
        const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

        const progressBar = this.container.querySelector('.quest-progress-fill');
        progressBar.style.width = `${progress}%`;

        const progressText = this.container.querySelector('.quest-progress-text');
        progressText.textContent = `${completedSteps} / ${totalSteps} steps`;

        // Update blocked status
        if (quest.status === 'blocked') {
            const blockReason = this.container.querySelector('.quest-details');
            blockReason.classList.add('quest-blocked');
            blockReason.title = quest.blockedReason || 'Waiting for player action';
        }
    }

    /**
     * Update quest status
     */
    updateQuestStatus(questId, reason) {
        const listItem = this.container.querySelector(`#quest-item-${questId}`);
        if (listItem) {
            listItem.querySelector('.quest-status').textContent = 'Blocked';
            if (this.selectedQuestId === questId) {
                this.updateQuestProgress(questId);
            }
        }
    }

    /**
     * Mark quest as complete
     */
    markCurrentComplete() {
        if (!this.selectedQuestId) return;

        const quest = this.game.questEngine.getQuestById(this.selectedQuestId);
        if (quest) {
            quest.status = 'completed';
            quest.currentStepIndex = quest.steps.length;
            eventBus.emit('quest_completed', {
                questId: quest.id,
                outcome: 'manual_complete',
                tick: Date.now()
            });
            this.markQuestCompleted(this.selectedQuestId);
        }
    }

    /**
     * Mark quest as completed (from engine)
     */
    markQuestCompleted(questId) {
        const listItem = this.container.querySelector(`#quest-item-${questId}`);
        if (listItem) {
            listItem.querySelector('.quest-status').textContent = 'Completed';
            listItem.classList.add('quest-completed');
        }

        if (this.selectedQuestId === questId) {
            this.container.querySelector('#quest-details-title').textContent += ' (COMPLETED)';
            const fill = this.container.querySelector('.quest-progress-fill');
            if (fill) fill.style.width = '100%';
            this.container.querySelector('#quest-mark-complete').disabled = true;
        }
    }

    /**
     * Cancel current quest
     */
    cancelCurrentQuest() {
        if (!this.selectedQuestId) return;

        const quest = this.game.questEngine.getQuestById(this.selectedQuestId);
        if (quest) {
            quest.status = 'failed';
            eventBus.emit('quest_failed', {
                questId: quest.id,
                reason: 'Cancelled by player',
                tick: Date.now()
            });
        }

        // Remove from UI
        const listItem = this.container.querySelector(`#quest-item-${this.selectedQuestId}`);
        if (listItem) {
            listItem.remove();
        }

        this.activeQuests = this.activeQuests.filter(id => id !== this.selectedQuestId);
        this.selectedQuestId = null;

        this.container.querySelector('#quest-details-title').textContent = 'Select a Case';
        this.container.querySelector('#quest-details-desc').textContent = '';
        this.container.querySelector('#quest-objectives-list').innerHTML = '';
        this.container.querySelector('#quest-evidence-list').innerHTML = '';
        this.container.querySelector('#quest-mark-complete').disabled = true;
        this.container.querySelector('#quest-cancel').disabled = true;
    }

    /**
     * Add evidence to current quest
     */
    addEvidence(clue) {
        const questId = this.selectedQuestId;
        if (questId) {
            const evidenceList = this.container.querySelector('#quest-evidence-list');
            const li = document.createElement('li');
            li.textContent = clue.id.replace('_', ' ').toUpperCase();
            evidenceList.appendChild(li);
        }
    }

    /**
     * Update all quests in the log
     */
    updateAllQuests() {
        for (const questId of this.activeQuests) {
            this.updateQuestProgress(questId);
        }

        if (this.selectedQuestId) {
            this.selectQuest(this.selectedQuestId);
        }
    }

    /**
     * Render method (called each frame)
     */
    render(dt) {
        // Update waypoint distance if needed
        if (this.isPanelOpen && this.selectedQuestId) {
            const quest = this.game.questEngine.getQuestById(this.selectedQuestId);
            if (quest) {
                const currentStep = quest.steps[quest.currentStepIndex];
                if (currentStep && currentStep.kind === 'go_to' && currentStep.targetX !== undefined) {
                    const playerX = this.game.state.player.x;
                    const playerY = this.game.state.player.y;
                    const dist = Math.abs(playerX - currentStep.targetX) + Math.abs(playerY - currentStep.targetY);
                    this.container.querySelector('#waypoint-distance').textContent = dist;
                }
            }
        }
    }

    /**
     * Hide panel
     */
    hide() {
        this.container.style.display = 'none';
        this.isPanelOpen = false;
    }
}

/**
 * Create quest log UI helper
 */
export function createQuestLogUI(game) {
    return new QuestLogUI(game);
}
