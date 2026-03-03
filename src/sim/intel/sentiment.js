// Public Sentiment + Media System (Milestone K-04)
// Tracks public opinion, media coverage, and sentiment trends
// across the city and different demographics.

import { EVENT_TYPES } from '../events.js';
import { randomId } from '../../rng.js';

// Demographic groups
export const DEMOGRAPHICS = {
    ALL: 'all',
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial',
    LOW_INCOME: 'low_income',
    MIDDLE_INCOME: 'middle_income',
    HIGH_INCOME: 'high_income',
    YOUNG: 'young',
    ADULT: 'adult',
    SENIOR: 'senior',
};

// Media channels
export const MEDIA_CHANNELS = {
    TV: 'tv',
    RADIO: 'radio',
    ONLINE: 'online',
    PRINT: 'print',
    SOCIAL: 'social',
    NEWS: 'news',
};

// Sentiment thresholds
export const SENTIMENT_THRESHOLDS = {
    HIGHLY_POSITIVE: 0.8,
    POSITIVE: 0.6,
    NEUTRAL: 0.5,
    NEGATIVE: 0.4,
    HIGHLY_NEGATIVE: 0.2,
};

// Sentiment levels
export const SENTIMENT_LEVELS = {
    HIGHLY_POSITIVE: 'highly_positive',
    POSITIVE: 'positive',
    NEUTRAL: 'neutral',
    NEGATIVE: 'negative',
    HIGHLY_NEGATIVE: 'highly_negative',
};

/**
 * Represents sentiment data for a demographic
 */
export class SentimentData {
    constructor(demographic, initialSentiment = 0.5) {
        this.demographic = demographic;
        this.sentiment = initialSentiment; // 0.0 to 1.0
        this.trustInGovernment = 0.5;
        this.trustInPolice = 0.5;
        this.satisfaction = 0.5;
        this.voterTurnout = 0.6;
        this.lastUpdated = 0;
        this.history = []; // Sentiment history for trend analysis
        this.maxHistory = 50;
    }

