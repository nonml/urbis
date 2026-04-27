// Tutorial System - Guided first-time user experience
// Uses the quest engine under the hood for maintainability
// Accessible via settings toggle

import { STEP_KINDS, createQuestInstance, QuestEngine } from '../quests/quest_engine.js';
import { createInteractable, INTERACTABLE_TYPES } from '../interactables.js';
import { eventBus } from '../events.js';

// Tutorial steps
const TUTORIAL_STEPS = [
    {
        id: 'move_camera',
        title: 'Explore the City',
        description: 'Use right-click drag to rotate the camera and find a good spot to build.',
        kind: 'go_to',
        targetX: null, // Will be resolved at runtime
        targetY: null,
        autoAdvance: 600
    },
    {
        id: 'place_house',
        title: 'Build a House',
        description: 'Select the House building and place it on the map.',
        kind: 'trigger',
        trigger: 'house_built',
        autoAdvance: true
    },
    {
        id: 'place_job',
        title: 'Build a Job Building',
        description: 'Place a Farm or Lumber Mill to produce resources.',
        kind: 'trigger',
        trigger: 'job_building_built',
        autoAdvance: true
    },
    {
        id: 'handle_crisis',
        title: 'Handle a Crisis',
        description: 'A crisis may appear - select the best response option.',
        kind: 'trigger',
        trigger: 'crisis_handled',
        autoAdvance: true
    },
    {
        id: 'hack_node',
        title: 'Hack a Node',
        description: 'Move near a hacking node and press E to hack it.',
        kind: 'hack_node',
        nodeType: 'POWER_SUBSTATION',
        autoAdvance: true
    },
    {
        id: 'open_quest_log',
        title: 'Open Quest Log',
        description: 'Press M to open the map screen.',
        kind: 'trigger',
        trigger: 'quest_log_opened',
        autoAdvance: true
    },
    {
        id: 'start_main_case',
        title: 'Start the Main Case',
        description: 'Once a case is available, open it in the quest log.',
        kind: 'outcome',
        outcomes: [{
            label: 'Main Case Started',
            effect: ['gains_clue:main_case_started']
        }]
    }
];

/**
 * Tutorial Manager
 */
