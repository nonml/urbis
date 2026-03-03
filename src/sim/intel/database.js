// Intel Database System (Milestone K-01)
// Centralized storage and retrieval of intelligence about the city,
// rivals, citizens, and world state.

import { EVENT_TYPES } from '../events.js';
import { randomId } from '../../rng.js';

// Intel entry categories
export const INTEL_CATEGORIES = {
    RIVAL: 'rival',
    CITIZEN: 'citizen',
    LOCATION: 'location',
    EVENT: 'event',
    BUILDING: 'building',
    VEHICLE: 'vehicle',
    CRIME: 'crime',
};

// Intel entry priorities (higher = more important/recent)
export const INTEL_PRIORITIES = {
    LOW: 1,
    MEDIUM: 5,
    HIGH: 10,
    CRITICAL: 15,
};

// Intel entry types for different data structures
export const INTEL_TYPES = {
    // Rival-related intel
    RIVAL_ACTIVITY: 'rival_activity',
    RIVAL_INFRASTRUCTURE: 'rival_infrastructure',
    RIVAL_FINANCIAL: 'rival_financial',

    // Citizen-related intel
    CITIZEN_PROFILE: 'citizen_profile',
    CITIZEN_CRIMINAL: 'citizen_criminal',
    CITIZEN_ASSOCIATION: 'citizen_association',

    // Location-related intel
    DISTRICT_INFO: 'district_info',
    POI_INFO: 'poi_info',
    ZONE_ACTIVITY: 'zone_activity',

    // Event-related intel
    CRIME_REPORT: 'crime_report',
    INCIDENT_REPORT: 'incident_report',
    TRAFFIC_REPORT: 'traffic_report',

    // Building-related intel
    BUILDING_OWNERSHIP: 'building_ownership',
    BUILDING_ACTIVITY: 'building_activity',
    SERVICE_COVERAGE: 'service_coverage',

    // Vehicle-related intel
    VEHICLE_MOVEMENT: 'vehicle_movement',
    SUSPICIOUS_VEHICLE: 'suspicious_vehicle',

    // Crime-related intel
    CRIME_PATTERN: 'crime_pattern',
    CRIME_LINK: 'crime_link',
};

/**
 * Represents a single intel entry in the database
 */
export class IntelEntry {
    constructor(data) {
        this.id = data.id || randomId('intel');
        this.category = data.category || 'location';
        this.type = data.type || 'generic';
        this.priority = data.priority || INTEL_PRIORITIES.MEDIUM;
        this.title = data.title || '';
        this.description = data.description || '';
        this.data = data.data || {};
        this.tags = data.tags || [];
        this.source = data.source || 'unknown';
        this.confidence = data.confidence || 0.5; // 0.0 to 1.0
        this.timestamp = data.timestamp || 0;
        this.expiryTick = data.expiryTick || null;
        this.isVerified = data.isVerified || false;
        this.relatedEntries = data.relatedEntries || [];
    }

    /**
     * Check if this entry is still valid (not expired)
     */
    isActive(currentTick) {
        return this.expiryTick === null || currentTick < this.expiryTick;
    }

    /**
     * Get a summary of this entry
     */
    getSummary() {
        return {
            id: this.id,
            category: this.category,
            type: this.type,
            priority: this.priority,
            title: this.title,
            description: this.description,
            confidence: this.confidence,
            timestamp: this.timestamp,
            isVerified: this.isVerified,
        };
    }

    /**
     * Create a duplicate with updated data
     */
    update(data) {
        return new IntelEntry({
            ...this,
            ...data,
            id: this.id,
            relatedEntries: this.relatedEntries,
        });
    }
}

/**
 * Manages the collection of all intel entries
 */
export class IntelDatabase {
    constructor(game) {
        this.game = game;
        this.entries = new Map(); // id -> IntelEntry
        this.index = {
            byCategory: new Map(), // category -> Set of ids
            byType: new Map(), // type -> Set of ids
            byTag: new Map(), // tag -> Set of ids
            bySource: new Map(), // source -> Set of ids
        };
        this.ensureState();
    }

