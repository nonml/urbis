// Seed browser and replay system for roguelike city building
import { profileManager } from '../sim/persistence/profile.js';
import { randomId } from '../rng.js';

// Seed browser styles
const SEED_BROWSER_STYLES = `
.seed-browser {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 700px;
    max-width: 90vw;
    max-height: 80vh;
    background: rgba(20, 20, 30, 0.98);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    z-index: 10000;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
}

.seed-browser-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.seed-browser-title {
    font-size: 24px;
    font-weight: 700;
}

.seed-browser-close {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

.seed-browser-close:hover {
    color: #fff;
}

.seed-browser-content {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
}

.seed-browser-content::-webkit-scrollbar {
    width: 6px;
}

.seed-browser-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.seed-browser-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
}

.seed-input-group {
    margin-bottom: 20px;
}

.seed-input-label {
    display: block;
    font-size: 13px;
    color: #ccc;
    margin-bottom: 8px;
}

.seed-input-row {
    display: flex;
    gap: 12px;
    align-items: center;
}

.seed-input {
    flex: 1;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-family: monospace;
}

.seed-input:focus {
    outline: none;
    border-color: #4ade80;
    background: rgba(255, 255, 255, 0.15);
}

.seed-btn {
    padding: 10px 20px;
    background: #4ade80;
    color: #000;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.seed-btn:hover {
    background: #22c55e;
    transform: translateY(-2px);
}

.seed-btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.seed-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.15);
}

.seed-btn.outline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
}

.seed-btn.outline:hover {
    background: rgba(255, 255, 255, 0.05);
}

.seed-list {
    margin-top: 20px;
}

.seed-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.seed-list-title {
    font-size: 14px;
    font-weight: 600;
    color: #ccc;
}

.seed-filter-group {
    display: flex;
    gap: 8px;
}

.seed-filter-btn {
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: #aaa;
    cursor: pointer;
}

.seed-filter-btn.active {
    background: #4ade80;
    color: #000;
    font-weight: 600;
}

.seed-items {
    display: grid;
    gap: 8px;
}

.seed-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.seed-item:hover {
    background: rgba(255, 255, 255, 0.08);
}

.seed-item.seed-info {
    grid-template-columns: repeat(4, 1fr);
}

.seed-item.seed-info:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
}

.seed-seed-value {
    font-family: monospace;
    font-size: 13px;
    color: #4ade80;
}

.seed-day-value {
    font-size: 13px;
    color: #888;
}

.seed-score-value {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
}

.seed-score-value.high {
    color: #4ade80;
}

.seed-score-value.medium {
    color: #fbbf24;
}

.seed-score-value.low {
    color: #f87171;
}

.seed-status-value {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
}

.seed-status-win {
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
}

.seed-status-lose {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
}

.seed-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.seed-action-btn {
    padding: 6px 12px;
    font-size: 11px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.seed-action-btn.replay {
    background: #4ade80;
    color: #000;
}

.seed-action-btn.replay:hover {
    background: #22c55e;
}

.seed-action-btn.copy {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.seed-action-btn.copy:hover {
    background: rgba(255, 255, 255, 0.15);
}

.seed-action-btn.delete {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
}

.seed-action-btn.delete:hover {
    background: rgba(248, 113, 113, 0.3);
}

.seed-browser-footer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.seed-stats {
    font-size: 13px;
    color: #888;
}

.seed-stats span {
    color: #fff;
    font-weight: 600;
}

.seed-browser-actions {
    display: flex;
    gap: 8px;
}

.seed-actions-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    font-size: 13px;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
}

.seed-actions-btn:hover {
    background: rgba(255, 255, 255, 0.15);
}

.seed-actions-btn.delete-all {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
}

.seed-actions-btn.delete-all:hover {
    background: rgba(248, 113, 113, 0.3);
}

/* No results message */
.seed-no-results {
    text-align: center;
    padding: 40px;
    color: #888;
    font-size: 14px;
}

.seed-no-results .seed-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}
`;

// Replay manager class
export class ReplayManager {
    constructor(game) {
        this.game = game;
        this.currentReplay = null;
        this.replaySpeed = 1;  // Normal speed
    }

