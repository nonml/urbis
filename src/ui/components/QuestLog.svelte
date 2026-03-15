<script>
    import { questLogStore } from '../../stores/quest_log.js';

    export let onComplete = null;
    export let onCancel = null;

    $: s = $questLogStore;
    $: selected = s.quests.find(q => q.id === s.selectedId) ?? null;

    function close() { questLogStore.update(st => ({ ...st, open: false })); }
    function select(id) { questLogStore.update(st => ({ ...st, selectedId: id })); }
</script>

{#if s.open}
<div id="quest-log" class="quest-log-panel">
    <div class="quest-log-header">
        <h2>Quest Log</h2>
        <button class="quest-log-close" on:click={close}>&times;</button>
    </div>
    <div class="quest-log-content">
        <div class="quest-list">
            <h3>Active Cases</h3>
            {#each s.quests as q (q.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="quest-list-item" class:quest-completed={q.status === 'completed'}
                 on:click={() => select(q.id)}>
                <span class="quest-title">{q.title}</span>
                <span class="quest-status">
                    {q.status === 'completed' ? 'Completed' : q.status === 'blocked' ? 'Blocked' : 'In Progress'}
                </span>
            </div>
            {/each}
        </div>
        <div class="quest-details" class:quest-blocked={selected?.status === 'blocked'}>
            {#if selected}
            <h3>{selected.title}{selected.status === 'completed' ? ' (COMPLETED)' : ''}</h3>
            <p class="quest-desc">{selected.description || ''}</p>
            <div>
                <h4>Current Objectives</h4>
                <ul>
                    {#if selected.currentStep}
                    <li>{selected.currentStep}</li>
                    {/if}
                </ul>
            </div>
            <div class="quest-progress">
                <div class="quest-progress-bar">
                    <div class="quest-progress-fill" style="width:{selected.progress}%"></div>
                </div>
                <span class="quest-progress-text">{selected.completedSteps} / {selected.totalSteps} steps</span>
            </div>
            {#if selected.clues?.length > 0}
            <div class="quest-evidence">
                <h4>Evidence Collected</h4>
                <ul>
                    {#each selected.clues as clue}
                    <li>{clue.id.replace('_', ' ').toUpperCase()}</li>
                    {/each}
                </ul>
            </div>
            {/if}
            {#if selected.waypoint}
            <div class="quest-waypoint">
                <p>Next destination: <span>{selected.waypoint.target}</span></p>
                <p>Distance: <span>{selected.waypoint.distance}</span> tiles</p>
            </div>
            {/if}
            {:else}
            <h3>Select a Case</h3>
            {/if}
        </div>
    </div>
    <div class="quest-log-footer">
        <button disabled={!selected || selected.status === 'completed'}
                on:click={() => onComplete?.(selected?.id)}>Mark Complete</button>
        <button disabled={!selected}
                on:click={() => onCancel?.(selected?.id)}>Cancel Quest</button>
    </div>
</div>
{/if}
