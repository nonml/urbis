// Entry point for the game
import { Game } from './game.js';

// Global functions for HTML onclick handlers
window.startGame = function() {
    document.getElementById('main-menu-overlay').classList.add('hidden');

    const preset = document.getElementById('map-size')?.value || 'CITY';
    const seedStr = document.getElementById('world-seed')?.value?.trim();
    const seed = seedStr ? parseInt(seedStr, 10) : undefined;

    window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined });
    window.game.init();
};

window.restartGame = function() {
    document.getElementById('victory-overlay').classList.add('hidden');

    const preset = document.getElementById('map-size')?.value || 'CITY';
    const seedStr = document.getElementById('world-seed')?.value?.trim();
    const seed = seedStr ? parseInt(seedStr, 10) : undefined;

    window.game = new Game({ mapPreset: preset, seed: Number.isFinite(seed) ? seed : undefined });
    window.game.init();
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