    // Start a replay from saved seed data
    startReplay(seedData) {
        if (!seedData || !seedData.seed) return false;

        this.currentReplay = seedData;

        // Restart game with the saved seed
        if (this.game && typeof this.game.restart === 'function') {
            this.game.restart({
                seed: seedData.seed,
                replay: true,
                speed: this.replaySpeed,
            });
        }

        return true;
    }

    // Stop current replay
    stopReplay() {
        this.currentReplay = null;
        if (this.game && typeof this.game.stop === 'function') {
            this.game.stop();
        }
    }

    // Set replay speed
    setSpeed(speed) {
        this.replaySpeed = speed;
        // Apply speed to game if running
        if (this.game && this.game.time) {
            this.game.time.simDt = 0.2 / speed;
        }
    }

    // Get current replay status
    getReplayStatus() {
        if (!this.currentReplay) return null;

        return {
            seed: this.currentReplay.seed,
            days: this.currentReplay.days,
            ended: this.currentReplay.ended,
            endState: this.currentReplay.endState,
            score: this.currentReplay.score,
        };
    }
}

// Seed browser UI class
export class SeedBrowserUI {
    constructor(game) {
        this.game = game;
        this.panel = null;
        this.isShowing = false;
        this.filter = 'all';  // all, win, lose, interrupted
        this.searchQuery = '';
        this.replayManager = new ReplayManager(game);

        // Style element
        this.styleElement = null;
        this.insertStyles();
    }

    insertStyles() {
        if (this.styleElement) return;

        this.styleElement = document.createElement('style');
        this.styleElement.textContent = SEED_BROWSER_STYLES;
        document.head.appendChild(this.styleElement);
    }

    // Show the seed browser
    show() {
        if (this.isShowing) this.hide();

        // Create panel
        this.panel = document.createElement('div');
        this.panel.className = 'seed-browser';
        this.panel.innerHTML = this.createBrowserHTML();

        // Add event listeners
        this.setupEventListeners();

        // Add to DOM
        document.body.appendChild(this.panel);
        this.isShowing = true;

        // Initial render
        this.renderSeedList();
    }

    hide() {
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        this.isShowing = false;
    }

