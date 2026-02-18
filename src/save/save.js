// Save/Load system with versioned schema and migrations
import { validateGameState, migrateState, getSchemaVersion } from '../state/game_state.js';

const SAVE_KEY = 'cityBuilderSave_v1';

/**
 * Saves the game state to localStorage
 * @param {Object} state - Complete GameState object
 * @returns {boolean} True if save succeeded
 */
export function saveGame(state) {
    try {
        const versionedState = {
            ...state,
            schemaVersion: getSchemaVersion(),
            meta: {
                ...state.meta,
                savedAt: Date.now(),
            },
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(versionedState));
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        return false;
    }
}

/**
 * Loads game state from localStorage
 * @returns {Object|null} GameState object or null if no save found
 */
export function loadGame() {
    try {
        const saveData = localStorage.getItem(SAVE_KEY);
        if (!saveData) {
            return null;
        }

        const state = JSON.parse(saveData);

        // Validate basic shape
        const validation = validateGameState(state);
        if (!validation.valid) {
            console.error('Save validation failed:', validation.error);
            return null;
        }

        // Apply migrations if needed
        const migratedState = migrateState(state);

        return migratedState;
    } catch (e) {
        console.error('Load failed:', e);
        return null;
    }
}

/**
 * Deletes the save file
 * @returns {boolean} True if delete succeeded
 */
export function deleteSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
        return true;
    } catch (e) {
        console.error('Delete save failed:', e);
        return false;
    }
}

/**
 * Checks if a save exists
 * @returns {boolean}
 */
export function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Gets save metadata without loading full state
 * @returns {Object|null} Save metadata or null
 */
export function getSaveMetadata() {
    try {
        const saveData = localStorage.getItem(SAVE_KEY);
        if (!saveData) return null;

        const state = JSON.parse(saveData);
        if (!state.meta) return null;

        return {
            seed: state.meta.seed,
            mapPreset: state.meta.mapPreset,
            savedAt: state.meta.savedAt,
            schemaVersion: state.schemaVersion,
        };
    } catch (e) {
        return null;
    }
}