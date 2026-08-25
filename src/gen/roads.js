// Road network generator - GTA/Watch Dogs hierarchical Manhattan grid
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
 * Generates a real city street grid — not a toy MST.
 * Every city gets a dense Manhattan grid so you see roads even in screenshots.
 * Water/mountain in the core is already flattened by Map, so every grid line
 * lands on buildable land. A ring highway frames the city like GTA.
 * @param {Map} map - Map object with districts
 * @param {number} seed - Random seed
 * @returns {Object} Road network data
 */
export function generateRoads(map, seed) {
    const rng = new RNG(seed);
    const width = map.width;
    const height = map.height;

    const roadMap = new Uint8Array(width * height).fill(0);
    const sidewalkMap = new Uint8Array(width * height).fill(0);
    const roads = [];

    // Spacing tuned so BLOCK count never overflows Uint8 (255 sentinel) and road ratio ~20% (GTA).
    // SMALL 40 -> 8  =>  ~5x5, CITY 96 -> 12 => ~8x8, MEGA 256 -> 18 => 14x14
    const spacing = width < 50 ? 8 : width < 100 ? 12 : 18;
    const avenueEvery = 4; // every 4th line is an avenue (2 tiles wide) — less asphalt

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // GTA city core — roads only where the city is, not the farmland.
    // Outer green stays as suburbs/farmland without streets or parked cars.
    const coreInset = width < 50 ? 6 : width < 100 ? 12 : 22;
    const coreMin = coreInset, coreMaxW = width - coreInset, coreMaxH = height - coreInset;

    // --- Horizontal streets (east-west) ---
    let hIndex = 0;
    for (let baseY = coreMin; baseY < coreMaxH; baseY += spacing) {
        const jitter = rng.int(-1, 1);
        const y0 = clamp(baseY + jitter, coreMin, coreMaxH - 1);
        const isAvenue = (hIndex % avenueEvery) === 0;
        const lanes = isAvenue ? 2 : 1;
        for (let dy = 0; dy < lanes; dy++) {
            const y = clamp(y0 + dy, coreMin, coreMaxH - 1);
            const road = drawAxisRoad(roadMap, sidewalkMap, width, height,
                { x: coreMin, y }, { x: coreMaxW - 1, y }, rng);
            roads.push(road);
        }
        hIndex++;
    }

    // --- Vertical streets (north-south) ---
    let vIndex = 0;
    for (let baseX = coreMin; baseX < coreMaxW; baseX += spacing) {
        const jitter = rng.int(-1, 1);
        const x0 = clamp(baseX + jitter, coreMin, coreMaxW - 1);
        const isAvenue = (vIndex % avenueEvery) === 0;
        const lanes = isAvenue ? 2 : 1;
        for (let dx = 0; dx < lanes; dx++) {
            const x = clamp(x0 + dx, coreMin, coreMaxW - 1);
            const road = drawAxisRoad(roadMap, sidewalkMap, width, height,
                { x, y: coreMin }, { x, y: coreMaxH - 1 }, rng);
            roads.push(road);
        }
        vIndex++;
    }

    // --- Ring highway framing the city core (2-tile thick) ---
    const ringYs = [coreMin, coreMin + 1, coreMaxH - 1, coreMaxH - 2];
    const ringXs = [coreMin, coreMin + 1, coreMaxW - 1, coreMaxW - 2];
    for (const y of ringYs) {
        if (y < 0 || y >= height) continue;
        const r = drawRoad(roadMap, sidewalkMap, width, height, { x: coreMin, y }, { x: coreMaxW - 1, y });
        roads.push(r);
    }
    for (const x of ringXs) {
        if (x < 0 || x >= width) continue;
        const r = drawRoad(roadMap, sidewalkMap, width, height, { x, y: coreMin }, { x, y: coreMaxH - 1 });
        roads.push(r);
    }

    // --- Spur every district center to the nearest grid road (guarantees every district is on the grid) ---
    const centers = map.districts.map(d => ({ x: d.center.x, y: d.center.y, id: d.id }));
    for (const c of centers) {
        if (roadMap[c.y * width + c.x] === 1) continue;
        const nearest = nearestRoadTile(roadMap, width, height, c.x, c.y, 10);
        if (nearest) {
            const r = drawManhattan(roadMap, sidewalkMap, width, height, c, nearest);
            roads.push(r);
        }
    }

    // --- 18% of blocks get a mid-block alley (breaks up 8x8 blocks, Watch Dogs texture) ---
    for (let by = coreMin + spacing / 2 | 0; by < coreMaxH; by += spacing) {
        for (let bx = coreMin + spacing / 2 | 0; bx < coreMaxW; bx += spacing) {
            if (rng.next() > 0.18) continue;
            if (rng.next() < 0.5) {
                const y = clamp(by + rng.int(-1, 1), coreMin, coreMaxH - 1);
                const x0 = clamp(bx - Math.floor(spacing / 2) + 1, coreMin, coreMaxW - 1);
                const x1 = clamp(bx + Math.floor(spacing / 2) - 1, coreMin, coreMaxW - 1);
                const r = drawRoad(roadMap, sidewalkMap, width, height, { x: x0, y }, { x: x1, y });
                roads.push(r);
            } else {
                const x = clamp(bx + rng.int(-1, 1), coreMin, coreMaxW - 1);
                const y0 = clamp(by - Math.floor(spacing / 2) + 1, coreMin, coreMaxH - 1);
                const y1 = clamp(by + Math.floor(spacing / 2) - 1, coreMin, coreMaxH - 1);
                const r = drawRoad(roadMap, sidewalkMap, width, height, { x, y: y0 }, { x, y: y1 });
                roads.push(r);
            }
        }
    }

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
 * Axis road with one subtle 1-tile kink mid-span so the grid feels hand-laid, not laser-perfect.
 */
function drawAxisRoad(roadMap, sidewalkMap, width, height, from, to, rng) {
    // 35% chance of a single kink
    if (rng.next() < 0.35 && Math.abs(to.x - from.x) > 12) {
        const midX = Math.floor((from.x + to.x) / 2) + rng.int(-2, 2);
        const kinkY = from.y + (rng.next() < 0.5 ? 1 : -1);
        const ky = Math.max(2, Math.min(height - 3, kinkY));
        // Only kink if kink keeps roads inside bounds and doesn't create duplicate
        const a = drawRoad(roadMap, sidewalkMap, width, height, from, { x: midX, y: from.y });
        const b = drawRoad(roadMap, sidewalkMap, width, height, { x: midX, y: from.y }, { x: midX, y: ky });
        const c = drawRoad(roadMap, sidewalkMap, width, height, { x: midX, y: ky }, to);
        // Merge
        return {
            from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
            tiles: [...a.tiles, ...b.tiles, ...c.tiles],
            sidewalks: [...a.sidewalks, ...b.sidewalks, ...c.sidewalks]
        };
    }
    if (rng.next() < 0.35 && Math.abs(to.y - from.y) > 12) {
        const midY = Math.floor((from.y + to.y) / 2) + rng.int(-2, 2);
        const kinkX = from.x + (rng.next() < 0.5 ? 1 : -1);
        const kx = Math.max(2, Math.min(width - 3, kinkX));
        const a = drawRoad(roadMap, sidewalkMap, width, height, from, { x: from.x, y: midY });
        const b = drawRoad(roadMap, sidewalkMap, width, height, { x: from.x, y: midY }, { x: kx, y: midY });
        const c = drawRoad(roadMap, sidewalkMap, width, height, { x: kx, y: midY }, to);
        return {
            from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
            tiles: [...a.tiles, ...b.tiles, ...c.tiles],
            sidewalks: [...a.sidewalks, ...b.sidewalks, ...c.sidewalks]
        };
    }
    return drawRoad(roadMap, sidewalkMap, width, height, from, to);
}

function nearestRoadTile(roadMap, width, height, x, y, radius) {
    for (let r = 1; r <= radius; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                if (roadMap[ny * width + nx] === 1) return { x: nx, y: ny };
            }
        }
    }
    return null;
}

function drawManhattan(roadMap, sidewalkMap, width, height, from, to) {
    const mid = { x: to.x, y: from.y };
    const a = drawRoad(roadMap, sidewalkMap, width, height, from, mid);
    const b = drawRoad(roadMap, sidewalkMap, width, height, mid, to);
    return {
        from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
        tiles: [...a.tiles, ...b.tiles],
        sidewalks: [...a.sidewalks, ...b.sidewalks]
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