    ensureState() {
        const intelState = this.game.state.intel || (this.game.state.intel = {});
        intelState.entries = intelState.entries || [];
    }

    /**
     * Add a new intel entry
     */
    addEntry(data) {
        const entry = new IntelEntry(data);
        this.entries.set(entry.id, entry);

        // Update indices
        this._updateIndex(entry, 'add');

        this.updateState();
        return entry;
    }

    /**
     * Update an existing entry
     */
    updateEntry(id, data) {
        const existing = this.entries.get(id);
        if (!existing) return null;

        const updated = existing.update(data);
        this.entries.set(id, updated);

        // Rebuild indices
        this._updateIndex(updated, 'remove');
        this._updateIndex(updated, 'add');

        this.updateState();
        return updated;
    }

    /**
     * Remove an entry
     */
    removeEntry(id) {
        const entry = this.entries.get(id);
        if (entry) {
            this._updateIndex(entry, 'remove');
            this.entries.delete(id);
        }
        this.updateState();
    }

    /**
     * Get an entry by ID
     */
    getEntry(id) {
        return this.entries.get(id);
    }

    /**
     * Get all active entries (not expired)
     */
    getActiveEntries() {
        const currentTick = this.game.state.time?.tick || 0;
        const result = [];
        for (const entry of this.entries.values()) {
            if (entry.isActive(currentTick)) {
                result.push(entry);
            }
        }
        return result;
    }

    /**
     * Get entries by category
     */
    getByCategory(category) {
        const set = this.index.byCategory.get(category);
        if (!set) return [];
        const result = [];
        for (const id of set) {
            const entry = this.entries.get(id);
            if (entry && entry.isActive(this.game.state.time?.tick || 0)) {
                result.push(entry);
            }
        }
        return result;
    }

    /**
     * Get entries by type
     */
    getByType(type) {
        const set = this.index.byType.get(type);
        if (!set) return [];
        const result = [];
        for (const id of set) {
            const entry = this.entries.get(id);
            if (entry && entry.isActive(this.game.state.time?.tick || 0)) {
                result.push(entry);
            }
        }
        return result;
    }

    /**
     * Get entries by tag
     */
    getByTag(tag) {
        const set = this.index.byTag.get(tag);
        if (!set) return [];
        const result = [];
        for (const id of set) {
            const entry = this.entries.get(id);
            if (entry && entry.isActive(this.game.state.time?.tick || 0)) {
                result.push(entry);
            }
        }
        return result;
    }

    /**
     * Get entries by source
     */
    getBySource(source) {
        const set = this.index.bySource.get(source);
        if (!set) return [];
        const result = [];
        for (const id of set) {
            const entry = this.entries.get(id);
            if (entry && entry.isActive(this.game.state.time?.tick || 0)) {
                result.push(entry);
            }
        }
        return result;
    }

    /**
     * Search entries by text query
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        const result = [];
        for (const entry of this.entries.values()) {
            if (!entry.isActive(this.game.state.time?.tick || 0)) continue;
            const matchTitle = entry.title.toLowerCase().includes(lowerQuery);
            const matchDesc = entry.description.toLowerCase().includes(lowerQuery);
            const matchTags = entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
            if (matchTitle || matchDesc || matchTags) {
                result.push(entry);
            }
        }
        return result;
    }

    /**
     * Get highest priority active entries
     */
    getTopPriorityEntries(count = 10) {
        const active = this.getActiveEntries();
        active.sort((a, b) => b.priority - a.priority);
        return active.slice(0, count);
    }

    /**
     * Link two entries together
     */
    linkEntries(entryId1, entryId2) {
        const entry1 = this.entries.get(entryId1);
        const entry2 = this.entries.get(entryId2);
        if (!entry1 || !entry2) return false;

        if (!entry1.relatedEntries.includes(entryId2)) {
            entry1.relatedEntries.push(entryId2);
        }
        if (!entry2.relatedEntries.includes(entryId1)) {
            entry2.relatedEntries.push(entryId1);
        }
        this.updateState();
        return true;
    }

