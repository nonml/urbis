import { writable } from 'svelte/store';

export const politicsStore = writable({
    activeTab: 'policies',
    categories: [],   // [{ id, label, policies: [{id, name, description, state, remaining, canEnact, cost, duration}] }]
    appointments: [], // [{ title, description, reputation }]
    enactedCount: 0,
    monthlyCost: 0,
    budget: 0,
});