    setupEventListeners() {
        // Close button
        this.panel.querySelector('.seed-browser-close').addEventListener('click', () => {
            this.hide();
        });

        // Search input
        const searchInput = this.panel.querySelector('.seed-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderSeedList();
            });
        }

        // Filter buttons
        const filterBtns = this.panel.querySelectorAll('.seed-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filter = btn.dataset.filter;
                this.renderSeedList();
            });
        });

        // Generate new seed button
        const newSeedBtn = this.panel.querySelector('.seed-generate-btn');
        if (newSeedBtn) {
            newSeedBtn.addEventListener('click', () => {
                this.handleNewSeed();
            });
        }

        // Play with input seed button
        const playInputBtn = this.panel.querySelector('.seed-play-input-btn');
        if (playInputBtn) {
            playInputBtn.addEventListener('click', () => {
                this.handlePlayInputSeed();
            });
        }

        // Delete all button
        const deleteAllBtn = this.panel.querySelector('.seed-delete-all-btn');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => {
                this.handleDeleteAll();
            });
        }

        // Copy seed button
        const copyBtn = this.panel.querySelector('.seed-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.handleCopySeed();
            });
        }
    }

    createBrowserHTML() {
        const profile = profileManager.getProfileData();

        return `
            <div class="seed-browser-header">
                <div>
                    <div class="seed-browser-title">Seed Browser</div>
                    <div class="seed-browser-subtitle">View past runs and start new ones</div>
                </div>
                <button class="seed-browser-close" aria-label="Close">
                    ×
                </button>
            </div>

            <div class="seed-browser-content">
                <div class="seed-input-group">
                    <label class="seed-input-label">Or Enter Your Own Seed</label>
                    <div class="seed-input-row">
                        <input type="text" class="seed-input seed-search-input" placeholder="Enter seed number or 'random' for random seed">
                        <button class="seed-btn seed-generate-btn">New Random Seed</button>
                        <button class="seed-btn seed-play-input-btn">Play</button>
                    </div>
                </div>

                <div class="seed-list">
                    <div class="seed-list-header">
                        <div class="seed-list-title">Recent Runs (${profile.runHistory.length})</div>
                        <div class="seed-filter-group">
                            <button class="seed-filter-btn ${this.filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                            <button class="seed-filter-btn ${this.filter === 'win' ? 'active' : ''}" data-filter="win">Wins</button>
                            <button class="seed-filter-btn ${this.filter === 'lose' ? 'active' : ''}" data-filter="lose">Losses</button>
                        </div>
                    </div>

                    <div class="seed-items" id="seed-items-container">
                        ${this.createSeedListHTML()}
                    </div>
                </div>
            </div>

            <div class="seed-browser-footer">
                <div class="seed-stats">
                    Total Runs: <span>${profile.totalRuns}</span> | Wins: <span>${profile.wins}</span> | Best Score: <span>${profile.stats?.bestDayReached || 0} days</span>
                </div>
                <div class="seed-browser-actions">
                    <button class="seed-actions-btn seed-delete-all-btn" title="Clear all run history">
                        Clear History
                    </button>
                </div>
            </div>
        `;
    }

    createSeedListHTML() {
        const runHistory = profileManager.profile.runHistory || [];
        let filtered = [...runHistory];

        // Apply filter
        if (this.filter === 'win') {
            filtered = filtered.filter(r => r.endState === 'win');
        } else if (this.filter === 'lose') {
            filtered = filtered.filter(r => r.endState === 'lose' || r.endState === 'interrupted');
        }

        // Apply search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(r => {
                return r.seed?.toString().includes(query) ||
                       r.runId?.toLowerCase().includes(query) ||
                       r.endState?.toLowerCase().includes(query);
            });
        }

        if (filtered.length === 0) {
            return `
                <div class="seed-no-results">
                    <div class="seed-icon">🔍</div>
                    ${this.searchQuery ? 'No runs match your search.' : 'No runs yet. Start your first city!'}
                </div>
            `;
        }

        return filtered.map(run => {
            const win = run.endState === 'win';
            const scoreClass = run.score >= 1000 ? 'high' : run.score >= 500 ? 'medium' : 'low';

            return `
                <div class="seed-item seed-info">
                    <span class="seed-seed-value">${run.seed || 'N/A'}</span>
                    <span class="seed-day-value">Day ${run.days}</span>
                    <span class="seed-score-value ${scoreClass}">Score: ${run.score.toLocaleString()}</span>
                    <span class="seed-status-value ${win ? 'seed-status-win' : 'seed-status-lose'}">
                        ${win ? 'Win' : 'Loss'}
                    </span>
                    <div class="seed-actions">
                        <button class="seed-action-btn replay" data-run="${JSON.stringify(run)}" title="Replay this run">
                            ▶ Replay
                        </button>
                        <button class="seed-action-btn copy" data-seed="${run.seed}" title="Copy seed">
                            📋 Copy
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderSeedList() {
        const container = this.panel.querySelector('#seed-items-container');
        if (container) {
            container.innerHTML = this.createSeedListHTML();
            this.setupEventListeners();  // Re-attach listeners after re-render
        }
    }

    handleNewSeed() {
        const randomSeed = (this.game?.rng?.int(1, 2147483647) ?? Math.floor(Math.random() * 2147483647)).toString();
        const input = this.panel.querySelector('.seed-search-input');
        if (input) {
            input.value = randomSeed;
        }
        this.game.restart({ seed: parseInt(randomSeed, 10) });
        this.hide();
    }

    handlePlayInputSeed() {
        const input = this.panel.querySelector('.seed-search-input');
        const value = input?.value?.trim();

        if (!value) return;

        if (value.toLowerCase() === 'random') {
            this.handleNewSeed();
            return;
        }

        const seed = parseInt(value, 10);
        if (!isNaN(seed) && seed > 0) {
            this.game.restart({ seed });
            this.hide();
        } else {
            alert('Please enter a valid positive number seed or "random"');
        }
    }

    handleCopySeed() {
        const seed = this.panel.querySelector('.seed-copy-btn')?.dataset?.seed;
        if (seed) {
            navigator.clipboard.writeText(seed).then(() => {
                alert(`Seed ${seed} copied to clipboard!`);
            }).catch(() => {
                alert('Failed to copy seed');
            });
        }
    }

    handleDeleteAll() {
        if (confirm('Are you sure you want to clear all run history? This cannot be undone.')) {
            profileManager.reset();
            this.renderSeedList();
        }
    }

    // Get the replay manager
    getReplayManager() {
        return this.replayManager;
    }
}

// Factory function
export function createSeedBrowser(game) {
    return new SeedBrowserUI(game);
}