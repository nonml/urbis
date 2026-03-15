<script>
    import { newsFeedStore } from '../../stores/news_feed.js';

    /** game reference injected after mount */
    export let game = null;

    const FILTER_LABELS = [
        { id: 'all',     label: 'All' },
        { id: 'case',    label: 'Cases' },
        { id: 'crisis',  label: 'Crises' },
        { id: 'briefing',label: 'Briefings' },
        { id: 'rival',   label: 'Rival' },
    ];

    const ICONS = {
        case_started:    '🔍',
        case_completed:  '✅',
        crisis:          '⚠️',
        crisis_resolved: '🛡️',
        briefing:        '📋',
        player_action:   '👤',
        rival_action:    '🎯',
    };
    const NAMES = {
        case_started:    'Case Opened',
        case_completed:  'Case Closed',
        crisis:          'Crisis',
        crisis_resolved: 'Resolved',
        briefing:        'Briefing',
        player_action:   'Action',
        rival_action:    'Rival Intel',
    };

    function icon(type)  { return ICONS[type] ?? '📰'; }
    function cname(type) { return NAMES[type] ?? 'News'; }

    function timeAgo(ts) {
        const d = Date.now() - ts;
        const m = Math.floor(d / 60000);
        const h = Math.floor(d / 3600000);
        const dy = Math.floor(d / 86400000);
        if (m < 1)  return 'Just now';
        if (m < 60) return `${m}m ago`;
        if (h < 24) return `${h}h ago`;
        return `${dy}d ago`;
    }

    function onArticleClick(item) {
        if ((item.type === 'case_started' || item.type === 'case_completed') && item.caseId) {
            game?.caseFileUI?.openCase(item.caseId);
        }
    }

    function clearFeed() {
        if (game?.newsFeed) game.newsFeed.items = [];
        newsFeedStore.update(s => ({ ...s, items: [] }));
    }

    $: filtered = $newsFeedStore.items.filter(item => {
        const f = $newsFeedStore.filter;
        if (f === 'all')      return true;
        if (f === 'case')     return item.type === 'case_started' || item.type === 'case_completed';
        if (f === 'crisis')   return item.type === 'crisis' || item.type === 'crisis_resolved';
        if (f === 'briefing') return item.type === 'briefing';
        if (f === 'rival')    return item.type === 'rival_action';
        return true;
    });
</script>

{#if $newsFeedStore.open}
<div class="news-feed-panel" style="display:flex;flex-direction:column">
    <div class="news-feed-header">
        <div class="news-feed-title">
            <span class="news-feed-icon">📰</span>
            <span>City News Feed</span>
        </div>
        <button class="news-feed-close"
                on:click={() => newsFeedStore.update(s => ({ ...s, open: false }))}>×</button>
    </div>

    <div class="news-feed-filters">
        {#each FILTER_LABELS as f}
        <button class="news-filter-btn" class:active={$newsFeedStore.filter === f.id}
                on:click={() => newsFeedStore.update(s => ({ ...s, filter: f.id }))}>
            {f.label}
        </button>
        {/each}
    </div>

    <div class="news-feed-list">
        {#if filtered.length === 0}
        <div class="news-feed-empty">
            <span class="news-feed-empty-icon">📭</span>
            <p>No news articles found</p>
        </div>
        {:else}
        {#each filtered as item (item.id)}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="news-article {item.isImportant ? 'severity-high' : 'severity-low'}"
             on:click={() => onArticleClick(item)}>
            <div class="news-article-header">
                <span class="news-category {item.type}">{icon(item.type)} {cname(item.type)}</span>
                <span class="news-time">{timeAgo(item.timestamp)}</span>
            </div>
            <h3 class="news-headline">{item.title}</h3>
            <p class="news-body">{item.description}</p>
            {#if item.source}
            <div class="news-source">Source: {item.source}</div>
            {/if}
        </div>
        {/each}
        {/if}
    </div>

    <div class="news-feed-footer">
        <button class="news-feed-btn" on:click={clearFeed}>Clear Feed</button>
    </div>
</div>
{/if}
