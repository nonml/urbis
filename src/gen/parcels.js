// Parcels generator - divides blocks into rectangular parcels for building placement
import { RNG } from '../rng.js';

// Zone types for parcels
export const ZONE_RESIDENTIAL = 'residential';
export const ZONE_COMMERCIAL = 'commercial';
export const ZONE_INDUSTRIAL = 'industrial';
export const ZONE_PARK = 'park';

export const ZONE_COLORS = {
    [ZONE_RESIDENTIAL]: '#ffcc80',
    [ZONE_COMMERCIAL]: '#e0f7fa',
    [ZONE_INDUSTRIAL]: '#cfd8dc',
    [ZONE_PARK]: '#81c784'
};

/**
 * Generates parcels within each block
 * @param {Map} map - Map object with districts and roads
 * @param {number} seed - Random seed
 * @returns {Object} Parcels data
 */
export function generateParcels(map, seed) {
    const rng = new RNG(seed);
    const width = map.width;
    const height = map.height;
    const parcels = [];
    const parcelMap = new Uint16Array(width * height).fill(65535); // 65535 = no parcel

    // Get unique blocks efficiently
    const blockTilesMap = new Map(); // blockId -> tiles[]
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const blockId = map.blockMap[idx];
            // Only include tiles that are in a valid block (not road/sidewalk/water)
            if (blockId !== 255 && map.roadMap[idx] === 0 && map.sidewalkMap[idx] === 0) {
                const terrain = map.grid[y][x];
                if (terrain !== 0) { // Not water
                    if (!blockTilesMap.has(blockId)) {
                        blockTilesMap.set(blockId, []);
                    }
                    blockTilesMap.get(blockId).push({ x, y });
                }
            }
        }
    }

    // Process each block
    let parcelId = 0;
    for (const [blockId, blockTiles] of blockTilesMap) {
        if (blockTiles.length === 0) continue;

        // Sort tiles for consistent processing
        blockTiles.sort((a, b) => a.y * width + a.x - (b.y * width + b.x));

        // Create parcels from block tiles
        createParcelsForBlock(map, blockTiles, parcels, parcelMap, blockId, parcelId, rng);
    }

    // Renumber parcels sequentially
    const parcelMapAdjusted = new Uint16Array(width * height).fill(65535);

    // Rebuild parcels with sequential IDs
    const parcelsRebuilt = [];
    for (const parcel of parcels) {
        parcelsRebuilt.push({
            id: parcelsRebuilt.length,
            x: parcel.x,
            y: parcel.y,
            w: parcel.w,
            h: parcel.h,
            blockId: parcel.blockId,
            zoneType: parcel.zoneType,
            tiles: parcel.tiles,
            reserved: parcel.reserved,
            buildingId: parcel.buildingId
        });
        for (const tile of parcel.tiles) {
            parcelMapAdjusted[tile.y * width + tile.x] = parcelsRebuilt.length - 1;
        }
    }

    return {
        parcels: parcelsRebuilt,
        parcelMap: parcelMapAdjusted,
        totalParcels: parcelsRebuilt.length
    };
}

/**
 * Creates parcels from a block's tiles using simplified approach
 * @param {Map} map - Map object
 * @param {Array} blockTiles - Tiles in this block
 * @param {Array} parcels - Output parcels array
 * @param {Uint16Array} parcelMap - Output parcel map
 * @param {number} blockId - Block ID
 * @param {number} startId - Starting parcel ID (not used after renumbering)
 * @param {RNG} rng - RNG instance
 */
