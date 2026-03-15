<script>
    import { runSummaryStore } from '../../stores/run_summary.js';

    export let onReplay   = null;
    export let onNewRun   = null;
    export let onViewStats = null;

    $: s = $runSummaryStore;
</script>

{#if s.open}
<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000">
    <div class="run-summary">
        <div class="run-summary-header">
            <div class="run-summary-title">{s.win ? 'City Thriving!' : 'City Failed'}</div>
            <div class="run-summary-subtitle">Run ended on Day {s.day}</div>
        </div>

        <div class="run-summary-content">
            <div class="summary-score-card">
                <div class="summary-score-label">Final Score</div>
                <div class="summary-score-value">{s.score.toLocaleString()}</div>
                <div class="summary-score-grade" style="background:{s.grade.color};color:#000">
                    Grade: {s.grade.letter} - {s.grade.label}
                </div>
            </div>

            {#each s.stats as stat}
            <div class="summary-stat-card">
                <div class="summary-stat-label">{stat.label}</div>
                <div class="summary-stat-value" class:primary={stat.isPrimary}>{stat.value}</div>
            </div>
            {/each}

            <div class="summary-details full-width">
                <div class="summary-details-title">Run Details</div>
                <div class="summary-details-grid">
                    {#each s.details as detail}
                    <div class="summary-detail-item">
                        <span>{detail.label}</span>
                        <span style={detail.isHighlighted ? 'color:#4ade80;font-weight:600' : ''}>{detail.value}</span>
                    </div>
                    {/each}
                </div>
            </div>
        </div>

        <div class="run-summary-actions">
            <button class="summary-btn summary-btn-secondary" on:click={() => onReplay?.(s.runData)}>Replay</button>
            <button class="summary-btn summary-btn-primary"   on:click={() => onNewRun?.()}>New Run</button>
            <button class="summary-btn summary-btn-outline"   on:click={() => onViewStats?.()}>Stats</button>
        </div>
    </div>
</div>
{/if}
