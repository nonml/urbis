/**
 * Steam Integration
 *
 * Wraps Greenworks (Steam SDK for Electron) behind a safe API so the rest
 * of the game never has to check whether Steam is present.
 *
 * Loading strategy (in order):
 *   1. window.electronAPI.greenworks  — preloaded by electron-preload.js
 *   2. require('greenworks')          — only works inside Electron (Node context)
 *   3. No-op stubs (browser / Tauri / plain desktop without Steam)
 *
 * Achievement IDs must match the ones set up in the Steamworks Developer portal.
 * The mapping below mirrors DEFAULT_ACHIEVEMENTS from victory_conditions.js.
 *
 * Stat names (for numeric Steam stats like "buildings_built") must also be
 * configured in the Steamworks portal.
 */

// ─── Achievement ID map ───────────────────────────────────────────────────────
// key = game achievement id  →  value = Steam API name (all-caps by convention)
const ACHIEVEMENT_MAP = {
    first_house:     'ACH_FIRST_HOUSE',
    master_builder:  'ACH_MASTER_BUILDER',
    city_planner:    'ACH_CITY_PLANNER',
    growing_town:    'ACH_GROWING_TOWN',
    thriving_city:   'ACH_THRIVING_CITY',
    metropolis:      'ACH_METROPOLIS',
    first_gold:      'ACH_FIRST_GOLD',
    wealthy_trader:  'ACH_WEALTHY_TRADER',
    tycoon:          'ACH_TYCOON',
    happy_citizen:   'ACH_HAPPY_CITIZENS',
    utopia:          'ACH_UTOPIA',
    explorer:        'ACH_EXPLORER',
    cartographer:    'ACH_CARTOGRAPHER',
    survivor:        'ACH_SURVIVOR',
    veteran:         'ACH_VETERAN',
    // Victory type achievements
    victory_standard:      'ACH_VICTORY_STANDARD',
    victory_economic:      'ACH_VICTORY_ECONOMIC',
    victory_cultural:      'ACH_VICTORY_CULTURAL',
    victory_military:      'ACH_VICTORY_MILITARY',
    victory_technological: 'ACH_VICTORY_TECHNOLOGICAL',
    victory_population:    'ACH_VICTORY_POPULATION',
};

// ─── Stat names ───────────────────────────────────────────────────────────────
// Stats allow Steam to track cumulative numeric values across sessions.
const STAT_MAP = {
    buildings_built:  'STAT_BUILDINGS_BUILT',
    days_survived:    'STAT_DAYS_SURVIVED',
    gold_total:       'STAT_GOLD_TOTAL',
    population_peak:  'STAT_POPULATION_PEAK',
};

// ─── Greenworks loader ────────────────────────────────────────────────────────

function loadGreenworks() {
    // 1. Electron preload may have injected it
    if (window?.electronAPI?.greenworks) return window.electronAPI.greenworks;

    // 2. Require via Electron's Node integration (only available in Electron main/renderer)
    try {
        // Dynamic require — Vite won't tree-shake this
        // eslint-disable-next-line no-undef
        if (typeof __non_webpack_require__ !== 'undefined') {
            return __non_webpack_require__('greenworks');
        }
        if (typeof require !== 'undefined') {
            return require('greenworks');
        }
    } catch {
        // Greenworks not installed or not running in Electron — that's fine
    }
    return null;
}

// ─── SteamManager ─────────────────────────────────────────────────────────────

export class SteamManager {
    constructor() {
        this._gw = null;
        this._enabled = false;
        this._unlocked = new Set(); // achievement ids already unlocked this session
        this._stats = {};
        this._initCalled = false;
    }

    /**
     * Try to initialise Steam / Greenworks.
     * Safe to call even when Steam is not available.
     * @returns {boolean} true if Steam is active
     */
    init() {
        if (this._initCalled) return this._enabled;
        this._initCalled = true;

        const gw = loadGreenworks();
        if (!gw) {
            console.info('[Steam] Greenworks not available — Steam features disabled.');
            return false;
        }

        try {
            if (!gw.initAPI()) {
                console.info('[Steam] initAPI() returned false — Steam not running.');
                return false;
            }
            this._gw = gw;
            this._enabled = true;
            // getSteamId may be async when routed through IPC proxy
            Promise.resolve(gw.getSteamId?.()).then(id =>
                console.info('[Steam] Initialised. SteamId:', id ?? 'n/a')
            ).catch(() => console.info('[Steam] Initialised.'));
            return true;
        } catch (err) {
            console.warn('[Steam] Init error:', err);
            return false;
        }
    }

    get isEnabled() { return this._enabled; }

    // ── Achievements ──────────────────────────────────────────────────────────

    /**
     * Unlock a Steam achievement by game achievement id.
     * @param {string} gameAchId  e.g. 'first_house'
     */
    unlock(gameAchId) {
        if (!this._enabled) return;
        if (this._unlocked.has(gameAchId)) return;

        const steamId = ACHIEVEMENT_MAP[gameAchId];
        if (!steamId) {
            console.warn(`[Steam] No Steam achievement mapped for: ${gameAchId}`);
            return;
        }

        this._unlocked.add(gameAchId);
        this._gw.activateAchievement(steamId, () => {
            console.info(`[Steam] Achievement unlocked: ${steamId}`);
        }, (err) => {
            console.warn(`[Steam] Failed to unlock ${steamId}:`, err);
            this._unlocked.delete(gameAchId); // allow retry
        });
    }

    /**
     * Clear a Steam achievement (useful for testing).
     * @param {string} gameAchId
     */
    clearAchievement(gameAchId) {
        if (!this._enabled) return;
        const steamId = ACHIEVEMENT_MAP[gameAchId];
        if (!steamId) return;
        this._unlocked.delete(gameAchId);
        this._gw.clearAchievement(steamId, () => {}, () => {});
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    /**
     * Update a numeric Steam stat.
     * @param {string} gameStatId  e.g. 'buildings_built'
     * @param {number} value
     */
    setStat(gameStatId, value) {
        if (!this._enabled) return;
        const steamStat = STAT_MAP[gameStatId];
        if (!steamStat) return;
        if (this._stats[gameStatId] === value) return;
        this._stats[gameStatId] = value;
        this._gw.setStatInt(steamStat, value, () => {
            this._gw.storeStats(() => {}, () => {});
        }, (err) => {
            console.warn(`[Steam] setStat ${steamStat} failed:`, err);
        });
    }

    // ── Overlay ───────────────────────────────────────────────────────────────

    /**
     * Open the Steam overlay to the achievements page.
     */
    openAchievementsOverlay() {
        if (!this._enabled) return;
        try { this._gw.activateGameOverlay('Achievements'); } catch { /* ignore */ }
    }
}

/** Singleton — import and call .init() once from game.js */
export const steam = new SteamManager();
