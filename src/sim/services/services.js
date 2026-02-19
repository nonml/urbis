import {
    BUILDING_TOWN_HALL,
    BUILDING_WAREHOUSE,
    BUILDING_FARM,
    BUILDING_SCHOOL,
    BUILDING_BARRACKS,
    BUILDING_POLICE_STATION,
    BUILDING_CCTV_NETWORK,
    BUILDING_COUNTERINTEL
} from '../../constants.js';

const SERVICES = ['power', 'water', 'health', 'police'];

const PROVIDER_RULES = {
    power: {
        [BUILDING_TOWN_HALL]: { radius: 18, quality: 1.0, supply: 130 },
        [BUILDING_WAREHOUSE]: { radius: 12, quality: 0.7, supply: 60 },
    },
    water: {
        [BUILDING_FARM]: { radius: 14, quality: 0.85, supply: 80 },
        [BUILDING_TOWN_HALL]: { radius: 12, quality: 0.75, supply: 40 },
    },
    health: {
        [BUILDING_SCHOOL]: { radius: 16, quality: 1.0, supply: 100 },
        [BUILDING_TOWN_HALL]: { radius: 10, quality: 0.55, supply: 30 },
    },
    police: {
        [BUILDING_BARRACKS]: { radius: 14, quality: 0.9, supply: 90 },
        [BUILDING_POLICE_STATION]: { radius: 18, quality: 1.2, supply: 140 },
        [BUILDING_CCTV_NETWORK]: { radius: 14, quality: 0.6, supply: 50 },
        [BUILDING_COUNTERINTEL]: { radius: 12, quality: 0.75, supply: 70 },
    },
};

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function mapUintToQuality(value) {
    return clamp01((value || 0) / 255);
}

export class ServiceManager {
    constructor(game) {
        this.game = game;
        this.overlayService = 'power';
        this.maps = {
            power: new Uint8Array(game.map.width * game.map.height),
            water: new Uint8Array(game.map.width * game.map.height),
            health: new Uint8Array(game.map.width * game.map.height),
            police: new Uint8Array(game.map.width * game.map.height),
        };
        this.metrics = {
            district: Object.create(null),
            city: {
                powerDemand: 0,
                powerSupply: 0,
                brownout: false,
            },
            computeMs: 0,
        };
        this._lastProviderSignature = '';
        this._chunkCache = new Map();
    }

    setOverlayService(serviceName) {
        if (!SERVICES.includes(serviceName)) return;
        this.overlayService = serviceName;
    }

    getOverlayService() {
        return this.overlayService;
    }

    getTileCoverage(x, y, service = this.overlayService) {
        if (!SERVICES.includes(service)) return 0;
        if (x < 0 || y < 0 || x >= this.game.map.width || y >= this.game.map.height) return 0;
        return mapUintToQuality(this.maps[service][y * this.game.map.width + x]);
    }

    getDistrictMetrics(districtId) {
        return this.metrics.district?.[districtId] || null;
    }

    update() {
        const t0 = performance.now();
        const providers = this._collectProviders();
        const signature = providers.map((p) => `${p.service}:${p.x},${p.y}:${p.radius}:${p.quality}`).join('|');
        if (signature !== this._lastProviderSignature) {
            this._rebuildCoverageMaps(providers);
            this._lastProviderSignature = signature;
        }
        this._computeDistrictMetrics();
        this._computeCityMetrics(providers);
        this.metrics.computeMs = performance.now() - t0;
    }

    applyCitizenEffects(citizens) {
        const brownout = this.metrics.city.brownout;
        for (const c of citizens) {
            const power = this.getTileCoverage(c.x, c.y, 'power');
            const water = this.getTileCoverage(c.x, c.y, 'water');
            const health = this.getTileCoverage(c.x, c.y, 'health');
            const police = this.getTileCoverage(c.x, c.y, 'police');

            let happinessDelta = 0;
            if (power < 0.4) happinessDelta -= 2;
            else happinessDelta += 0.2;
            if (water < 0.4) happinessDelta -= 1.5;
            else happinessDelta += 0.1;
            if (health < 0.35) happinessDelta -= 1;
            if (police < 0.3) happinessDelta -= 1.2;
            if (brownout) happinessDelta -= 1.8;

            c.happiness = Math.max(0, Math.min(100, c.happiness + happinessDelta));
            if (water < 0.35) {
                c.foodLevel = Math.max(0, c.foodLevel - 1);
            }
        }
    }