    /**
     * Update sentiment by delta
     */
    update(delta, tick) {
        this.sentiment = Math.max(0, Math.min(1, this.sentiment + delta));
        this.lastUpdated = tick;

        // Update history
        this.history.push({
            tick,
            sentiment: this.sentiment,
        });
        while (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    /**
     * Update trust values
     */
    updateTrust(institution, delta) {
        if (institution === 'government') {
            this.trustInGovernment = Math.max(0, Math.min(1, this.trustInGovernment + delta));
        } else if (institution === 'police') {
            this.trustInPolice = Math.max(0, Math.min(1, this.trustInPolice + delta));
        }
    }

    /**
     * Get sentiment level
     */
    getLevel() {
        if (this.sentiment >= SENTIMENT_THRESHOLDS.HIGHLY_POSITIVE) {
            return SENTIMENT_LEVELS.HIGHLY_POSITIVE;
        } else if (this.sentiment >= SENTIMENT_THRESHOLDS.POSITIVE) {
            return SENTIMENT_LEVELS.POSITIVE;
        } else if (this.sentiment >= SENTIMENT_THRESHOLDS.NEUTRAL) {
            return SENTIMENT_LEVELS.NEUTRAL;
        } else if (this.sentiment >= SENTIMENT_THRESHOLDS.NEGATIVE) {
            return SENTIMENT_LEVELS.NEGATIVE;
        } else {
            return SENTIMENT_LEVELS.HIGHLY_NEGATIVE;
        }
    }

    /**
     * Get trend (positive/negative/stable)
     */
    getTrend() {
        if (this.history.length < 2) return 'stable';
        const first = this.history[0].sentiment;
        const last = this.history[this.history.length - 1].sentiment;
        const diff = last - first;
        if (diff > 0.05) return 'positive';
        if (diff < -0.05) return 'negative';
        return 'stable';
    }

    /**
     * Get sentiment data for UI
     */
    getData() {
        return {
            demographic: this.demographic,
            sentiment: this.sentiment,
            level: this.getLevel(),
            trustInGovernment: this.trustInGovernment,
            trustInPolice: this.trustInPolice,
            satisfaction: this.satisfaction,
            voterTurnout: this.voterTurnout,
            trend: this.getTrend(),
            lastUpdated: this.lastUpdated,
        };
    }
}

/**
 * Manages sentiment across all demographics
 */
export class SentimentManager {
    constructor(game) {
        this.game = game;
        this.demographics = {};
        this.mediaCoverage = {};
        this.moodScores = [];
        this.ensureState();
        this._initDemographics();
    }

    ensureState() {
        const sentimentState = this.game.state.sentiment || (this.game.state.sentiment = {});
        sentimentState.demographics = sentimentState.demographics || {};
        sentimentState.moodScores = sentimentState.moodScores || [];
    }

    _initDemographics() {
        for (const demo of Object.values(DEMOGRAPHICS)) {
            if (!this.demographics[demo]) {
                this.demographics[demo] = new SentimentData(demo);
            }
        }
    }

    /**
     * Get sentiment for a demographic
     */
    getSentiment(demographic = DEMOGRAPHICS.ALL) {
        if (demographic === DEMOGRAPHICS.ALL) {
            // Return average sentiment across all demographics
            let total = 0;
            let count = 0;
            for (const demo of Object.values(this.demographics)) {
                total += demo.sentiment;
                count++;
            }
            return count > 0 ? total / count : 0.5;
        }
        return this.demographics[demographic]?.sentiment || 0.5;
    }

    /**
     * Get sentiment level for a demographic
     */
    getSentimentLevel(demographic = DEMOGRAPHICS.ALL) {
        const sentiment = this.getSentiment(demographic);
        if (sentiment >= SENTIMENT_THRESHOLDS.HIGHLY_POSITIVE) {
            return SENTIMENT_LEVELS.HIGHLY_POSITIVE;
        } else if (sentiment >= SENTIMENT_THRESHOLDS.POSITIVE) {
            return SENTIMENT_LEVELS.POSITIVE;
        } else if (sentiment >= SENTIMENT_THRESHOLDS.NEUTRAL) {
            return SENTIMENT_LEVELS.NEUTRAL;
        } else if (sentiment >= SENTIMENT_THRESHOLDS.NEGATIVE) {
            return SENTIMENT_LEVELS.NEGATIVE;
        } else {
            return SENTIMENT_LEVELS.HIGHLY_NEGATIVE;
        }
    }

    /**
     * Update sentiment by demographic
     */
    updateSentiment(demographic, delta, tick) {
        if (this.demographics[demographic]) {
            this.demographics[demographic].update(delta, tick);
        }
        this.updateState();
    }

    /**
     * Update all demographics at once
     */
    updateAllSentiment(delta, tick) {
        for (const demo of Object.values(this.demographics)) {
            demo.update(delta, tick);
        }
        this.updateState();
    }

    /**
     * Get sentiment trends
     */
    getTrends() {
        const trends = {};
        for (const [demo, data] of Object.entries(this.demographics)) {
            trends[demo] = {
                current: data.sentiment,
                trend: data.getTrend(),
                historyLength: data.history.length,
            };
        }
        return trends;
    }

    /**
     * Update trust in an institution
     */
    updateTrust(demographic, institution, delta) {
        if (this.demographics[demographic]) {
            this.demographics[demographic].updateTrust(institution, delta);
        }
        this.updateState();
    }

    /**
     * Add media coverage
     */
    addCoverage(channel, type, sentimentImpact = 0, tick) {
        if (!this.mediaCoverage[channel]) {
            this.mediaCoverage[channel] = [];
        }

        const coverage = {
            type,
            sentimentImpact,
            tick,
            id: randomId('coverage'),
        };

        this.mediaCoverage[channel].push(coverage);
        while (this.mediaCoverage[channel].length > 100) {
            this.mediaCoverage[channel].shift();
        }

        // Apply sentiment impact to affected demographics
        const affected = this._getAffectedDemographics(channel, type);
        for (const demo of affected) {
            this.updateSentiment(demo, sentimentImpact, tick);
        }

        this.updateState();
        return coverage;
    }

    /**
     * Get affected demographics based on media channel and type
     */
    _getAffectedDemographics(channel, type) {
        const mapping = {
            [MEDIA_CHANNELS.TV]: [DEMOGRAPHICS.ALL, DEMOGRAPHICS.SENIOR],
            [MEDIA_CHANNELS.RADIO]: [DEMOGRAPHICS.ALL, DEMOGRAPHICS.MIDDLE_INCOME],
            [MEDIA_CHANNELS.ONLINE]: [DEMOGRAPHICS.ALL, DEMOGRAPHICS.YOUNG],
            [MEDIA_CHANNELS.SOCIAL]: [DEMOGRAPHICS.ALL, DEMOGRAPHICS.YOUNG, DEMOGRAPHICS.MIDDLE_INCOME],
            [MEDIA_CHANNELS.NEWS]: [DEMOGRAPHICS.ALL, DEMOGRAPHICS.HIGH_INCOME],
            [MEDIA_CHANNELS.PRINT]: [DEMOGRAPHICS.ALL, DEMOGRAPHICS.SENIOR],
        };

        return mapping[channel] || [DEMOGRAPHICS.ALL];
    }

    /**
     * Get media coverage by channel
     */
    getCoverage(channel) {
        return this.mediaCoverage[channel] || [];
    }

    /**
     * Get all media coverage
     */
    getAllCoverage() {
        const all = [];
        for (const [channel, coverage] of Object.entries(this.mediaCoverage)) {
            all.push({
                channel,
                count: coverage.length,
                entries: coverage.slice(-10), // Last 10
            });
        }
        return all;
    }

    /**
     * Get sentiment breakdown by district
     */
    getSentimentByDistrict() {
        const districtSentiment = {};
        for (const district of this.game.map.districts || []) {
            // Base sentiment on residential area sentiment
            districtSentiment[district.id] = this.demographics[DEMOGRAPHICS.RESIDENTIAL]?.sentiment || 0.5;
        }
        return districtSentiment;
    }

    /**
     * Get mood score summary
     */
    getMoodSummary() {
        const all = this.getSentiment(DEMOGRAPHICS.ALL);
        const residential = this.getSentiment(DEMOGRAPHICS.RESIDENTIAL);
        const commercial = this.getSentiment(DEMOGRAPHICS.COMMERCIAL);
        const industrial = this.getSentiment(DEMOGRAPHICS.INDUSTRIAL);

        return {
            overall: {
                sentiment: all,
                level: this.getSentimentLevel(DEMOGRAPHICS.ALL),
            },
            byZone: {
                residential: {
                    sentiment: residential,
                    level: this.getSentimentLevel(DEMOGRAPHICS.RESIDENTIAL),
                },
                commercial: {
                    sentiment: commercial,
                    level: this.getSentimentLevel(DEMOGRAPHICS.COMMERCIAL),
                },
                industrial: {
                    sentiment: industrial,
                    level: this.getSentimentLevel(DEMOGRAPHICS.INDUSTRIAL),
                },
            },
            trust: {
                government: Object.values(this.demographics).reduce((sum, d) => sum + d.trustInGovernment, 0) /
                    Object.keys(this.demographics).length,
                police: Object.values(this.demographics).reduce((sum, d) => sum + d.trustInPolice, 0) /
                    Object.keys(this.demographics).length,
            },
        };
    }

    /**
     * Update state for save/load
     */
    updateState() {
        const sentimentState = this.game.state.sentiment || (this.game.state.sentiment = {});
        sentimentState.demographics = {};
        for (const [demo, data] of Object.entries(this.demographics)) {
            sentimentState.demographics[demo] = data.getData();
        }
        sentimentState.mediaCoverage = {};
        for (const [channel, coverage] of Object.entries(this.mediaCoverage)) {
            sentimentState.mediaCoverage[channel] = coverage.slice(-50);
        }
        sentimentState.moodScores = this.moodScores.slice(-100);
    }

    /**
     * Load state from save
     */
    loadState() {
        const sentimentState = this.game.state.sentiment || (this.game.state.sentiment = {});
        this.demographics = {};
        for (const [demo, data] of Object.entries(sentimentState.demographics || {})) {
            this.demographics[demo] = new SentimentData(demo, data.sentiment);
            this.demographics[demo].trustInGovernment = data.trustInGovernment || 0.5;
            this.demographics[demo].trustInPolice = data.trustInPolice || 0.5;
            this.demographics[demo].satisfaction = data.satisfaction || 0.5;
            this.demographics[demo].voterTurnout = data.voterTurnout || 0.6;
            this.demographics[demo].lastUpdated = data.lastUpdated || 0;
            this.demographics[demo].history = data.history || [];
        }

        this.mediaCoverage = sentimentState.mediaCoverage || {};
        this.moodScores = sentimentState.moodScores || [];
    }

    /**
     * Update sentiment (called each tick)
     */
    update() {
        const currentTick = this.game.state.time?.tick || 0;

        // Natural sentiment decay/reversion
        this._applyNaturalReversion(currentTick);

        // Check for sentiment-changing events
        this._checkSentimentEvents();

        this.updateState();
    }

    /**
     * Apply natural sentiment reversion toward neutral
     */
    _applyNaturalReversion(tick) {
        const reversionRate = 0.0002;
        for (const demo of Object.values(this.demographics)) {
            // Sentiment slowly reverts toward 0.5
            const neutral = 0.5;
            const diff = demo.sentiment - neutral;
            if (Math.abs(diff) > 0.001) {
                demo.update(-diff * reversionRate, tick);
            }
        }
    }

    /**
     * Check for sentiment-changing events
     */
    _checkSentimentEvents() {
        // Crime events affect sentiment negatively
        const crimeCount = this.game.citizenSim?.getCrimeCount?.() || 0;
        if (crimeCount > 10) {
            const impact = -0.01 * Math.min(1, (crimeCount - 10) / 20);
            this.updateAllSentiment(impact, this.game.state.time?.tick || 0);
        }

        // Budget events affect trust
        const budget = this.game.budgetManager?.getBalance() ?? 0;
        if (budget < 0) {
            this.updateTrust(DEMOGRAPHICS.ALL, 'government', -0.001);
        }
    }

    /**
     * Get sentiment data for UI
     */
    getData() {
        const data = {
            overall: this.getMoodSummary(),
            byDemographic: {},
            media: this.getAllCoverage(),
            trends: this.getTrends(),
        };

        for (const [demo, sentiment] of Object.entries(this.demographics)) {
            data.byDemographic[demo] = sentiment.getData();
        }

        return data;
    }

    /**
     * Serialize for save
     */
    serialize() {
        this.updateState();
        const sentimentState = this.game.state.sentiment || {};
        return {
            demographics: sentimentState.demographics || {},
            mediaCoverage: sentimentState.mediaCoverage || {},
            moodScores: sentimentState.moodScores || [],
            lastUpdateTick: this.game.state.time?.tick || 0,
        };
    }
}

/**
 * Create sentiment manager
 */
export function createSentimentManager(game) {
    return new SentimentManager(game);
}