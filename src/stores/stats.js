import { writable } from 'svelte/store';

/** Reactive store for the stats panel. Updated by UIManager.updateStats(). */
export const statsStore = writable({
    population: 0,
    employmentRate: '0%',
    happiness: '0%',
    housing: '0/0',
    jobProduction: { gold: 0, food: 0, wood: 0 },
    jobDistribution: '',
    economy: null,
    services: null,
    transit: null,
    demand: null,
    intel: null,
    surveillance: null,
    influence: null,
    sentiment: null,
    heat: null,
});
