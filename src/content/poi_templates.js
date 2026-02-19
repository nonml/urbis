// POI templates - defines all types of Points of Interest
// POI types: landmark, hack_node, safehouse, camera_tower, terminal_hub

export const POI_TYPES = {
    LANDMARK: 'landmark',
    HACK_NODE: 'hack_node',
    SAFEHOUSE: 'safehouse',
    CAMERA_TOWER: 'camera_tower',
    TERMINAL_HUB: 'terminal_hub'
};

export const POI_TEMPLATES = {
    // Landmarks - prominent city features
    landmark_tower: {
        id: 'landmark_tower',
        name: 'City Tower',
        description: 'A towering landmark that dominates the skyline.',
        type: POI_TYPES.LANDMARK,
        size: { width: 5, height: 5 },
        attributes: {
            visible_from_distance: true,
            visual_impact: 'high',
            district_prestige: 10
        },
        spawn_rules: {
            min_district_size: 100,
            avoid_water: true,
            avoid_roads: true,
            priority: 'high'
        }
    },
    landmark_plaza: {
        id: 'landmark_plaza',
        name: 'Central Plaza',
        description: 'A spacious public plaza with fountains and seating.',
        type: POI_TYPES.LANDMARK,
        size: { width: 7, height: 7 },
        attributes: {
            visible_from_distance: true,
            visual_impact: 'medium',
            district_prestige: 5
        },
        spawn_rules: {
            min_district_size: 80,
            avoid_water: true,
            avoid_roads: true,
            priority: 'medium'
        }
    },

    // Hack nodes - hacking infrastructure
    hack_node_terminal: {
        id: 'hack_node_terminal',
        name: 'Data Terminal',
        description: 'A public terminal with network access.',
        type: POI_TYPES.HACK_NODE,
        size: { width: 2, height: 2 },
        attributes: {
            hacking_difficulty: 3,
            data_level: 2,
            security: 1
        },
        spawn_rules: {
            min_district_size: 20,
            avoid_water: true,
            avoid_roads: false,
            priority: 'high'
        }
    },
    hack_node_server: {
        id: 'hack_node_server',
        name: 'Server Node',
        description: 'A hidden server rack with sensitive data.',
        type: POI_TYPES.HACK_NODE,
        size: { width: 3, height: 3 },
        attributes: {
            hacking_difficulty: 5,
            data_level: 4,
            security: 3
        },
        spawn_rules: {
            min_district_size: 30,
            avoid_water: true,
            avoid_roads: true,
            priority: 'medium'
        }
    },

    // Safehouses - player safe havens
    safehouse_apartment: {
        id: 'safehouse_apartment',
        name: 'Safe Apartment',
        description: 'A secure apartment for the player.',
        type: POI_TYPES.SAFEHOUSE,
        size: { width: 4, height: 4 },
        attributes: {
            security_level: 5,
            storage_capacity: 10,
            repair_facilities: true
        },
        spawn_rules: {
            min_district_size: 40,
            avoid_water: true,
            avoid_roads: false,
            priority: 'low'
        }
    },

    // Camera towers - surveillance
    camera_tower: {
        id: 'camera_tower',
        name: 'Surveillance Tower',
        description: 'A tall tower with surveillance cameras.',
        type: POI_TYPES.CAMERA_TOWER,
        size: { width: 3, height: 3 },
        attributes: {
            view_radius: 15,
            security_level: 4,
            detection_bonus: 2
        },
        spawn_rules: {
            min_district_size: 25,
            avoid_water: true,
            avoid_roads: true,
            priority: 'medium'
        }
    },

    // Terminal hubs - major data access points
    terminal_hub: {
        id: 'terminal_hub',
        name: 'Network Hub',
        description: 'A major network access hub.',
        type: POI_TYPES.TERMINAL_HUB,
        size: { width: 6, height: 6 },
        attributes: {
            bandwidth: 100,
            data_level: 5,
            security_level: 5
        },
        spawn_rules: {
            min_district_size: 50,
            avoid_water: true,
            avoid_roads: false,
            priority: 'high'
        }
    }
};

/**
 * Gets POI templates by type
 * @param {string} type - POI type
 * @returns {Array} Array of template objects
 */
export function getTemplatesByType(type) {
    return Object.values(POI_TEMPLATES).filter(t => t.type === type);
}

