/**
 * VRSSkyPass — software 2×2 shading rate for the sky (Q11.F).
 *
 * Renders the gradient sky dome into a half-resolution target (one shader
 * invocation per 2×2 output block), then composites that low-res result
 * fullscreen with depth cleared to far so the scene renders over it. The sky
 * is a smooth gradient, so halving its shading rate is visually lossless.
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { VRS_SKY_SCALE } from '../../vrs_support.js';

export class VRSSkyPass extends Pass {
    constructor() {
        super();
        this.needsSwap = false;
        this._skyScene = new THREE.Scene();
        this._skyMesh = null;
        this._camera = null;
        this._skyTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
        this._skyTarget.texture.minFilter = THREE.LinearFilter;
        this._skyTarget.texture.magFilter = THREE.LinearFilter;
        this._skyTarget.texture.generateMipmaps = false;
        this._quad = new FullScreenQuad(new THREE.ShaderMaterial({
            depthWrite: false,
            depthTest: false,
            uniforms: { tSky: { value: this._skyTarget.texture } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
            fragmentShader: 'uniform sampler2D tSky; varying vec2 vUv;'
                + ' void main(){ gl_FragColor=texture2D(tSky,vUv); }',
        }));
    }

    /**
     * Attach the sky dome mesh to shade at the reduced rate. The same mesh is
     * shared with the main scene, so every sky-color update applies here too.
     * @param {THREE.Mesh} mesh - the gradient sky dome
     * @param {THREE.PerspectiveCamera} camera - the view camera
     */
    setSkyMesh(mesh, camera) {
        this._skyMesh = mesh;
        this._camera = camera;
        this._skyScene.add(mesh);
    }

    setSize(width, height) {
        const w = Math.max(1, Math.floor(width * VRS_SKY_SCALE));
        const h = Math.max(1, Math.floor(height * VRS_SKY_SCALE));
        this._skyTarget.setSize(w, h);
    }

    render(renderer, writeBuffer, readBuffer) {
        const target = this.renderToScreen ? null : readBuffer;
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = true;
        // 1) Shade the sky at half resolution.
        if (this._skyMesh && this._camera) {
            renderer.setRenderTarget(this._skyTarget);
            const wasVisible = this._skyMesh.visible;
            this._skyMesh.visible = true;
            renderer.render(this._skyScene, this._camera);
            this._skyMesh.visible = wasVisible;
        }
        // 2) Upscale into the main buffer with depth cleared so the scene
        //    renders on top of the sky instead of re-shading it full-res.
        renderer.setRenderTarget(target);
        this._quad.render(renderer);
        renderer.autoClear = oldAutoClear;
    }
}
