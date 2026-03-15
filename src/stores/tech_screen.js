import { writable } from 'svelte/store';

export const techScreenStore = writable({
    open: false,
    points: 0,
    maxPoints: 200,
    completedCases: 0,
    buildings: 0,
    days: 0,
    unlocks: [],   // [{ id, name, description, trigger, isUnlocked }]
    districts: [], // [{ id, name, stability }]
});
