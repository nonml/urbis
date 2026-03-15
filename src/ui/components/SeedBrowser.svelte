<script>
    import { seedBrowserStore } from '../../stores/seed_browser.js';

    export let onReplay = null;
    export let onNewSeed = null;
    export let onPlaySeed = null;

    $: s = $seedBrowserStore;
    $: filtered = s.runs.filter(r => {
        if (s.filter === 'win'  && r.endState !== 'win') return false;
        if (s.filter === 'lose' && r.endState === 'win') return false;
        if (s.search) {
            const q = s.search.toLowerCase();
            if (!String(r.seed).includes(q) && !r.runId?.toLowerCase().includes(q) && !r.endState?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    let inputSeed = '';

    function close() { seedBrowserStore.update(st => ({ ...st, open: false })); }
    function setFilter(f) { seedBrowserStore.update(st => ({ ...st, filter: f })); }
    function scoreClass(score) { return score >= 1000 ? 'high' : score >= 500 ? 'medium' : 'low'; }

    function handlePlay() {
        const v = inputSeed.trim();
        if (!v) return;
        if (v.toLowerCase() === 'random') { onNewSeed?.(); return; }
        const seed = parseInt(v, 10);
        if (!isNaN(seed) && seed > 0) onPlaySeed?.(seed);
        else alert('Please enter a valid positive number seed or "random"');
    }
</script>

{#if s.open}
<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000">
    <div class="seed-browser">
        <div class="seed-browser-header">
            <div>
                <div class="seed-browser-title">Seed Browser</div>
                <div class="seed-browser-subtitle">View past runs and start new ones</div>
            </div>
            <button class="seed-browser-close" on:click={close}>×</button>
        </div>

        <div class="seed-browser-content">
            <div class="seed-input-group">
                <label class="seed-input-label">Or Enter Your Own Seed</label>
                <div class="seed-input-row">
                    <input type="text" class="seed-input" placeholder="Enter seed number or 'random'"
                           bind:value={inputSeed}>
                    <button class="seed-btn" on:click={() => onNewSeed?.()}>New Random Seed</button>
                    <button class="seed-btn" on:click={handlePlay}>Play</button>
                </div>
            </div>

            <div class="seed-list">
                <div class="seed-list-header">
                    <div class="seed-list-title">Recent Runs ({s.runs.length})</div>
                    <div class="seed-filter-group">
                        {#each ['all','win','lose'] as f}
                        <button class="seed-filter-btn" class:active={s.filter === f}
                                on:click={() => setFilter(f)}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                        {/each}
                    </div>
                </div>

                <div>
                    {#if filtered.length === 0}
                    <div class="seed-no-results">
                        <div class="seed-icon">🔍</div>
                        {s.search ? 'No runs match your search.' : 'No runs yet. Start your first city!'}
                    </div>
                    {:else}
                    {#each filtered as run}
                    <div class="seed-item seed-info">
                        <span class="seed-seed-value">{run.seed || 'N/A'}</span>
                        <span class="seed-day-value">Day {run.days}</span>
                        <span class="seed-score-value {scoreClass(run.score)}">Score: {run.score.toLocaleString()}</span>
                        <span class="seed-status-value {run.endState === 'win' ? 'seed-status-win' : 'seed-status-lose'}">
                            {run.endState === 'win' ? 'Win' : 'Loss'}
                        </span>
                        <div class="seed-actions">
                            <button class="seed-action-btn replay" on:click={() => onReplay?.(run)}>▶ Replay</button>
                            <button class="seed-action-btn copy" on:click={() => navigator.clipboard?.writeText?.(String(run.seed))}>📋 Copy</button>
                        </div>
                    </div>
                    {/each}
                    {/if}
                </div>
            </div>
        </div>

        <div class="seed-browser-footer">
            <div class="seed-stats">
                Total Runs: <span>{s.profile.totalRuns}</span> | Wins: <span>{s.profile.wins}</span> | Best Score: <span>{s.profile.bestDays} days</span>
            </div>
            <div class="seed-browser-actions">
                <button class="seed-actions-btn" on:click={() => { seedBrowserStore.update(st => ({ ...st, runs: [] })); }}>Clear History</button>
            </div>
        </div>
    </div>
</div>
{/if}
