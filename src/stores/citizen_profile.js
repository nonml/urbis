import { writable } from 'svelte/store';

export const citizenProfileStore = writable({
    open: false,
    citizenId: null,
    name: '',
    meta: '',
    age: 0,
    happiness: 0,
    mood: '',
    traits: [],
    needs: { food: 100, rest: 100, safety: 100 },
    job: { title: 'Unemployed', income: 0, status: 'unemployed' },
    household: { name: 'No household', capacity: 0, members: 0, quality: 0 },
    connections: [],  // [{ id, type, affinity, name }]
    crimeRecord: [],  // [{ name, severity, status }]
});
