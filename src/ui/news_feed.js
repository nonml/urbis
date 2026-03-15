// News Feed UI Panel - Tier 2B
// Data/logic layer. Rendering is handled by NewsFeedPanel.svelte.

import { newsFeedStore } from '../stores/news_feed.js';

export class NewsFeedPanel {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
    }

    open() {
        this.isOpen = true;
        this._sync();
        newsFeedStore.update(s => ({ ...s, open: true }));
    }

    close() {
        this.isOpen = false;
        newsFeedStore.update(s => ({ ...s, open: false }));
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /** Push latest items from game.newsFeed into the store. */
    update() {
        if (!this.isOpen) return;
        this._sync();
    }

    _sync() {
        const items = this.game.newsFeed?.items ?? [];
        newsFeedStore.update(s => ({ ...s, items: [...items] }));
    }

    // Legacy compat — these are no-ops now; Svelte handles DOM
    createUI()  { return null; }
    mount()     {}
}
