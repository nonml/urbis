// Settings UI - Mouse sensitivity, volume, render scale, toggles
// Settings persist in localStorage (not in save file)

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
    autoSave: true
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
    autoSave: 'game_settings_auto_save'
};

/**
 * Settings Manager - Handles settings UI and persistence
 */
export class SettingsManager {
    constructor(game = null) {
        this.game = game;
        this.settings = { ...DEFAULT_SETTINGS };
        this.uiElement = null;
        this.isOpen = false;
        this.initFromStorage();
    }

    /**
     * Initialize settings from localStorage or defaults
     */
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

    /**
     * Get a setting value
     */
    get(key) {
        return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_SETTINGS[key];
    }

    /**
     * Set a setting value and persist to localStorage
     */
    set(key, value) {
        this.settings[key] = value;
        localStorage.setItem(SETTINGS_KEYS[key], JSON.stringify(value));

        // Apply immediate changes where applicable
        this.applySetting(key, value);
    }

    /**
     * Apply a setting immediately
     */
    applySetting(key, value) {
        switch (key) {
            case 'mouseSensitivity':
                // Applied in renderer when reading sensitivity
                break;
            case 'invertY':
                // Applied in renderer
                break;
            case 'showFPS':
                if (window.renderer3d) {
                    window.renderer3d.showFPS = value;
                }
                break;
            case 'renderScale':
                if (window.renderer3d) {
                    window.renderer3d.setRenderScale(value);
                }
                break;
        }
    }

