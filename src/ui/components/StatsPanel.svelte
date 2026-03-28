<script>
    import { statsStore } from '../../stores/stats.js';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';

    const popTween = tweened(0, { duration: 400, easing: cubicOut });

    let stats = {};

    statsStore.subscribe(s => {
        stats = s;
        popTween.set(s.population);
    });

    function demandColor(val) {
        const pct = Math.min(100, Math.round(val * 100));
        return pct < 30 ? '#ff6b6b' : pct < 70 ? '#ffd93d' : '#6bcb77';
    }

    function demandPct(val) {
        return Math.min(100, Math.round(val * 100));
    }

    function sentimentColor(level) {
        if (level === 'highly_positive') return '#6bcb77';
        if (level === 'positive') return '#a8d67b';
        if (level === 'neutral') return '#ffd93d';
        if (level === 'negative') return '#ff9f43';
        return '#ff6b6b';
    }

    function heatColor(state) {
        if (state === 'calm') return '#6bcb77';
        if (state === 'alert') return '#ffd93d';
        if (state === 'search') return '#ff9f43';
        if (state === 'pursuit') return '#ff6b6b';
        return '#c44569';
    }
</script>

<div class="stats-grid">
    <div class="stat-item">
        <div class="stat-label">Citizens</div>
        <div class="stat-value">{Math.round($popTween)}</div>
    </div>
    <div class="stat-item">
        <div class="stat-label">Employment</div>
        <div class="stat-value">{stats.employmentRate}</div>
    </div>
    <div class="stat-item">
        <div class="stat-label">Avg Happiness</div>
        <div class="stat-value">{stats.happiness}</div>
    </div>
    <div class="stat-item">
        <div class="stat-label">Housing</div>
        <div class="stat-value">{stats.housing}</div>
    </div>
</div>

<div class="stats-section-title">Job Production</div>
<div class="stats-grid">
    <div class="stat-item">
        <div class="stat-label">Gold/Day</div>
        <div class="stat-value">{stats.jobProduction?.gold ?? 0}</div>
    </div>
    <div class="stat-item">
        <div class="stat-label">Food/Day</div>
        <div class="stat-value">{stats.jobProduction?.food ?? 0}</div>
    </div>
    <div class="stat-item">
        <div class="stat-label">Wood/Day</div>
        <div class="stat-value">{stats.jobProduction?.wood ?? 0}</div>
    </div>
</div>

<div class="stat-item full-width">
    <div class="stat-label">Job Distribution</div>
    <div class="stat-value" style="text-align: left;">{stats.jobDistribution || 'No employed citizens'}</div>
</div>

{#if stats.economy}
<div class="stat-item full-width">
    <div class="stat-label">Economy (last tick)</div>
    <div class="stat-value">{stats.economy.gold}</div>
    <div class="stat-value">{stats.economy.food}</div>
    <div class="stat-value">{stats.economy.wood}</div>
</div>
{/if}

{#if stats.services}
<div class="stat-item full-width">
    <div class="stat-label">Services</div>
    <div class="stat-value" class:brownout={stats.services.brownout}>{stats.services.powerText}</div>
</div>
{/if}

{#if stats.transit}
<div class="stat-item full-width">
    <div class="stat-label">Transit</div>
    <div class="stat-value">Mobility +{stats.transit.mobility}% | Coverage {stats.transit.coverage}% | Congestion -{stats.transit.congestion}% | Routes {stats.transit.busRoutes} | Toll ${stats.transit.tollRevenue}/day</div>
</div>
{/if}

{#if stats.demand}
<div class="stat-item full-width">
    <div class="stat-label">Demand (R/C/I)</div>
    <div class="demand-row">
        <span>Residential</span>
        <span style="color: {demandColor(stats.demand.residential)}; font-weight: 600;">{demandPct(stats.demand.residential)}%</span>
    </div>
    <div class="demand-row">
        <span>Commercial</span>
        <span style="color: {demandColor(stats.demand.commercial)}; font-weight: 600;">{demandPct(stats.demand.commercial)}%</span>
    </div>
    <div class="demand-row">
        <span>Industrial</span>
        <span style="color: {demandColor(stats.demand.industrial)}; font-weight: 600;">{demandPct(stats.demand.industrial)}%</span>
    </div>
</div>
{/if}

{#if stats.intel}
<div class="stat-item full-width">
    <div class="stat-label">Intel Database</div>
    <div class="stat-value">Total entries: {stats.intel.totalEntries}</div>
    <div class="stat-value">Active entries: {stats.intel.activeEntries}</div>
</div>
{/if}

{#if stats.surveillance}
<div class="stat-item full-width">
    <div class="stat-label">Surveillance</div>
    <div class="stat-value">Sources: {stats.surveillance.totalSources}</div>
    <div class="stat-value">Active: {stats.surveillance.activeSources}</div>
</div>
{/if}

{#if stats.influence}
<div class="stat-item full-width">
    <div class="stat-label">Influence</div>
    <div class="stat-value">Score: {Math.round(stats.influence.score)}</div>
    <div class="stat-value">Active operations: {stats.influence.activeCount}</div>
</div>
{/if}

{#if stats.sentiment}
<div class="stat-item full-width">
    <div class="stat-label">Sentiment</div>
    <div class="stat-value">
        <span style="color: {sentimentColor(stats.sentiment.overall.level)}; font-weight: 600;">
            {stats.sentiment.overall.level.toUpperCase()}
        </span>: {Math.round(stats.sentiment.overall.sentiment * 100)}%
    </div>
    <div class="stat-value">Trust (Gov/Police): {Math.round(stats.sentiment.trust.government * 100)}% / {Math.round(stats.sentiment.trust.police * 100)}%</div>
</div>
{/if}

{#if stats.heat}
<div class="stat-item full-width">
    <div class="stat-label">Exposure/Heat</div>
    <div class="stat-value">
        <span style="color: {heatColor(stats.heat.state)}; font-weight: 600;">
            {stats.heat.state.toUpperCase()}
        </span>: {Math.round(stats.heat.heat)}%
    </div>
    <div class="stat-value">Exposure score: {Math.round(stats.heat.exposureScore)}</div>
</div>
{/if}

<style>
    .demand-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
    }
    .brownout {
        color: #ff6b6b !important;
    }
</style>
