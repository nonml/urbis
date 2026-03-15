/**
 * UI Theme Manager
 * 
 * Manages CSS variables for theming, accessibility settings,
 * and visual preferences across the game UI.
 */

// Available themes
export const THEMES = {
    NEO_NOIR: {
        name: 'Neo Noir',
        description: 'Dark cyberpunk aesthetic with neon accents',
        colors: {
            '--primary-color': '#0a0a1a',
            '--primary-light': '#1a1a3a',
            '--primary-dark': '#050510',
            '--accent-color': '#00d4ff',
            '--accent-light': '#4de0ff',
            '--accent-dark': '#00a8cc',
            '--success-color': '#00ff88',
            '--warning-color': '#ffaa00',
            '--danger-color': '#ff4444',
            '--text-primary': '#e0e0ff',
            '--text-secondary': '#a0a0c0',
            '--text-muted': '#606080',
            '--bg-primary': '#0a0a1a',
            '--bg-secondary': '#151525',
            '--bg-tertiary': '#1a1a3a',
            '--border-color': '#2a2a4a',
            '--card-bg': '#151525',
            '--panel-bg': 'rgba(21, 21, 37, 0.95)',
            '--shadow-color': 'rgba(0, 0, 0, 0.5)',
            '--glow-color': 'rgba(0, 212, 255, 0.3)',
            '--grid-color': 'rgba(0, 212, 255, 0.1)',
        }
    },
    STARDREW: {
        name: 'Stardew Valley',
        description: 'Warm, cozy farming aesthetic',
        colors: {
            '--primary-color': '#3b7a57',
            '--primary-light': '#5cb875',
            '--primary-dark': '#2c5d42',
            '--accent-color': '#e6b800',
            '--accent-light': '#f0c808',
            '--accent-dark': '#c9a000',
            '--success-color': '#5cb875',
            '--warning-color': '#ffaa00',
            '--danger-color': '#ff4444',
            '--text-primary': '#3d3d3d',
            '--text-secondary': '#5d5d5d',
            '--text-muted': '#7d7d7d',
            '--bg-primary': '#f4e4bc',
            '--bg-secondary': '#e8d5b0',
            '--bg-tertiary': '#dcc094',
            '--border-color': '#8b5a2b',
            '--card-bg': '#e8d5b0',
            '--panel-bg': 'rgba(232, 213, 176, 0.95)',
            '--shadow-color': 'rgba(0, 0, 0, 0.2)',
            '--glow-color': 'rgba(230, 184, 0, 0.2)',
            '--grid-color': 'rgba(139, 90, 43, 0.1)',
        }
    },
    CYBERPUNK: {
        name: 'Cyberpunk',
        description: 'High-contrast neon with glitch effects',
        colors: {
            '--primary-color': '#0d0d0d',
            '--primary-light': '#1a1a1a',
            '--primary-dark': '#000000',
            '--accent-color': '#ff00ff',
            '--accent-light': '#ff4dff',
            '--accent-dark': '#cc00cc',
            '--success-color': '#00ff00',
            '--warning-color': '#ffff00',
            '--danger-color': '#ff0000',
            '--text-primary': '#ffffff',
            '--text-secondary': '#cccccc',
            '--text-muted': '#888888',
            '--bg-primary': '#0d0d0d',
            '--bg-secondary': '#141414',
            '--bg-tertiary': '#1a1a1a',
            '--border-color': '#333333',
            '--card-bg': '#141414',
            '--panel-bg': 'rgba(20, 20, 20, 0.95)',
            '--shadow-color': 'rgba(0, 0, 0, 0.7)',
            '--glow-color': 'rgba(255, 0, 255, 0.3)',
            '--grid-color': 'rgba(255, 0, 255, 0.05)',
        }
    },
    MINIMAL: {
        name: 'Minimal',
        description: 'Clean, simple, and distraction-free',
        colors: {
            '--primary-color': '#ffffff',
            '--primary-light': '#f5f5f5',
            '--primary-dark': '#e0e0e0',
            '--accent-color': '#333333',
            '--accent-light': '#555555',
            '--accent-dark': '#111111',
            '--success-color': '#228b22',
            '--warning-color': '#b8860b',
            '--danger-color': '#dc143c',
            '--text-primary': '#333333',
            '--text-secondary': '#666666',
            '--text-muted': '#999999',
            '--bg-primary': '#ffffff',
            '--bg-secondary': '#f8f8f8',
            '--bg-tertiary': '#f0f0f0',
            '--border-color': '#dddddd',
            '--card-bg': '#ffffff',
            '--panel-bg': 'rgba(255, 255, 255, 0.95)',
            '--shadow-color': 'rgba(0, 0, 0, 0.1)',
            '--glow-color': 'rgba(0, 0, 0, 0.05)',
            '--grid-color': 'rgba(0, 0, 0, 0.05)',
        }
    },
    // ---------------------------------------------------------------------------
    // Colorblind-safe palettes (Okabe & Ito, 2008 — most cited CB-safe palette)
    // Orange #E69F00, Sky Blue #56B4E9, Bluish Green #009E73, Yellow #F0E442,
    // Blue #0072B2, Vermillion #D55E00, Reddish Purple #CC79A7
    // ---------------------------------------------------------------------------
    DEUTERANOPIA: {
        name: 'Deuteranopia (CB)',
        description: 'Colorblind-safe for red-green vision (deuteranopia/deuteranomaly)',
        colors: {
            '--primary-color': '#0a0f1e',
            '--primary-light': '#141f38',
            '--primary-dark': '#050a12',
            '--accent-color': '#e69f00',       // orange — clearly distinct from blue bg
            '--accent-light': '#f0b429',
            '--accent-dark': '#c48600',
            '--success-color': '#0072b2',       // blue, NOT green
            '--warning-color': '#f0e442',       // yellow
            '--danger-color': '#d55e00',        // vermillion — differs from warning by hue+brightness
            '--text-primary': '#e8e8f0',
            '--text-secondary': '#a8a8c0',
            '--text-muted': '#686888',
            '--bg-primary': '#0a0f1e',
            '--bg-secondary': '#141f38',
            '--bg-tertiary': '#1a2640',
            '--border-color': '#2a3a58',
            '--card-bg': '#141f38',
            '--panel-bg': 'rgba(20, 31, 56, 0.95)',
            '--shadow-color': 'rgba(0, 0, 0, 0.5)',
            '--glow-color': 'rgba(230, 159, 0, 0.3)',
            '--grid-color': 'rgba(230, 159, 0, 0.1)',
        }
    },
    PROTANOPIA: {
        name: 'Protanopia (CB)',
        description: 'Colorblind-safe for red-blind vision (protanopia/protanomaly)',
        colors: {
            '--primary-color': '#0a1018',
            '--primary-light': '#141c28',
            '--primary-dark': '#050810',
            '--accent-color': '#56b4e9',        // sky blue — primary identifier
            '--accent-light': '#7ac4f0',
            '--accent-dark': '#3a9fd8',
            '--success-color': '#0072b2',       // blue (darker than accent)
            '--warning-color': '#e69f00',       // orange
            '--danger-color': '#f0e442',        // bright yellow — high luminance contrast vs bg
            '--text-primary': '#e8e8f0',
            '--text-secondary': '#a8a8c0',
            '--text-muted': '#686888',
            '--bg-primary': '#0a1018',
            '--bg-secondary': '#141c28',
            '--bg-tertiary': '#1a2030',
            '--border-color': '#283848',
            '--card-bg': '#141c28',
            '--panel-bg': 'rgba(20, 28, 40, 0.95)',
            '--shadow-color': 'rgba(0, 0, 0, 0.5)',
            '--glow-color': 'rgba(86, 180, 233, 0.3)',
            '--grid-color': 'rgba(86, 180, 233, 0.1)',
        }
    },
};

