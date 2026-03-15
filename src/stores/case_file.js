import { writable } from 'svelte/store';

export const caseFileStore = writable({
    open: false,
    cases: [],    // [{ id, label }]
    selectedId: null,
    selected: null, // { title, meta, objective, suspects, evidence }
});
