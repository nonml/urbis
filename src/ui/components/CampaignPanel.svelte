<script>
    import { campaignPanelStore } from '../../stores/campaign_panel.js';

    $: s = $campaignPanelStore;

    function close() { campaignPanelStore.update(st => ({ ...st, open: false })); }
    function switchTab(t) { campaignPanelStore.update(st => ({ ...st, activeTab: t })); }

    function formatTime(tick) {
        const ms = tick * 500;
        const m = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    }
</script>

{#if s.open}
<div id="campaign-panel" class="campaign-panel" style="display:flex;flex-direction:column">
    <div class="campaign-panel-header">
        <h2>Campaign Hub</h2>
        <button class="campaign-panel-close" on:click={close}>&times;</button>
    </div>
    <div class="campaign-content">
        <div class="campaign-tabs">
            {#each ['news','briefings','cases'] as tab}
            <button class="campaign-tab" class:active={s.activeTab === tab}
                    on:click={() => switchTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
            {/each}
        </div>

        {#if s.activeTab === 'news'}
        <div class="campaign-section news-section">
            <h3 class="campaign-section-title">City News</h3>
            {#if s.newsItems.length === 0}
            <div class="campaign-section empty">No recent news</div>
            {:else}
            {#each s.newsItems as item}
            <div class="news-item" class:important={item.isImportant} class:critical={item.priority === 'critical'}>
                <div class="news-header">
                    <span class="news-title">{item.title}</span>
                    <span class="news-source">{item.source || ''}</span>
                </div>
                <div class="news-time">{formatTime(item.tick || 0)}</div>
                <div class="news-description">{item.description || ''}</div>
            </div>
            {/each}
            {/if}
        </div>

        {:else if s.activeTab === 'briefings'}
        <div class="campaign-section briefing-section">
            <h3 class="campaign-section-title">Intelligence Briefings</h3>
            {#if s.briefings.length === 0}
            <div class="campaign-section empty">No briefings available</div>
            {:else}
            {#each s.briefings as b}
            <div class="briefing-item priority-{b.priority || 'medium'}">
                <div class="briefing-header">
                    <span class="briefing-title">{b.title}</span>
                    <span class="briefing-priority {b.priority || 'medium'}">{b.priority || 'medium'}</span>
                </div>
                <div class="briefing-content">{b.content || ''}</div>
            </div>
            {/each}
            {/if}
        </div>

        {:else}
        <div class="campaign-section case-section">
            <h3 class="campaign-section-title">Active Cases</h3>
            {#if s.activeCase}
            <div class="active-case-display">
                <div class="active-case-title">{s.activeCase.title}</div>
                <div class="active-case-meta">{s.activeCase.meta}</div>
                <div class="active-case-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:{s.activeCase.progress}%"></div>
                    </div>
                </div>
            </div>
            {/if}
            {#if s.cases.length === 0}
            <div class="campaign-section empty">No active cases</div>
            {:else}
            {#each s.cases as c (c.id)}
            <div class="case-list-item" class:completed={c.status === 'completed'}>
                <div class="case-list-header">
                    <span class="case-list-type">{c.type.replace('_',' ').toUpperCase()}</span>
                    <span class="case-list-status {c.status === 'completed' ? 'completed' : 'active'}">{c.status}</span>
                </div>
                <div style="margin-top:4px;font-size:12px;color:#666">{c.title}</div>
            </div>
            {/each}
            {/if}
        </div>
        {/if}
    </div>
</div>
{/if}
