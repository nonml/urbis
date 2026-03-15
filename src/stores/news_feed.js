import { writable } from 'svelte/store';

export const newsFeedStore = writable({
    items: [],
    open: false,
    filter: 'all',
});