/**
 * Gets a random POI template by type
 * @param {string} type - POI type
 * @param {RNG} rng - RNG instance
 * @returns {Object|null} Template object or null
 */
export function getRandomTemplateByType(type, rng) {
    const templates = getTemplatesByType(type);
    if (templates.length === 0) return null;
    const idx = rng.int(0, templates.length - 1);
    return templates[idx];
}

/**
 * Validates if a POI can spawn at a location
 * @param {Object} template - POI template
 * @param {Map} map - Map object
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Map width
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateSpawnLocation(template, map, x, y, width) {
    const { avoid_water, avoid_roads } = template.spawn_rules;
    const { width: sizeW, height: sizeH } = template.size;

    // Check bounds
    if (x < 0 || y < 0 || x + sizeW > width || y + sizeH > map.height) {
        return { valid: false, reason: 'Out of bounds' };
    }

    // Check tile requirements
    for (let dy = 0; dy < sizeH; dy++) {
        for (let dx = 0; dx < sizeW; dx++) {
            const px = x + dx;
            const py = y + dy;
            const idx = py * width + px;

            // Check terrain
            if (avoid_water) {
                const terrain = map.grid[py][px];
                if (terrain === 0) { // Water
                    return { valid: false, reason: 'Water tile' };
                }
            }

            // Check roads
            if (avoid_roads) {
                if (map.roadMap[idx] === 1 || map.sidewalkMap[idx] === 1) {
                    return { valid: false, reason: 'Road tile' };
                }
            }
        }
    }

    return { valid: true };
}

/**
 * Finds valid spawn locations for a POI
 * @param {Object} template - POI template
 * @param {Map} map - Map object
 * @param {number} districtId - District ID
 * @param {RNG} rng - RNG instance
 * @param {number} attempts - Maximum attempts
 * @returns {Object|null} {x, y} or null if no valid location found
 */
export function findValidSpawnLocation(template, map, districtId, rng, attempts = 100) {
    const district = map.districts.find(d => d.id === districtId);
    if (!district) return null;

    const { width: sizeW, height: sizeH } = template.size;
    const width = map.width;
    const height = map.height;

    for (let i = 0; i < attempts; i++) {
        // Sample from district tiles
        const tile = district.tiles[rng.int(0, district.tiles.length - 1)];
        if (!tile) continue;

        const x = tile.x;
        const y = tile.y;

        // Check if location is valid
        const result = validateSpawnLocation(template, map, x, y, width);
        if (result.valid) {
            // Check minimum spacing from other POIs
            if (checkMinimumSpacing(map, x, y, template)) {
                return { x, y };
            }
        }
    }

    // Fallback: try random locations in district bounds
    const bounds = district.bounds;
    for (let i = 0; i < attempts; i++) {
        const x = rng.int(bounds.minX, bounds.maxX - sizeW);
        const y = rng.int(bounds.minY, bounds.maxY - sizeH);

        const result = validateSpawnLocation(template, map, x, y, width);
        if (result.valid && checkMinimumSpacing(map, x, y, template)) {
            return { x, y };
        }
    }

    return null;
}

/**
 * Checks minimum spacing from other POIs
 * @param {Map} map - Map object
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} template - POI template
 * @returns {boolean} True if spacing is adequate
 */
function checkMinimumSpacing(map, x, y, template) {
    if (!map.pois) return true;

    const type = template.type;
    const spacing = getSpacingForType(type, map.width);

    for (const poi of map.pois) {
        const dx = Math.abs(poi.x - x);
        const dy = Math.abs(poi.y - y);
        if (dx < spacing && dy < spacing) {
            return false;
        }
    }
    return true;
}

/**
 * Gets minimum spacing for a POI type based on map size
 * @param {string} type - POI type
 * @param {number} mapWidth - Map width
 * @returns {number} Minimum spacing in tiles
 */
export function getSpacingForType(type, mapWidth) {
    // SMALL: 12, CITY: 20, MEGA: 30
    const baseSpacing = mapWidth <= 50 ? 12 : mapWidth <= 100 ? 20 : 30;

    // Landmarks need more spacing
    if (type === POI_TYPES.LANDMARK) return baseSpacing * 2;
    return baseSpacing;
}
