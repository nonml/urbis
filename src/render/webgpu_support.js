// WebGPU capability detection — used by Q11.B GPU-driven culling to select
// between WebGPU indirect-draw path and CPU coarse-cull fallback.

/**
 * @typedef {Object} WebGPUCapabilities
 * @property {boolean} available
 * @property {GPUAdapter|null} adapter
 * @property {GPUDevice|null} device
 * @property {string[]} features
 * @property {Record<string,number>} limits
 * @property {string|null} error
 */

/** @type {WebGPUCapabilities|null} */
let _cached = null;

/**
 * Detect WebGPU support and return a capabilities object.
 * Result is cached after the first call.
 *
 * @returns {Promise<WebGPUCapabilities>}
 */
export async function detectWebGPU() {
    if (_cached) return _cached;

    if (typeof navigator === 'undefined' || !navigator.gpu) {
        return (_cached = { available: false, adapter: null, device: null, features: [], limits: {}, error: 'navigator.gpu absent' });
    }

    try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) {
            return (_cached = { available: false, adapter: null, device: null, features: [], limits: {}, error: 'no adapter' });
        }

        const device = await adapter.requestDevice({ requiredFeatures: [] });
        const features = [...(adapter.features ?? [])];
        const lim = adapter.limits ?? {};
        const limits = {
            maxComputeWorkgroupsPerDimension: lim.maxComputeWorkgroupsPerDimension ?? 0,
            maxStorageBufferBindingSize: lim.maxStorageBufferBindingSize ?? 0,
            maxBindingsPerBindGroup: lim.maxBindingsPerBindGroup ?? 0,
        };

        return (_cached = { available: true, adapter, device, features, limits, error: null });
    } catch (e) {
        return (_cached = { available: false, adapter: null, device: null, features: [], limits: {}, error: e.message });
    }
}

/**
 * Synchronously report whether WebGPU has been confirmed available.
 * Returns false until detectWebGPU() has been awaited at least once.
 *
 * @returns {boolean}
 */
export function isWebGPUAvailable() {
    return !!(_cached?.available);
}

/**
 * Release cached adapter/device (for tests / graceful shutdown).
 */
export function releaseWebGPU() {
    _cached?.device?.destroy();
    _cached = null;
}
