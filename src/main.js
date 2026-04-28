// Entry point for the game
import { Game } from './game.js';
import { initRapier } from './sim/physics/rapier_world.js';
import { PerfOverlay } from './dev/perf_overlay.js';
import { DevMenu } from './dev/dev_menu.js';
import { UIManager } from './ui.js';
import { loadQuestsFromDirectory } from './content/loader.js';
import { loadStoryletsFromDirectory } from './content/loader.js';
import { loadOutcomes } from './content/loader.js';
import { VERSION, BUILD_TIMESTAMP } from './version.js?v=20260220';
import ResourceBar from './ui/components/ResourceBar.svelte';
import SettingsPanel from './ui/components/SettingsPanel.svelte';
import NewsFeedPanel from './ui/components/NewsFeedPanel.svelte';
import BuildModeHUD from './ui/components/BuildModeHUD.svelte';
import FactionsPanel from './ui/components/FactionsPanel.svelte';
import PoliticsPanel from './ui/components/PoliticsPanel.svelte';
import CitizenProfile from './ui/components/CitizenProfile.svelte';
import QuestLog from './ui/components/QuestLog.svelte';
import TechScreen from './ui/components/TechScreen.svelte';
import CaseFile from './ui/components/CaseFile.svelte';
import Codex from './ui/components/Codex.svelte';
import CampaignPanel from './ui/components/CampaignPanel.svelte';
import RunSummary from './ui/components/RunSummary.svelte';
import Shop from './ui/components/Shop.svelte';
import SeedBrowser from './ui/components/SeedBrowser.svelte';
import StatsPanel from './ui/components/StatsPanel.svelte';

// Display version
document.addEventListener('DOMContentLoaded', () => {
    const versionEl = document.getElementById('version-display');
    if (versionEl) {
        versionEl.textContent = `v${VERSION} (Build: ${BUILD_TIMESTAMP.slice(0, 10)})`;
    }
});

function ensureLoadingOverlay() {
    let overlay = document.getElementById('loading-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(3, 5, 8, 0.92);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 12000;
        color: #e0e8f0;
        font-family: 'Share Tech Mono', 'Consolas', monospace;
    `;
    overlay.innerHTML = `
        <div style="width:min(420px, 92vw); padding:24px; border:1px solid rgba(0,240,255,0.15); background:rgba(8,12,22,0.9); border-radius:6px;">
            <div id="loading-label" style="margin-bottom:10px; color:#00f0ff; letter-spacing:0.1em; font-size:13px;">INITIALIZING CITY...</div>
            <div style="height:4px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden;">
                <div id="loading-fill" style="height:100%; width:0%; background:linear-gradient(90deg,#00f0ff,#00ff88); transition: width 120ms ease;"></div>
            </div>
            <div id="loading-percent" style="margin-top:8px; font-size:11px; opacity:0.6;">0%</div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function updateLoading(progress, label) {
    const overlay = ensureLoadingOverlay();
    const fill = overlay.querySelector('#loading-fill');
    const percent = overlay.querySelector('#loading-percent');
    const labelEl = overlay.querySelector('#loading-label');
    overlay.style.display = 'flex';
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    if (percent) percent.textContent = `${Math.round(progress)}%`;
    if (labelEl && label) labelEl.textContent = label;
}

function hideLoading() {
    const overlay = ensureLoadingOverlay();
    overlay.style.display = 'none';
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

// Global functions for HTML onclick handlers
window.startGame = async function() {
    const menu = document.getElementById('main-menu-overlay');
    try {
        updateLoading(5, 'PREPARING SESSION...');
        if (menu) menu.classList.add('hidden');

        const preset = document.getElementById('map-size')?.value || 'CITY';
        const seedStr = document.getElementById('world-seed')?.value?.trim();
        const seed = seedStr ? parseInt(seedStr, 10) : undefined;
        const mode = document.getElementById('game-mode')?.value || 'standard';
        const difficulty = document.getElementById('difficulty-select')?.value || 'NORMAL';

        await nextFrame();
        updateLoading(20, 'LOADING PHYSICS...');
        await initRapier();
        updateLoading(35, 'GENERATING WORLD...');

        // Clean up previous game instance if any
        if (window.game) {
            window.game.stop?.();
            window.game.modeIndicator?.destroy?.();
            window.game.ui?.actionHUD?.destroy?.();
        }
        document.querySelectorAll('#mode-indicator').forEach(el => el.remove());

        window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined, mode, difficulty });
        updateLoading(60, 'BOOTING SYSTEMS...');
        window.perfOverlay = new PerfOverlay(window.game);
        window.devMenu = new DevMenu(window.game);
        window.devMenu.enable();
        updateLoading(85, 'STREAMING CHUNKS...');
        window.game.init();
        updateLoading(100, 'Ready');
        setTimeout(() => hideLoading(), 150);
    } catch (e) {
        console.error('[StartGame] failed:', e);
        hideLoading();
        if (menu) menu.classList.remove('hidden');
        window.alert(`Failed to start game: ${e?.message || e}`);
    }
};

window.restartGame = async function() {
    const menu = document.getElementById('main-menu-overlay');
    try {
        document.getElementById('victory-overlay').classList.add('hidden');
        updateLoading(5, 'RESTARTING...');

        const preset = document.getElementById('map-size')?.value || 'CITY';
        const seedStr = document.getElementById('world-seed')?.value?.trim();
        const seed = seedStr ? parseInt(seedStr, 10) : undefined;
        const mode = document.getElementById('game-mode')?.value || 'standard';
        const difficulty = document.getElementById('difficulty-select')?.value || 'NORMAL';

        await nextFrame();
        updateLoading(20, 'LOADING PHYSICS...');
        await initRapier();
        updateLoading(35, 'GENERATING WORLD...');

        // Clean up previous game instance
        if (window.game) {
            window.game.stop?.();
            window.game.modeIndicator?.destroy?.();
            window.game.ui?.actionHUD?.destroy?.();
        }
        document.querySelectorAll('#mode-indicator').forEach(el => el.remove());

        window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined, mode, difficulty });

        updateLoading(60, 'BOOTING SYSTEMS...');
        window.perfOverlay = new PerfOverlay(window.game);
        window.devMenu = new DevMenu(window.game);
        window.devMenu.enable();
        updateLoading(85, 'STREAMING CHUNKS...');
        window.game.init();
        updateLoading(100, 'Ready');
        setTimeout(() => hideLoading(), 150);
    } catch (e) {
        console.error('[RestartGame] failed:', e);
        hideLoading();
        if (menu) menu.classList.remove('hidden');
        window.alert(`Failed to restart game: ${e?.message || e}`);
    }
};

