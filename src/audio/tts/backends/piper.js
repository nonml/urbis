/**
 * Piper TTS backend — wraps `@mintplex-labs/piper-tts-web`.
 *
 * Browser-only: piper-tts-web uses Web Workers and OPFS for model
 * caching, neither of which exist headlessly.  Service.js routes to
 * the StubBackend when not in a browser, so this module is only
 * imported via dynamic import at synthesize-time.
 *
 * Voice models are downloaded from HuggingFace on first use of each
 * voiceId and cached in OPFS by piper-tts-web.  First call per voice
 * therefore takes seconds; subsequent calls are fast.
 */

import { TtsSession } from '@mintplex-labs/piper-tts-web';

const SAMPLE_RATE = 22050;

async function blobToUint8(blob) {
    const arr = await blob.arrayBuffer();
    return new Uint8Array(arr);
}

function estimateWavDurationMs(bytes) {
    if (bytes.length < 44) return 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dataBytes = view.getUint32(40, true);
    const sampleRate = view.getUint32(24, true) || SAMPLE_RATE;
    const bitsPerSample = view.getUint16(34, true) || 16;
    const channels = view.getUint16(22, true) || 1;
    const samples = dataBytes / ((bitsPerSample / 8) * channels);
    return Math.round((samples / sampleRate) * 1000);
}

export class PiperBackend {
    constructor() {
        this._sessions = new Map();
    }

    get id() { return 'piper'; }

    async _session(voiceId) {
        let s = this._sessions.get(voiceId);
        if (s) {
            await s.waitReady;
            return s;
        }
        s = await TtsSession.create({ voiceId });
        this._sessions.set(voiceId, s);
        return s;
    }

    async synthesize(text, voiceId) {
        const session = await this._session(voiceId);
        const blob = await session.predict(text);
        const audio = await blobToUint8(blob);
        return {
            audio,
            durationMs: estimateWavDurationMs(audio),
            voiceId,
            sampleRate: SAMPLE_RATE,
        };
    }
}
