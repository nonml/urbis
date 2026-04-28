/**
 * Cinematic Controller — owns the currently-playing camera script and
 * mediates skip requests.
 *
 * Why a controller and not direct CameraScriptPlayer use: cutscenes
 * have a UX layer around them — the "press ESC to skip" prompt, the
 * "skippable=false" gate, and the lifecycle of starting/stopping
 * playback.  This module concentrates that policy so the renderer
 * just calls `update(dt)` and reads `getPose()` / `getSkipPrompt()`.
 */

import { CameraScriptPlayer } from './script_player.js';

const DEFAULT_PROMPT = 'press ESC to skip';

export class CinematicController {
    constructor(opts = {}) {
        this._player = null;
        this._script = null;
        this._skipPrompt = opts.prompt ?? DEFAULT_PROMPT;
        this._anchorResolver = opts.anchorResolver ?? null;
        this._onComplete = null;
    }

    play(script, { anchorResolver, onComplete } = {}) {
        this._script = script;
        this._player = new CameraScriptPlayer(script, anchorResolver ?? this._anchorResolver);
        this._player.start();
        this._onComplete = onComplete ?? null;
    }

    update(dt) {
        if (!this._player) return;
        const wasFinished = this._player.isFinished();
        this._player.update(dt);
        if (!wasFinished && this._player.isFinished()) {
            this._fireComplete('completed');
        }
    }

    requestSkip() {
        if (!this._player || this._player.isFinished()) return false;
        if (this._script && this._script.skippable === false) return false;
        this._player.skip();
        this._fireComplete('skipped');
        return true;
    }

    getPose() { return this._player ? this._player.getPose() : null; }

    isPlaying() { return !!this._player && !this._player.isFinished(); }

    getSkipPrompt() {
        if (!this.isPlaying()) return null;
        if (this._script && this._script.skippable === false) return null;
        return this._skipPrompt;
    }

    currentScriptId() { return this._script ? this._script.id : null; }

    _fireComplete(reason) {
        const cb = this._onComplete;
        this._onComplete = null;
        const finishedScript = this._script;
        this._player = null;
        this._script = null;
        if (cb) cb({ reason, scriptId: finishedScript?.id ?? null });
    }
}
