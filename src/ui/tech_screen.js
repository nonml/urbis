// Tech/Progression Screen UI
// Display player progression, unlocked features, and tech tree

import { UNLOCKS, ProgressionManager } from '../sim/progression.js';

export class TechScreen {
    constructor(game) {
        this.game = game;
        this.shown = false;
        this.overlay = null;
        this.progressBar = null;
        this.pointsDisplay = null;
    }

    /**
     * Create the tech screen overlay if not already created
     */
    createOverlay() {
        if (this.overlay) return this.overlay;

        this.overlay = document.createElement('div');
        this.overlay.id = 'tech-overlay';
        this.overlay.className = 'overlay hidden';
        this.overlay.innerHTML = `
            <div class="overlay-content">
                <div class="victory-icon">🎓</div>
                <h1>Progression & Tech Tree</h1>
                <div class="progress-container" style="margin-bottom: 20px;">
                    <div class="stat-label">Progression Points</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="tech-progress"></div>
                    </div>
                    <span id="tech-points" style="text-align: center; display: block; margin-top: 5px;">0/200</span>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Completed Cases</div>
                        <div class="stat-value" id="tech-completed-cases">0</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Buildings</div>
                        <div class="stat-value" id="tech-buildings">0</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Days Survived</div>
                        <div class="stat-value" id="tech-days">0</div>
                    </div>
                </div>
                <div class="tech-unlocks">
                    <h3>Unlocks</h3>
                    <div id="tech-unlock-list" class="tech-unlock-list"></div>
                </div>
                <div class="tech-heatmap">
                    <h3>District Stability</h3>
                    <div id="tech-stability-list" class="tech-stability-list"></div>
                </div>
                <button class="btn btn-primary" onclick="this.techScreen.toggle()">Close</button>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.progressBar = this.overlay.querySelector('#tech-progress');
        this.pointsDisplay = this.overlay.querySelector('#tech-points');
        return this.overlay;
    }

    /**
     * Toggle visibility of the tech screen
     */
    toggle() {
        if (!this.overlay) this.createOverlay();

        this.shown = !this.shown;
        this.overlay.classList.toggle('hidden', !this.shown);

        if (this.shown) {
            this.update();
        }
    }

    /**
     * Update tech screen with current state
     */
    update() {
        if (!this.overlay) return;

        const progression = this.game.state.progression || { points: 0, unlocked: [], completedCases: 0, districtStability: {} };

        // Update progress bar
        const maxPoints = 200;
        const progressPercent = Math.min(100, (progression.points / maxPoints) * 100);
        this.progressBar.style.width = `${progressPercent}%`;
        this.pointsDisplay.textContent = `${progression.points}/${maxPoints}`;

        // Update stats
        document.getElementById('tech-completed-cases').textContent = progression.completedCases || 0;
        document.getElementById('tech-buildings').textContent = this.game.buildings.buildings.length;
        document.getElementById('tech-days').textContent = this.game.resources.day;

        // Update unlock list
        const unlockList = document.getElementById('tech-unlock-list');
        if (unlockList) {
            unlockList.innerHTML = '';
            for (const [unlockId, unlock] of Object.entries(UNLOCKS)) {
                const isUnlocked = progression.unlocked.includes(unlockId);
                const unlockEl = document.createElement('div');
                unlockEl.className = `tech-unlock-item ${isUnlocked ? 'unlocked' : 'locked'}`;
                unlockEl.innerHTML = `
                    <div class="unlock-icon">${isUnlocked ? '✅' : '🔒'}</div>
                    <div class="unlock-info">
                        <div class="unlock-name">${unlock.name}</div>
                        <div class="unlock-desc">${unlock.description}</div>
                        <div class="unlock-trigger">Requires: ${unlock.trigger}</div>
                    </div>
                `;
                unlockList.appendChild(unlockEl);
            }
        }

        // Update stability list
        const stabilityList = document.getElementById('tech-stability-list');
        if (stabilityList && progression.districtStability) {
            stabilityList.innerHTML = '';
            const districts = this.game.map.districts || [];
            if (districts.length > 0) {
                for (const district of districts) {
                    const stability = progression.districtStability[district.id] || 50;
                    const stabilityColor = stability >= 70 ? '#66cdaa' : (stability >= 40 ? '#f0c808' : '#ff6b6b');
                    const stabilityEl = document.createElement('div');
                    stabilityEl.className = 'stability-item';
                    stabilityEl.innerHTML = `
                        <div class="stability-name">${district.name || 'Unknown District'}</div>
                        <div class="stability-bar">
                            <div class="stability-fill" style="width: ${stability}%; background: ${stabilityColor}"></div>
                        </div>
                        <span class="stability-value">${stability}%</span>
                    `;
                    stabilityList.appendChild(stabilityEl);
                }
            } else {
                stabilityList.innerHTML = '<div class="stability-item">No districts generated yet</div>';
            }
        }
    }

    /**
     * Close the tech screen
     */
    close() {
        this.shown = false;
        if (this.overlay) {
            this.overlay.classList.add('hidden');
        }
    }
}