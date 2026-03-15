import { writable } from 'svelte/store';

export const shopStore = writable({
    open: false,
    activeTab: 'buildings',
    profile: { unlockedCount: 0, totalCount: 0, totalRuns: 0, wins: 0, winRate: 0 },
    tabs: [
        { id: 'buildings', label: 'Buildings', icon: '🏢' },
        { id: 'mutators',  label: 'Mutators',  icon: '⚙️' },
        { id: 'modes',     label: 'Modes',     icon: '🎮' },
        { id: 'ui',        label: 'UI Features',icon: '🎨' },
    ],
    items: [],  // [{ category, key, name, description, cost, isUnlocked, isPurchasable }]
});
