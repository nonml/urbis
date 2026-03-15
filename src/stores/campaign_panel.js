import { writable } from 'svelte/store';

export const campaignPanelStore = writable({
    open: false,
    activeTab: 'news',
    newsItems: [],    // [{ title, source, tick, description, isImportant, priority }]
    briefings: [],    // [{ title, content, priority }]
    activeCase: null, // { title, meta, progress }
    cases: [],        // [{ id, type, title, status }]
});
