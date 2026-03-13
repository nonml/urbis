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
    }
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
        
        if (enabled) {
            // Boost contrast
            root.style.setProperty('--text-primary', enabled ? '#ffffff' : this.currentTheme.colors['--text-primary']);
            root.style.setProperty('--border-color', enabled ? '#ffffff' : this.currentTheme.colors['--border-color']);
        }
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
