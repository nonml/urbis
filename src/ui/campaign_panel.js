// Campaign Panel UI - Displays campaign information, news feed, and briefings
import { NewsFeed, BriefingSystem } from '../sim/campaign/news_feed.js';

/**
 * Campaign Panel UI - Manages display of campaign-related information
 */
export class CampaignPanel {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.activeTab = 'news';
        this.open = false;
        this.newsFeed = game.newsFeed;
        this.briefingSystem = game.briefingSystem;
        this.create();
        this.setupListeners();
    }

    /**
     * Create the UI elements
     */
    create() {
        this.container = document.createElement('div');
        this.container.id = 'campaign-panel';
        this.container.className = 'campaign-panel';
        this.container.style.display = 'none';
        this.container.innerHTML = `
            <div class="campaign-panel-header">
                <h2>Campaign Hub</h2>
                <button class="campaign-panel-close" id="campaign-panel-close">&times;</button>
            </div>
            <div class="campaign-content">
                <div class="campaign-tabs">
                    <button class="campaign-tab active" data-tab="news">News</button>
                    <button class="campaign-tab" data-tab="briefings">Briefings</button>
                    <button class="campaign-tab" data-tab="cases">Cases</button>
                </div>
                <div class="campaign-section news-section" id="campaign-news">
                    <h3 class="campaign-section-title">City News</h3>
                    <div id="news-list" class="news-list"></div>
                </div>
                <div class="campaign-section briefing-section hidden" id="campaign-briefings">
                    <h3 class="campaign-section-title">Intelligence Briefings</h3>
                    <div id="briefing-list" class="briefing-list"></div>
                </div>
                <div class="campaign-section case-section hidden" id="campaign-cases">
                    <h3 class="campaign-section-title">Active Cases</h3>
                    <div id="active-case-display" class="active-case-display hidden">
                        <div class="active-case-title" id="active-case-name">Case Name</div>
                        <div class="active-case-meta" id="active-case-meta">Case details</div>
                        <div class="active-case-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" id="case-progress-fill" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                    <div id="case-list" class="case-list"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        // Setup tabs
        const tabs = this.container.querySelectorAll('.campaign-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Setup close button
        const closeBtn = this.container.querySelector('#campaign-panel-close');
        closeBtn.addEventListener('click', () => this.toggle(false));

        // Setup news list container
        this.newsList = this.container.querySelector('#news-list');
        this.briefingList = this.container.querySelector('#briefing-list');
        this.caseList = this.container.querySelector('#case-list');
        this.activeCaseDisplay = this.container.querySelector('#active-case-display');
        this.activeCaseName = this.container.querySelector('#active-case-name');
        this.activeCaseMeta = this.container.querySelector('#active-case-meta');
        this.caseProgressFill = this.container.querySelector('#case-progress-fill');
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        if (this.newsFeed) {
            this.newsFeed.onNewsAdded = () => this.refreshNews();
        }

        if (this.briefingSystem) {
            this.briefingSystem.onBriefingAdded = () => this.refreshBriefings();
        }
    }

    /**
     * Toggle panel visibility
     * @param {boolean} force - Force open or close (null to toggle)
     */
    toggle(force = null) {
        this.open = force !== null ? force : !this.open;
        this.container.style.display = this.open ? 'flex' : 'none';

        if (this.open) {
            this.refresh();
        }
    }

    /**
     * Switch between tabs
     * @param {string} tabName - Tab name to switch to
     */
    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tab styling
        const tabs = this.container.querySelectorAll('.campaign-tab');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Show appropriate section
        const sections = this.container.querySelectorAll('.campaign-section');
        sections.forEach(section => {
            if (section.id === `campaign-${tabName}`) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });

        // Refresh content based on tab
        if (tabName === 'news') this.refreshNews();
        else if (tabName === 'briefings') this.refreshBriefings();
        else if (tabName === 'cases') this.refreshCases();
    }

    /**
     * Refresh all content
     */
    refresh() {
        this.refreshNews();
        this.refreshBriefings();
        this.refreshCases();
    }

    /**
     * Refresh news feed
     */
    refreshNews() {
        if (!this.newsFeed) return;
        if (!this.newsList) return;

        const newsItems = this.newsFeed.getRecentNews(15);

        if (newsItems.length === 0) {
            this.newsList.innerHTML = '<div class="campaign-section empty">No recent news</div>';
            return;
        }

        this.newsList.innerHTML = newsItems.map(item => this.createNewsItemHTML(item)).join('');

        // Highlight important news
        const importantNews = this.newsList.querySelectorAll('.news-item.important');
        if (importantNews.length > 0 && !this.hasImportantNotification) {
            this.hasImportantNotification = true;
            this.game.ui?.showMessage?.('Important news available in Campaign Hub', 'warning');
        }
    }

    /**
     * Create HTML for a news item
     * @param {Object} news
     * @returns {string}
     */
    createNewsItemHTML(news) {
        const isImportant = news.isImportant ? ' important' : '';
        const isCritical = news.priority === 'critical' ? ' critical' : '';

        return `
            <div class="news-item${isImportant}${isCritical}">
                <div class="news-header">
                    <span class="news-title">${news.title}</span>
                    <span class="news-source">${news.source || ''}</span>
                </div>
                <div class="news-time">${this.formatTime(news.tick || 0)}</div>
                <div class="news-description">${news.description || ''}</div>
            </div>
        `;
    }

    /**
     * Refresh briefing list
     */
    refreshBriefings() {
        if (!this.briefingSystem) return;
        if (!this.briefingList) return;

        const briefings = this.briefingSystem.getRecentBriefings(10);

        if (briefings.length === 0) {
            this.briefingList.innerHTML = '<div class="campaign-section empty">No briefings available</div>';
            return;
        }

        this.briefingList.innerHTML = briefings.map(item => this.createBriefingItemHTML(item)).join('');
    }

    /**
     * Create HTML for a briefing item
     * @param {Object} briefing
     * @returns {string}
     */
    createBriefingItemHTML(briefing) {
        const priorityClass = `priority-${briefing.priority || 'medium'}`;

        return `
            <div class="briefing-item ${priorityClass}">
                <div class="briefing-header">
                    <span class="briefing-title">${briefing.title}</span>
                    <span class="briefing-priority ${briefing.priority || 'medium'}">${briefing.priority || 'medium'}</span>
                </div>
                <div class="briefing-content">${briefing.content || ''}</div>
            </div>
        `;
    }

    /**
     * Refresh case list
     */
    refreshCases() {
        if (!this.game.campaign) return;
        if (!this.caseList) return;

        const activeCase = this.game.campaign.getActiveCase();
        const cases = this.game.campaign.getCasesByStatus('active');

        // Update active case display
        if (activeCase) {
            this.activeCaseDisplay.classList.remove('hidden');
            this.activeCaseName.textContent = activeCase.title;
            this.activeCaseMeta.textContent = `${activeCase.type.replace('_', ' ').toUpperCase()} - ${this.getChapterText(activeCase)}`;
            this.updateCaseProgress(activeCase);
        } else {
            this.activeCaseDisplay.classList.add('hidden');
        }

        // Update case list
        if (cases.length === 0) {
            this.caseList.innerHTML = '<div class="campaign-section empty">No active cases</div>';
        } else {
            this.caseList.innerHTML = cases.map(c => this.createCaseItemHTML(c)).join('');
        }
    }

    /**
     * Get chapter text for a case
     * @param {Object} caseObj
     * @returns {string}
     */
    getChapterText(caseObj) {
        const totalChapters = caseObj.chapters?.length || 1;
        const current = Math.min(caseObj.currentChapter + 1, totalChapters);
        return `Chapter ${current}/${totalChapters}`;
    }

    /**
     * Update case progress bar
     * @param {Object} caseObj
     */
    updateCaseProgress(caseObj) {
        const totalChapters = caseObj.chapters?.length || 1;
        const current = caseObj.currentChapter;
        const progress = Math.min(100, (current / totalChapters) * 100);
        this.caseProgressFill.style.width = `${progress}%`;
    }

    /**
     * Create HTML for a case item
     * @param {Object} caseObj
     * @returns {string}
     */
    createCaseItemHTML(caseObj) {
        const status = caseObj.status || 'active';
        const completed = status === 'completed';
        const statusClass = completed ? 'completed' : 'active';

        return `
            <div class="case-list-item${completed ? ' completed' : ''}">
                <div class="case-list-header">
                    <span class="case-list-type">${caseObj.type.replace('_', ' ').toUpperCase()}</span>
                    <span class="case-list-status ${statusClass}">${status}</span>
                </div>
                <div style="margin-top: 4px; font-size: 12px; color: #666;">
                    ${caseObj.title}
                </div>
            </div>
        `;
    }

    /**
     * Format tick time
     * @param {number} tick
     * @returns {string}
     */
    formatTime(tick) {
        const tickMs = 500; // Assuming 500ms per tick
        const ms = tick * tickMs;

        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    /**
     * Show news notification
     */
    showNewsNotification() {
        if (!this.open) {
            this.game.ui?.showMessage?.('New news available - press C to view', 'normal');
        }
    }

    /**
     * Get panel state
     * @returns {Object} Panel state
     */
    getState() {
        return {
            open: this.open,
            activeTab: this.activeTab,
        };
    }

    /**
     * Set panel state
     * @param {Object} state
     */
    setState(state) {
        if (state.open) this.toggle(true);
        if (state.activeTab) this.switchTab(state.activeTab);
    }

    /**
     * Update method for periodic checks
     */
    update() {
        if (!this.open) return;

        // Check for new news items
        if (this.newsFeed) {
            const currentCount = this.newsFeed.items?.length || 0;
            if (currentCount > this.lastNewsCount) {
                this.showNewsNotification();
            }
            this.lastNewsCount = currentCount;
        }
    }
}