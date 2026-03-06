/**
 * Victory Screen Module
 * Displays victory/defeat screens with detailed information
 */

export function createVictoryScreen() {
    return new VictoryScreen();
}

/**
 * Victory Screen Manager
 * Handles victory and defeat screen display
 */
export class VictoryScreen {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.onContinue = null;
    }

    /**
     * Initialize the victory screen
     */
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'victory-screen';
        this.container.className = 'victory-screen hidden';
        this.container.innerHTML = this._getTemplate();
        document.body.appendChild(this.container);

        // Add event listeners
        this.container.querySelector('.victory-continue')?.addEventListener('click', () => this._onContinue());
        this.container.querySelector('.victory-menu')?.addEventListener('click', () => this._onMenu());
        this.container.querySelector('.victory-restart')?.addEventListener('click', () => this._onRestart());
    }

    /**
     * Show the victory/defeat screen
     * @param {Object} state - Game state
     * @param {Object} endState - End state information
     * @param {Function} onContinue - Callback when continuing
     */
    show(state, endState, onContinue = null) {
        this.init();
        this.onContinue = onContinue;

        const isVictory = endState.kind === 'win';
        const title = endState.title || (isVictory ? 'Victory!' : 'Game Over');
        const subtitle = endState.detail || '';

        // Set title and subtitle
        this.container.querySelector('.victory-title').textContent = title;
        this.container.querySelector('.victory-subtitle').textContent = subtitle;

        // Set victory/defeat styling
        this.container.className = `victory-screen ${isVictory ? 'victory' : 'defeat'}`;
        this.container.querySelector('.victory-icon').innerHTML = isVictory
            ? '<span class="victory-star">★</span>'
            : '<span class="defeat-cross">✕</span>';

        // Show stats
        this._updateStats(state);

        // Show achievements if any
        const victoryManager = state.victoryManager;
        if (victoryManager && victoryManager.state?.unlockedAchievements?.length > 0) {
            this._showAchievements(victoryManager.state.unlockedAchievements);
        }

        this.container.classList.remove('hidden');
        this.isVisible = true;

        // Play victory/defeat sound
        if (typeof window !== 'undefined') {
            const audio = new Audio();
            audio.src = isVictory ? 'assets/audio/victory.mp3' : 'assets/audio/defeat.mp3';
            audio.volume = 0.5;
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    /**
     * Hide the victory screen
     */
    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
        this.isVisible = false;
    }

    /**
     * Handle continue button click
     */
    _onContinue() {
        this.hide();
        if (this.onContinue) {
            this.onContinue();
        }
    }

    /**
     * Handle menu button click
     */
    _onMenu() {
        this.hide();
        // Navigate to main menu
        if (typeof window !== 'undefined') {
            window.location.hash = 'menu';
        }
    }

    /**
     * Handle restart button click
     */
    _onRestart() {
        this.hide();
        // Trigger restart via custom event
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('game-restart'));
        }
    }

    /**
     * Update stats display
     * @param {Object} state - Game state
     */
    _updateStats(state) {
        const statsContainer = this.container.querySelector('.victory-stats');
        if (!statsContainer) return;

        const timeState = state.time || {};
        const resources = state.resources || {};

        const stats = [
            { label: 'Day', value: resources.day || 1 },
            { label: 'Population', value: resources.population || 0 },
            { label: 'Gold', value: Math.floor(resources.gold || 0) },
            { label: 'Hours Survived', value: Math.floor(timeState.elapsedHours || 0) },
            { label: 'Buildings', value: state.buildings?.length || 0 }
        ];

        statsContainer.innerHTML = stats.map(stat => `
            <div class="victory-stat">
                <span class="victory-stat-label">${stat.label}</span>
                <span class="victory-stat-value">${stat.value}</span>
            </div>
        `).join('');
    }

    /**
     * Show unlocked achievements
     * @param {Array} achievementIds - Array of achievement IDs
     */
    _showAchievements(achievementIds) {
        const achievementsContainer = this.container.querySelector('.victory-achievements');
        if (!achievementsContainer) return;

        achievementsContainer.innerHTML = `
            <div class="victory-achievements-header">
                <h3>Unlocked Achievements</h3>
                <span>${achievementIds.length} achievements</span>
            </div>
            <div class="victory-achievements-list">
                ${achievementIds.map(id => `
                    <div class="achievement-item">
                        <span class="achievement-icon">🏆</span>
                        <span class="achievement-name">${id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Get HTML template for the victory screen
     * @returns {string} HTML template
     */
    _getTemplate() {
        return `
            <div class="victory-content">
                <div class="victory-icon"></div>
                <h1 class="victory-title"></h1>
                <p class="victory-subtitle"></p>
                
                <div class="victory-stats"></div>
                <div class="victory-achievements"></div>
                
                <div class="victory-buttons">
                    <button class="victory-continue">Continue</button>
                    <button class="victory-restart">Play Again</button>
                    <button class="victory-menu">Main Menu</button>
                </div>
            </div>
        `;
    }
}

/**
 * Achievement notification popup
 */
export class AchievementNotification {
    constructor() {
        this.container = null;
        this.currentlyShowing = false;
        this.queue = [];
    }

    /**
     * Initialize the notification system
     */
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'achievement-notification';
        this.container.className = 'achievement-notification hidden';
        this.container.innerHTML = this._getTemplate();
        document.body.appendChild(this.container);
    }

    /**
     * Show an achievement notification
     * @param {Object} achievement - Achievement data
     */
    show(achievement) {
        this.init();

        if (this.currentlyShowing) {
            this.queue.push(achievement);
            return;
        }

        this.currentlyShowing = true;
        this.container.querySelector('.achievement-name').textContent = achievement.name;
        this.container.querySelector('.achievement-description').textContent = achievement.description;

        this.container.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => this.hide(), 5000);
    }

    /**
     * Hide the notification
     */
    hide() {
        this.container.classList.add('hidden');
        this.currentlyShowing = false;

        // Show next queued notification
        if (this.queue.length > 0) {
            setTimeout(() => this.show(this.queue.shift()), 500);
        }
    }

    /**
     * Get HTML template for the notification
     * @returns {string} HTML template
     */
    _getTemplate() {
        return `
            <div class="achievement-notification-content">
                <span class="achievement-icon">🏆</span>
                <div class="achievement-text">
                    <span class="achievement-label">Achievement Unlocked!</span>
                    <span class="achievement-name"></span>
                    <span class="achievement-description"></span>
                </div>
            </div>
        `;
    }
}