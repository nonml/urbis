// UI manager for DOM + third-person 3D rendering
import { BUILDING_TYPES, BUILDING_SECURITY } from './constants.js';
import { MapScreen } from './ui/map_screen.js';
import { MODE_STREET, MODE_GOD, MODE_LABELS } from './ui/mode_indicator.js';
import { TechScreen } from './ui/tech_screen.js';
import { SettingsManager } from './ui/settings.js';
import { createThemeManager } from './ui/theme.js';
import { BuildMenu } from './ui/build_menu.js';
import { CaseFileUI } from './ui/case_file.js';
import { FactionsPanel } from './ui/factions_panel.js';
import { CitizenProfileUI } from './ui/citizen_profile.js';
import { PoliticsPanel } from './ui/politics_panel.js';
import { CodexUI } from './ui/codex.js';
import { FeedbackUI } from './ui/feedback.js';
import { createAudioManager } from './audio/audio_manager.js';
import { getInteractableTypeInfo, getInteractableStateName } from './sim/interactables.js';
import { createVictoryScreen, AchievementNotification } from './ui/victory_screen.js';
import { updatePlayerMovement, createPlayerState } from './player/controller.js';
import { validatePlacement } from './build/placement.js';
import { HackList } from './ui/hack_list.js';
import { BreachMinigame } from './ui/breach_minigame.js';
import { createTutorialOverlay, TutorialOverlay } from './ui/tutorial_overlay.js';
import { TooltipManager } from './ui/tooltips.js';

function getFallbackCanvasId(mainCanvas) {
    return `${mainCanvas?.id || 'game-canvas'}-fallback-2d`;
}

function removeFallbackCanvas(mainCanvas) {
    const id = getFallbackCanvasId(mainCanvas);
    const existing = document.getElementById(id);
    if (existing) existing.remove();
}

