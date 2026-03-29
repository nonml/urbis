// UI manager for DOM + third-person 3D rendering
import { BUILDING_TYPES, BUILDING_SECURITY } from './constants.js';
import { BUILDING_EXTENDED, isBuildingUnlocked, getBuildingRequirements } from './buildings_extended.js';
import { resourceStore } from './stores/resources.js';
import { statsStore } from './stores/stats.js';
import { MapScreen } from './ui/map_screen.js';
import { MODE_STREET, MODE_GOD, MODE_LABELS } from './ui/mode_indicator.js';
import { TechScreen } from './ui/tech_screen.js';
import { SettingsManager } from './ui/settings.js';
import { createThemeManager, ScreenReaderAnnouncer } from './ui/theme.js';
import { BuildMenu } from './ui/build_menu.js';
import { CaseFileUI } from './ui/case_file.js';
import { FactionsPanel } from './ui/factions_panel.js';
import { CitizenProfileUI } from './ui/citizen_profile.js';
import { PoliticsPanel } from './ui/politics_panel.js';
import { CodexUI } from './ui/codex.js';
import { FeedbackUI } from './ui/feedback.js';
import { NewsFeedPanel } from './ui/news_feed.js';
import { createAudioManager } from './audio/audio_manager.js';
import { getProceduralMusic } from './audio/procedural_music.js';
import { getInteractableTypeInfo, getInteractableStateName } from './sim/interactables.js';
import { eventBus, EVENT_TYPES } from './sim/events.js';
import { createVictoryScreen, AchievementNotification } from './ui/victory_screen.js';
import { updatePlayerMovement, createPlayerState } from './player/controller.js';
import { validatePlacement } from './build/placement.js';
import { HackList } from './ui/hack_list.js';
import { BreachMinigame } from './ui/breach_minigame.js';
import { HackNetwork } from './ui/hack_network.js';
import { createTutorialOverlay, TutorialOverlay } from './ui/tutorial_overlay.js';
import { TooltipManager } from './ui/tooltips.js';
import { PhotoMode } from './ui/photo_mode.js';
import { VehicleAudio } from './audio/vehicle_audio.js';
import { ActionHUD } from './ui/action_hud.js';


export class UIManager {
    constructor(game) {
        console.log('[UIManager] Constructor called!');
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.selectedBuilding = null;
        this.lastBuildAttemptAt = 0;

        // Settings
        this.settings = new SettingsManager(game);
        // Wire manager into the Svelte SettingsPanel once it's mounted
        if (window._settingsPanelComponent) {
            window._settingsPanelComponent.$set({ manager: this.settings });
        }
        // Wire game reference into the Svelte NewsFeedPanel
        if (window._newsFeedComponent) {
            window._newsFeedComponent.$set({ game });
        }

        // Theme manager
        this.themeManager = createThemeManager();
        window.themeManager = this.themeManager;

        // ─── NEW HUD SYSTEM ───
        this._initNewHUD();

        // Screen reader announcer (accessibility)
        this.srAnnouncer = new ScreenReaderAnnouncer();
        this._setupScreenReaderListeners();

        // Audio
        this.audioManager = createAudioManager(game);

        // Initialize audio context on first user interaction (browser autoplay policy)
        const _initAudio = async () => {
            if (this.audioManager && !this.audioManager.isInitialized) {
                await this.audioManager.initialize();
                console.log('[Audio] Initialized:', {
                    isInitialized: this.audioManager.isInitialized,
                    canPlay: this.audioManager.canPlay,
                    context: this.audioManager.context?.state
                });
            }
            window.removeEventListener('click', _initAudio);
            window.removeEventListener('keydown', _initAudio);
        };
        window.addEventListener('click', _initAudio, { once: true });
        window.addEventListener('keydown', _initAudio, { once: true });

        // Procedural music (6D) — starts on first user gesture (browser audio policy)
        this.proceduralMusic = getProceduralMusic(game);
        const _startMusic = () => {
            this.proceduralMusic?.start();
            window.removeEventListener('click', _startMusic);
            window.removeEventListener('keydown', _startMusic);
        };
        window.addEventListener('click', _startMusic, { once: true });
        window.addEventListener('keydown', _startMusic, { once: true });

        // Victory screen
        this.victoryScreen = createVictoryScreen();
        this.achievementNotification = new AchievementNotification();

        // Tutorial
        this.tutorial = createTutorialOverlay(this.game);

        // 3D
        // renderer3d is null until loadRenderer3D() resolves
        this.renderer3d = null;

        // Input
        this.keys = new Set();
        this.isRDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Edge panning configuration (God mode only)
        this.edgePanDeadzone = 0.9; // 90% deadzone - only outer 10% triggers panning
        this.edgePanSpeed = 2.0; // Pan speed multiplier
        this.edgePanVelocity = { x: 0, y: 0 };
        this.edgePanAcceleration = 15.0; // Acceleration per second
        this.edgePanDamping = 0.92; // Velocity damping when not at edge

        // Dirty flags
        this._lastBuildingCount = 0;
        this._lastCitizenCount = 0;

        // Action prompt state (Ticket B-3)
        this.actionPrompt = null;
        this.actionCallback = null;
        this.currentInteractable = null; // Track the interactable being displayed
        this.lastInteractable = null; // Track previously shown interactable
        this.hackScanVisible = true;
        this.scannedHackables = [];
        this.hackList = new HackList(this.game);
        this.breachMinigame = new BreachMinigame(this.game);
        this.hackNetwork = new HackNetwork(this.game);
        this.photoMode = new PhotoMode(this.game);
        this.actionHUD = new ActionHUD(this.game);
        this._breachWasPaused = false;

        // Player movement state (third-person controller)
        this.playerState = createPlayerState();
        this.lastMovementTime = 0;
        this.simDt = 0.04; // Default sim tick dt (1000ms / 24 ticks per day)
        this.questChoiceOptions = [];
        this._keyHandlers = new Map();

        this.setupBuildingPanel();
        this.buildMenu = new BuildMenu(this);
        this.caseFileUI = new CaseFileUI(this.game);
        this.factionsPanel = new FactionsPanel(this.game);
        this.citizenProfileUI = new CitizenProfileUI(this.game);
        this.politicsPanel = new PoliticsPanel(this.game);
        this.codexUI = new CodexUI(this.game);
        this.feedbackUI = new FeedbackUI(this.game);
        this.newsFeedPanel = new NewsFeedPanel(this.game);
        this.setupInfoTabs();
        this.setupSettingsButton();
        this.setupInput();
        this.setupGlobalShortcuts();

        // Auto-init 3D renderer on boot (City Skylines-style). If it fails, we fall back gracefully.
        this.loadRenderer3D();
    }

    // ═══════════════════════════════════════
    // NEW HUD SYSTEM — Init & Update Methods
    // ═══════════════════════════════════════

