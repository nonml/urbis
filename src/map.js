// Map class for terrain generation and management
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN, TERRAIN_COLORS, TERRAIN_ICONS } from './constants.js';
import { RNG, randomSeed32 } from './rng.js';
import { generateDistricts, getDistrictAt, getDistrictName } from './gen/districts.js';
import { generateRoads, getBlockAt } from './gen/roads.js';
import { generateParcels, getParcelAt, getParcelById, isTileInParcel } from './gen/parcels.js';
import { spawnPOIs } from './gen/pois.js';

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
        this.seed = (seed ?? randomSeed32()) >>> 0;
        this.rng = rng || new RNG(this.seed);
        this.grid = [];
        this.districts = [];
        this.districtMap = null;
        this.roads = null;
        this.roadMap = null;
        this.sidewalkMap = null;
        this.blockMap = null;
        this.parcels = null;
        this.parcelMap = null;
        this.resources = [];
        this.cities = [];
        this.noise = new SimpleNoise(this.seed);
        this.generate();
    }

    generate() {
        // Generate terrain grid
        const urban = this.width >= 40; // every preset is a city now — never a swamp
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                // Use noise for terrain generation — but for urban maps flatten hard.
                // GTA/Watch Dogs have a river/corridor, not random scattered lakes/mountains.
                const noiseValue = this.noise.noise(x * 0.08, y * 0.08);
                let terrain;
                if (urban) {
                    // Pure urban slab — 100% buildable. Water/forest only via _carveUrbanCanals + park groves.
                    terrain = TERRAIN_GRASS;
                } else if (noiseValue < -0.3) {
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

        // Place resource clusters (urban: parks only, no random lakes)
        if (!urban) this.placeResourceClusters();
        else {
            // Urban parks: 4 small groves away from core, for visual break
            for (let i = 0; i < 4; i++) {
                const cx = this.rng.int(0, this.width - 1);
                const cy = this.rng.int(0, this.height - 1);
                const dist = Math.hypot(cx - this.width / 2, cy - this.height / 2);
                if (dist < this.width * 0.35) continue;
                for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                    if (this.rng.next() > 0.45) continue;
                    const nx = Math.max(0, Math.min(this.width - 1, cx + dx));
                    const ny = Math.max(0, Math.min(this.height - 1, cy + dy));
                    if (this.grid[ny][nx] === TERRAIN_GRASS) this.grid[ny][nx] = TERRAIN_FOREST;
                }
            }
        }

        // Ensure starting area is accessible (grass/plain)
        this.createStartingArea();
        if (urban) this._carveUrbanCanals();

        // Generate districts
        this.generateDistricts();

        // Generate road network
        this.generateRoads();

        // Generate parcels
        this.generateParcels();

        // Generate POIs
        this.generatePOIs(this.seed + 4);
    }

    generateDistricts() {
        // Determine district count based on map size (Ticket C-1 spec)
        // SMALL: 4-6, CITY: 8-12, MEGA: 14-20
        const area = this.width * this.height;
        let districtCount;
        if (area <= 2000) {
            districtCount = 5;  // SMALL: middle of 4-6 range
        } else if (area <= 10000) {
            districtCount = 10;  // CITY: middle of 8-12 range
        } else {
            districtCount = 17;  // MEGA: middle of 14-20 range
        }

        const result = generateDistricts(this.width, this.height, this.seed + 1, districtCount);
        this.districts = result.districts;
        this.districtMap = result.districtMap;
        // Geography pass: re-theme districts so downtown is elite/commercial,
        // harbor edge is docks/waterfront, rim is industrial. Prevents toy-town random colors.
        const cx = this.width / 2, cy = this.height / 2;
        const maxDist = Math.hypot(cx, cy) || 1;
        const harborEdge = this.width - 6;
        for (const d of this.districts) {
            const dcx = d.center.x, dcy = d.center.y;
            const distNorm = Math.hypot(dcx - cx, dcy - cy) / maxDist;
            const nearHarbor = (harborEdge - dcx) < 10 && dcy > this.height * 0.45 && dcy < this.height * 0.85;
            let theme = d.theme;
            if (nearHarbor) theme = distNorm < 0.35 ? 'waterfront' : 'docks';
            else if (distNorm < 0.22) theme = this.rng.next() < 0.55 ? 'elite' : 'commercial';
            else if (distNorm < 0.38) theme = this.rng.next() < 0.5 ? 'commercial' : 'oldtown';
            else if (distNorm < 0.60) theme = this.rng.next() < 0.5 ? 'residential' : 'suburbs';
            else theme = this.rng.next() < 0.55 ? 'industrial' : 'suburbs';
            if (theme !== d.theme) {
                d.theme = theme;
                // Re-derive pools and bias to match new theme
                const pools = { residential: ['house','apartment','school','market'], commercial: ['market','shopping-mall','hotel','town-hall','office'], industrial: ['factory','warehouse','lumber-mill','garage','port'], waterfront: ['hotel','market','marina','restaurant'], elite: ['apartment','hotel','shopping-mall','town-hall','courthouse'], docks: ['warehouse','port','factory','market','container-yard'], suburbs: ['house','house','farm','school','park'], oldtown: ['house','market','library','museum','restaurant'] };
                d.buildingPools = pools[theme] || d.buildingPools;
                if (theme === 'elite' || theme === 'commercial') { d.bias.wealthBias = Math.abs(d.bias.wealthBias) + 0.15; d.securityLevel = Math.min(5, d.securityLevel + 1); }
                if (theme === 'industrial' || theme === 'docks') { d.bias.wealthBias = -Math.abs(d.bias.wealthBias) - 0.1; d.bias.crimeBias += 0.12; }
                if (theme === 'elite') d.densityTarget = Math.max(d.densityTarget, Math.floor(d.area / 12));
                if (theme === 'docks' || theme === 'industrial') d.poiBudget += 1;
            }
        }
    }

    placeResourceClusters() {
        // Create forest clusters
        for (let i = 0; i < 8; i++) {
            const cx = this.rng.int(0, this.width - 1);
            const cy = this.rng.int(0, this.height - 1);
            for (let y = -3; y <= 3; y++) {
                for (let x = -3; x <= 3; x++) {
                    if (this.rng.next() > 0.3) {
                        const ny = ((cy + y) % this.height + this.height) % this.height;
                        const nx = ((cx + x) % this.width + this.width) % this.width;
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
                        const ny = ((cy + y) % this.height + this.height) % this.height;
                        const nx = ((cx + x) % this.width + this.width) % this.width;
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

    _carveUrbanCanals() {
        // One thin 2-tile canal hugging the eastern rim + a pocket harbor at SE — reads as Watch Dogs riverfront.
        // Roads will bridge it via TERRAIN_BRIDGE handling in Map; we just ensure there's a visible water corridor.
        const canalX = this.width - 5;
        const harborY = Math.floor(this.height * 0.65);
        for (let y = 4; y < this.height - 4; y++) {
            for (let dx = 0; dx < 2; dx++) {
                const x = canalX + dx;
                if (x < 0 || x >= this.width) continue;
                // Break the canal at the avenue crossing every ~18 tiles so blocks aren't severed
                if (y % 18 < 2) continue;
                if (this.grid[y][x] === TERRAIN_MOUNTAIN) continue;
                this.grid[y][x] = TERRAIN_WATER;
            }
        }
        // Pocket harbor 6x6 at SE rim
        for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 1; dx++) {
            const x = this.width - 6 + dx, y = harborY + dy;
            if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
            if (Math.abs(dx) === 4 && Math.abs(dy) === 3 && this.rng.next() < 0.5) continue;
            this.grid[y][x] = TERRAIN_WATER;
        }
        // Interior park stripe — one linear park through midtown, breaks up slab
        const parkY = Math.floor(this.height / 2) + this.rng.int(-6, 6);
        for (let x = Math.floor(this.width * 0.22); x < Math.floor(this.width * 0.78); x++) {
            if (x % 9 === 0) continue; // gap for avenue
            if (this.grid[parkY][x] !== TERRAIN_GRASS) continue;
            if (this.rng.next() < 0.55) this.grid[parkY][x] = TERRAIN_FOREST; // rendered as park
            const y2 = parkY + 1;
            if (y2 < this.height && this.grid[y2][x] === TERRAIN_GRASS && this.rng.next() < 0.35) this.grid[y2][x] = TERRAIN_FOREST;
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

    getDistrictAt(x, y) {
        return getDistrictAt(this.districtMap, x, y, this.width);
    }

    getDistrictName(districtId) {
        return getDistrictName(this.districts, districtId);
    }

    getTileDistrictName(x, y) {
        const districtId = this.getDistrictAt(x, y);
        return this.getDistrictName(districtId);
    }

    generateRoads() {
        const result = generateRoads(this, this.seed + 2);
        this.roads = result.roads;
        this.roadMap = result.roadMap;
        this.sidewalkMap = result.sidewalkMap;
        this.blockMap = result.blockMap;
    }

    getBlockAt(x, y) {
        return getBlockAt(this.blockMap, x, y, this.width);
    }

    getRoadTiles(roadIndex) {
        const road = this.roads[roadIndex];
        return road ? road.tiles : [];
    }

    getSidewalkTiles(roadIndex) {
        const road = this.roads[roadIndex];
        return road ? road.sidewalks : [];
    }

    generateParcels() {
        const result = generateParcels(this, this.seed + 3);
        this.parcels = result.parcels;
        this.parcelMap = result.parcelMap;
    }

    generatePOIs(seed) {
        const result = spawnPOIs(this, seed);
        this.pois = result.pois;
    }

    getParcelAt(x, y) {
        return getParcelAt(this.parcelMap, x, y, this.width);
    }

    getParcelById(parcelId) {
        return getParcelById(this.parcels, parcelId);
    }

    isTileInParcel(x, y) {
        return isTileInParcel(this.parcelMap, x, y, this.width);
    }
}