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
};

const DISTRICT_THEMES = Object.keys(DISTRICT_NAMES);

/**
 * Generates districts for the map using flood-fill from seed centers
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} seed - Random seed
 * @param {number} districtCount - Number of districts to generate
 * @returns {Array} Array of district objects
 */
export function generateDistricts(width, height, seed, districtCount = 3) {
    const rng = new RNG(seed);
    const districts = [];
    const districtMap = new Uint8Array(width * height).fill(255); // 255 = unassigned

    // Pick district centers - avoid water tiles
    const centers = [];
    for (let i = 0; i < districtCount; i++) {
        let centerX, centerY;
        let attempts = 0;
        do {
            centerX = rng.int(2, width - 3);
            centerY = rng.int(2, height - 3);
            attempts++;
        } while (attempts < 100 && districtMap[centerY * width + centerX] !== 255);
        centers.push({ x: centerX, y: centerY, id: i });
        districtMap[centerY * width + centerX] = i;
    }

    // Multi-source BFS flood-fill
    let queue = [...centers];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (queue.length > 0) {
        const current = queue.shift();
        const cx = current.x;
        const cy = current.y;
        const currentId = current.id;

        for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const idx = ny * width + nx;
                if (districtMap[idx] === 255) {
                    districtMap[idx] = currentId;
                    queue.push({ x: nx, y: ny, id: currentId });
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

    // Compute district stats
    for (let i = 0; i < districtCount; i++) {
        const { theme, name } = themeAssignments[i];
        let area = 0;
        let waterCount = 0;
        let grassCount = 0;
        let forestCount = 0;
        let mountainCount = 0;
        let sumX = 0;
        let sumY = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (districtMap[y * width + x] === i) {
                    area++;
                    sumX += x;
                    sumY += y;
                    // Store terrain in the district for later use
                    // We'll store this in a separate terrain map - for now just count
                }
            }
        }

        districts.push({
            id: i,
            name,
            theme,
            bounds: {
                minX: width, maxX: 0, minY: height, maxY: 0
            },
            center: { x: Math.floor(sumX / area), y: Math.floor(sumY / area) },
            area,
            densityTarget: Math.floor(area / 20), // Target buildings per district
            bias: {
                crimeBias: rng.float(-0.3, 0.3),
                wealthBias: rng.float(-0.4, 0.4),
                eventBias: rng.float(-0.2, 0.2)
            },
            buildingPools: getBuildingPools(theme),
            tiles: [] // Will be populated later
        });
    }

    // Populate tile lists and bounds
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const districtId = districtMap[y * width + x];
            if (districtId < districts.length) {
                const d = districts[districtId];
                d.tiles.push({ x, y });
                if (x < d.bounds.minX) d.bounds.minX = x;
                if (x > d.bounds.maxX) d.bounds.maxX = x;
                if (y < d.bounds.minY) d.bounds.minY = y;
                if (y > d.bounds.maxY) d.bounds.maxY = y;
            }
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
        elite: ['house', 'market', 'town-hall', 'school']
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
    if (x < 0 || y < 0 || x >= width || y < 0 || y >= districtMap.length / width) {
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