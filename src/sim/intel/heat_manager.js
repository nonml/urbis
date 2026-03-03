// Exposure/Heat Manager v2 (Milestone K-05)
// Enhanced heat management system that integrates with
// surveillance, influence, and sentiment systems.
// Tracks exposure to authorities and overall heat level.

import { EVENT_TYPES } from '../events.js';
import { randomId } from '../../rng.js';

// Heat thresholds for different levels
export const HEAT_THRESHOLDS = {
    CALM: 0,
    ALERT: 20,
    SEARCH: 45,
    PURSUIT: 70,
    CRITICAL: 90,
};

// Heat states
export const HEAT_STATES = {
    CALM: 'calm',
    ALERT: 'alert',
    SEARCH: 'search',
    PURSUIT: 'pursuit',
    CRITICAL: 'critical',
};

// Exposure sources
export const EXPOSURE_SOURCES = {
    SURVEILLANCE_HACK: 'surveillance_hack',
    CRIME_COMMITTED: 'crime_committed',
    RIVAL_INTEL: 'rival_intel',
    PUBLIC_REPORT: 'public_report',
    POLICE_REPORT: 'police_report',
    MEDIA_COVERAGE: 'media_coverage',
    INFORMANT_BREACH: 'informant_breach',
    DATA_LEAK: 'data_leak',
};

// Exposure levels
export const EXPOSURE_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

/**
 * Represents an exposure event
 */
export class ExposureEvent {
    constructor(data) {
        this.id = data.id || randomId('exposure');
        this.source = data.source || 'unknown';
        this.amount = data.amount || 0;
        this.description = data.description || '';
        this.location = data.location || null; // {x, y}
        this.victim = data.victim || null; // victim info
        this.tick = data.tick || 0;
        this.isResolved = data.isResolved || false;
        this.confidence = data.confidence || 1.0;
    }

    /**
     * Get exposure info for UI
     */
    getInfo() {
        return {
            id: this.id,
            source: this.source,
            amount: this.amount,
            description: this.description,
            location: this.location,
            victim: this.victim,
            tick: this.tick,
            isResolved: this.isResolved,
            confidence: this.confidence,
        };
    }
}

/**
 * Represents a heat source (can be added to the heat meter)
 */
export class HeatSource {
    constructor(data) {
        this.id = data.id || randomId('heat_source');
        this.name = data.name || 'Unknown';
        this.baseAmount = data.baseAmount || 0;
        this.maxAmount = data.maxAmount || this.baseAmount;
        this.currentAmount = data.currentAmount || this.baseAmount;
        this.sourceType = data.sourceType || 'active';
        this.decayRate = data.decayRate || 0.1;
        this.createdAt = data.createdAt || 0;
        this.expiryTick = data.expiryTick || null;
        this.tags = data.tags || [];
        this.priority = data.priority || 1;
    }

    /**
     * Tick the heat source (decay over time)
     */
    tick(currentTick) {
        // Decay based on decay rate
        if (this.currentAmount > 0) {
            this.currentAmount = Math.max(0, this.currentAmount - this.decayRate);
        }

        // Check expiry
        if (this.expiryTick && currentTick >= this.expiryTick) {
            this.currentAmount = 0;
        }

        return this.currentAmount <= 0;
    }

    /**
     * Get current heat contribution
     */
    getContribution() {
        return this.currentAmount;
    }

    /**
     * Get heat info for UI
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            baseAmount: this.baseAmount,
            currentAmount: this.currentAmount,
            maxAmount: this.maxAmount,
            sourceType: this.sourceType,
            decayRate: this.decayRate,
            createdAt: this.createdAt,
            expiryTick: this.expiryTick,
            tags: this.tags,
            priority: this.priority,
            contributionPct: this.maxAmount > 0 ? (this.currentAmount / this.maxAmount) * 100 : 0,
        };
    }
}

/**
 * Heat manager with exposure tracking
 */
export class HeatManager {
    constructor(game) {
        this.game = game;
        this.maxHeat = 100;
        this.heat = 0;
        this.heatState = HEAT_STATES.CALM;
        this.heatSources = [];
        this._sourceMap = new Map();
        this.exposureEvents = [];
        this._exposureHistory = [];
        this.exposureScore = 0;
        this.heatMultiplier = 1.0;
        this.decayMultiplier = 1.0;
        this.lastTick = 0;
        this.ensureState();
    }

