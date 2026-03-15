<script>
    import { caseFileStore } from '../../stores/case_file.js';

    $: s = $caseFileStore;

    function close() { caseFileStore.update(st => ({ ...st, open: false })); }
    function select(id) { caseFileStore.update(st => ({ ...st, selectedId: id })); }
</script>

{#if s.open}
<div id="case-file-panel" class="quest-log-panel" style="display:block">
    <div class="quest-log-header">
        <h2>Case Files</h2>
        <button class="quest-log-close" on:click={close}>&times;</button>
    </div>
    <div class="quest-log-content">
        <div class="quest-list">
            <h3>Active Cases</h3>
            {#each s.cases as c (c.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="quest-list-item" class:selected={s.selectedId === c.id} on:click={() => select(c.id)}>
                {c.label}
            </div>
            {/each}
        </div>
        <div class="quest-details">
            {#if s.selected}
            <h3>{s.selected.title}</h3>
            <p class="quest-desc">{s.selected.meta}</p>
            <h4>Objectives</h4>
            <ul><li>{s.selected.objective}</li></ul>
            <h4>Suspects</h4>
            <ul>
                {#each s.selected.suspects as sus}
                <li>{sus.name} (risk {sus.risk})</li>
                {/each}
            </ul>
            <h4>Evidence Board</h4>
            <ul>
                {#each s.selected.evidence as ev}
                <li>{ev.clueId} [{ev.type}]</li>
                {/each}
            </ul>
            {:else}
            <h3>Select a Case</h3>
            {/if}
        </div>
    </div>
</div>
{/if}
