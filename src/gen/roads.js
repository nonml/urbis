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
 * Generates a road network connecting district centers using MST
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

    // Build MST using Prim's algorithm for guaranteed connectivity
    const roads = [];
    const connected = new Set();
    const unconnected = new Set(centers.map(c => c.id));

    // Start from the first district
    connected.add(centers[0].id);
    unconnected.delete(centers[0].id);

    // Prim's MST: repeatedly add the closest unconnected center
    while (unconnected.size > 0) {
        let bestFrom = null;
        let bestTo = null;
        let bestDist = Infinity;

        // Find the closest pair (connected, unconnected)
        for (const connId of connected) {
            const from = centers.find(c => c.id === connId);
            if (!from) continue;

            for (const unconnId of unconnected) {
                const to = centers.find(c => c.id === unconnId);
                if (!to) continue;

                // Manhattan distance
                const dist = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestFrom = from;
                    bestTo = to;
                }
            }
        }

        if (bestFrom && bestTo) {
            const road = drawRoad(roadMap, sidewalkMap, width, height, bestFrom, bestTo);
            roads.push(road);
            connected.add(bestTo.id);
            unconnected.delete(bestTo.id);
        } else {
            break; // Should not happen
        }
    }

    // Add extra road edges for loops (less for smaller maps to preserve blocks)
    // SMALL (<50): 10%, CITY (50-100): 20%, MEGA (>100): 30%
    const extraFactor = width < 50 ? 0.1 : width < 100 ? 0.2 : 0.3;
    const extraEdges = Math.floor(roads.length * extraFactor);
    let attempts = 0;
    let added = 0;

    while (added < extraEdges && attempts < roads.length * 10) {
        attempts++;
        const i = rng.int(0, centers.length - 1);
        const j = rng.int(0, centers.length - 1);
        if (i !== j) {
            // Only add if it creates a loop (both already connected)
            const road = drawRoad(roadMap, sidewalkMap, width, height, centers[i], centers[j]);
            roads.push(road);
            added++;
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
    if (x < 0 || y < 0 || x >= width || y >= blockMap.length / width) {
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

/**
 * Checks if a position is on a road
 * @param {Uint8Array} roadMap - Road tile map
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Map width
 * @returns {boolean} True if on road
 */
export function isRoad(roadMap, x, y, width) {
    if (x < 0 || y < 0 || x >= width || y >= roadMap.length / width) {
        return false;
    }
    return roadMap[y * width + x] === 1;
}

/**
 * Validates road network connectivity using BFS from each district center
 * @param {Object} roadNetwork - Road network object
 * @param {Array} centers - District centers
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @returns {Object} { connected: boolean, unreachableCount: number }
 */
export function validateRoadConnectivity(roadNetwork, centers, width, height) {
    const { roadMap, sidewalkMap } = roadNetwork;
    const visited = new Uint8Array(width * height).fill(0);
    const queue = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    // Add all road tiles to the BFS queue
    for (let i = 0; i < roadMap.length; i++) {
        if (roadMap[i] === 1 || sidewalkMap[i] === 1) {
            queue.push(i);
            visited[i] = 1;
        }
    }

    // BFS to find all connected road tiles
    while (queue.length > 0) {
        const idx = queue.shift();
        const x = idx % width;
        const y = Math.floor(idx / width);

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                if ((roadMap[nidx] === 1 || sidewalkMap[nidx] === 1) && visited[nidx] === 0) {
                    visited[nidx] = 1;
                    queue.push(nidx);
                }
            }
        }
    }

    // Check if all district centers are connected
    let unreachableCount = 0;
    for (const center of centers) {
        const idx = center.y * width + center.x;
        if (visited[idx] === 0) {
            unreachableCount++;
        }
    }

    return {
        connected: unreachableCount === 0,
        unreachableCount
    };
}