// Dev Menu v2 - Debug tools for city simulation testing
// Provides fast iteration for content creation and testing

// Non-deterministic helper (no Math.random). Dev-only.
function randomIndex(len) {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
        const b = new Uint32Array(1);
        cryptoObj.getRandomValues(b);
        return (b[0] >>> 0) % len;
    }
    return 0;
}

/**
 * Dev menu class v2 for debugging city simulation
 * - Fast-forward simulation time
 * - Teleport to any district/landmark
 * - Spawn incidents
 * - Grant resources
 * - Toggle overlays
 */
export class DevMenu {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.overlay = null;
        this.fastForwardSpeed = 1; // Multiplier for sim speed
        this.isFastForwarding = false;
        this.fastForwardInterval = null;

        // Available debug actions - organized by category
        this.actions = {
            // Teleportation
            teleportToDistrict: {
                label: 'Teleport to District',
                description: 'Jump to any district quickly',
                callback: () => this.showDistrictTeleportMenu()
            },
            teleportToLandmark: {
                label: 'Teleport to Landmark',
                description: 'Teleport to a landmark node',
                callback: () => this.showLandmarkTeleportMenu()
            },
            teleportToPlayerVehicle: {
                label: 'Teleport to Vehicle',
                description: 'Jump to player vehicle position',
                callback: () => this.teleportToPlayerVehicle()
            },

            // Incident spawning
            spawnIncident: {
                label: 'Spawn Incident',
                description: 'Create a new incident at current position',
                callback: () => this.showIncidentSpawnMenu()
            },
            spawnCrises: {
                label: 'Spawn Crisis',
                description: 'Trigger a crisis event',
                callback: () => this.showCrisisSpawnMenu()
            },

            // Simulation control
            fastForward: {
                label: 'Fast-Forward 1 Day',
                description: 'Simulate 24 ticks (1 day)',
                callback: () => this.fastForwardDays(1)
            },
            fastForward5: {
                label: 'Fast-Forward 5 Days',
                description: 'Simulate 5 days (120 ticks)',
                callback: () => this.fastForwardDays(5)
            },
            fastForwardToggle: {
                label: 'Toggle Fast-Forward',
                description: 'Start/stop auto-fast-forward',
                callback: () => this.toggleFastForward()
            },

            // Resources
            grantGold: {
                label: 'Grant 1000 Gold',
                description: 'Add 1000 gold to city budget',
                callback: () => this.grantResources({ gold: 1000 })
            },
            grantResources: {
                label: 'Grant All Resources',
                description: 'Add 1000 of each resource',
                callback: () => this.grantResources({ gold: 1000, wood: 1000, food: 1000, data: 1000 })
            },

            // Content spawning
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

            // Tuning
            toggleEasyHack: {
                label: 'Toggle Easy Hack',
                description: 'Auto-succeed breach mini-game',
                callback: () => this.toggleEasyHack()
            },
            tuneFactionHacksUp: {
                label: 'Faction Hacks +',
                description: 'Increase faction delta multiplier for hacks',
                callback: () => this.adjustFactionMultiplier('hacks', +0.25)
            },
            setPoliceHostile: {
                label: 'Police Hostile',
                description: 'Set police reputation to hostile for tuning',
                callback: () => this.setFactionRep('police', -60)
            },

            // UI overlays
            toggleZoneOverlay: {
                label: 'Toggle Zone Overlay',
                description: 'Show/hide zone visibility layer',
                callback: () => this.toggleZoneOverlay()
            },
            toggleServiceOverlay: {
                label: 'Toggle Service Overlay',
                description: 'Show/hide service coverage',
                callback: () => this.toggleServiceOverlay()
            },
            toggleNetworkOverlay: {
                label: 'Toggle Network Overlay',
                description: 'Show/hide power/water/data networks',
                callback: () => this.toggleNetworkOverlay()
            },

            // Validation
            listActiveQuests: {
                label: 'List Active Quests',
                description: 'Show all active quests in console',
                callback: () => this.listActiveQuests()
            },
            validateContent: {
                label: 'Validate Content',
                description: 'Run content validation check',
                callback: () => this.validateContent()
            }
        };
    }

    /**
     * Enable dev menu (for development builds)
     * Only enabled when __DEV__ is true or dev flag is set in state
     */
    enable() {
        // Check for __DEV__ build flag (injected by bundler)
        const isDevBuild = typeof __DEV__ === 'undefined' || __DEV__;

        // Check for dev flag in game state
        const stateDevFlag = this.game.state.dev?.enabled || false;

        this.enabled = isDevBuild && stateDevFlag;

        if (this.enabled) {
            this.setupDebugOverlay();
            this.setupKeybindings();
        }
    }

    /**
     * Disable dev menu (for release builds)
     */
    disable() {
        this.enabled = false;
        this.stopFastForward();
        this.clearDebugOverlay();
        this.clearKeybindings();
    }

    /**
     * Spawn main case
     */
    spawnMainCase() {
        if (this.game.spawnCase) {
            const c = this.game.spawnCase('missing_person');
            this.showMessage(`Spawned main case: ${c?.id || 'unknown'}`);
            return;
        }
        this.showMessage('Case manager not initialized');
    }

    /**
     * Spawn random minor case
     */
    spawnRandomMinorCase() {
        if (this.game.spawnCase) {
            const pool = ['corruption', 'extortion'];
            const type = pool[randomIndex(pool.length)];
            const c = this.game.spawnCase(type);
            this.showMessage(`Spawned minor case: ${c?.id || type}`);
            return;
        }
        this.showMessage('Case manager not initialized');
    }

    spawnSpecificCase(type) {
        if (!this.game.spawnCase) {
            this.showMessage('Case manager not initialized');
            return;
        }
        const c = this.game.spawnCase(type || 'missing_person');
        this.showMessage(`Spawned specific case: ${c?.id || type}`);
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

        const type = anomalyTypes[randomIndex(anomalyTypes.length)];
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

    toggleEasyHack() {
        if (!this.game.state) return;
        this.game.state.debugEasyHack = !this.game.state.debugEasyHack;
        this.showMessage(`Easy hack: ${this.game.state.debugEasyHack ? 'ON' : 'OFF'}`);
    }

    adjustFactionMultiplier(category, delta) {
        const meta = this.game.state.meta || (this.game.state.meta = {});
        const devTuning = meta.devTuning || (meta.devTuning = {});
        const fm = devTuning.factionMultipliers || (devTuning.factionMultipliers = { hacks: 1, quests: 1, services: 1 });
        const prev = Number(fm[category] || 1);
        const next = Math.max(0, Math.min(5, Math.round((prev + delta) * 100) / 100));
        fm[category] = next;
        this.showMessage(`Faction multiplier ${category}: ${next.toFixed(2)}`);
    }

    setFactionRep(faction, value) {
        if (!this.game.factionSystem) return;
        this.game.factionSystem.setReputation(faction, value, 'dev_override');
        this.showMessage(`${faction} reputation set to ${value}`);
    }

    // ==================== Fast-Forward & Simulation Control ====================

    /**
     * Fast-forward simulation by N days (1 day = 24 ticks)
     */
    fastForwardDays(days) {
        const ticks = days * 24;
        const originalPaused = this.game.paused;
        this.game.paused = true;

        let progress = 0;
        const interval = setInterval(() => {
            this.game.tickOnce();
            progress++;
            if (progress >= ticks) {
                clearInterval(interval);
                this.game.paused = originalPaused;
                this.showMessage(`Fast-forwarded ${days} days`, 'normal');
            }
            // Update progress UI
            if (progress % 24 === 0) {
                const hours = progress;
                const daysSimulated = hours / 24;
                this.game.ui.updateStats();
            }
        }, 10); // Fast update rate

        this.game.ui.showMessage(`Fast-forwarding ${days} days...`, 'normal');
    }

    /**
     * Toggle auto-fast-forward mode
     */
    toggleFastForward() {
        if (this.isFastForwarding) {
            this.stopFastForward();
            this.showMessage('Fast-forward stopped', 'normal');
        } else {
            this.startFastForward();
            this.showMessage('Fast-forward started (5x speed)', 'normal');
        }
    }

    startFastForward() {
        if (this.isFastForwarding) return;
        this.isFastForwarding = true;
        this.fastForwardSpeed = 5;

        const tick = () => {
            if (!this.isFastForwarding) return;
            // Run multiple ticks per frame
            for (let i = 0; i < this.fastForwardSpeed; i++) {
                this.game.tickOnce();
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    stopFastForward() {
        this.isFastForwarding = false;
        this.fastForwardSpeed = 1;
    }

    // ==================== Teleportation ====================

    /**
     * Show district teleport menu
     */
    showDistrictTeleportMenu() {
        const districts = this.game.map.districts || [];
        if (!districts || districts.length === 0) {
            this.showMessage('No districts found', 'normal');
            return;
        }

        // Build teleport options
        const options = districts.map((d, i) => ({
            id: i,
            label: `${d.name} (${d.center?.x?.toFixed(0) || '?'}, ${d.center?.y?.toFixed(0) || '?'})`,
            callback: () => this.teleportToDistrict(d)
        }));

        // Show selection UI
        this.showSelectionMenu('Teleport to District', options);
    }

    /**
     * Teleport to a specific district
     */
    teleportToDistrict(district) {
        if (!district || !district.center) {
            this.showMessage('District has no valid center', 'normal');
            return;
        }

        this.game.state.player.x = district.center.x;
        this.game.state.player.y = district.center.y;
        this.game.state.player.wx = district.center.x + 0.5;
        this.game.state.player.wz = district.center.y + 0.5;
        this.game.ui.setPlayerTile(district.center.x, district.center.y);
        this.showMessage(`Teleported to ${district.name}`, 'normal');
    }

    /**
     * Show landmark teleport menu
     */
    showLandmarkTeleportMenu() {
        const landmarks = this.game.state.map.landmarks || [];
        if (!landmarks || landmarks.length === 0) {
            this.showMessage('No landmarks found', 'normal');
            return;
        }

        const options = landmarks.map((lm, i) => ({
            id: i,
            label: `${lm.name} (${lm.x}, ${lm.y})`,
            callback: () => this.teleportToLandmark(lm)
        }));

        this.showSelectionMenu('Teleport to Landmark', options);
    }

    /**
     * Teleport to a landmark
     */
    teleportToLandmark(landmark) {
        this.game.state.player.x = landmark.x;
        this.game.state.player.y = landmark.y;
        this.game.state.player.wx = landmark.x + 0.5;
        this.game.state.player.wz = landmark.y + 0.5;
        this.game.ui.setPlayerTile(landmark.x, landmark.y);
        this.showMessage(`Teleported to ${landmark.name}`, 'normal');
    }

    /**
     * Teleport to player vehicle
     */
    teleportToPlayerVehicle() {
        const vehicle = this.game.playerVehicle;
        if (vehicle && vehicle.x !== undefined) {
            this.game.state.player.x = vehicle.x;
            this.game.state.player.y = vehicle.y;
            this.game.state.player.wx = vehicle.x + 0.5;
            this.game.state.player.wz = vehicle.y + 0.5;
            this.game.ui.setPlayerTile(vehicle.x, vehicle.y);
            this.showMessage('Teleported to vehicle', 'normal');
        } else {
            this.showMessage('No vehicle found', 'normal');
        }
    }

    // ==================== Incident Spawning ====================

    /**
     * Show incident spawn menu
     */
    showIncidentSpawnMenu() {
        const incidentTypes = [
            { type: 'VANDALISM', label: 'Vandalism' },
            { type: 'THEFT', label: 'Theft' },
            { type: 'ASSAULT', label: 'Assault' },
            { type: 'BURGLARY', label: 'Burglary' },
            { type: 'ROBBERY', label: 'Robbery' },
            { type: 'ARSON', label: 'Arson' },
            { type: 'MURDER', label: 'Murder' },
            { type: 'CORRUPTION', label: 'Corruption' }
        ];

        const options = incidentTypes.map(t => ({
            id: t.type,
            label: t.label,
            callback: () => this.spawnIncidentAtPlayer(t.type)
        }));

        this.showSelectionMenu('Spawn Incident', options);
    }

    /**
     * Spawn incident at player position
     */
    spawnIncidentAtPlayer(type) {
        const player = this.game.state.player;
        if (!player) {
            this.showMessage('Player position unknown', 'normal');
            return;
        }

        const incidentSystem = this.game.incidentSystem || this.game.crisisManager;
        if (incidentSystem) {
            // Create incident at player position
            const incident = {
                type: type,
                x: Math.floor(player.x),
                y: Math.floor(player.y),
                time: this.game.state.tick,
                severity: 1,
                active: true
            };

            if (incidentSystem.spawnIncident) {
                incidentSystem.spawnIncident(incident);
            } else if (this.game.crisisManager) {
                this.game.crisisManager.triggerIncident(incident);
            }

            this.showMessage(`Spawned incident: ${type} at (${incident.x}, ${incident.y})`, 'normal');
        } else {
            this.showMessage('Incident system not available', 'normal');
        }
    }

    // ==================== Crisis Spawning ====================

    /**
     * Show crisis spawn menu
     */
    showCrisisSpawnMenu() {
        const crisisTypes = [
            { type: 'FLOOD', label: 'Flood' },
            { type: 'FIRE', label: 'Fire' },
            { type: 'CRIME_SPREE', label: 'Crime Spree' },
            { type: 'POLICE_STRIKE', label: 'Police Strike' },
            { type: 'BLACKOUT', label: 'Blackout' },
            { type: 'BRIDGE_FAILURE', label: 'Bridge Failure' },
            { type: 'MARKET_CRASH', label: 'Market Crash' },
            { type: 'DISEASE', label: 'Disease Outbreak' }
        ];

        const options = crisisTypes.map(t => ({
            id: t.type,
            label: t.label,
            callback: () => this.spawnCrisis(t.type)
        }));

        this.showSelectionMenu('Spawn Crisis', options);
    }

    /**
     * Spawn a crisis event
     */
    spawnCrisis(type) {
        if (this.game.crisisManager) {
            this.game.crisisManager.triggerCrisis(type, { devSpawn: true });
            this.showMessage(`Spawned crisis: ${type}`, 'normal');
        } else if (this.game.crisisDirector) {
            this.game.crisisDirector.triggerCrisis(type, { devSpawn: true });
            this.showMessage(`Spawned crisis: ${type}`, 'normal');
        } else {
            this.showMessage('Crisis system not available', 'normal');
        }
    }

    // ==================== Resource Granting ====================

    /**
     * Grant resources to the city
     */
    grantResources(resources) {
        const state = this.game.state;
        if (!state.resources) {
            this.showMessage('Resources system not initialized', 'normal');
            return;
        }

        for (const [key, value] of Object.entries(resources)) {
            if (state.resources[key] !== undefined) {
                state.resources[key] += value;
            }
        }

        this.showMessage(`Granted resources: ${JSON.stringify(resources)}`, 'normal');
        this.game.ui.updateResources();
    }

    // ==================== Quest Content ====================

    /**
     * Spawn main case
     */
    spawnMainCase() {
        if (this.game.spawnCase) {
            const c = this.game.spawnCase('missing_person');
            this.showMessage(`Spawned main case: ${c?.id || 'unknown'}`, 'normal');
            return;
        }
        this.showMessage('Case manager not initialized', 'normal');
    }

    /**
     * Spawn random minor case
     */
    spawnRandomMinorCase() {
        if (this.game.spawnCase) {
            const pool = ['corruption', 'extortion', 'vandalism'];
            const type = pool[randomIndex(pool.length)];
            const c = this.game.spawnCase(type);
            this.showMessage(`Spawned minor case: ${c?.id || type}`, 'normal');
            return;
        }
        this.showMessage('Case manager not initialized', 'normal');
    }

    /**
     * Complete current quest step
     */
    completeCurrentStep() {
        const questEngine = this.game.questEngine;
        if (!questEngine) {
            this.showMessage('Quest engine not initialized', 'normal');
            return;
        }

        const quests = questEngine.getQuestsByStatus('active');
        if (quests.length === 0) {
            this.showMessage('No active quests', 'normal');
            return;
        }

        const quest = quests[0];
        if (quest.currentStepIndex < quest.steps.length) {
            const currentStep = quest.steps[quest.currentStepIndex];
            questEngine.executeStep(quest, currentStep);
            this.showMessage(`Completed step: ${currentStep.id}`, 'normal');
        } else {
            this.showMessage('Quest completed', 'normal');
        }
    }

    // ==================== UI Overlays ====================

    /**
     * Toggle zone overlay
     */
    toggleZoneOverlay() {
        const renderer = this.game.renderer3d || this.game.ui.renderer3d;
        if (renderer && renderer.setZoneMode) {
            const modes = ['none', 'zones', 'zoned'];
            const currentIdx = modes.indexOf(renderer._zoneMode || 'none');
            const nextIdx = (currentIdx + 1) % modes.length;
            renderer.setZoneMode(modes[nextIdx]);
            this.showMessage(`Zone overlay: ${modes[nextIdx]}`, 'normal');
        } else {
            this.showMessage('Zone overlay not available', 'normal');
        }
    }

    /**
     * Toggle service overlay
     */
    toggleServiceOverlay() {
        const ui = this.game.ui;
        if (ui && ui.toggleServiceOverlay) {
            ui.toggleServiceOverlay();
            this.showMessage('Service overlay toggled', 'normal');
        } else {
            this.showMessage('Service overlay not available', 'normal');
        }
    }

    /**
     * Toggle network overlay
     */
    toggleNetworkOverlay() {
        const renderer = this.game.renderer3d || this.game.ui.renderer3d;
        if (renderer && renderer.toggleNetwork) {
            renderer.toggleNetwork();
            this.showMessage('Network overlay toggled', 'normal');
        } else {
            this.showMessage('Network overlay not available', 'normal');
        }
    }

    // ==================== Validation ====================

    /**
     * List active quests
     */
    listActiveQuests() {
        const questEngine = this.game.questEngine;
        if (!questEngine) {
            this.showMessage('Quest engine not initialized (see console)', 'normal');
            return;
        }

        const quests = questEngine.getQuestsByStatus('active');
        console.log('=== Active Quests ===');
        quests.forEach((quest, index) => {
            const currentStep = quest.steps[quest.currentStepIndex];
            console.log(`${index + 1}. [${quest.id}] ${quest.title}`);
            console.log(`   Status: ${quest.status}, Step: ${currentStep?.id || 'N/A'}`);
            console.log(`   Clues: ${quest.data?.clues?.length || 0}`);
        });

        this.showMessage(`Listed ${quests.length} active quests (see console)`, 'normal');
    }

    /**
     * Validate content
     */
    validateContent() {
        this.showMessage('Content validation: Starting...', 'normal');

        // Run content validation
        const results = {
            quests: 0,
            cases: 0,
            validationErrors: []
        };

        // Check if case generator exists
        if (this.game.caseGenerator) {
            results.cases = this.game.caseGenerator.getCasesCount();
        }

        // Check if quest loader exists
        if (this.game.questEngine?.questLoader) {
            results.quests = this.game.questEngine.questLoader.getQuestCount();
        }

        console.log('Content Validation Results:', results);

        if (results.validationErrors.length === 0) {
            this.showMessage(`Content validation: PASSED (${results.quests} quests, ${results.cases} cases)`, 'normal');
        } else {
            this.showMessage(`Content validation: ${results.validationErrors.length} errors found`, 'error');
        }
    }

    // ==================== Helper UI ====================

    /**
     * Show selection menu for teleport/incident options
     */
    showSelectionMenu(title, options) {
        const overlay = document.createElement('div');
        overlay.id = 'dev-selection-overlay';
        overlay.className = 'dev-overlay';
        overlay.style.display = 'block';
        overlay.innerHTML = `
            <div class="dev-overlay-header">
                <h3>${title}</h3>
                <button id="dev-close">&times;</button>
            </div>
            <div class="dev-overlay-content">
                <div class="dev-actions">
                    ${options.map(opt => `
                        <button class="dev-btn" data-id="${opt.id}">
                            <span class="dev-btn-label">${opt.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Close button
        overlay.querySelector('#dev-close').addEventListener('click', () => {
            overlay.remove();
        });

        // Action buttons
        options.forEach(opt => {
            const btn = overlay.querySelector(`[data-id="${opt.id}"]`);
            if (btn) {
                btn.addEventListener('click', () => {
                    opt.callback();
                    overlay.remove();
                });
            }
        });
    }

    /**
     * Setup keybindings for debug actions
     */
    setupKeybindings() {
        // F1: Toggle dev menu
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggle();
            }
            // F2: Fast-forward toggle
            if (e.key === 'F2' && e.ctrlKey) {
                e.preventDefault();
                this.toggleFastForward();
            }
            // Ctrl+F3: Grant resources
            if (e.ctrlKey && e.key === 'F3') {
                e.preventDefault();
                this.grantResources({ gold: 1000, wood: 1000, food: 1000, data: 1000 });
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
     * Show debug message
     */
    showMessage(message, type = 'normal') {
        console.log(`[Dev] ${message}`);
        if (this.game.ui) {
            this.game.ui.showMessage(`[DEV] ${message}`, type);
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
