// UI manager for DOM + third-person 3D rendering
import { BUILDING_TYPES, BUILDING_SECURITY } from './constants.js';
import { Renderer3D } from './renderer3d.js';
import { MapScreen } from './ui/map_screen.js';
import { TechScreen } from './ui/tech_screen.js';
import { SettingsManager } from './ui/settings.js';
import { createAudioManager } from './audio/audio_manager.js';
import { getInteractableTypeInfo, getInteractableStateName } from './sim/interactables.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.selectedBuilding = null;

        // Settings
        this.settings = new SettingsManager(game);

        // Audio
        this.audioManager = createAudioManager(game);

        // 3D
        this.renderer3d = new Renderer3D(this.game, this.canvas);

        // Input
        this.keys = new Set();
        this.isRDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Dirty flags
        this._lastBuildingCount = 0;
        this._lastCitizenCount = 0;

        // Action prompt state
        this.actionPrompt = null;
        this.actionCallback = null;

        this.setupBuildingPanel();
        this.setupInfoTabs();
        this.setupInput();
        this.setupGlobalShortcuts();
    }

    onWorldRebuilt() {
        this.renderer3d.rebuildWorld();
        this._lastBuildingCount = 0;
        this._lastCitizenCount = 0;
    }

    resetCamera() {
        this.renderer3d.yaw = 0;
        this.renderer3d.pitch = -0.35;
        this.renderer3d.followDist = 7;
        this.renderer3d.followHeight = 4;
    }

    setPlayerTile(x, y) {
        this.game.player.x = Math.max(0, Math.min(this.game.map.width - 1, x));
        this.game.player.y = Math.max(0, Math.min(this.game.map.height - 1, y));
        this.game.player.wx = this.game.player.x + 0.5;
        this.game.player.wz = this.game.player.y + 0.5;
    }

    setupBuildingPanel() {
        const grid = document.getElementById('building-grid');
        if (!grid) return;
        grid.innerHTML = '';

        // Add basic buildings
        for (const [key, building] of Object.entries(BUILDING_TYPES)) {
            this.createBuildingCard(grid, key, building);
        }

        // Add security buildings (only if unlocked via progression)
        for (const [key, security] of Object.entries(BUILDING_SECURITY)) {
            // Check if player has unlocked security buildings
            const securityUnlocked = this.game.state.progression?.unlocked?.includes('security_buildings');
            if (securityUnlocked) {
                this.createBuildingCard(grid, key, security, true);
            }
        }
    }

    createBuildingCard(grid, key, building, isSecurity = false) {
        const card = document.createElement('div');
        card.className = `building-card ${isSecurity ? 'security-building' : ''}`;
        card.dataset.type = key;
        card.innerHTML = `
            <div class="building-icon">${building.icon}</div>
            <div class="building-info">
                <div class="building-name">${building.name}</div>
                <div class="building-desc">${building.description || ''}</div>
                <div class="building-cost">
                    ${building.cost.gold ? `<span class="cost-item gold">💰${building.cost.gold}</span>` : ''}
                    ${building.cost.wood ? `<span class="cost-item wood">🌲${building.cost.wood}</span>` : ''}
                    ${building.cost.food ? `<span class="cost-item food">🌾${building.cost.food}</span>` : ''}
                </div>
                ${isSecurity ? `<div class="building-security-note">Reduces heat & rival effectiveness</div>` : ''}
            </div>
        `;
        card.addEventListener('click', () => {
            document.querySelectorAll('.building-card').forEach(o => o.classList.remove('selected'));
            card.classList.add('selected');
            this.selectedBuilding = key;
            this.showMessage(`Selected: ${building.name}`, 'success');
            this.playUISound('click');
        });
        grid.appendChild(card);
    }

    setupInfoTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.dataset.tab;

                if (tabName === 'stats') {
                    document.getElementById('message-log').classList.add('hidden');
                    document.getElementById('stats-panel').classList.remove('hidden');
                    this.updateStats();
                } else {
                    document.getElementById('message-log').classList.remove('hidden');
                    document.getElementById('stats-panel').classList.add('hidden');
                }
            });
        });
    }

    setupGlobalShortcuts() {
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.game.saveGame();
            }
            if (e.key.toLowerCase() === 'p') {
                this.game.paused = !this.game.paused;
                this.showMessage(this.game.paused ? '⏸️ Paused' : '▶️ Resumed', 'normal');
            }
            if (e.key.toLowerCase() === 'm') {
                this.toggleMapScreen();
            }
            if (e.key.toLowerCase() === 'e') {
                this.handleEKey();
            }
            if (e.key.toLowerCase() === 't') {
                this.toggleTechScreen();
            }
            if (e.key.toLowerCase() === 'o' && e.shiftKey) {
                this.toggleSettings();
            }
        });
        // Add map screen reference
        this.mapScreen = null;
        // Add tech screen reference
        this.techScreen = null;
    }

    setupInput() {
        // Movement keys
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'shift'].includes(k)) this.keys.add(k);
        });
        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            this.keys.delete(k);
        });

        // Right-drag camera orbit
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                this.isRDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.canvas.style.cursor = 'grabbing';
                return;
            }

            // Left click: build/inspect
            if (e.button === 0) {
                const tile = this.renderer3d.pickTile(e.clientX, e.clientY);
                if (!tile) return;

                if (this.selectedBuilding) {
                    this.game.attemptBuild(this.selectedBuilding, tile.x, tile.y);
                    this.renderer3d.markBuildingsDirty();
                } else {
                    this.game.showTileInfo(tile.x, tile.y);
                    this.updateStats();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            this.isRDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isRDragging) return;
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            this.renderer3d.yaw -= dx * 0.005;
            this.renderer3d.pitch -= dy * 0.003;
            this.renderer3d.pitch = Math.max(-1.2, Math.min(-0.1, this.renderer3d.pitch));
        });
    }

    updatePlayerMovement(dtMs) {
        const dt = Math.min(0.05, dtMs / 1000);
        const speed = this.keys.has('shift') ? 5.0 : 3.0; // tiles/sec

        let mx = 0;
        let mz = 0;
        if (this.keys.has('w')) mz -= 1;
        if (this.keys.has('s')) mz += 1;
        if (this.keys.has('a')) mx -= 1;
        if (this.keys.has('d')) mx += 1;

        if (mx === 0 && mz === 0) return;

        // Normalize
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;

        // Camera-relative movement
        const yaw = this.renderer3d.yaw;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        const dx = (mx * cos - mz * sin) * speed * dt;
        const dz = (mx * sin + mz * cos) * speed * dt;

        const nx = this.game.player.wx + dx;
        const nz = this.game.player.wz + dz;

        // Collision against water tiles
        const tx = Math.floor(nx);
        const ty = Math.floor(nz);
        if (tx < 0 || ty < 0 || tx >= this.game.map.width || ty >= this.game.map.height) return;
        const tile = this.game.map.getTileAt(tx, ty);
        if (tile === 0) return; // water

        this.game.player.wx = nx;
        this.game.player.wz = nz;
        this.game.player.x = tx;
        this.game.player.y = ty;
    }

    render(dt) {
        // Rebuild instances when needed
        if (this.game.buildings.buildings.length !== this._lastBuildingCount) {
            this._lastBuildingCount = this.game.buildings.buildings.length;
            this.renderer3d.markBuildingsDirty();
        }
        if (this.game.citizens.citizens.length !== this._lastCitizenCount) {
            this._lastCitizenCount = this.game.citizens.citizens.length;
            this.renderer3d.markCitizensDirty();
        }

        if (!this.game.paused) {
            this.updatePlayerMovement(dt);
            // Check for nearby interactables
            this.checkInteractableProximity();
        }
        this.renderer3d.render();
    }

    updateResources(resources) {
        document.getElementById('gold-amount').textContent = Math.floor(resources.gold);
        document.getElementById('food-amount').textContent = Math.floor(resources.food);
        document.getElementById('wood-amount').textContent = Math.floor(resources.wood);
        document.getElementById('population-amount').textContent = resources.population;
        document.getElementById('day-amount').textContent = `Day ${resources.day}`;

        // Overcrowding warning
        const popDisplay = document.getElementById('population-display');
        if (resources.population > resources.housing) {
            popDisplay.style.border = '3px solid #ff6b6b';
            popDisplay.style.boxShadow = '0 4px 0 #ff6b6b';
        } else {
            popDisplay.style.border = '3px solid #fff';
            popDisplay.style.boxShadow = '0 4px 0 rgba(0,0,0,0.15)';
        }

        // Heat meter
        const player = this.game.state.player || {};
        const heat = player.heat || 0;
        this.updateHeatMeter(heat);
    }

    updateHeatMeter(heat) {
        // Check if heat meter already exists, create if not
        let heatContainer = document.getElementById('heat-meter');
        if (!heatContainer) {
            const resourceBar = document.getElementById('resource-bar');
            if (!resourceBar) return;

            heatContainer = document.createElement('div');
            heatContainer.id = 'heat-meter';
            heatContainer.className = 'resource heat-meter';
            heatContainer.innerHTML = `
                <span class="icon">🔥</span>
                <div class="heat-bar-container">
                    <div class="heat-bar" id="heat-bar">
                        <div class="heat-fill" id="heat-fill"></div>
                    </div>
                    <span class="heat-label" id="heat-label">0</span>
                </div>
            `;
            resourceBar.appendChild(heatContainer);
        }

        const heatFill = document.getElementById('heat-fill');
        const heatLabel = document.getElementById('heat-label');

        if (heatFill) {
            heatFill.style.width = `${heat}%`;
        }

        if (heatLabel) {
            heatLabel.textContent = `${heat}`;
            // Visual warning at high heat
            heatContainer.style.borderColor = heat >= 70 ? '#ff4444' : (heat >= 30 ? '#ffaa00' : '#44ff44');
        }
    }

    showMessage(message, type = 'normal') {
        const log = document.getElementById('message-log');
        if (!log) return;

        const entry = document.createElement('div');
        entry.className = `message ${type}`;
        const day = this.game.resources.day;
        const dayText = type === 'day-start' ? '' : `[Day ${day}] `;
        entry.innerHTML = `<span class="day-indicator">${dayText}</span>${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;

        if (log.children.length > 80) log.removeChild(log.firstChild);
    }

    updateStats() {
        const citizens = this.game.citizens;
        const stats = document.getElementById('stats-pop');
        const employment = document.getElementById('stats-employment');
        const happiness = document.getElementById('stats-happiness');
        const housing = document.getElementById('stats-housing');

        const jobGold = document.getElementById('stats-job-gold');
        const jobFood = document.getElementById('stats-job-food');
        const jobWood = document.getElementById('stats-job-wood');
        const jobDist = document.getElementById('stats-job-dist');

        if (stats) stats.textContent = citizens.getPopulation();
        if (employment) employment.textContent = citizens.getEmploymentRate() + '%';
        if (happiness) happiness.textContent = citizens.getAverageHappiness() + '%';
        if (housing) housing.textContent = `${this.game.resources.population}/${this.game.resources.housing}`;

        // Job production (last computed tick)
        const jp = this.game.resources.jobProduction || { gold: 0, food: 0, wood: 0 };
        if (jobGold) jobGold.textContent = Math.floor(jp.gold || 0);
        if (jobFood) jobFood.textContent = Math.floor(jp.food || 0);
        if (jobWood) jobWood.textContent = Math.floor(jp.wood || 0);

        // Job distribution
        if (jobDist) {
            const dist = new Map();
            for (const c of citizens.citizens) {
                const j = (c.job || 'unemployed');
                dist.set(j, (dist.get(j) || 0) + 1);
            }
            const employed = Array.from(dist.entries()).filter(([j]) => j !== 'unemployed');
            if (employed.length === 0) {
                jobDist.textContent = 'No employed citizens';
            } else {
                employed.sort((a, b) => b[1] - a[1]);
                jobDist.textContent = employed.map(([j, n]) => `${j}: ${n}`).join(' • ');
            }
        }
    }

    showVictory(condition, progress) {
        const overlay = document.getElementById('victory-overlay');
        const title = document.getElementById('victory-title');
        const message = document.getElementById('victory-message');
        const progressFill = document.getElementById('victory-progress');
        const finalDays = document.getElementById('final-days');
        const finalPop = document.getElementById('final-pop');
        const finalBuildings = document.getElementById('final-buildings');
        const finalGold = document.getElementById('final-gold');
        if (!overlay) return;

        title.textContent = `${condition} Victory!`;
        message.textContent = `You achieved ${condition.toLowerCase()} dominance with ${this.game.resources.population} citizens.`;
        finalDays.textContent = this.game.resources.day;
        finalPop.textContent = this.game.resources.population;
        finalBuildings.textContent = this.game.buildings.buildings.length;
        finalGold.textContent = Math.floor(this.game.resources.gold);
        progressFill.style.width = `${Math.min(100, progress)}%`;
        overlay.classList.remove('hidden');
    }

    showDefeat(reason, message) {
        const overlay = document.getElementById('defeat-overlay');
        const title = document.getElementById('defeat-title');
        const desc = document.getElementById('defeat-message');
        const finalDays = document.getElementById('defeat-days');
        const finalPop = document.getElementById('defeat-pop');
        const finalBuildings = document.getElementById('defeat-buildings');
        const finalGold = document.getElementById('defeat-gold');
        if (!overlay) return;

        title.textContent = reason;
        desc.textContent = message || `Your city has fallen due to ${reason.toLowerCase()}.`;
        finalDays.textContent = this.game.resources.day;
        finalPop.textContent = this.game.resources.population;
        finalBuildings.textContent = this.game.buildings.buildings.length;
        finalGold.textContent = Math.floor(this.game.resources.gold);
        overlay.classList.remove('hidden');
    }

    showRivalActivity(action) {
        const log = document.getElementById('message-log');
        if (!log) return;

        const entry = document.createElement('div');
        entry.className = 'message rival-action';
        entry.innerHTML = `<span class="icon">🕵️</span> <strong>Rival Action:</strong> ${action.name}`;
        log.prepend(entry);

        // Keep log size reasonable
        if (log.children.length > 50) {
            log.lastChild.remove();
        }
    }

    showCrisis(crisis, options, onPick) {
        const overlay = document.getElementById('crisis-overlay');
        const title = document.getElementById('crisis-title');
        const desc = document.getElementById('crisis-desc');
        const list = document.getElementById('crisis-options');
        if (!overlay || !title || !desc || !list) return;

        title.textContent = crisis.name;
        desc.textContent = `Choose your response. (Seed: ${this.game.seed})`;
        list.innerHTML = '';

        for (const opt of options) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = formatOption(opt);
            btn.addEventListener('click', () => {
                overlay.classList.add('hidden');
                onPick(opt);
            });
            list.appendChild(btn);
        }

        overlay.classList.remove('hidden');
    }

    toggleMapScreen() {
        if (!this.mapScreen) {
            this.mapScreen = new MapScreen(this.game);
        }
        this.mapScreen.toggle();
    }

    toggleTechScreen() {
        if (!this.techScreen) {
            this.techScreen = new TechScreen(this.game);
        }
        this.techScreen.toggle();
    }

    checkInteractableProximity() {
        if (this.game.interactables) {
            const node = this.game.interactables.getNearbyInteractable(
                this.game.player.x,
                this.game.player.y,
                3
            );
            if (node) {
                const typeInfo = getInteractableTypeInfo(node.type);
                const stateName = getInteractableStateName(node.state);
                this.showMessage(` Nearby ${typeInfo.name}: ${stateName} (Press E to hack)`, 'normal');
            }
        }
    }

    handleEKey() {
        // Handle E key for hacking interactables
        if (this.game.interactables) {
            const node = this.game.interactables.getNearbyInteractable(
                this.game.player.x,
                this.game.player.y,
                3
            );
            if (node && node.state === 'available') {
                this.game.interactables.startHack(node, this.game.state.time.tick);
                this.showMessage(`Hacking ${getInteractableTypeInfo(node.type).name}...`, 'normal');
            }
        }
    }

    /**
     * Show action prompt (for quest steps like hacking)
     */
    showActionPrompt(actionLabel, callback) {
        this.actionPrompt = actionLabel;
        this.actionCallback = callback;

        // Create action prompt UI
        const promptDiv = document.createElement('div');
        promptDiv.id = 'action-prompt';
        promptDiv.className = 'action-prompt';
        promptDiv.innerHTML = `<span class="prompt-text">Press SPACE to ${actionLabel}</span>`;
        document.body.appendChild(promptDiv);

        // Setup space key handler
        this.actionKeyHandler = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.actionCallback) {
                    this.actionCallback();
                }
                this.clearActionPrompt();
            }
        };
        window.addEventListener('keydown', this.actionKeyHandler);
    }

    /**
     * Clear action prompt
     */
    clearActionPrompt() {
        if (this.actionPrompt) {
            const promptDiv = document.getElementById('action-prompt');
            if (promptDiv) promptDiv.remove();

            if (this.actionKeyHandler) {
                window.removeEventListener('keydown', this.actionKeyHandler);
                this.actionKeyHandler = null;
            }

            this.actionPrompt = null;
            this.actionCallback = null;
        }
    }

    /**
     * Show quest choice dialog
     */
    showQuestChoice(title, choices, onChoice) {
        const overlay = document.getElementById('quest-choice-overlay');
        if (!overlay) return;

        const titleEl = document.getElementById('quest-choice-title');
        const listEl = document.getElementById('quest-choice-list');

        if (!titleEl || !listEl) return;

        titleEl.textContent = title;
        listEl.innerHTML = '';

        for (const choice of choices) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = choice.label;
            btn.addEventListener('click', () => {
                overlay.classList.add('hidden');
                onChoice(choice);
            });
            listEl.appendChild(btn);
        }

        overlay.classList.remove('hidden');
        this.questChoiceCallback = onChoice;
    }

    /**
     * Handle quest choice resolution
     */
    resolveQuestChoice(choiceId) {
        if (this.questChoiceCallback) {
            const choice = this.game.questEngine.getQuestById(this.selectedQuestId)?.data?.choices?.find(c => c.id === choiceId);
            if (choice) {
                this.questChoiceCallback(choice);
                this.questChoiceCallback = null;
            }
        }
    }

    /**
     * Toggle settings menu
     */
    toggleSettings() {
        this.settings.toggle();
    }

    /**
     * Play UI sound via audio manager
     */
    playUISound(type) {
        if (this.audioManager) {
            const soundMap = {
                'click': 'playClick',
                'slider': 'playSlider',
                'success': 'playSuccess',
                'error': 'playError'
            };
            const method = soundMap[type];
            if (method && this.audioManager[method]) {
                this.audioManager[method]();
            }
        }
    }

    /**
     * Setup settings on renderer
     */
    applySettings() {
        if (this.renderer3d) {
            this.renderer3d.mouseSensitivity = this.settings.get('mouseSensitivity');
            this.renderer3d.invertY = this.settings.get('invertY');
            this.renderer3d.setRenderScale(this.settings.get('renderScale'));
            this.renderer3d.setShowFPS(this.settings.get('showFPS'));
        }
    }
}

function formatOption(opt) {
    const parts = [opt.label];
    const cost = opt.cost || {};
    const costParts = [];
    if (cost.gold) costParts.push(`💰${cost.gold}`);
    if (cost.wood) costParts.push(`🌲${cost.wood}`);
    if (cost.food) costParts.push(`🌾${cost.food}`);
    if (costParts.length) parts.push(`(Cost: ${costParts.join(' ')})`);
    return parts.join(' ');
}