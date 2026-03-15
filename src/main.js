// Entry point for the game
import { Game } from './game.js';
import { PerfOverlay } from './dev/perf_overlay.js';
import { DevMenu } from './dev/dev_menu.js';
import { UIManager } from './ui.js';
import { loadQuestsFromDirectory } from './content/loader.js';
import { loadStoryletsFromDirectory } from './content/loader.js';
import { loadOutcomes } from './content/loader.js';
import { VERSION, BUILD_TIMESTAMP } from './version.js?v=20260220';

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
        background: rgba(6, 16, 26, 0.85);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 12000;
        color: #e6f2ff;
        font-family: 'Courier New', monospace;
    `;
    overlay.innerHTML = `
        <div style="width:min(420px, 92vw); padding:20px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.35)">
            <div id="loading-label" style="margin-bottom:8px;">Preparing city...</div>
            <div style="height:10px; background:rgba(255,255,255,0.15); border-radius:99px; overflow:hidden;">
                <div id="loading-fill" style="height:100%; width:0%; background:linear-gradient(90deg,#2fbf71,#54d3ff); transition: width 120ms ease;"></div>
            </div>
            <div id="loading-percent" style="margin-top:8px; font-size:12px; opacity:0.9;">0%</div>
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
        updateLoading(5, 'Preparing session...');
        if (menu) menu.classList.add('hidden');

        const preset = document.getElementById('map-size')?.value || 'CITY';
        const seedStr = document.getElementById('world-seed')?.value?.trim();
        const seed = seedStr ? parseInt(seedStr, 10) : undefined;
        const mode = document.getElementById('game-mode')?.value || 'standard';
        const difficulty = document.getElementById('difficulty-select')?.value || 'NORMAL';

        await nextFrame();
        updateLoading(35, 'Generating world...');
        window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined, mode, difficulty });
        updateLoading(60, 'Booting systems...');
        window.perfOverlay = new PerfOverlay(window.game);
        window.devMenu = new DevMenu(window.game);
        window.devMenu.enable();
        updateLoading(85, 'Streaming initial chunks...');
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
        updateLoading(5, 'Restarting...');

        const preset = document.getElementById('map-size')?.value || 'CITY';
        const seedStr = document.getElementById('world-seed')?.value?.trim();
        const seed = seedStr ? parseInt(seedStr, 10) : undefined;
        const mode = document.getElementById('game-mode')?.value || 'standard';
        const difficulty = document.getElementById('difficulty-select')?.value || 'NORMAL';

        await nextFrame();
        updateLoading(35, 'Generating world...');
        window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined, mode, difficulty });

        updateLoading(60, 'Booting systems...');
        window.perfOverlay = new PerfOverlay(window.game);
        window.devMenu = new DevMenu(window.game);
        window.devMenu.enable();
        updateLoading(85, 'Streaming initial chunks...');
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

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
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
