import { writable } from 'svelte/store';
import { DEFAULT_THEME } from '../ui/theme.js';

// Canonical source for DEFAULT_SETTINGS and SETTINGS_KEYS.
// Defined here (not in ui/settings.js) to avoid the circular import:
//   stores/settings.js → ui/settings.js → stores/settings.js
export const DEFAULT_SETTINGS = {
    mouseSensitivity: 0.005,
    invertY:          false,
    masterVolume:     0.8,
    uiVolume:         1.0,
    audioVolume:      1.0,
    renderScale:      1.0,
    showFPS:          false,
    showTutorial:     false,
    autoSave:         true,
    theme:            DEFAULT_THEME,
    fontScale:        1.0,
    showDamageNumbers: true,
    speedUnit:        'kph',
    reducedMotion:    false,
    highContrast:     false,
    colorblindMode:   'none',
    qualityPreset:    'medium',
};

export const SETTINGS_KEYS = {
    mouseSensitivity:  'game_settings_mouse_sensitivity',
    invertY:           'game_settings_invert_y',
    masterVolume:      'game_settings_master_volume',
    uiVolume:          'game_settings_ui_volume',
    audioVolume:       'game_settings_audio_volume',
    renderScale:       'game_settings_render_scale',
    showFPS:           'game_settings_show_fps',
    showTutorial:      'game_settings_show_tutorial',
    autoSave:          'game_settings_auto_save',
    theme:             'game_settings_theme',
    fontScale:         'game_settings_font_scale',
    showDamageNumbers: 'game_settings_show_damage_numbers',
    speedUnit:        'game_settings_speed_unit',
    reducedMotion:     'game_settings_reduced_motion',
    highContrast:      'game_settings_high_contrast',
    colorblindMode:    'game_settings_colorblind_mode',
    qualityPreset:     'game_settings_quality_preset',
};

/** Reactive store for settings values — kept in sync with SettingsManager. */
export const settingsStore = writable({ ...DEFAULT_SETTINGS });

/** Controls visibility of the settings panel. */
export const settingsPanelOpen = writable(false);
