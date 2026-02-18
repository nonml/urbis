// Citizen pathfinding with A* algorithm and caching
import { TERRAIN_WATER } from '../constants.js';

/**
 * Pathfinding result
 */
export class PathResult {
    constructor(path = [], distance = 0) {
        this.path = path;
        this.distance = distance;
        this.success = path.length > 0;
    }
}

/**
 * Simple A* pathfinding on grid
 */
export class Pathfinding {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cache = new Map();
        this.maxCacheSize = 1000;
    }

    /**
     * Find path from (sx, sy) to (tx, ty)
     * @param {Uint8Array|Array} tileGrid - Terrain grid
     * @param {number} sx - Start x
     * @param {number} sy - Start y
     * @param {number} tx - Target x
     * @param {number} ty - Target y
     * @returns {PathResult} Path result
     */
    findPath(tileGrid, sx, sy, tx, ty) {
        // Check if already cached
        const cacheKey = `${sx},${sy}->${tx},${ty}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // A* algorithm
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${sx},${sy}`;
        const targetKey = `${tx},${ty}`;

        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(sx, sy, tx, ty));
        openSet.push({ x: sx, y: sy, f: fScore.get(startKey) });

        while (openSet.length > 0) {
            // Get node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;

            // Check if reached target
            if (current.x === tx && current.y === ty) {
                const path = this.reconstructPath(cameFrom, currentKey);
                const result = new PathResult(path, path.length);
                this.addToCache(cacheKey, result);
                return result;
            }

            closedSet.add(currentKey);

            // Check neighbors
            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];

            for (const neighbor of neighbors) {
                if (neighbor.x < 0 || neighbor.x >= this.width ||
                    neighbor.y < 0 || neighbor.y >= this.height) {
                    continue;
                }

                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                // Check if tile is walkable (not water)
                const tileIndex = neighbor.y * this.width + neighbor.x;
                const terrain = tileGrid[tileIndex];
                if (terrain === TERRAIN_WATER) {
                    continue;
                }

                // Cost is 1 for normal tiles, higher for difficult terrain
                const moveCost = this.getMoveCost(terrain);

                const tentativeG = gScore.get(currentKey) + moveCost;

                if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, currentKey);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor.x, neighbor.y, tx, ty));

                    if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push({ x: neighbor.x, y: neighbor.y, f: fScore.get(neighborKey) });
                    }
                }
            }
        }

        // No path found
        const result = new PathResult();
        this.addToCache(cacheKey, result);
        return result;
    }

    /**
     * Calculate Manhattan distance heuristic
     */
    heuristic(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    /**
     * Get movement cost for terrain
     */
    getMoveCost(terrain) {
        // Road/sidewalk preferred: cost 1
        // Grass: cost 1.5
        // Forest: cost 2
        // Mountain: cost 3
        // Water: not walkable (filtered earlier)
        const costs = {
            0: 999, // Water - not walkable
            1: 1.5, // Grass
            2: 2,   // Forest
            3: 3,   // Mountain
            4: 1,   // Road
            5: 1,   // Sidewalk
            6: 1.5  // Park
        };
        return costs[terrain] || 1.5;
    }

    /**
     * Reconstruct path from cameFrom map
     */
    reconstructPath(cameFrom, currentKey) {
        const path = [];
        let current = currentKey;

        while (cameFrom.has(current)) {
            const [x, y] = current.split(',').map(Number);
            path.unshift({ x, y });
            current = cameFrom.get(current);
        }

        // Add start position
        const [sx, sy] = current.split(',').map(Number);
        path.unshift({ x: sx, y: sy });

        return path;
    }

    /**
     * Add path to cache with LRU eviction
     */
    addToCache(key, result) {
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, result);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }
}

/**
 * Gets next position in path
 */
export function getNextPosition(path, currentIndex) {
    if (!path || path.length <= currentIndex + 1) {
        return null;
    }
    return path[currentIndex + 1];
}