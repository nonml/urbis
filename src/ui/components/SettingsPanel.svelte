<script>
    import { settingsStore, settingsPanelOpen } from '../../stores/settings.js';
    import { THEMES } from '../theme.js';

    /** SettingsManager instance injected by ui.js */
    export let manager = null;

    let activeTab = 'controls';
    let s = {};
    settingsStore.subscribe(v => { s = v; });

    let loadedMods = 'No mods loaded';

    function set(key, value) {
        settingsStore.update(cur => ({ ...cur, [key]: value }));
        manager?.set(key, value);
    }

    function close() {
        settingsPanelOpen.set(false);
        manager?._triggerElement?.focus();
    }

    function resetDefaults() {
        if (confirm('Reset all settings to defaults?')) {
            manager?.resetToDefaults();
            settingsStore.set({ ...manager?.settings ?? {} });
        }
    }

    async function loadMod() {
        const modLoader = manager?.game?.modLoader;
        if (!modLoader) return;
        const result = await modLoader.loadFromFile();
        if (result.success) {
            loadedMods = `Loaded: ${modLoader.getLoadedModNames().join(', ')}`;
            if (result.warnings?.length) console.warn('[ModLoader]', result.warnings);
        } else {
            loadedMods = `Error: ${result.error}`;
        }
    }

    function knownIssues() {
        manager?.game?.feedbackUI?.toggle();
    }

    const tabs = [
        { id: 'controls', label: 'Controls' },
        { id: 'graphics', label: 'Graphics' },
        { id: 'audio',    label: 'Audio' },
        { id: 'system',   label: 'System' },
    ];

    function onKeydownTab(e, idx) {
        if (e.key === 'ArrowRight') { e.preventDefault(); activeTab = tabs[(idx + 1) % tabs.length].id; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); activeTab = tabs[(idx - 1 + tabs.length) % tabs.length].id; }
        if (e.key === 'Home')       { e.preventDefault(); activeTab = tabs[0].id; }
        if (e.key === 'End')        { e.preventDefault(); activeTab = tabs[tabs.length - 1].id; }
    }

    function handleOverlayClick(e) {
        if (e.target === e.currentTarget) close();
    }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape' && $settingsPanelOpen) close(); }} />

