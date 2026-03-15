// Settings UI - Mouse sensitivity, volume, render scale, toggles
// Settings persist in localStorage (not in save file)
// UI is rendered by SettingsPanel.svelte; this class manages persistence + apply logic.

import { THEMES, DEFAULT_THEME, DEFAULT_THEME_SETTINGS } from './theme.js';
import { settingsStore, settingsPanelOpen } from '../stores/settings.js';

// Default settings
export const DEFAULT_SETTINGS = {
    mouseSensitivity: 0.005,
    invertY: false,
    masterVolume: 0.8,
    uiVolume: 1.0,
    audioVolume: 1.0,
    renderScale: 1.0,
    showFPS: false,
    showTutorial: true,
    autoSave: true,
    // Theme and accessibility settings
    theme: DEFAULT_THEME,
    fontScale: 1.0,
    reducedMotion: false,
    highContrast: false,
    colorblindMode: 'none'
};

// Settings keys for localStorage
export const SETTINGS_KEYS = {
    mouseSensitivity: 'game_settings_mouse_sensitivity',
    invertY: 'game_settings_invert_y',
    masterVolume: 'game_settings_master_volume',
    uiVolume: 'game_settings_ui_volume',
    audioVolume: 'game_settings_audio_volume',
    renderScale: 'game_settings_render_scale',
    showFPS: 'game_settings_show_fps',
    showTutorial: 'game_settings_show_tutorial',
    autoSave: 'game_settings_auto_save',
    theme: 'game_settings_theme',
    fontScale: 'game_settings_font_scale',
    reducedMotion: 'game_settings_reduced_motion',
    highContrast: 'game_settings_high_contrast',
    colorblindMode: 'game_settings_colorblind_mode'
};

/**
 * Settings Manager - Handles settings persistence and apply-side-effects.
 * The UI panel is rendered by SettingsPanel.svelte.
 */
export class SettingsManager {
    constructor(game = null) {
        this.game = game;
        this.settings = { ...DEFAULT_SETTINGS };
        this.isOpen = false;
        this._triggerElement = null;
        this.initFromStorage();
        // Push initial values into Svelte store
        settingsStore.set({ ...this.settings });
    }

    initFromStorage() {
        for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
            const stored = localStorage.getItem(SETTINGS_KEYS[key]);
            if (stored !== null) {
                try {
                    this.settings[key] = JSON.parse(stored);
                } catch (e) {
                    console.warn(`Failed to parse setting ${key}, using default`);
                }
            }
        }
    }

    get(key) {
        return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_SETTINGS[key];
    }

    set(key, value) {
        this.settings[key] = value;
        localStorage.setItem(SETTINGS_KEYS[key], JSON.stringify(value));
        settingsStore.update(s => ({ ...s, [key]: value }));
        this.applySetting(key, value);
    }

    applySetting(key, value) {
        switch (key) {
            case 'showFPS':
                if (window.renderer3d) window.renderer3d.showFPS = value;
                break;
            case 'renderScale':
                if (window.renderer3d) window.renderer3d.setRenderScale(value);
                break;
            case 'theme':
                if (window.themeManager) window.themeManager.setTheme(value);
                break;
            case 'fontScale':
                if (window.themeManager) window.themeManager.setFontScale(value);
                break;
            case 'reducedMotion':
                if (window.themeManager) window.themeManager.setReducedMotion(value);
                if (window.fxSystem) window.fxSystem.setReducedMotion(value);
                break;
            case 'highContrast':
                if (window.themeManager) window.themeManager.setHighContrast(value);
                break;
            case 'colorblindMode':
                if (window.themeManager) window.themeManager.setColorblindMode(value);
                break;
        }
    }

    open() {
        this._triggerElement = document.activeElement;
        this.isOpen = true;
        settingsPanelOpen.set(true);
    }

    close() {
        this.isOpen = false;
        settingsPanelOpen.set(false);
        this._triggerElement?.focus();
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    resetToDefaults() {
        this.settings = { ...DEFAULT_SETTINGS };
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
            localStorage.setItem(SETTINGS_KEYS[key], JSON.stringify(value));
        }
        settingsStore.set({ ...this.settings });
    }

    playUISound(type) {
        if (this.game?.ui?.audioManager?.[type]) {
            this.game.ui.audioManager[type]();
        }
    }

    serialize() {
        return { ...this.settings };
    }

    deserialize(data) {
        if (!data) return;
        this.settings = { ...DEFAULT_SETTINGS, ...data };
        settingsStore.set({ ...this.settings });
    }
}
