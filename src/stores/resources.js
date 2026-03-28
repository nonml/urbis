import { writable } from 'svelte/store';

/** Reactive store for the HUD resource bar. Updated by UIManager.updateResources(). */
export const resourceStore = writable({
    gold: 100,
    food: 100,
    wood: 100,
    population: 3,
    housing: 10,
    day: 1,
    heat: 0,
    unaffordable: false, // Flash trigger for insufficient funds
    weather: { icon: '☀️', type: 'clear', speedModifier: 1 },
    rival: { influence: 0, currentAction: null },
});
