/**
 * Camera Script Player — drives a validated camera script over time.
 *
 * Pure math: emits {pos, lookAt, fov, roll} arrays each frame.  The
 * renderer copies these into THREE objects.  No Three.js import here
 * so this is unit-testable headlessly.
 *
 * Anchors: a keyframe with `anchor: 'someId'` is resolved each frame by
 * a caller-supplied function.  The resolver returns a snapshot of the
 * anchor's current position and a sensible look-at, e.g.:
 *     anchorResolver('player') -> { pos: [x,y,z], lookAt: [x,y,z] }
 * If the resolver returns null, the previous-frame snapshot is reused;
 * if no snapshot exists yet, the keyframe is skipped (zeroed).
 */

import { validateCameraScript } from './script_schema.js';

const EASING = {
    linear:         t => t,
    easeInQuad:     t => t * t,
    easeOutQuad:    t => 1 - (1 - t) * (1 - t),
    easeInOutQuad:  t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    easeInCubic:    t => t * t * t,
    easeOutCubic:   t => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeInSine:     t => 1 - Math.cos((t * Math.PI) / 2),
    easeOutSine:    t => Math.sin((t * Math.PI) / 2),
    easeInOutSine:  t => -(Math.cos(Math.PI * t) - 1) / 2,
};

const DEFAULT_FOV = 60;

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpVec3(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export class CameraScriptPlayer {
    constructor(script, anchorResolver = null) {
        const v = validateCameraScript(script);
        if (!v.valid) {
            throw new Error(`Invalid camera script: ${v.errors.join('; ')}`);
        }
        this.script = script;
        this.anchorResolver = anchorResolver;
        this._lastAnchor = new Map();
        this._active = false;
        this._finished = false;
        this._elapsed = 0;
        this._shotIdx = 0;
        this._pose = { pos: [0, 0, 0], lookAt: [1, 0, 0], fov: DEFAULT_FOV, roll: 0 };
    }

    start() {
        this._active = true;
        this._finished = false;
        this._elapsed = 0;
        this._shotIdx = 0;
        this._lastAnchor.clear();
        this._refreshPose();
    }

    stop() {
        this._active = false;
        this._finished = true;
    }

    skip() {
        this._shotIdx = this.script.shots.length;
        this._active = false;
        this._finished = true;
    }

    isActive() { return this._active; }
    isFinished() { return this._finished; }
    get currentShotIndex() { return this._shotIdx; }

    update(dt) {
        if (!this._active || this._finished) return;
        if (typeof dt !== 'number' || !(dt >= 0)) return;
        this._elapsed += dt;
        const shots = this.script.shots;
        while (this._shotIdx < shots.length && this._elapsed > shots[this._shotIdx].duration) {
            this._elapsed -= shots[this._shotIdx].duration;
            this._shotIdx++;
        }
        if (this._shotIdx >= shots.length) {
            this._shotIdx = shots.length - 1;
            this._elapsed = shots[this._shotIdx].duration;
            this._active = false;
            this._finished = true;
        }
        this._refreshPose();
    }

    getPose() {
        return {
            pos: this._pose.pos.slice(),
            lookAt: this._pose.lookAt.slice(),
            fov: this._pose.fov,
            roll: this._pose.roll,
        };
    }

    _resolveKeyframe(kf) {
        if (kf.anchor) {
            let snap = this.anchorResolver ? this.anchorResolver(kf.anchor) : null;
            if (!snap) snap = this._lastAnchor.get(kf.anchor);
            if (!snap) return null;
            this._lastAnchor.set(kf.anchor, snap);
            return {
                pos: snap.pos,
                lookAt: snap.lookAt ?? snap.pos,
                fov: kf.fov ?? snap.fov ?? DEFAULT_FOV,
                roll: kf.roll ?? 0,
            };
        }
        return {
            pos: kf.pos,
            lookAt: kf.lookAt,
            fov: kf.fov ?? DEFAULT_FOV,
            roll: kf.roll ?? 0,
        };
    }

    _refreshPose() {
        const shots = this.script.shots;
        if (this._shotIdx >= shots.length) return;
        const shot = shots[this._shotIdx];
        const from = this._resolveKeyframe(shot.from);
        const to = this._resolveKeyframe(shot.to);
        if (!from || !to) return;
        const easeFn = EASING[shot.easing] ?? EASING.linear;
        const raw = Math.min(1, this._elapsed / shot.duration);
        const t = easeFn(raw);
        this._pose.pos = lerpVec3(from.pos, to.pos, t);
        this._pose.lookAt = lerpVec3(from.lookAt, to.lookAt, t);
        this._pose.fov = lerp(from.fov, to.fov, t);
        this._pose.roll = lerp(from.roll, to.roll, t);
    }
}
