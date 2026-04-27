// Tutorial Overlay System
// Interactive onboarding guide for new players
// Shows step-by-step instructions for game mechanics

/**
 * Tutorial step definition
 */
export const TUTORIAL_STEPS = {
    WALK: {
        id: 'walk',
        title: 'Move Around',
        content: 'Use WASD to move your character. Explore the area around you.',
        target: null,
        position: 'center',
        skipable: true,
        autoAdvance: true,
        advanceCondition: (game) => {
            const tm = game?.tutorialManager;
            return tm?.completedSteps?.includes('walk');
        }
    },
    WELCOME: {
        id: 'welcome',
        title: 'Welcome to City Builder!',
        content: 'Your journey to building a thriving city begins now. Let me guide you through the basics.',
        target: null,
        position: 'center',
        skipable: true,
        autoAdvance: false
    },
    RESOURCES: {
        id: 'resources',
        title: 'Resources',
        content: 'You have three main resources: Gold (💰), Food (🌾), and Wood (🌲). Watch them carefully at the top of the screen!',
        target: '#resource-bar',
        position: 'bottom',
        skipable: false,
        autoAdvance: false
    },
    BUILDING_MENU: {
        id: 'building_menu',
        title: 'Building Menu',
        content: 'This is your building menu. Click on any building to select it, then place it on the map.',
        target: '#building-grid',
        position: 'right',
        skipable: false,
        autoAdvance: false
    },
    PLACE_HOUSE: {
        id: 'place_house',
        title: 'Place Your First House',
        content: 'Click on the House building, then click on a grass tile to place it. Houses provide housing for citizens.',
        target: '#building-grid',
        targetAction: 'select_house',
        position: 'right',
        skipable: false,
        autoAdvance: true,
        advanceCondition: (game) => game.buildings?.getBuildingCount('house') >= 1
    },
    HOUSE_PLACED: {
        id: 'house_placed',
        title: 'Great Job!',
        content: 'Your house is built! Citizens will now move in if there is food available.',
        target: null,
        position: 'center',
        skipable: false,
        autoAdvance: true,
        advanceDelay: 3000
    },
    PLACE_FARM: {
        id: 'place_farm',
        title: 'Build a Farm',
        content: 'Now let\'s build a Farm to produce food. Select the Farm from the building menu and place it on grass.',
        target: '#building-grid',
        targetAction: 'select_farm',
        position: 'right',
        skipable: false,
        autoAdvance: true,
        advanceCondition: (game) => game.buildings?.getBuildingCount('farm') >= 1
    },
    FARM_PLACED: {
        id: 'farm_placed',
        title: 'Food Production Started!',
        content: 'Your farm will produce food every day. Food is needed to keep your citizens happy and healthy.',
        target: null,
        position: 'center',
        skipable: false,
        autoAdvance: true,
        advanceDelay: 3000
    },
    CONTROLS: {
        id: 'controls',
        title: 'Camera Controls',
        content: 'Right-click and drag to rotate the camera. Use WASD keys to move your character in Street Mode.',
        target: null,
        position: 'center',
        skipable: false,
        autoAdvance: true,
        advanceDelay: 4000
    },
    STATS_PANEL: {
        id: 'stats_panel',
        title: 'Stats Panel',
        content: 'Click the "Stats" tab to see detailed information about your city: population, employment, happiness, and more.',
        target: '.tab[data-tab="stats"]',
        position: 'bottom',
        skipable: false,
        autoAdvance: false
    },
    SAVE_GAME: {
        id: 'save_game',
        title: 'Saving Your Progress',
        content: 'Press Ctrl+S to save your game at any time. Your progress will be saved automatically when you close the browser.',
        target: null,
        position: 'center',
        skipable: false,
        autoAdvance: true,
        advanceDelay: 4000
    },
    VICTORY: {
        id: 'victory',
        title: 'Victory Conditions',
        content: 'There are multiple ways to win: Military dominance, Economic prosperity, Cultural achievement, or Technological advancement. Build strategically!',
        target: null,
        position: 'center',
        skipable: true,
        autoAdvance: false
    },
    COMPLETED: {
        id: 'completed',
        title: 'Tutorial Complete!',
        content: 'You\'re all set! Now go build an amazing city. Remember, you can always access help by pressing F12.',
        target: null,
        position: 'center',
        skipable: false,
        autoAdvance: false,
        isComplete: true
    }
};

