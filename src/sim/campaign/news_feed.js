// News Feed + Briefing System - Manages campaign notifications and city news
// Integrates with CampaignModel for story-driven updates

import { eventBus, EVENT_TYPES } from '../events.js';

/**
 * News feed for city events and case updates
 */
export class NewsFeed {
    constructor(game) {
        this.game = game;
        this.items = [];
        this.sources = [];
        this.setupListeners();
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        eventBus.on(EVENT_TYPES.CAMPAIGN_CASE_STARTED, (data) => {
            this.addNews({
                type: 'case_started',
                caseId: data.caseId,
                caseType: data.caseType,
                tick: data.tick,
            });
        });

        eventBus.on(EVENT_TYPES.CAMPAIGN_CASE_COMPLETED, (data) => {
            this.addNews({
                type: 'case_completed',
                caseId: data.caseId,
                caseType: data.caseType,
                tick: data.tick,
            });
        });

        eventBus.on(EVENT_TYPES.CAMPAIGN_BRIEFING_GENERATED, (data) => {
            this.addNews({
                type: 'briefing',
                event: data.event,
                tick: data.tick,
            });
        });

        eventBus.on(EVENT_TYPES.PLAYER_DECISION, (data) => {
            this.addNews({
                type: 'player_action',
                decision: true,
                tick: this.game.state.time?.tick || 0,
            });
        });

        eventBus.on(EVENT_TYPES.CRISIS_STARTED, (data) => {
            this.addNews({
                type: 'crisis',
                crisisType: data.crisis.type,
                tick: data.tick,
            });
        });

        eventBus.on(EVENT_TYPES.CRISIS_RESOLVED, (data) => {
            this.addNews({
                type: 'crisis_resolved',
                crisisType: data.crisis.type,
                outcome: data.outcome,
                tick: data.tick,
            });
        });
    }

    /**
     * Add a news item
     * @param {Object} news - News data
     */
    addNews(news) {
        const newsItem = {
            id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: news.type,
            timestamp: Date.now(),
            tick: news.tick || this.game.state.time?.tick || 0,
            title: this.getNewsTitle(news),
            description: this.getNewsDescription(news),
            isImportant: this.isImportant(news),
            source: news.source || this.getDefaultSource(news.type),
        };

        this.items.unshift(newsItem);

        // Keep only last 100 news items
        if (this.items.length > 100) {
            this.items = this.items.slice(0, 100);
        }

        // Emit news event
        eventBus.emit(EVENT_TYPES.CAMPAIGN_NEWS_ADDED, {
            newsId: newsItem.id,
            type: newsItem.type,
            tick: newsItem.tick,
        });
    }

    /**
     * Get news title based on type
     * @param {Object} news
     * @returns {string}
     */
    getNewsTitle(news) {
        const titles = {
            case_started: 'New Case Started',
            case_completed: 'Case Resolved',
            briefing: 'Briefing Update',
            player_action: 'Player Action',
            crisis: 'Crisis Alert',
            crisis_resolved: 'Crisis Resolved',
            anomaly: 'Anomaly Detected',
            reputation_change: 'Reputation Update',
            heat_change: 'Heat Update',
        };

        return titles[news.type] || 'City News';
    }

    /**
     * Get news description based on type
     * @param {Object} news
     * @returns {string}
     */
    getNewsDescription(news) {
        switch (news.type) {
            case 'case_started':
                return `Investigation begun: ${this.getCaseTypeName(news.caseType)}`;
            case 'case_completed':
                return `Case resolved: ${this.getCaseTypeName(news.caseType)}`;
            case 'briefing':
                return 'New briefing available';
            case 'crisis':
                return `Crisis alert: ${news.crisisType.replace('_', ' ').toUpperCase()}`;
            case 'crisis_resolved':
                return `Crisis resolved: ${news.crisisType.replace('_', ' ').toUpperCase()}`;
            case 'anomaly':
                return `Anomaly detected: ${news.anomalyType || 'Unknown'}`;
            case 'reputation_change':
                return `Reputation ${news.change > 0 ? 'increased' : 'decreased'}: ${Math.abs(news.change)} points`;
            case 'heat_change':
                return `Heat ${news.change > 0 ? 'increased' : 'decreased'}: ${Math.abs(news.change)} points`;
            default:
                return 'City news update';
        }
    }

    /**
     * Check if news is important (should be displayed prominently)
     * @param {Object} news
     * @returns {boolean}
     */
    isImportant(news) {
        const importantTypes = [
            'case_started',
            'crisis',
            'crisis_resolved',
            'case_completed',
        ];
        return importantTypes.includes(news.type);
    }

