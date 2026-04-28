/**
 * Line cache stores — keyed by hash, hold synthesized WAV bytes plus
 * the duration metadata so we can re-build a result without re-running
 * the backend.
 *
 * MemoryStore: the default; fast, no persistence, LRU bounded.
 * FilesystemStore: Node-side persistence for offline pre-generation
 *   tooling and CI smoke tests.  One .wav per key, plus a sidecar
 *   .json with {durationMs, voiceId} so the WAV stays a real audio
 *   file.  Safe key names: only the FNV-1a hash + voice id pair we
 *   already produce — no path traversal.
 *
 * IndexedDB: not implemented here.  When the browser runtime needs
 * persistence, add a third class implementing the same interface.
 */

const KEY_RE = /^[A-Za-z0-9_.\-:]+$/;

function safeKey(key) {
    if (!KEY_RE.test(key)) throw new Error(`Unsafe cache key: ${key}`);
    return key.replace(/[:]/g, '__');
}

export class MemoryCacheStore {
    constructor({ cacheSize = 256 } = {}) {
        this._map = new Map();
        this._cap = cacheSize;
    }

    async get(key) {
        if (!this._map.has(key)) return null;
        const v = this._map.get(key);
        this._map.delete(key);
        this._map.set(key, v);
        return v;
    }

    async put(key, entry) {
        this._map.set(key, entry);
        if (this._map.size > this._cap) {
            const oldest = this._map.keys().next().value;
            this._map.delete(oldest);
        }
    }

    async clear() { this._map.clear(); }
    get size() { return this._map.size; }
}

export class FilesystemCacheStore {
    constructor({ baseDir }) {
        if (!baseDir) throw new Error('FilesystemCacheStore requires baseDir');
        this.baseDir = baseDir;
        this._fs = null;
        this._path = null;
    }

    async _mod() {
        if (!this._fs) {
            this._fs = await import('fs/promises');
            this._path = await import('path');
            await this._fs.mkdir(this.baseDir, { recursive: true });
        }
        return { fs: this._fs, path: this._path };
    }

    _paths(key) {
        const safe = safeKey(key);
        return {
            wav: this._path.join(this.baseDir, `${safe}.wav`),
            meta: this._path.join(this.baseDir, `${safe}.json`),
        };
    }

    async get(key) {
        const { fs } = await this._mod();
        const { wav, meta } = this._paths(key);
        try {
            const [audioBuf, metaRaw] = await Promise.all([
                fs.readFile(wav),
                fs.readFile(meta, 'utf8'),
            ]);
            const m = JSON.parse(metaRaw);
            return {
                audio: new Uint8Array(audioBuf.buffer, audioBuf.byteOffset, audioBuf.byteLength),
                durationMs: m.durationMs,
                voiceId: m.voiceId,
                key,
            };
        } catch (e) {
            if (e.code === 'ENOENT') return null;
            throw e;
        }
    }

    async put(key, entry) {
        const { fs } = await this._mod();
        const { wav, meta } = this._paths(key);
        await Promise.all([
            fs.writeFile(wav, Buffer.from(entry.audio.buffer, entry.audio.byteOffset, entry.audio.byteLength)),
            fs.writeFile(meta, JSON.stringify({ durationMs: entry.durationMs, voiceId: entry.voiceId })),
        ]);
    }

    async clear() {
        const { fs } = await this._mod();
        try {
            const entries = await fs.readdir(this.baseDir);
            await Promise.all(entries.map(e => fs.unlink(this._path.join(this.baseDir, e))));
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }
    }
}
