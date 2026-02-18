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

    // Get unique blocks
    const blocks = new Set();
    for (let i = 0; i < map.blockMap.length; i++) {
        if (map.blockMap[i] !== 255) {
            blocks.add(map.blockMap[i]);
        }
    }

    // Process each block
    let parcelId = 0;
    for (const blockId of blocks) {
        // Find all tiles in this block
        const blockTiles = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (map.blockMap[y * width + x] === blockId) {
                    blockTiles.push({ x, y });
                }
            }
        }

        if (blockTiles.length === 0) continue;

        // Sort tiles for consistent processing
        blockTiles.sort((a, b) => a.y * width + a.x - (b.y * width + b.x));

        // Create parcels from block tiles
        createParcelsForBlock(map, blockTiles, parcels, parcelMap, blockId, parcelId, rng);
        parcelId += parcels.length; // This will be adjusted
    }

    // Adjust parcel IDs to be sequential
    const parcelMapAdjusted = new Uint16Array(width * height).fill(65535);
    const parcelMapByBlock = {};
    for (let i = 0; i < width * height; i++) {
        if (parcelMap[i] !== 65535) {
            parcelMapAdjusted[i] = i; // Placeholder
        }
    }

    // Renumber parcels sequentially
    const uniqueParcels = new Set(parcels.map(p => p.id));
    const idMap = new Map();
    let newId = 0;
    for (const oldId of uniqueParcels) {
        idMap.set(oldId, newId++);
    }

    for (let i = 0; i < parcels.length; i++) {
        parcels[i].id = idMap.get(parcels[i].id);
        for (const tile of parcels[i].tiles) {
            parcelMapAdjusted[tile.y * width + tile.x] = parcels[i].id;
        }
    }

    return {
        parcels,
        parcelMap: parcelMapAdjusted,
        totalParcels: parcels.length
    };
}

/**
 * Creates parcels from a block's tiles
 * @param {Map} map - Map object
 * @param {Array} blockTiles - Tiles in this block
 * @param {Array} parcels - Output parcels array
 * @param {Uint16Array} parcelMap - Output parcel map
 * @param {number} blockId - Block ID
 * @param {number} startId - Starting parcel ID
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

    // Determine zone type based on district
    const centerTile = blockTiles[Math.floor(blockTiles.length / 2)];
    const districtId = map.getDistrictAt(centerTile.x, centerTile.y);
    const district = map.districts.find(d => d.id === districtId);
    const zoneType = district ? getZoneTypeForDistrict(district.theme) : ZONE_RESIDENTIAL;

    // Slice block into parcels (rectangles aligned to roads)
    // Use a simple approach: divide into strips, then into rectangles
    const stripHeight = Math.max(4, Math.floor((maxY - minY + 1) / 3));
    const stripWidth = Math.max(4, Math.floor((maxX - minX + 1) / 3));

    let parcelId = startId;
    for (let sy = minY; sy <= maxY; sy += stripHeight) {
        for (let sx = minX; sx <= maxX; sx += stripWidth) {
            const ex = Math.min(sx + stripWidth - 1, maxX);
            const ey = Math.min(sy + stripHeight - 1, maxY);

            // Count tiles in this rectangle that belong to the block
            const rectTiles = [];
            for (let y = sy; y <= ey; y++) {
                for (let x = sx; x <= ex; x++) {
                    if (map.blockMap[y * width + x] === blockId) {
                        rectTiles.push({ x, y });
                    }
                }
            }

            if (rectTiles.length >= 4) { // Minimum parcel size
                // Find bounding box of actual tiles
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

                // Mark tiles with parcel ID
                for (const tile of rectTiles) {
                    parcelMap[tile.y * width + tile.x] = parcel.id;
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
    if (x < 0 || y < 0 || x >= width || y < 0 || y >= parcelMap.length / width) {
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