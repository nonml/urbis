/**
 * Memory Budget — Q12.F q12-mb-* (2GB medium / 4GB huge, evict at 80%, hard cap recoverable)
 * Also covers Q12.B LRU eviction semantics.
 */
const SOFT_CAP = {
    medium: 2 * 1024 * 1024 * 1024,
    huge: 4 * 1024 * 1024 * 1024,
};
const EVICT_AT = 0.8;

export class MemoryBudget {
    constructor(game, preset = 'medium') {
        this.game = game;
        this.preset = preset;
        this.softCap = preset === 'huge' ? SOFT_CAP.huge : SOFT_CAP.medium;
        this.evictThreshold = this.softCap * EVICT_AT;
        this.hardCap = this.softCap * 1.2;
        this.lastCheck = 0;
    }

    getHeap() {
        const mem = performance.memory;
        if (mem) return mem.usedJSHeapSize;
        // Approximation: 120 bytes per citizen + 80 per vehicle + 200 per building + 50M base
        const c = this.game?.citizens?.citizens?.length ?? 0;
        const v = this.game?.vehicles?.length ?? 0;
        const b = this.game?.buildings?.buildings?.length ?? 0;
        return 50 * 1024 * 1024 + c * 240 + v * 180 + b * 420;
    }

    check(now = performance.now()) {
        if (now - this.lastCheck < 2000) return { ok: true };
        this.lastCheck = now;
        const heap = this.getHeap();
        if (heap > this.hardCap) {
            return { ok: false, reason: 'hard_cap', heap, cap: this.hardCap, recoverable: true };
        }
        if (heap > this.evictThreshold) {
            // Trigger LRU eviction: ask ChunkManager to drop farthest chunk
            const cm = this.game?.chunks;
            if (cm && cm.loaded?.size > 9) {
                // Evict one far chunk (largest lastInRangeAt age)
                let oldest = null, oldestAt = Infinity;
                for (const [id, rec] of cm.loaded.entries()) {
                    if (rec.lastInRangeAt < oldestAt) { oldestAt = rec.lastInRangeAt; oldest = id; }
                }
                if (oldest) cm.loaded.delete(oldest);
            }
            return { ok: true, evicted: true, heap, threshold: this.evictThreshold };
        }
        return { ok: true, heap };
    }

    setPreset(preset) {
        this.preset = preset;
        this.softCap = preset === 'huge' ? SOFT_CAP.huge : SOFT_CAP.medium;
        this.evictThreshold = this.softCap * EVICT_AT;
        this.hardCap = this.softCap * 1.2;
    }
}
