import { TERRAIN_ROAD, TERRAIN_SIDEWALK, TERRAIN_PARK } from '../../constants.js';
import { getChunkId } from '../../world/chunks.js';

const ORTH_COST = 1;
const DIAG_COST = 1.41421356237;

const DIRECTIONS = [
    { dx: 1, dy: 0, cost: ORTH_COST },
    { dx: -1, dy: 0, cost: ORTH_COST },
    { dx: 0, dy: 1, cost: ORTH_COST },
    { dx: 0, dy: -1, cost: ORTH_COST },
    { dx: 1, dy: 1, cost: DIAG_COST },
    { dx: 1, dy: -1, cost: DIAG_COST },
    { dx: -1, dy: 1, cost: DIAG_COST },
    { dx: -1, dy: -1, cost: DIAG_COST },
];

function tileKey(x, y) {
    return `${x},${y}`;
}

function stableNodeOrder(a, b) {
    if (a.f !== b.f) return a.f - b.f;
    if (a.h !== b.h) return a.h - b.h;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
}

function octileDistance(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx + dy) + (DIAG_COST - 2) * Math.min(dx, dy);
}

export class NavGrid {
    constructor(map, options = {}) {
        this.map = map;
        this.chunkSize = options.chunkSize ?? 32;
        this.maxVisited = options.maxVisited ?? 2048;
        this.blockedTiles = new Set();
        this.cache = new Map();
        this.version = 0;
    }

    setBlockedTilesFromBuildings(buildings = []) {
        this.blockedTiles.clear();
        for (const b of buildings) {
            this.blockedTiles.add(tileKey(b.x, b.y));
        }
        this.version++;
        this.cache.clear();
    }

    isWalkable(x, y) {
        if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return false;
        if (this.blockedTiles.has(tileKey(x, y))) return false;
        const t = this.map.getTileAt(x, y);
        const idx = y * this.map.width + x;
        const isRoad = this.map.roadMap ? this.map.roadMap[idx] === 1 : (t === TERRAIN_ROAD);
        const isSidewalk = this.map.sidewalkMap ? this.map.sidewalkMap[idx] === 1 : (t === TERRAIN_SIDEWALK);
        return isRoad || isSidewalk || t === TERRAIN_PARK;
    }

    findPath(a, b) {
        if (!a || !b) return [];
        if (!this.isWalkable(a.x, a.y) || !this.isWalkable(b.x, b.y)) return [];

        const startChunk = getChunkId(a.x, a.y, this.chunkSize);
        const endChunk = getChunkId(b.x, b.y, this.chunkSize);
        const cacheKey = `${this.version}|${startChunk}|${endChunk}|${a.x},${a.y}->${b.x},${b.y}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const open = [];
        const openSet = new Set();
        const closed = new Set();
        const gScore = new Map();
        const fScore = new Map();
        const cameFrom = new Map();

        const startKey = tileKey(a.x, a.y);
        gScore.set(startKey, 0);
        const startH = octileDistance(a.x, a.y, b.x, b.y);
        fScore.set(startKey, startH);
        open.push({ x: a.x, y: a.y, h: startH, f: startH });
        openSet.add(startKey);

        let visited = 0;
        while (open.length > 0) {
            open.sort(stableNodeOrder);
            const current = open.shift();
            const currentKey = tileKey(current.x, current.y);
            openSet.delete(currentKey);

            if (current.x === b.x && current.y === b.y) {
                const path = this._reconstruct(cameFrom, currentKey);
                this.cache.set(cacheKey, path);
                return path;
            }

            closed.add(currentKey);
            visited++;
            if (visited > this.maxVisited) break;

            for (const dir of DIRECTIONS) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const nKey = tileKey(nx, ny);

                if (closed.has(nKey)) continue;
                if (!this.isWalkable(nx, ny)) continue;

                const tentativeG = (gScore.get(currentKey) ?? Infinity) + dir.cost;
                const prevG = gScore.get(nKey);
                if (prevG !== undefined && tentativeG >= prevG) continue;

                cameFrom.set(nKey, currentKey);
                gScore.set(nKey, tentativeG);
                const h = octileDistance(nx, ny, b.x, b.y);
                const f = tentativeG + h;
                fScore.set(nKey, f);

                if (!openSet.has(nKey)) {
                    open.push({ x: nx, y: ny, h, f });
                    openSet.add(nKey);
                }
            }
        }

        this.cache.set(cacheKey, []);
        return [];
    }

    _reconstruct(cameFrom, currentKey) {
        const path = [];
        let cur = currentKey;
        while (cur) {
            const [x, y] = cur.split(',').map(Number);
            path.unshift({ x, y });
            cur = cameFrom.get(cur);
        }
        return path;
    }
}
