import { profileManager, UNLOCK_TREE } from '../sim/persistence/profile.js';
import { shopStore } from '../stores/shop.js';

const TABS = [
    { id: 'buildings', label: 'Buildings', icon: '🏢' },
    { id: 'mutators',  label: 'Mutators',  icon: '⚙️' },
    { id: 'modes',     label: 'Modes',     icon: '🎮' },
    { id: 'ui',        label: 'UI Features',icon: '🎨' },
];

export class ShopUI {
    constructor(game) {
        this.game = game;
        this.isShowing = false;
    }

    show() {
        this.isShowing = true;
        this._sync();
    }

    hide() {
        this.isShowing = false;
        shopStore.update(s => ({ ...s, open: false }));
    }

    unlock(category, key) {
        if (profileManager.unlockMutator(key)) {
            this._sync();
        }
    }

    _sync() {
        const profile = profileManager.getProfileData?.() ?? {};
        const items = [];
        for (const tab of TABS) {
            const tabItems = UNLOCK_TREE[tab.id] ?? {};
            for (const [key, item] of Object.entries(tabItems)) {
                const isUnlocked   = profileManager.isUnlocked?.(tab.id, key) ?? false;
                const isPurchasable = !isUnlocked && (profileManager.canUnlockMutator?.(key) ?? false);
                items.push({ category: tab.id, key, name: item.name, description: item.description, cost: item.cost, isUnlocked, isPurchasable });
            }
        }
        shopStore.set({
            open: true,
            activeTab: 'buildings',
            tabs: TABS,
            profile: {
                unlockedCount: profile.unlockedCount ?? 0,
                totalCount:    profile.totalCount ?? 0,
                totalRuns:     profile.totalRuns ?? 0,
                wins:          profile.wins ?? 0,
                winRate:       profile.winRate ?? 0,
            },
            items,
        });
    }

    // Legacy compat
    insertStyles() {}
}

export function createShop(game) { return new ShopUI(game); }
