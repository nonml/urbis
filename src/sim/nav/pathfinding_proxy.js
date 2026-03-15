/**
 * PathfindingProxy
 *
 * Drops-in over NavGrid.findPath() for async A* computed in a Web Worker.
 * Falls back to synchronous NavGrid if SharedArrayBuffer is unavailable (no COOP headers).
 *
 * Usage:
 *   const proxy = new PathfindingProxy(navGrid, map);
 *   await proxy.ready;                                // wait for worker init
 *   const result = await proxy.findPath(a, b);       // { path:[], success:bool }
 *
 * When buildings change call:
 *   proxy.invalidate();    // schedules a walkability push on the next findPath
 */

export class PathfindingProxy {
    /**
     * @param {import('./nav_grid.js').NavGrid} navGrid
     * @param {Object} map  — game map (has .width, .height, .getTileAt)
     */
    constructor(navGrid, map) {
        this._nav  = navGrid;
        this._map  = map;
        this._pendingRequests = new Map(); // id → { resolve, reject }
        this._nextId = 1;
        this._dirty  = true;
        this._sab    = null;
        this._shared = null; // Uint8Array view of sab
        this._worker = null;
        this._ready  = false;

        /** Resolves when the worker has initialised (or immediately if falling back). */
        this.ready = this._init();
    }

    async _init() {
        if (typeof SharedArrayBuffer === 'undefined') {
            // No COOP/COEP headers — run pathfinding synchronously on main thread
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

        return new Promise((resolve) => {
            this._worker.onmessage = (e) => {
                if (e.data.type === 'READY') {
                    this._ready = true;
                    // Switch to normal message handler
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
        for (let y = 0; y < this._map.height; y++) {
            for (let x = 0; x < this._map.width; x++) {
                this._shared[y * this._map.width + x] = nav.isWalkable(x, y) ? 1 : 0;
            }
        }
        this._dirty = false;
    }

    _pushUpdate() {
        if (!this._worker || !this._shared) return;
        this._buildWalkability();
        // Transfer a copy — sab is already shared so worker reads live data after set()
        this._worker.postMessage({ type: 'UPDATE', data: this._shared });
    }

    _onMessage(e) {
        const { type, id, path } = e.data;
        if (type !== 'RESULT') return;
        const pending = this._pendingRequests.get(id);
        if (!pending) return;
        this._pendingRequests.delete(id);
        pending.resolve({ path: path ?? [], success: !!path?.length });
    }

    /** Mark walkability as stale (call after building placement/demolition). */
    invalidate() {
        this._dirty = true;
    }

    /**
     * Find path between two {x,y} points.
     * Returns a Promise resolving to { path: Array<{x,y}>, success: boolean }.
     */
    findPath(a, b) {
        // Fallback: use NavGrid synchronously and wrap result
        if (this._fallback || !this._ready) {
            const result = this._nav.findPath(a, b);
            return Promise.resolve(result);
        }

        if (this._dirty) this._pushUpdate();

        const id = this._nextId++;
        return new Promise((resolve, reject) => {
            this._pendingRequests.set(id, { resolve, reject });
            this._worker.postMessage({ type: 'FIND', id, sx: a.x, sy: a.y, tx: b.x, ty: b.y });
        });
    }

    /** Clean up worker when game is disposed. */
    destroy() {
        this._worker?.terminate();
        this._worker = null;
    }
}