// Default theme
export const DEFAULT_THEME = 'NEO_NOIR';

// Default settings
export const DEFAULT_THEME_SETTINGS = {
    theme: DEFAULT_THEME,
    fontScale: 1.0,
    reducedMotion: false,
    highContrast: false,
    showGrid: false,
    compactMode: false
};

/**
 * Theme Manager Class
 */
export class ThemeManager {
    constructor() {
        this.settings = { ...DEFAULT_THEME_SETTINGS };
        this.currentTheme = THEMES[DEFAULT_THEME];
        this.cssVariables = {};
        this.initialized = false;
        
        // Initialize from storage
        this.initFromStorage();
        
        // Apply initial theme
        this.applyTheme();
    }

    /**
     * Initialize settings from localStorage
     */
    initFromStorage() {
        const stored = localStorage.getItem('game_theme_settings');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                this.settings = { ...DEFAULT_THEME_SETTINGS, ...parsed };
            } catch (e) {
                console.warn('Failed to parse theme settings, using defaults');
            }
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('game_theme_settings', JSON.stringify(this.settings));
    }

    /**
     * Get a setting value
     */
    get(key) {
        return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_THEME_SETTINGS[key];
    }

    /**
     * Set a setting value and persist
     */
    set(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        
        // Apply setting immediately
        this.applySetting(key, value);
    }

    /**
     * Apply a specific setting
     */
    applySetting(key, value) {
        switch (key) {
            case 'theme':
                this.setTheme(value);
                break;
            case 'fontScale':
                this.setFontScale(value);
                break;
            case 'reducedMotion':
                this.setReducedMotion(value);
                break;
            case 'highContrast':
                this.setHighContrast(value);
                break;
            case 'colorblindMode':
                this.setColorblindMode(value);
                break;
            case 'showGrid':
                this.setShowGrid(value);
                break;
            case 'compactMode':
                this.setCompactMode(value);
                break;
        }
    }

    /**
     * Set the current theme
     */
    setTheme(themeName) {
        const theme = THEMES[themeName];
        if (!theme) {
            console.warn(`Theme "${themeName}" not found, using default`);
            this.currentTheme = THEMES[DEFAULT_THEME];
        } else {
            this.currentTheme = theme;
        }
        
        this.settings.theme = themeName;
        this.saveSettings();
        this.applyTheme();
    }

    /**
     * Apply the current theme to the document
     */
    applyTheme() {
        const root = document.documentElement;
        
        // Apply color variables
        for (const [variable, value] of Object.entries(this.currentTheme.colors)) {
            root.style.setProperty(variable, value);
            this.cssVariables[variable] = value;
        }
        
        // Apply font scale
        this.setFontScale(this.settings.fontScale);
        
        // Apply reduced motion
        this.setReducedMotion(this.settings.reducedMotion);
        
        // Apply high contrast
        this.setHighContrast(this.settings.highContrast);

        // Apply colorblind mode (from settings manager if available)
        const cbMode = window.settingsManager?.get?.('colorblindMode');
        if (cbMode && cbMode !== 'none') this.setColorblindMode(cbMode);

        this.initialized = true;
    }

    /**
     * Set font scale
     */
    setFontScale(scale) {
        const root = document.documentElement;
        root.style.setProperty('--font-scale', scale.toString());
        root.style.setProperty('--font-size-base', `${16 * scale}px`);
        root.style.setProperty('--font-size-small', `${12 * scale}px`);
        root.style.setProperty('--font-size-large', `${20 * scale}px`);
        root.style.setProperty('--font-size-xlarge', `${24 * scale}px`);
        root.style.setProperty('--spacing-unit', `${8 * scale}px`);
    }

    /**
     * Toggle reduced motion mode
     */
    setReducedMotion(enabled) {
        const root = document.documentElement;
        root.style.setProperty('--reduced-motion', enabled ? '1' : '0');
        
        // Also set prefers-reduced-motion for CSS media query compatibility
        if (enabled) {
            root.style.setProperty('animation-duration', '0.01ms');
            root.style.setProperty('transition-duration', '0.01ms');
        } else {
            root.style.removeProperty('animation-duration');
            root.style.removeProperty('transition-duration');
        }
    }

    /**
     * Toggle high contrast mode
     */
    setHighContrast(enabled) {
        const root = document.documentElement;
        root.style.setProperty('--high-contrast', enabled ? '1' : '0');
        document.body.classList.toggle('high-contrast', enabled);

        if (enabled) {
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#dddddd');
            root.style.setProperty('--text-muted', '#aaaaaa');
            root.style.setProperty('--border-color', '#ffffff');
            root.style.setProperty('--bg-secondary', '#000000');
            root.style.setProperty('--accent-color', '#ffff00');
        } else if (this.currentTheme?.colors) {
            // Restore theme values
            for (const [k, v] of Object.entries(this.currentTheme.colors)) {
                root.style.setProperty(k, v);
            }
        }
    }

    /**
     * Apply colorblind simulation filter to the entire page.
     * Uses SVG feColorMatrix — affects canvas + UI identically.
     * @param {'none'|'deuteranopia'|'protanopia'|'tritanopia'} mode
     */
    setColorblindMode(mode) {
        // Remove previous filter SVG and body class
        document.querySelector('#_colorblind_svg')?.remove();
        document.body.style.removeProperty('filter');
        document.body.classList.remove('colorblind-deuteranopia', 'colorblind-protanopia', 'colorblind-tritanopia');

        const matrices = {
            deuteranopia: '0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0',
            protanopia:   '0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0',
            tritanopia:   '1.256 -0.077 -0.179 0 0  -0.079 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0',
        };
        const matrix = matrices[mode];
        if (!matrix) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = '_colorblind_svg';
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        svg.innerHTML = `<defs><filter id="_cb_filter_${mode}"><feColorMatrix type="matrix" values="${matrix}"/></filter></defs>`;
        document.body.appendChild(svg);
        document.body.style.filter = `url(#_cb_filter_${mode})`;
        document.body.classList.add(`colorblind-${mode}`);
    }

    /**
     * Toggle grid visibility
     */
    setShowGrid(enabled) {
        const root = document.documentElement;
        root.style.setProperty('--show-grid', enabled ? '1' : '0');
    }

    /**
     * Toggle compact mode
     */
    setCompactMode(enabled) {
        const root = document.documentElement;
        root.style.setProperty('--compact-mode', enabled ? '1' : '0');
    }

    /**
     * Get available themes
     */
    getAvailableThemes() {
        return Object.entries(THEMES).map(([key, theme]) => ({
            key,
            name: theme.name,
            description: theme.description
        }));
    }

    /**
     * Get current theme info
     */
    getCurrentThemeInfo() {
        return {
            key: this.settings.theme,
            ...this.currentTheme
        };
    }

    /**
     * Get CSS variable value
     */
    getCSSVariable(name) {
        return this.cssVariables[name] || null;
    }

    /**
     * Reset to default settings
     */
    reset() {
        this.settings = { ...DEFAULT_THEME_SETTINGS };
        this.saveSettings();
        this.applyTheme();
    }

    /**
     * Check if reduced motion is enabled (for VFX system)
     */
    isReducedMotionEnabled() {
        return this.settings.reducedMotion;
    }

    /**
     * Check if theme is initialized
     */
    isInitialized() {
        return this.initialized;
    }
}