    _initNewHUD() {
        // Cache HUD element references
        this._wantedStars = document.querySelectorAll('#wanted-stars .star');
        this._heatLabel = document.getElementById('heat-label');
        this._tickerPopVal = document.getElementById('ticker-pop-val');
        this._tickerFundsVal = document.getElementById('ticker-funds-val');
        this._tickerTimeVal = document.getElementById('ticker-time-val');
        this._tickerWeatherIcon = document.getElementById('ticker-weather-icon');
        this._healthFill = document.getElementById('health-fill');
        this._healthVal = document.getElementById('health-val');
        this._staminaFill = document.getElementById('stamina-fill');
        this._staminaVal = document.getElementById('stamina-val');
        this._hudStreetLayer = document.getElementById('hud-street-layer');
        this._hudGodLayer = document.getElementById('hud-god-layer');
        this._toggleLabel = document.getElementById('toggle-label');
        this._toggleIcon = document.getElementById('toggle-icon');
        this._minimapModeLabel = document.getElementById('minimap-mode-label');
        this._profilerTooltip = document.getElementById('profiler-tooltip');
        this._networkVision = document.getElementById('network-vision');
        this._smartphoneOverlay = document.getElementById('smartphone-overlay');
        this._pauseOverlay = document.getElementById('pause-overlay');
        this._breachWindow = document.getElementById('breach-window');
        this._lastWantedLevel = 0;

        // Mode toggle button
        const modeToggleBtn = document.getElementById('mode-toggle-btn');
        if (modeToggleBtn) {
            modeToggleBtn.addEventListener('click', () => {
                this.toggleGameMode();
                this.playUISound('click');
            });
        }

        // Pause menu buttons
        this._setupPauseMenu();

        // Smartphone menu
        this._setupSmartphoneMenu();

        // Panel close buttons
        document.querySelectorAll('.panel-close[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelId = btn.dataset.close;
                const panel = document.getElementById(panelId);
                if (panel) panel.classList.add('hidden');
                this.playUISound('click');
            });
        });

        // Budget sliders
        this._setupBudgetSliders();

        // Network Vision toggle (already on 'h' key for hack scan, add 'g' for network vision)
        // Build ribbon category clicks
        document.querySelectorAll('.ribbon-category').forEach(cat => {
            cat.addEventListener('click', () => {
                document.querySelectorAll('.ribbon-category').forEach(c => c.classList.remove('active'));
                cat.classList.add('active');
                this.playUISound('click');
            });
        });
    }

    _setupPauseMenu() {
        const resumeBtn = document.getElementById('pause-resume');
        const saveBtn = document.getElementById('pause-save');
        const loadBtn = document.getElementById('pause-load');
        const settingsBtn = document.getElementById('pause-settings');
        const exitBtn = document.getElementById('pause-exit');

        if (resumeBtn) resumeBtn.addEventListener('click', () => {
            this._pauseOverlay?.classList.add('hidden');
            this.game.paused = false;
            this.playUISound('click');
        });
        if (saveBtn) saveBtn.addEventListener('click', () => {
            this.game.saveGame();
            this.showMessage('City saved.', 'success');
            this.playUISound('success');
        });
        if (loadBtn) loadBtn.addEventListener('click', () => {
            this.game.loadGame();
            this._pauseOverlay?.classList.add('hidden');
            this.playUISound('click');
        });
        if (settingsBtn) settingsBtn.addEventListener('click', () => {
            this.toggleSettings();
            this.playUISound('click');
        });
        if (exitBtn) exitBtn.addEventListener('click', () => {
            this._pauseOverlay?.classList.add('hidden');
            this.game.stop?.();
            window.showStartScreen?.();
            this.playUISound('click');
        });
    }

    _setupSmartphoneMenu() {
        document.querySelectorAll('.phone-app').forEach(app => {
            app.addEventListener('click', () => {
                const appName = app.dataset.app;
                this._openPhoneApp(appName);
                this.playUISound('click');
            });
        });
    }

    _openPhoneApp(appName) {
        const phonePanel = document.getElementById('phone-panel');
        if (!phonePanel) return;

        switch (appName) {
            case 'missions':
                this._smartphoneOverlay?.classList.add('hidden');
                this.caseFileUI?.toggle();
                break;
            case 'upgrades':
                this._smartphoneOverlay?.classList.add('hidden');
                this.toggleTechScreen();
                break;
            case 'vehicles': {
                const vc = this.game.vehicleController;
                if (vc) {
                    vc.summonVehicle?.(this.game.player.wx ?? this.game.player.x, this.game.player.wz ?? this.game.player.y);
                    this.showMessage('Vehicle summoned nearby.', 'success');
                }
                this._smartphoneOverlay?.classList.add('hidden');
                break;
            }
            case 'inventory':
                phonePanel.classList.remove('hidden');
                phonePanel.innerHTML = `<div class="phone-panel-title">INVENTORY</div><p style="color:var(--text-dim);font-size:11px;">No items collected yet.</p>`;
                break;
            case 'economy':
                this._smartphoneOverlay?.classList.add('hidden');
                document.getElementById('economy-panel')?.classList.remove('hidden');
                break;
            case 'factions':
                this._smartphoneOverlay?.classList.add('hidden');
                // Toggle factions panel visibility
                const fp = document.getElementById('factions-panel');
                if (fp) fp.classList.toggle('visible');
                break;
            case 'transit':
                this._smartphoneOverlay?.classList.add('hidden');
                document.getElementById('transit-panel')?.classList.remove('hidden');
                break;
            case 'codex':
                this._smartphoneOverlay?.classList.add('hidden');
                this.codexUI?.open();
                break;
            default:
                phonePanel.classList.remove('hidden');
                phonePanel.innerHTML = `<div class="phone-panel-title">${appName.toUpperCase()}</div><p style="color:var(--text-dim);font-size:11px;">Coming soon...</p>`;
        }
    }

    _setupBudgetSliders() {
        const sliders = [
            { id: 'tax-residential', valId: 'tax-res-val', suffix: '%' },
            { id: 'tax-commercial', valId: 'tax-com-val', suffix: '%' },
            { id: 'fund-police', valId: 'fund-police-val', suffix: '%' },
            { id: 'fund-transit', valId: 'fund-transit-val', suffix: '%' },
        ];
        for (const { id, valId, suffix } of sliders) {
            const slider = document.getElementById(id);
            const valEl = document.getElementById(valId);
            if (slider && valEl) {
                slider.addEventListener('input', () => {
                    valEl.textContent = slider.value + suffix;
                });
            }
        }
    }

    toggleSmartphone() {
        if (this._smartphoneOverlay) {
            const isOpen = !this._smartphoneOverlay.classList.contains('hidden');
            if (isOpen) {
                this._smartphoneOverlay.classList.add('hidden');
            } else {
                this._smartphoneOverlay.classList.remove('hidden');
                // Hide phone sub-panel when opening
                const phonePanel = document.getElementById('phone-panel');
                if (phonePanel) phonePanel.classList.add('hidden');
            }
        }
    }

    togglePauseMenu() {
        if (this._pauseOverlay) {
            const isOpen = !this._pauseOverlay.classList.contains('hidden');
            if (isOpen) {
                this._pauseOverlay.classList.add('hidden');
                this.game.paused = false;
            } else {
                this._pauseOverlay.classList.remove('hidden');
                this.game.paused = true;
            }
        }
    }

    toggleNetworkVision() {
        if (this._networkVision) {
            const active = !this._networkVision.classList.contains('hidden');
            if (active) {
                this._networkVision.classList.add('hidden');
                document.body.classList.remove('network-vision-active');
                this.showMessage('Network Vision: OFF', 'normal');
            } else {
                this._networkVision.classList.remove('hidden');
                document.body.classList.add('network-vision-active');
                this.showMessage('Network Vision: ON', 'success');
            }
        }
    }

    /** Update wanted stars based on heat level */
    updateWantedStars(heat) {
        // Heat is 0-100, map to 0-5 stars
        const level = Math.min(5, Math.floor(heat / 20));
        if (level === this._lastWantedLevel) return;
        this._lastWantedLevel = level;

        this._wantedStars?.forEach(star => {
            const starLevel = parseInt(star.dataset.level);
            if (starLevel <= level) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });

        const labels = ['CLEAN', 'NOTICED', 'WANTED', 'HUNTED', 'MANHUNT', 'WARGAME'];
        if (this._heatLabel) this._heatLabel.textContent = labels[level] || 'CLEAN';
    }

    /** Update top-right city ticker */
    updateCityTicker() {
        const res = this.game?.resources;
        if (!res) return;
        if (this._tickerPopVal) this._tickerPopVal.textContent = res.population || 0;
        if (this._tickerFundsVal) this._tickerFundsVal.textContent = '$' + Math.floor(res.gold || 0);
        if (this._tickerTimeVal) this._tickerTimeVal.textContent = 'Day ' + (res.day || 1);

        const ws = this.game?.weatherSystem;
        if (this._tickerWeatherIcon && ws?.getWeatherIcon) {
            this._tickerWeatherIcon.textContent = ws.getWeatherIcon();
        }
    }

    /** Update health/stamina bars */
    updateHealthBars() {
        const ph = this.game?.playerHealth;
        if (!ph) return;
        const hp = Math.max(0, Math.min(100, ph.hp ?? 100));
        const maxHp = ph.maxHp ?? 100;
        const pct = Math.round((hp / maxHp) * 100);
        if (this._healthFill) this._healthFill.style.width = pct + '%';
        if (this._healthVal) this._healthVal.textContent = hp;

        // Stamina (from player state)
        const stamina = Math.round((this.playerState?.stamina ?? 1) * 100);
        if (this._staminaFill) this._staminaFill.style.width = stamina + '%';
        if (this._staminaVal) this._staminaVal.textContent = stamina;
    }

    /** Switch HUD layers between Street and God view */
    updateHUDLayers() {
        const mode = this.game?.mode;
        if (mode === MODE_GOD) {
            this._hudStreetLayer?.classList.add('hidden');
            this._hudGodLayer?.classList.remove('hidden');
            if (this._toggleLabel) this._toggleLabel.textContent = 'GOD VIEW';
            if (this._toggleIcon) this._toggleIcon.innerHTML = '&#127961;';
            if (this._minimapModeLabel) this._minimapModeLabel.textContent = 'GOD';
        } else {
            this._hudStreetLayer?.classList.remove('hidden');
            this._hudGodLayer?.classList.add('hidden');
            if (this._toggleLabel) this._toggleLabel.textContent = 'STREET VIEW';
            if (this._toggleIcon) this._toggleIcon.innerHTML = '&#128694;';
            if (this._minimapModeLabel) this._minimapModeLabel.textContent = 'STREET';
        }
    }

    /** Update NPC profiler tooltip position (world-to-screen) */
    updateProfilerTooltip(npc, screenX, screenY) {
        if (!this._profilerTooltip || !npc) {
            this._profilerTooltip?.classList.add('hidden');
            return;
        }
        this._profilerTooltip.classList.remove('hidden');
        this._profilerTooltip.style.left = screenX + 'px';
        this._profilerTooltip.style.top = screenY + 'px';

        const nameEl = document.getElementById('profiler-name');
        const occEl = document.getElementById('profiler-occupation');
        const incEl = document.getElementById('profiler-income');
        const facEl = document.getElementById('profiler-faction');
        const secEl = document.getElementById('profiler-secret');

        if (nameEl) nameEl.textContent = npc.name || 'Unknown';
        if (occEl) occEl.textContent = 'Occupation: ' + (npc.job || 'Unemployed');
        if (incEl) incEl.textContent = 'Income: $' + (npc.income ?? 0);
        if (facEl) facEl.textContent = 'Faction: ' + (npc.faction || 'Neutral');
        if (secEl) secEl.textContent = 'Secret: ' + (npc.secret || '???');
    }

    /** Update transit stats panel */
    updateTransitPanel() {
        const tm = this.game?.transitMetrics || {};
        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('ts-mobility', Math.round((tm.mobilityBonus || 0) * 100) + '%');
        el('ts-coverage', Math.round((tm.transitCoverage || 0) * 100) + '%');
        el('ts-congestion', Math.round((tm.congestionReduction || 0) * 100) + '%');
        el('ts-routes', tm.busRoutes || 0);
    }

    async loadRenderer3D() {
        try {
            const mod = await import('./renderer3d.js');
            if (typeof mod?.createRenderer3D === 'function') {
                this.renderer3d = await mod.createRenderer3D(this.game, this.canvas);
            } else {
                const Renderer3D = mod?.Renderer3D;
                if (!Renderer3D) throw new Error('Renderer3D export missing.');
                this.renderer3d = new Renderer3D(this.game, this.canvas);
            }
            this.applySettings();
            this.showMessage('3D renderer ready.', 'success');
        } catch (e) {
            console.error('[UI] 3D renderer failed:', e);
            const short = (e?.message || String(e)).split('\n')[0].slice(0, 140);
            this.showMessage(`3D renderer failed: ${short} (see console)`, 'crisis');
        }
    }

    useCompatibilityRenderer(reason = null) {
        console.error('[UI] 3D render error:', reason);
        this.renderer3d = null;
        const short = (reason?.message || String(reason) || 'Unknown error').split('\n')[0].slice(0, 140);
        this.showMessage(`Render error: ${short} (see console)`, 'crisis');
    }

    onWorldRebuilt() {
        this.renderer3d?.rebuildWorld();
        this._lastBuildingCount = 0;
        this._lastCitizenCount = 0;
    }

    /**
     * Initialize tutorial if player hasn't completed it
     */
    initTutorial() {
        if (TutorialOverlay.shouldShowTutorial()) {
            this.tutorial.onComplete = () => {
                this.showMessage('Tutorial complete! Build your city!', 'success');
            };
            this.tutorial.start();
        }
    }

    resetCamera() {
        if (!this.renderer3d) return;
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

        // Debug: Log all building types
        console.log('[UI] BUILDING_TYPES keys:', Object.keys(BUILDING_TYPES));
        console.log('[UI] BUILDING_TYPES entries:', Object.entries(BUILDING_TYPES).map(([k, v]) => `${k}: ${v.name}`));

        // Add basic buildings
        for (const [key, building] of Object.entries(BUILDING_TYPES)) {
            console.log(`[UI] Creating building card for: ${key} (${building.name})`);
            this.createBuildingCard(grid, key, building);
        }

        // Add security buildings (only if unlocked via progression)
        for (const [key, security] of Object.entries(BUILDING_SECURITY)) {
            const securityUnlocked = this.game.state.progression?.unlocked?.includes('security_buildings');
            const rewardUnlock = this.game.state.progress?.unlocks?.buildings?.includes(key) ||
                this.game.state.progress?.unlocks?.buildings?.includes('security_buildings');
            if (securityUnlocked || rewardUnlock) {
                this.createBuildingCard(grid, key, security, true);
            }
        }

        // Populate City tab and set up tab switching
        this.refreshCityBuildingTab();
        this._setupBuildTabs();
    }

    _setupBuildTabs() {
        const tabs = document.querySelectorAll('.build-tab');
        if (!tabs.length) return;
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const which = tab.dataset.tab;
                document.getElementById('building-grid').style.display = which === 'core' ? '' : 'none';
                document.getElementById('building-grid-city').style.display = which === 'city' ? '' : 'none';
                this.playUISound('click');
            });
        });
    }

    refreshCityBuildingTab() {
        const grid = document.getElementById('building-grid-city');
        if (!grid) return;
        grid.innerHTML = '';
        const pop = this.game.resources?.population ?? 0;
        const techLevel = this.game.state?.tech?.level ?? 0;
        const cityState = { population: pop, techLevel };

        // Group extended buildings by category
        const CATEGORIES = [
            { label: 'Services',   keys: ['hospital','fire-station','school','library','university','research-lab','courthouse','prison'] },
            { label: 'Commerce',   keys: ['theater','museum','shopping-mall','hotel','restaurant','nightclub','apartment'] },
            { label: 'Industry',   keys: ['factory','water-treatment','power-plant','substation','nuclear-plant','recycling-plant','solar-farm','wind-farm'] },
            { label: 'Civic',      keys: ['airport','port','stadium'] },
            { label: 'Transit',    keys: ['bus-stop','bus-depot','metro-station','tollway-gate','highway-ramp','subway-shaft'] },
        ];

        for (const { label, keys } of CATEGORIES) {
            const validKeys = keys.filter(k => BUILDING_EXTENDED[k]);
            if (!validKeys.length) continue;
            const header = document.createElement('div');
            header.className = 'building-category-header';
            header.textContent = label;
            grid.appendChild(header);
            for (const key of validKeys) {
                const building = BUILDING_EXTENDED[key];
                const unlocked = isBuildingUnlocked(key, cityState);
                this.createBuildingCard(grid, key, building, false, !unlocked);
            }
        }
    }

    createBuildingCard(grid, key, building, isSecurity = false, isLocked = false) {
        const card = document.createElement('div');
        card.className = `building-card${isSecurity ? ' security-building' : ''}${isLocked ? ' locked' : ''}`;
        card.dataset.type = key;
        const reqText = isLocked ? getBuildingRequirements(key) : '';
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
                ${isLocked ? `<div class="building-unlock-req">🔒 Requires: ${reqText}</div>` : ''}
            </div>
        `;
        if (!isLocked) {
            card.addEventListener('click', () => {
                document.querySelectorAll('.building-card').forEach(o => o.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedBuilding = key;
                this.buildMenu.selectType(key);
                this.showMessage(`Selected: ${building.name}`, 'success');
                this.playUISound('click');
            });
        }
        grid.appendChild(card);
    }

    clearBuildSelection() {
        this.selectedBuilding = null;
        document.querySelectorAll('.building-card').forEach((card) => card.classList.remove('selected'));
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
                this.playUISound('click');
            });
        });

        // Debug info button (E-07)
        const debugBtn = document.getElementById('debug-info-btn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.copyDebugInfo());
        }
    }

    setupSettingsButton() {
        console.log('[UIManager] setupSettingsButton called');
        const settingsBtn = document.getElementById('settings-btn');
        console.log('[UIManager] settingsBtn element:', settingsBtn);
        if (settingsBtn) {
            console.log('[UIManager] Adding click listener to settings button');
            settingsBtn.addEventListener('click', () => {
                console.log('[UIManager] Settings button clicked!');
                this.playUISound('click');
                this.toggleSettings();
            });
        } else {
            console.error('[UIManager] Settings button NOT found!');
        }
    }

    /**
     * Copy debug info for bug reports (E-07)
     */
    copyDebugInfo() {
        const game = this.game;
        const state = game.state;
        const version = game.version || '1.0.0';
        const seed = state?.meta?.seed || 'unknown';
        const mapSize = state?.meta?.mapSize || 'unknown';
        const day = state?.resources?.day || 0;
        const tick = state?.tick || 0;
        const population = state?.resources?.population || 0;
        const gold = state?.resources?.gold || 0;
        const food = state?.resources?.food || 0;
        const wood = state?.resources?.wood || 0;
        const heat = state?.player?.heat || 0;
        const buildings = state?.buildings?.list?.length || 0;
        const district = game.map?.getDistrictAt?.(state?.player?.x || 0, state?.player?.y || 0) ?? 'unknown';

        const debugInfo = `=== Game Debug Info ===
Version: ${version}
Seed: ${seed}
Map Size: ${mapSize}
Day: ${day}
Tick: ${tick}
Player Position: (${state?.player?.x || 0}, ${state?.player?.y || 0})
District: ${district}

=== Resources ===
Gold: ${gold}
Food: ${food}
Wood: ${wood}
Population: ${population}
Housing: ${state?.resources?.housing || 0}
Heat: ${heat}

=== City Stats ===
Buildings: ${buildings}
Citizens: ${state?.citizens?.list?.length || 0}

=== Rival Status ===
Influence: ${state?.rival?.influence || 0}
Budget: ${state?.rival?.budget || 0}
Rival Heat: ${state?.rival?.heat || 0}

=== System Info ===
User Agent: ${navigator.userAgent}
Screen: ${window.screen.width}x${window.screen.height}
LocalStorage Keys: ${Object.keys(localStorage).length}

=== Instructions ===
Paste this info with your bug report at: docs/BUG_REPORT.md`;

        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(debugInfo).then(() => {
                this.showMessage('Debug info copied to clipboard!', 'success');
            }).catch(() => {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = debugInfo;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showMessage('Debug info copied to clipboard!', 'success');
            });
        } else {
            // Older fallback
            const textarea = document.createElement('textarea');
            textarea.value = debugInfo;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showMessage('Debug info copied to clipboard!', 'success');
        }
    }

    setupGlobalShortcuts() {
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.game.saveGame();
            }
            if (e.key.toLowerCase() === 'p' && !e.ctrlKey) {
                // P key: toggle pause menu overlay
                this.togglePauseMenu();
            }
            if (e.key.toLowerCase() === 'm') {
                // M key: toggle smartphone menu (DedSec phone)
                this.toggleSmartphone();
            }
            if (e.key.toLowerCase() === 'e') {
                if (this.selectedBuilding) {
                    e.preventDefault();
                    this.buildMenu.rotateCW();
                    this.updateBuildGhost();
                } else {
                    this.handleEKey();
                }
            }
            if (e.key === 'F8') {
                e.preventDefault();
                this.photoMode?.toggle();
            }
            // Weapon switching: 1 = fist, 2 = pistol, scroll = cycle
            if (e.key === '1' && this.game.combat) {
                this.game.combat.currentWeapon = 'fist';
                this.showMessage('Equipped: Fists', 'normal');
            }
            if (e.key === '2' && this.game.combat) {
                this.game.combat.currentWeapon = 'pistol';
                this.showMessage('Equipped: Pistol', 'normal');
            }
            if (e.key.toLowerCase() === 'f') {
                e.preventDefault();
                const vc = this.game.vehicleController;
                if (vc) {
                    if (vc.isDriving) {
                        vc.exitVehicle();
                        if (this.renderer3d?._player) this.renderer3d._player.visible = true;
                        this.renderer3d?.syncPlayer();
                        // Stop vehicle audio
                        this._vehicleAudio?.stop();
                    } else {
                        const px = this.game.player.wx ?? this.game.player.x;
                        const py = this.game.player.wz ?? this.game.player.y;
                        const result = vc.enterVehicle(px, py);
                        if (result.ok) {
                            if (this.renderer3d?._player) this.renderer3d._player.visible = false;
                            // Start vehicle audio
                            const am = this.audioManager;
                            if (am?.context && am.isInitialized) {
                                if (!this._vehicleAudio) {
                                    this._vehicleAudio = new VehicleAudio(am.context, am.masterGain);
                                }
                                this._vehicleAudio.start();
                            }
                        }
                    }
                }
            }
            if (e.key.toLowerCase() === 'h') {
                e.preventDefault();
                this.hackScanVisible = !this.hackScanVisible;
                this.hackList.setVisible(this.hackScanVisible);
                this.showMessage(`Hack scan: ${this.hackScanVisible ? 'on' : 'off'}`, 'normal');
            }
            if (e.key.toLowerCase() === 'q') {
                if (this.selectedBuilding) {
                    e.preventDefault();
                    this.buildMenu.rotateCCW();
                    this.updateBuildGhost();
                } else if (this.game.worldHacks) {
                    e.preventDefault();
                    // Quick-hack: try traffic lights first (at road intersections),
                    // then environmental (near buildings), then standard node hack
                    const px = this.game.state.player.wx ?? this.game.state.player.x;
                    const py = this.game.state.player.wz ?? this.game.state.player.y;
                    const wh = this.game.worldHacks;

                    // Check if near a road intersection (4-way)
                    const tileX = Math.floor(px);
                    const tileY = Math.floor(py);
                    const map = this.game.map;
                    const isRoad = (tx, ty) => {
                        const t = map?.getTileAt?.(tx, ty);
                        return t === 4 || t === 7; // TERRAIN_ROAD or TERRAIN_HIGHWAY
                    };
                    const atIntersection = isRoad(tileX, tileY) &&
                        isRoad(tileX, tileY - 1) && isRoad(tileX + 1, tileY) &&
                        isRoad(tileX, tileY + 1) && isRoad(tileX - 1, tileY);

                    if (atIntersection) {
                        wh.hackTrafficLights(tileX, tileY);
                    } else {
                        // Fall back to standard quick-hack
                        wh.quickHack();
                    }
                }
            }
            if (e.key.toLowerCase() === 't') {
                this.toggleTechScreen();
            }
            if (e.key.toLowerCase() === 'c') {
                this.caseFileUI?.toggle();
            }
            // Tier 2B: News feed toggle (N key)
            if (e.key.toLowerCase() === 'n') {
                this.newsFeedPanel?.toggle();
            }

            // Citizen profile: V key
            if (e.key.toLowerCase() === 'v') {
                this._showClosestCitizenProfile();
            }

            // Milestone F: Mode toggle (Tab key)
            if (e.key === 'Tab') {
                e.preventDefault();
                this.toggleGameMode();
            }
            if (e.key.toLowerCase() === 'o' && e.shiftKey) {
                this.toggleSettings();
            }
            // Debug overlay shortcuts (Ticket C-1)
            if (e.key.toLowerCase() === 'd') {
                this.toggleDebugOverlay();
            }
            if (e.key.toLowerCase() === 'b') {
                e.preventDefault();
                const open = this.buildMenu.toggleOpen();
                this.showMessage(open ? 'Build menu opened.' : 'Build menu closed.', 'normal');
            }
            // G key: toggle network vision overlay
            if (e.key.toLowerCase() === 'g') {
                this.toggleNetworkVision();
            }
            if (e.key === 'Escape') {
                // Close various panels in priority order
                if (this._smartphoneOverlay && !this._smartphoneOverlay.classList.contains('hidden')) {
                    this._smartphoneOverlay.classList.add('hidden');
                } else if (this._pauseOverlay && !this._pauseOverlay.classList.contains('hidden')) {
                    this._pauseOverlay.classList.add('hidden');
                    this.game.paused = false;
                } else if (this.selectedBuilding) {
                    this.buildMenu.cancelBuildMode();
                    this.showMessage('Build mode canceled.', 'normal');
                } else if (this.breachMinigame.active) {
                    this.breachMinigame.finish(false);
                } else {
                    // Default: open pause menu
                    this.togglePauseMenu();
                }
            }
            if (e.key === 'F2') {
                e.preventDefault();
                this.toggleServiceOverlay();
            }
            if (/^[1-4]$/.test(e.key)) {
                const overlay = document.getElementById('quest-choice-overlay');
                if (overlay && !overlay.classList.contains('hidden') && this.questChoiceOptions?.length) {
                    const idx = Number(e.key) - 1;
                    const choice = this.questChoiceOptions[idx];
                    if (choice) {
                        e.preventDefault();
                        this.resolveQuestChoice(choice.id);
                    }
                }
            }

            // Milestone O: Roguelike meta shortcuts
            if (e.key.toLowerCase() === 's' && e.shiftKey) {
                e.preventDefault();
                this.game.shop?.show();
                this.showMessage('Open shop', 'normal');
            }
            if (e.key.toLowerCase() === 'b' && e.shiftKey) {
                e.preventDefault();
                this.game.seedBrowser?.show();
                this.showMessage('Open seed browser', 'normal');
            }

            // Milestone T: Codex (help) shortcut - press ?
            if (e.key === '?') {
                e.preventDefault();
                this.codexUI?.open();
                this.showMessage('Open Codex', 'normal');
            }

            // Milestone T: Feedback shortcut - press F12
            if (e.key === 'F12') {
                e.preventDefault();
                this.feedbackUI?.open();
                this.showMessage('Known Issues & Feedback', 'normal');
            }

            // Milestone P: Placement tool shortcuts
            if (e.key.toLowerCase() === 'p' && e.ctrlKey) {
                e.preventDefault();
                this.game.placementTool?.toggleMode();
            }
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.game.placementTool?.placeItem();
            }

            const handlers = this._keyHandlers.get(e.key.toLowerCase());
            if (handlers) {
                for (const fn of handlers) fn(e);
            }
        });
        // Add map screen reference
        this.mapScreen = null;
        // Add tech screen reference
        this.techScreen = null;
    }

    onKey(key, handler) {
        const k = String(key || '').toLowerCase();
        if (!k || typeof handler !== 'function') return;
        if (!this._keyHandlers.has(k)) this._keyHandlers.set(k, []);
        this._keyHandlers.get(k).push(handler);
    }

    setupInput() {
        // Movement keys + mode toggle + zone overlay
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'shift', ' '].includes(k)) this.keys.add(k);
            // Mode toggle: Tab key
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent focus change
                const newMode = this.game.mode === MODE_GOD ? MODE_STREET : MODE_GOD;
                this.game.mode = newMode;
                this.game.modeIndicator?.setMode(newMode);
                this.game.showMessage(`Switched to ${MODE_LABELS[newMode]}`, 'normal');
            }
            // Zone overlay: Z key
            if (e.key.toLowerCase() === 'z') {
                const renderer = this.renderer3d;
                if (renderer) {
                    const modes = ['none', 'zones', 'zoned'];
                    const currentIdx = modes.indexOf(renderer._zoneMode || 'none');
                    const nextIdx = (currentIdx + 1) % modes.length;
                    renderer.setZoneMode(modes[nextIdx]);
                    this.game.showMessage(`Zone overlay: ${modes[nextIdx]}`, 'normal');
                }
            }

            // C key: toggle crouch (street mode) or citizen profile (god mode)
            if (e.key.toLowerCase() === 'c') {
                if (this.game.mode === MODE_STREET && this.game.stealth) {
                    this.game.stealth.toggleCrouch();
                    this.game.showMessage(this.game.stealth.isCrouching ? 'Crouching' : 'Standing', 'normal');
                } else {
                    this._showClosestCitizenProfile();
                }
            }
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
                const tile = this.renderer3d?.pickTile(e.clientX, e.clientY);
                if (!tile) return;

                if (this.selectedBuilding) {
                    const now = performance.now();
                    if (now - this.lastBuildAttemptAt < 120) return;
                    this.lastBuildAttemptAt = now;

                    const result = this.game.attemptBuild(this.selectedBuilding, tile.x, tile.y, {
                        rotation: this.buildMenu.rotation,
                    });
                    if (result.ok) {
                        this.renderer3d?.markBuildingsDirty();
                        this.updateBuildGhost(tile);
                    } else {
                        this.buildMenu.updateHUD({ ok: false, reason: result.reason || 'Invalid placement.' });
                    }
                } else if (this.game.mode === MODE_STREET && this.game.combat && !this.game.playerHealth?.isDead) {
                    // Street mode: left-click fires weapon
                    const combat = this.game.combat;
                    const result = combat.fire(tile.x, tile.y);
                    if (result.hit && result.target) {
                        this.showMessage(`Hit!`, 'warning');
                    }
                    // Play gunshot SFX
                    if (combat.weapon.type === 'ranged' && this.audioManager?.sfxGenerator) {
                        this.audioManager.sfxGenerator.play('UI_CLICK', {
                            frequency: 200, frequencyEnd: 80, duration: 0.1, volume: 0.4
                        });
                    }
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
            if (this.selectedBuilding && !this.isRDragging) {
                const tile = this.renderer3d?.pickTile(e.clientX, e.clientY);
                this.updateBuildGhost(tile);
            }
            if (this.isRDragging) {
                if (!this.renderer3d) return;
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;

                this.renderer3d.yaw -= dx * this.renderer3d.mouseSensitivity;
                this.renderer3d.pitch -= dy * this.renderer3d.mouseSensitivity * 0.6;
                this.renderer3d.pitch = Math.max(-1.2, Math.min(-0.1, this.renderer3d.pitch));
                return;
            }
            
            // Edge panning for God mode (90% deadzone - only outer 10% triggers panning)
            if (this.game.mode === 'god' && this.renderer3d && !this.selectedBuilding) {
                const canvasRect = this.canvas.getBoundingClientRect();
                const canvasWidth = canvasRect.width;
                const canvasHeight = canvasRect.height;
                const mouseX = e.clientX - canvasRect.left;
                const mouseY = e.clientY - canvasRect.top;
                
                // Calculate normalized mouse position (0 to 1)
                const normX = mouseX / canvasWidth;
                const normY = mouseY / canvasHeight;
                
                // Deadzone boundaries (90% center area is inactive)
                const deadzoneLeft = (1 - this.edgePanDeadzone) / 2;
                const deadzoneRight = 1 - deadzoneLeft;
                const deadzoneTop = (1 - this.edgePanDeadzone) / 2;
                const deadzoneBottom = 1 - deadzoneTop;
                
                // Calculate edge distance (how far into the active edge zone)
                let edgeX = 0, edgeY = 0;
                
                if (normX < deadzoneLeft) {
                    edgeX = -(deadzoneLeft - normX) / deadzoneLeft; // Left edge
                } else if (normX > deadzoneRight) {
                    edgeX = (normX - deadzoneRight) / deadzoneLeft; // Right edge
                }
                
                if (normY < deadzoneTop) {
                    edgeY = -(deadzoneTop - normY) / deadzoneTop; // Top edge
                } else if (normY > deadzoneBottom) {
                    edgeY = (normY - deadzoneBottom) / deadzoneTop; // Bottom edge
                }
                
                // Apply edge panning with smooth acceleration/deceleration
                if (edgeX !== 0 || edgeY !== 0) {
                    // Accelerate towards edge direction
                    this.edgePanVelocity.x += edgeX * this.edgePanAcceleration * 0.016; // Assume ~60fps
                    this.edgePanVelocity.y += edgeY * this.edgePanAcceleration * 0.016;
                    
                    // Clamp maximum velocity
                    const maxVel = this.edgePanSpeed * 2;
                    this.edgePanVelocity.x = Math.max(-maxVel, Math.min(maxVel, this.edgePanVelocity.x));
                    this.edgePanVelocity.y = Math.max(-maxVel, Math.min(maxVel, this.edgePanVelocity.y));
                } else {
                    // Apply damping when not at edge
                    this.edgePanVelocity.x *= this.edgePanDamping;
                    this.edgePanVelocity.y *= this.edgePanDamping;
                }
                
                // Apply velocity to camera
                this.renderer3d.yaw -= this.edgePanVelocity.x * this.edgePanSpeed * 0.016;
                this.renderer3d.pitch -= this.edgePanVelocity.y * this.edgePanSpeed * 0.016 * 0.6;
                this.renderer3d.pitch = Math.max(-1.2, Math.min(-0.1, this.renderer3d.pitch));
            }
        });

        // Tooltip hover events
        this.canvas.addEventListener('mousemove', (e) => {
            const tile = this.renderer3d?.pickTile(e.clientX, e.clientY);
            if (tile) {
                const tooltipData = this.getTooltipData(tile.x, tile.y);
                if (tooltipData) {
                    this.game.tooltipManager?.show(e.clientX, e.clientY, tooltipData);
                } else {
                    this.game.tooltipManager?.hide();
                }
            } else {
                this.game.tooltipManager?.hide();
            }
            
            // Update building hover highlight
            this.renderer3d?.setHoveredTile(tile);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.game.tooltipManager?.hide();
        });
    }

    updatePlayerMovement(dtMs) {
        // dtMs is actually in seconds (from simDt = tickRate/1000)
        const dt = Math.min(0.05, dtMs);

        // Block movement when dead
        if (this.game.playerHealth?.isDead) return { moved: false };

        // If player is driving, route WASD to vehicle controller instead
        const vc = this.game.vehicleController;
        if (vc && vc.isDriving) {
            vc.setInputFromKeys({
                w: this.keys.has('w'),
                a: this.keys.has('a'),
                s: this.keys.has('s'),
                d: this.keys.has('d'),
                shift: this.keys.has('shift'),
                space: this.keys.has(' '),
            });
            // Sync renderer to vehicle position
            this.renderer3d?.syncPlayer();
            // Update vehicle audio
            const vehicle = vc.getActiveVehicle();
            if (vehicle && this._vehicleAudio) {
                this._vehicleAudio.update(
                    vehicle.speed || 0,
                    vehicle.maxSpeed || 22,
                    vehicle.driftFactor || 0
                );
                if (vc._lastCollision) {
                    this._vehicleAudio.playCollision();
                }
            }
            return { moved: true };
        }

        // Build input state from keys
        const input = {
            w: this.keys.has('w'),
            a: this.keys.has('a'),
            s: this.keys.has('s'),
            d: this.keys.has('d'),
            shift: this.keys.has('shift'),
        };

        // Update movement state
        const result = updatePlayerMovement(
            dt,
            input,
            this.renderer3d?.yaw ?? 0,
            this.game.map,
            this.game.player,
            this.playerState
        );

        // Sync renderer's player position if moved
        if (result.moved) {
            this.renderer3d?.syncPlayer();
        }

        // Check pedestrian-vehicle collision (on foot only, throttled to ~10fps)
        const now = performance.now();
        if (now - (this._lastVehicleCollisionCheck || 0) > 100) {
            this._lastVehicleCollisionCheck = now;
            const vs = this.game.vehicleSystem;
            const ph = this.game.playerHealth;
            if (vs && ph && !ph.isDead) {
                const px = this.game.player.wx ?? this.game.player.x;
                const py = this.game.player.wz ?? this.game.player.y;
                for (const v of vs.vehicles) {
                    const speed = v.speed || 0;
                    if (speed < 2) continue;
                    const dx = v.x - px;
                    const dy = v.y - py;
                    if (dx * dx + dy * dy < 1.44) { // 1.2^2, skip sqrt
                        ph.takeDamage(Math.floor(speed * 3), 'vehicle');
                        break;
                    }
                }
            }
        }

        return result;
    }

    render(dt, simDt) {
        // Rebuild instances when needed
        if (this.game.buildings.buildings.length !== this._lastBuildingCount) {
            this._lastBuildingCount = this.game.buildings.buildings.length;
            this.renderer3d?.markBuildingsDirty();
        }
        if (this.game.citizens.citizens.length !== this._lastCitizenCount) {
            this._lastCitizenCount = this.game.citizens.citizens.length;
            this.renderer3d?.markCitizensDirty();
        }

        // Update simDt for player movement physics
        if (simDt !== undefined && simDt > 0) {
            this.simDt = simDt;
        }

        if (!this.game.paused && !this.game.state.time.paused) {
            // Player movement uses sim dt (fixed tick) for consistent physics
            // Use frame delta (dt is in ms) for smooth per-frame movement
            const movementDt = dt * 0.001; // convert ms to seconds
            this.updatePlayerMovement(movementDt);
            // Check for nearby interactables
            this.checkInteractableProximity();
            this.updateHackScan();
        } else if (this.hackScanVisible) {
            this.updateHackScan();
        }
        if (this.caseFileUI?.open) this.caseFileUI.refresh();
        this.factionsPanel?.update();
        this.politicsPanel?.update();
        
        // Update audio volumes and soundscape
        if (this.audioManager) {
            this.audioManager.updateVolumes();
        }
        // Sync procedural music volume to settings
        if (this.proceduralMusic?.running) {
            const vol = this.settings?.get('masterVolume') ?? 0.8;
            this.proceduralMusic.setVolume(vol * 0.6);
        }
        
        // Update action HUD (health, wanted, weapon, speed)
        this.actionHUD?.update();

        // Update new HUD elements
        const heat = this.game.state?.player?.heat ?? 0;
        this.updateWantedStars(heat);
        this.updateCityTicker();
        this.updateHealthBars();
        this.updateHUDLayers();

        if (this.renderer3d) {
            try {
                this.renderer3d.render();
            } catch (e) {
                this.useCompatibilityRenderer(e);
            }
        }
    }

    updateHackScan() {
        if (!this.game.interactables || !this.hackList) return;
        // Get current camera mode to determine if player is in street mode
        const playerMode = this.renderer3d?.cameraMode || 'god';
        const nodes = this.game.interactables.scanNearby(this.game.player.x, this.game.player.y, 25, playerMode);
        this.scannedHackables = nodes;
        const selectedId = this.currentInteractable?.id || null;
        this.hackList.setVisible(this.hackScanVisible);
        this.hackList.update(nodes, selectedId);
    }

    updateBuildGhost(tile = null) {
        if (!this.selectedBuilding) {
            this.renderer3d?.clearBuildGhost();
            return;
        }
        if (!tile) {
            this.renderer3d?.clearBuildGhost();
            return;
        }

        const preview = validatePlacement(this.game, this.selectedBuilding, tile.x, tile.y, this.buildMenu.rotation);
        this.buildMenu.setHoverTile(tile);
        this.buildMenu.updateHUD(preview);
        this.renderer3d?.setBuildGhost(
            this.selectedBuilding,
            tile.x,
            tile.y,
            this.buildMenu.rotation,
            preview.ok,
            preview.warning
        );
        
        // Trigger unaffordable flash on gold display when hovering over building that can't be afforded
        if (preview.warning) {
            resourceStore.update(r => ({ ...r, unaffordable: true }));
        }
    }

    updateResources(resources = this.game?.resources) {
        if (!resources) return;
        const g = Math.floor(resources.gold), f = Math.floor(resources.food), w = Math.floor(resources.wood);

        // Refresh City tab unlock states at population milestones
        const pop = resources.population ?? 0;
        const prevPop = this._lastTabRefreshPop ?? -1;
        const MILESTONES = [20, 30, 50, 60, 80, 100, 150, 200];
        if (MILESTONES.some(m => prevPop < m && pop >= m)) {
            this.refreshCityBuildingTab();
        }
        this._lastTabRefreshPop = pop;

        // Emit VFX events for floating text (unchanged logic, just use local vars)
        this._emitResourceVFX('gold-amount', g);
        this._emitResourceVFX('food-amount', f);
        this._emitResourceVFX('wood-amount', w);

        // Push all data to the Svelte reactive store (ResourceBar.svelte reads from it)
        const player = this.game.state.player || {};
        const ws = this.game?.weatherSystem;
        const rival = this.game?.state?.rival;

        resourceStore.set({
            gold: g, food: f, wood: w,
            population: resources.population,
            housing: resources.housing ?? 0,
            day: resources.day,
            heat: player.heat ?? 0,
            unaffordable: false, // Reset flash flag on each update
            weather: {
                icon: ws?.getWeatherIcon?.() ?? '☀️',
                type: ws?.state?.type ?? 'clear',
                speedModifier: ws?.currentEffects?.speedModifier ?? 1,
            },
            rival: {
                influence: Math.round(rival?.influence ?? 0),
                currentAction: rival?.currentAction ?? null,
            },
        });
    }

    /** Trigger gold flash animation for insufficient funds feedback */
    triggerUnaffordableFlash() {
        resourceStore.update(r => ({ ...r, unaffordable: true }));
        // Auto-reset after 300ms
        setTimeout(() => {
            resourceStore.update(r => ({ ...r, unaffordable: false }));
        }, 300);
    }

    /** Emit VFX resource gain/loss events without touching the DOM counter directly. */
    _emitResourceVFX(id, to) {
        const el = document.getElementById(id);
        if (!el) return;
        const from = parseInt(el.textContent, 10);
        if (isNaN(from) || from === to) return;
        const delta = to - from;
        if (Math.abs(delta) >= 3) {
            const resourceType = id.replace('-amount', '').replace(/-/g, ' ');
            if (delta > 0) eventBus.emit('ui_resource_gained', { type: resourceType, amount: delta });
            else           eventBus.emit('ui_resource_lost',   { type: resourceType, amount: Math.abs(delta) });
        }
    }

    /** Animate a resource counter from its current displayed value to `to`. */
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

    showTip(message, duration = 5000) {
        let tipsContainer = document.getElementById('tips-container');
        if (!tipsContainer) {
            tipsContainer = document.createElement('div');
            tipsContainer.id = 'tips-container';
            tipsContainer.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;pointer-events:none;';
            document.body.appendChild(tipsContainer);
        }

        const tip = document.createElement('div');
        tip.className = 'tip-box';
        tip.style.cssText = `
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 14px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
            animation: tipFadeIn 0.3s ease-out;
            pointer-events: auto;
        `;
        tip.textContent = message;

        const closeBtn = document.createElement('span');
        closeBtn.textContent = ' ×';
        closeBtn.style.cssText = 'cursor:pointer;font-weight:bold;margin-left:8px;';
        closeBtn.onclick = () => this.hideTip(tip);
        tip.appendChild(closeBtn);

        tipsContainer.appendChild(tip);

        const timer = setTimeout(() => {
            this.hideTip(tip);
        }, duration);

        tip.dataset.timer = timer;

        return tip;
    }

    hideTip(tip) {
        if (!tip) return;
        const timer = tip.dataset.timer;
        if (timer) clearTimeout(Number(timer));
        tip.style.animation = 'tipFadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (tip.parentNode) {
                tip.parentNode.removeChild(tip);
            }
        }, 300);
    }

    updateStats() {
        const citizens = this.game.citizens;
        const jp = this.game.resources.jobProduction || { gold: 0, food: 0, wood: 0 };

        // Job distribution
        const dist = new Map();
        for (const c of citizens.citizens) {
            const j = c.job || 'unemployed';
            dist.set(j, (dist.get(j) || 0) + 1);
        }
        const employed = Array.from(dist.entries()).filter(([j]) => j !== 'unemployed');
        employed.sort((a, b) => b[1] - a[1]);

        // Economy
        let economy = null;
        if (this.game.getResourceReport) {
            const report = this.game.getResourceReport();
            const fmt = (resName) => {
                const row = report.report?.[resName];
                const net = row?.net || 0;
                const sign = net >= 0 ? '+' : '';
                const top = row?.contributors?.[0];
                const source = top ? `${top.source} (${top.delta >= 0 ? '+' : ''}${top.delta})` : 'n/a';
                return `${resName.toUpperCase()}: ${sign}${net} | top: ${source}`;
            };
            economy = { gold: fmt('gold'), food: fmt('food'), wood: fmt('wood') };
        }

        // Services
        const m = this.game.servicesManager?.metrics?.city || {};
        const services = {
            powerText: `Power ${Math.round(m.powerSupply || 0)}/${Math.round(m.powerDemand || 0)} (${m.brownout ? 'brownout' : 'stable'})`,
            brownout: !!m.brownout,
        };

        // Transit
        const tm = this.game.transitMetrics || {};
        const transit = {
            mobility: Math.round((tm.mobilityBonus || 0) * 100),
            coverage: Math.round((tm.transitCoverage || 0) * 100),
            congestion: Math.round((tm.congestionReduction || 0) * 100),
            busRoutes: tm.busRoutes || 0,
            tollRevenue: tm.tollRevenue || 0,
        };

        // Demand
        const demand = this.game.state?.economy?.demand || { residential: 0, commercial: 0, industrial: 0 };

        statsStore.set({
            population: citizens.getPopulation(),
            employmentRate: citizens.getEmploymentRate() + '%',
            happiness: citizens.getAverageHappiness() + '%',
            housing: `${this.game.resources.population}/${this.game.resources.housing}`,
            jobProduction: { gold: Math.floor(jp.gold || 0), food: Math.floor(jp.food || 0), wood: Math.floor(jp.wood || 0) },
            jobDistribution: employed.length === 0 ? 'No employed citizens' : employed.map(([j, n]) => `${j}: ${n}`).join(' \u2022 '),
            economy,
            services,
            transit,
            demand,
            intel: this.game.intelDatabase ? this.game.intelDatabase.getSummary() : null,
            surveillance: this.game.surveillanceSources ? this.game.surveillanceSources.getSummary() : null,
            influence: this.game.influenceEngine ? this.game.influenceEngine.getOverview() : null,
            sentiment: this.game.sentimentManager ? this.game.sentimentManager.getMoodSummary() : null,
            heat: this.game.heatManager ? this.game.heatManager.getHeatOverview() : null,
        });
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
                this.playUISound('click');
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

    // Milestone F: Toggle between Street Mode and God Mode
    toggleGameMode() {
        if (!this.game.modeIndicator) return;
        const currentMode = this.game.mode;
        const newMode = currentMode === MODE_STREET ? MODE_GOD : MODE_STREET;
        this.game.mode = newMode;
        this.modeIndicator.setMode(newMode);
        this.game.handleModeChange?.(newMode);
        this.showMessage(
            newMode === MODE_GOD ? 'Switched to God Mode' : 'Switched to Street Mode',
            'normal'
        );
    }

    checkInteractableProximity() {
        if (this.game.interactables) {
            const node = this.game.interactables.getNearbyInteractable(
                this.game.player.x,
                this.game.player.y,
                2.2 // 2.2m radius (Ticket B-3 spec)
            );

            // Track the interactable for E key action
            if (node) {
                this.currentInteractable = node;
                const typeInfo = getInteractableTypeInfo(node.type);
                const stateName = getInteractableStateName(node.state);

                // Only update DOM if interactable changed (no duplicate prompts)
                if (this.lastInteractable !== node) {
                    this.updateInteractPrompt(typeInfo.name, stateName, node.securityLevel);
                    this.lastInteractable = node;
                }
            } else {
                // No interactable nearby - clear prompt if it exists
                if (this.lastInteractable) {
                    this.clearInteractPrompt();
                    this.lastInteractable = null;
                }
                this.currentInteractable = null;
            }
        }
    }

    handleEKey() {
        // Handle E key for hacking interactables (Ticket B-3)
        if (this.currentInteractable) {
            const node = this.currentInteractable;
            if (node.state === 'available') {
                if (this.game.state.debugEasyHack) {
                    const result = this.game.executeHack(node, true);
                    if (result.ok) {
                        const actionMsg = result.actionResult?.msg || 'Hack success.';
                        this.showMessage(`${actionMsg} (easy hack)`, 'success');
                    }
                    return;
                }
                this._breachWasPaused = this.game.state.time.paused;
                this.game.state.time.paused = true;
                
                // Convert scanned hackables to network nodes format
                const networkNodes = this.scannedHackables.map(hackable => ({
                    id: hackable.id,
                    name: hackable.name,
                    securityLevel: hackable.securityLevel || 1,
                    ownerFaction: hackable.ownerFaction || 'Unknown',
                    distance: hackable.distance || 0,
                    type: hackable.type || 'server',
                    icon: hackable.icon || '🔒'
                }));
                
                // Start the visual hacking network
                this.hackNetwork.start(networkNodes, (hackedNodes) => {
                    this.game.state.time.paused = this._breachWasPaused;
                    
                    // Execute hacks for all successfully hacked nodes
                    let totalHeat = 0;
                    let successCount = 0;
                    let failCount = 0;
                    
                    for (const hackedNode of hackedNodes) {
                        const result = this.game.executeHack(hackedNode, hackedNode.success);
                        if (result.ok) {
                            totalHeat += (result.heat || 0);
                            if (hackedNode.success) {
                                successCount++;
                            } else {
                                failCount++;
                            }
                        }
                    }
                    
                    // Show summary message
                    if (successCount > 0) {
                        const heatText = `Heat +${Math.round(totalHeat)}`;
                        this.showMessage(`Hacked ${successCount} node(s). (${heatText})`, 'success');
                    }
                    if (failCount > 0) {
                        this.showMessage(`Failed to breach ${failCount} node(s).`, 'crisis');
                    }
                });
            } else if (node.state === 'success' || node.state === 'failed') {
                // Reset and try again
                this.showMessage(`Press E to re-hack ${getInteractableTypeInfo(node.type).name}`, 'normal');
            } else if (node.state === 'hacking') {
                this.showMessage(`Already hacking ${getInteractableTypeInfo(node.type).name}...`, 'normal');
            }
        }
    }

    updateInteractPrompt(name, stateName, securityLevel = null) {
        // Remove existing prompt if any
        this.clearInteractPrompt();

        // Create action prompt UI
        const promptDiv = document.createElement('div');
        promptDiv.id = 'action-prompt';
        promptDiv.className = 'action-prompt';
        const sec = Number.isFinite(securityLevel) ? ` S${securityLevel}` : '';
        promptDiv.innerHTML = `<span class="prompt-icon">[E]</span> <span class="prompt-text">${name}${sec}</span> <span class="prompt-state">${stateName}</span>`;
        document.body.appendChild(promptDiv);
    }

    clearInteractPrompt() {
        const promptDiv = document.getElementById('action-prompt');
        if (promptDiv) promptDiv.remove();
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
     * Show citizen profile for closest citizen to player
     */
    _showClosestCitizenProfile() {
        if (!this.game.citizens || !this.game.citizens.citizens) return;

        const citizens = this.game.citizens.citizens;
        if (citizens.length === 0) {
            this.showMessage('No citizens nearby', 'normal');
            return;
        }

        const playerX = this.game.player?.x || 0;
        const playerY = this.game.player?.y || 0;

        let closestCitizen = null;
        let closestDist = Infinity;

        for (const citizen of citizens) {
            const dist = Math.abs(citizen.x - playerX) + Math.abs(citizen.y - playerY);
            if (dist < closestDist) {
                closestDist = dist;
                closestCitizen = citizen;
            }
        }

        if (closestCitizen) {
            this.citizenProfileUI?.selectCitizen(closestCitizen.id);
            this.showMessage(`Viewing citizen profile: #${closestCitizen.id}`, 'normal');
        } else {
            this.showMessage('No citizens nearby', 'normal');
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
        this.questChoiceOptions = Array.isArray(choices) ? choices : [];

        for (let i = 0; i < this.questChoiceOptions.length; i++) {
            const choice = this.questChoiceOptions[i];
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = `[${i + 1}] ${choice.label}`;
            btn.addEventListener('click', () => {
                this.playUISound('click');
                overlay.classList.add('hidden');
                onChoice(choice);
                this.questChoiceOptions = [];
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
            const choice = (this.questChoiceOptions || []).find((c) => c.id === choiceId);
            if (choice) {
                this.questChoiceCallback(choice);
                this.questChoiceCallback = null;
                this.questChoiceOptions = [];
                const overlay = document.getElementById('quest-choice-overlay');
                if (overlay) overlay.classList.add('hidden');
            }
        }
    }

    /**
     * Toggle settings menu
     */
    toggleSettings() {
        console.log('[UIManager] toggleSettings called, settings object:', this.settings);
        this.settings.toggle();
        console.log('[UIManager] After toggle, settings.isOpen:', this.settings.isOpen);
    }

    /**
     * Play UI sound via audio manager
     */
    playUISound(type) {
        if (this.audioManager) {
            const soundMap = {
                'click': () => this.audioManager.playUIClick(),
                'hover': () => this.audioManager.playUIHover(),
                'slider': () => this.audioManager.playUISlider(),
                'success': () => this.audioManager.playUISuccess(),
                'error': () => this.audioManager.playUIError()
            };
            const soundFn = soundMap[type];
            if (soundFn) {
                soundFn();
            }
        }
    }

    /**
     * Wire screen reader announcements to key game events.
     */
    _setupScreenReaderListeners() {
        const sr = this.srAnnouncer;

        eventBus.on(EVENT_TYPES.PLAYER_BUILT_BUILDING, ({ buildingName }) => {
            sr.announce(`${buildingName} built.`);
        });

        eventBus.on(EVENT_TYPES.CRISIS_STARTED, ({ name }) => {
            sr.announceUrgent(`Alert: ${name} crisis has started.`);
        });

        eventBus.on(EVENT_TYPES.CRISIS_RESOLVED, ({ name }) => {
            sr.announce(`${name} crisis resolved.`);
        });

        eventBus.on(EVENT_TYPES.QUEST_COMPLETED, ({ questName, caseTitle }) => {
            const label = questName || caseTitle || 'Quest';
            sr.announce(`${label} completed.`);
        });

        eventBus.on(EVENT_TYPES.QUEST_FAILED, ({ questName }) => {
            sr.announceUrgent(`${questName || 'Quest'} failed.`);
        });

        eventBus.on(EVENT_TYPES.RIVAL_INFLUENCE_MILESTONE, ({ influence }) => {
            sr.announceUrgent(`Warning: rival influence has reached ${influence}%.`);
        });

        eventBus.on(EVENT_TYPES.RIVAL_ACTION_STARTED, ({ action }) => {
            const label = action ? action.replace(/_/g, ' ') : 'unknown operation';
            this.showMessage(`🕵️ Rival operative started: ${label}`, 'crisis');
            sr.announceUrgent(`Rival is executing: ${label}`);
        });

        eventBus.on(EVENT_TYPES.DAY_START, ({ day }) => {
            sr.announce(`Day ${day} begins.`);
        });
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

        // Apply theme settings
        if (this.themeManager) {
            this.themeManager.setTheme(this.settings.get('theme'));
            this.themeManager.setFontScale(this.settings.get('fontScale'));
            this.themeManager.setReducedMotion(this.settings.get('reducedMotion'));
            this.themeManager.setHighContrast(this.settings.get('highContrast'));
        }
    }

    /**
     * Toggle debug overlay mode
     */
    toggleDebugOverlay() {
        if (!this.renderer3d) return;
        const modes = ['none', 'districts', 'roads', 'parcels', 'pois', 'nav', 'services'];
        let currentMode = this.renderer3d._debugMode || 'none';
        let idx = modes.indexOf(currentMode);
        idx = (idx + 1) % modes.length;
        this.renderer3d.setDebugMode(modes[idx]);
        this.showMessage(`Debug overlay: ${modes[idx]}`, 'normal');
    }

    toggleServiceOverlay() {
        if (!this.renderer3d) return;
        const sequence = ['off', 'power', 'water', 'health', 'police'];
        const current = this.game.servicesManager?.getOverlayService?.() || 'power';
        const currentMode = this.renderer3d._debugMode === 'services' ? current : 'off';
        let idx = sequence.indexOf(currentMode);
        idx = (idx + 1) % sequence.length;
        const next = sequence[idx];

        if (next === 'off') {
            this.renderer3d.setDebugMode('none');
            this.showMessage('Service heatmap: off', 'normal');
            return;
        }

        this.game.servicesManager?.setOverlayService?.(next);
        this.renderer3d.setDebugMode('services');
        this.showMessage(`Service heatmap: ${next}`, 'normal');
    }

    /**
     * Handle building completion for tutorial
     */
    onBuildingCompleted(buildingType) {
        if (this.tutorial?.isActive) {
            this.tutorial.onBuildingBuilt(buildingType);
        }
    }

    /**
     * Get tooltip data for a tile position
     */
    getTooltipData(x, y) {
        const game = this.game;
        if (!game) return null;

        // Check for buildings at this tile
        const buildings = game.buildings?.getBuildingsAt?.(x, y) || [];
        
        // Get terrain info
        const terrain = game.map?.getTileAt?.(x, y);
        const terrainNames = { 0: 'Water', 1: 'Grass', 2: 'Forest', 3: 'Mountain' };
        const terrainName = terrainNames[terrain] || 'Unknown';

        // Check for interactables
        const interactable = game.interactables?.getInteractableAt?.(x, y);

        // Check for citizens
        const citizensAtTile = game.citizens?.citizens?.filter?.(c => c.x === x && c.y === y) || [];

        // Build tooltip content
        const sections = [];

        // Terrain section
        sections.push({
            title: 'Terrain',
            content: terrainName
        });

        // Building section
        if (buildings.length > 0) {
            const buildingNames = buildings.map(b => {
                const staffing = game.jobsManager?.getStaffingRatio?.(b.id);
                const staffText = staffing !== undefined ? ` (Staff: ${Math.round(staffing * 100)}%)` : '';
                return `${b.name}${staffText}`;
            });
            sections.push({
                title: 'Buildings',
                content: buildingNames.join(', ')
            });
        }

        // Interactable section
        if (interactable) {
            const typeInfo = getInteractableTypeInfo(interactable.type);
            sections.push({
                title: 'Hacking Node',
                content: `${typeInfo.name} (Security: ${interactable.securityLevel || 1})`
            });
        }

        // Citizens section
        if (citizensAtTile.length > 0) {
            sections.push({
                title: 'Citizens',
                content: `${citizensAtTile.length} citizen(s) here`
            });
        }

        // District info
        const district = game.map?.getDistrictAt?.(x, y);
        if (district) {
            sections.push({
                title: 'District',
                content: district
            });
        }

        // Only return if we have content
        if (sections.length === 0) return null;

        return {
            x,
            y,
            sections
        };
    }
}

// Export TutorialOverlay for use in UIManager
export { TutorialOverlay } from './ui/tutorial_overlay.js';

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
