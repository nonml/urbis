/**
 * Stub TTS backend — produces a silent WAV buffer of length
 * proportional to the input text.  Used in headless tests and as a
 * fallback when no real engine is available.
 *
 * Speaking-rate model: 165 words/min ≈ 2.75 wps.  We expand to a
 * conservative 14 chars/sec assuming average word length 5.  Output
 * is a 16-bit mono PCM WAV at 22.05 kHz (matching Piper defaults).
 */

const SAMPLE_RATE = 22050;
const CHARS_PER_SEC = 14;
const MIN_DURATION_MS = 200;

function buildSilentWav(durationMs) {
    const samples = Math.floor((durationMs / 1000) * SAMPLE_RATE);
    const dataBytes = samples * 2;
    const buf = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buf);
    let p = 0;
    function writeStr(s) { for (const c of s) view.setUint8(p++, c.charCodeAt(0)); }
    writeStr('RIFF');
    view.setUint32(p, 36 + dataBytes, true); p += 4;
    writeStr('WAVE');
    writeStr('fmt ');
    view.setUint32(p, 16, true); p += 4;
    view.setUint16(p, 1, true); p += 2;
    view.setUint16(p, 1, true); p += 2;
    view.setUint32(p, SAMPLE_RATE, true); p += 4;
    view.setUint32(p, SAMPLE_RATE * 2, true); p += 4;
    view.setUint16(p, 2, true); p += 2;
    view.setUint16(p, 16, true); p += 2;
    writeStr('data');
    view.setUint32(p, dataBytes, true); p += 4;
    return new Uint8Array(buf);
}

export class StubBackend {
    get id() { return 'stub'; }

    async synthesize(text, voiceId) {
        const durationMs = Math.max(MIN_DURATION_MS,
            Math.round((text.length / CHARS_PER_SEC) * 1000));
        const audio = buildSilentWav(durationMs);
        return { audio, durationMs, voiceId, sampleRate: SAMPLE_RATE };
    }
}
