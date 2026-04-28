// Minimap module (canvas-based; supports variable map sizes)
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN } from './constants.js';

export class Minimap {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('minimap-canvas');
        this.view = document.getElementById('minimap-view');
        this.dot = document.getElementById('minimap-dot');
        this._dirty = true;

        if (this.canvas) this.setup();
    }

    onWorldRebuilt() {
        this._dirty = true;
    }

    setup() {
        // Click minimap to teleport player
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;

            const mx = Math.floor((px / rect.width) * this.game.map.width);
            const my = Math.floor((py / rect.height) * this.game.map.height);

            this.game.player.x = Math.max(0, Math.min(this.game.map.width - 1, mx));
            this.game.player.y = Math.max(0, Math.min(this.game.map.height - 1, my));
            this.game.ui.setPlayerTile(this.game.player.x, this.game.player.y);
        });

        const resetBtn = document.getElementById('reset-camera');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.game.ui.resetCamera();
            });
        }
    }

    update() {
        if (!this.canvas) return;

        // Redraw terrain only when needed (seed/map change)
        if (this._dirty) {
            if (this._interiorTemplate) {
                this._drawInterior();
            } else {
                this.drawTerrain();
            }
            this._dirty = false;
        }

        // Update player dot
        if (this.dot) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (this.game.player.x / this.game.map.width) * rect.width;
            const y = (this.game.player.y / this.game.map.height) * rect.height;
            this.dot.style.left = `${x}px`;
            this.dot.style.top = `${y}px`;
        }

        // Draw police blips on minimap during pursuit (only when police active)
        const ps = this.game.policeSystem;
        if (ps?.units?.length > 0 && this.canvas) {
            const ctx = this.canvas.getContext('2d');
            const rect = this.canvas.getBoundingClientRect();
            const flash = Math.sin(performance.now() * 0.008) > 0;
            ctx.fillStyle = flash ? '#2255ff' : '#ff2222';
            for (const u of ps.units) {
                if (!u.active) continue;
                const bx = (u.x / this.game.map.width) * rect.width;
                const by = (u.y / this.game.map.height) * rect.height;
                ctx.beginPath();
                ctx.arc(bx, by, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    setInterior(templateId) {
        this._interiorTemplate = templateId;
        this._dirty = true;
    }

    clearInterior() {
        this._interiorTemplate = null;
        this._dirty = true;
    }

    _drawInterior() {
        const ctx = this.canvas.getContext('2d');
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        this.canvas.width = w;
        this.canvas.height = h;

        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, h);

        const margin = 8;
        const rw = w - margin * 2;
        const rh = h - margin * 2;
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(margin, margin, rw, rh);

        ctx.fillStyle = '#444';
        ctx.fillRect(margin + 1, margin + 1, rw - 2, rh - 2);

        ctx.fillStyle = '#88ccff';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this._interiorTemplate || 'interior', w / 2, h / 2 + 3);

        const doorW = rw * 0.2;
        ctx.fillStyle = '#a87';
        ctx.fillRect(w / 2 - doorW / 2, h - margin - 2, doorW, 4);
    }

    drawTerrain() {
        const ctx = this.canvas.getContext('2d');
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        this.canvas.width = w;
        this.canvas.height = h;

        // Downsample terrain for speed (esp. mega maps)
        const sx = this.game.map.width / w;
        const sy = this.game.map.height / h;

        const img = ctx.createImageData(w, h);
        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                const mx = Math.min(this.game.map.width - 1, Math.floor(px * sx));
                const my = Math.min(this.game.map.height - 1, Math.floor(py * sy));
                const t = this.game.map.getTileAt(mx, my);
                const [r, g, b] = terrainRGB(t);
                const i = (py * w + px) * 4;
                img.data[i + 0] = r;
                img.data[i + 1] = g;
                img.data[i + 2] = b;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }
}

function terrainRGB(t) {
    switch (t) {
        case TERRAIN_WATER: return [77, 166, 255];
        case TERRAIN_GRASS: return [102, 205, 170];
        case TERRAIN_FOREST: return [45, 106, 79];
        case TERRAIN_MOUNTAIN: return [139, 69, 19];
        default: return [60, 60, 60];
    }
}