    ensureState() {
        const heatState = this.game.state.heat || (this.game.state.heat = {});
        heatState.sources = heatState.sources || [];
        heatState.exposure = heatState.exposure || [];
        heatState.exposureScore = heatState.exposureScore ?? 0;
        heatState.heatMultiplier = heatState.heatMultiplier ?? 1;
        heatState.decayMultiplier = heatState.decayMultiplier ?? 1;
    }

    /**
     * Get current heat level
     */
    getHeat() {
        return Math.max(0, Math.min(this.maxHeat, this.heat));
    }

    /**
     * Set heat level directly
     */
    setHeat(value) {
        const clamped = Math.max(0, Math.min(this.maxHeat, value));
        this.heat = clamped;
        this.heatState = this.getStateForHeat(clamped);
        this.game.state.player.heat = clamped;
        this.game.state.player.heatState = this.heatState;
        this.updateState();
        return clamped;
    }

    /**
     * Add heat to the system
     */
    addHeat(amount, sourceName = 'Unknown', metadata = {}) {
        const current = this.getHeat();
        const clamped = Math.max(0, Math.min(this.maxHeat, current + amount));
        const delta = clamped - current;

        this.heat = clamped;
        this.heatState = this.getStateForHeat(clamped);

        // Record heat source
        this._addHeatSource(sourceName, amount, metadata);

        this.updateState();

        // Emit event
        this.game.eventBus.emit(EVENT_TYPES.HEAT_CHANGED, {
            oldHeat: current,
            newHeat: clamped,
            delta: delta,
            source: sourceName,
            tick: this.game.state.time?.tick || 0,
        });

        return delta;
    }

    /**
     * Add an exposure event
     */
    addExposure(source, amount, description = '', location = null, confidence = 1.0) {
        const event = new ExposureEvent({
            source,
            amount,
            description,
            location,
            tick: this.game.state.time?.tick || 0,
            confidence,
        });

        this.exposureEvents.push(event);
        this._exposureHistory.push(event);

        // Add heat from exposure
        this.addHeat(amount, EXPOSURE_SOURCES[source] || source);

        // Record exposure score
        this.exposureScore = Math.max(0, this.exposureScore + amount);

        this.updateState();
        return event;
    }

    /**
     * Add a heat source
     */
    _addHeatSource(name, amount, metadata = {}) {
        const source = new HeatSource({
            name,
            baseAmount: amount,
            currentAmount: amount,
            maxAmount: amount,
            sourceType: metadata.sourceType || 'active',
            decayRate: metadata.decayRate || 0.2,
            createdAt: this.game.state.time?.tick || 0,
            expiryTick: metadata.expiryTick || null,
            tags: metadata.tags || [],
            priority: metadata.priority || 1,
        });

        this.heatSources.push(source);
        this._sourceMap.set(source.id, source);

        this.updateState();
        return source;
    }

    /**
     * Remove a heat source
     */
    removeHeatSource(sourceId) {
        const source = this._sourceMap.get(sourceId);
        if (!source) return false;

        this.heatSources = this.heatSources.filter(s => s.id !== sourceId);
        this._sourceMap.delete(sourceId);
        this.heat = Math.max(0, this.heat - source.currentAmount);

        this.updateState();
        return true;
    }

    /**
     * Clear all heat sources
     */
    clearHeatSources() {
        this.heatSources = [];
        this._sourceMap.clear();
        this.heat = 0;
        this.heatState = HEAT_STATES.CALM;
        this.updateState();
    }

    /**
     * Get heat sources by type
     */
    getHeatSourcesByType(type) {
        return this.heatSources.filter(s => s.sourceType === type);
    }

