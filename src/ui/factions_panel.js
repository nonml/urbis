import { getRepBand } from '../sim/factions/perks.js';

const ORDER = ['citizens', 'police', 'gangs', 'corp'];

export class FactionsPanel {
    constructor(game) {
        this.game = game;
        this.root = null;
        this.rows = new Map();
        this.changesEl = null;
        this.mount();
    }

    mount() {
        const container = document.getElementById('game-container');
        if (!container) return;
        this.root = document.createElement('div');
        this.root.id = 'factions-panel';
        this.root.className = 'factions-panel';
        this.root.innerHTML = `
            <div class="factions-title">Factions</div>
            <div class="factions-rows"></div>
            <div class="factions-changes" id="factions-changes"></div>
        `;
        container.appendChild(this.root);
        this.changesEl = this.root.querySelector('#factions-changes');
        const rowsRoot = this.root.querySelector('.factions-rows');
        for (const id of ORDER) {
            const row = document.createElement('div');
            row.className = 'f-row';
            row.innerHTML = `
                <span class="f-name">${id}</span>
                <div class="f-bar"><div class="f-fill"></div></div>
                <span class="f-rep">0</span>
                <span class="f-band">neutral</span>
            `;
            rowsRoot.appendChild(row);
            this.rows.set(id, row);
        }
    }

    update() {
        if (!this.root) return;
        const rep = this.game.state.factions?.reputation || {};
        for (const id of ORDER) {
            const value = Number(rep[id] || 0);
            const band = getRepBand(value);
            const row = this.rows.get(id);
            if (!row) continue;
            const fill = row.querySelector('.f-fill');
            const repEl = row.querySelector('.f-rep');
            const bandEl = row.querySelector('.f-band');
            if (fill) fill.style.width = `${((value + 100) / 200) * 100}%`;
            if (repEl) repEl.textContent = `${value}`;
            if (bandEl) bandEl.textContent = band;
            row.dataset.band = band;
        }

        const last = (this.game.state.factions?.recentChanges || []).slice(-3).reverse();
        if (this.changesEl) {
            if (last.length === 0) this.changesEl.textContent = 'No recent changes';
            else this.changesEl.textContent = last.map((c) => `${c.factionId} ${c.delta >= 0 ? '+' : ''}${c.delta} (${c.reason})`).join(' | ');
        }
    }
}