/**
 * Tutorial Overlay class
 */
export class TutorialOverlay {
    constructor(game) {
        this.game = game;
        this.currentStepIndex = 0;
        this.currentStep = null;
        this.isActive = false;
        this.isPaused = false;
        this.onComplete = null;
        
        // DOM elements
        this.overlay = null;
        this.highlight = null;
        this.tooltip = null;
        
        // Progress tracking
        this.completedSteps = new Set();
        this.skippedSteps = new Set();
        
        // Auto-advance timer
        this.advanceTimer = null;
        
        // Build action tracking
        this.pendingBuildAction = null;
    }

    /**
     * Start tutorial from beginning or specific step
     */
    start(startStepId = 'welcome') {
        if (this.isActive) return;
        
        this.isActive = true;
        this.currentStepIndex = this.getStepIndex(startStepId);
        this.completedSteps.clear();
        this.skippedSteps.clear();
        
        // Create overlay elements
        this.createOverlay();
        this.createHighlight();
        this.createTooltip();
        
        // Show first step
        this.showStep();
    }

    /**
     * Get step index by ID
     */
    getStepIndex(stepId) {
        const steps = Object.values(TUTORIAL_STEPS);
        return steps.findIndex(s => s.id === stepId);
    }

    /**
     * Create overlay backdrop
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9998;
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);
    }

    /**
     * Create highlight element for targeting
     */
    createHighlight() {
        this.highlight = document.createElement('div');
        this.highlight.id = 'tutorial-highlight';
        this.highlight.style.cssText = `
            position: fixed;
            z-index: 9999;
            pointer-events: none;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.8);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(this.highlight);
    }

    /**
     * Create tooltip with step content
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'tutorial-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            z-index: 10000;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #4a90d9;
            border-radius: 12px;
            padding: 20px;
            max-width: 400px;
            color: #ffffff;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            pointer-events: auto;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        
        // Tooltip content
        this.tooltip.innerHTML = `
            <div id="tutorial-tooltip-header">
                <h3 id="tutorial-tooltip-title" style="margin: 0 0 10px 0; color: #4a90d9; font-size: 1.3em;"></h3>
            </div>
            <div id="tutorial-tooltip-content" style="margin-bottom: 15px; line-height: 1.5;"></div>
            <div id="tutorial-tooltip-footer" style="display: flex; justify-content: space-between; align-items: center;">
                <span id="tutorial-tooltip-progress" style="color: #888; font-size: 0.9em;"></span>
                <div style="display: flex; gap: 10px;">
                    <button id="tutorial-skip-btn" style="display: none; padding: 8px 16px; background: #666; border: none; border-radius: 4px; color: white; cursor: pointer;">Skip</button>
                    <button id="tutorial-prev-btn" style="padding: 8px 16px; background: #4a90d9; border: none; border-radius: 4px; color: white; cursor: pointer;">Previous</button>
                    <button id="tutorial-next-btn" style="padding: 8px 16px; background: #4a90d9; border: none; border-radius: 4px; color: white; cursor: pointer;">Next</button>
                    <button id="tutorial-close-btn" style="display: none; padding: 8px 16px; background: #4caf50; border: none; border-radius: 4px; color: white; cursor: pointer;">Got it!</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.tooltip);
        
