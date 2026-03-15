import { campaignPanelStore } from '../stores/campaign_panel.js';

export class CampaignPanel {
    constructor(game) {
        this.game = game;
        this.open = false;
        this.lastNewsCount = 0;

        const nf = game.newsFeed;
        if (nf) nf.onNewsAdded = () => this._sync();
        const bs = game.briefingSystem;
        if (bs) bs.onBriefingAdded = () => this._sync();
    }

    toggle(force = null) {
        this.open = force !== null ? force : !this.open;
        if (this.open) this._sync();
        else campaignPanelStore.update(s => ({ ...s, open: false }));
    }

    switchTab(tab) { campaignPanelStore.update(s => ({ ...s, activeTab: tab })); }

    refresh() { this._sync(); }
    update()  { if (this.open) this._sync(); }

    _sync() {
        const nf = this.game.newsFeed;
        const bs = this.game.briefingSystem;
        const camp = this.game.campaign;

        const newsItems  = nf ? (nf.getRecentNews?.(15) ?? nf.items?.slice(-15) ?? []) : [];
        const briefings  = bs ? (bs.getRecentBriefings?.(10) ?? []) : [];

        let activeCase = null;
        let cases      = [];
        if (camp) {
            const ac = camp.getActiveCase?.();
            if (ac) {
                const total  = ac.chapters?.length || 1;
                const cur    = Math.min(ac.currentChapter + 1, total);
                const prog   = Math.min(100, (ac.currentChapter / total) * 100);
                activeCase = { title: ac.title, meta: `${ac.type.replace('_',' ').toUpperCase()} - Chapter ${cur}/${total}`, progress: prog };
            }
            cases = (camp.getCasesByStatus?.('active') ?? []).map(c => ({ id: c.id, type: c.type || '', title: c.title || '', status: c.status || 'active' }));
        }

        campaignPanelStore.set({ open: true, activeTab: 'news', newsItems, briefings, activeCase, cases });
    }

    // Legacy compat
    create()         {}
    setupListeners() {}
    showNewsNotification() { this.game.ui?.showMessage?.('New news available - press C to view', 'normal'); }
    getState()       { return { open: this.open }; }
    setState(s)      { if (s.open) this.toggle(true); }
}