    /**
     * Update indices when an entry is added or removed
     */
    _updateIndex(entry, action) {
        // By category
        let catSet = this.index.byCategory.get(entry.category);
        if (!catSet) {
            catSet = new Set();
            this.index.byCategory.set(entry.category, catSet);
        }
        if (action === 'add') {
            catSet.add(entry.id);
        } else {
            catSet.delete(entry.id);
        }

        // By type
        let typeSet = this.index.byType.get(entry.type);
        if (!typeSet) {
            typeSet = new Set();
            this.index.byType.set(entry.type, typeSet);
        }
        if (action === 'add') {
            typeSet.add(entry.id);
        } else {
            typeSet.delete(entry.id);
        }

        // By tag
        for (const tag of entry.tags) {
            let tagSet = this.index.byTag.get(tag);
            if (!tagSet) {
                tagSet = new Set();
                this.index.byTag.set(tag, tagSet);
            }
            if (action === 'add') {
                tagSet.add(entry.id);
            } else {
                tagSet.delete(entry.id);
            }
        }

        // By source
        let sourceSet = this.index.bySource.get(entry.source);
        if (!sourceSet) {
            sourceSet = new Set();
            this.index.bySource.set(entry.source, sourceSet);
        }
        if (action === 'add') {
            sourceSet.add(entry.id);
        } else {
            sourceSet.delete(entry.id);
        }
    }

    /**
     * Update state for save/load
     */
    updateState() {
        const intelState = this.game.state.intel || (this.game.state.intel = {});
        intelState.entries = Array.from(this.entries.values()).map(e => ({
            id: e.id,
            category: e.category,
            type: e.type,
            priority: e.priority,
            title: e.title,
            description: e.description,
            data: e.data,
            tags: e.tags,
            source: e.source,
            confidence: e.confidence,
            timestamp: e.timestamp,
            expiryTick: e.expiryTick,
            isVerified: e.isVerified,
            relatedEntries: e.relatedEntries,
        }));
    }

    /**
     * Load state from save
     */
    loadState() {
        const intelState = this.game.state.intel || (this.game.state.intel = {});
        this.entries.clear();
        this.index.byCategory.clear();
        this.index.byType.clear();
        this.index.byTag.clear();
        this.index.bySource.clear();

        const savedEntries = intelState.entries || [];
        for (const data of savedEntries) {
            const entry = new IntelEntry(data);
            this.entries.set(entry.id, entry);
            this._updateIndex(entry, 'add');
        }
    }

    /**
     * Clear all expired entries
     */
    cleanup() {
        const currentTick = this.game.state.time?.tick || 0;
        const expired = [];
        for (const [id, entry] of this.entries.entries()) {
            if (!entry.isActive(currentTick)) {
                expired.push(id);
            }
        }
        for (const id of expired) {
            this.removeEntry(id);
        }
    }

    /**
     * Update database (called each tick)
     */
    update() {
        this.cleanup();
    }

    /**
     * Get database summary for UI
     */
    getSummary() {
        const active = this.getActiveEntries();
        return {
            totalEntries: this.entries.size,
            activeEntries: active.length,
            byCategory: {},
            byType: {},
            byPriority: {},
        };
    }

    /**
     * Serialize for save
     */
    serialize() {
        this.updateState();
        const intelState = this.game.state.intel || {};
        return {
            entries: intelState.entries || [],
            summary: this.getSummary(),
            lastUpdateTick: this.game.state.time?.tick || 0,
        };
    }

    /**
     * Deserialize for load (uses loadState for state-based loading)
     */
    deserialize(data) {
        if (!data) return;
        this.loadState();
    }
}

/**
 * Create intel database
 */
export function createIntelDatabase(game) {
    return new IntelDatabase(game);
}