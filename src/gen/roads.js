// Road network generator - creates roads and block partitioning
import { RNG } from '../rng.js';

// Road tile types
export const TERRAIN_ROAD = 4;
export const TERRAIN_SIDEWALK = 5;
export const TERRAIN_PARK = 6;

export const ROAD_COLORS = {
    [TERRAIN_ROAD]: '#888888',
    [TERRAIN_SIDEWALK]: '#aaaaaa',
    [TERRAIN_PARK]: '#90ee90'
};

/**
 * Generates a road network connecting district centers
 * @param {Map} map - Map object with districts
 * @param {number} seed - Random seed
 * @returns {Object} Road network data
 */
export function generateRoads(map, seed) {
    const rng = new RNG(seed);
    const width = map.width;
    const height = map.height;

    // Initialize road map
    const roadMap = new Uint8Array(width * height).fill(0);
    const sidewalkMap = new Uint8Array(width * height).fill(0);

    // Get district centers
    const centers = map.districts.map(d => ({ x: d.center.x, y: d.center.y, id: d.id }));

    // Build MST-like road network connecting centers
    const roads = [];
    const connected = new Set();
    connected.add(centers[0].id);

    // Sort centers by distance from first to prioritize nearby connections
    centers.sort((a, b) => {
        const distA = Math.abs(a.x - centers[0].x) + Math.abs(a.y - centers[0].y);
        const distB = Math.abs(b.x - centers[0].x) + Math.abs(b.y - centers[0].y);
        return distA - distB;
    });

    // Connect centers in order
    for (let i = 1; i < centers.length; i++) {
        const from = centers[i - 1];
        const to = centers[i];
        const road = drawRoad(roadMap, sidewalkMap, width, height, from, to);
        roads.push(road);
        connected.add(to.id);
    }

    // Add extra road edges for connectivity
    for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
            if (rng.chance(0.3)) { // 30% chance of extra edge
                drawRoad(roadMap, sidewalkMap, width, height, centers[i], centers[j]);
            }
        }
    }

    // Create block map (flood fill ignoring road tiles)
    const blockMap = generateBlocks(roadMap, sidewalkMap, width, height);

    return {
        roadMap,
        sidewalkMap,
        blockMap,
        roads,
        totalRoads: roads.length
    };
}

/**
 * Draws a road between two points using Bresenham-like rasterization
 * @param {Uint8Array} roadMap - Road tile map
 * @param {Uint8Array} sidewalkMap - Sidewalk tile map
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {{x,y}} from - Starting point
 * @param {{x,y}} to - Ending point
 * @returns {Object} Road info
 */
function drawRoad(roadMap, sidewalkMap, width, height, from, to) {
    const roadTiles = [];
    const sidewalkTiles = [];

    let x = from.x;
    let y = from.y;
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    let err = dx - dy;

    // Place road tiles
    while (true) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = y * width + x;
            roadMap[idx] = 1;
            roadTiles.push({ x, y });

            // Add sidewalk around road
            addSidewalk(sidewalkMap, width, height, x, y, sidewalkTiles);
        }

        if (x === to.x && y === to.y) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }

    return {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        tiles: roadTiles,
        sidewalks: sidewalkTiles
    };
}

/**
 * Adds sidewalk tiles around a road tile
 * @param {Uint8Array} sidewalkMap - Sidewalk tile map
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} roadX - Road tile x
 * @param {number} roadY - Road tile y
 * @param {Array} sidewalkTiles - Output array
 */
function addSidewalk(sidewalkMap, width, height, roadX, roadY, sidewalkTiles) {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of directions) {
        const nx = roadX + dx;
        const ny = roadY + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = ny * width + nx;
            if (sidewalkMap[idx] === 0) {
                sidewalkMap[idx] = 1;
                sidewalkTiles.push({ x: nx, y: ny });
            }
        }
    }
}

/**
 * Generates block map by flood-filling areas between roads
 * @param {Uint8Array} roadMap - Road tile map
 * @param {Uint8Array} sidewalkMap - Sidewalk tile map
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @returns {Uint8Array} Block ID map
 */
function generateBlocks(roadMap, sidewalkMap, width, height) {
    const blockMap = new Uint8Array(width * height).fill(255);
    let blockId = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (blockMap[idx] === 255 && roadMap[idx] === 0 && sidewalkMap[idx] === 0) {
                // Flood fill this block
                const queue = [{ x, y }];
                blockMap[idx] = blockId;

                while (queue.length > 0) {
                    const current = queue.shift();
                    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

                    for (const [dx, dy] of directions) {
                        const nx = current.x + dx;
                        const ny = current.y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nidx = ny * width + nx;
                            if (blockMap[nidx] === 255 && roadMap[nidx] === 0 && sidewalkMap[nidx] === 0) {
                                blockMap[nidx] = blockId;
                                queue.push({ x: nx, y: ny });
                            }
                        }
                    }
                }
                blockId++;
            }
        }
    }

    return blockMap;
}

/**
 * Gets block ID at a given position
 * @param {Uint8Array} blockMap - Block map
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Map width
 * @returns {number} Block ID, or -1 if on road/sidewalk
 */
export function getBlockAt(blockMap, x, y, width) {
    if (x < 0 || y < 0 || x >= width || y < 0 || y >= blockMap.length / width) {
        return -1;
    }
    const idx = y * width + x;
    return blockMap[idx];
}

/**
 * Gets road tiles for a road
 * @param {Array} roads - Array of road objects
 * @param {number} roadIndex - Road index
 * @returns {Array} Array of {x, y} tiles
 */
export function getRoadTiles(roads, roadIndex) {
    const road = roads[roadIndex];
    return road ? road.tiles : [];
}

/**
 * Gets sidewalk tiles for a road
 * @param {Array} roads - Array of road objects
 * @param {number} roadIndex - Road index
 * @returns {Array} Array of {x, y} tiles
 */
export function getSidewalkTiles(roads, roadIndex) {
    const road = roads[roadIndex];
    return road ? road.sidewalks : [];
}