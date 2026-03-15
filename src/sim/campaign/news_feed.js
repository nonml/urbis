// News Feed + Briefing System - Manages campaign notifications and city news
// Integrates with CampaignModel for story-driven updates
// Tier 2B: Enhanced with NPC generator for emergent narrative

import { eventBus, EVENT_TYPES } from '../events.js';
import { randomId } from '../../rng.js';

// Maps case types to the faction most likely involved
const CASE_TYPE_FACTION = {
    corruption: 'government',
    gang: 'criminal',
    extortion: 'criminal',
    missing_person: 'civilian',
    sabotage: 'corporate',
    whistleblower: 'civilian',
};

// Human-readable faction names for news copy
const FACTION_DISPLAY = {
    citizens: 'Citizens',
    police: 'Police Department',
    gangs: 'Gang Networks',
    corp: 'Corporate Sector',
    government: 'City Government',
    criminal: 'Criminal Underworld',
    corporate: 'Corporate Interests',
    civilian: 'General Public',
};

/**
 * News feed for city events and case updates
 */
export class NewsFeed {
    constructor(game, npcGenerator = null) {
        this.game = game;
        this.npcGenerator = npcGenerator;
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

        eventBus.on(EVENT_TYPES.PLAYER_DECISION, () => {
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

        eventBus.on(EVENT_TYPES.RIVAL_ACTION_STARTED, (data) => {
            this.addNews({
                type: 'rival_action',
                actionType: data.action,
                tick: data.tick,
            });
        });

        eventBus.on(EVENT_TYPES.QUEST_COMPLETED, (data) => {
            this.addNews({
                type: 'quest_completed',
                questId: data.questId,
                questType: data.questType,
                tick: data.tick || this.game.state.time?.tick || 0,
            });
        });

        // Faction conflict cascade: rival factions react
        eventBus.on(EVENT_TYPES.FACTION_CONFLICT_TRIGGERED, (data) => {
            this.addNews({
                type: 'faction_conflict',
                sourceFaction: data.sourceFaction,
                affectedFaction: data.affectedFaction,
                sourceDelta: data.sourceDelta,
                reason: data.reason,
                tick: data.tick,
            });
        });

        // Rival influence milestones: rival is gaining ground
        eventBus.on(EVENT_TYPES.RIVAL_INFLUENCE_MILESTONE, (data) => {
            this.addNews({
                type: 'rival_milestone',
                threshold: data.threshold,
                influence: data.influence,
                tick: data.tick,
            });
        });
    }

    /**
     * Determine which NPC faction to use for a given news event
     * @param {Object} news
     * @returns {string|null}
     */
    _getFactionForNews(news) {
        switch (news.type) {
            case 'case_started':
            case 'case_completed':
                return CASE_TYPE_FACTION[news.caseType] || 'civilian';
            case 'crisis':
                return 'criminal';
            case 'crisis_resolved':
                return 'government';
            case 'rival_action':
            case 'rival_milestone':
                return 'criminal';
            case 'quest_completed':
                return 'civilian';
            case 'faction_conflict':
                return news.sourceDelta > 0 ? news.affectedFaction : news.sourceFaction;
            case 'conspiracy_link':
                return null; // NPC is pre-set; skip generation
            default:
                return null;
        }
    }

    /**
     * Determine NPC importance for a given news type
     * @param {Object} news
     * @returns {string}
     */
    _getImportanceForNews(news) {
        const key = ['crisis_resolved', 'conspiracy_link', 'rival_milestone'];
        const major = ['crisis', 'rival_action', 'faction_conflict'];
        if (key.includes(news.type)) return 'key';
        if (major.includes(news.type)) return 'major';
        return 'moderate';
    }

    /**
     * Add a news item
     * @param {Object} news - News data
     */
    addNews(news) {
        // Generate NPC once per article (skip if pre-set by caller, e.g. conspiracy follow-up)
        if (this.npcGenerator && !news._npc) {
            const faction = this._getFactionForNews(news);
            if (faction) {
                const importance = this._getImportanceForNews(news);
                news._npc = this.npcGenerator.generateNPC({ faction, importance });
                if (news.caseId) {
                    this.npcGenerator.addNPCToCase(news._npc.id, news.caseId);
                    news._npc.firstMentionTick = news.tick || 0;
                }
            }
        }

        const newsItem = {
            id: randomId('news'),
            type: news.type,
            timestamp: Date.now(),
            tick: news.tick || this.game.state.time?.tick || 0,
            title: this.getNewsTitle(news),
            description: this.getNewsDescription(news),
            isImportant: this.isImportant(news),
            source: news.source || this.getDefaultSource(news.type),
            caseId: news.caseId || null,
            npcId: news._npc?.id || null,
        };

        this.items.unshift(newsItem);

        if (this.items.length > 100) {
            this.items = this.items.slice(0, 100);
        }

        eventBus.emit(EVENT_TYPES.CAMPAIGN_NEWS_ADDED, {
            newsId: newsItem.id,
            type: newsItem.type,
            tick: newsItem.tick,
        });

        // After case completion: check if this NPC links multiple cases (conspiracy)
        if (news.type === 'case_completed' && news._npc) {
            this._checkConspiracyLinks(news._npc, news.caseId);
        }
    }

    /**
     * Check if a completed-case NPC connects to other cases; if so, generate a conspiracy article
     * @param {Object} npc
     * @param {string} completedCaseId
     */
    _checkConspiracyLinks(npc, completedCaseId) {
        const otherCases = (npc.involvedCases || []).filter(id => id !== completedCaseId);
        if (otherCases.length === 0) return;

        // Fire-and-forget: create a follow-up conspiracy article with the same NPC
        this.addNews({
            type: 'conspiracy_link',
            _npc: npc, // reuse existing NPC — no new generation
            caseIds: [completedCaseId, ...otherCases],
            primaryCaseId: completedCaseId,
            tick: this.game.state.time?.tick || 0,
        });

        // Also pulse the VFX intel system
        eventBus.emit(EVENT_TYPES.INTEL_REVEALED, {
            type: 'conspiracy',
            npcId: npc.id,
            caseIds: [completedCaseId, ...otherCases],
            tick: this.game.state.time?.tick || 0,
        });
    }

    /**
     * Get news title based on type
     * @param {Object} news
     * @returns {string}
     */
    getNewsTitle(news) {
        const npc = news._npc;

        switch (news.type) {
            case 'case_started': {
                const caseName = this.getCaseTypeName(news.caseType);
                return npc
                    ? `${caseName} Case: ${npc.fullName} Under Scrutiny`
                    : `${caseName} Investigation Started`;
            }
            case 'case_completed': {
                const caseName = this.getCaseTypeName(news.caseType);
                return npc
                    ? `${caseName} Resolved: ${npc.fullName} Identified`
                    : `${caseName} Case Closed`;
            }
            case 'crisis': {
                const crisisName = news.crisisType.replace(/_/g, ' ').toUpperCase();
                return npc
                    ? `CRISIS: ${crisisName} — ${npc.fullName} Suspected`
                    : `CRISIS ALERT: ${crisisName}`;
            }
            case 'crisis_resolved': {
                const crisisName = news.crisisType.replace(/_/g, ' ').toUpperCase();
                return `Crisis Resolved: ${crisisName}`;
            }
            case 'rival_action': {
                const actionName = this.getRivalActionName(news.actionType);
                return npc
                    ? `RIVAL MOVE: ${actionName} — ${npc.fullName}`
                    : `RIVAL MOVE: ${actionName}`;
            }
            case 'quest_completed':
                return npc
                    ? `Operation Success: ${npc.fullName} Cooperated`
                    : 'Operation Complete';
            case 'faction_conflict': {
                const src = FACTION_DISPLAY[news.sourceFaction] || news.sourceFaction;
                const aff = FACTION_DISPLAY[news.affectedFaction] || news.affectedFaction;
                return `Faction Tensions: ${src} vs ${aff}`;
            }
            case 'conspiracy_link':
                return npc
                    ? `CONSPIRACY: ${npc.fullName} Connects ${news.caseIds?.length || 2} Cases`
                    : 'Conspiracy Threads Uncovered';
            case 'rival_milestone': {
                const level = news.threshold >= 80 ? 'CRITICAL' : 'WARNING';
                return npc
                    ? `${level}: Rival Surge — ${npc.fullName} Rising`
                    : `${level}: Rival Influence Expanding`;
            }
            case 'briefing':
                return 'Intelligence Briefing';
            case 'player_action':
                return 'Operation Complete';
            default:
                return 'City News';
        }
    }

    /**
     * Get news description based on type
     * @param {Object} news
     * @returns {string}
     */
    getNewsDescription(news) {
        const npc = news._npc;
        const npcSpan = npc ? `<span class="npc-mention">${npc.fullName}</span>` : null;

        switch (news.type) {
            case 'case_started': {
                const caseName = this.getCaseTypeName(news.caseType);
                const location = this._getRandomLocation();
                if (npc) {
                    return `${npcSpan}, ${npc.title}, has been identified in connection with a ${caseName.toLowerCase()} case near ${location}. ${npc.backstory} Investigation underway.`;
                }
                return `Investigation begun: ${caseName}. Authorities are gathering evidence.`;
            }
            case 'case_completed': {
                const caseName = this.getCaseTypeName(news.caseType);
                if (npc) {
                    // Check if this NPC is connected to other cases (conspiracy link)
                    const linkedCases = npc.involvedCases?.length > 1
                        ? ` This individual has been linked to ${npc.involvedCases.length - 1} other case(s).`
                        : '';
                    return `${npcSpan} (${npc.title}) has been identified as the primary suspect in the ${caseName.toLowerCase()} case.${linkedCases} The case is now closed.`;
                }
                return `Case resolved: ${caseName}. All leads have been pursued.`;
            }
            case 'briefing':
                return 'New intelligence briefing available. Review your case files for updated information.';
            case 'crisis': {
                const crisisName = news.crisisType.replace(/_/g, ' ').toUpperCase();
                if (npc) {
                    return `URGENT: ${crisisName} detected across the city. ${npcSpan} (${npc.title}) is suspected of orchestrating this event. ${npc.backstory} Emergency services have been deployed.`;
                }
                return `CRISIS ALERT: ${crisisName}. Emergency response teams are being mobilized.`;
            }
            case 'crisis_resolved': {
                const crisisName = news.crisisType.replace(/_/g, ' ').toUpperCase();
                const outcome = news.outcome || 'contained';
                return `The ${crisisName} has been ${outcome}. City services are returning to normal operations. Damage assessment ongoing.`;
            }
            case 'rival_action': {
                const actionName = this.getRivalActionName(news.actionType);
                const actionDesc = this.getRivalActionDescription(news.actionType);
                const location = this._getRandomLocation();
                if (npc) {
                    return `INTEL: ${npcSpan} (${npc.title}) has orchestrated a ${actionName.toLowerCase()} operation near ${location}. ${actionDesc} Countermeasures recommended.`;
                }
                return `INTEL: Rival operation detected — ${actionName}. ${actionDesc}`;
            }
            case 'quest_completed': {
                if (npc) {
                    return `${npcSpan} (${npc.title}) provided critical cooperation in your latest operation. Their ${npc.personality} disposition proved decisive.`;
                }
                return 'Your recent operation concluded successfully. Faction responses may vary.';
            }
            case 'faction_conflict': {
                const src = FACTION_DISPLAY[news.sourceFaction] || news.sourceFaction;
                const aff = FACTION_DISPLAY[news.affectedFaction] || news.affectedFaction;
                const direction = news.sourceDelta > 0 ? 'rise' : 'fall';
                if (npc) {
                    return `The ${direction} of your standing with the ${src} has triggered a reaction from the ${aff}. ${npcSpan} (${npc.title}) has been vocal in opposition. Expect heightened tensions.`;
                }
                return `Your actions with the ${src} have angered the ${aff}. Faction tensions are rising.`;
            }
            case 'conspiracy_link': {
                const count = (news.caseIds?.length || 2);
                if (npc) {
                    const loc = this._getRandomLocation();
                    return `INTEL BREAKTHROUGH: Cross-referencing case files reveals ${npcSpan} (${npc.title}) is a common thread across ${count} separate investigations. Last known location: ${loc}. ${npc.backstory} Analysts recommend elevating threat level.`;
                }
                return `Cross-case analysis has revealed a shared suspect connecting ${count} investigations. Threat level elevated.`;
            }
            case 'rival_milestone': {
                const level = news.threshold >= 80 ? 'critical' : 'elevated';
                const territory = this._getRandomLocation();
                if (npc) {
                    return `RIVAL ALERT: Influence has reached ${level} levels (${news.influence?.toFixed(0) || news.threshold}%). ${npcSpan} (${npc.title}) is coordinating expansion efforts near ${territory}. ${npc.backstory} Countermeasures are urgently recommended.`;
                }
                return `RIVAL ALERT: Adversarial influence has reached ${level} levels near ${territory}. Recommend immediate countermeasures.`;
            }
            case 'player_action':
                return 'Your recent actions have impacted the city. Faction responses may vary.';
            default:
                return 'City news update';
        }
    }

    /**
     * Get a random location for news stories
     * @returns {string}
     */
    _getRandomLocation() {
        const locations = [
            'Downtown District',
            'Industrial Zone',
            'Waterfront',
            'Old Town',
            'Tech Park',
            'University Quarter',
            'Harbor District',
            'Financial Center',
            'Residential Area',
            'Suburban Outskirts'
        ];
        return locations[Math.floor(this.game.rngStreams.narrative.next() * locations.length)];
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
            'rival_action',
            'faction_conflict',
            'conspiracy_link',
            'rival_milestone',
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
            rival_action: 'Rival Intel Network',
            quest_completed: 'Operations Debrief',
            faction_conflict: 'Faction Monitor',
            conspiracy_link: 'Cross-Case Analysis',
            rival_milestone: 'Threat Assessment',
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
     * Get rival action name
     * @param {string} actionType
     * @returns {string}
     */
    // Tier 2B: Rival action visibility
    getRivalActionName(actionType) {
        const names = {
            sabotage_grid: 'Grid Sabotage',
            spread_propaganda: 'Propaganda Campaign',
            poach_workers: 'Worker Poaching',
            trigger_gang_activity: 'Gang Incitement',
            bribe_officials: 'Official Bribery',
            economic_spying: 'Economic Espionage',
            media_blackout: 'Media Blackout',
            cooldown: 'Reorganization',
        };
        return names[actionType] || actionType.replace('_', ' ').toUpperCase();
    }

    /**
     * Get rival action description
     * @param {string} actionType
     * @returns {string}
     */
    getRivalActionDescription(actionType) {
        const descriptions = {
            sabotage_grid: 'Resource production has been disrupted across multiple facilities.',
            spread_propaganda: 'Anti-government sentiment is spreading among citizens.',
            poach_workers: 'Skilled workers are being recruited away from your city.',
            trigger_gang_activity: 'Criminal organizations are causing unrest in your districts.',
            bribe_officials: 'Key officials have been compromised by rival interests.',
            economic_spying: 'Trade secrets have been stolen and markets destabilized.',
            media_blackout: 'Positive news coverage has been suppressed.',
            cooldown: 'The rival is regrouping and planning their next move.',
        };
        return descriptions[actionType] || 'Unknown rival operation detected.';
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
     * Get news items involving a specific NPC
     * @param {string} npcId
     * @returns {Array}
     */
    getNewsForNPC(npcId) {
        return this.items.filter(n => n.npcId === npcId);
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
                npcId: n.npcId,
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
            npcId: n.npcId,
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