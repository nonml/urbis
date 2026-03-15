<script>
    import { factionsStore } from '../../stores/factions.js';

    $: rows = $factionsStore.rows;
    $: changes = $factionsStore.recentChanges;

    $: changesText = changes.length === 0
        ? 'No recent changes'
        : changes.map(c => `${c.factionId} ${c.delta >= 0 ? '+' : ''}${c.delta} (${c.reason})`).join(' | ');
</script>

<div id="factions-panel" class="factions-panel">
    <div class="factions-title">Factions</div>
    <div class="factions-rows">
        {#each rows as row (row.id)}
        <div class="f-row" data-band={row.band}>
            <span class="f-name">{row.id}</span>
            <div class="f-bar">
                <div class="f-fill" style="width:{((row.value + 100) / 200) * 100}%"></div>
            </div>
            <span class="f-rep">{row.value}</span>
            <span class="f-band">{row.band}</span>
        </div>
        {/each}
    </div>
    <div class="factions-changes">{changesText}</div>
</div>