window.showStartScreen = function() {
    document.getElementById('victory-overlay').classList.add('hidden');
    document.getElementById('main-menu-overlay').classList.remove('hidden');
};

// One-time migration: disable tutorial that was on by default
if (localStorage.getItem('game_settings_show_tutorial') === 'true') {
    localStorage.setItem('game_settings_show_tutorial', 'false');
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    // Mount Svelte components
    const rbMount = document.getElementById('resource-bar-mount');
    if (rbMount) new ResourceBar({ target: rbMount });

    // Stats panel — replaces static HTML content with reactive Svelte component
    const statsPanel = document.getElementById('stats-panel');
    if (statsPanel) {
        statsPanel.innerHTML = '';
        new StatsPanel({ target: statsPanel });
    }

    // Settings panel mounts into body; manager prop is injected after game init
    const settingsMount = document.createElement('div');
    settingsMount.id = 'settings-panel-mount';
    document.body.appendChild(settingsMount);
    window._settingsPanelComponent = new SettingsPanel({ target: settingsMount, props: { manager: null } });

    // News Feed panel (game prop injected after game init)
    const newsFeedMount = document.createElement('div');
    newsFeedMount.id = 'news-feed-mount';
    document.body.appendChild(newsFeedMount);
    window._newsFeedComponent = new NewsFeedPanel({ target: newsFeedMount, props: { game: null } });

    // Build Mode HUD — mounts into sidebar-header once DOM is ready
    const hudMount = document.createElement('div');
    hudMount.id = 'build-mode-hud-mount';
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) sidebarHeader.appendChild(hudMount);
    else document.getElementById('game-container')?.appendChild(hudMount);
    new BuildModeHUD({ target: hudMount });

    // Factions panel — mounts into game-container
    const factionsMount = document.createElement('div');
    factionsMount.id = 'factions-panel-mount';
    (document.getElementById('game-container') || document.body).appendChild(factionsMount);
    new FactionsPanel({ target: factionsMount });

    // Politics panel — mounts into game-container; callbacks wired after game init via window.game
    const politicsMount = document.createElement('div');
    politicsMount.id = 'politics-panel-mount';
    (document.getElementById('game-container') || document.body).appendChild(politicsMount);
    new PoliticsPanel({
        target: politicsMount,
        props: {
            onEnact:  (id) => window.game?.policyManager?.enactPolicy?.(id),
            onRevoke: (id) => window.game?.policyManager?.revokePolicy?.(id),
        },
    });

    // Citizen profile panel
    const citizenProfileMount = document.createElement('div');
    citizenProfileMount.id = 'citizen-profile-mount';
    document.body.appendChild(citizenProfileMount);
    new CitizenProfile({ target: citizenProfileMount });

    // Quest log panel
    const questLogMount = document.createElement('div');
    questLogMount.id = 'quest-log-mount';
    document.body.appendChild(questLogMount);
    new QuestLog({
        target: questLogMount,
        props: {
            onComplete: (id) => window.game?.ui?.questLog?.markCurrentComplete?.(id),
            onCancel:   (id) => window.game?.ui?.questLog?.cancelQuest?.(id),
        },
    });

    // Tech screen
    const techMount = document.createElement('div');
    techMount.id = 'tech-screen-mount';
    document.body.appendChild(techMount);
    new TechScreen({ target: techMount });

    // Case file panel
    const caseFileMount = document.createElement('div');
    caseFileMount.id = 'case-file-mount';
    document.body.appendChild(caseFileMount);
    new CaseFile({ target: caseFileMount });

    // Codex / help system
    const codexMount = document.createElement('div');
    codexMount.id = 'codex-mount';
    document.body.appendChild(codexMount);
    new Codex({ target: codexMount });

    // Campaign panel
    const campaignMount = document.createElement('div');
    campaignMount.id = 'campaign-panel-mount';
    document.body.appendChild(campaignMount);
    new CampaignPanel({ target: campaignMount });

    // Run summary overlay
    const runSummaryMount = document.createElement('div');
    runSummaryMount.id = 'run-summary-mount';
    document.body.appendChild(runSummaryMount);
    new RunSummary({
        target: runSummaryMount,
        props: {
            onReplay:    (d) => window.game?.ui?.runSummary?.onReplay?.(d),
            onNewRun:    ()  => window.game?.ui?.runSummary?.onNewRun?.(),
            onViewStats: ()  => window.game?.ui?.runSummary?.onViewStats?.(),
        },
    });

    // Meta shop
    const shopMount = document.createElement('div');
    shopMount.id = 'shop-mount';
    document.body.appendChild(shopMount);
    new Shop({
        target: shopMount,
        props: {
            onUnlock: (cat, key) => window.game?.ui?.shop?.unlock?.(cat, key),
        },
    });

    // Seed browser
    const seedBrowserMount = document.createElement('div');
    seedBrowserMount.id = 'seed-browser-mount';
    document.body.appendChild(seedBrowserMount);
    new SeedBrowser({
        target: seedBrowserMount,
        props: {
            onReplay:  (run) => window.game?.ui?.seedBrowser?.handleReplay?.(run),
            onNewSeed: ()    => window.game?.ui?.seedBrowser?.handleNewSeed?.(),
            onPlaySeed:(seed)=> window.game?.ui?.seedBrowser?.handlePlaySeed?.(seed),
        },
    });

    // Show main menu on load
    const menu = document.getElementById('main-menu-overlay');
    if (menu) menu.classList.remove('hidden');

    // Set up start button click handler
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (window.startGame) window.startGame();
        });
    }

    // Set up restart button click handler
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (window.restartGame) window.restartGame();
        });
    }

    // Set up main menu button click handler (main menu screen)
    const mainMenuBtn = document.getElementById('main-menu-btn');
    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', () => {
            if (window.showStartScreen) window.showStartScreen();
        });
    }

    // Set up victory restart button click handler
    const victoryRestartBtn = document.getElementById('victory-restart-btn');
    if (victoryRestartBtn) {
        victoryRestartBtn.addEventListener('click', () => {
            if (window.restartGame) window.restartGame();
        });
    }

    // Set up victory main menu button click handler
    const victoryMainMenuBtn = document.getElementById('victory-main-menu-btn');
    if (victoryMainMenuBtn) {
        victoryMainMenuBtn.addEventListener('click', () => {
            if (window.showStartScreen) window.showStartScreen();
        });
    }

    // Load quest content (async - don't block startup)
    await loadQuestContent();
});

