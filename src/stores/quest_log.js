import { writable } from 'svelte/store';

export const questLogStore = writable({
    open: false,
    quests: [],        // [{ id, title, status, progress, totalSteps, completedSteps, currentStep, clues, waypoint }]
    selectedId: null,
});
