// Entry point for the game
import { Game } from './game.js';

function showFatalError(err) {
    console.error(err);
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);

    // Ensure menu is visible so the user isn't left with a blank screen.
    const menu = document.getElementById('main-menu-overlay');
    if (menu) menu.classList.remove('hidden');

    // Create (or update) an in-page error panel.
    let panel = document.getElementById('fatal-error-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'fatal-error-panel';
        panel.style.position = 'absolute';
        panel.style.left = '16px';
        panel.style.right = '16px';
        panel.style.bottom = '16px';
        panel.style.maxHeight = '40vh';
        panel.style.overflow = 'auto';
        panel.style.zIndex = '999';
        panel.style.padding = '12px 14px';
        panel.style.borderRadius = '12px';
        panel.style.background = 'rgba(0,0,0,0.75)';
        panel.style.color = '#fff';
        panel.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        panel.style.fontSize = '12px';
        panel.style.whiteSpace = 'pre-wrap';
        document.body.appendChild(panel);
    }
    panel.textContent = `FATAL ERROR\n\n${msg}\n\nTip: Run via a local server (e.g. \"python -m http.server\") and check DevTools Console.`;
}

// Global functions for HTML onclick handlers
window.startGame = function() {
    try {
        document.getElementById('main-menu-overlay').classList.add('hidden');

        const preset = document.getElementById('map-size')?.value || 'CITY';
        const seedStr = document.getElementById('world-seed')?.value?.trim();
        const seed = seedStr ? parseInt(seedStr, 10) : undefined;

        window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined });
        window.game.init();
    } catch (e) {
        showFatalError(e);
    }
};

window.restartGame = function() {
    try {
        document.getElementById('victory-overlay').classList.add('hidden');

        const preset = document.getElementById('map-size')?.value || 'CITY';
        const seedStr = document.getElementById('world-seed')?.value?.trim();
        const seed = seedStr ? parseInt(seedStr, 10) : undefined;

        window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined });
        window.game.init();
    } catch (e) {
        showFatalError(e);
    }
};

window.showStartScreen = function() {
    document.getElementById('victory-overlay').classList.add('hidden');
    document.getElementById('main-menu-overlay').classList.remove('hidden');
};

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Show main menu on load
    const menu = document.getElementById('main-menu-overlay');
    if (menu) menu.classList.remove('hidden');
});

// Add global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!window.game) return;
    if (e.key.toLowerCase() === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        window.game.loadGame();
    }
});