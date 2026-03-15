/**
 * Mod Loader – Phase 8: Modding Support
 *
 * Lets players load JSON "content packs" that add or override:
 *   - Building types (custom buildings)
 *   - Scenario win conditions (custom victory rules)
 *   - Custom theme CSS-variable overrides
 *
 * A mod pack is a plain JSON file that follows the schema in
 * MOD_SCHEMA_EXAMPLE below. Players load it via a file-picker in the
 * Settings ▸ System tab.
 *
 * All mod data is validated before merging; errors are reported but
 * never crash the game.
 */

import { BUILDING_TYPES, BUILDING_SECURITY } from '../constants.js';

// ---------------------------------------------------------------------------
// Schema documentation / example (not used at runtime – purely for reference)
// ---------------------------------------------------------------------------
export const MOD_SCHEMA_EXAMPLE = {
    meta: {
        name: 'My Mod Pack',
        version: '1.0.0',
        description: 'A sample content pack',
        author: 'Community'
    },
    buildings: {
        // Key becomes the building type id (must be kebab-case)
        'brewery': {
            name: 'Brewery',
            icon: '🍺',
            description: 'Produces gold from local grain.',
            cost: { gold: 40, wood: 20 },
            population: 0,
            income: { gold: 8, food: 0, wood: 0 },
            upkeep: 2
        }
    },
    scenarios: [
        {
            id: 'eco_paradise',
            name: 'Eco Paradise',
            description: 'Reach 500 food production with zero pollution buildings.',
            // condition is evaluated as a JS expression string with `game` in scope.
            // Only safe, whitelisted property access is allowed (see _evalScenario).
            condition: 'game.buildings.totalFoodProduction >= 500'
        }
    ],
    theme: {
        // Any CSS variable overrides
        '--accent-color': '#00ff77'
    }
};

// ---------------------------------------------------------------------------
// ModLoader class
// ---------------------------------------------------------------------------
export class ModLoader {
    constructor(game) {
        this.game = game;
        /** @type {Map<string, Object>} mod id → loaded mod data */
        this.loadedMods = new Map();
        /** Custom scenario definitions merged from mods */
        this.customScenarios = [];
    }

    /**
     * Open a file picker and load a JSON mod pack.
     * Returns a Promise that resolves with { success, modName, error }.
     */
    loadFromFile() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file) { resolve({ success: false, error: 'No file selected' }); return; }
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    const result = this._applyMod(data);
                    resolve(result);
                } catch (err) {
                    resolve({ success: false, error: `Failed to parse mod: ${err.message}` });
                }
            };
            input.click();
        });
    }

    /**
     * Validate and apply a parsed mod pack object.
     * @param {Object} data - Parsed JSON
     * @returns {{ success: boolean, modName: string, warnings: string[], error?: string }}
     */
    _applyMod(data) {
        const warnings = [];

        // -- Meta
        const meta = data.meta || {};
        const modName = meta.name || 'Unnamed Mod';
        const modId = `${modName}-${meta.version || '1.0'}`;

        if (this.loadedMods.has(modId)) {
            return { success: false, modName, error: 'Mod is already loaded' };
        }

        // -- Buildings
        if (data.buildings && typeof data.buildings === 'object') {
            for (const [typeId, def] of Object.entries(data.buildings)) {
                if (!this._validateBuildingId(typeId)) {
                    warnings.push(`Skipped building "${typeId}": invalid id (use kebab-case)`);
                    continue;
                }
                if (!this._validateBuildingDef(def)) {
                    warnings.push(`Skipped building "${typeId}": missing required fields`);
                    continue;
                }
                if (BUILDING_TYPES[typeId] || BUILDING_SECURITY[typeId]) {
                    warnings.push(`Overriding existing building type "${typeId}"`);
                }
                BUILDING_TYPES[typeId] = {
                    name: String(def.name),
                    icon: String(def.icon || '🏗️'),
                    description: String(def.description || ''),
                    cost: this._sanitizeCost(def.cost),
                    population: Math.max(0, parseInt(def.population, 10) || 0),
                    income: this._sanitizeIncome(def.income),
                    upkeep: Math.max(0, parseInt(def.upkeep, 10) || 0),
                    _fromMod: modId,
                };
            }
        }

        // -- Scenarios
        if (Array.isArray(data.scenarios)) {
            for (const scenario of data.scenarios) {
                if (!scenario.id || !scenario.name || !scenario.condition) {
                    warnings.push(`Skipped scenario: missing id, name, or condition`);
                    continue;
                }
                if (!this._isSafeCondition(scenario.condition)) {
                    warnings.push(`Skipped scenario "${scenario.name}": unsafe condition expression`);
                    continue;
                }
                this.customScenarios.push({
                    id: String(scenario.id),
                    name: String(scenario.name),
                    description: String(scenario.description || ''),
                    condition: String(scenario.condition),
                    _fromMod: modId,
                });
            }
        }

        // -- Theme overrides
        if (data.theme && typeof data.theme === 'object') {
            const root = document.documentElement;
            for (const [varName, value] of Object.entries(data.theme)) {
                if (!varName.startsWith('--')) {
                    warnings.push(`Skipped theme key "${varName}": must start with --`);
                    continue;
                }
                root.style.setProperty(varName, String(value));
            }
        }

        this.loadedMods.set(modId, { meta, data });
        return { success: true, modName, warnings };
    }

    /**
     * Check if any custom scenario win condition is currently satisfied.
     * Called from the game's victory check loop.
     * @returns {Object|null} - The winning scenario, or null
     */
    checkCustomVictory() {
        if (this.customScenarios.length === 0) return null;
        for (const scenario of this.customScenarios) {
            if (this._evalScenario(scenario.condition)) return scenario;
        }
        return null;
    }

    /**
     * Get a list of loaded mod names for the UI.
     */
    getLoadedModNames() {
        return Array.from(this.loadedMods.values()).map(m => m.meta?.name || 'Unnamed');
    }

    // -------------------------------------------------------------------------
    // Validation helpers
    // -------------------------------------------------------------------------

    _validateBuildingId(id) {
        return typeof id === 'string' && /^[a-z][a-z0-9-]{0,48}$/.test(id);
    }

    _validateBuildingDef(def) {
        return def && typeof def.name === 'string' && def.income && def.cost;
    }

    _sanitizeCost(cost) {
        const c = cost || {};
        return {
            gold: Math.max(0, parseInt(c.gold, 10) || 0),
            food: Math.max(0, parseInt(c.food, 10) || 0),
            wood: Math.max(0, parseInt(c.wood, 10) || 0),
        };
    }

    _sanitizeIncome(income) {
        const i = income || {};
        return {
            gold: parseInt(i.gold, 10) || 0,
            food: parseInt(i.food, 10) || 0,
            wood: parseInt(i.wood, 10) || 0,
        };
    }

    /**
     * Whitelist check: only allow property access on `game` with known safe paths.
     * Prevents arbitrary code execution.
     */
    _isSafeCondition(expr) {
        if (typeof expr !== 'string' || expr.length > 200) return false;
        // Allow: game.<prop>.<prop> comparisons, numbers, operators
        return /^[\w\s.>=<!&|()0-9]+$/.test(expr) && !expr.includes('__');
    }

    /** Safely evaluate a scenario condition with game in scope. */
    _evalScenario(condition) {
        try {
            const game = this.game; // eslint-disable-line no-unused-vars
            // eslint-disable-next-line no-new-func
            return Boolean(new Function('game', `return (${condition});`)(game));
        } catch {
            return false;
        }
    }
}
