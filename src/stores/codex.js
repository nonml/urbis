import { writable } from 'svelte/store';

export const codexStore = writable({
    open: false,
    category: 'core',
    search: '',
});
