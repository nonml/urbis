import { getRepBand } from '../sim/factions/perks.js';
import { factionsStore } from '../stores/factions.js';

const ORDER = ['citizens', 'police', 'gangs', 'corp'];

export class FactionsPanel {
    constructor(game) {
        this.game = game;
    }

    update() {
        const rep = this.game.state.factions?.reputation || {};
        const rows = ORDER.map(id => ({
            id,
            value: Number(rep[id] || 0),
            band: getRepBand(Number(rep[id] || 0)),
        }));
        const recentChanges = (this.game.state.factions?.recentChanges || []).slice(-3).reverse();
        factionsStore.set({ rows, recentChanges });
    }

    // Legacy compat
    mount() {}
}
