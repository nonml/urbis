// News Feed UI Panel - Tier 2B
// Displays campaign news feed with NPC-enhanced articles

export class NewsFeedPanel {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.isOpen = false;
        this.currentFilter = 'all'; // all, case, crisis, briefing, player_action
    }

    /**
     * Create the news feed UI
     */
    createUI() {
        if (this.container) return this.container;

        // Main container
        this.container = document.createElement('div');
        this.container.className = 'news-feed-panel';
        this.container.style.display = 'none';

        // Header
        const header = document.createElement('div');
        header.className = 'news-feed-header';
        header.innerHTML = `
            <div class="news-feed-title">
                <span class="news-feed-icon">📰</span>
                <span>City News Feed</span>
            </div>
            <button class="news-feed-close" data-action="close">×</button>
        `;
        this.container.appendChild(header);

        // Filter bar
        const filterBar = document.createElement('div');
        filterBar.className = 'news-feed-filters';
        filterBar.innerHTML = `
            <button class="news-filter-btn active" data-filter="all">All</button>
            <button class="news-filter-btn" data-filter="case">Cases</button>
            <button class="news-filter-btn" data-filter="crisis">Crises</button>
            <button class="news-filter-btn" data-filter="briefing">Briefings</button>
            <button class="news-filter-btn" data-filter="rival">Rival</button>
        `;
        this.container.appendChild(filterBar);

        // Article list container
        const articleList = document.createElement('div');
        articleList.className = 'news-feed-list';
        articleList.id = 'news-feed-list';
        this.container.appendChild(articleList);

        // Footer with actions
        const footer = document.createElement('div');
        footer.className = 'news-feed-footer';
        footer.innerHTML = `
            <button class="news-feed-btn" data-action="clear">Clear Feed</button>
        `;
        this.container.appendChild(footer);

        // Event listeners
        this._setupEventListeners();

        return this.container;
    }

    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        // Close button
        this.container.querySelector('[data-action="close"]').addEventListener('click', () => {
            this.close();
        });

        // Filter buttons
        this.container.querySelectorAll('.news-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.container.querySelectorAll('.news-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this._renderArticles();
            });
        });

        // Footer buttons
        this.container.querySelector('[data-action="clear"]').addEventListener('click', () => {
            if (this.game.newsFeed) {
                this.game.newsFeed.items = [];
            }
            this._renderArticles();
        });
    }

    /**
     * Mount the panel to the DOM
     * @param {HTMLElement} parent - Parent container
     */
    mount(parent = document.body) {
        if (!this.container) {
            this.createUI();
        }
        parent.appendChild(this.container);
    }

    /**
     * Open the news feed panel
     */
    open() {
        this.isOpen = true;
        this.container.style.display = 'flex';
        this._renderArticles();
    }

    /**
     * Close the news feed panel
     */
    close() {
        this.isOpen = false;
        this.container.style.display = 'none';
    }

    /**
     * Toggle the news feed panel
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Update the news feed with new articles
     */
    update() {
        if (this.isOpen && this.game.newsFeed) {
            this._renderArticles();
        }
    }

    /**
     * Render articles to the UI
     */
    _renderArticles() {
        const list = this.container.querySelector('.news-feed-list');
        if (!list) return;

        const newsItems = this.game.newsFeed?.items || [];

        // Filter articles
        let filteredArticles = newsItems;
        if (this.currentFilter !== 'all') {
            filteredArticles = newsItems.filter(item => {
                if (this.currentFilter === 'case') {
                    return item.type === 'case_started' || item.type === 'case_completed';
                }
                if (this.currentFilter === 'crisis') {
                    return item.type === 'crisis' || item.type === 'crisis_resolved';
                }
                if (this.currentFilter === 'briefing') {
                    return item.type === 'briefing';
                }
                // Tier 2B: Rival action filter
                if (this.currentFilter === 'rival') {
                    return item.type === 'rival_action';
                }
                return true;
            });
        }

        if (filteredArticles.length === 0) {
            list.innerHTML = `
                <div class="news-feed-empty">
                    <span class="news-feed-empty-icon">📭</span>
                    <p>No news articles found</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filteredArticles.map(item => this._createArticleHTML(item)).join('');

        // Add click listeners to articles
        list.querySelectorAll('.news-article').forEach(el => {
            el.addEventListener('click', () => {
                const itemId = el.dataset.articleId;
                const item = newsItems.find(n => n.id === itemId);
                if (item) {
                    this._onArticleClick(item);
                }
            });
        });
    }

    /**
     * Create HTML for a news article
     */
    _createArticleHTML(item) {
        const severityClass = item.isImportant ? 'severity-high' : 'severity-low';
        const timeAgo = this._getTimeAgo(item.timestamp);
        const categoryIcon = this._getCategoryIcon(item.type);
        const categoryName = this._getCategoryName(item.type);

        return `
            <div class="news-article ${severityClass}" data-article-id="${item.id}">
                <div class="news-article-header">
                    <span class="news-category ${item.type}">${categoryIcon} ${categoryName}</span>
                    <span class="news-time">${timeAgo}</span>
                </div>
                <h3 class="news-headline">${item.title}</h3>
                <p class="news-body">${item.description}</p>
                ${item.source ? `<div class="news-source">Source: ${item.source}</div>` : ''}
            </div>
        `;
    }

    /**
     * Get category icon
     */
    _getCategoryIcon(type) {
        const icons = {
            case_started: '🔍',
            case_completed: '✅',
            crisis: '⚠️',
            crisis_resolved: '🛡️',
            briefing: '📋',
            player_action: '👤',
            rival_action: '🎯', // Tier 2B: Rival action icon
        };
        return icons[type] || '📰';
    }

    /**
     * Get category name
     */
    _getCategoryName(type) {
        const names = {
            case_started: 'Case Opened',
            case_completed: 'Case Closed',
            crisis: 'Crisis',
            crisis_resolved: 'Resolved',
            briefing: 'Briefing',
            player_action: 'Action',
            rival_action: 'Rival Intel', // Tier 2B: Rival action name
        };
        return names[type] || 'News';
    }

    /**
     * Get time ago string
     */
    _getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }

    /**
     * Handle article click
     */
    _onArticleClick(item) {
        // Could open detailed view or related case file
        if (item.type === 'case_started' || item.type === 'case_completed') {
            this.game.caseFileUI?.openCase(item.caseId);
        }
    }
}
