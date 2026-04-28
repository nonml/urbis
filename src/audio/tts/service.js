/**
 * TTS Service — facade over a pluggable speech-synthesis backend.
 *
 * Browser path: lazy-loads `@mintplex-labs/piper-tts-web` via the
 * Piper backend on first synthesize() call.  Models are fetched from
 * HuggingFace and cached in OPFS by piper-tts-web itself.
 *
 * Node/test path: defaults to the StubBackend, which produces a
 * deterministic silent WAV buffer of length proportional to the text.
 * No worker, no network, no Three.js.
 *
 * Caching: each (text, voiceId) request is hashed.  Repeat requests
 * return the cached blob without re-invoking the backend.  This is
 * the q7-tts-line-cache hook — populated here, persisted later.
 */

import { StubBackend } from './backends/stub.js';
import { resolveVoiceId } from './voicebank.js';
import { MemoryCacheStore } from './cache.js';
import { buildSubtitleCues } from './subtitle_sync.js';

const DEFAULT_VOICE = 'en_US-amy-medium';

function isBrowser() {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

export function lineHash(text, voiceId) {
    return `${voiceId}:${fnv1a(text)}`;
}

export class TTSService {
    constructor(opts = {}) {
        this.defaultVoice = opts.defaultVoice ?? DEFAULT_VOICE;
        this.backend = opts.backend ?? null;
        this.store = opts.store ?? new MemoryCacheStore({ cacheSize: opts.cacheSize ?? 256 });
        this._backendCalls = 0;
    }

    async _ensureBackend() {
        if (this.backend) return this.backend;
        if (!isBrowser()) {
            this.backend = new StubBackend();
            return this.backend;
        }
        const { PiperBackend } = await import('./backends/piper.js');
        this.backend = new PiperBackend();
        return this.backend;
    }

    async synthesize(text, voiceId = this.defaultVoice) {
        if (typeof text !== 'string' || !text) {
            throw new Error('TTS: text must be a non-empty string');
        }
        const key = lineHash(text, voiceId);
        const hit = await this.store.get(key);
        if (hit) {
            return { ...hit, cues: buildSubtitleCues(text, hit.durationMs), text, cached: true };
        }
        const backend = await this._ensureBackend();
        this._backendCalls++;
        const result = await backend.synthesize(text, voiceId);
        const entry = { audio: result.audio, durationMs: result.durationMs, voiceId, key };
        await this.store.put(key, entry);
        return { ...entry, cues: buildSubtitleCues(text, entry.durationMs), text, cached: false };
    }

    async synthesizeAs(archetypeId, text) {
        return this.synthesize(text, resolveVoiceId(archetypeId));
    }

    async has(text, voiceId = this.defaultVoice) {
        return (await this.store.get(lineHash(text, voiceId))) !== null;
    }

    async clearCache() { await this.store.clear(); }

    get backendCallCount() { return this._backendCalls; }
}
