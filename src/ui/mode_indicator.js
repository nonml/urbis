// Mode Indicator UI - Shows current gameplay mode (God/Street)

export const MODE_STREET = 'street';
export const MODE_GOD = 'god';

export const MODE_LABELS = {
    [MODE_STREET]: 'Street Mode',
    [MODE_GOD]: 'God Mode'
};

export const MODE_ICONS = {
    [MODE_STREET]: '🚶',
    [MODE_GOD]: '👁️'
};

export const MODE_COLORS = {
    [MODE_STREET]: '#4a90e2',
    [MODE_GOD]: '#e6b800'
};

/**
 * Mode Indicator - HUD element showing current mode
 */
export class ModeIndicator {
    constructor(game) {
        this.game = game;
        this.mode = MODE_STREET;
        this.uiElement = null;
        this.createUI();
    }

    /**
     * Create mode indicator UI element
     */
    createUI() {
        if (this.uiElement) return;

        const container = document.createElement('div');
        container.id = 'mode-indicator';
        container.className = 'mode-indicator';
        container.innerHTML = `
            <div class="mode-icon">${MODE_ICONS[MODE_STREET]}</div>
            <div class="mode-label">${MODE_LABELS[MODE_STREET]}</div>
        `;

        // Insert after settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.parentNode.insertBefore(container, settingsBtn.nextSibling);
        } else {
            document.body.appendChild(container);
        }

        this.uiElement = container;
        this.icon = container.querySelector('.mode-icon');
        this.label = container.querySelector('.mode-label');
    }

    /**
     * Update mode display
     */
    setMode(mode) {
        this.mode = mode;
        if (this.uiElement) {
            this.icon.textContent = MODE_ICONS[mode];
            this.label.textContent = MODE_LABELS[mode];
            this.label.style.color = MODE_COLORS[mode];
        }
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Toggle between modes
     */
    toggle() {
        const newMode = this.mode === MODE_STREET ? MODE_GOD : MODE_STREET;
        this.setMode(newMode);
        return newMode;
    }

    /**
     * Show mode help tooltip
     */
    showHelp() {
        const help = this.mode === MODE_STREET
            ? 'Avatar controls: WASD move, Click interact, E hack'
            : 'God Mode controls: MMB pan, Scroll zoom, RMB rotate, Zones: 1-3';
        if (this.game?.ui?.showMessage) {
            this.game.ui.showMessage(help, 'normal');
        }
    }
}

/**
 * Create mode indicator instance
 */
export function createModeIndicator(game) {
    return new ModeIndicator(game);
}