import { BUILDING_TYPES } from '../constants.js';
import { buildMenuStore } from '../stores/build_menu.js';

export class BuildMenu {
    constructor(ui) {
        this.ui = ui;
        this.game = ui.game;
        this.opened = true;
        this.selectedType = null;
        this.rotation = 0;
        this.hoverTile = null;
    }

    toggleOpen() {
        this.opened = !this.opened;
        const panel = document.querySelector('.building-panel');
        if (panel) panel.classList.toggle('hidden', !this.opened);
        return this.opened;
    }

    selectType(type) {
        this.selectedType = type;
        this.rotation = 0;
        this._push();
    }

    cancelBuildMode() {
        this.selectedType = null;
        this.rotation = 0;
        this.hoverTile = null;
        this.ui.clearBuildSelection();
        this.ui.renderer3d?.clearBuildGhost();
        this._push();
    }

    rotateCW() {
        if (!this.selectedType) return;
        this.rotation = (this.rotation + 1) % 4;
        this._push();
    }

    rotateCCW() {
        if (!this.selectedType) return;
        this.rotation = (this.rotation + 3) % 4;
        this._push();
    }

    setHoverTile(tile) {
        this.hoverTile = tile;
    }

    updateHUD(preview = null) {
        buildMenuStore.update(s => ({ ...s, preview }));
    }

    _push() {
        buildMenuStore.set({ selectedType: this.selectedType, rotation: this.rotation, preview: null });
    }
}
