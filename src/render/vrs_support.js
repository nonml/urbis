/**
 * Variable Rate Shading (VRS) capability detection (Q11.F).
 *
 * WebGL has no native VRS. Software VRS emulates a 2×2 shading rate by
 * rendering a region (the sky) into a half-resolution target and upscaling
 * it: one shader invocation covers 2×2 pixels. Native hardware VRS (WebGPU
 * `fragment-shading-rate` optional feature) is detected when present.
 */

export const VRS_RATE = Object.freeze({
    NONE: 'none',
    X1X1: '1x1',
    X2X2: '2x2',
});

/** 2×2 rate renders each 2×2 block once → half resolution per axis. */
export const VRS_SKY_SCALE = 0.5;

/**
 * Detect the software VRS path. Always available — any GPU can run the
 * half-res sky pass, so this is the honest baseline capability.
 *
 * @returns {{available: boolean, mode: string, rate: string, reason: string}}
 */
export function detectVRS() {
    return {
        available: true,
        mode: 'software',
        rate: VRS_RATE.X2X2,
        reason: 'software region-based sky scaling (2x2)',
    };
}

/**
 * Detect native hardware VRS via the WebGPU `fragment-shading-rate` optional
 * feature. Async because adapter enumeration is async; returns null when the
 * feature (or WebGPU) is unavailable, so callers keep the software fallback.
 *
 * @returns {Promise<{available: boolean, mode: string, rate: string, reason: string}|null>}
 */
export async function detectHardwareVRS() {
    try {
        const gpu = typeof navigator !== 'undefined' ? navigator.gpu : null;
        if (!gpu) return null;
        const adapter = await gpu.requestAdapter();
        if (!adapter || !adapter.features) return null;
        if (adapter.features.has('fragment-shading-rate')) {
            return {
                available: true,
                mode: 'hardware',
                rate: VRS_RATE.X2X2,
                reason: 'WebGPU fragment-shading-rate',
            };
        }
    } catch {
        /* WebGPU unavailable or feature denied — fall back to software VRS. */
    }
    return null;
}

/**
 * Decide whether a preset opts into VRS. Pure — used by applyPreset and by
 * tests. A preset opts in only when it declares VRS AND a sub-1x1 sky rate.
 *
 * @param {object|undefined} preset - a PRESETS entry
 * @param {boolean} supported - whether a VRS mechanism is available
 * @returns {boolean}
 */
export function shouldEnableVRS(preset, supported) {
    if (!preset || !supported) return false;
    return !!preset.vrs && preset.vrsSkyRate !== undefined && preset.vrsSkyRate !== VRS_RATE.X1X1;
}
