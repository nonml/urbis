// Dev Menu - Debug tools for quest testing
// Accessible via debug overlay (enable via console or build flag)

/**
 * Dev menu class for debugging quests and stories
 */
export class DevMenu {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.overlay = null;

        // Available debug actions
        this.actions = {
            spawnMainCase: {
                label: 'Spawn Main Case',
                description: 'Create and start the main case file',
                callback: () => this.spawnMainCase()
            },
            spawnRandomMinorCase: {
                label: 'Spawn Random Minor Case',
                description: 'Create and start a random minor case',
                callback: () => this.spawnRandomMinorCase()
            },
            completeCurrentStep: {
                label: 'Complete Current Step',
                description: 'Complete the current quest step for testing',
                callback: () => this.completeCurrentStep()
            },
            teleportToMarker: {
                label: 'Teleport to Marker',
                description: 'Teleport to quest waypoint marker',
                callback: () => this.teleportToMarker()
            },
            forceTriggerAnomaly: {
                label: 'Force Trigger Anomaly',
                description: 'Trigger a specific anomaly for quest testing',
                callback: () => this.forceTriggerAnomaly()
            },
            listActiveQuests: {
                label: 'List Active Quests',
                description: 'Show all active quests in console',
                callback: () => this.listActiveQuests()
            }
        };
    }

    /**
     * Enable dev menu (for development builds)
     */
    enable() {
        this.enabled = true;
        this.setupDebugOverlay();
        this.setupKeybindings();
    }

    /**
     * Disable dev menu (for release builds)
     */
    disable() {
        this.enabled = false;
        this.clearDebugOverlay();
        this.clearKeybindings();
    }

    /**
     * Setup debug overlay UI
     */
    setupDebugOverlay() {
        // Create debug overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'dev-overlay';
        this.overlay.className = 'dev-overlay';
        this.overlay.style.display = 'none';  // Hide by default
        this.overlay.innerHTML = `
            <div class="dev-overlay-header">
                <h3>Debug Menu</h3>
                <button id="dev-close">&times;</button>
            </div>
            <div class="dev-overlay-content">
                <p class="dev-status">Status: <span class="dev-status-indicator">ENABLED</span></p>
                <div class="dev-actions">
                    ${Object.entries(this.actions).map(([key, action]) => `
                        <button class="dev-btn" data-action="${key}">
                            <span class="dev-btn-label">${action.label}</span>
                            <span class="dev-btn-desc">${action.description}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        // Setup close button
        this.overlay.querySelector('#dev-close').addEventListener('click', () => this.toggle(false));

        // Setup action buttons
        this.overlay.querySelectorAll('.dev-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionKey = btn.dataset.action;
                this.actions[actionKey].callback();
                this.showMessage(`Executed: ${this.actions[actionKey].label}`);
            });
        });
    }

    /**
     * Clear debug overlay
     */
    clearDebugOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    /**
     * Toggle debug overlay visibility
     */
    toggle(forceOpen = null) {
        if (!this.enabled) return;

        const isOpen = forceOpen !== null ? forceOpen : (this.overlay.style.display !== 'none');

        if (isOpen) {
            this.overlay.style.display = 'block';
        } else {
            this.overlay.style.display = 'none';
        }
    }

    /**
     * Setup keybindings for debug actions
     */
    setupKeybindings() {
        // Shift+Q: Toggle dev menu
        window.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key.toLowerCase() === 'q') {
                e.preventDefault();
                this.toggle();
            }
            // Ctrl+Shift+Q: Force main case
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'q') {
                e.preventDefault();
                this.spawnMainCase();
            }
        });
    }

    /**
     * Clear keybindings
     */
    clearKeybindings() {
        // Keybindings are handled via event listener removal if needed
    }

    /**
     * Spawn main case
     */
    spawnMainCase() {
        if (!this.game.questEngine || !this.game.caseGenerator) {
            this.showMessage('Quest engine or case generator not initialized');
            return;
        }

        const quest = this.game.caseGenerator.generateMainCase();
        if (quest) {
            this.game.questEngine.addQuest(quest);
            this.showMessage(`Spawned main case: ${quest.title}`);
        } else {
            this.showMessage('Failed to spawn main case - no templates available');
        }
    }

    /**
     * Spawn random minor case
     */
    spawnRandomMinorCase() {
        if (!this.game.questEngine || !this.game.caseGenerator) {
            this.showMessage('Quest engine or case generator not initialized');
            return;
        }

        const quest = this.game.caseGenerator.generateMinorCase();
        if (quest) {
            this.game.questEngine.addQuest(quest);
            this.showMessage(`Spawned minor case: ${quest.title}`);
        } else {
            this.showMessage('Failed to spawn minor case - no candidates available');
        }
    }

    /**
     * Complete current quest step
     */
    completeCurrentStep() {
        const quests = this.game.questEngine.getQuestsByStatus('active');
        if (quests.length === 0) {
            this.showMessage('No active quests');
            return;
        }

        const quest = quests[0];
        if (quest.currentStepIndex < quest.steps.length) {
            const currentStep = quest.steps[quest.currentStepIndex];
            this.game.questEngine.executeStep(quest, currentStep);
            this.showMessage(`Completed step: ${currentStep.id}`);
        } else {
            this.showMessage('Quest completed');
        }
    }

    /**
     * Teleport to quest marker
     */
    teleportToMarker() {
        const quests = this.game.questEngine.getQuestsByStatus('active');
        if (quests.length === 0) {
            this.showMessage('No active quests');
            return;
        }

        const quest = quests[0];
        const currentStep = quest.steps[quest.currentStepIndex];

        if (currentStep.kind === 'go_to' && currentStep.targetX !== undefined) {
            this.game.state.player.x = currentStep.targetX;
            this.game.state.player.y = currentStep.targetY;
            this.game.state.player.wx = currentStep.targetX + 0.5;
            this.game.state.player.wz = currentStep.targetY + 0.5;
            this.game.ui.setPlayerTile(currentStep.targetX, currentStep.targetY);
            this.showMessage(`Teleported to marker at (${currentStep.targetX}, ${currentStep.targetY})`);
        } else {
            this.showMessage('No waypoint marker for current step');
        }
    }

    /**
     * Force trigger an anomaly
     */
    forceTriggerAnomaly() {
        const anomalyTypes = [
            'ANOMALY_MISSING_PERSON',
            'ANOMALY_CORRUPTION_RUMOR',
            'ANOMALY_GANG_ACTIVITY',
            'ANOMALY_SABOTAGE',
            'ANOMALY_WHALEBlOWER_REQUEST',
            'ANOMALY_VANDALISM',
            'ANOMALY_BLACKMAIL'
        ];

        const type = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
        this.game.questEngine.handleAnomaly(type, { random: true });
        this.showMessage(`Triggered anomaly: ${type}`);
    }

    /**
     * List active quests
     */
    listActiveQuests() {
        const quests = this.game.questEngine.getQuestsByStatus('active');
        console.log('=== Active Quests ===');
        quests.forEach((quest, index) => {
            const currentStep = quest.steps[quest.currentStepIndex];
            console.log(`${index + 1}. [${quest.id}] ${quest.title}`);
            console.log(`   Status: ${quest.status}, Step: ${currentStep?.id || 'N/A'}`);
            console.log(`   Clues: ${quest.data.clues.length}`);
        });
        this.showMessage(`Listed ${quests.length} active quests (see console)`);
    }

    /**
     * Show debug message
     */
    showMessage(message) {
        console.log(`[Dev] ${message}`);
        if (this.game.ui) {
            this.game.ui.showMessage(`[DEV] ${message}`, 'normal');
        }
    }

    /**
     * Check if dev mode is enabled
     */
    isEnabled() {
        return this.enabled;
    }
}

/**
 * Create dev menu instance
 */
export function createDevMenu(game) {
    return new DevMenu(game);
}