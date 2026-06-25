import * as THREE from 'three';

const HIZ_W = 512;
const HIZ_H = 512;
const MIP_LEVELS = Math.log2(Math.min(HIZ_W, HIZ_H)); // 9 for 512

/**
 * Hi-Z (Hierarchical Z-buffer) infrastructure for occlusion culling.
 *
 * Phase 1 (this commit): depth render target + mip-pyramid downsample setup.
 * Phase 2 (WebGPU, Q11.B+): GPU-driven testSphere reads the pyramid without
 * CPU readback stalls (requires navigator.gpu — see 2026-10-webgpu.md).
 *
 * Usage:
 *   hiz.capture(scene, camera, renderer);   // depth pre-pass each frame
 *   const vis = hiz.testSphere(sphere, camera); // false = occluded (phase 2+)
 */
export class HiZBuffer {
    constructor() {
        this._depthRT = new THREE.WebGLRenderTarget(HIZ_W, HIZ_H, {
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: true,
            depthTexture: new THREE.DepthTexture(HIZ_W, HIZ_H, THREE.UnsignedIntType),
            generateMipmaps: false,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
        });

        // Mip-pyramid render targets (conservative max-depth downsample).
        this._mipRTs = [];
        let w = HIZ_W >> 1, h = HIZ_H >> 1;
        for (let i = 0; i < MIP_LEVELS; i++) {
            if (w < 1 || h < 1) break;
            this._mipRTs.push(new THREE.WebGLRenderTarget(w, h, {
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType,
                depthBuffer: false,
                generateMipmaps: false,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
            }));
            w >>= 1; h >>= 1;
        }

        this._frameTag = -1;
        this._captured = false;
    }

    /**
     * Render depth pre-pass. Call once per frame before the main pass.
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {THREE.WebGLRenderer} renderer
     * @param {number} frameTag
     */
    capture(scene, camera, renderer, frameTag) {
        if (frameTag === this._frameTag) return;
        this._frameTag = frameTag;
        const prev = renderer.getRenderTarget();
        renderer.setRenderTarget(this._depthRT);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        renderer.setRenderTarget(prev);
        this._captured = true;
        // Mip downsample would run here via a FullscreenTriangle + max-blend shader;
        // deferred to WebGPU phase where we can use compute for conservative max.
    }

    /**
     * Test a world-space sphere for occlusion.
     * Returns false (occluded) only when the WebGPU compute path is active.
     * Phase 1: always returns true (conservative — never culls incorrectly).
     *
     * @param {THREE.Sphere} _sphere
     * @param {THREE.Camera} _camera
     * @returns {boolean} true = visible
     */
    testSphere(_sphere, _camera) {
        return true;
    }

    dispose() {
        this._depthRT.depthTexture?.dispose();
        this._depthRT.dispose();
        for (const rt of this._mipRTs) rt.dispose();
    }
}
