// Deterministic RNG (xorshift32) for reproducible worlds
// Usage:
//   const rng = new RNG(seed);
//   rng.next() -> [0,1)
//   rng.int(min, max) inclusive
//   rng.float(min, max)
//   rng.chance(p)

// Non-deterministic helpers (no Math.random) for generating seeds/ids.
// These do NOT affect deterministic simulation (they are only used when user does not provide a seed).
export function randomU32() {
    // Prefer Web Crypto when available (browser + modern runtimes)
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
        const buf = new Uint32Array(1);
        cryptoObj.getRandomValues(buf);
        return buf[0] >>> 0;
    }
    // Fallback: time-based xorshift (still no Math.random)
    let x = (Date.now() >>> 0) ^ ((performance?.now?.() ?? 0) * 1000 >>> 0);
    x ^= (x << 13) >>> 0;
    x ^= (x >>> 17) >>> 0;
    x ^= (x << 5) >>> 0;
    return x >>> 0;
}

export function randomSeed32() {
    return randomU32();
}

export function randomId(prefix = 'run') {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && cryptoObj.randomUUID) return `${prefix}_${cryptoObj.randomUUID()}`;

    // uuid-ish fallback from random bytes
    if (cryptoObj && cryptoObj.getRandomValues) {
        const bytes = new Uint8Array(16);
        cryptoObj.getRandomValues(bytes);
        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
        return `${prefix}_${hex}`;
    }

    // final fallback: time + randomU32
    return `${prefix}_${Date.now().toString(16)}_${randomU32().toString(16)}`;
}


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

    // Pick a random element from an array
    pick(arr) {
        if (!arr || arr.length === 0) return undefined;
        const idx = this.int(0, arr.length - 1);
        return arr[idx];
    }

    // Pick weighted random element
    // weights must sum to 1 (or close enough)
    pickWeighted(items, weights) {
        if (!items || !weights || items.length !== weights.length) {
            return undefined;
        }

        const total = weights.reduce((s, w) => s + w, 0);
        let roll = this.float(0, total);

        for (let i = 0; i < items.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return items[i];
        }

        return items[items.length - 1];
    }
}
