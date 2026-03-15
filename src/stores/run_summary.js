import { writable } from 'svelte/store';

export const runSummaryStore = writable({
    open: false,
    win: false,
    day: 0,
    score: 0,
    grade: { letter: 'F', label: 'Run Failed', color: '#f87171' },
    stats: [],    // [{ label, value, isPrimary }]
    details: [],  // [{ label, value, isHighlighted }]
    runData: null,
});
