/**
 * Subtitle timing — produce per-word cues from a transcript and an
 * audio duration.
 *
 * Why word-level and not literal phonemes: piper-tts-web exposes a
 * single WAV blob with no phoneme alignment metadata.  Without a
 * forced aligner (whisperx, MFA — heavyweight) the next-best signal
 * is a proportional split over word length.  Long words get bigger
 * slots, punctuation contributes a small pause weight, the cues sum
 * exactly to the audio duration.  In practice this gives a subtitle
 * that "lights up" word-by-word in time with the speech — which is
 * the UX target.
 *
 * Cues are inclusive-start, exclusive-end in milliseconds:
 *   { word: 'Hello', startMs: 0, endMs: 320, idx: 0 }
 */

const PUNCTUATION_PAUSE = { ',': 1.5, ';': 2, ':': 1.5, '.': 2.5, '!': 2.5, '?': 2.5 };

function tokenize(text) {
    const tokens = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        tokens.push({ word: m[0], offset: m.index });
    }
    return tokens;
}

function weightFor(word) {
    let w = Math.max(1, word.length);
    const last = word[word.length - 1];
    if (PUNCTUATION_PAUSE[last]) w += PUNCTUATION_PAUSE[last];
    return w;
}

export function buildSubtitleCues(text, durationMs) {
    if (typeof text !== 'string' || !text.trim()) return [];
    if (typeof durationMs !== 'number' || !(durationMs > 0)) return [];

    const tokens = tokenize(text);
    if (tokens.length === 0) return [];

    const weights = tokens.map(t => weightFor(t.word));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const cues = [];
    let acc = 0;
    for (let i = 0; i < tokens.length; i++) {
        const startMs = Math.round((acc / totalWeight) * durationMs);
        acc += weights[i];
        const endMs = i === tokens.length - 1
            ? durationMs
            : Math.round((acc / totalWeight) * durationMs);
        cues.push({ word: tokens[i].word, startMs, endMs, idx: i });
    }
    return cues;
}

export function findCueAt(cues, ms) {
    if (!Array.isArray(cues) || cues.length === 0) return null;
    if (ms < 0) return null;
    if (ms >= cues[cues.length - 1].endMs) return null;
    let lo = 0, hi = cues.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const c = cues[mid];
        if (ms < c.startMs) hi = mid - 1;
        else if (ms >= c.endMs) lo = mid + 1;
        else return c;
    }
    return null;
}
