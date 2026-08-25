// Chunk streaming utilities and runtime manager.

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function getChunkId(x, y, chunkSize = 32) {
    const cx = Math.floor(x / chunkSize);
    const cy = Math.floor(y / chunkSize);
    return `${cx},${cy}`;
}

export function getChunkBounds(id, chunkSize = 32, width = 0, height = 0) {
    const [cx, cy] = id.split(',').map(Number);
    const minX = cx * chunkSize;
    const minY = cy * chunkSize;
    const maxX = clamp(((cx + 1) * chunkSize) - 1, 0, Math.max(0, width - 1));
    const maxY = clamp(((cy + 1) * chunkSize) - 1, 0, Math.max(0, height - 1));
    return { minX, minY, maxX, maxY };
}

function chunkIdToCoords(id) {
    const [cx, cy] = id.split(',').map(Number);
    return { cx, cy };
}

function chunkCoordsToId(cx, cy) {
    return `${cx},${cy}`;
}

export class ChunkManager {
    constructor(width, height, options = {}) {
        this.width = width;
        this.height = height;
        this.chunkSize = options.chunkSize ?? 32;
        this.activeRadius = options.activeRadius ?? 3;
        this.unloadDelayMs = options.unloadDelayMs ?? 2000;
        this.loaded = new Map(); // id -> { lastInRangeAt }
    }

    getVisibleChunks(playerPos, pinnedTiles = []) {
        const ids = new Set();
        const baseCx = Math.floor(playerPos.x / this.chunkSize);
        const baseCy = Math.floor(playerPos.y / this.chunkSize);

        for (let dy = -this.activeRadius; dy <= this.activeRadius; dy++) {
            for (let dx = -this.activeRadius; dx <= this.activeRadius; dx++) {
                const cx = baseCx + dx;
                const cy = baseCy + dy;
                if (cx < 0 || cy < 0) continue;
                if (cx * this.chunkSize >= this.width) continue;
                if (cy * this.chunkSize >= this.height) continue;
                ids.add(chunkCoordsToId(cx, cy));
            }
        }

        for (const tile of pinnedTiles) {
            if (tile && Number.isFinite(tile.x) && Number.isFinite(tile.y)) {
                ids.add(getChunkId(tile.x, tile.y, this.chunkSize));
            }
        }

        return ids;
    }

    // Prefetch heuristic — chunks ahead of velocity vector (Q12.B q12-st-prefetch-heuristic)
    getPrefetchChunks(playerPos, velocity = { x: 0, y: 0 }, count = 3) {
        const ids = new Set();
        const speed = Math.hypot(velocity.x ?? 0, velocity.y ?? 0);
        if (speed < 0.01) return ids;
        const nx = (velocity.x ?? 0) / speed;
        const ny = (velocity.y ?? 0) / speed;
        const baseCx = Math.floor(playerPos.x / this.chunkSize);
        const baseCy = Math.floor(playerPos.y / this.chunkSize);
        for (let i = 1; i <= count; i++) {
            const cx = baseCx + Math.round(nx * i);
            const cy = baseCy + Math.round(ny * i);
            if (cx < 0 || cy < 0) continue;
            if (cx * this.chunkSize >= this.width) continue;
            if (cy * this.chunkSize >= this.height) continue;
            ids.add(chunkCoordsToId(cx, cy));
        }
        return ids;
    }

    // Worker-only chunk request path (Q12.B q12-st-worker-only)
    // Main thread never touches filesystem; it posts to asset_decoder_worker
    // and the worker posts back when the chunk buffer is ready.
    async requestChunkViaWorker(chunkId, worker) {
        if (!worker) return null;
        return new Promise((resolve) => {
            const id = `chunk_${chunkId}_${Date.now()}`;
            const onMsg = (e) => {
                if (e.data?.id === id) { worker.removeEventListener('message', onMsg); resolve(e.data.result); }
            };
            worker.addEventListener('message', onMsg);
            worker.postMessage({ type: 'DECODE', id, assetType: 'chunk', buffer: new ArrayBuffer(0), meta: { chunkId } });
            setTimeout(() => { worker.removeEventListener('message', onMsg); resolve(null); }, 80);
        });
    }

    update(playerPos, pinnedTiles = [], now = performance.now()) {
        const visible = this.getVisibleChunks(playerPos, pinnedTiles);
        const loadedNow = [];
        const unloadedNow = [];

        for (const id of visible) {
            const rec = this.loaded.get(id);
            if (!rec) {
                this.loaded.set(id, { lastInRangeAt: now });
                loadedNow.push(id);
            } else {
                rec.lastInRangeAt = now;
            }
        }

        for (const [id, rec] of this.loaded.entries()) {
            if (visible.has(id)) continue;
            if (now - rec.lastInRangeAt < this.unloadDelayMs) continue;
            this.loaded.delete(id);
            unloadedNow.push(id);
        }

        return {
            active: Array.from(this.loaded.keys()),
            loadedNow,
            unloadedNow,
        };
    }

    isLoaded(id) {
        return this.loaded.has(id);
    }

    getActiveChunkCount() {
        return this.loaded.size;
    }

    getChunkCoords(id) {
        return chunkIdToCoords(id);
    }

    getChunkBounds(id) {
        return getChunkBounds(id, this.chunkSize, this.width, this.height);
    }
}
