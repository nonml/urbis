import { profileManager } from '../sim/persistence/profile.js';
import { seedBrowserStore } from '../stores/seed_browser.js';

export class ReplayManager {
    constructor(game) { this.game = game; }
    startReplay(run) {
        const seed = parseInt(run.seed, 10);
        if (!isNaN(seed)) this.game.restart?.({ seed });
    }
}

export class SeedBrowserUI {
    constructor(game) {
        this.game = game;
        this.isShowing = false;
        this.replayManager = new ReplayManager(game);
    }

    show() {
        this.isShowing = true;
        this._sync();
    }

    hide() {
        this.isShowing = false;
        seedBrowserStore.update(s => ({ ...s, open: false }));
    }

    _sync() {
        const prof = profileManager.profile ?? {};
        const runs = (prof.runHistory ?? []).map(r => ({
            seed:     r.seed,
            days:     r.days ?? 0,
            score:    r.score ?? 0,
            endState: r.endState ?? 'lose',
            runId:    r.runId ?? '',
        }));
        const profileData = profileManager.getProfileData?.() ?? {};
        seedBrowserStore.set({
            open: true,
            filter: 'all',
            search: '',
            runs,
            profile: {
                totalRuns: profileData.totalRuns ?? 0,
                wins:      profileData.wins ?? 0,
                bestDays:  profileData.stats?.bestDayReached ?? 0,
            },
        });
    }

    handleNewSeed() {
        const seed = this.game?.rng?.int?.(1, 2147483647) ?? Math.floor(Math.random() * 2147483647);
        this.game.restart?.({ seed });
        this.hide();
    }

    handlePlaySeed(seed) {
        this.game.restart?.({ seed });
        this.hide();
    }

    handleReplay(run) {
        this.replayManager.startReplay(run);
        this.hide();
    }

    // Legacy compat
    insertStyles()    {}
    setupEventListeners() {}
}

export function createSeedBrowser(game) { return new SeedBrowserUI(game); }
