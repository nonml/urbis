/**
 * PathfindingProxy
 *
 * Integrates WebWorker A* into the synchronous citizen movement loop via a
 * per-citizen path cache.  The main thread never blocks:
 *
 *   1. `updateCitizenSchedule` calls `consumeStep(citizenId, start, target)`:
 *      - Cache HIT  → returns next {x,y} from the worker-computed path.
 *      - Cache MISS → returns null (caller falls back to sync NavGrid).
 *        Also fires a prefetch to the worker so the next call is a hit.
 *
 *   2. After a sync NavGrid move, caller should call
 *      `prefetch(citizenId, nextPos, target)` to warm the cache for the
 *      following tick.
 *
 * The SAB walkability grid is rebuilt lazily (on invalidate → next prefetch).
 * Falls back silently to sync mode when SharedArrayBuffer is unavailable.
 */

export class PathfindingProxy {
    /**
     * @param {import('./nav_grid.js').NavGrid} navGrid
     * @param {Object} map  game map (.width, .height)
     */
    constructor(navGrid, map) {
        this._nav    = navGrid;
        this._map    = map;
        this._worker = null;
        this._ready  = false;
        this._fallback = false;
        this._dirty  = true;
        this._sab    = null;
        this._shared = null;

        // id → { resolve }
        this._pending = new Map();
        this._nextId  = 1;

        // citizenId → { path: [{x,y}], step: number, tx, ty }
        this._cache = new Map();
        // citizenIds with an in-flight worker request
        this._inflight = new Set();

        this.ready = this._init();
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    async _init() {
        if (typeof SharedArrayBuffer === 'undefined') {
            this._fallback = true;
            return;
        }
        const W = this._map.width;
        const H = this._map.height;
        this._sab    = new SharedArrayBuffer(W * H);
        this._shared = new Uint8Array(this._sab);
        this._buildWalkability();

        this._worker = new Worker(
            new URL('../../workers/pathfinding_worker.js', import.meta.url),
            { type: 'module' }
        );

        await new Promise((resolve) => {
            this._worker.onmessage = (e) => {
                if (e.data.type === 'READY') {
                    this._ready = true;
                    this._worker.onmessage = (ev) => this._onMessage(ev);
                    resolve();
                }
            };
            this._worker.postMessage({ type: 'INIT', sab: this._sab, width: W, height: H });
        });
    }

    _buildWalkability() {
        if (!this._shared) return;
        const nav = this._nav;
        const W = this._map.width;
        for (let y = 0; y < this._map.height; y++) {
            for (let x = 0; x < W; x++) {
                this._shared[y * W + x] = nav.isWalkable(x, y) ? 1 : 0;
            }
        }
        this._dirty = false;
    }

    _pushUpdate() {
        if (!this._worker || !this._shared) return;
        this._buildWalkability();
        // SAB is already shared — worker reads updated data automatically.
        // Sending UPDATE is a no-op hint so the worker can clear its own caches.
        this._worker.postMessage({ type: 'UPDATE', data: null });
    }

    _onMessage(e) {
        const { type, id, path, citizenId } = e.data;
        if (type !== 'RESULT') return;

        // Resolve any promise-based callers
        const prom = this._pending.get(id);
        if (prom) {
            this._pending.delete(id);
            prom.resolve({ path: path ?? [], success: !!path?.length });
        }

        // Store in per-citizen cache
        if (citizenId !== undefined && path?.length) {
            this._cache.set(citizenId, { path, step: 0, tx: path[path.length - 1].x, ty: path[path.length - 1].y });
        }
        if (citizenId !== undefined) this._inflight.delete(citizenId);
    }

    // ── Public API for citizen movement ──────────────────────────────────────

    /**
     * Mark walkability dirty (call after building placement/demolition).
     * Clears citizen path cache so stale paths aren't used.
     */
    invalidate() {
        this._dirty = true;
        this._cache.clear();
        this._inflight.clear();
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
     * Fire a worker path request for a citizen (does nothing if already in-flight
     * or worker not ready).
     *
     * @param {number} citizenId
     * @param {{x:number,y:number}} from
     * @param {{x:number,y:number}} to
     */
    prefetch(citizenId, from, to) {
        if (this._fallback || !this._ready) return;
        if (this._inflight.has(citizenId)) return;

        if (this._dirty) this._pushUpdate();

        this._inflight.add(citizenId);
        const id = this._nextId++;
        this._worker.postMessage({
            type: 'FIND', id, citizenId,
            sx: from.x, sy: from.y,
            tx: to.x,   ty: to.y,
        });
    }

    /**
     * Promise-based path query (for non-citizen callers, e.g. service routing).
     */
    findPath(a, b) {
        if (this._fallback || !this._ready) {
            return Promise.resolve({ path: this._nav.findPath(a, b) ?? [], success: false });
        }
        if (this._dirty) this._pushUpdate();
        const id = this._nextId++;
        return new Promise((resolve) => {
            this._pending.set(id, { resolve });
            this._worker.postMessage({ type: 'FIND', id, sx: a.x, sy: a.y, tx: b.x, ty: b.y });
        });
    }

    destroy() {
        this._worker?.terminate();
        this._worker = null;
    }
}
