// Mode Indicator UI - Shows current gameplay mode (God/Street)

// Configuration constants
// NOTE: getElementById expects raw id, not a CSS selector.
export const MODE_INDICATOR_FALLBACK_ID = 'settings-btn';

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
    /**
     * @param {object} game - Game instance
     * @param {HTMLElement|string|Function} [container] - Container element, ID string, or factory function.
     * @param {Document} [doc] - Document instance for DOM manipulation. Defaults to globalThis.document.
     */
    constructor(game, container = undefined, doc = globalThis.document) {
        this.game = game;
        this.mode = MODE_STREET;
        this.uiElement = null;
        this.container = container;
        this.doc = doc;
        this.createUI();
    }

    /**
     * Create mode indicator UI element
     * Container fallback logic (if not provided or not found) is handled by insertIntoContainer.
     * @param {HTMLElement|string|Function} [container] - Container element, ID string, or factory function returning a root node.
     */
    createUI(container = this.container) {
        if (this.uiElement) return;

        const indicatorContainer = this.doc.createElement('div');
        indicatorContainer.id = 'mode-indicator';
        indicatorContainer.className = 'mode-indicator';

        const iconDiv = this.doc.createElement('div');
        iconDiv.className = 'mode-icon';
        iconDiv.textContent = MODE_ICONS[MODE_STREET];

        const labelDiv = this.doc.createElement('div');
        labelDiv.className = 'mode-label';
        labelDiv.textContent = MODE_LABELS[MODE_STREET];

        indicatorContainer.appendChild(iconDiv);
        indicatorContainer.appendChild(labelDiv);

        this.insertIntoContainer(indicatorContainer, container);

        this.uiElement = indicatorContainer;
        this.icon = indicatorContainer.querySelector('.mode-icon');
        this.label = indicatorContainer.querySelector('.mode-label');
    }

    /**
     * Insert the indicator container into the DOM based on container argument
     * @private
     * @param {HTMLElement} indicatorContainer - The DOM element to insert
     * @param {HTMLElement|string|Function} [container] - Container element, ID string, or factory function.
     */
    insertIntoContainer(indicatorContainer, container = this.container) {
        let targetNode = null;

        if (container) {
            if (typeof container === 'string') {
                targetNode = this.doc.getElementById(container);
            } else if (container instanceof HTMLElement) {
                targetNode = container;
            } else if (typeof container === 'function') {
                targetNode = container();
            }
        }

        if (targetNode) {
            this.container = targetNode;
            targetNode.appendChild(indicatorContainer);
        } else {
            // Fallback to original behavior: insert after settings-btn
            const settingsBtn = this.doc.getElementById(MODE_INDICATOR_FALLBACK_ID);
            if (settingsBtn && settingsBtn.parentNode) {
                settingsBtn.parentNode.insertBefore(indicatorContainer, settingsBtn.nextSibling);
                this.container = settingsBtn.parentNode; // Cache parent of settings-btn
            } else {
                console.warn('[ModeIndicator] #settings-btn not found; appending to body');
                this.doc.body.appendChild(indicatorContainer);
                this.container = this.doc.body; // Cache body as last resort
            }
        }
    }

    /**
     * Update the container for the mode indicator.
     * Re-evaluates the target node and moves the existing UI element.
     * @param {HTMLElement|string|Function} container - New container element, ID string, or factory function.
     */
    updateContainer(container) {
        if (!this.uiElement) return;

        let targetNode = null;

        if (container) {
            if (typeof container === 'string') {
                targetNode = this.doc.getElementById(container);
            } else if (container instanceof HTMLElement) {
                targetNode = container;
            } else if (typeof container === 'function') {
                targetNode = container();
            }
        }

        if (targetNode) {
            this.container = targetNode;
            this.container.appendChild(this.uiElement);
        } else {
            console.warn('[ModeIndicator] New container not found; keeping current container.');
        }
    }

    /**
     * Update mode display
     */
    setMode(mode) {
        // Defensive validation: default to MODE_STREET if invalid
        if (mode !== MODE_STREET && mode !== MODE_GOD) {
            console.warn(`[ModeIndicator] Invalid mode '${mode}'. Defaulting to ${MODE_STREET}.`);
            mode = MODE_STREET;
        }
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
        if (!this.game) {
            console.warn('[ModeIndicator] Cannot show help: game instance missing.');
            return;
        }
        const help = this.mode === MODE_STREET
            ? 'Avatar controls: WASD move, Click interact, E hack'
            : 'God Mode controls: MMB pan, Scroll zoom, RMB rotate, Zones: 1-3';
        if (this.game.ui?.showMessage) {
            this.game.ui.showMessage(help, 'normal');
        }
    }

    /**
     * Destroy the mode indicator, removing it from the DOM and clearing references.
     * Prevents memory leaks in long-running applications or when re-instantiating.
     */
    destroy() {
        this.uiElement?.remove();
        this.uiElement = null;
        this.icon = null;
        this.label = null;
    }
}

/**
 * Create mode indicator instance
 */
export function createModeIndicator(game) {
    return new ModeIndicator(game);
}
