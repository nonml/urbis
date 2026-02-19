// Entry point for the game
import { Game } from './game.js';
import { PerfOverlay } from './dev/perf_overlay.js';
import { DevMenu } from './dev/dev_menu.js';
import { UIManager } from './ui.js';
import { loadQuestsFromDirectory } from './content/loader.js';
import { loadStoryletsFromDirectory } from './content/loader.js';
import { loadOutcomes } from './content/loader.js';
import { CaseGenerator } from './sim/cases/case_generator.js';
import { VERSION, BUILD_TIMESTAMP } from './version.js';

// Display version
document.addEventListener('DOMContentLoaded', () => {
    const versionEl = document.getElementById('version-display');
    if (versionEl) {
        versionEl.textContent = `v${VERSION} (Build: ${BUILD_TIMESTAMP.slice(0, 10)})`;
    }
});

// Global functions for HTML onclick handlers
window.startGame = async function() {
    const menu = document.getElementById('main-menu-overlay');
    console.log('[StartGame] Menu element:', menu);
    if (menu) {
        menu.classList.add('hidden');
        console.log('[StartGame] Menu hidden, display:', window.getComputedStyle(menu).display);
    }

    const preset = document.getElementById('map-size')?.value || 'CITY';
    const seedStr = document.getElementById('world-seed')?.value?.trim();
    const seed = seedStr ? parseInt(seedStr, 10) : undefined;

    window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined });
    window.perfOverlay = new PerfOverlay(window.game);
    window.devMenu = new DevMenu(window.game);
    window.devMenu.enable();

    window.game.init();
};

window.restartGame = async function() {
    document.getElementById('victory-overlay').classList.add('hidden');

    const preset = document.getElementById('map-size')?.value || 'CITY';
    const seedStr = document.getElementById('world-seed')?.value?.trim();
    const seed = seedStr ? parseInt(seedStr, 10) : undefined;

    window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined });

    // Create performance overlay
    window.perfOverlay = new PerfOverlay(window.game);

    // Create dev menu (enabled by default for development)
    window.devMenu = new DevMenu(window.game);
    window.devMenu.enable();

    window.game.init();
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
    window.game.content = { quests: caseResult.quests };
    console.log(`Loaded ${caseResult.quests.length} quest templates`);

    // Load storylets
    const storyletResult = await loadStoryletsFromDirectory('/src/content/storylets');
    window.game.content.storylets = storyletResult.storylets;
    console.log(`Loaded ${storyletResult.storylets.length} storylets`);

    // Load outcomes
    const outcomeResult = await loadOutcomes('/src/content/outcomes.json');
    window.game.content.outcomes = outcomeResult.outcomes;
    console.log(`Loaded ${outcomeResult.outcomes.length} outcomes`);

    // Initialize case generator
    window.game.caseGenerator = new CaseGenerator(window.game);
    window.game.caseGenerator.loadStorylets(window.game.content.storylets || []);
    window.game.caseGenerator.loadCaseTemplates(window.game.content.quests || []);

    // Generate initial cases (main + minor)
    const cases = window.game.caseGenerator.generateCasesFromState();
    for (const quest of cases) {
        window.game.questEngine.addQuest(quest);
    }

    console.log(`Game initialized with ${cases.length} case(s)`);
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

// Hook into game loop to update perf overlay
window.Game = Game;
const originalLoop = window.Game.prototype.loop;
window.Game.prototype.loop = function() {
    // This won't work for prototype hooking due to ES modules
    // Instead, we'll update perf overlay in the renderer
};

// Update perf overlay after rendering
window.UIManager = UIManager;
const originalRender = window.UIManager.prototype.render;
window.UIManager.prototype.render = function(frameDt) {
    if (window.game && window.perfOverlay) {
        window.perfOverlay.update(frameDt, this.renderer3d);
    }
    originalRender.call(this, frameDt);
};