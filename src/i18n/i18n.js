// i18n Manager (P-05)
// Localization-ready text system
// Provides t(key, params) function with English table and fallback

// Current language
let currentLanguage = 'en';
let translations = {};

/**
 * Load translations from JSON
 */
export async function loadTranslations(path = '/assets/i18n/en.json') {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            console.warn(`Failed to load translations: ${response.statusText}`);
            return false;
        }
        translations = await response.json();
        return true;
    } catch (e) {
        console.error(`Error loading translations: ${e.message}`);
        return false;
    }
}

/**
 * Set current language
 */
export function setLanguage(lang) {
    if (lang === currentLanguage) return false;

    // Check if translations exist for this language
    const langPath = `/assets/i18n/${lang}.json`;
    return loadTranslations(langPath);
}

/**
 * Get current language
 */
export function getLanguage() {
    return currentLanguage;
}

/**
 * Get all available languages
 */
export function getAvailableLanguages() {
    return ['en']; // Add more as translations are added
}

/**
 * Translation function with placeholder support
 * Usage: t('ui.main_menu.title') or t('ui.greeting', { name: 'John' })
 */
export function t(key, params = {}) {
    if (!translations.strings) {
        console.warn('Translations not loaded');
        return key; // Return key as fallback
    }

    // Navigate through nested object
    const keys = key.split('.');
    let value = translations.strings;
    for (const k of keys) {
        if (value && value[k] !== undefined) {
            value = value[k];
        } else {
            console.warn(`Translation key not found: ${key}`);
            return key; // Return key as fallback (visible marker in dev)
        }
    }

    // Check if value is a string
    if (typeof value !== 'string') {
        console.warn(`Translation key ${key} is not a string`);
        return key;
    }

    // Replace placeholders
    let result = value;
    for (const [placeholder, replacement] of Object.entries(params)) {
        const regex = new RegExp(`{${placeholder}}`, 'g');
        result = result.replace(regex, replacement);
    }

    return result;
}

/**
 * Check if translation key exists
 */
export function hasTranslation(key) {
    if (!translations.strings) return false;

    const keys = key.split('.');
    let value = translations.strings;
    for (const k of keys) {
        if (value && value[k] !== undefined) {
            value = value[k];
        } else {
            return false;
        }
    }

    return typeof value === 'string';
}

/**
 * Get all keys at a path
 */
export function getKeysAtPath(path) {
    if (!translations.strings) return [];

    const keys = path.split('.');
    let value = translations.strings;
    for (const k of keys) {
        if (value && value[k] !== undefined) {
            value = value[k];
        } else {
            return [];
        }
    }

    if (typeof value === 'object' && value !== null) {
        return Object.keys(value);
    }
    return [];
}

/**
 * Check if translations are loaded
 */
export function isLoaded() {
    return Object.keys(translations).length > 0;
}

/**
 * Initialize i18n system
 */
export function initI18n() {
    return loadTranslations();
}

/**
 * Get translation data object
 */
export function getTranslations() {
    return translations;
}

/**
 * Replace core UI labels with i18n keys
 * This function should be called during UI initialization
 */
export function translateUI() {
    // This function would be called by UI components
    // to replace hard-coded strings with i18n keys
    // For now, just a placeholder
    return {
        menuTitle: t('ui.main_menu.title'),
        newGame: t('ui.main_menu.new_game'),
        loadGame: t('ui.main_menu.load_game'),
        settings: t('ui.main_menu.settings'),
        exit: t('ui.main_menu.exit')
    };
}

/**
 * Validate i18n keys in content files
 */
export function validateContent(content) {
    const issues = [];
    // Simple validation - check for untranslatable strings
    const untranslatablePatterns = [
        /"[^"]+":\s*"([^"]+)"/, // Raw strings in JSON
        /return\s+"([^"]+)"/,   // Raw strings in functions
    ];

    for (const pattern of untranslatablePatterns) {
        const matches = content.match(pattern);
        if (matches) {
            issues.push(`Found untranslatable string: ${matches[1]}`);
        }
    }

    return issues;
}

/**
 * Export translation keys for external tools
 */
export function exportKeys() {
    if (!translations.strings) return [];

    function extractKeys(obj, prefix = '') {
        const keys = [];
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'string') {
                keys.push(fullKey);
            } else if (typeof value === 'object') {
                keys.push(...extractKeys(value, fullKey));
            }
        }
        return keys;
    }

    return extractKeys(translations.strings);
}

/**
 * Import translation keys
 */
export function importKeys(keys) {
    // For future use with translation management tools
    return { keys };
}

/**
 * Fallback translation for missing keys
 */
export function fallbackTranslation(key) {
    // In dev mode, add marker for missing translations
    if (typeof __DEV__ === 'undefined' || __DEV__) {
        return `[${key}]`;
    }
    return key;
}

/**
 * Update translation for a specific key
 * Useful for testing or runtime translation changes
 */
export function updateTranslation(key, value) {
    const keys = key.split('.');
    let obj = translations.strings;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) {
            obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
}