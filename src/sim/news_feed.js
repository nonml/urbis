// News Feed System - Narrative storytelling through news articles
// Creates narrative arcs with named NPCs and connected events

import { eventBus, EVENT_TYPES } from './events.js';
import { getNPCGenerator } from './npc_generator.js';

// News categories
export const NEWS_CATEGORIES = {
    BREAKING: 'breaking',
    CRIME: 'crime',
    POLITICS: 'politics',
    BUSINESS: 'business',
    SOCIETY: 'society',
    INVESTIGATION: 'investigation',
    RIVAL: 'rival'
};

// News severity levels
export const NEWS_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

export class NewsFeed {
    constructor(game) {
        this.game = game;
        this.articles = [];
        this.maxArticles = 50;
        this.npcGenerator = null;
        this.activeStorylines = new Map();
        this.setupListeners();
    }

    /**
     * Initialize the news feed with NPC generator
     */
    initialize(seed) {
        this.npcGenerator = getNPCGenerator(seed);
    }

    /**
     * Setup event listeners for news generation
     */
    setupListeners() {
        // Crisis events
        eventBus.on(EVENT_TYPES.CRISIS_STARTED, (data) => this._onCrisisStarted(data));
        eventBus.on(EVENT_TYPES.CRISIS_RESOLVED, (data) => this._onCrisisResolved(data));
        eventBus.on(EVENT_TYPES.CRISIS_ESCALATED, (data) => this._onCrisisEscalated(data));

        // Quest events
        eventBus.on(EVENT_TYPES.QUEST_STARTED, (data) => this._onQuestStarted(data));
        eventBus.on(EVENT_TYPES.QUEST_COMPLETED, (data) => this._onQuestCompleted(data));

        // Case events
        eventBus.on(EVENT_TYPES.CAMPAIGN_CASE_STARTED, (data) => this._onCaseStarted(data));
        eventBus.on(EVENT_TYPES.CAMPAIGN_CASE_COMPLETED, (data) => this._onCaseCompleted(data));

        // Rival events
        eventBus.on(EVENT_TYPES.RIVAL_ACTION_STARTED, (data) => this._onRivalAction(data));

        // Intel events
        eventBus.on(EVENT_TYPES.INTEL_REVEALED, (data) => this._onIntelRevealed(data));
        eventBus.on(EVENT_TYPES.CLUE_DISCOVERED, (data) => this._onClueDiscovered(data));

        // Faction events
        eventBus.on(EVENT_TYPES.SENTIMENT_CHANGED, (data) => this._onSentimentChanged(data));
    }

    /**
     * Add a news article
     * @param {Object} article - Article data
     */
    addArticle(article) {
        const tick = this.game.state.time.tick || 0;
        
        const newsArticle = {
            id: `news-${tick}-${this.articles.length}`,
            tick: tick,
            category: article.category || NEWS_CATEGORIES.SOCIETY,
            severity: article.severity || NEWS_SEVERITY.MEDIUM,
            headline: article.headline,
            body: article.body || '',
            npcId: article.npcId || null,
            relatedCaseId: article.relatedCaseId || null,
            relatedQuestId: article.relatedQuestId || null,
            storylineId: article.storylineId || null,
            read: false,
            ...article
        };

        this.articles.unshift(newsArticle);
        
        // Limit article count
        while (this.articles.length > this.maxArticles) {
            this.articles.pop();
        }

        // Update UI if available
        this.game.ui?.updateNewsFeed?.();

        return newsArticle;
    }

    /**
     * Get recent articles
     * @param {number} limit - Maximum number of articles
     * @returns {Array} Recent articles
     */
    getRecentArticles(limit = 10) {
        return this.articles.slice(0, limit);
    }

    /**
     * Get unread articles
     * @returns {Array} Unread articles
     */
    getUnreadArticles() {
        return this.articles.filter(article => !article.read);
    }

    /**
     * Mark article as read
     * @param {string} articleId - Article ID
     */
    markAsRead(articleId) {
        const article = this.articles.find(a => a.id === articleId);
        if (article) {
            article.read = true;
            this.game.ui?.updateNewsFeed?.();
        }
    }

    /**
     * Mark all articles as read
     */
    markAllAsRead() {
        this.articles.forEach(article => article.read = true);
        this.game.ui?.updateNewsFeed?.();
    }

