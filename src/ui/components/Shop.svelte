<script>
    import { shopStore } from '../../stores/shop.js';

    export let onUnlock = null;
    export let onClose  = null;

    $: s = $shopStore;
    $: tabItems = s.items.filter(i => i.category === s.activeTab);

    function switchTab(id) { shopStore.update(st => ({ ...st, activeTab: id })); }
    function close() { shopStore.update(st => ({ ...st, open: false })); onClose?.(); }

    function costDisplay(cost) {
        const parts = [];
        if (cost?.runs > 0)  parts.push(`${cost.runs} ${cost.runs === 1 ? 'Run' : 'Runs'}`);
        if (cost?.days > 0)  parts.push(`${cost.days} Days`);
        return parts.length > 0 ? parts.join(' + ') : 'Free';
    }

    function handleItem(item) {
        if (item.isUnlocked) return;
        if (item.isPurchasable) onUnlock?.(item.category, item.key);
        else alert(`Unlock Requirements:\n${costDisplay(item.cost)}\n\n${item.description}`);
    }
</script>

{#if s.open}
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000">
    <div class="shop-panel">
        <div class="shop-header">
            <div>
                <div class="shop-title">Meta Progression Shop</div>
                <div class="shop-subtitle">Unlock content with your city-building achievements</div>
            </div>
            <div class="shop-profile-info">
                Unlocked: <span>{s.profile.unlockedCount}</span> / <span>{s.profile.totalCount}</span>
            </div>
        </div>

        <div class="shop-tabs">
            {#each s.tabs as tab}
            <button class="shop-tab" class:active={s.activeTab === tab.id}
                    on:click={() => switchTab(tab.id)}>
                {tab.icon} {tab.label}
            </button>
            {/each}
        </div>

        <div class="shop-content">
            <div class="shop-grid">
                {#each tabItems as item (item.key)}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div class="shop-item" class:unlocked={item.isUnlocked} class:purchasable={item.isPurchasable}
                     on:click={() => handleItem(item)}>
                    <div class="shop-item-header">
                        <span class="shop-item-name">{item.name}</span>
                        {#if item.isUnlocked}<span class="shop-item-unlocked">Unlocked</span>{/if}
                    </div>
                    <div class="shop-item-description">{item.description}</div>
                    <div class="shop-item-cost">
                        <span class="shop-item-cost-value">{costDisplay(item.cost)}</span>
                        <span class="shop-item-status">
                            {item.isUnlocked ? '✓ Owned' : item.isPurchasable ? 'Click to Unlock' : 'Coming Soon'}
                        </span>
                    </div>
                </div>
                {/each}
            </div>
        </div>

        <div class="shop-footer">
            <div class="shop-profile-info">
                Runs: <span>{s.profile.totalRuns}</span> | Wins: <span>{s.profile.wins}</span> (Rate: {s.profile.winRate}%)
            </div>
            <button class="shop-close-btn" on:click={close}>Close Shop</button>
        </div>
    </div>
</div>
{/if}
