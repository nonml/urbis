export class HackList {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.titleEl = null;
        this.rows = [];
        this.maxRows = 8;
        this.mount();
    }

    mount() {
        const root = document.getElementById('game-container');
        if (!root) return;
        this.container = document.createElement('div');
        this.container.id = 'hack-list';
        this.container.className = 'hack-list';
        this.container.innerHTML = `
            <div class="hack-list-title">Scan Nearby (H)</div>
            <div class="hack-list-rows"></div>
        `;
        root.appendChild(this.container);
        this.titleEl = this.container.querySelector('.hack-list-title');
        const rowsRoot = this.container.querySelector('.hack-list-rows');
        for (let i = 0; i < this.maxRows; i++) {
            const row = document.createElement('div');
            row.className = 'hack-row';
            rowsRoot.appendChild(row);
            this.rows.push(row);
        }
    }

    setVisible(visible) {
        if (!this.container) return;
        this.container.classList.toggle('hidden', !visible);
    }

    update(nodes, selectedId = null) {
        if (!this.container) return;
        const list = nodes || [];
        for (let i = 0; i < this.rows.length; i++) {
            const row = this.rows[i];
            const node = list[i];
            if (!node) {
                row.textContent = '';
                row.classList.remove('active');
                continue;
            }
            const dist = Math.round(node.distance || 0);
            row.textContent = `${node.icon || '•'} ${node.name} [S${node.securityLevel}] ${node.ownerFaction} (${dist}m)`;
            row.classList.toggle('active', node.id === selectedId);
        }
    }
}

