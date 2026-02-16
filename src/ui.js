// UI manager for DOM + third-person 3D rendering
import { BUILDING_TYPES } from './constants.js';
import { Renderer3D } from './renderer3d.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.selectedBuilding = null;

        // 3D
        this.renderer3d = new Renderer3D(this.game, this.canvas);

        // Input
        this.keys = new Set();
        this.isRDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Dirty flags
        this._lastBuildingCount = 0;
        this._lastCitizenCount = 0;

        this.setupBuildingPanel();
        this.setupInfoTabs();
        this.setupInput();
        this.setupGlobalShortcuts();
    }

    onWorldRebuilt() {
        this.renderer3d.rebuildWorld();
        this._lastBuildingCount = 0;
        this._lastCitizenCount = 0;
    }

    resetCamera() {
        this.renderer3d.yaw = 0;
        this.renderer3d.pitch = -0.35;
        this.renderer3d.followDist = 7;
        this.renderer3d.followHeight = 4;
    }

    setPlayerTile(x, y) {
        this.game.player.x = Math.max(0, Math.min(this.game.map.width - 1, x));
        this.game.player.y = Math.max(0, Math.min(this.game.map.height - 1, y));
        this.game.player.wx = this.game.player.x + 0.5;
        this.game.player.wz = this.game.player.y + 0.5;
    }

    setupBuildingPanel() {
        const grid = document.getElementById('building-grid');
        if (!grid) return;
        grid.innerHTML = '';

        for (const [key, building] of Object.entries(BUILDING_TYPES)) {
            const card = document.createElement('div');
            card.className = 'building-card';
            card.dataset.type = key;
            card.innerHTML = `
                <div class="building-icon">${building.icon}</div>
                <div class="building-info">
                    <div class="building-name">${building.name}</div>
                    <div class="building-desc">${building.description || ''}</div>
                    <div class="building-cost">
                        ${building.cost.gold ? `<span class="cost-item gold">💰${building.cost.gold}</span>` : ''}
                        ${building.cost.wood ? `<span class="cost-item wood">🌲${building.cost.wood}</span>` : ''}
                        ${building.cost.food ? `<span class="cost-item food">🌾${building.cost.food}</span>` : ''}
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                document.querySelectorAll('.building-card').forEach(o => o.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedBuilding = key;
                this.showMessage(`Selected: ${building.name}`, 'success');
            });
            grid.appendChild(card);
        }
    }

    setupInfoTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.dataset.tab;

                if (tabName === 'stats') {
                    document.getElementById('message-log').classList.add('hidden');
                    document.getElementById('stats-panel').classList.remove('hidden');
                    this.updateStats();
                } else {
                    document.getElementById('message-log').classList.remove('hidden');
                    document.getElementById('stats-panel').classList.add('hidden');
                }
            });
        });
    }

    setupGlobalShortcuts() {
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.game.saveGame();
            }
            if (e.key.toLowerCase() === 'p') {
                this.game.paused = !this.game.paused;
                this.showMessage(this.game.paused ? '⏸️ Paused' : '▶️ Resumed', 'normal');
            }
        });
    }

    setupInput() {
        // Movement keys
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'shift'].includes(k)) this.keys.add(k);
        });
        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            this.keys.delete(k);
        });

        // Right-drag camera orbit
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                this.isRDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.canvas.style.cursor = 'grabbing';
                return;
            }

            // Left click: build/inspect
            if (e.button === 0) {
                const tile = this.renderer3d.pickTile(e.clientX, e.clientY);
                if (!tile) return;

                if (this.selectedBuilding) {
                    this.game.attemptBuild(this.selectedBuilding, tile.x, tile.y);
                    this.renderer3d.markBuildingsDirty();
                } else {
                    this.game.showTileInfo(tile.x, tile.y);
                    this.updateStats();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            this.isRDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isRDragging) return;
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            this.renderer3d.yaw -= dx * 0.005;
            this.renderer3d.pitch -= dy * 0.003;
            this.renderer3d.pitch = Math.max(-1.2, Math.min(-0.1, this.renderer3d.pitch));
        });
    }

    updatePlayerMovement(dtMs) {
        const dt = Math.min(0.05, dtMs / 1000);
        const speed = this.keys.has('shift') ? 5.0 : 3.0; // tiles/sec

        let mx = 0;
        let mz = 0;
        if (this.keys.has('w')) mz -= 1;
        if (this.keys.has('s')) mz += 1;
        if (this.keys.has('a')) mx -= 1;
        if (this.keys.has('d')) mx += 1;

        if (mx === 0 && mz === 0) return;

        // Normalize
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;

        // Camera-relative movement
        const yaw = this.renderer3d.yaw;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        const dx = (mx * cos - mz * sin) * speed * dt;
        const dz = (mx * sin + mz * cos) * speed * dt;

        const nx = this.game.player.wx + dx;
        const nz = this.game.player.wz + dz;

        // Collision against water tiles
        const tx = Math.floor(nx);
        const ty = Math.floor(nz);
        if (tx < 0 || ty < 0 || tx >= this.game.map.width || ty >= this.game.map.height) return;
        const tile = this.game.map.getTileAt(tx, ty);
        if (tile === 0) return; // water

        this.game.player.wx = nx;
        this.game.player.wz = nz;
        this.game.player.x = tx;
        this.game.player.y = ty;
    }

    render(dt) {
        // Rebuild instances when needed
        if (this.game.buildings.buildings.length !== this._lastBuildingCount) {
            this._lastBuildingCount = this.game.buildings.buildings.length;
            this.renderer3d.markBuildingsDirty();
        }
        if (this.game.citizens.citizens.length !== this._lastCitizenCount) {
            this._lastCitizenCount = this.game.citizens.citizens.length;
            this.renderer3d.markCitizensDirty();
        }

        if (!this.game.paused) this.updatePlayerMovement(dt);
        this.renderer3d.render();
    }

    updateResources(resources) {
        document.getElementById('gold-amount').textContent = Math.floor(resources.gold);
        document.getElementById('food-amount').textContent = Math.floor(resources.food);
        document.getElementById('wood-amount').textContent = Math.floor(resources.wood);
        document.getElementById('population-amount').textContent = resources.population;
        document.getElementById('day-amount').textContent = `Day ${resources.day}`;

        // Overcrowding warning
        const popDisplay = document.getElementById('population-display');
        if (resources.population > resources.housing) {
            popDisplay.style.border = '3px solid #ff6b6b';
            popDisplay.style.boxShadow = '0 4px 0 #ff6b6b';
        } else {
            popDisplay.style.border = '3px solid #fff';
            popDisplay.style.boxShadow = '0 4px 0 rgba(0,0,0,0.15)';
        }
    }

    showMessage(message, type = 'normal') {
        const log = document.getElementById('message-log');
        if (!log) return;

        const entry = document.createElement('div');
        entry.className = `message ${type}`;
        const day = this.game.resources.day;
        const dayText = type === 'day-start' ? '' : `[Day ${day}] `;
        entry.innerHTML = `<span class="day-indicator">${dayText}</span>${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;

        if (log.children.length > 80) log.removeChild(log.firstChild);
    }

    updateStats() {
        const citizens = this.game.citizens;
        const stats = document.getElementById('stats-pop');
        const employment = document.getElementById('stats-employment');
        const happiness = document.getElementById('stats-happiness');
        const housing = document.getElementById('stats-housing');

        const jobGold = document.getElementById('stats-job-gold');
        const jobFood = document.getElementById('stats-job-food');
        const jobWood = document.getElementById('stats-job-wood');
        const jobDist = document.getElementById('stats-job-dist');

        if (stats) stats.textContent = citizens.getPopulation();
        if (employment) employment.textContent = citizens.getEmploymentRate() + '%';
        if (happiness) happiness.textContent = citizens.getAverageHappiness() + '%';
        if (housing) housing.textContent = `${this.game.resources.population}/${this.game.resources.housing}`;

        // Job production (last computed tick)
        const jp = this.game.resources.jobProduction || { gold: 0, food: 0, wood: 0 };
        if (jobGold) jobGold.textContent = Math.floor(jp.gold || 0);
        if (jobFood) jobFood.textContent = Math.floor(jp.food || 0);
        if (jobWood) jobWood.textContent = Math.floor(jp.wood || 0);

        // Job distribution
        if (jobDist) {
            const dist = new Map();
            for (const c of citizens.citizens) {
                const j = (c.job || 'unemployed');
                dist.set(j, (dist.get(j) || 0) + 1);
            }
            const employed = Array.from(dist.entries()).filter(([j]) => j !== 'unemployed');
            if (employed.length === 0) {
                jobDist.textContent = 'No employed citizens';
            } else {
                employed.sort((a, b) => b[1] - a[1]);
                jobDist.textContent = employed.map(([j, n]) => `${j}: ${n}`).join(' • ');
            }
        }
    }

    showVictory(condition, progress) {
        const overlay = document.getElementById('victory-overlay');
        const title = document.getElementById('victory-title');
        const message = document.getElementById('victory-message');
        const progressFill = document.getElementById('victory-progress');
        const finalDays = document.getElementById('final-days');
        const finalPop = document.getElementById('final-pop');
        const finalBuildings = document.getElementById('final-buildings');
        const finalGold = document.getElementById('final-gold');
        if (!overlay) return;

        title.textContent = `${condition} Victory!`;
        message.textContent = `You achieved ${condition.toLowerCase()} dominance with ${this.game.resources.population} citizens.`;
        finalDays.textContent = this.game.resources.day;
        finalPop.textContent = this.game.resources.population;
        finalBuildings.textContent = this.game.buildings.buildings.length;
        finalGold.textContent = Math.floor(this.game.resources.gold);
        progressFill.style.width = `${Math.min(100, progress)}%`;
        overlay.classList.remove('hidden');
    }

    showCrisis(crisis, options, onPick) {
        const overlay = document.getElementById('crisis-overlay');
        const title = document.getElementById('crisis-title');
        const desc = document.getElementById('crisis-desc');
        const list = document.getElementById('crisis-options');
        if (!overlay || !title || !desc || !list) return;

        title.textContent = crisis.name;
        desc.textContent = `Choose your response. (Seed: ${this.game.seed})`;
        list.innerHTML = '';

        for (const opt of options) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = formatOption(opt);
            btn.addEventListener('click', () => {
                overlay.classList.add('hidden');
                onPick(opt);
            });
            list.appendChild(btn);
        }

        overlay.classList.remove('hidden');
    }
}

function formatOption(opt) {
    const parts = [opt.label];
    const cost = opt.cost || {};
    const costParts = [];
    if (cost.gold) costParts.push(`💰${cost.gold}`);
    if (cost.wood) costParts.push(`🌲${cost.wood}`);
    if (cost.food) costParts.push(`🌾${cost.food}`);
    if (costParts.length) parts.push(`(Cost: ${costParts.join(' ')})`);
    return parts.join(' ');
}
