// Road query system - helper functions for road-based vehicle operations

/**
 * Find nearest road tile from position
 * @param {Object} map - Map object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} maxDistance - Maximum search radius
 * @returns {Object|null} {x, y} or null if not found
 */
export function findNearestRoad(map, x, y, maxDistance = 20) {
    const startX = Math.floor(x);
    const startY = Math.floor(y);

    for (let dist = 1; dist <= maxDistance; dist++) {
        // Search ring at distance
        for (let dx = -dist; dx <= dist; dx++) {
            for (let dy = -dist; dy <= dist; dy++) {
                // Only check edge of ring
                if (Math.abs(dx) !== dist && Math.abs(dy) !== dist) continue;

                const nx = startX + dx;
                const ny = startY + dy;

                if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;

                const idx = ny * map.width + nx;
                if (map.roadMap?.[idx] === 1) {
                    return { x: nx, y: ny };
                }
            }
        }
    }

    return null;
}

/**
 * Get road heading at position (direction of road flow)
 * @param {Object} map - Map object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {number} Heading in degrees (0-360)
 */
export function getRoadHeading(map, x, y) {
    const startX = Math.floor(x);
    const startY = Math.floor(y);

    // Check adjacent tiles for road
    const directions = [
        { dx: 1, dy: 0, angle: 90 },   // East
        { dx: -1, dy: 0, angle: 270 },  // West
        { dx: 0, dy: 1, angle: 180 },   // South
        { dx: 0, dy: -1, angle: 0 }     // North
    ];

    const idx = startY * map.width + startX;

    for (const dir of directions) {
        const nx = startX + dir.dx;
        const ny = startY + dir.dy;

        if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height) {
            const nIdx = ny * map.width + nx;
            if (map.roadMap?.[nIdx] === 1) {
                return dir.angle;
            }
        }
    }

    // No adjacent road found, return 0
    return 0;
}

/**
 * Find spawn points on roads around center
 * @param {Object} map - Map object
 * @param {number} centerX - Center X
 * @param {number} centerY - Center Y
 * @param {number} radius - Search radius
 * @param {number} count - Number of points to return
 * @returns {Array} Array of {x, y} points
 */
export function findRoadSpawnPoints(map, centerX, centerY, radius, count) {
    const points = [];
    const visited = new Set();

    const startX = Math.floor(centerX);
    const startY = Math.floor(centerY);

    for (let dist = 1; dist <= radius; dist++) {
        for (let dx = -dist; dx <= dist; dx++) {
            for (let dy = -dist; dy <= dist; dy++) {
                if (Math.abs(dx) !== dist && Math.abs(dy) !== dist) continue;

                const nx = startX + dx;
                const ny = startY + dy;

                if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;

                const idx = ny * map.width + nx;
                if (map.roadMap?.[idx] === 1) {
                    const key = `${nx},${ny}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        points.push({ x: nx, y: ny });
                        if (points.length >= count) return points;
                    }
                }
            }
        }
    }

    return points;
}

/**
 * Check if road segment is clear for spawning
 * @param {Object} map - Map object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} length - Length of road to check
 * @param {string} direction - 'horizontal' or 'vertical'
 * @returns {boolean} Is clear
 */
export function isRoadSegmentClear(map, x, y, length, direction) {
    const startX = Math.floor(x);
    const startY = Math.floor(y);

    for (let i = 0; i < length; i++) {
        const nx = direction === 'horizontal' ? startX + i : startX;
        const ny = direction === 'vertical' ? startY + i : startY;

        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;

        const idx = ny * map.width + nx;
        if (map.roadMap?.[idx] !== 1) return false;
    }

    return true;
}