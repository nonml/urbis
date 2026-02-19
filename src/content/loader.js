// Content loader - loads and validates quest/storylet JSON files
import { getSchemaVersion, migrateState, validateGameState } from '../state/game_state.js';
import { validateQuestDefinition } from './quests/schema.js';

/**
 * Loads JSON content from a URL with error handling
 * @param {string} url - Path to JSON file
 * @returns {Promise<Object|null>} Parsed content or null on failure
 */
export async function loadJsonFile(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Content loader: Failed to fetch ${url}: ${response.status}`);
            return null;
        }
        const text = await response.text();
        if (!text.trim()) {
            console.warn(`Content loader: Empty file ${url}`);
            return null;
        }
        return JSON.parse(text);
    } catch (e) {
        console.error(`Content loader: Parse error in ${url}: ${e.message}`);
        return null;
    }
}

/**
 * Validates a quest file against the schema
 * @param {Object} quest - Quest object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateQuest(quest) {
    const v = validateQuestDefinition(quest);
    return { valid: v.valid, errors: v.errors, warnings: v.warnings };
}

/**
 * Validates a storylet file against the schema
 * @param {Object} storylet - Storylet object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateStorylet(storylet) {
    const errors = [];

    // Required fields
    if (!storylet.id) errors.push('Missing required field: id');
    if (!storylet.tags || !Array.isArray(storylet.tags)) {
        errors.push('Missing or invalid tags (must be array)');
    }

    // Weight validation (optional but recommended)
    if (storylet.weight !== undefined && (typeof storylet.weight !== 'number' || storylet.weight < 0)) {
        errors.push('Invalid weight (must be a positive number)');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Loads all quest files from a directory
 * @param {string} baseDir - Base directory path
 * @param {string} pattern - Glob pattern for files (e.g., '*.json')
 * @returns {Promise<Object[]>} Array of valid quests
 */
export async function loadQuestsFromDirectory(baseDir) {
    const quests = [];
    const loadErrors = [];

    try {
        // Try to fetch directory listing (may not work in all environments)
        const manifestUrl = `${baseDir}/manifest.json`;
        const manifest = await loadJsonFile(manifestUrl);

        let files = [];
        if (manifest && Array.isArray(manifest.files)) {
            files = manifest.files;
        } else {
            // Fallback: try common quest files
            const commonFiles = [
                'case_missing_person.json',
                'case_corruption.json',
                'case_gang_activity.json',
                'case_whistleblower.json',
                'case_sabotage.json',
            ];
            files = commonFiles;
        }

        for (const file of files) {
            const url = `${baseDir}/${file}`;
            const content = await loadJsonFile(url);

            if (content) {
                const validation = validateQuest(content);
                if (validation.valid) {
                    quests.push(content);
                    if (validation.warnings?.length) {
                        loadErrors.push({ file, errors: validation.warnings.map((w) => `warning: ${w}`) });
                    }
                } else {
                    loadErrors.push({ file, errors: validation.errors });
                }
            }
        }
    } catch (e) {
        console.error('Content loader: Error loading quests:', e);
    }

    return { quests, errors: loadErrors };
}

/**
 * Loads all storylet files from a directory
 * @param {string} baseDir - Base directory path
 * @returns {Promise<Object[]>} Array of valid storylets
 */
export async function loadStoryletsFromDirectory(baseDir) {
    const storylets = [];
    const loadErrors = [];

    try {
        // Try to fetch directory listing
        const manifestUrl = `${baseDir}/manifest.json`;
        const manifest = await loadJsonFile(manifestUrl);

        let files = [];
        if (manifest && Array.isArray(manifest.files)) {
            files = manifest.files;
        } else {
            // Fallback: try common storylet files
            const commonFiles = [
                'storylet_corruption.json',
                'storylet_missing.json',
                'storylet_gang.json',
                'storylet_whistleblower.json',
                'storylet_sabotage.json',
                'storylet_coverup.json',
            ];
            files = commonFiles;
        }

        for (const file of files) {
            const url = `${baseDir}/${file}`;
            const content = await loadJsonFile(url);

            if (content) {
                const validation = validateStorylet(content);
                if (validation.valid) {
                    storylets.push(content);
                } else {
                    loadErrors.push({ file, errors: validation.errors });
                }
            }
        }
    } catch (e) {
        console.error('Content loader: Error loading storylets:', e);
    }

    return { storylets, errors: loadErrors };
}

/**
 * Loads outcomes from a JSON file
 * @param {string} url - Path to outcomes.json
 * @returns {Promise<Object[]>} Array of valid outcomes
 */
export async function loadOutcomes(url) {
    const outcomes = [];
    const loadErrors = [];

    try {
        const content = await loadJsonFile(url);
        if (content) {
            if (Array.isArray(content)) {
                for (const outcome of content) {
                    if (outcome.id && outcome.effect) {
                        outcomes.push(outcome);
                    } else {
                        loadErrors.push({ file: url, error: 'Invalid outcome structure' });
                    }
                }
            } else if (content.outcomes && Array.isArray(content.outcomes)) {
                outcomes.push(...content.outcomes);
            }
        }
    } catch (e) {
        console.error('Content loader: Error loading outcomes:', e);
    }

    return { outcomes, errors: loadErrors };
}

/**
 * Logs loading results to console
 * @param {Object} result - Result from load functions
 * @param {string} type - Type of content loaded ('quests', 'storylets', 'outcomes')
 */
export function logLoadResult(result, type) {
    const count = Array.isArray(result) ? result.length : (result?.length || 0);
    const errors = result?.errors || [];

    if (errors.length > 0) {
        console.warn(`Content loader: ${errors.length} ${type} skipped due to validation errors`);
        errors.forEach(err => {
            console.warn(`  - ${err.file}: ${Array.isArray(err.errors) ? err.errors.join('; ') : err.error}`);
        });
    }

    console.log(`Content loader: Loaded ${count} ${type}`);
}
