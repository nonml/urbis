// Map class for terrain generation and management
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN, TERRAIN_COLORS, TERRAIN_ICONS } from './constants.js';
import { RNG } from './rng.js';

class SimpleNoise {
    constructor(seed = 123) {
        this.seed = seed;
        this.perm = [];
        for (let i = 0; i < 256; i++) {
            this.perm[i] = i;
        }
        // Shuffle with seed
        for (let i = 255; i > 0; i--) {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            const j = Math.floor(this.seed / 233280 * i);
            [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
        }
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = x * x * (3 - 2 * x);
        const v = y * y * (3 - 2 * y);
        const A = this.perm[X] + Y;
        const B = this.perm[X + 1] + Y;
        return u * (v * this.grad(this.perm[A], x, y) + (1 - v) * this.grad(this.perm[B], x - 1, y)) +
               (1 - u) * (v * this.grad(this.perm[A + 1], x, y - 1) + (1 - v) * this.grad(this.perm[B + 1], x - 1, y - 1));
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const grad = 1 + (h & 7);
        if ((h & 8) !== 0) return -grad * x + grad * y;
        return grad * x - grad * y;
    }
}

export class Map {
    constructor(width, height, seed = null, rng = null) {
        this.width = width;
        this.height = height;
        this.seed = (seed ?? Math.floor(Math.random() * 10000)) >>> 0;
        this.rng = rng || new RNG(this.seed);
        this.grid = [];
        this.resources = [];
        this.cities = [];
        this.noise = new SimpleNoise(this.seed);
        this.generate();
    }

    generate() {
        // Generate terrain grid
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                // Use noise for terrain generation
                const noiseValue = this.noise.noise(x * 0.08, y * 0.08);
                let terrain;
                if (noiseValue < -0.3) {
                    terrain = TERRAIN_WATER;
                } else if (noiseValue < -0.1) {
                    terrain = TERRAIN_GRASS;
                } else if (noiseValue < 0.4) {
                    terrain = TERRAIN_FOREST;
                } else {
                    terrain = TERRAIN_MOUNTAIN;
                }
                row.push(terrain);
            }
            this.grid.push(row);
        }

        // Place resource clusters
        this.placeResourceClusters();

        // Ensure starting area is accessible (grass/plain)
        this.createStartingArea();
    }

    placeResourceClusters() {
        // Create forest clusters
        for (let i = 0; i < 8; i++) {
            const cx = this.rng.int(0, this.width - 1);
            const cy = this.rng.int(0, this.height - 1);
            for (let y = -3; y <= 3; y++) {
                for (let x = -3; x <= 3; x++) {
                    if (this.rng.next() > 0.3) {
                        const ny = (cy + y + this.height) % this.height;
                        const nx = (cx + x + this.width) % this.width;
                        if (this.grid[ny][nx] === TERRAIN_GRASS) {
                            this.grid[ny][nx] = TERRAIN_FOREST;
                        }
                    }
                }
            }
        }

        // Create mountain clusters
        for (let i = 0; i < 4; i++) {
            const cx = this.rng.int(0, this.width - 1);
            const cy = this.rng.int(0, this.height - 1);
            for (let y = -2; y <= 2; y++) {
                for (let x = -2; x <= 2; x++) {
                    if (this.rng.next() > 0.4) {
                        const ny = (cy + y + this.height) % this.height;
                        const nx = (cx + x + this.width) % this.width;
                        if (this.grid[ny][nx] === TERRAIN_GRASS) {
                            this.grid[ny][nx] = TERRAIN_MOUNTAIN;
                        }
                    }
                }
            }
        }
    }

    createStartingArea() {
        // Create a 5x5 area of grass in the center for the starting point
        const startX = Math.floor(this.width / 2) - 2;
        const startY = Math.floor(this.height / 2) - 2;

        for (let y = startY; y < startY + 5; y++) {
            for (let x = startX; x < startX + 5; x++) {
                if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
                    this.grid[y][x] = TERRAIN_GRASS;
                }
            }
        }
    }

    getTileAt(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return null;
        }
        return this.grid[y][x];
    }

    setTileAt(x, y, terrain) {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
            this.grid[y][x] = terrain;
        }
    }

    isValidPlacement(x, y) {
        const tile = this.getTileAt(x, y);
        return tile !== null && tile !== TERRAIN_WATER;
    }

    getTerrainColor(terrain) {
        return TERRAIN_COLORS[terrain] || '#333';
    }

    getTerrainIcon(terrain) {
        return TERRAIN_ICONS[terrain] || '';
    }

    countTerrain(terrainType) {
        let count = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === terrainType) {
                    count++;
                }
            }
        }
        return count;
    }

    getAvailableLand() {
        let land = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] !== TERRAIN_WATER) {
                    land++;
                }
            }
        }
        return land;
    }
}