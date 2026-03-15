<script>
    import { citizenProfileStore } from '../../stores/citizen_profile.js';

    $: s = $citizenProfileStore;

    function needColor(v) {
        if (v >= 70) return '#4caf50';
        if (v >= 40) return '#ff9800';
        return '#f44336';
    }
    function happColor(v) { return needColor(v); }
    const moodColors = { optimistic:'#4caf50', content:'#2196f3', stressed:'#ff9800', desperate:'#f44336' };
    function moodColor(m) { return moodColors[m] || '#9e9e9e'; }
    function qualityLabel(q) {
        if (q >= 60) return 'Quality: Luxury';
        if (q >= 40) return 'Quality: Good';
        if (q >= 20) return 'Quality: Average';
        return 'Quality: Low';
    }
    function close() { citizenProfileStore.update(st => ({ ...st, open: false })); }
</script>

{#if s.open}
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div id="citizen-profile-panel" class="quest-log-panel" on:click|self={close}>
    <div class="quest-log-header">
        <h2>Citizen Profile</h2>
        <button class="quest-log-close" on:click={close}>&times;</button>
    </div>
    <div class="quest-log-content">
        <div class="citizen-overview">
            <div class="citizen-header">
                <div class="citizen-avatar">👤</div>
                <div class="citizen-info">
                    <div class="citizen-name">{s.name}</div>
                    <div class="citizen-meta">{s.meta}</div>
                </div>
            </div>
            <div class="citizen-stats">
                <div class="stat-box">
                    <div class="stat-label">Age</div>
                    <div class="stat-value">{s.age}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Happiness</div>
                    <div class="stat-value" style="color:{happColor(s.happiness)}">{s.happiness}%</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Mood</div>
                    <div class="stat-value" style="color:{moodColor(s.mood)}">{s.mood}</div>
                </div>
            </div>
            <div class="citizen-traits">
                {#each s.traits as trait}
                <span class="trait-tag">{trait.charAt(0).toUpperCase() + trait.slice(1)}</span>
                {/each}
            </div>
        </div>

        <div class="citizen-section">
            <h3>Needs</h3>
            <div class="needs-grid">
                {#each [['Food', s.needs.food], ['Rest', s.needs.rest], ['Safety', s.needs.safety]] as [label, val]}
                <div class="need-item">
                    <div class="need-label">{label}</div>
                    <div class="need-bar">
                        <div class="need-fill" style="width:{val}%;background-color:{needColor(val)}"></div>
                    </div>
                </div>
                {/each}
            </div>
        </div>

        <div class="citizen-section">
            <h3>Employment</h3>
            <div class="employment-info">
                <div class="job-title" style="color:{s.job.status === 'employed' ? '#4caf50' : '#f44336'}">{s.job.title}</div>
                <div class="job-income">Income: {s.job.income}/day</div>
            </div>
        </div>

        <div class="citizen-section">
            <h3>Household</h3>
            <div class="household-info">
                <div class="hh-name">{s.household.name}</div>
                <div class="hh-capacity">Capacity: {s.household.members}/{s.household.capacity}</div>
                <div class="hh-quality">{qualityLabel(s.household.quality)}</div>
            </div>
        </div>

        <div class="citizen-section">
            <h3>Social Connections</h3>
            <div class="connections-list">
                {#if s.connections.length === 0}
                <div class="connection-item">No social connections</div>
                {:else}
                {#each s.connections.slice(0,5) as conn}
                <div class="connection-item">
                    <span class="conn-name">{conn.name}</span>
                    <span class="conn-relationship">{conn.type}</span>
                    <span class="conn-affinity">Affinity: {conn.affinity}</span>
                </div>
                {/each}
                {/if}
            </div>
        </div>

        <div class="citizen-section">
            <h3>Criminal Record</h3>
            <div class="crime-list">
                {#if s.crimeRecord.length === 0}
                <div class="crime-item" style="color:#4caf50">No criminal record</div>
                {:else}
                {#each s.crimeRecord as inc}
                <div class="crime-item">
                    <span class="crime-type">{inc.name}</span>
                    <span class="crime-severity">Severity: {inc.severity}</span>
                    <span class="crime-status">{inc.status}</span>
                </div>
                {/each}
                {/if}
            </div>
        </div>
    </div>
</div>
{/if}