    /**
     * Get default news source
     * @param {string} type
     * @returns {string}
     */
    getDefaultSource(type) {
        const sources = {
            case_started: 'Case File System',
            case_completed: 'Case File System',
            briefing: 'Intelligence Briefing',
            crisis: 'Emergency Alert',
            crisis_resolved: 'Emergency Resolution',
            anomaly: 'Surveillance System',
            reputation_change: 'Public Sentiment',
            heat_change: 'Heat Monitor',
        };
        return sources[type] || 'City News Service';
    }

    /**
     * Get case type name
     * @param {string} type
     * @returns {string}
     */
    getCaseTypeName(type) {
        const names = {
            missing_person: 'Missing Person',
            corruption: 'Corruption',
            extortion: 'Extortion',
            gang: 'Gang Activity',
            sabotage: 'Sabotage',
            whistleblower: 'Whistleblower',
        };
        return names[type] || type.replace('_', ' ').toUpperCase();
    }

    /**
     * Add a custom news item
     * @param {Object} options - News options
     */
    addCustomNews(options) {
        const newsItem = {
            id: `news_custom_${Date.now()}`,
            type: options.type || 'custom',
            timestamp: Date.now(),
            tick: this.game.state.time?.tick || 0,
            title: options.title || 'Custom News',
            description: options.description || '',
            isImportant: options.isImportant || false,
            source: options.source || 'Custom',
        };

        this.items.unshift(newsItem);
    }

    /**
     * Get recent news
     * @param {number} count - Number of items
     * @returns {Array} News items
     */
    getRecentNews(count = 10) {
        return this.items.slice(0, count);
    }

    /**
     * Get news by type
     * @param {string} type - News type
     * @returns {Array} Filtered news
     */
    getNewsByType(type) {
        return this.items.filter(n => n.type === type);
    }

    /**
     * Get important news
     * @returns {Array} Important news items
     */
    getImportantNews() {
        return this.items.filter(n => n.isImportant);
    }

    /**
     * Get news for a specific case
     * @param {string} caseId - Case ID
     * @returns {Array} Related news items
     */
    getNewsForCase(caseId) {
        return this.items.filter(n => n.caseId === caseId);
    }

    /**
     * Clear news older than specified tick
     * @param {number} tick - Clear news before this tick
     */
    clearOldNews(tick) {
        this.items = this.items.filter(n => n.tick >= tick);
    }

    /**
     * Update method for periodic cleanup
     */
    update() {
        // Keep only news from last 500 ticks
        const currentTick = this.game.state.time?.tick || 0;
        if (currentTick > 500) {
            this.clearOldNews(currentTick - 500);
        }
    }

    /**
     * Serialize news state
     * @returns {Object} Serialized state
     */
    serialize() {
        return {
            items: this.items.map(n => ({
                id: n.id,
                type: n.type,
                title: n.title,
                description: n.description,
                isImportant: n.isImportant,
                source: n.source,
                timestamp: n.timestamp,
                tick: n.tick,
                caseId: n.caseId,
            })),
        };
    }

    /**
     * Deserialize news state
     * @param {Object} data - Serialized state
     */
    deserialize(data) {
        if (!data) return;

        this.items = (data.items || []).map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            description: n.description,
            isImportant: n.isImportant,
            source: n.source,
            timestamp: n.timestamp,
            tick: n.tick,
            caseId: n.caseId,
        }));
    }

    /**
     * Reset news state
     */
    reset() {
        this.items = [];
    }
}

/**
 * Briefing system for campaign updates and strategy
 */
export class BriefingSystem {
    constructor(game) {
        this.game = game;
        this.briefings = [];
        this.setupListeners();
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        eventBus.on(EVENT_TYPES.CAMPAIGN_CASE_STARTED, (data) => {
            this.addBriefing({
                type: 'case_started',
                caseId: data.caseId,
                caseType: data.caseType,
                tick: data.tick,
            });
        });

        eventBus.on(EVENT_TYPES.CAMPAIGN_CASE_COMPLETED, (data) => {
            this.addBriefing({
                type: 'case_completed',
                caseId: data.caseId,
                caseType: data.caseType,
                tick: data.tick,
            });
        });
    }