function createParcelsForBlock(map, blockTiles, parcels, parcelMap, blockId, startId, rng) {
    if (blockTiles.length === 0) return;

    const width = map.width;
    const height = map.height;

    // Find bounding box of block
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (const tile of blockTiles) {
        minX = Math.min(minX, tile.x);
        maxX = Math.max(maxX, tile.x);
        minY = Math.min(minY, tile.y);
        maxY = Math.max(maxY, tile.y);
    }

    // Determine zone type based on district (use center tile)
    const centerTile = blockTiles[Math.floor(blockTiles.length / 2)];
    const districtId = map.getDistrictAt(centerTile.x, centerTile.y);
    const district = map.districts.find(d => d.id === districtId);
    const zoneType = district ? getZoneTypeForDistrict(district.theme) : ZONE_RESIDENTIAL;

    // Create parcels by dividing block into rectangles
    // Minimum parcel size: 6 tiles (per spec)
    const minParcelArea = 6;
    const targetWidth = Math.max(3, Math.floor((maxX - minX + 1) / 3));
    const targetHeight = Math.max(3, Math.floor((maxY - minY + 1) / 3));

    let parcelId = parcels.length;

    // Track which tiles are already assigned
    const assigned = new Uint8Array(width * height).fill(0);
    for (const tile of blockTiles) {
        assigned[tile.y * width + tile.x] = 1;
    }

    // Create rectangular parcels by dividing the block grid
    for (let sy = minY; sy <= maxY; sy += targetHeight) {
        for (let sx = minX; sx <= maxX; sx += targetWidth) {
            const ex = Math.min(sx + targetWidth - 1, maxX);
            const ey = Math.min(sy + targetHeight - 1, maxY);

            // Collect tiles within this rectangle that belong to the block
            const rectTiles = [];
            for (let y = sy; y <= ey; y++) {
                for (let x = sx; x <= ex; x++) {
                    const idx = y * width + x;
                    if (assigned[idx] === 1) {
                        rectTiles.push({ x, y });
                    }
                }
            }

            if (rectTiles.length >= minParcelArea) {
                // Find actual bounds of this parcel
                let rxMin = width, rxMax = 0, ryMin = height, ryMax = 0;
                for (const tile of rectTiles) {
                    rxMin = Math.min(rxMin, tile.x);
                    rxMax = Math.max(rxMax, tile.x);
                    ryMin = Math.min(ryMin, tile.y);
                    ryMax = Math.max(ryMax, tile.y);
                }

                const parcel = {
                    id: parcelId++,
                    x: rxMin,
                    y: ryMin,
                    w: rxMax - rxMin + 1,
                    h: ryMax - ryMin + 1,
                    blockId,
                    zoneType,
                    tiles: rectTiles,
                    reserved: false,
                    buildingId: null
                };
                parcels.push(parcel);

                // Mark tiles as assigned
                for (const tile of rectTiles) {
                    const idx = tile.y * width + tile.x;
                    assigned[idx] = 2; // 2 = assigned to parcel
                }
            }
        }
    }
}

/**
 * Gets zone type for a district theme
 * @param {string} theme - District theme
 * @returns {string} Zone type
 */
function getZoneTypeForDistrict(theme) {
    const zoneMap = {
        residential: ZONE_RESIDENTIAL,
        commercial: ZONE_COMMERCIAL,
        industrial: ZONE_INDUSTRIAL,
        waterfront: ZONE_COMMERCIAL,
        elite: ZONE_RESIDENTIAL
    };
    return zoneMap[theme] || ZONE_RESIDENTIAL;
}

/**
 * Gets parcel at a given position
 * @param {Uint16Array} parcelMap - Parcel map
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Map width
 * @returns {number} Parcel ID, or -1 if no parcel
 */
export function getParcelAt(parcelMap, x, y, width) {
    if (x < 0 || y < 0 || x >= width || y >= parcelMap.length / width) {
        return -1;
    }
    const parcelId = parcelMap[y * width + x];
    return parcelId === 65535 ? -1 : parcelId;
}

/**
 * Gets parcel by ID
 * @param {Array} parcels - Array of parcel objects
 * @param {number} parcelId - Parcel ID
 * @returns {Object|null} Parcel object or null if not found
 */
export function getParcelById(parcels, parcelId) {
    return parcels.find(p => p.id === parcelId) || null;
}

/**
 * Checks if a tile is part of a parcel
 * @param {Uint16Array} parcelMap - Parcel map
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Map width
 * @returns {boolean} True if tile is in a parcel
 */
export function isTileInParcel(parcelMap, x, y, width) {
    const parcelId = getParcelAt(parcelMap, x, y, width);
    return parcelId !== -1;
}

/**
 * Calculates parcelization ratio (non-road land covered by parcels)
 * @param {Map} map - Map object
 * @returns {Object} { ratio: number, covered: number, totalLand: number }
 */
export function calculateParcelizationRatio(map) {
    const width = map.width;
    const height = map.height;

    let totalLand = 0;
    let covered = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            // Count non-road, non-water land
            const terrain = map.grid[y][x];
            const isRoad = map.roadMap[idx] === 1 || map.sidewalkMap[idx] === 1;

            if (terrain !== 0 && !isRoad) { // 0 = water
                totalLand++;
                if (map.parcelMap[idx] !== 65535) {
                    covered++;
                }
            }
        }
    }

    return {
        ratio: totalLand > 0 ? covered / totalLand : 0,
        covered,
        totalLand
    };
}