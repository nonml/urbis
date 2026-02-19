import { BUILDING_TYPES, BUILDING_SECURITY, TERRAIN_WATER } from '../constants.js';

export function validatePlacement(game, type, x, y, rotation = 0) {
    const map = game.map;
    const buildings = game.buildings;
    const buildingDef = BUILDING_TYPES[type] || BUILDING_SECURITY[type];

    if (!buildingDef) return { ok: false, reason: 'Unknown building type.' };
    if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, reason: 'Invalid build coordinates.' };
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return { ok: false, reason: 'Out of map bounds.' };

    const parcelId = map.getParcelAt?.(x, y);
    if (parcelId === undefined || parcelId === null || parcelId < 0) {
        return { ok: false, reason: 'Must be placed inside a parcel.' };
    }

    const idx = y * map.width + x;
    const terrain = map.getTileAt(x, y);
    if (terrain === TERRAIN_WATER) return { ok: false, reason: 'Cannot build on water.' };
    if (map.roadMap?.[idx] === 1 || map.sidewalkMap?.[idx] === 1) {
        return { ok: false, reason: 'Cannot build on roads or sidewalks.' };
    }

    const occupied = buildings.getBuildingsAt(x, y);
    if (occupied.length > 0) return { ok: false, reason: 'Tile already occupied.' };

    return {
        ok: true,
        reason: '',
        parcelId,
        rotation: ((rotation % 4) + 4) % 4,
        cost: buildingDef.cost || {},
        upkeep: buildingDef.upkeep || 0,
    };
}