    /**
     * Add a briefing entry
     * @param {Object} briefing - Briefing data
     */
    addBriefing(briefing) {
        const briefingItem = {
            id: `briefing_${Date.now()}`,
            type: briefing.type,
            caseId: briefing.caseId || null,
            caseType: briefing.caseType || null,
            title: this.getBriefingTitle(briefing),
            content: this.getBriefingContent(briefing),
            priority: this.getBriefingPriority(briefing),
            timestamp: Date.now(),
            tick: briefing.tick || this.game.state.time?.tick || 0,
        };

        this.briefings.unshift(briefingItem);

        // Keep only last 50 briefings
        if (this.briefings.length > 50) {
            this.briefings = this.briefings.slice(0, 50);
        }

        eventBus.emit(EVENT_TYPES.CAMPAIGN_BRIEFING_ADDED, {
            briefingId: briefingItem.id,
            type: briefingItem.type,
            tick: briefingItem.tick,
        });
    }

    /**
     * Get briefing title
     * @param {Object} briefing
     * @returns {string}
     */
    getBriefingTitle(briefing) {
        const titles = {
            case_started: 'New Investigation',
            case_completed: 'Case Closed',
            strategy_update: 'Strategy Update',
            heat_warning: 'Heat Warning',
            reputation_warning: 'Reputation Warning',
        };

        return titles[briefing.type] || 'Briefing Update';
    }

    /**
     * Get briefing content
     * @param {Object} briefing
     * @returns {string}
     */
    getBriefingContent(briefing) {
        switch (briefing.type) {
            case 'case_started':
                return `New case file created. Begin investigation of ${this.getCaseTypeName(briefing.caseType)}.`;
            case 'case_completed':
                return `Case resolved. Review outcomes and adjust strategy.`;
            case 'heat_warning':
                return `Alert: Your heat level is ${briefing.heat}%. Consider mitigation measures.`;
            case 'reputation_warning':
                return `Alert: Your reputation is ${briefing.reputation}%. Citizen cooperation may decrease.`;
            default:
                return 'Briefing content unavailable.';
        }
    }

    /**
     * Get briefing priority
     * @param {Object} briefing
     * @returns {string}
     */
    getBriefingPriority(briefing) {
        const priorities = {
            case_started: 'high',
            case_completed: 'medium',
            heat_warning: 'critical',
            reputation_warning: 'high',
            strategy_update: 'low',
        };

        return priorities[briefing.type] || 'medium';
    }

    /**
     * Get case type name
     * @param {string} type
     * @returns {string}
     */
    getCaseTypeName(type) {
        const names = {
            missing_person: 'Missing Person',
            corruption: 'Corruption',
            extortion: 'Extortion',
            gang: 'Gang Activity',
            sabotage: 'Sabotage',
            whistleblower: 'Whistleblower',
        };
        return names[type] || type.replace('_', ' ').toUpperCase();
    }

    /**
     * Get all briefings
     * @returns {Array} Briefings
     */
    getAllBriefings() {
        return this.briefings;
    }

    /**
     * Get recent briefings
     * @param {number} count
     * @returns {Array} Briefings
     */
    getRecentBriefings(count = 10) {
        return this.briefings.slice(0, count);
    }

    /**
     * Get critical briefings
     * @returns {Array} Critical briefings
     */
    getCriticalBriefings() {
        return this.briefings.filter(b => b.priority === 'critical');
    }

    /**
     * Get briefings for a case
     * @param {string} caseId
     * @returns {Array} Related briefings
     */
    getBriefingsForCase(caseId) {
        return this.briefings.filter(b => b.caseId === caseId);
    }

    /**
     * Clear old briefings
     * @param {number} tick
     */
    clearOldBriefings(tick) {
        this.briefings = this.briefings.filter(b => b.tick >= tick);
    }

    /**
     * Update method
     */
    update() {
        const currentTick = this.game.state.time?.tick || 0;
        if (currentTick > 500) {
            this.clearOldBriefings(currentTick - 500);
        }
    }

    /**
     * Serialize briefing state
     * @returns {Object} Serialized state
     */
    serialize() {
        return {
            briefings: this.briefings.map(b => ({
                id: b.id,
                type: b.type,
                title: b.title,
                content: b.content,
                priority: b.priority,
                timestamp: b.timestamp,
                tick: b.tick,
                caseId: b.caseId,
            })),
        };
    }

    /**
     * Deserialize briefing state
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;

        this.briefings = (data.briefings || []).map(b => ({
            id: b.id,
            type: b.type,
            title: b.title,
            content: b.content,
            priority: b.priority,
            timestamp: b.timestamp,
            tick: b.tick,
            caseId: b.caseId,
        }));
    }

    /**
     * Reset briefing state
     */
    reset() {
        this.briefings = [];
    }
}