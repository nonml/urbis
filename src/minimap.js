// Minimap module (canvas-based; supports variable map sizes)
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN } from './constants.js';
import { ZONE_TYPES } from './sim/zoning/zoning.js';

// Cartographic color palette — design system §Minimap
const COLOR = Object.freeze({
    water:       '#a9c6dd',
    land:        '#c9d3c0',
    forest:      '#9ab89a',
    mountain:    '#b0a898',
    road:        '#8d96a2',
    residential: '#8fc7a0',
    commercial:  '#7fb0d8',
    industrial:  '#e0bd7a',
    player:      '#2f9be0',  // --accent
    viewport:    '#ffffff',
    // interior schematic
    interiorBg:  '#d8dde4',
    interiorWall:'#9aa6b2',
    interiorFloor:'#c5cdd6',
    interiorDoor:'#a89070',
    interiorText:'#4a86c8',
    // police blips
    policeA:     '#4a86c8',  // --info  (calm-flash)
    policeB:     '#df5a5a',  // --danger (alert-flash)
});

// Zone overlay alpha (0–255) — light tint over terrain
const ZONE_ALPHA = 140;

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
            ctx.fillStyle = flash ? COLOR.policeA : COLOR.policeB;
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

        // Neutral schematic background
        ctx.fillStyle = COLOR.interiorBg;
        ctx.fillRect(0, 0, w, h);

        const margin = 8;
        const rw = w - margin * 2;
        const rh = h - margin * 2;

        // Soft wall border — neutral, no neon
        ctx.strokeStyle = COLOR.interiorWall;
        ctx.lineWidth = 2;
        ctx.strokeRect(margin, margin, rw, rh);

        ctx.fillStyle = COLOR.interiorFloor;
        ctx.fillRect(margin + 1, margin + 1, rw - 2, rh - 2);

        // Label
        ctx.fillStyle = COLOR.interiorText;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this._interiorTemplate || 'interior', w / 2, h / 2 + 3);

        // Door indicator
        const doorW = rw * 0.2;
        ctx.fillStyle = COLOR.interiorDoor;
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
                const zone = this.game.zoning?.getZone(mx, my) ?? ZONE_TYPES.NONE;
                const [r, g, b] = _blendZoneOverTerrain(t, zone);
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

// --- helpers ----------------------------------------------------------------

function _hexToRGB(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function _terrainRGB(t) {
    switch (t) {
        case TERRAIN_WATER:    return _hexToRGB(COLOR.water);
        case TERRAIN_GRASS:    return _hexToRGB(COLOR.land);
        case TERRAIN_FOREST:   return _hexToRGB(COLOR.forest);
        case TERRAIN_MOUNTAIN: return _hexToRGB(COLOR.mountain);
        default:               return _hexToRGB(COLOR.land);
    }
}

function _zoneRGB(zone) {
    switch (zone) {
        case ZONE_TYPES.RESIDENTIAL: return _hexToRGB(COLOR.residential);
        case ZONE_TYPES.COMMERCIAL:  return _hexToRGB(COLOR.commercial);
        case ZONE_TYPES.INDUSTRIAL:  return _hexToRGB(COLOR.industrial);
        default:                     return null;
    }
}

// Blend zone color over terrain at ZONE_ALPHA opacity (alpha-composite, 0–255)
function _blendZoneOverTerrain(terrainType, zone) {
    const [tr, tg, tb] = _terrainRGB(terrainType);
    const zoneColor = _zoneRGB(zone);
    if (!zoneColor) return [tr, tg, tb];

    const [zr, zg, zb] = zoneColor;
    const a = ZONE_ALPHA / 255;
    return [
        Math.round(zr * a + tr * (1 - a)),
        Math.round(zg * a + tg * (1 - a)),
        Math.round(zb * a + tb * (1 - a)),
    ];
}
