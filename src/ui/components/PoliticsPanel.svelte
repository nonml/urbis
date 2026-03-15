<script>
    import { politicsStore } from '../../stores/politics.js';

    export let onEnact = null;
    export let onRevoke = null;

    $: s = $politicsStore;

    function switchTab(tab) {
        politicsStore.update(st => ({ ...st, activeTab: tab }));
    }
</script>

<div id="politics-panel" class="politics-panel">
    <div class="politics-tabs">
        <button class="tab-btn" class:active={s.activeTab === 'policies'}
                on:click={() => switchTab('policies')}>Policies</button>
        <button class="tab-btn" class:active={s.activeTab === 'appointments'}
                on:click={() => switchTab('appointments')}>Appointments</button>
        <button class="tab-btn" class:active={s.activeTab === 'pressure'}
                on:click={() => switchTab('pressure')}>Pressure Map</button>
    </div>

    <div class="politics-content">
        {#if s.activeTab === 'policies'}
        <div class="tab-content policies-tab active">
            <div class="policy-list">
                {#each s.categories as cat (cat.id)}
                <div class="policy-category">
                    <div class="category-title">{cat.label}</div>
                    {#each cat.policies as policy (policy.id)}
                    <div class="policy-row">
                        <div class="policy-info">
                            <span class="policy-name">{policy.name}</span>
                            <span class="policy-desc">{policy.description}</span>
                        </div>
                        {#if policy.enacted}
                        <div class="policy-duration">{policy.remaining} days remaining</div>
                        <button class="policy-btn revoke" on:click={() => onRevoke?.(policy.id)}>Revoke</button>
                        {:else}
                        <div class="policy-cost">
                            <span class="cost">Cost: {policy.cost}g</span>
                            <span class="duration">{policy.duration} days</span>
                        </div>
                        <button class="policy-btn enact" class:enabled={policy.canEnact} class:disabled={!policy.canEnact}
                                on:click={() => policy.canEnact && onEnact?.(policy.id)}>
                            {policy.canEnact ? 'Enact' : 'Too Low Rep'}
                        </button>
                        {/if}
                    </div>
                    {/each}
                </div>
                {/each}
            </div>
        </div>

        {:else if s.activeTab === 'appointments'}
        <div class="tab-content appointments-tab active">
            <div class="appointment-list">
                {#each s.appointments as appt}
                <div class="appointment-row">
                    <div class="appointment-info">
                        <span class="appointment-title">{appt.title}</span>
                        <span class="appointment-desc">{appt.description}</span>
                    </div>
                    <div class="appointment-status">
                        <span class="appointment-rep">Rep: {appt.reputation || 0}</span>
                    </div>
                </div>
                {/each}
            </div>
        </div>

        {:else}
        <div class="tab-content pressure-tab active">
            <div class="pressure-info">Hover over map districts to see pressure levels</div>
        </div>
        {/if}
    </div>

    <div class="politics-status">
        <span>Enacted Policies: {s.enactedCount}</span> |
        <span>Monthly Cost: {s.monthlyCost}g</span> |
        <span>Budget: {s.budget}g</span>
    </div>
</div>