/**
 * Screen Reader Announcer
 * Creates a visually-hidden aria-live region for announcing key game events
 * to assistive technologies without affecting visual layout.
 */
export class ScreenReaderAnnouncer {
    constructor() {
        this._polite = null;
        this._assertive = null;
        this._init();
    }

    _init() {
        // Polite: non-urgent messages (resource updates, building built, etc.)
        this._polite = document.createElement('div');
        this._polite.setAttribute('aria-live', 'polite');
        this._polite.setAttribute('aria-atomic', 'true');
        this._polite.setAttribute('role', 'status');
        Object.assign(this._polite.style, {
            position: 'absolute', width: '1px', height: '1px',
            padding: '0', margin: '-1px', overflow: 'hidden',
            clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: '0',
        });

        // Assertive: urgent messages (crisis, attack, game over)
        this._assertive = document.createElement('div');
        this._assertive.setAttribute('aria-live', 'assertive');
        this._assertive.setAttribute('aria-atomic', 'true');
        this._assertive.setAttribute('role', 'alert');
        Object.assign(this._assertive.style, {
            position: 'absolute', width: '1px', height: '1px',
            padding: '0', margin: '-1px', overflow: 'hidden',
            clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: '0',
        });

        document.body.appendChild(this._polite);
        document.body.appendChild(this._assertive);
    }

    /**
     * Announce a polite (non-interrupting) message.
     * Use for: building placed, resource milestone, quest complete.
     * @param {string} message
     */
    announce(message) {
        if (!this._polite) return;
        // Reset then set — forces re-announcement even if text is same
        this._polite.textContent = '';
        requestAnimationFrame(() => { this._polite.textContent = message; });
    }

    /**
     * Announce an urgent (interrupting) message.
     * Use for: crisis started, city under attack, game over.
     * @param {string} message
     */
    announceUrgent(message) {
        if (!this._assertive) return;
        this._assertive.textContent = '';
        requestAnimationFrame(() => { this._assertive.textContent = message; });
    }

    destroy() {
        this._polite?.remove();
        this._assertive?.remove();
        this._polite = null;
        this._assertive = null;
    }
}

/**
 * Create a theme manager instance
 */
export function createThemeManager() {
    return new ThemeManager();
}

// Singleton instance
let themeManagerInstance = null;

/**
 * Get the global theme manager instance
 */
export function getThemeManager() {
    if (!themeManagerInstance) {
        themeManagerInstance = createThemeManager();
    }
    return themeManagerInstance;
}