{#if $settingsPanelOpen}
<div id="settings-overlay" class="overlay settings-overlay"
     role="dialog" aria-modal="true" aria-label="Settings"
     on:click={handleOverlayClick}>
    <div class="overlay-content settings-content">
        <div class="overlay-header">
            <h2>Settings</h2>
            <button class="btn-close" data-action="close" aria-label="Close settings" on:click={close}>✕</button>
        </div>

        <!-- Tabs -->
        <div class="settings-tabs" role="tablist" aria-label="Settings categories">
            {#each tabs as tab, idx}
            <button class="tab" class:active={activeTab === tab.id}
                    data-tab={tab.id}
                    role="tab" aria-selected={activeTab === tab.id}
                    on:click={() => activeTab = tab.id}
                    on:keydown={(e) => onKeydownTab(e, idx)}>
                {tab.label}
            </button>
            {/each}
        </div>

        <div class="settings-content-tabs">

            <!-- Controls -->
            {#if activeTab === 'controls'}
            <div class="settings-tab-content active" data-content="controls" role="tabpanel" tabindex="0">
                <div class="setting-row">
                    <label for="mouse-sensitivity">Mouse Sensitivity</label>
                    <div class="slider-container">
                        <input type="range" id="mouse-sensitivity" min="0.001" max="0.02" step="0.001"
                               value={s.mouseSensitivity}
                               on:input={(e) => set('mouseSensitivity', parseFloat(e.target.value))} />
                        <span class="value-display">{Math.round((s.mouseSensitivity ?? 0.005) * 1000)}</span>
                    </div>
                    <small class="setting-hint">Adjust camera orbit sensitivity</small>
                </div>
                <div class="setting-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="invert-y" checked={s.invertY}
                               on:change={(e) => set('invertY', e.target.checked)} />
                        <span>Invert Y Axis</span>
                    </label>
                </div>
            </div>
            {/if}

            <!-- Graphics -->
            {#if activeTab === 'graphics'}
            <div class="settings-tab-content active" data-content="graphics" role="tabpanel" tabindex="0">
                <div class="setting-row">
                    <label for="render-scale">Render Scale</label>
                    <div class="slider-container">
                        <input type="range" id="render-scale" min="0.5" max="1.5" step="0.1"
                               value={s.renderScale}
                               on:input={(e) => set('renderScale', parseFloat(e.target.value))} />
                        <span class="value-display">{Math.round((s.renderScale ?? 1) * 100)}%</span>
                    </div>
                    <small class="setting-hint">Lower values improve performance</small>
                </div>
                <div class="setting-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="show-fps" checked={s.showFPS}
                               on:change={(e) => set('showFPS', e.target.checked)} />
                        <span>Show FPS Overlay</span>
                    </label>
                </div>
                <div class="setting-row">
                    <label for="theme-select">Theme</label>
                    <select id="theme-select" class="setting-select" value={s.theme}
                            on:change={(e) => set('theme', e.target.value)}>
                        {#each Object.entries(THEMES) as [key, theme]}
                        <option value={key}>{theme.name}</option>
                        {/each}
                    </select>
                    <small class="setting-hint">Change the visual appearance</small>
                </div>
                <div class="setting-row">
                    <label for="font-scale">Font Scale</label>
                    <div class="slider-container">
                        <input type="range" id="font-scale" min="0.8" max="1.5" step="0.05"
                               value={s.fontScale}
                               on:input={(e) => set('fontScale', parseFloat(e.target.value))} />
                        <span class="value-display">{Math.round((s.fontScale ?? 1) * 100)}%</span>
                    </div>
                    <small class="setting-hint">Adjust UI text size</small>
                </div>
                <div class="setting-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="reduced-motion" checked={s.reducedMotion}
                               on:change={(e) => set('reducedMotion', e.target.checked)} />
                        <span>Reduce Motion</span>
                    </label>
                    <small class="setting-hint">Disable animations and effects</small>
                </div>
                <div class="setting-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="high-contrast" checked={s.highContrast}
                               on:change={(e) => set('highContrast', e.target.checked)} />
                        <span>High Contrast</span>
                    </label>
                    <small class="setting-hint">Increase color contrast</small>
                </div>
                <div class="setting-row">
                    <label for="colorblind-mode">Color Vision</label>
                    <select id="colorblind-mode" value={s.colorblindMode ?? 'none'}
                            on:change={(e) => set('colorblindMode', e.target.value)}>
                        <option value="none">Normal</option>
                        <option value="deuteranopia">Deuteranopia (red-green)</option>
                        <option value="protanopia">Protanopia (red-green, severe)</option>
                        <option value="tritanopia">Tritanopia (blue-yellow)</option>
                    </select>
                    <small class="setting-hint">Adjusts colors for color vision deficiencies</small>
                </div>
            </div>
            {/if}

            <!-- Audio -->
            {#if activeTab === 'audio'}
            <div class="settings-tab-content active" data-content="audio" role="tabpanel" tabindex="0">
                <div class="setting-row">
                    <label for="master-volume">Master Volume</label>
                    <div class="slider-container">
                        <input type="range" id="master-volume" min="0" max="1" step="0.05"
                               value={s.masterVolume}
                               on:input={(e) => set('masterVolume', parseFloat(e.target.value))} />
                        <span class="value-display">{Math.round((s.masterVolume ?? 0.8) * 100)}%</span>
                    </div>
                </div>
                <div class="setting-row">
                    <label for="audio-volume">Ambient Audio</label>
                    <div class="slider-container">
                        <input type="range" id="audio-volume" min="0" max="1" step="0.05"
                               value={s.audioVolume}
                               on:input={(e) => set('audioVolume', parseFloat(e.target.value))} />
                        <span class="value-display">{Math.round((s.audioVolume ?? 1) * 100)}%</span>
                    </div>
                </div>
                <div class="setting-row">
                    <label for="ui-volume">UI Sounds</label>
                    <div class="slider-container">
                        <input type="range" id="ui-volume" min="0" max="1" step="0.05"
                               value={s.uiVolume}
                               on:input={(e) => set('uiVolume', parseFloat(e.target.value))} />
                        <span class="value-display">{Math.round((s.uiVolume ?? 1) * 100)}%</span>
                    </div>
                </div>
            </div>
            {/if}

            <!-- System -->
            {#if activeTab === 'system'}
            <div class="settings-tab-content active" data-content="system" role="tabpanel" tabindex="0">
                <div class="setting-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="show-tutorial" checked={s.showTutorial}
                               on:change={(e) => set('showTutorial', e.target.checked)} />
                        <span>Show Tutorial on New Game</span>
                    </label>
                </div>
                <div class="setting-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="auto-save" checked={s.autoSave}
                               on:change={(e) => set('autoSave', e.target.checked)} />
                        <span>Auto-Save (every 5 minutes)</span>
                    </label>
                </div>
                <div class="setting-row">
                    <button id="reset-settings" class="btn" on:click={resetDefaults}>Reset to Defaults</button>
                </div>
                <div class="setting-row">
                    <button id="known-issues-btn" class="btn btn-secondary" on:click={knownIssues}>
                        <svg width="16" height="16" viewBox="0 0 24 24" style="margin-right:8px;vertical-align:middle">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                        </svg>
                        Known Issues &amp; Feedback
                    </button>
                </div>
                <div class="setting-row">
                    <button class="btn btn-secondary" on:click={loadMod}>Load Mod Pack (.json)</button>
                    <small class="setting-hint">{loadedMods}</small>
                </div>
            </div>
            {/if}

        </div>

        <div class="overlay-footer">
            <button class="btn btn-primary" on:click={close}>Done</button>
        </div>
    </div>
</div>
{/if}
