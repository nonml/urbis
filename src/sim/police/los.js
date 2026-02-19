// Line-of-sight system for police pursuit
import { eventBus, EVENT_TYPES } from '../events.js';

/**
 * Check if there's line-of-sight between two points
 * Uses raycast through tile grid
 * @param {Object} map - Map object
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @returns {boolean} Has LOS
 */
export function hasLineOfSight(map, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let cx = x1;
    let cy = y1;

    while (true) {
        // Check bounds
        if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) {
            return false;
        }

        // Check for buildings blocking LOS
        const tileType = map.grid?.[cy]?.[cx] ?? 1;
        const building = map.buildings?.find(b =>
            b.x === cx && b.y === cy
        );

        // Buildings block LOS
        if (building) {
            return false;
        }

        // Water blocks LOS
        if (tileType === 0) {
            return false;
        }

        // Check if reached destination
        if (cx === x2 && cy === y2) {
            return true;
        }

        // Bresenham's line algorithm step
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            cx += sx;
        }
        if (e2 < dx) {
            err += dx;
            cy += sy;
        }
    }
}

/**
 * Get visibility score for position
 * @param {Object} map - Map object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} radius - Search radius
 * @returns {number} Visibility score 0-100
 */
export function getVisibilityScore(map, x, y, radius = 20) {
    let visibleTiles = 0;
    let totalTiles = 0;

    const startX = Math.floor(x);
    const startY = Math.floor(y);

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = startX + dx;
            const ny = startY + dy;

            if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;

            totalTiles++;

            // Check if visible (simple check: not behind building)
            const tileType = map.grid?.[ny]?.[nx] ?? 1;
            const building = map.buildings?.find(b =>
                b.x === nx && b.y === ny
            );

            if (tileType !== 0 && !building) {
                visibleTiles++;
            }
        }
    }

    return Math.round((visibleTiles / totalTiles) * 100);
}

/**
 * Check if LOS is broken by distance or obstacles
 * @param {Object} map - Map object
 * @param {number} observerX - Observer X
 * @param {number} observerY - Observer Y
 * @param {number} targetX - Target X
 * @param {number} targetY - Target Y
 * @returns {Object} {broken, reason, distance}
 */
export function checkLOS(map, observerX, observerY, targetX, targetY) {
    const dist = Math.abs(targetX - observerX) + Math.abs(targetY - observerY);

    // Distance check
    if (dist > 60) {
        return { broken: true, reason: 'distance', distance: dist };
    }

    // LOS check
    const hasLOS = hasLineOfSight(map, observerX, observerY, targetX, targetY);
    if (!hasLOS) {
        return { broken: true, reason: 'obstruction', distance: dist };
    }

    return { broken: false, reason: null, distance: dist };
}

/**
 * Get search pattern for lost target
 * @param {Object} map - Map object
 * @param {number} lastX - Last known X
 * @param {number} lastY - Last known Y
 * @param {number} step - Current search step
 * @returns {Object} {x, y} next search position
 */
export function getSearchPattern(map, lastX, lastY, step) {
    // Spiral pattern
    const spiralRadius = Math.min(30, step * 0.8);
    const angle = (step * 0.25) % (Math.PI * 2);

    return {
        x: lastX + Math.cos(angle) * spiralRadius,
        y: lastY + Math.sin(angle) * spiralRadius
    };
}

/**
 * Check if position is near road
 * @param {Object} map - Map object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} maxDist - Max distance to road
 * @returns {boolean} Is near road
 */
export function isNearRoad(map, x, y, maxDist = 5) {
    const startX = Math.floor(x);
    const startY = Math.floor(y);

    for (let dy = -maxDist; dy <= maxDist; dy++) {
        for (let dx = -maxDist; dx <= maxDist; dx++) {
            const nx = startX + dx;
            const ny = startY + dy;

            if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;

            const idx = ny * map.width + nx;
            if (map.roadMap?.[idx] === 1) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Find nearest safe spot to lose pursuit
 * @param {Object} map - Map object
 * @param {number} x - Current X
 * @param {number} y - Current Y
 * @param {number} minDist - Minimum distance from player
 * @returns {Object|null} {x, y} or null
 */
export function findLoseSpot(map, x, y, minDist = 10) {
    const startX = Math.floor(x);
    const startY = Math.floor(y);

    // Search in expanding rings
    for (let dist = minDist; dist <= 30; dist++) {
        for (let dy = -dist; dy <= dist; dy++) {
            for (let dx = -dist; dx <= dist; dx++) {
                if (Math.abs(dx) !== dist && Math.abs(dy) !== dist) continue;

                const nx = startX + dx;
                const ny = startY + dy;

                if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;

                // Must be near road for vehicle
                if (!isNearRoad(map, nx, ny, 2)) continue;

                // Must have LOS to spot but not to player
                const spotToPlayer = checkLOS(map, nx, ny, x, y);
                if (!spotToPlayer.broken) continue;

                return { x: nx, y: ny };
            }
        }
    }

    return null;
}