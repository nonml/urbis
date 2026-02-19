// POI spawner v1 - generates landmarks, hack nodes, and safehouses
import { RNG } from '../rng.js';
import { POI_TYPES, POI_TEMPLATES, getTemplatesByType, getRandomTemplateByType, findValidSpawnLocation, getSpacingForType } from '../content/poi_templates.js';

/**
 * POI spawner class
 */
export class POISpawner {
    /**
     * @param {Map} map - Map object
     * @param {number} seed - Random seed
     */
    constructor(map, seed) {
        this.map = map;
        this.rng = new RNG(seed);
        this.pois = [];
        this.nextId = 1;
    }

    /**
     * Spawns POIs for all districts based on budget
     * @returns {Array} Array of spawned POI objects
     */
    spawnAll() {
        this.pois = [];
        this.nextId = 1;

        for (const district of this.map.districts) {
            this.spawnDistrictPOIs(district);
        }

        return this.pois;
    }

    /**
     * Spawns POIs for a single district
     * @param {Object} district - District object
     */
    spawnDistrictPOIs(district) {
        const budget = district.poiBudget;
        const width = this.map.width;

        // Each district gets:
        // - 1 landmark (priority: high)
        // - 2-4 hack nodes (based on budget)
        // - 0-1 safehouse (based on theme)

        // Landmark (1 per district if budget allows)
        if (budget >= 1) {
            const landmarkTemplate = getRandomTemplateByType(POI_TYPES.LANDMARK, this.rng);
            if (landmarkTemplate) {
                const location = findValidSpawnLocation(landmarkTemplate, this.map, district.id, this.rng);
                if (location) {
                    this.spawnPOI(landmarkTemplate, location.x, location.y, district.id);
                }
            }
        }

        // Hack nodes (2-4 based on budget)
        const numHackNodes = Math.min(4, Math.max(2, Math.floor(budget * 1.5)));
        for (let i = 0; i < numHackNodes; i++) {
            const hackTemplate = getRandomTemplateByType(POI_TYPES.HACK_NODE, this.rng);
            if (hackTemplate) {
                const location = findValidSpawnLocation(hackTemplate, this.map, district.id, this.rng, 50);
                if (location) {
                    this.spawnPOI(hackTemplate, location.x, location.y, district.id);
                }
            }
        }

        // Safehouse (0-1 based on theme)
        const hasSafehouse = district.theme === 'residential' || district.theme === 'elite' && this.rng.chance(0.5);
        if (hasSafehouse && budget >= 1) {
            const safehouseTemplate = getRandomTemplateByType(POI_TYPES.SAFEHOUSE, this.rng);
            if (safehouseTemplate) {
                const location = findValidSpawnLocation(safehouseTemplate, this.map, district.id, this.rng, 50);
                if (location) {
                    this.spawnPOI(safehouseTemplate, location.x, location.y, district.id);
                }
            }
        }
    }

    /**
     * Spawns a single POI
     * @param {Object} template - POI template
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} districtId - District ID
     * @returns {Object} Spawned POI object
     */
    spawnPOI(template, x, y, districtId) {
        const poi = {
            id: this.nextId++,
            ...template,
            x,
            y,
            districtId,
            spawnTick: 0,
            interactive: true,
            interactionPrompt: `Interact with ${template.name}`
        };

        this.pois.push(poi);
        return poi;
    }

    /**
     * Gets POI at a specific location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} POI object or null
     */
    getPOIAt(x, y) {
        // Check each POI's area
        for (const poi of this.pois) {
            const { width, height } = poi.size || { width: 1, height: 1 };
            if (x >= poi.x && x < poi.x + width && y >= poi.y && y < poi.y + height) {
                return poi;
            }
        }
        return null;
    }

    /**
     * Gets nearest POI to a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string|null} type - Optional POI type filter
     * @returns {Object|null} Nearest POI or null
     */
    getNearestPOI(x, y, type = null) {
        let nearest = null;
        let minDist = Infinity;

        for (const poi of this.pois) {
            if (type && poi.type !== type) continue;

            const dx = poi.x - x;
            const dy = poi.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearest = poi;
            }
        }

        return nearest;
    }

    /**
     * Gets all POIs in a district
     * @param {number} districtId - District ID
     * @returns {Array} Array of POI objects
     */
    getPOIsInDistrict(districtId) {
        return this.pois.filter(p => p.districtId === districtId);
    }

    /**
     * Gets POI by ID
     * @param {number} id - POI ID
     * @returns {Object|null} POI object or null
     */
    getPOIById(id) {
        return this.pois.find(p => p.id === id) || null;
    }
}

/**
 * Spawns POIs for a map
 * @param {Map} map - Map object
 * @param {number} seed - Random seed
 * @returns {Object} Spawn result with pois array
 */
export function spawnPOIs(map, seed) {
    const spawner = new POISpawner(map, seed);
    const pois = spawner.spawnAll();
    map.pois = pois;
    return { pois, spawner };
}

/**
 * Gets nearest POI to a position
 * @param {Map} map - Map object (with pois array)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string|null} type - Optional POI type filter
 * @returns {Object|null} Nearest POI or null
 */
export function getNearestPOI(map, x, y, type = null) {
    if (!map.pois || map.pois.length === 0) return null;
    return map.pois.find(p => {
        if (type && p.type !== type) return false;
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.sqrt(dx * dx + dy * dy);
    }) || null;
}

/**
 * Gets nearest POI distance to a position
 * @param {Map} map - Map object (with pois array)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Distance in tiles, or -1 if no POIs
 */
export function getNearestPOIDistance(map, x, y) {
    if (!map.pois || map.pois.length === 0) return -1;

    let minDist = Infinity;
    for (const poi of map.pois) {
        const dx = poi.x - x;
        const dy = poi.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) minDist = dist;
    }

    return minDist === Infinity ? -1 : Math.round(minDist);
}