// Save/Load system with versioned schema and migrations
import { validateGameState, migrateState, getSchemaVersion } from '../state/game_state.js';

const SAVE_KEY = 'cityBuilderSave_v1';

const QUOTA_THRESHOLD = 4500000;

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
        const serializedState = JSON.stringify(versionedState);
        
        if (serializedState.length > QUOTA_THRESHOLD) {
            console.warn('Save data exceeds 4.5MB quota, truncating may be needed');
        }
        
        localStorage.setItem(SAVE_KEY, serializedState);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.error('Save failed: localStorage quota exceeded');
        } else if (e.name === 'SyntaxError') {
            console.error('Save failed: Invalid JSON in save data');
        } else if (e.name === 'SecurityError') {
            console.error('Save failed: Security restriction prevented write');
        } else {
            console.error('Save failed:', e);
        }
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
        if (e.name === 'SyntaxError') {
            console.error('Load failed: Invalid JSON in save data');
        } else {
            console.error('Load failed:', e);
        }
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
        if (e.name === 'SecurityError') {
            console.error('Delete save failed: Security restriction prevented removal');
        } else {
            console.error('Delete save failed:', e);
        }
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
        if (e.name === 'SyntaxError') {
            console.error('Get save metadata failed: Invalid JSON in save data');
            return null;
        } else {
            return null;
        }
    }
}