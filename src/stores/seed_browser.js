import { writable } from 'svelte/store';

export const seedBrowserStore = writable({
    open: false,
    filter: 'all',
    search: '',
    runs: [],  // [{ seed, days, score, endState, runId }]
    profile: { totalRuns: 0, wins: 0, bestDays: 0 },
});