    /**
     * Get articles by category
     * @param {string} category - Category filter
     * @returns {Array} Filtered articles
     */
    getArticlesByCategory(category) {
        return this.articles.filter(article => article.category === category);
    }

    /**
     * Get articles by NPC
     * @param {string} npcId - NPC ID
     * @returns {Array} Articles featuring this NPC
     */
    getArticlesByNPC(npcId) {
        return this.articles.filter(article => article.npcId === npcId);
    }

    /**
     * Get articles by storyline
     * @param {string} storylineId - Storyline ID
     * @returns {Array} Articles in this storyline
     */
    getArticlesByStoryline(storylineId) {
        return this.articles.filter(article => article.storylineId === storylineId);
    }

    /**
     * Create a storyline
     * @param {string} id - Storyline ID
     * @param {string} title - Storyline title
     * @param {string} category - Category
     * @param {Object} [mainNPC] - Main NPC involved
     * @returns {Object} Storyline object
     */
    createStoryline(id, title, category, mainNPC = null) {
        const storyline = {
            id,
            title,
            category,
            mainNPCId: mainNPC?.id || null,
            startedTick: this.game.state.time.tick || 0,
            status: 'active', // active, resolved, abandoned
            articleCount: 0,
            description: ''
        };

        this.activeStorylines.set(id, storyline);
        return storyline;
    }

    /**
     * Update storyline
     * @param {string} storylineId - Storyline ID
     * @param {Object} updates - Updates to apply
     */
    updateStoryline(storylineId, updates) {
        const storyline = this.activeStorylines.get(storylineId);
        if (storyline) {
            Object.assign(storyline, updates);
        }
    }

    /**
     * Resolve a storyline
     * @param {string} storylineId - Storyline ID
     */
    resolveStoryline(storylineId) {
        const storyline = this.activeStorylines.get(storylineId);
        if (storyline) {
            storyline.status = 'resolved';
            storyline.resolvedTick = this.game.state.time.tick || 0;
            
            // Add resolution article
            this.addArticle({
                category: storyline.category,
                severity: NEWS_SEVERITY.HIGH,
                headline: `Case Closed: ${storyline.title}`,
                body: `The investigation into ${storyline.title} has concluded. ${storyline.articleCount} news articles documented the unfolding story.`,
                storylineId: storylineId,
                relatedCaseId: storyline.relatedCaseId
            });
        }
    }

    // Event handlers

    _onCrisisStarted(data) {
        const { type, districtId, severity } = data;
        
        let headline, category, npcId;
        
        switch (type) {
            case 'gang_violence':
                headline = 'Gang Violence Erupts in District';
                category = NEWS_CATEGORIES.CRIME;
                break;
            case 'protest':
                headline = 'Mass Protest Shuts Down City Streets';
                category = NEWS_CATEGORIES.POLITICS;
                break;
            case 'fire':
                headline = 'Major Fire Destroys City Block';
                category = NEWS_CATEGORIES.BREAKING;
                break;
            case 'crime_wave':
                headline = 'Crime Wave Sweeps Through Neighborhood';
                category = NEWS_CATEGORIES.CRIME;
                break;
            default:
                headline = 'Crisis Hits the City';
                category = NEWS_CATEGORIES.BREAKING;
        }

        // Generate NPC if this is a significant crisis
        if (severity >= 2 && this.npcGenerator) {
            const npc = this.npcGenerator.generateNPC({
                faction: 'civilian',
                importance: 'moderate'
            });
            npcId = npc.id;
            
            // Create a storyline for major crises
            if (severity >= 3) {
                this.createStoryline(
                    `crisis-${data.id}`,
                    `${type.replace('_', ' ')} Investigation`,
                    category,
                    npc
                );
            }
        }

        this.addArticle({
            category,
            severity: severity >= 3 ? NEWS_SEVERITY.CRITICAL : NEWS_SEVERITY.HIGH,
            headline,
            body: `A ${type.replace('_', ' ')} crisis has been detected in district ${districtId}. Emergency services have been dispatched.`,
            npcId,
            storylineId: severity >= 3 ? `crisis-${data.id}` : null
        });
    }