    /**
     * Get exposure events by source
     */
    getExposureBySource(source) {
        return this.exposureEvents.filter(e => e.source === source);
    }

    /**
     * Get active heat sources
     */
    getActiveHeatSources() {
        return this.heatSources.filter(s => s.currentAmount > 0);
    }

    /**
     * Get heat overview
     */
    getHeatOverview() {
        const sources = this.getActiveHeatSources();
        return {
            heat: this.getHeat(),
            state: this.heatState,
            sourceCount: sources.length,
            sources: sources.map(s => s.getInfo()),
            exposureScore: this.exposureScore,
            exposureCount: this.exposureEvents.length,
        };
    }

    /**
     * Get state for heat level
     */
    getStateForHeat(heat) {
        if (heat >= HEAT_THRESHOLDS.CRITICAL) return HEAT_STATES.CRITICAL;
        if (heat >= HEAT_THRESHOLDS.PURSUIT) return HEAT_STATES.PURSUIT;
        if (heat >= HEAT_THRESHOLDS.SEARCH) return HEAT_STATES.SEARCH;
        if (heat >= HEAT_THRESHOLDS.ALERT) return HEAT_STATES.ALERT;
        return HEAT_STATES.CALM;
    }

    /**
     * Get exposure level
     */
    getExposureLevel() {
        if (this.exposureScore >= 100) return EXPOSURE_LEVELS.CRITICAL;
        if (this.exposureScore >= 50) return EXPOSURE_LEVELS.HIGH;
        if (this.exposureScore >= 20) return EXPOSURE_LEVELS.MEDIUM;
        return EXPOSURE_LEVELS.LOW;
    }

    /**
     * Decay heat
     */
    decay(seen = false) {
        if (seen) return this.getHeat();

        const decayRate = 0.5 * this.decayMultiplier;
        const current = this.getHeat();

        // Heat decays naturally
        this.setHeat(current - decayRate);

        // Decay heat sources
        this._decayHeatSources();

        return this.getHeat();
    }

    /**
     * Decay heat sources
     */
    _decayHeatSources() {
        const currentTick = this.game.state.time?.tick || 0;
        const expired = [];

        for (const source of this.heatSources) {
            if (source.tick(currentTick)) {
                expired.push(source.id);
            }
        }

        for (const id of expired) {
            this.removeHeatSource(id);
        }
    }

    /**
     * Update multiplier
     */
    setHeatMultiplier(multiplier) {
        this.heatMultiplier = multiplier;
        this.updateState();
    }

    /**
     * Set decay multiplier
     */
    setDecayMultiplier(multiplier) {
        this.decayMultiplier = multiplier;
        this.updateState();
    }

    /**
     * Apply influence reduction to heat
     */
    reduceHeat(amount) {
        const current = this.getHeat();
        const reduced = Math.max(0, current - amount);
        const delta = current - reduced;

        this.heat = reduced;
        this.heatState = this.getStateForHeat(reduced);

        this.updateState();
        return delta;
    }

    /**
     * Apply influence reduction via positive sentiment
     */
    reduceHeatViaSentiment(amount) {
        const current = this.getHeat();
        const reduced = Math.max(0, current - amount);
        const delta = current - reduced;

        this.heat = reduced;
        this.heatState = this.getStateForHeat(reduced);

        // Record the reduction
        this._addHeatSource('sentiment_boost', -amount, {
            sourceType: 'influence',
            decayRate: 0,
        });

        this.updateState();
        return delta;
    }

    /**
     * Get heat by district
     */
    getHeatByDistrict() {
        const heatByDistrict = {};
        for (const district of this.game.map.districts || []) {
            // Base heat on current overall heat with district modifiers
            heatByDistrict[district.id] = this.getHeat();
        }
        return heatByDistrict;
    }

    /**
     * Get exposure by district
     */
    getExposureByDistrict() {
        const exposureByDistrict = {};
        for (const district of this.game.map.districts || []) {
            // Base exposure on overall exposure score
            exposureByDistrict[district.id] = this.exposureScore;
        }
        return exposureByDistrict;
    }

