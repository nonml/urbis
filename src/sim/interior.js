/**
 * Interior Manager — tracks player interior state
 * Pure sim logic: no Three.js imports.
 */
import { BUILDING_3D } from '../constants.js';

export class InteriorManager {
    constructor(game) {
        this._game = game;
        this.active = false;
        this.templateId = null;
        this.sourceBuilding = null;
        this.entryPosition = null;
    }

    canEnter(buildingType) {
        const def = BUILDING_3D[buildingType];
        return !!def?.doorway;
    }

    getInteriorTemplate(buildingType) {
        const def = BUILDING_3D[buildingType];
        return def?.doorway?.interior ?? null;
    }

    enter(building) {
        if (this.active) return false;
        const template = this.getInteriorTemplate(building.type);
        if (!template) return false;

        this.active = true;
        this.templateId = template;
        this.sourceBuilding = {
            type: building.type,
            x: building.x,
            y: building.y,
        };
        this.entryPosition = {
            x: this._game.player?.x ?? building.x,
            y: this._game.player?.y ?? building.y,
        };
        return true;
    }

    exit() {
        if (!this.active) return false;
        const pos = this.entryPosition;
        this.active = false;
        this.templateId = null;
        this.sourceBuilding = null;
        this.entryPosition = null;
        return pos;
    }

    serialize() {
        return {
            active: this.active,
            templateId: this.templateId,
            sourceBuilding: this.sourceBuilding,
            entryPosition: this.entryPosition,
        };
    }

    deserialize(data) {
        if (!data) return;
        this.active = data.active ?? false;
        this.templateId = data.templateId ?? null;
        this.sourceBuilding = data.sourceBuilding ?? null;
        this.entryPosition = data.entryPosition ?? null;
    }
}
