import { writable } from 'svelte/store';
import { DEFAULT_SETTINGS } from '../ui/settings.js';

/** Reactive store for settings values — kept in sync with SettingsManager. */
export const settingsStore = writable({ ...DEFAULT_SETTINGS });

/** Controls visibility of the settings panel. */
export const settingsPanelOpen = writable(false);
