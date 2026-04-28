/**
 * Cinematic Camera Script — declarative JSON format for cutscenes.
 *
 * A script is a named sequence of shots.  Each shot describes a camera
 * move from one keyframe to another over a duration, with an easing
 * curve and optional FOV / roll.  Anchors let a keyframe reference a
 * world entity by id instead of a hard-coded position.
 *
 * Pure-data: no Three.js imports here.  Playback (q7-cc-playback) is
 * a separate module that consumes a validated script and drives the
 * actual render camera.
 *
 * Example:
 *   {
 *     id: 'intro_pan',
 *     name: 'Intro pan over downtown',
 *     shots: [
 *       {
 *         duration: 4,
 *         easing: 'easeInOutCubic',
 *         from: { pos: [100, 50, 100], lookAt: [50, 0, 50], fov: 60 },
 *         to:   { pos: [120, 30, 80],  lookAt: [60, 5, 60],  fov: 50 },
 *       },
 *     ],
 *   }
 */

export const VALID_EASING = new Set([
    'linear',
    'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
    'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
    'easeInSine', 'easeOutSine', 'easeInOutSine',
]);

export const CAMERA_SCRIPT_SCHEMA = {
    required: ['id', 'name', 'shots'],
    properties: {
        id: 'string',
        name: 'string',
        description: 'string',
        skippable: 'boolean',
        shots: 'array',
    },
};

const KEYFRAME_REQUIRED_VEC = ['pos', 'lookAt'];

function isVec3(v) {
    return Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n));
}

function validateKeyframe(kf, label, errors) {
    if (!kf || typeof kf !== 'object') {
        errors.push(`${label}: missing keyframe object`);
        return;
    }
    if (kf.anchor !== undefined) {
        if (typeof kf.anchor !== 'string' || !kf.anchor) {
            errors.push(`${label}: anchor must be a non-empty string`);
        }
    } else {
        for (const field of KEYFRAME_REQUIRED_VEC) {
            if (!isVec3(kf[field])) {
                errors.push(`${label}: ${field} must be a [x,y,z] number array`);
            }
        }
    }
    if (kf.fov !== undefined && (typeof kf.fov !== 'number' || kf.fov <= 0 || kf.fov >= 180)) {
        errors.push(`${label}: fov must be a number in (0, 180)`);
    }
    if (kf.roll !== undefined && typeof kf.roll !== 'number') {
        errors.push(`${label}: roll must be a number (radians)`);
    }
}

export function validateCameraScript(script) {
    const errors = [];
    if (!script || typeof script !== 'object') {
        return { valid: false, errors: ['script must be an object'] };
    }
    if (!script.id || typeof script.id !== 'string') {
        errors.push('Missing or invalid id');
    }
    if (!script.name || typeof script.name !== 'string') {
        errors.push('Missing or invalid name');
    }
    if (!Array.isArray(script.shots) || script.shots.length === 0) {
        errors.push('shots must be a non-empty array');
        return { valid: errors.length === 0, errors };
    }
    for (let i = 0; i < script.shots.length; i++) {
        const shot = script.shots[i];
        const tag = `Shot ${i}`;
        if (typeof shot.duration !== 'number' || !(shot.duration > 0)) {
            errors.push(`${tag}: duration must be a positive number (seconds)`);
        }
        if (shot.easing !== undefined && !VALID_EASING.has(shot.easing)) {
            errors.push(`${tag}: unknown easing '${shot.easing}'`);
        }
        validateKeyframe(shot.from, `${tag}.from`, errors);
        validateKeyframe(shot.to, `${tag}.to`, errors);
    }
    return { valid: errors.length === 0, errors };
}

export function totalDuration(script) {
    if (!script || !Array.isArray(script.shots)) return 0;
    let total = 0;
    for (const shot of script.shots) {
        if (typeof shot.duration === 'number' && shot.duration > 0) {
            total += shot.duration;
        }
    }
    return total;
}
