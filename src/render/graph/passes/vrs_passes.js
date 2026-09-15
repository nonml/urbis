/**
 * Software VRS passes (Q11.F) — 2×2 shading rate for the sky and the far
 * band, emulated as region-based resolution scaling.
 *
 * VRSPrePass shades the sky + far-band scene (beyond VRS_FAR_DIST, where the
 * renderer already culls all detail) into a half-resolution target: one
 * shader invocation per 2×2 output block.
 *
 * VRSCompositePass merges that low-res result back: wherever the full-res
 * scene pass drew nothing (depth at the far plane — sky, and the far band
 * clipped out by the near plane), the 2×2 result is used. Everything within
 * the near region keeps its full-res shading.
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { VRS_SKY_SCALE, VRS_FAR_SCALE } from '../../vrs_support.js';

export class VRSPrePass extends Pass {
    constructor(scene, camera, farPlane) {
        super();
        this.needsSwap = false;
        this._scene = scene;
        this._camera = camera;
        this._farPlane = farPlane;
        this._dome = null;
        this._target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
        this._target.texture.minFilter = THREE.LinearFilter;
        this._target.texture.magFilter = THREE.LinearFilter;
        this._target.texture.generateMipmaps = false;
        this.texture = this._target.texture;
    }

    /** Attach the gradient sky dome so it is shaded at the reduced rate. */
    setSkyMesh(mesh) {
        this._dome = mesh;
    }

    setSize(width, height) {
        // Sky and out-of-focus far band share the 2×2 rate: both scales are
        // 0.5, so the single half-res target shades each region once per block.
        const scale = Math.min(VRS_SKY_SCALE, VRS_FAR_SCALE);
        this._target.setSize(
            Math.max(1, Math.floor(width * scale)),
            Math.max(1, Math.floor(height * scale))
        );
    }

    render(renderer, writeBuffer, readBuffer) {
        void writeBuffer;
        void readBuffer;
        // Shade the far band at half resolution. The skies ignore clipping
        // (raw shaders, no clipping chunks) so they render at 2×2 too. Shadow
        // maps are skipped: the fog-shrouded far band needs no shadow detail.
        const oldPlanes = renderer.clippingPlanes;
        const shadowOn = renderer.shadowMap.enabled;
        renderer.shadowMap.enabled = false;
        renderer.clippingPlanes = [this._farPlane];
        const wasVisible = this._dome ? this._dome.visible : false;
        if (this._dome) this._dome.visible = true;
        renderer.setRenderTarget(this._target);
        renderer.render(this._scene, this._camera);
        if (this._dome) this._dome.visible = wasVisible;
        renderer.clippingPlanes = oldPlanes;
        renderer.shadowMap.enabled = shadowOn;
    }
}

export class VRSCompositePass extends Pass {
    constructor(prePass) {
        super();
        this.needsSwap = true;
        this._pre = prePass;
        this._quad = new FullScreenQuad(new THREE.ShaderMaterial({
            depthWrite: false,
            depthTest: false,
            uniforms: {
                tColor: { value: null },
                tDepth: { value: null },
                tLow: { value: null },
            },
            vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
            fragmentShader: 'uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tLow;'
                + ' varying vec2 vUv;'
                + ' void main(){'
                + ' float d = texture2D(tDepth, vUv).r;'
                + ' vec3 col = texture2D(tColor, vUv).rgb;'
                + ' if (d > 0.995) { col = texture2D(tLow, vUv).rgb; }'
                + ' gl_FragColor = vec4(col, 1.0); }',
        }));
    }

    setSize(width, height) {
        void width;
        void height;
    }

    render(renderer, writeBuffer, readBuffer) {
        const uniforms = this._quad.material.uniforms;
        uniforms.tColor.value = readBuffer.texture;
        uniforms.tDepth.value = readBuffer.depthTexture;
        uniforms.tLow.value = this._pre.texture;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        this._quad.render(renderer);
    }
}