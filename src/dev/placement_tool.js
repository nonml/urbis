// Placement Tool v1 (P-03)
// In-game tools for placing landmarks, intel sources, quest markers
// Exports JSON for content creation

import { RNG } from '../rng.js';

// Placement modes
const MODES = {
    LANDMARK: 'landmark',
    INTEL_SOURCE: 'intel_source',
    QUEST_MARKER: 'quest_marker',
    POLICE_STATION: 'police_station',
    FIRE_STATION: 'fire_station',
    BUILDING: 'building'
};

/**
 * Placement Tool - Developer helper for world authoring
 */
export class PlacementTool {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.mode = null;
        this.placedItems = [];
        this.previewItem = null;

        // Keybinding
        this.keyHandler = null;
    }

    /**
     * Enable placement tool
     */
    enable() {
        this.enabled = true;
        this.setupKeybindings();
        this.showMessage('Placement tool enabled. Press P to toggle mode.', 'normal');
    }

    /**
     * Disable placement tool
     */
    disable() {
        this.enabled = false;
        this.clearKeybindings();
        this.clearPreview();
        this.showMessage('Placement tool disabled', 'normal');
    }

    /**
     * Toggle placement mode
     */
    toggleMode() {
        const modes = Object.values(MODES);
        const currentIdx = this.mode ? modes.indexOf(this.mode) : -1;
        const nextIdx = (currentIdx + 1) % modes.length;
        this.mode = modes[nextIdx];

        this.showMessage(`Placement mode: ${this.mode}`, 'normal');
        this.clearPreview();
    }

    /**
     * Set placement mode
     */
    setMode(mode) {
        if (!Object.values(MODES).includes(mode)) {
            this.showMessage(`Unknown mode: ${mode}`, 'error');
            return;
        }
        this.mode = mode;
        this.clearPreview();
        this.showMessage(`Placement mode: ${mode}`, 'normal');
    }

    /**
     * Place an item at current cursor position
     */
    placeItem() {
        if (!this.mode) {
            this.showMessage('No placement mode selected', 'error');
            return;
        }

        const cursorPos = this.getCursorPosition();
        if (!cursorPos) {
            this.showMessage('Could not determine cursor position', 'error');
            return;
        }

        const item = this.createItem(cursorPos.x, cursorPos.y);
        if (item) {
            this.placedItems.push(item);
            this.showMessage(`Placed: ${item.name || item.id}`, 'success');
            this.clearPreview();
        }
    }

    /**
     * Create item based on current mode
     */
    createItem(x, y) {
        const id = this.generateId(this.mode);
        let item;

        switch (this.mode) {
            case MODES.LANDMARK:
                item = {
                    id: id,
                    type: 'landmark',
                    name: `Landmark ${this.placedItems.length + 1}`,
                    x: x,
                    y: y,
                    districtId: this.getDistrictAt(x, y)
                };
                break;

            case MODES.INTEL_SOURCE:
                item = {
                    id: id,
                    type: 'intel_source',
                    name: `Intel Source ${this.placedItems.length + 1}`,
                    x: x,
                    y: y,
                    sourceType: 'camera',
                    coverageRadius: 15,
                    districtId: this.getDistrictAt(x, y)
                };
                break;

            case MODES.QUEST_MARKER:
                item = {
                    id: id,
                    type: 'quest_marker',
                    name: `Quest Marker ${this.placedItems.length + 1}`,
                    x: x,
                    y: y,
                    districtId: this.getDistrictAt(x, y)
                };
                break;

            case MODES.POLICE_STATION:
                item = {
                    id: id,
                    type: 'building',
                    name: 'Police Station',
                    buildingType: 'police_station',
                    x: x,
                    y: y,
                    districtId: this.getDistrictAt(x, y)
                };
                break;

            case MODES.FIRE_STATION:
                item = {
                    id: id,
                    type: 'building',
                    name: 'Fire Station',
                    buildingType: 'fire_station',
                    x: x,
                    y: y,
                    districtId: this.getDistrictAt(x, y)
                };
                break;

            case MODES.BUILDING:
                item = {
                    id: id,
                    type: 'building',
                    name: `Building ${this.placedItems.length + 1}`,
                    buildingType: 'house',
                    x: x,
                    y: y,
                    districtId: this.getDistrictAt(x, y)
                };
                break;

            default:
                return null;
        }

        return item;
    }

    /**
     * Get current cursor/tile position
     */
    getCursorPosition() {
        const ui = this.game.ui;
        if (!ui) return null;

        // Use the tile under cursor or player position
        const tile = ui.renderer3d?.pickedTile;
        if (tile) {
            return { x: tile.x, y: tile.y };
        }

        const player = this.game.state.player;
        if (player) {
            return { x: Math.floor(player.x), y: Math.floor(player.y) };
        }

        return null;
    }

    /**
     * Get district at position
     */
    getDistrictAt(x, y) {
        const districts = this.game.map.districts || [];
        for (const district of districts) {
            if (district.center) {
                const dx = Math.abs(district.center.x - x);
                const dy = Math.abs(district.center.y - y);
                if (dx <= 10 && dy <= 10) {
                    return district.id;
                }
            }
        }
        return null;
    }

    /**
     * Generate unique ID
     */
    generateId(prefix) {
        const suffix = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${suffix}`;
    }

    /**
     * Export placed items to clipboard
     */
    exportToClipboard() {
        const json = JSON.stringify(this.placedItems, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            this.showMessage(`Exported ${this.placedItems.length} items to clipboard`, 'success');
        }).catch(() => {
            this.showMessage('Failed to copy to clipboard', 'error');
        });
    }

    /**
     * Export placed items to download
     */
    exportToFile(filename = 'placed_items.json') {
        const json = JSON.stringify(this.placedItems, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage(`Exported ${this.placedItems.length} items to ${filename}`, 'success');
    }

    /**
     * Clear all placed items
     */
    clearItems() {
        this.placedItems = [];
        this.clearPreview();
        this.showMessage('Cleared all placed items', 'normal');
    }

    /**
     * Clear preview item
     */
    clearPreview() {
        this.previewItem = null;
        if (this.game.ui && this.game.ui.renderer3d) {
            this.game.ui.renderer3d._placementPreview = null;
        }
    }

    /**
     * Show debug message
     */
    showMessage(message, type = 'normal') {
        console.log(`[PlacementTool] ${message}`);
        if (this.game.ui) {
            this.game.ui.showMessage(`[PLACEMENT] ${message}`, type);
        }
    }

    /**
     * Setup keybindings
     */
    setupKeybindings() {
        // P: Toggle placement mode
        this.keyHandler = (e) => {
            if (!this.enabled) return;
            if (e.key.toLowerCase() === 'p') {
                this.toggleMode();
            } else if (e.key === 'Enter') {
                this.placeItem();
            } else if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
                this.exportToClipboard();
            } else if (e.key.toLowerCase() === 's' && e.ctrlKey) {
                this.exportToFile();
            } else if (e.key === 'Escape') {
                this.clearPreview();
            }
        };

        window.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Clear keybindings
     */
    clearKeybindings() {
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    }

    /**
     * Update placement preview
     */
    updatePreview() {
        if (!this.enabled || !this.mode) return;

        const pos = this.getCursorPosition();
        if (!pos) return;

        const item = this.createItem(pos.x, pos.y);
        this.previewItem = item;

        // Show preview in renderer
        if (this.game.ui && this.game.ui.renderer3d) {
            this.game.ui.renderer3d._placementPreview = item;
        }
    }

    /**
     * Get all placed items
     */
    getItems() {
        return this.placedItems;
    }

    /**
     * Check if placement tool is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }
}

/**
 * Create placement tool instance
 */
export function createPlacementTool(game) {
    return new PlacementTool(game);
}