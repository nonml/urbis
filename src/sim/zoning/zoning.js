// Zoning System - R/C/I zoning for city growth
// Zones drive demand and auto-growth

// Zone types
export const ZONE_TYPES = {
    NONE: 0,
    RESIDENTIAL: 1,
    COMMERCIAL: 2,
    INDUSTRIAL: 3
};

export const ZONE_NAMES = {
    [ZONE_TYPES.NONE]: 'None',
    [ZONE_TYPES.RESIDENTIAL]: 'Residential',
    [ZONE_TYPES.COMMERCIAL]: 'Commercial',
    [ZONE_TYPES.INDUSTRIAL]: 'Industrial'
};

export const ZONE_COLORS = {
    [ZONE_TYPES.NONE]: null,
    [ZONE_TYPES.RESIDENTIAL]: '#4a90e2', // Blue
    [ZONE_TYPES.COMMERCIAL]: '#e6b800', // Gold
    [ZONE_TYPES.INDUSTRIAL]: '#8b5a2b'  // Brown
};

/**
 * Zoning Manager - Handles zone map and operations
 */
export class ZoningManager {
    constructor(mapWidth, mapHeight) {
        this.width = mapWidth;
        this.height = mapHeight;
        // Use Uint8Array for memory efficiency on MEGA maps
        this.zoneMap = new Uint8Array(mapWidth * mapHeight);
        this.dirtyTiles = new Set();
    }

    /**
     * Get index in zoneMap for tile coordinates
     */
    _getIndex(x, y) {
        return y * this.width + x;
    }

    /**
     * Get zone at tile coordinates
     */
    getZone(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return ZONE_TYPES.NONE;
        }
        return this.zoneMap[this._getIndex(x, y)];
    }

    /**
     * Set zone at tile coordinates
     */
    setZone(x, y, zoneType) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        const idx = this._getIndex(x, y);
        if (this.zoneMap[idx] !== zoneType) {
            this.zoneMap[idx] = zoneType;
            this.dirtyTiles.add(`${x},${y}`);
            return true;
        }
        return false;
    }

    /**
     * Paint zone in a brush area
     */
    paintZone(centerX, centerY, radius, zoneType) {
        const painted = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    if (this.setZone(x, y, zoneType)) {
                        painted.push({ x, y });
                    }
                }
            }
        }
        return painted;
    }

    /**
     * Erase zone (set to NONE) in a brush area
     */
    eraseZone(centerX, centerY, radius) {
        return this.paintZone(centerX, centerY, radius, ZONE_TYPES.NONE);
    }

    /**
     * Get all tiles with a specific zone type
     */
    getZonedTiles(zoneType) {
        const tiles = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.zoneMap[this._getIndex(x, y)] === zoneType) {
                    tiles.push({ x, y });
                }
            }
        }
        return tiles;
    }

    /**
     * Count tiles by zone type
     */
    countZones() {
        const counts = {
            [ZONE_TYPES.NONE]: 0,
            [ZONE_TYPES.RESIDENTIAL]: 0,
            [ZONE_TYPES.COMMERCIAL]: 0,
            [ZONE_TYPES.INDUSTRIAL]: 0
        };
        for (let i = 0; i < this.zoneMap.length; i++) {
            counts[this.zoneMap[i]]++;
        }
        return counts;
    }

    /**
     * Get dirty tiles (changed since last clear)
     */
    getDirtyTiles() {
        return Array.from(this.dirtyTiles).map(s => {
            const [x, y] = s.split(',').map(Number);
            return { x, y };
        });
    }

    /**
     * Clear dirty tiles
     */
    clearDirtyTiles() {
        this.dirtyTiles.clear();
    }

    /**
     * Serialize zoning data for save
     */
    serialize() {
        // Copy to regular array for JSON serialization
        return Array.from(this.zoneMap);
    }

    /**
     * Deserialize zoning data from save
     */
    deserialize(data) {
        if (!Array.isArray(data)) return;
        for (let i = 0; i < Math.min(data.length, this.zoneMap.length); i++) {
            this.zoneMap[i] = data[i];
        }
    }

    /**
     * Reset all zones to NONE
     */
    reset() {
        this.zoneMap.fill(ZONE_TYPES.NONE);
        this.dirtyTiles.clear();
    }
}

/**
 * Create zoning manager instance
 */
export function createZoningManager(mapWidth, mapHeight) {
    return new ZoningManager(mapWidth, mapHeight);
}