    /**
     * Create settings UI element
     */
    createUI() {
        if (this.uiElement) return this.uiElement;

        this.uiElement = document.createElement('div');
        this.uiElement.id = 'settings-overlay';
        this.uiElement.className = 'overlay settings-overlay hidden';
        this.uiElement.innerHTML = `
            <div class="overlay-content settings-content">
                <div class="overlay-header">
                    <h2>Settings</h2>
                    <button class="btn-close" data-action="close">✕</button>
                </div>
                <div class="settings-tabs">
                    <button class="tab active" data-tab="controls">Controls</button>
                    <button class="tab" data-tab="graphics">Graphics</button>
                    <button class="tab" data-tab="audio">Audio</button>
                    <button class="tab" data-tab="system">System</button>
                </div>
                <div class="settings-content-tabs">
                    <!-- Controls Tab -->
                    <div class="settings-tab-content active" data-content="controls">
                        <div class="setting-row">
                            <label for="mouse-sensitivity">Mouse Sensitivity</label>
                            <div class="slider-container">
                                <input type="range" id="mouse-sensitivity" min="0.001" max="0.02" step="0.001" value="${this.settings.mouseSensitivity}">
                                <span class="value-display" id="mouse-sensitivity-value">${(this.settings.mouseSensitivity * 1000).toFixed(0)}</span>
                            </div>
                            <small class="setting-hint">Adjust camera orbit sensitivity</small>
                        </div>
                        <div class="setting-row">
                            <label class="checkbox-label">
                                <input type="checkbox" id="invert-y" ${this.settings.invertY ? 'checked' : ''}>
                                <span>Invert Y Axis</span>
                            </label>
                        </div>
                    </div>
                    <!-- Graphics Tab -->
                    <div class="settings-tab-content" data-content="graphics">
                        <div class="setting-row">
                            <label for="render-scale">Render Scale</label>
                            <div class="slider-container">
                                <input type="range" id="render-scale" min="0.5" max="1.5" step="0.1" value="${this.settings.renderScale}">
                                <span class="value-display" id="render-scale-value">${(this.settings.renderScale * 100).toFixed(0)}%</span>
                            </div>
                            <small class="setting-hint">Lower values improve performance</small>
                        </div>
                        <div class="setting-row">
                            <label class="checkbox-label">
                                <input type="checkbox" id="show-fps" ${this.settings.showFPS ? 'checked' : ''}>
                                <span>Show FPS Overlay</span>
                            </label>
                        </div>
                    </div>
                    <!-- Audio Tab -->
                    <div class="settings-tab-content" data-content="audio">
                        <div class="setting-row">
                            <label for="master-volume">Master Volume</label>
                            <div class="slider-container">
                                <input type="range" id="master-volume" min="0" max="1" step="0.05" value="${this.settings.masterVolume}">
                                <span class="value-display" id="master-volume-value">${(this.settings.masterVolume * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="setting-row">
                            <label for="audio-volume">Ambient Audio</label>
                            <div class="slider-container">
                                <input type="range" id="audio-volume" min="0" max="1" step="0.05" value="${this.settings.audioVolume}">
                                <span class="value-display" id="audio-volume-value">${(this.settings.audioVolume * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="setting-row">
                            <label for="ui-volume">UI Sounds</label>
                            <div class="slider-container">
                                <input type="range" id="ui-volume" min="0" max="1" step="0.05" value="${this.settings.uiVolume}">
                                <span class="value-display" id="ui-volume-value">${(this.settings.uiVolume * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                    <!-- System Tab -->
                    <div class="settings-tab-content" data-content="system">
                        <div class="setting-row">
                            <label class="checkbox-label">
                                <input type="checkbox" id="show-tutorial" ${this.settings.showTutorial ? 'checked' : ''}>
                                <span>Show Tutorial on New Game</span>
                            </label>
                        </div>
                        <div class="setting-row">
                            <label class="checkbox-label">
                                <input type="checkbox" id="auto-save" ${this.settings.autoSave ? 'checked' : ''}>
                                <span>Auto-Save (every 5 minutes)</span>
                            </label>
                        </div>
                        <div class="setting-row">
                            <button class="btn" id="reset-settings">Reset to Defaults</button>
                        </div>
                    </div>
                </div>
                <div class="overlay-footer">
                    <button class="btn btn-primary" data-action="close">Done</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.uiElement);
        this.setupEventListeners();
        return this.uiElement;
    }

    /**
     * Setup event listeners for settings UI
     */
    setupEventListeners() {
        const overlay = this.uiElement;

        // Tab switching
        overlay.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                overlay.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                overlay.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                overlay.querySelector(`[data-content="${tabName}"]`).classList.add('active');
                this.playUISound('click');
            });
        });

        // Slider inputs
        overlay.querySelector('#mouse-sensitivity')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.set('mouseSensitivity', value);
            overlay.querySelector('#mouse-sensitivity-value').textContent = (value * 1000).toFixed(0);
            this.playUISound('slider');
        });

        overlay.querySelector('#render-scale')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.set('renderScale', value);
            overlay.querySelector('#render-scale-value').textContent = (value * 100).toFixed(0);
            this.playUISound('slider');
        });

        overlay.querySelector('#master-volume')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.set('masterVolume', value);
            overlay.querySelector('#master-volume-value').textContent = (value * 100).toFixed(0);
            this.playUISound('slider');
        });

        overlay.querySelector('#audio-volume')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.set('audioVolume', value);
            overlay.querySelector('#audio-volume-value').textContent = (value * 100).toFixed(0);
            this.playUISound('slider');
        });

        overlay.querySelector('#ui-volume')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.set('uiVolume', value);
            overlay.querySelector('#ui-volume-value').textContent = (value * 100).toFixed(0);
            this.playUISound('slider');
        });

        // Checkbox inputs
        overlay.querySelector('#invert-y')?.addEventListener('change', (e) => {
            this.set('invertY', e.target.checked);
            this.playUISound('click');
        });

        overlay.querySelector('#show-fps')?.addEventListener('change', (e) => {
            this.set('showFPS', e.target.checked);
            this.playUISound('click');
        });

        overlay.querySelector('#show-tutorial')?.addEventListener('change', (e) => {
            this.set('showTutorial', e.target.checked);
            this.playUISound('click');
        });

        overlay.querySelector('#auto-save')?.addEventListener('change', (e) => {
            this.set('autoSave', e.target.checked);
            this.playUISound('click');
        });

        // Action buttons
        overlay.querySelectorAll('[data-action="close"]').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        overlay.querySelector('#reset-settings')?.addEventListener('click', () => {
            if (confirm('Reset all settings to defaults?')) {
                this.resetToDefaults();
                this.updateUI();
                this.playUISound('click');
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close();
            }
        });

        // ESC key to close
        this.closeHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        window.addEventListener('keydown', this.closeHandler);
    }

    /**
     * Play a UI sound
     */
    playUISound(type) {
        // Check if game has audio manager and play sound
        if (this.game?.ui?.audioManager?.[type]) {
            this.game.ui.audioManager[type]();
        }
    }

    /**
     * Open settings UI
     */
    open() {
        this.createUI();
        this.uiElement.classList.remove('hidden');
        this.isOpen = true;
    }

    /**
     * Close settings UI
     */
    close() {
        if (this.uiElement) {
            this.uiElement.classList.add('hidden');
        }
        this.isOpen = false;
    }

    /**
     * Toggle settings UI visibility
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Reset all settings to defaults
     */
    resetToDefaults() {
        this.settings = { ...DEFAULT_SETTINGS };
        localStorage.clear();
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
            localStorage.setItem(SETTINGS_KEYS[key], JSON.stringify(value));
        }
    }

    /**
     * Update UI to match current settings
     */
    updateUI() {
        if (!this.uiElement) return;

        // Update slider values
        this.uiElement.querySelector('#mouse-sensitivity').value = this.settings.mouseSensitivity;
        this.uiElement.querySelector('#mouse-sensitivity-value').textContent = (this.settings.mouseSensitivity * 1000).toFixed(0);

        this.uiElement.querySelector('#render-scale').value = this.settings.renderScale;
        this.uiElement.querySelector('#render-scale-value').textContent = (this.settings.renderScale * 100).toFixed(0);

        this.uiElement.querySelector('#master-volume').value = this.settings.masterVolume;
        this.uiElement.querySelector('#master-volume-value').textContent = (this.settings.masterVolume * 100).toFixed(0);

        this.uiElement.querySelector('#audio-volume').value = this.settings.audioVolume;
        this.uiElement.querySelector('#audio-volume-value').textContent = (this.settings.audioVolume * 100).toFixed(0);

        this.uiElement.querySelector('#ui-volume').value = this.settings.uiVolume;
        this.uiElement.querySelector('#ui-volume-value').textContent = (this.settings.uiVolume * 100).toFixed(0);

        // Update checkbox values
        this.uiElement.querySelector('#invert-y').checked = this.settings.invertY;
        this.uiElement.querySelector('#show-fps').checked = this.settings.showFPS;
        this.uiElement.querySelector('#show-tutorial').checked = this.settings.showTutorial;
        this.uiElement.querySelector('#auto-save').checked = this.settings.autoSave;
    }

    /**
     * Get all settings for save/serialization
     */
    serialize() {
        return { ...this.settings };
    }

    /**
     * Restore settings from save (note: settings are NOT saved to game save,
     * this is for potential migration scenarios)
     */
    deserialize(data) {
        if (!data) return;
        this.settings = { ...DEFAULT_SETTINGS, ...data };
    }
}
