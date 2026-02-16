// Deterministic RNG (xorshift32) for reproducible worlds
// Usage:
//   const rng = new RNG(seed);
//   rng.next() -> [0,1)
//   rng.int(min, max) inclusive
//   rng.float(min, max)
//   rng.chance(p)

export class RNG {
    constructor(seed = 123456789) {
        // Force uint32
        this.state = (seed >>> 0) || 1;
    }

    // Returns uint32
    _nextU32() {
        // xorshift32
        let x = this.state;
        x ^= (x << 13) >>> 0;
        x ^= (x >>> 17) >>> 0;
        x ^= (x << 5) >>> 0;
        this.state = x >>> 0;
        return this.state;
    }

    // Returns float in [0,1)
    next() {
        // 2^32 = 4294967296
        return this._nextU32() / 4294967296;
    }

    // Inclusive integer range
    int(min, max) {
        const a = Math.ceil(min);
        const b = Math.floor(max);
        if (b < a) return a;
        const span = (b - a + 1) >>> 0;
        return a + Math.floor(this.next() * span);
    }

    float(min, max) {
        return min + (max - min) * this.next();
    }

    chance(p) {
        return this.next() < p;
    }
}