function createRendererStub(game, canvas) {
    const stub = {
        isFallback: true,
        game,
        canvas,
        drawCanvas: canvas,
        ctx: null,
        yaw: 0,
        pitch: -0.35,
        followDist: 7,
        followHeight: 4,
        _debugMode: 'none',
        _renderScale: 1,
        _showFPS: false,
        _ghost: null,
        _view: null,
        _lastFrameMs: 0,
        _lastFrameAt: 0,
        _ensureCtx() {
            // IMPORTANT:
            // Never call getContext('2d') on the main canvas.
            // If we do, the browser locks that canvas to a 2D context and Three.js
            // cannot create a WebGL context later (exactly the error you saw).
            if (!this.canvas) return null;
            if (!this.ctx) {
                const parent = this.canvas.parentElement;
                if (!parent) return null;
                const id = getFallbackCanvasId(this.canvas);
                let overlay = document.getElementById(id);
                if (!overlay) {
                    overlay = document.createElement('canvas');
                    overlay.id = id;
                    overlay.style.position = 'absolute';
                    overlay.style.pointerEvents = 'none';
                    overlay.style.zIndex = '2';
                    overlay.style.left = '0';
                    overlay.style.top = '0';
                    overlay.style.width = '100%';
                    overlay.style.height = '100%';
                    parent.style.position = parent.style.position || 'relative';
                    parent.appendChild(overlay);
                }
                this.drawCanvas = overlay;
                this.ctx = overlay.getContext('2d');
            }
            return this.ctx;
        },
        _resizeCanvas() {
            if (!this.canvas || !this.drawCanvas) return;
            const dpr = window.devicePixelRatio || 1;
            const rect = this.canvas.getBoundingClientRect();
            const w = Math.max(1, Math.floor(rect.width * dpr));
            const h = Math.max(1, Math.floor(rect.height * dpr));
            if (this.drawCanvas !== this.canvas) {
                this.drawCanvas.style.left = `${this.canvas.offsetLeft}px`;
                this.drawCanvas.style.top = `${this.canvas.offsetTop}px`;
                this.drawCanvas.style.width = `${rect.width}px`;
                this.drawCanvas.style.height = `${rect.height}px`;
            }
            if (this.drawCanvas.width !== w || this.drawCanvas.height !== h) {
                this.drawCanvas.width = w;
                this.drawCanvas.height = h;
            }
        },
        _resolveView() {
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const canvasW = Math.max(1, Math.floor(rect.width * dpr));
            const canvasH = Math.max(1, Math.floor(rect.height * dpr));
            const scale = Math.max(0.65, Math.min(1.8, Number(this._renderScale) || 1));
            const targetTilesX = Math.max(16, Math.round(30 / scale));
            const tilePx = Math.max(14, Math.min(64, Math.floor(canvasW / targetTilesX)));
            const tilesX = Math.max(8, Math.floor(canvasW / tilePx));
            const tilesY = Math.max(6, Math.floor(canvasH / tilePx));

            const px = Math.max(0, Math.min(game.map.width - 1, Math.floor((game.player?.wx ?? game.player?.x ?? 0))));
            const py = Math.max(0, Math.min(game.map.height - 1, Math.floor((game.player?.wz ?? game.player?.y ?? 0))));
            const maxStartX = Math.max(0, game.map.width - tilesX);
            const maxStartY = Math.max(0, game.map.height - tilesY);
            const startX = Math.max(0, Math.min(maxStartX, px - Math.floor(tilesX / 2)));
            const startY = Math.max(0, Math.min(maxStartY, py - Math.floor(tilesY / 2)));

            return { dpr, canvasW, canvasH, tilePx, tilesX, tilesY, startX, startY };
        },
        rebuildWorld() {},
        syncPlayer() {},
        markBuildingsDirty() {},
        markCitizensDirty() {},
        pickTile(clientX, clientY) {
            const view = this._view || this._resolveView();
            if (!view) return null;
            const rect = this.canvas.getBoundingClientRect();
            const mx = (clientX - rect.left) * view.dpr;
            const my = (clientY - rect.top) * view.dpr;
            const tx = view.startX + Math.floor(mx / view.tilePx);
            const ty = view.startY + Math.floor(my / view.tilePx);
            if (tx < 0 || ty < 0 || tx >= game.map.width || ty >= game.map.height) return null;
            return { x: tx, y: ty };
        },
        render() {
            const ctx = this._ensureCtx();
            if (!ctx || !game?.map) return;
            this._resizeCanvas();
            this.yaw = 0;
            this.pitch = -0.35;
            const view = this._resolveView();
            this._view = view;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
            ctx.fillStyle = '#0f1c1a';
            ctx.fillRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);

            for (let y = 0; y < view.tilesY; y++) {
                for (let x = 0; x < view.tilesX; x++) {
                    const tx = view.startX + x;
                    const ty = view.startY + y;
                    if (tx >= game.map.width || ty >= game.map.height) continue;
                    const px = x * view.tilePx;
                    const py = y * view.tilePx;
                    const idx = ty * game.map.width + tx;
                    const terrain = game.map.getTileAt(tx, ty);
                    let color = game.map.getTerrainColor(terrain);
                    if (game.map.roadMap?.[idx]) color = '#68707a';
                    else if (game.map.sidewalkMap?.[idx]) color = '#8f989f';
                    ctx.fillStyle = color || '#2f5f4a';
                    ctx.fillRect(px, py, view.tilePx, view.tilePx);
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.strokeRect(px, py, view.tilePx, view.tilePx);
                }
            }

            const buildingByTile = new Map();
            for (const b of game.buildings?.buildings || []) {
                buildingByTile.set(`${b.x},${b.y}`, b);
            }
            for (const [key, b] of buildingByTile.entries()) {
                const [txs, tys] = key.split(',');
                const tx = Number(txs);
                const ty = Number(tys);
                if (tx < view.startX || ty < view.startY || tx >= view.startX + view.tilesX || ty >= view.startY + view.tilesY) continue;
                const px = (tx - view.startX) * view.tilePx;
                const py = (ty - view.startY) * view.tilePx;
                const pad = Math.max(2, Math.floor(view.tilePx * 0.14));
                ctx.fillStyle = 'rgba(15, 26, 44, 0.9)';
                ctx.fillRect(px + pad, py + pad, view.tilePx - pad * 2, view.tilePx - pad * 2);
                ctx.strokeStyle = '#f2d27a';
                ctx.lineWidth = Math.max(1, Math.floor(view.tilePx * 0.06));
                ctx.strokeRect(px + pad, py + pad, view.tilePx - pad * 2, view.tilePx - pad * 2);
                if (view.tilePx >= 18) {
                    ctx.font = `${Math.max(10, Math.floor(view.tilePx * 0.45))}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(b.icon || 'B', px + (view.tilePx / 2), py + (view.tilePx / 2) + 1);
                }
            }

            if (this._ghost) {
                const g = this._ghost;
                if (g.x >= view.startX && g.y >= view.startY && g.x < view.startX + view.tilesX && g.y < view.startY + view.tilesY) {
                    const px = (g.x - view.startX) * view.tilePx;
                    const py = (g.y - view.startY) * view.tilePx;
                    ctx.strokeStyle = g.ok ? '#4cff8a' : '#ff5f5f';
                    ctx.lineWidth = Math.max(2, Math.floor(view.tilePx * 0.08));
                    ctx.strokeRect(px + 2, py + 2, view.tilePx - 4, view.tilePx - 4);
                }
            }

            const ptx = Math.floor(game.player?.wx ?? game.player?.x ?? 0);
            const pty = Math.floor(game.player?.wz ?? game.player?.y ?? 0);
            if (ptx >= view.startX && pty >= view.startY && ptx < view.startX + view.tilesX && pty < view.startY + view.tilesY) {
                const cx = (ptx - view.startX) * view.tilePx + (view.tilePx / 2);
                const cy = (pty - view.startY) * view.tilePx + (view.tilePx / 2);
                ctx.fillStyle = '#58d5ff';
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(3, Math.floor(view.tilePx * 0.2)), 0, Math.PI * 2);
                ctx.fill();
            }

            const now = performance.now();
            this._lastFrameMs = this._lastFrameAt ? (now - this._lastFrameAt) : 16;
            this._lastFrameAt = now;
        },
        clearBuildGhost() { this._ghost = null; },
        setBuildGhost(buildingType, x, y, rotation, ok) { this._ghost = { buildingType, x, y, rotation, ok }; },
        setDebugMode(mode) { this._debugMode = mode || 'none'; },
        getNearestPOIDistance() {
            const pois = game.map?.pois || [];
            if (!pois.length) return -1;
            const px = game.player?.wx ?? game.player?.x ?? 0;
            const py = game.player?.wz ?? game.player?.y ?? 0;
            let best = Infinity;
            for (const poi of pois) {
                const dx = poi.x - px;
                const dy = poi.y - py;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < best) best = d;
            }
            return Number.isFinite(best) ? best : -1;
        },
        setRenderScale(scale) { this._renderScale = scale; },
        setShowFPS(show) { this._showFPS = !!show; },
        showBuildFeedback() {},
        updateHackProgress() {},
        showHackResult() {},
        setCameraHackView() {},
        getPerfStats() {
            return {
                terrainInstances: 0,
                buildingInstances: game?.buildings?.buildings?.length || 0,
                citizenInstances: game?.citizens?.citizens?.length || 0,
                activeChunks: game?.chunks?.getActiveChunkCount?.() ?? 0,
                visibleChunks: 1,
                drawCalls: 3,
            };
        },
    };
    return stub;
}

export class UIManager {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.selectedBuilding = null;
        this.lastBuildAttemptAt = 0;

        // Settings
        this.settings = new SettingsManager(game);

        // Theme manager
        this.themeManager = createThemeManager();
        window.themeManager = this.themeManager;

        // Audio
        this.audioManager = createAudioManager(game);

        // Victory screen
        this.victoryScreen = createVictoryScreen();
        this.achievementNotification = new AchievementNotification();

        // Tutorial
        this.tutorial = createTutorialOverlay(this.game);

        // 3D
        // Start in a lightweight stub so UI is responsive immediately, then upgrade to real 3D.
        // If 3D fails, we stay on the stub (compatibility mode).
        this.renderer3d = createRendererStub(this.game, this.canvas);

        // Input
        this.keys = new Set();
        this.isRDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

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
        this.setupInfoTabs();
        this.setupInput();
        this.setupGlobalShortcuts();

        // Auto-init 3D renderer on boot (City Skylines-style). If it fails, we fall back gracefully.
        this.loadRenderer3D();
    }

    async loadRenderer3D() {
        try {
            const mod = await import('./renderer3d.js');
            // Prefer async factory (robust Three.js loading + WebGL checks)
            if (typeof mod?.createRenderer3D === 'function') {
                this.renderer3d = await mod.createRenderer3D(this.game, this.canvas);
            } else {
                const Renderer3D = mod?.Renderer3D;
                if (!Renderer3D) throw new Error('Renderer3D export missing.');
                this.renderer3d = new Renderer3D(this.game, this.canvas);
            }
            this.renderer3d.isFallback = false;
            removeFallbackCanvas(this.canvas);
            this.applySettings();
            this.showMessage('3D renderer ready.', 'success');
        } catch (e) {
            this.useCompatibilityRenderer(e);
        }
    }

    useCompatibilityRenderer(reason = null) {
        if (!this.renderer3d?.isFallback) {
            console.error('[UI] 3D renderer unavailable, switching to compatibility mode:', reason);
        }
        this.renderer3d = createRendererStub(this.game, this.canvas);
        this.applySettings();
        const msg = (reason && (reason.message || String(reason))) ? (reason.message || String(reason)) : '';
        const short = msg ? msg.split('\n')[0].slice(0, 140) : 'Unknown error';
        this.showMessage(`3D renderer unavailable: ${short} (see console)`, 'crisis');
    }

    onWorldRebuilt() {
        this.renderer3d.rebuildWorld();
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
            const rewardUnlock = this.game.state.progress?.unlocks?.buildings?.includes(key) ||
                this.game.state.progress?.unlocks?.buildings?.includes('security_buildings');
            if (securityUnlocked || rewardUnlock) {
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
            this.buildMenu.selectType(key);
            this.showMessage(`Selected: ${building.name}`, 'success');
            this.playUISound('click');
        });
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
            });
        });

        // Debug info button (E-07)
        const debugBtn = document.getElementById('debug-info-btn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.copyDebugInfo());
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
            if (e.key.toLowerCase() === 'p') {
                this.game.paused = !this.game.paused;
                this.showMessage(this.game.paused ? '⏸️ Paused' : '▶️ Resumed', 'normal');
            }
            if (e.key.toLowerCase() === 'm') {
                this.toggleMapScreen();
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
                }
            }
            if (e.key.toLowerCase() === 't') {
                this.toggleTechScreen();
            }
            if (e.key.toLowerCase() === 'c') {
                this.caseFileUI?.toggle();
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
            if (e.key === 'Escape' && this.selectedBuilding) {
                this.buildMenu.cancelBuildMode();
                this.showMessage('Build mode canceled.', 'normal');
            } else if (e.key === 'Escape' && this.breachMinigame.active) {
                this.breachMinigame.finish(false);
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
            if (['w', 'a', 's', 'd', 'shift'].includes(k)) this.keys.add(k);
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

            // Citizen profile: C key
            if (e.key.toLowerCase() === 'c') {
                this._showClosestCitizenProfile();
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
                const tile = this.renderer3d.pickTile(e.clientX, e.clientY);
                if (!tile) return;

                if (this.selectedBuilding) {
                    const now = performance.now();
                    if (now - this.lastBuildAttemptAt < 120) return;
                    this.lastBuildAttemptAt = now;

                    const result = this.game.attemptBuild(this.selectedBuilding, tile.x, tile.y, {
                        rotation: this.buildMenu.rotation,
                    });
                    if (result.ok) {
                        this.renderer3d.markBuildingsDirty();
                        this.updateBuildGhost(tile);
                    } else {
                        this.buildMenu.updateHUD({ ok: false, reason: result.reason || 'Invalid placement.' });
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
                const tile = this.renderer3d.pickTile(e.clientX, e.clientY);
                this.updateBuildGhost(tile);
            }
            if (!this.isRDragging) return;
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            this.renderer3d.yaw -= dx * this.renderer3d.mouseSensitivity;
            this.renderer3d.pitch -= dy * this.renderer3d.mouseSensitivity * 0.6;
            this.renderer3d.pitch = Math.max(-1.2, Math.min(-0.1, this.renderer3d.pitch));
        });

        // Tooltip hover events
        this.canvas.addEventListener('mousemove', (e) => {
            const tile = this.renderer3d.pickTile(e.clientX, e.clientY);
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
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.game.tooltipManager?.hide();
        });
    }

    updatePlayerMovement(dtMs) {
        const dt = Math.min(0.05, dtMs / 1000);

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
            this.renderer3d.yaw,
            this.game.map,
            this.game.player,
            this.playerState
        );

        // Sync renderer's player position if moved
        if (result.moved) {
            this.renderer3d.syncPlayer();
            // Update debug info for nearest POI
            if (this.renderer3d._debugMode === 'pois') {
                const nearestDist = this.renderer3d.getNearestPOIDistance();
                if (nearestDist >= 0) {
                    // Could display nearest POI info
                }
            }
        }

        return result;
    }

    render(dt, simDt) {
        // Rebuild instances when needed
        if (this.game.buildings.buildings.length !== this._lastBuildingCount) {
            this._lastBuildingCount = this.game.buildings.buildings.length;
            this.renderer3d.markBuildingsDirty();
        }
        if (this.game.citizens.citizens.length !== this._lastCitizenCount) {
            this._lastCitizenCount = this.game.citizens.citizens.length;
            this.renderer3d.markCitizensDirty();
        }

        // Update simDt for player movement physics
        if (simDt !== undefined && simDt > 0) {
            this.simDt = simDt;
        }

        if (!this.game.paused && !this.game.state.time.paused) {
            // Player movement uses sim dt (fixed tick) for consistent physics
            const movementDt = this.simDt > 0 ? this.simDt : (dt * 0.001);
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
        
        try {
            this.renderer3d.render();
        } catch (e) {
            this.useCompatibilityRenderer(e);
            this.renderer3d.render();
        }
    }

    updateHackScan() {
        if (!this.game.interactables || !this.hackList) return;
        const nodes = this.game.interactables.scanNearby(this.game.player.x, this.game.player.y, 25);
        this.scannedHackables = nodes;
        const selectedId = this.currentInteractable?.id || null;
        this.hackList.setVisible(this.hackScanVisible);
        this.hackList.update(nodes, selectedId);
    }

    updateBuildGhost(tile = null) {
        if (!this.selectedBuilding) {
            this.renderer3d.clearBuildGhost();
            return;
        }
        if (!tile) {
            this.renderer3d.clearBuildGhost();
            return;
        }

        const preview = validatePlacement(this.game, this.selectedBuilding, tile.x, tile.y, this.buildMenu.rotation);
        this.buildMenu.setHoverTile(tile);
        this.buildMenu.updateHUD(preview);
        this.renderer3d.setBuildGhost(
            this.selectedBuilding,
            tile.x,
            tile.y,
            this.buildMenu.rotation,
            preview.ok
        );
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

        this.updateEconomyReport();
        this.updateServicesReport();
        this.updateDemandReport();
    }

    updateEconomyReport() {
        const statsPanel = document.getElementById('stats-panel');
        if (!statsPanel || !this.game.getResourceReport) return;

        let box = document.getElementById('economy-report');
        if (!box) {
            box = document.createElement('div');
            box.id = 'economy-report';
            box.className = 'stat-item full-width';
            box.innerHTML = `
                <div class="stat-label">Economy (last tick)</div>
                <div class="stat-value" id="econ-gold-row"></div>
                <div class="stat-value" id="econ-food-row"></div>
                <div class="stat-value" id="econ-wood-row"></div>
            `;
            statsPanel.appendChild(box);
        }

        const report = this.game.getResourceReport();
        const fmt = (resName) => {
            const row = report.report?.[resName];
            const net = row?.net || 0;
            const sign = net >= 0 ? '+' : '';
            const top = row?.contributors?.[0];
            const source = top ? `${top.source} (${top.delta >= 0 ? '+' : ''}${top.delta})` : 'n/a';
            return `${resName.toUpperCase()}: ${sign}${net} | top: ${source}`;
        };

        const goldRow = document.getElementById('econ-gold-row');
        const foodRow = document.getElementById('econ-food-row');
        const woodRow = document.getElementById('econ-wood-row');
        if (goldRow) goldRow.textContent = fmt('gold');
        if (foodRow) foodRow.textContent = fmt('food');
        if (woodRow) woodRow.textContent = fmt('wood');
    }

    updateServicesReport() {
        const statsPanel = document.getElementById('stats-panel');
        if (!statsPanel || !this.game.servicesManager) return;

        let box = document.getElementById('services-report');
        if (!box) {
            box = document.createElement('div');
            box.id = 'services-report';
            box.className = 'stat-item full-width';
            box.innerHTML = `
                <div class="stat-label">Services</div>
                <div class="stat-value" id="svc-city-row"></div>
            `;
            statsPanel.appendChild(box);
        }

        const m = this.game.servicesManager.metrics.city || {};
        const powerState = m.brownout ? 'brownout' : 'stable';
        const row = document.getElementById('svc-city-row');
        if (row) {
            row.textContent = `Power ${Math.round(m.powerSupply || 0)}/${Math.round(m.powerDemand || 0)} (${powerState})`;
        }
    }

    updateDemandReport() {
        const statsPanel = document.getElementById('stats-panel');
        if (!statsPanel || !this.game.demandCalculator) return;

        let box = document.getElementById('demand-report');
        if (!box) {
            box = document.createElement('div');
            box.id = 'demand-report';
            box.className = 'stat-item full-width';
            box.innerHTML = `
                <div class="stat-label">Demand (R/C/I)</div>
                <div class="stat-value" id="demand-res-row"></div>
                <div class="stat-value" id="demand-com-row"></div>
                <div class="stat-value" id="demand-ind-row"></div>
            `;
            statsPanel.appendChild(box);
        }

        const demand = this.game.state?.economy?.demand || { residential: 0, commercial: 0, industrial: 0 };

        const fmtDemand = (val, label) => {
            const percentage = Math.min(100, Math.round(val * 100));
            const barColor = percentage < 30 ? '#ff6b6b' : percentage < 70 ? '#ffd93d' : '#6bcb77';
            return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span>${label}</span>
                <span style="color:${barColor};font-weight:600;">${percentage}%</span>
            </div>`;
        };

        const resRow = document.getElementById('demand-res-row');
        const comRow = document.getElementById('demand-com-row');
        const indRow = document.getElementById('demand-ind-row');

        if (resRow) resRow.innerHTML = fmtDemand(demand.residential || 0, 'Residential');
        if (comRow) comRow.innerHTML = fmtDemand(demand.commercial || 0, 'Commercial');
        if (indRow) indRow.innerHTML = fmtDemand(demand.industrial || 0, 'Industrial');

        this.updateIntelReport();
    }

    updateIntelReport() {
        const statsPanel = document.getElementById('stats-panel');
        if (!statsPanel) return;

        // Intel Database
        if (this.game.intelDatabase) {
            let intelBox = document.getElementById('intel-report');
            if (!intelBox) {
                intelBox = document.createElement('div');
                intelBox.id = 'intel-report';
                intelBox.className = 'stat-item full-width';
                intelBox.innerHTML = `
                    <div class="stat-label">Intel Database</div>
                    <div class="stat-value" id="intel-total-entries"></div>
                    <div class="stat-value" id="intel-active-entries"></div>
                `;
                statsPanel.appendChild(intelBox);
            }
            const summary = this.game.intelDatabase.getSummary();
            const totalEntries = document.getElementById('intel-total-entries');
            const activeEntries = document.getElementById('intel-active-entries');
            if (totalEntries) totalEntries.textContent = `Total entries: ${summary.totalEntries}`;
            if (activeEntries) activeEntries.textContent = `Active entries: ${summary.activeEntries}`;
        }

        // Surveillance Sources
        if (this.game.surveillanceSources) {
            let surveillanceBox = document.getElementById('surveillance-report');
            if (!surveillanceBox) {
                surveillanceBox = document.createElement('div');
                surveillanceBox.id = 'surveillance-report';
                surveillanceBox.className = 'stat-item full-width';
                surveillanceBox.innerHTML = `
                    <div class="stat-label">Surveillance</div>
                    <div class="stat-value" id="surv-source-count"></div>
                    <div class="stat-value" id="surv-active-sources"></div>
                `;
                statsPanel.appendChild(surveillanceBox);
            }
            const summary = this.game.surveillanceSources.getSummary();
            const sourceCount = document.getElementById('surv-source-count');
            const activeSources = document.getElementById('surv-active-sources');
            if (sourceCount) sourceCount.textContent = `Sources: ${summary.totalSources}`;
            if (activeSources) activeSources.textContent = `Active: ${summary.activeSources}`;
        }

        // Influence Engine
        if (this.game.influenceEngine) {
            let influenceBox = document.getElementById('influence-report');
            if (!influenceBox) {
                influenceBox = document.createElement('div');
                influenceBox.id = 'influence-report';
                influenceBox.className = 'stat-item full-width';
                influenceBox.innerHTML = `
                    <div class="stat-label">Influence</div>
                    <div class="stat-value" id="inf-score"></div>
                    <div class="stat-value" id="inf-active-ops"></div>
                `;
                statsPanel.appendChild(influenceBox);
            }
            const overview = this.game.influenceEngine.getOverview();
            const score = document.getElementById('inf-score');
            const activeOps = document.getElementById('inf-active-ops');
            if (score) score.textContent = `Score: ${Math.round(overview.score)}`;
            if (activeOps) activeOps.textContent = `Active operations: ${overview.activeCount}`;
        }

        // Sentiment Manager
        if (this.game.sentimentManager) {
            let sentimentBox = document.getElementById('sentiment-report');
            if (!sentimentBox) {
                sentimentBox = document.createElement('div');
                sentimentBox.id = 'sentiment-report';
                sentimentBox.className = 'stat-item full-width';
                sentimentBox.innerHTML = `
                    <div class="stat-label">Sentiment</div>
                    <div class="stat-value" id="sent-overall"></div>
                    <div class="stat-value" id="sent-trust"></div>
                `;
                statsPanel.appendChild(sentimentBox);
            }
            const mood = this.game.sentimentManager.getMoodSummary();
            const overall = document.getElementById('sent-overall');
            const trust = document.getElementById('sent-trust');
            const sentimentLevel = mood.overall.level;
            const levelColor = sentimentLevel === 'highly_positive' ? '#6bcb77' :
                              sentimentLevel === 'positive' ? '#a8d67b' :
                              sentimentLevel === 'neutral' ? '#ffd93d' :
                              sentimentLevel === 'negative' ? '#ff9f43' : '#ff6b6b';
            if (overall) overall.innerHTML = `<span style="color:${levelColor};font-weight:600;">${mood.overall.level.toUpperCase()}</span>: ${Math.round(mood.overall.sentiment * 100)}%`;
            if (trust) trust.textContent = `Trust (Gov/Police): ${Math.round(mood.trust.government * 100)}% / ${Math.round(mood.trust.police * 100)}%`;
        }

        // Heat Manager
        if (this.game.heatManager) {
            let heatBox = document.getElementById('heat-report');
            if (!heatBox) {
                heatBox = document.createElement('div');
                heatBox.id = 'heat-report';
                heatBox.className = 'stat-item full-width';
                heatBox.innerHTML = `
                    <div class="stat-label">Exposure/Heat</div>
                    <div class="stat-value" id="heat-level"></div>
                    <div class="stat-value" id="heat-exposure"></div>
                `;
                statsPanel.appendChild(heatBox);
            }
            const heatOverview = this.game.heatManager.getHeatOverview();
            const heatLevel = document.getElementById('heat-level');
            const heatExposure = document.getElementById('heat-exposure');
            const heatColor = heatOverview.state === 'calm' ? '#6bcb77' :
                             heatOverview.state === 'alert' ? '#ffd93d' :
                             heatOverview.state === 'search' ? '#ff9f43' :
                             heatOverview.state === 'pursuit' ? '#ff6b6b' : '#c44569';
            if (heatLevel) heatLevel.innerHTML = `<span style="color:${heatColor};font-weight:600;">${heatOverview.state.toUpperCase()}</span>: ${Math.round(heatOverview.heat)}%`;
            if (heatExposure) heatExposure.textContent = `Exposure score: ${Math.round(heatOverview.exposureScore)}`;
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
                this.breachMinigame.start(node, (success, hackedNode) => {
                    this.game.state.time.paused = this._breachWasPaused;
                    const result = this.game.executeHack(hackedNode, success);
                    if (!result.ok) {
                        this.showMessage(result.reason || 'Hack failed to execute.', 'crisis');
                        return;
                    }
                    if (!success) {
                        this.showMessage(`Breach failed. Heat +5. Cooldown applied.`, 'crisis');
                        return;
                    }
                    const actionMsg = result.actionResult?.msg || 'Hack success.';
                    const heatText = `Heat ${Math.round(result.heat || 0)}`;
                    this.showMessage(`${actionMsg} (${heatText})`, 'success');
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