    /**
     * Update state for save/load
     */
    updateState() {
        const heatState = this.game.state.heat || (this.game.state.heat = {});
        heatState.sources = this.heatSources.map(s => s.getInfo());
        heatState.exposure = this.exposureEvents.map(e => e.getInfo());
        heatState.exposureScore = this.exposureScore;
        heatState.heatMultiplier = this.heatMultiplier;
        heatState.decayMultiplier = this.decayMultiplier;
        heatState.lastTick = this.lastTick;

        // Also update player heat state
        this.game.state.player.heat = this.getHeat();
        this.game.state.player.heatState = this.heatState;
    }

    /**
     * Load state from save
     */
    loadState() {
        const heatState = this.game.state.heat || (this.game.state.heat = {});
        this.heatSources = (heatState.sources || []).map(data => {
            const source = new HeatSource(data);
            return source;
        });
        this._sourceMap.clear();
        for (const source of this.heatSources) {
            this._sourceMap.set(source.id, source);
        }
        this.exposureEvents = (heatState.exposure || []).map(data => new ExposureEvent(data));
        this._exposureHistory = this.exposureEvents.slice();
        this.exposureScore = heatState.exposureScore ?? 0;
        this.heatMultiplier = heatState.heatMultiplier ?? 1;
        this.decayMultiplier = heatState.decayMultiplier ?? 1;
        this.lastTick = heatState.lastTick ?? 0;

        // Update heat value from sources
        this.heat = this.heatSources.reduce((sum, s) => sum + s.currentAmount, 0);
        this.heatState = this.getStateForHeat(this.heat);

        // Also restore player heat state
        if (this.game.state.player) {
            this.game.state.player.heat = this.getHeat();
            this.game.state.player.heatState = this.heatState;
        }
    }

    /**
     * Update heat manager (called each tick)
     */
    update() {
        const currentTick = this.game.state.time?.tick || 0;

        // Decay heat (unless player is in a safe area)
        this.decay(false);

        // Decay exposure events (they expire after 100 ticks)
        this._decayExposureEvents(currentTick);

        this.lastTick = currentTick;
        this.updateState();
    }

    /**
     * Decay old exposure events
     */
    _decayExposureEvents(currentTick) {
        const expiryThreshold = 100;
        this.exposureEvents = this.exposureEvents.filter(e => currentTick - e.tick < expiryThreshold);
    }

    /**
     * Get summary for UI
     */
    getSummary() {
        return {
            heat: {
                level: this.getHeat(),
                state: this.heatState,
                sources: this.getActiveHeatSources().length,
                sourcesData: this.getActiveHeatSources().map(s => ({
                    name: s.name,
                    amount: s.currentAmount,
                    decayRate: s.decayRate,
                })),
            },
            exposure: {
                score: this.exposureScore,
                level: this.getExposureLevel(),
                eventCount: this.exposureEvents.length,
                recentEvents: this.exposureEvents.slice(-10).map(e => ({
                    source: e.source,
                    amount: e.amount,
                    description: e.description,
                    tick: e.tick,
                })),
            },
            multipliers: {
                heat: this.heatMultiplier,
                decay: this.decayMultiplier,
            },
        };
    }

    /**
     * Reset heat to zero
     */
    reset() {
        this.heat = 0;
        this.heatState = HEAT_STATES.CALM;
        this.heatSources = [];
        this._sourceMap.clear();
        this.exposureEvents = [];
        this._exposureHistory = [];
        this.exposureScore = 0;
        this.updateState();
    }

    /**
     * Serialize for save
     */
    serialize() {
        this.updateState();
        const heatState = this.game.state.heat || {};
        return {
            sources: heatState.sources || [],
            exposure: heatState.exposure || [],
            exposureScore: heatState.exposureScore ?? 0,
            heatMultiplier: heatState.heatMultiplier ?? 1,
            decayMultiplier: heatState.decayMultiplier ?? 1,
            lastTick: heatState.lastTick ?? 0,
        };
    }
}

/**
 * Create heat manager
 */
export function createHeatManager(game) {
    return new HeatManager(game);
}