    _onCrisisResolved(data) {
        const { type, severity } = data;
        
        this.addArticle({
            category: NEWS_CATEGORIES.BREAKING,
            severity: NEWS_SEVERITY.MEDIUM,
            headline: `Crisis Resolved: ${type.replace('_', ' ')}`,
            body: `Emergency services have successfully contained the ${type.replace('_', ' ')} incident. Authorities are investigating the cause.`
        });

        // Resolve storyline if it exists
        this.updateStoryline(`crisis-${data.id}`, { status: 'resolved' });
    }

    _onCrisisEscalated(data) {
        this.addArticle({
            category: NEWS_CATEGORIES.BREAKING,
            severity: NEWS_SEVERITY.CRITICAL,
            headline: `BREAKING: ${data.type.replace('_', ' ')} Escalates`,
            body: `The situation has worsened. Authorities are calling for additional resources to handle the escalating crisis.`
        });
    }

    _onQuestStarted(data) {
        const { title, type } = data;
        
        this.addArticle({
            category: NEWS_CATEGORIES.INVESTIGATION,
            severity: NEWS_SEVERITY.MEDIUM,
            headline: `New Investigation: ${title}`,
            body: `Authorities have opened a new investigation into ${type}. Citizens are urged to come forward with any information.`
        });
    }

    _onQuestCompleted(data) {
        const { title, rewards } = data;
        
        this.addArticle({
            category: NEWS_CATEGORIES.INVESTIGATION,
            severity: NEWS_SEVERITY.MEDIUM,
            headline: `Investigation Complete: ${title}`,
            body: `The investigation into ${title} has concluded successfully. Justice has been served.`
        });
    }

    _onCaseStarted(data) {
        const { caseType, title } = data;
        
        // Generate key NPC for the case
        let npcId = null;
        if (this.npcGenerator) {
            const npc = this.npcGenerator.generateNPC({
                faction: 'criminal',
                importance: 'key'
            });
            npcId = npc.id;
            
            // Create storyline for the case
            this.createStoryline(
                `case-${data.id}`,
                title || `${caseType.replace('_', ' ')} Case`,
                NEWS_CATEGORIES.INVESTIGATION,
                npc
            );
        }

        this.addArticle({
            category: NEWS_CATEGORIES.INVESTIGATION,
            severity: NEWS_SEVERITY.HIGH,
            headline: `Major Case Opened: ${title || caseType.replace('_', ' ')}`,
            body: `Investigators have opened a major case file. This investigation could uncover deep corruption within the city.`,
            npcId,
            storylineId: `case-${data.id}`
        });
    }

    _onCaseCompleted(data) {
        const { title } = data;
        
        this.addArticle({
            category: NEWS_CATEGORIES.INVESTIGATION,
            severity: NEWS_SEVERITY.HIGH,
            headline: `Case Closed: ${title}`,
            body: `The major investigation has concluded. Those responsible have been brought to justice.`,
            storylineId: `case-${data.id}`
        });

        // Resolve the storyline
        this.resolveStoryline(`case-${data.id}`);
    }

    _onRivalAction(data) {
        const { action, duration } = data;
        
        // Generate rival NPC if we don't have one
        let npcId = null;
        if (this.npcGenerator) {
            // Check if we have a main rival NPC
            const rivalNPCs = this.npcGenerator.getNPCsByFaction('corporate');
            const mainRival = rivalNPCs.find(npc => npc.importance === 'key');
            
            if (mainRival) {
                npcId = mainRival.id;
            } else {
                // Create main rival NPC
                const npc = this.npcGenerator.generateNPC({
                    faction: 'corporate',
                    importance: 'key'
                });
                npcId = npc.id;
            }
        }

        this.addArticle({
            category: NEWS_CATEGORIES.RIVAL,
            severity: NEWS_SEVERITY.HIGH,
            headline: `Rival Activity Detected: ${action.replace('_', ' ')}`,
            body: `Intelligence suggests rival forces are active in the city. Countermeasures should be considered.`,
            npcId
        });
    }

    _onIntelRevealed(data) {
        const { type, description } = data;
        
        this.addArticle({
            category: NEWS_CATEGORIES.INVESTIGATION,
            severity: NEWS_SEVERITY.MEDIUM,
            headline: `New Intelligence Revealed`,
            body: description || `New information has come to light regarding ${type}. Investigators are reviewing the evidence.`,
            ...data
        });
    }