        // Setup button handlers
        this.setupButtonHandlers();
    }

    /**
     * Setup button click handlers
     */
    setupButtonHandlers() {
        document.getElementById('tutorial-next-btn')?.addEventListener('click', () => this.next());
        document.getElementById('tutorial-prev-btn')?.addEventListener('click', () => this.previous());
        document.getElementById('tutorial-skip-btn')?.addEventListener('click', () => this.skip());
        document.getElementById('tutorial-close-btn')?.addEventListener('click', () => this.complete());
    }

    /**
     * Show current step
     */
    showStep() {
        const steps = Object.values(TUTORIAL_STEPS);
        if (this.currentStepIndex < 0 || this.currentStepIndex >= steps.length) {
            this.complete();
            return;
        }
        
        this.currentStep = steps[this.currentStepIndex];
        this.pendingBuildAction = null;
        
        // Update tooltip content
        this.updateTooltip();
        
        // Position elements
        this.positionHighlight();
        this.positionTooltip();
        
        // Setup auto-advance if needed
        if (this.currentStep.autoAdvance) {
            this.setupAutoAdvance();
        }
        
        // Check for build action requirement
        if (this.currentStep.targetAction) {
            this.setupBuildActionListener();
        }
    }

    /**
     * Update tooltip content
     */
    updateTooltip() {
        const titleEl = document.getElementById('tutorial-tooltip-title');
        const contentEl = document.getElementById('tutorial-tooltip-content');
        const progressEl = document.getElementById('tutorial-tooltip-progress');
        const nextBtn = document.getElementById('tutorial-next-btn');
        const prevBtn = document.getElementById('tutorial-prev-btn');
        const skipBtn = document.getElementById('tutorial-skip-btn');
        const closeBtn = document.getElementById('tutorial-close-btn');
        
        if (titleEl) titleEl.textContent = this.currentStep.title;
        if (contentEl) contentEl.textContent = this.currentStep.content;
        
        // Progress indicator
        const steps = Object.values(TUTORIAL_STEPS);
        const currentNum = this.currentStepIndex + 1;
        const total = steps.filter(s => !s.isComplete).length;
        if (progressEl) progressEl.textContent = `Step ${currentNum} of ${total}`;
        
        // Button visibility
        if (nextBtn) nextBtn.style.display = this.currentStep.isComplete ? 'none' : 'block';
        if (prevBtn) prevBtn.style.display = this.currentStepIndex === 0 ? 'none' : 'block';
        if (skipBtn) skipBtn.style.display = this.currentStep.skipable ? 'block' : 'none';
        if (closeBtn) closeBtn.style.display = this.currentStep.isComplete ? 'block' : 'none';
    }

    /**
     * Position highlight around target element
     */
    positionHighlight() {
        if (!this.currentStep.target) {
            // No target - hide highlight
            this.highlight.style.display = 'none';
            return;
        }
        
        const targetEl = document.querySelector(this.currentStep.target);
        if (!targetEl) {
            // Target not found - center highlight
            this.highlight.style.display = 'block';
            this.highlight.style.left = '50%';
            this.highlight.style.top = '50%';
            this.highlight.style.width = '200px';
            this.highlight.style.height = '200px';
            this.highlight.style.transform = 'translate(-50%, -50%)';
            return;
        }
        
        const rect = targetEl.getBoundingClientRect();
        const padding = 10;
        
        this.highlight.style.display = 'block';
        this.highlight.style.left = `${rect.left - padding}px`;
        this.highlight.style.top = `${rect.top - padding}px`;
        this.highlight.style.width = `${rect.width + padding * 2}px`;
        this.highlight.style.height = `${rect.height + padding * 2}px`;
        this.highlight.style.transform = 'none';
    }

    /**
     * Position tooltip relative to highlight
     */
    positionTooltip() {
        const highlightRect = this.highlight.getBoundingClientRect();
        const position = this.currentStep.position || 'bottom';
        
        let tooltipX, tooltipY;
        const tooltipWidth = 400;
        const tooltipHeight = 200;
        const gap = 15;
        
        switch (position) {
            case 'top':
                tooltipX = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2;
                tooltipY = highlightRect.top - tooltipHeight - gap;
                break;
            case 'bottom':
                tooltipX = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2;
                tooltipY = highlightRect.bottom + gap;
                break;
            case 'left':
                tooltipX = highlightRect.left - tooltipWidth - gap;
                tooltipY = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2;
                break;
            case 'right':
                tooltipX = highlightRect.right + gap;
                tooltipY = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2;
                break;
            case 'center':
            default:
                tooltipX = window.innerWidth / 2 - tooltipWidth / 2;
                tooltipY = window.innerHeight / 2 - tooltipHeight / 2;
                break;
        }
        
        // Keep tooltip in viewport
        tooltipX = Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, tooltipX));
        tooltipY = Math.max(10, Math.min(window.innerHeight - tooltipHeight - 10, tooltipY));
        
        this.tooltip.style.left = `${tooltipX}px`;
        this.tooltip.style.top = `${tooltipY}px`;
    }

    /**
     * Setup auto-advance timer
     */
    setupAutoAdvance() {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
        }
        
        const delay = this.currentStep.advanceDelay || 2000;
        this.advanceTimer = setTimeout(() => {
            // Check advance condition if specified
            if (this.currentStep.advanceCondition) {
                if (this.currentStep.advanceCondition(this.game)) {
                    this.next();
                } else {
                    // Condition not met, show again
                    this.setupAutoAdvance();
                }
            } else {
                this.next();
            }
        }, delay);
    }

    /**
     * Setup listener for build action
     */
    setupBuildActionListener() {
        const action = this.currentStep.targetAction;
        if (action === 'select_house') {
            this.pendingBuildAction = { type: 'house', message: 'Place a House on the map' };
        } else if (action === 'select_farm') {
            this.pendingBuildAction = { type: 'farm', message: 'Place a Farm on the map' };
        }
    }

    /**
     * Handle building placement (called from game)
     */
    onBuildingBuilt(buildingType) {
        if (!this.isActive || !this.pendingBuildAction) return;
        
        if (buildingType === this.pendingBuildAction.type) {
            this.completedSteps.add(this.currentStep.id);
            this.pendingBuildAction = null;
            this.next();
        }
    }

    /**
     * Advance to next step
     */
    next() {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        
        this.completedSteps.add(this.currentStep?.id);
        this.currentStepIndex++;
        this.showStep();
    }

    /**
     * Go to previous step
     */
    previous() {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            this.showStep();
        }
    }

    /**
     * Skip current step
     */
    skip() {
        if (!this.currentStep.skipable) return;
        
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        
        this.skippedSteps.add(this.currentStep?.id);
        this.next();
    }

    /**
     * Complete tutorial
     */
    complete() {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        
        this.isActive = false;
        this.destroy();
        
        if (this.game?.state?.tutorial) {
            this.game.state.tutorial.isFirstRun = false;
        }
        if (this.game?.tutorialManager) {
            this.game.tutorialManager.isFirstTime = false;
        }
        
        if (this.onComplete) {
            this.onComplete();
        }
    }

    /**
     * Pause tutorial
     */
    pause() {
        this.isPaused = true;
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
    }

    /**
     * Resume tutorial
     */
    resume() {
        this.isPaused = false;
        if (this.isActive && this.currentStep?.autoAdvance) {
            this.setupAutoAdvance();
        }
    }

    /**
     * Destroy overlay
     */
    destroy() {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.highlight) {
            this.highlight.remove();
            this.highlight = null;
        }
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        
        this.currentStep = null;
        this.pendingBuildAction = null;
    }

    /**
     * Check if tutorial should be shown
     */
    static shouldShowTutorial(game) {
        if (game?.state?.tutorial) {
            return game.state.tutorial.isFirstRun === true;
        }
        return false;
    }

    /**
     * Get tutorial progress (0-1)
     */
    getProgress() {
        const steps = Object.values(TUTORIAL_STEPS).filter(s => !s.isComplete);
        const total = steps.length;
        const completed = this.completedSteps.size;
        return total > 0 ? completed / total : 1;
    }
}

/**
 * Create tutorial overlay instance
 */
export function createTutorialOverlay(game) {
    return new TutorialOverlay(game);
}