export class TutorialManager {
    constructor(game) {
        this.game = game;
        this.steps = TUTORIAL_STEPS;
        this.currentStepIndex = 0;
        this.completedSteps = [];
        this.activeQuest = null;
        this.isFirstTime = true;
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for tutorial progression
     */
    setupEventListeners() {
        // Listen for house built
        this.houseBuildHandler = (data) => {
            if (this.activeQuest && !this.completedSteps.includes('place_house')) {
                this.game.questEngine.handleAnomaly('house_built', { type: data.type });
            }
        };

        // Listen for job building built
        this.jobBuildHandler = (data) => {
            const jobBuildings = ['farm', 'lumber-mill', 'market', 'barracks', 'school'];
            if (this.activeQuest && jobBuildings.includes(data.type) &&
                !this.completedSteps.includes('place_job')) {
                this.game.questEngine.handleAnomaly('job_building_built', { type: data.type });
            }
        };

        // Listen for crisis handled
        this.crisisHandler = (data) => {
            if (this.activeQuest && !this.completedSteps.includes('handle_crisis')) {
                this.game.questEngine.handleAnomaly('crisis_handled', { crisis: data.crisis });
            }
        };

        // Listen for quest started
        this.questStartHandler = (data) => {
            if (this.activeQuest && data.questId === this.activeQuest.id) {
                if (data.questTitle?.includes('Main') || data.questTitle?.includes('Case')) {
                    if (!this.completedSteps.includes('start_main_case')) {
                        this.game.questEngine.handleAnomaly('main_case_started', { case: data.questTitle });
                    }
                }
            }
        };

        // Listen for map screen toggle
        this.mapToggleHandler = (data) => {
            if (this.activeQuest && !this.completedSteps.includes('open_quest_log')) {
                this.game.questEngine.handleAnomaly('quest_log_opened', {});
            }
        };

        this.questCompleteHandler = (data) => {
            if (this.activeQuest && data.questId === this.activeQuest.id) {
                if (data.outcome === 'success') {
                    this.completeStep();
                }
            }
        };

        eventBus.on('player_built_building', this.houseBuildHandler, this);
        eventBus.on('player_built_building', this.jobBuildHandler, this);
        eventBus.on('crisis_resolved', this.crisisHandler, this);
        eventBus.on('quest_started', this.questStartHandler, this);
        eventBus.on('map_screen_toggled', this.mapToggleHandler, this);
        eventBus.on('quest_completed', this.questCompleteHandler, this);
    }

    /**
     * Get the next tutorial step
     */
    getCurrentStep() {
        if (this.currentStepIndex >= this.steps.length) return null;
        return this.steps[this.currentStepIndex];
    }

    /**
     * Start tutorial
     */
    start() {
        if (!this.isFirstTime) {
            return;
        }

        this.isFirstTime = false;
        this.currentStepIndex = 0;
        this.completedSteps = [];

        // Create tutorial quest
        const tutorialQuest = {
            id: 'tutorial',
            title: 'Welcome to the City',
            description: 'Your guide to building a successful city',
            type: 'tutorial',
            steps: this.steps.map(s => ({ ...s })), // Clone steps
            createdAt: Date.now()
        };

        this.activeQuest = this.game.questEngine.addQuest(tutorialQuest);

        // Initial messages
        this.game.ui.showMessage('Welcome! I\'ll guide you through your first city.', 'success');
        this.game.ui.showMessage('Use right-click drag to rotate the camera.', 'normal');
        this.game.ui.showMessage('Select "House" from the panel and place it on the map.', 'normal');

        // Start ambient for residential area
        if (this.game.ui?.audioManager) {
            this.game.ui.audioManager.changeAmbient('residential');
        }
    }

    /**
     * Complete current step
     */
    completeStep() {
        if (!this.activeQuest) return;

        const step = this.getCurrentStep();
        if (!step) return;

        this.completedSteps.push(step.id);
        this.currentStepIndex++;

        // Show completion message
        this.game.ui.showMessage(`Tutorial: ${step.title} - Completed!`, 'success');

        // Next step instructions
        const nextStep = this.getCurrentStep();
        if (nextStep) {
            this.game.ui.showMessage(`Next: ${nextStep.description}`, 'normal');
        } else {
            this.game.ui.showMessage('Tutorial complete! You\'re ready to build your city!', 'success');
            this.game.ui.showMessage('Remember: You can re-enable the tutorial in Settings if needed.', 'normal');
        }

        // Auto-advance the quest
        this.game.questEngine.tryAdvanceQuest(this.activeQuest);
    }

    /**
     * Skip tutorial
     */
    skip() {
        this.isFirstTime = false;
        this.completedSteps = this.steps.map(s => s.id);
        this.currentStepIndex = this.steps.length;

        if (this.activeQuest) {
            // Complete all steps
            for (let i = this.currentStepIndex - 1; i >= 0; i--) {
                this.game.questEngine.advanceQuest(this.activeQuest);
            }
        }

        this.game.ui.showMessage('Tutorial skipped. You can enable it in Settings.', 'normal');
    }

    /**
     * Check if tutorial is completed
     */
    isCompleted() {
        return this.completedSteps.length >= this.steps.length || !this.isFirstTime;
    }

    /**
     * Get tutorial progress
     */
    getProgress() {
        return {
            currentStep: this.currentStepIndex,
            totalSteps: this.steps.length,
            completed: this.completedSteps,
            isCompleted: this.isCompleted()
        };
    }

    /**
     * Reset tutorial (for testing)
     */
    reset() {
        this.isFirstTime = true;
        this.currentStepIndex = 0;
        this.completedSteps = [];
        if (this.activeQuest) {
            this.game.questEngine.activeQuests = this.game.questEngine.activeQuests.filter(q => q.id !== 'tutorial');
        }
    }

    /**
     * Handle step completion check
     */
    checkStepCompletion() {
        const step = this.getCurrentStep();
        if (!step) return;

        // Check for auto-advancing conditions
        switch (step.id) {
            case 'move_camera':
                // Camera movement is tracked by the renderer
                break;
            case 'place_house':
                // Triggered by house build handler
                break;
            case 'place_job':
                // Triggered by job build handler
                break;
            case 'handle_crisis':
                // Triggered by crisis handler
                break;
            case 'hack_node':
                // Check if player has hacked a node
                const node = this.game.interactables?.interactables?.find(
                    n => n.type === 'POWER_SUBSTATION' && n.state === 'success'
                );
                if (node) {
                    this.completeStep();
                }
                break;
            case 'open_quest_log':
                // Triggered by map toggle handler
                break;
            case 'start_main_case':
                // Check if main case quest exists
                const mainQuest = this.game.questEngine.getQuestsByStatus('active').find(
                    q => q.type === 'casefile' && q.id !== 'tutorial'
                );
                if (mainQuest) {
                    this.completeStep();
                }
                break;
        }
    }

    /**
     * Update tutorial (called each tick)
     */
    update() {
        if (!this.activeQuest || this.isCompleted()) return;

        // Check for auto-advancing steps
        const step = this.getCurrentStep();
        if (step?.autoAdvance && step.kind === STEP_KINDS.TRIGGER) {
            // Check if trigger was met
            const stepIndex = this.steps.findIndex(s => s.id === step.id);
            if (this.completedSteps.includes(step.id)) {
                this.completeStep();
            }
        }

        // Periodically check step completion
        if (this.game.resources.day > 0 && this.game.resources.day % 5 === 0) {
            this.checkStepCompletion();
        }
    }

    serialize() {
        return {
            isFirstRun: this.isFirstTime,
            currentStepIndex: this.currentStepIndex,
            completedSteps: [...this.completedSteps],
        };
    }

    deserialize(data) {
        if (!data) return;
        this.isFirstTime = data.isFirstRun !== false;
        this.currentStepIndex = data.currentStepIndex || 0;
        this.completedSteps = data.completedSteps || [];
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.houseBuildHandler) eventBus.off('player_built_building', this.houseBuildHandler);
        if (this.jobBuildHandler) eventBus.off('player_built_building', this.jobBuildHandler);
        if (this.crisisHandler) eventBus.off('crisis_resolved', this.crisisHandler);
        if (this.questStartHandler) eventBus.off('quest_started', this.questStartHandler);
        if (this.mapToggleHandler) eventBus.off('map_screen_toggled', this.mapToggleHandler);
    }
}

/**
 * Create tutorial manager instance
 */
export function createTutorialManager(game) {
    return new TutorialManager(game);
}
