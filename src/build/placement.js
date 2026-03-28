import { BUILDING_TYPES, BUILDING_SECURITY, TERRAIN_WATER } from '../constants.js';

/**
 * Check if the player has insufficient funds for a building cost
 * @param {Object} resources - Player's current resources
 * @param {Object} cost - Building cost requirements
 * @returns {boolean} - True if player lacks required resources
 */
export function checkInsufficientFunds(resources, cost) {
    if (!resources || !cost) return false;
    const hasGold = (cost.gold || 0) <= (resources.gold || 0);
    const hasWood = (cost.wood || 0) <= (resources.wood || 0);
    const hasFood = (cost.food || 0) <= (resources.food || 0);
    return !hasGold || !hasWood || !hasFood;
}

export function validatePlacement(game, type, x, y, rotation = 0) {
    const map = game.map;
    const buildings = game.buildings;
    const resources = game.resources;
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

    const cost = buildingDef.cost || {};
    const insufficientFunds = checkInsufficientFunds(resources, cost);

    return {
        ok: !insufficientFunds,
        warning: insufficientFunds,
        reason: insufficientFunds ? 'Insufficient funds.' : '',
        parcelId,
        rotation: ((rotation % 4) + 4) % 4,
        cost,
        upkeep: buildingDef.upkeep || 0,
    };
}