/**
 * Load quest content files
 */
async function loadQuestContent() {
    if (!window.game) return;

    // Load case templates
    const caseResult = await loadQuestsFromDirectory('/src/content/quests');
    window.game.content = { quests: caseResult.quests, questErrors: caseResult.errors || [] };
    if (caseResult.errors?.length) {
        window.game.ui?.showMessage(`Quest load warnings: ${caseResult.errors.length} invalid files skipped.`, 'crisis');
    }

    // Load storylets
    const storyletResult = await loadStoryletsFromDirectory('/src/content/storylets');
    window.game.content.storylets = storyletResult.storylets;

    // Load outcomes
    const outcomeResult = await loadOutcomes('/src/content/outcomes.json');
    window.game.content.outcomes = outcomeResult.outcomes;

    // Seed initial case files if missing (managed through CaseManager).
    if ((window.game.state.cases?.active || []).length === 0 && window.game.spawnCase) {
        window.game.spawnCase('missing_person');
        window.game.spawnCase('corruption');
        window.game.spawnCase('extortion');
    }
}

// Add global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!window.game) return;

    // Ctrl+L to load
    if (e.key.toLowerCase() === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        window.game.loadGame();
    }

    // F3 to toggle perf overlay
    if (e.key === 'F3' && window.perfOverlay) {
        window.perfOverlay.toggle();
    }
});

// Update perf overlay after rendering
window.UIManager = UIManager;
const originalRender = window.UIManager.prototype.render;
window.UIManager.prototype.render = function(...args) {
    const frameDt = args[0];
    if (window.game && window.perfOverlay) {
        window.perfOverlay.update(frameDt, this.renderer3d);
    }
    originalRender.apply(this, args);
};
