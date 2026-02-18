// Deterministic RNG used across the whole game.
//
// Design goals:
// - Fast, tiny, repeatable across browsers
// - Provides helpers used throughout the codebase (next/int/float/chance)

export class RNG {
    constructor(seed = 1) {
        // Force to uint32
        this.state = (seed >>> 0) || 1;
    }

    // Returns float in [0, 1)
    next() {
        // xorshift32
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return (this.state >>> 0) / 4294967296;
    }

    // Float in [min, max)
    float(min = 0, max = 1) {
        return min + (max - min) * this.next();
    }

    // Int in [min, max] inclusive
    int(min, max) {
        if (max < min) [min, max] = [max, min];
        const r = this.next();
        return Math.floor(r * (max - min + 1)) + min;
    }

    // True with probability p (0..1)
    chance(p) {
        if (p <= 0) return false;
        if (p >= 1) return true;
        return this.next() < p;
    }

    pick(arr) {
        if (!arr || arr.length === 0) return undefined;
        return arr[this.int(0, arr.length - 1)];
    }
}