    _collectProviders() {
        const providers = [];
        for (const b of this.game.buildings.buildings) {
            const staffingRatio = this.game.jobsManager?.getStaffingRatio?.(b.id) ?? 1;
            for (const service of SERVICES) {
                const rule = PROVIDER_RULES[service][b.type];
                if (!rule) continue;
                providers.push({
                    service,
                    x: b.x,
                    y: b.y,
                    radius: rule.radius,
                    quality: rule.quality * (0.2 + (0.8 * staffingRatio)),
                    supply: rule.supply || 0,
                });
            }
        }
        return providers;
    }

    _rebuildCoverageMaps(providers) {
        for (const s of SERVICES) {
            this.maps[s].fill(0);
        }
        this._chunkCache.clear();

        const chunks = this.game.chunks?.getVisibleChunks?.(this.game.player || { x: 0, y: 0 }, []) || new Set();
        if (chunks.size === 0) {
            // Headless fallback or early boot: process full map.
            this._stampProviders(providers, null);
            return;
        }

        for (const chunkId of chunks) {
            const bounds = this.game.chunks.getChunkBounds(chunkId);
            this._stampProviders(providers, bounds);
            this._chunkCache.set(chunkId, true);
        }
    }

    _stampProviders(providers, bounds) {
        const width = this.game.map.width;
        const height = this.game.map.height;
        for (const p of providers) {
            const minX = Math.max(0, p.x - p.radius);
            const maxX = Math.min(width - 1, p.x + p.radius);
            const minY = Math.max(0, p.y - p.radius);
            const maxY = Math.min(height - 1, p.y + p.radius);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    if (bounds) {
                        if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue;
                    }
                    const dx = x - p.x;
                    const dy = y - p.y;
                    const dist = Math.sqrt((dx * dx) + (dy * dy));
                    if (dist > p.radius) continue;

                    const falloff = 1 - (dist / p.radius);
                    const q = clamp01(p.quality * falloff);
                    const idx = y * width + x;
                    const value = Math.floor(q * 255);
                    if (value > this.maps[p.service][idx]) {
                        this.maps[p.service][idx] = value;
                    }
                }
            }
        }
    }

    _computeDistrictMetrics() {
        const width = this.game.map.width;
        const districtMap = this.game.map.districtMap;
        const districtStats = Object.create(null);
        if (!districtMap) return;

        for (let i = 0; i < districtMap.length; i++) {
            const districtId = districtMap[i];
            if (districtId === 255) continue;
            if (!districtStats[districtId]) {
                districtStats[districtId] = {
                    tileCount: 0,
                    power: 0,
                    water: 0,
                    health: 0,
                    police: 0,
                };
            }
            const rec = districtStats[districtId];
            rec.tileCount++;
            for (const s of SERVICES) {
                rec[s] += mapUintToQuality(this.maps[s][i]);
            }
        }

        for (const [districtId, rec] of Object.entries(districtStats)) {
            const c = Math.max(1, rec.tileCount);
            districtStats[districtId] = {
                coverage: {
                    power: rec.power / c,
                    water: rec.water / c,
                    health: rec.health / c,
                    police: rec.police / c,
                },
                tileCount: rec.tileCount,
            };
        }

        this.metrics.district = districtStats;
    }

    _computeCityMetrics(providers) {
        let powerSupply = 0;
        for (const p of providers) {
            if (p.service === 'power') powerSupply += p.supply;
        }

        const pop = this.game.resources.population || 0;
        const buildingCount = this.game.buildings.buildings.length || 0;
        const powerDemand = (buildingCount * 7) + (pop * 1.5);
        const brownout = powerSupply < powerDemand;

        this.metrics.city = {
            ...this.metrics.city,
            powerSupply,
            powerDemand,
            brownout,
        };
    }
}