    _onClueDiscovered(data) {
        const { type, description } = data;
        
        this.addArticle({
            category: NEWS_CATEGORIES.INVESTIGATION,
            severity: NEWS_SEVERITY.LOW,
            headline: `Clue Discovered in Investigation`,
            body: description || `Investigators have found a new clue related to ${type}. This could be a breakthrough.`,
            ...data
        });
    }

    _onSentimentChanged(data) {
        const { faction, change, reason } = data;
        
        const sentiment = change > 0 ? 'improving' : 'deteriorating';
        const severity = Math.abs(change) > 20 ? NEWS_SEVERITY.HIGH : NEWS_SEVERITY.MEDIUM;
        
        this.addArticle({
            category: NEWS_CATEGORIES.POLITICS,
            severity: severity,
            headline: `${faction.charAt(0).toUpperCase() + faction.slice(1)} Relations ${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}`,
            body: `Public sentiment toward the ${faction} is ${sentiment}. This ${reason ? 'comes after ' + reason : 'reflects recent events'}.`,
            ...data
        });
    }

    /**
     * Generate a periodic news update (called by game tick)
     */
    tick() {
        const tick = this.game.state.time.tick || 0;

        // Generate occasional ambient news
        if (tick % 100 === 0 && this.npcGenerator) {
            this._generateAmbientNews();
        }
    }

    /** Alias for tick() — called by game loop as update() */
    update() { this.tick(); }

