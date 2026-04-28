// District generator - creates neighborhood identity and layout
import { RNG } from '../rng.js';

// District naming templates by theme
const DISTRICT_NAMES = {
    residential: ['Greenfield', 'Oakwood', 'Springhill', 'Willow Creek', 'Meadowridge',
                  'Hillside', 'Brookview', 'Pine Hollow', 'Sunset Hills', 'Clearwater'],
    commercial: ['Marketplace', 'Trade District', 'Central Plaza', 'Shop Row', 'Bazar',
                 'Commerce Center', 'Market Square', 'Trading Post', 'Merchant Quarter', 'Exchange'],
    industrial: ['Ironworks', 'Steelworks', 'Foundry', 'Smelter', 'Powerhouse',
                 'Works District', 'Factory Zone', 'Mills', 'Iron Hill', 'Coke City'],
    waterfront: ['Harbor', 'Docks', 'Wharf', 'Seaport', 'Maritime Quarter',
                 'Bayfront', 'Portside', 'Fisherman\'s Wharf', 'Shipping District', 'Coastal'],
    elite: ['Manor Hills', 'Estate District', 'Garden Quarter', 'Park Avenue', 'Grand Estates',
            'Highland Heights', 'Victoria Heights', 'Noble Gardens', 'Ridgeview', 'Crestwood'],
    docks: ['Cargo Bay', 'Crane Yard', 'Container Port', 'Dry Dock', 'Freight Terminal',
            'Loading Pier', 'Shipbreaker Row', 'Anchor Point', 'Warehouse Row', 'Tidal Basin'],
    suburbs: ['Maple Lane', 'Cherry Blossom', 'Birchwood', 'Cedar Park', 'Elm Court',
              'Rosewood', 'Lakeside', 'Sunnyvale', 'Plum Valley', 'Aspen Grove'],
    oldtown: ['Old Quarter', 'Heritage Row', 'Cobblestone Lane', 'Bell Tower District', 'Market Alley',
              'Clock Square', 'Lantern Street', 'Chapel Hill', 'Guild Row', 'Founder\'s Walk'],
};

const DISTRICT_THEMES = Object.keys(DISTRICT_NAMES);

/**
 * Generates districts for the map using optimized flood-fill from seed centers
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} seed - Random seed
 * @param {number} districtCount - Number of districts to generate
 * @returns {Object} District generation result with districts array and districtMap
 */
