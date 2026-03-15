import { writable } from 'svelte/store';

export const buildMenuStore = writable({
    selectedType: null,
    rotation: 0,
    preview: null,   // { ok: bool, reason: string } | null
});
