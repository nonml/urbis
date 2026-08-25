/**
 * PathfindingProxy
 *
 * Integrates WebWorker A* into the synchronous citizen movement loop via a
 * per-citizen path cache. The main thread never blocks:
 *
 *   1. `updateCitizenSchedule` calls `consumeStep(citizenId, start, target)`:
 *      - Cache HIT  → returns next {x,y} from the worker-computed path.
 *      - Cache MISS → returns null (caller stalls one tick).
 *        Also fires a prefetch to the worker so the next call is a hit.
 *
 *   2. After a worker move, the caller calls `prefetch(citizenId, nextPos, target)`
 *      to warm the cache for the following tick.
 *
 * The worker owns the walkability grid. The main thread sends the terrain
 * snapshot once (INIT) and only hands over the blocked-tile list when
 * buildings change (UPDATE). No SharedArrayBuffer is required — the worker
 * works on any host, with or without cross-origin isolation headers.
 * Falls back to sync NavGrid when `Worker` is unavailable (headless Node).
 */

export class PathfindingProxy {
    /**
     * @param {import('./nav_grid.js').NavGrid} navGrid
     * @param {Object} map  game map (.width, .height)
     */
    constructor(navGrid, map) {
        this._nav = navGrid;
        this._map = map;
        this._worker = null;
        this._ready = false;
        this._fallback = false;
        this._dirty = true;
        this._epoch = 0;
        this._terrain = null;

        // id → { resolve }
        this._pending = new Map();
        this._nextId = 1;

        // citizenId → { path: [{x,y}], step: number, tx, ty }
        this._cache = new Map();
        // citizenIds with an in-flight worker request
        this._inflight = new Set();
        // citizenId → { sx, sy, tx, ty } — last request that had no path
        this._noPath = new Map();

        this.ready = this._init();
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    async _init() {
        if (typeof Worker === 'undefined') {
            this._fallback = true;
            return;
        }
        const W = this._map.width;
        const H = this._map.height;
        this._terrain = this._buildTerrain(W, H);

        try {
            this._worker = new Worker(
                new URL('../../workers/pathfinding_worker.js', import.meta.url),
                { type: 'module' }
            );
            this._worker.onmessage = (e) => {
                if (e.data.type === 'READY') {
                    this._ready = true;
                }
                this._onMessage(e);
            };
            this._worker.postMessage(
                { type: 'INIT', width: W, height: H, terrain: this._terrain },
                [this._terrain.buffer]
            );
        } catch {
            this._fallback = true;
            if (this._worker) this._worker.terminate();
            this._worker = null;
        }
    }

    _buildTerrain(W, H) {
        const nav = this._nav;
        const terrain = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                terrain[y * W + x] = nav.isWalkable(x, y) ? 1 : 0;
            }
        }
        return terrain;
    }

    _flushDirty() {
        if (!this._dirty) return;
        this._dirty = false;
        const blocked = [];
        for (const key of this._nav.blockedTiles) {
            const [x, y] = key.split(',').map(Number);
            blocked.push([x, y]);
        }
        this._worker.postMessage({ type: 'UPDATE', blocked });
    }

    isWorkerActive() {
        return !!this._worker && this._ready && !this._fallback;
    }

    _onMessage(e) {
        const { type, id, epoch, path, citizenId } = e.data;
        if (type !== 'RESULT') return;
        if (epoch !== undefined && epoch !== this._epoch) return;

        // Resolve any promise-based callers
        const prom = this._pending.get(id);
        if (prom) {
            this._pending.delete(id);
            prom.resolve({ path: path ?? [], success: !!path?.length });
        }

        if (citizenId === undefined) return;
        this._inflight.delete(citizenId);

        if (path?.length) {
            this._noPath.delete(citizenId);
            const last = path[path.length - 1];
            this._cache.set(citizenId, { path, step: 0, tx: last.x, ty: last.y });
        } else {
            this._noPath.set(citizenId, {
                sx: e.data.sx, sy: e.data.sy,
                tx: e.data.tx, ty: e.data.ty,
            });
        }
    }

    // ── Public API for citizen movement ──────────────────────────────────────

    /**
     * Mark walkability dirty (call after building placement/demolition).
     * Clears caches and invalidates in-flight results via epoch bump.
     */
    invalidate() {
        this._dirty = true;
        this._epoch++;
        this._cache.clear();
        this._inflight.clear();
        this._noPath.clear();
    }

    /**
     * Try to get the next step for a citizen from the worker-computed cache.
     * Returns {x, y} on hit, null on miss.
     *
     * @param {number} citizenId
     * @param {{x:number,y:number}} start  current citizen position
     * @param {{x:number,y:number}} target
     */
    consumeStep(citizenId, start, target) {
        const noPath = this._noPath.get(citizenId);
        if (noPath && noPath.tx === target.x && noPath.ty === target.y) return null;

        const entry = this._cache.get(citizenId);
        if (!entry) return null;

        // Invalidate if target changed
        if (entry.tx !== target.x || entry.ty !== target.y) {
            this._cache.delete(citizenId);
            return null;
        }

        const { path, step } = entry;
        // Find where the citizen currently is in the path (allow ±1 drift)
        let idx = step;
        if (idx < path.length && (path[idx].x !== start.x || path[idx].y !== start.y)) {
            // Re-scan — citizen may have moved via fallback
            idx = path.findIndex(p => p.x === start.x && p.y === start.y);
            if (idx === -1) { this._cache.delete(citizenId); return null; }
        }

        const next = path[idx + 1];
        if (!next) { this._cache.delete(citizenId); return null; }

        entry.step = idx + 1;
        return next;
    }

    /**
     * Fire a worker path request for a citizen (does nothing if already in-flight,
     * worker not ready, or the same request was already answered with no path).
     *
     * @param {number} citizenId
     * @param {{x:number,y:number}} from
     * @param {{x:number,y:number}} to
     */
    prefetch(citizenId, from, to) {
        if (this._fallback || !this._ready) return;
        if (this._inflight.has(citizenId)) return;

        const noPath = this._noPath.get(citizenId);
        if (noPath && noPath.sx === from.x && noPath.sy === from.y &&
            noPath.tx === to.x && noPath.ty === to.y) {
            return;
        }

        if (this._dirty) this._flushDirty();

        this._inflight.add(citizenId);
        const id = this._nextId++;
        this._worker.postMessage({
            type: 'FIND', id, epoch: this._epoch, citizenId,
            sx: from.x, sy: from.y,
            tx: to.x,   ty: to.y,
        });
    }

    /**
     * Promise-based path query (for non-citizen callers, e.g. service routing).
     */
    findPath(a, b) {
        if (this._fallback || !this._ready) {
            const path = this._nav.findPath(a, b) ?? [];
            return Promise.resolve({ path, success: path.length > 0 });
        }
        if (this._dirty) this._flushDirty();
        const id = this._nextId++;
        return new Promise((resolve) => {
            this._pending.set(id, { resolve });
            this._worker.postMessage({
                type: 'FIND', id, epoch: this._epoch,
                sx: a.x, sy: a.y, tx: b.x, ty: b.y,
            });
        });
    }

    destroy() {
        this._worker?.terminate();
        this._worker = null;
    }
}