export function generateDistricts(width, height, seed, districtCount = 3) {
    const rng = new RNG(seed);
    const districts = [];
    const districtMap = new Uint8Array(width * height).fill(255); // 255 = unassigned
    const totalTiles = width * height;
    const minSize = Math.max(3, Math.floor(totalTiles * 0.03)); // 3% minimum per spec

    // Pick district centers - spread evenly across map
    const centers = [];
    const centerGrid = Math.ceil(Math.sqrt(districtCount));
    const cellWidth = Math.floor(width / centerGrid);
    const cellHeight = Math.floor(height / centerGrid);

    for (let i = 0; i < districtCount; i++) {
        const gridX = i % centerGrid;
        const gridY = Math.floor(i / centerGrid);

        let centerX, centerY;
        let attempts = 0;
        do {
            // Place centers in the center of their grid cell
            const baseX = gridX * cellWidth + Math.floor(cellWidth / 2);
            const baseY = gridY * cellHeight + Math.floor(cellHeight / 2);

            // Add some random offset within the cell
            centerX = Math.max(2, Math.min(width - 3, baseX + rng.int(-3, 3)));
            centerY = Math.max(2, Math.min(height - 3, baseY + rng.int(-3, 3)));
            attempts++;
        } while (attempts < 100 && districtMap[centerY * width + centerX] !== 255);
        centers.push({ x: centerX, y: centerY, id: i });
        districtMap[centerY * width + centerX] = i;
    }

    // Multi-source BFS flood-fill with balanced growth
    // Using separate queues per district for O(1) access
    const queues = centers.map(c => [c]);
    const districtSizes = new Int32Array(districtCount).fill(1);
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const completed = new Uint8Array(districtCount).fill(0); // 0 = active, 1 = completed

    // Pre-compute maximum size per district (35% of map)
    const maxSize = Math.floor(totalTiles * 0.35);

    // Track tiles per district for fast lookup
    const districtTiles = centers.map(c => [c]);

    // Process all queues in round-robin fashion for balanced growth
    let activeCount = districtCount;
    let totalAssigned = districtCount;

    while (activeCount > 0 && totalAssigned < totalTiles) {
        let progressMade = false;

        for (let i = 0; i < districtCount; i++) {
            if (completed[i]) continue;
            if (queues[i].length === 0) continue;
            if (districtSizes[i] >= maxSize) {
                completed[i] = 1;
                activeCount--;
                continue;
            }

            // Process a batch of tiles for this district
            const batchSize = Math.max(5, Math.floor(totalTiles / districtCount / 20));
            let processed = 0;

            while (queues[i].length > 0 && processed < batchSize && districtSizes[i] < maxSize) {
                const current = queues[i].shift();
                const cx = current.x;
                const cy = current.y;

                // Shuffle directions for organic shapes
                const shuffledDirs = directions.slice();
                for (let d = shuffledDirs.length - 1; d > 0; d--) {
                    const j = rng.int(0, d);
                    [shuffledDirs[d], shuffledDirs[j]] = [shuffledDirs[j], shuffledDirs[d]];
                }

                for (const [dx, dy] of shuffledDirs) {
                    const nx = cx + dx;
                    const ny = cy + dy;

                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const idx = ny * width + nx;
                        if (districtMap[idx] === 255) {
                            districtMap[idx] = i;
                            districtSizes[i]++;
                            totalAssigned++;
                            queues[i].push({ x: nx, y: ny });
                            districtTiles[i].push({ x: nx, y: ny });
                            processed++;
                            progressMade = true;

                            // Early exit if we've assigned all tiles
                            if (totalAssigned >= totalTiles) break;
                        }
                    }
                }
                if (totalAssigned >= totalTiles) break;
            }

            // Check if this district is done growing
            if (queues[i].length === 0 || districtSizes[i] >= maxSize) {
                completed[i] = 1;
                activeCount--;
            }

            if (totalAssigned >= totalTiles) break;
        }

        // Safety: if no progress after a full round, break
        if (!progressMade && totalAssigned < totalTiles) {
            // Force fill remaining tiles with nearest district
            break;
        }
    }

    // Fill remaining unassigned tiles with nearest district (guarantees full coverage)
    let changed = true;
    let safety = 0;
    while (changed && safety < 100) {
        changed = false;
        safety++;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (districtMap[idx] === 255) {
                    // Find nearest assigned neighbor
                    for (const [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nidx = ny * width + nx;
                            if (districtMap[nidx] !== 255) {
                                districtMap[idx] = districtMap[nidx];
                                districtSizes[districtMap[nidx]]++;
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // Assign themes and names
    const themeAssignments = [];
    for (let i = 0; i < districtCount; i++) {
        const theme = DISTRICT_THEMES[i % DISTRICT_THEMES.length];
        const nameList = DISTRICT_NAMES[theme];
        const name = nameList[i % nameList.length];
        themeAssignments.push({ theme, name });
    }

    // Compute district stats (centers, bounds, etc.)
    const sumX = new Float32Array(districtCount).fill(0);
    const sumY = new Float32Array(districtCount).fill(0);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const districtId = districtMap[y * width + x];
            if (districtId < districtCount) {
                sumX[districtId] += x;
                sumY[districtId] += y;
            }
        }
    }

    // Update districts array with final data
    for (let i = 0; i < districtCount; i++) {
        const { theme, name } = themeAssignments[i];
        const area = districtSizes[i];

        districts.push({
            id: i,
            name,
            theme,
            bounds: {
                minX: width, maxX: 0, minY: height, maxY: 0
            },
            center: {
                x: area > 0 ? Math.floor(sumX[i] / area) : Math.floor(width / 2),
                y: area > 0 ? Math.floor(sumY[i] / area) : Math.floor(height / 2)
            },
            area,
            densityTarget: Math.max(1, Math.floor(area / 20)), // Target buildings per district
            securityLevel: rng.int(1, 5), // 1-5 scale for security
            poiBudget: Math.max(1, Math.floor(area / 500)), // POI budget per district
            bias: {
                crimeBias: rng.float(-0.3, 0.3),
                wealthBias: rng.float(-0.4, 0.4),
                eventBias: rng.float(-0.2, 0.2)
            },
            buildingPools: getBuildingPools(theme),
            tiles: districtTiles[i]
        });

        // Update bounds
        for (const tile of districtTiles[i]) {
            if (tile.x < districts[i].bounds.minX) districts[i].bounds.minX = tile.x;
            if (tile.x > districts[i].bounds.maxX) districts[i].bounds.maxX = tile.x;
            if (tile.y < districts[i].bounds.minY) districts[i].bounds.minY = tile.y;
            if (tile.y > districts[i].bounds.maxY) districts[i].bounds.maxY = tile.y;
        }
    }

    return { districts, districtMap };
}

/**
 * Gets building types allowed in a district based on theme
 * @param {string} theme - District theme
 * @returns {Array} List of building type strings
 */
function getBuildingPools(theme) {
    const pools = {
        residential: ['house', 'farm', 'school', 'town-hall'],
        commercial: ['market', 'warehouse', 'town-hall', 'school'],
        industrial: ['lumber-mill', 'warehouse', 'town-hall'],
        waterfront: ['market', 'warehouse', 'town-hall', 'farm'],
        elite: ['house', 'market', 'town-hall', 'school'],
        docks: ['warehouse', 'port', 'market', 'lumber-mill'],
        suburbs: ['house', 'farm', 'school', 'park'],
        oldtown: ['house', 'market', 'library', 'museum', 'restaurant'],
    };
    return pools[theme] || ['house', 'farm', 'market', 'warehouse', 'town-hall'];
}

/**
 * Gets the district ID at a given tile position
 * @param {Uint8Array} districtMap - District assignment map
 * @param {number} x - Tile x coordinate
 * @param {number} y - Tile y coordinate
 * @param {number} width - Map width
 * @returns {number} District ID, or -1 if out of bounds
 */
export function getDistrictAt(districtMap, x, y, width) {
    if (x < 0 || y < 0 || x >= width || y >= districtMap.length / width) {
        return -1;
    }
    return districtMap[y * width + x];
}

/**
 * Gets district name by ID
 * @param {Array} districts - Array of district objects
 * @param {number} districtId - District ID
 * @returns {string} District name
 */
export function getDistrictName(districts, districtId) {
    const d = districts.find(d => d.id === districtId);
    return d ? d.name : 'Unknown';
}

/**
 * Validates district contiguity using BFS
 * @param {Uint8Array} districtMap - District assignment map
 * @param {number} districtId - District ID to validate
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @returns {Object} { contiguous: boolean, tileCount: number, expectedCount: number }
 */
export function validateDistrictContiguity(districtMap, districtId, width, height) {
    // Count tiles for this district
    let tileCount = 0;
    for (let i = 0; i < districtMap.length; i++) {
        if (districtMap[i] === districtId) tileCount++;
    }

    if (tileCount === 0) return { contiguous: true, tileCount: 0, expectedCount: 0 };

    // BFS to check contiguity
    const visited = new Uint8Array(districtMap.length).fill(0);
    const queue = [];
    let foundStart = false;

    // Find first tile of this district
    for (let i = 0; i < districtMap.length; i++) {
        if (districtMap[i] === districtId) {
            queue.push(i);
            visited[i] = 1;
            foundStart = true;
            break;
        }
    }

    if (!foundStart) return { contiguous: true, tileCount: 0, expectedCount: 0 };

    let connectedCount = 0;
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (queue.length > 0) {
        const idx = queue.shift();
        connectedCount++;

        const x = idx % width;
        const y = Math.floor(idx / width);

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                if (districtMap[nidx] === districtId && visited[nidx] === 0) {
                    visited[nidx] = 1;
                    queue.push(nidx);
                }
            }
        }
    }

    return {
        contiguous: connectedCount === tileCount,
        tileCount,
        expectedCount: tileCount
    };
}