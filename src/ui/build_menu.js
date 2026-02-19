import { BUILDING_TYPES } from '../constants.js';

export class BuildMenu {
    constructor(ui) {
        this.ui = ui;
        this.game = ui.game;
        this.opened = true;
        this.selectedType = null;
        this.rotation = 0;
        this.hoverTile = null;
        this.hud = null;
        this.ensureHUD();
        this.updateHUD();
    }

    ensureHUD() {
        const panel = document.querySelector('.sidebar-header');
        if (!panel) return;
        this.hud = document.createElement('div');
        this.hud.id = 'build-mode-hud';
        this.hud.className = 'build-mode-hud';
        panel.appendChild(this.hud);
    }

    toggleOpen() {
        this.opened = !this.opened;
        const panel = document.querySelector('.building-panel');
        if (panel) panel.classList.toggle('hidden', !this.opened);
        this.updateHUD();
        return this.opened;
    }

    selectType(type) {
        this.selectedType = type;
        this.rotation = 0;
        this.updateHUD();
    }

    cancelBuildMode() {
        this.selectedType = null;
        this.rotation = 0;
        this.hoverTile = null;
        this.ui.clearBuildSelection();
        this.ui.renderer3d.clearBuildGhost();
        this.updateHUD();
    }

    rotateCW() {
        if (!this.selectedType) return;
        this.rotation = (this.rotation + 1) % 4;
        this.updateHUD();
    }

    rotateCCW() {
        if (!this.selectedType) return;
        this.rotation = (this.rotation + 3) % 4;
        this.updateHUD();
    }

    setHoverTile(tile) {
        this.hoverTile = tile;
        this.updateHUD();
    }

    updateHUD(preview = null) {
        if (!this.hud) return;
        if (!this.selectedType) {
            this.hud.textContent = 'Build: Off (B to toggle panel)';
            return;
        }

        const def = BUILDING_TYPES[this.selectedType];
        const rot = this.rotation * 90;
        const upkeep = def?.upkeep || 0;
        const cost = def?.cost || {};
        const costParts = [];
        if (cost.gold) costParts.push(`💰${cost.gold}`);
        if (cost.wood) costParts.push(`🌲${cost.wood}`);
        if (cost.food) costParts.push(`🌾${cost.food}`);
        let line = `${def?.name || this.selectedType} | Rot ${rot}deg | Upkeep ${upkeep}`;
        if (costParts.length) line += ` | Cost ${costParts.join(' ')}`;
        if (preview && !preview.ok) line += ` | ${preview.reason}`;
        this.hud.textContent = line;
    }
}
