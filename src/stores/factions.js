import { writable } from 'svelte/store';

export const factionsStore = writable({
    rows: [],          // [{ id, value, band }]
    recentChanges: [], // last few changes
});
