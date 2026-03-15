<script>
    import { techScreenStore } from '../../stores/tech_screen.js';

    $: s = $techScreenStore;
    $: progressPct = Math.min(100, (s.points / s.maxPoints) * 100);
    function stabilityColor(v) { return v >= 70 ? '#66cdaa' : v >= 40 ? '#f0c808' : '#ff6b6b'; }
    function close() { techScreenStore.update(st => ({ ...st, open: false })); }
</script>

{#if s.open}
<div id="tech-overlay" class="overlay" style="display:flex">
    <div class="overlay-content">
        <div class="victory-icon">🎓</div>
        <h1>Progression &amp; Tech Tree</h1>

        <div class="progress-container" style="margin-bottom:20px">
            <div class="stat-label">Progression Points</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width:{progressPct}%"></div>
            </div>
            <span style="text-align:center;display:block;margin-top:5px">{s.points}/{s.maxPoints}</span>
        </div>

        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label">Completed Cases</div>
                <div class="stat-value">{s.completedCases}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Buildings</div>
                <div class="stat-value">{s.buildings}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Days Survived</div>
                <div class="stat-value">{s.days}</div>
            </div>
        </div>

        <div class="tech-unlocks">
            <h3>Unlocks</h3>
            <div class="tech-unlock-list">
                {#each s.unlocks as u (u.id)}
                <div class="tech-unlock-item" class:unlocked={u.isUnlocked} class:locked={!u.isUnlocked}>
                    <div class="unlock-icon">{u.isUnlocked ? '✅' : '🔒'}</div>
                    <div class="unlock-info">
                        <div class="unlock-name">{u.name}</div>
                        <div class="unlock-desc">{u.description}</div>
                        <div class="unlock-trigger">Requires: {u.trigger}</div>
                    </div>
                </div>
                {/each}
            </div>
        </div>

        <div class="tech-heatmap">
            <h3>District Stability</h3>
            <div class="tech-stability-list">
                {#if s.districts.length === 0}
                <div class="stability-item">No districts generated yet</div>
                {:else}
                {#each s.districts as d (d.id)}
                <div class="stability-item">
                    <div class="stability-name">{d.name}</div>
                    <div class="stability-bar">
                        <div class="stability-fill" style="width:{d.stability}%;background:{stabilityColor(d.stability)}"></div>
                    </div>
                    <span class="stability-value">{d.stability}%</span>
                </div>
                {/each}
                {/if}
            </div>
        </div>

        <button class="btn btn-primary" on:click={close}>Close</button>
    </div>
</div>
{/if}