    /**
     * Generate ambient news derived from actual sim state (6A)
     */
    _generateAmbientNews() {
        const game = this.game;
        const state = game?.state;
        if (!state) return;

        const pop = game.citizens?.citizens?.length ?? state.population ?? 0;
        const happiness = Math.round(game.citizens?.getAverageHappiness?.() ?? state.happiness ?? 50);
        const gold = Math.round(state.resources?.gold ?? 0);
        const food = Math.round(state.resources?.food ?? 0);
        const buildingCount = game.buildings?.buildings?.length ?? 0;
        const weatherIcon = game.weatherSystem?.getWeatherIcon?.() ?? '☀️';
        const weatherType = game.weatherSystem?.state?.type ?? 'clear';
        const day = state.time?.tick ?? 0;

        // Pick NPC to feature in the story
        const npc = this.npcGenerator?.generateNPC({ faction: 'civilian', importance: 'minor' });
        const name = npc?.fullName ?? 'A local official';
        const title = npc?.title ?? 'resident';

        // Build story pool based on current sim data
        const stories = [];

        // Population stories
        if (pop > 0) {
            stories.push({
                headline: `City Population Reaches ${pop} Residents`,
                body: `${name}, ${title}, noted that the city's ${pop} residents are shaping a vibrant community. "${happiness > 60 ? 'People are genuinely happy here' : happiness > 40 ? 'There is room for improvement' : 'We need to address citizen concerns'}," they said.`,
                category: NEWS_CATEGORIES.SOCIETY,
                severity: pop > 100 ? NEWS_SEVERITY.MEDIUM : NEWS_SEVERITY.LOW
            });
        }

        // Happiness stories
        if (happiness >= 75) {
            stories.push({
                headline: `Satisfaction Survey: ${happiness}% of Citizens Report High Morale`,
                body: `A new city survey found ${happiness}% satisfaction among ${pop} residents. ${name} attributed the results to recent infrastructure investments. "This city is on the right track," said the ${title}.`,
                category: NEWS_CATEGORIES.SOCIETY,
                severity: NEWS_SEVERITY.MEDIUM
            });
        } else if (happiness < 40) {
            stories.push({
                headline: `Citizens Express Frustration as Happiness Drops to ${happiness}%`,
                body: `Public discontent is rising with satisfaction at only ${happiness}%. ${name} organized a community forum. "The city needs to listen to its ${pop} residents," said the ${title}.`,
                category: NEWS_CATEGORIES.POLITICS,
                severity: happiness < 25 ? NEWS_SEVERITY.HIGH : NEWS_SEVERITY.MEDIUM
            });
        }

        // Economy stories
        if (gold > 200) {
            stories.push({
                headline: `City Treasury Sits at ${gold} Gold — Budget Surplus Reported`,
                body: `Finance officials reported a surplus of ${gold} gold in the city treasury. ${name} called it "a sign of sound fiscal management." The city also holds ${food} units of food in reserve.`,
                category: NEWS_CATEGORIES.BUSINESS,
                severity: NEWS_SEVERITY.LOW
            });
        } else if (gold < 20 && gold >= 0) {
            stories.push({
                headline: `City Budget Tightens — Only ${gold} Gold Remains`,
                body: `City finances are under strain with just ${gold} gold remaining. ${name}, ${title}, urged the council to explore new income streams. Food stores stand at ${food} units.`,
                category: NEWS_CATEGORIES.BUSINESS,
                severity: NEWS_SEVERITY.HIGH
            });
        } else if (gold < 0) {
            stories.push({
                headline: `City Enters Deficit — Council Calls Emergency Session`,
                body: `The city has fallen ${Math.abs(gold)} gold into debt. ${name} called an emergency council session. Services may be cut if the shortfall continues into the next fiscal period.`,
                category: NEWS_CATEGORIES.POLITICS,
                severity: NEWS_SEVERITY.CRITICAL
            });
        }

        // Building stories
        if (buildingCount > 0 && buildingCount % 10 < 3) {
            stories.push({
                headline: `Urban Development Milestone: ${buildingCount} Structures Built`,
                body: `The city's skyline is growing with ${buildingCount} buildings completed. ${name} praised the pace of construction. "Day ${day} marks real progress for our community," said the ${title}.`,
                category: NEWS_CATEGORIES.SOCIETY,
                severity: NEWS_SEVERITY.LOW
            });
        }

        // Weather-specific stories
        if (weatherType !== 'clear') {
            const weatherEffects = {
                rain: `Heavy rain has slowed outdoor activities, with farm output reduced. ${name} urged citizens to stay indoors.`,
                storm: `A severe storm is battering the city. Emergency services are on standby. Food and wood production has been impacted.`,
                snow: `Snowfall has blanketed the city, slowing traffic and outdoor work. ${name} confirmed the city is prepared.`,
                fog: `Dense fog reduced visibility across the city today. Authorities urged caution on roads.`,
            };
            const weatherBody = weatherEffects[weatherType] ?? `Unusual weather (${weatherType}) is affecting the city today.`;
            stories.push({
                headline: `${weatherIcon} Weather Alert: ${weatherType.charAt(0).toUpperCase() + weatherType.slice(1)} Conditions Affecting City`,
                body: weatherBody,
                category: NEWS_CATEGORIES.BREAKING,
                severity: weatherType === 'storm' ? NEWS_SEVERITY.HIGH : NEWS_SEVERITY.MEDIUM
            });
        }

        // Food shortage story
        if (food < 10 && pop > 10) {
            stories.push({
                headline: `Food Shortage Warning — Only ${food} Units in Reserve`,
                body: `City officials warned of a food shortage with only ${food} units remaining for ${pop} residents. ${name} called for emergency food production measures.`,
                category: NEWS_CATEGORIES.BREAKING,
                severity: NEWS_SEVERITY.HIGH
            });
        }

        if (stories.length === 0) {
            // Fallback: generic NPC-flavored story
            stories.push({
                headline: `${name} Addresses City Development Plans`,
                body: `${name}, ${title}, spoke to residents about the city's future. With ${pop} citizens and ${buildingCount} buildings, ${name} described a cautiously optimistic outlook.`,
                category: NEWS_CATEGORIES.SOCIETY,
                severity: NEWS_SEVERITY.LOW
            });
        }

        // Pick one story (weighted toward first matching)
        const rng = this.npcGenerator?.rng;
        const story = rng ? stories[Math.floor(rng.next() * stories.length)] : stories[0];
        this.addArticle({ npcId: npc?.id, ...story });
    }

    /**
     * Get news feed summary for UI
     * @returns {Object} Summary data
     */
    getSummary() {
        const unreadCount = this.articles.filter(a => !a.read).length;
        const byCategory = {};
        
        this.articles.forEach(article => {
            byCategory[article.category] = (byCategory[article.category] || 0) + 1;
        });

        return {
            totalArticles: this.articles.length,
            unreadCount,
            byCategory,
            activeStorylines: this.activeStorylines.size,
            recentArticles: this.getRecentArticles(5)
        };
    }
}
