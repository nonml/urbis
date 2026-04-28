/**
 * Dialogue Ducker — drops the music gain while a TTS line is playing.
 *
 * Pure math: emits a 0..1 multiplier each tick that the audio mixer
 * applies to its music channel.  No Web Audio import here, so this
 * runs in tests and in headless content tooling.
 *
 * Lifecycle of one duck event:
 *   - push(durationMs) starts (or extends) a duck active until
 *     elapsed + max(durationMs, fadeIn+fadeOut).
 *   - During [start, start+fadeIn]: gain ramps 1 → duckLevel.
 *   - During [start+fadeIn, end-fadeOut]: gain holds at duckLevel.
 *   - During [end-fadeOut, end]: gain ramps duckLevel → 1.
 *   - At t >= end: gain is 1, ducker becomes idle.
 *
 * Multiple overlapping dialogue lines extend the active window: the
 * end is max(existingEnd, newEnd). The start does not move once a
 * duck has begun, so a dialogue starting during a fade-out gracefully
 * cancels the fade-out and stays at the duck level.
 */

const DEFAULT = {
    duckLevel: 0.25,
    fadeInMs: 200,
    fadeOutMs: 400,
};

export class DialogueDucker {
    constructor(opts = {}) {
        this.duckLevel = opts.duckLevel ?? DEFAULT.duckLevel;
        this.fadeInMs = opts.fadeInMs ?? DEFAULT.fadeInMs;
        this.fadeOutMs = opts.fadeOutMs ?? DEFAULT.fadeOutMs;
        this._elapsedMs = 0;
        this._activeStartMs = -1;
        this._activeUntilMs = 0;
        this._currentMul = 1;
    }

    push(durationMs) {
        if (typeof durationMs !== 'number' || !(durationMs > 0)) return;
        const end = this._elapsedMs + Math.max(durationMs, this.fadeInMs + this.fadeOutMs);
        if (this._elapsedMs >= this._activeUntilMs) {
            this._activeStartMs = this._elapsedMs;
        }
        if (end > this._activeUntilMs) this._activeUntilMs = end;
    }

    update(dtMs) {
        if (typeof dtMs !== 'number' || dtMs < 0) return this._currentMul;
        this._elapsedMs += dtMs;
        if (this._elapsedMs >= this._activeUntilMs) {
            this._activeStartMs = -1;
            this._currentMul = 1;
            return 1;
        }
        const sinceStart = this._elapsedMs - this._activeStartMs;
        const remaining = this._activeUntilMs - this._elapsedMs;
        if (sinceStart < this.fadeInMs) {
            const k = sinceStart / this.fadeInMs;
            this._currentMul = 1 + (this.duckLevel - 1) * k;
        } else if (remaining < this.fadeOutMs) {
            const k = remaining / this.fadeOutMs;
            this._currentMul = this.duckLevel + (1 - this.duckLevel) * (1 - k);
        } else {
            this._currentMul = this.duckLevel;
        }
        return this._currentMul;
    }

    get gain() { return this._currentMul; }
    get isDucking() { return this._activeStartMs >= 0; }
}
