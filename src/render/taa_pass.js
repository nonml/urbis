/**
 * Temporal Anti-Aliasing pass (Q10.F).
 *
 * Three ingredients of TAA:
 *  1. Temporal jitter — `applyJitter()` nudges the camera projection by a
 *     sub-pixel Halton offset each frame, so successive frames sample slightly
 *     different positions inside every pixel.
 *  2. History accumulation — the resolved image is kept in a ping-pong target
 *     and blended back in, integrating those jittered samples into a stable,
 *     super-sampled result over ~8 frames.
 *  3. Neighborhood clamp — history is clamped to the min/max colour of the
 *     current frame's 3x3 neighborhood. This rejects stale history under motion
 *     (it acts as the reprojection-rejection step), killing the ghosting/smear
 *     that naive temporal blending produces.
 *
 * No motion-vector buffer is required: the neighborhood clamp is what keeps the
 * same-UV history valid as the camera pans, which is the standard motion-vector
 * free TAA used when a velocity pass is too costly.
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// 8-sample Halton(2,3) sequence, centred to [-0.5, 0.5].
const HALTON = [
    [0.5, 1 / 3], [0.25, 2 / 3], [0.75, 1 / 9], [0.125, 4 / 9],
    [0.625, 7 / 9], [0.375, 2 / 9], [0.875, 5 / 9], [0.0625, 8 / 9],
].map(([x, y]) => [x - 0.5, y - 0.5]);

const RESOLVE_FRAG = /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tHistory;
    uniform vec2 uTexel;
    uniform float uValid;
    uniform float uBlend;
    varying vec2 vUv;
    void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        if (uValid < 0.5) { gl_FragColor = vec4(c, 1.0); return; }
        vec3 nmin = c, nmax = c;
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                vec3 s = texture2D(tDiffuse, vUv + vec2(float(x), float(y)) * uTexel).rgb;
                nmin = min(nmin, s); nmax = max(nmax, s);
            }
        }
        vec3 h = clamp(texture2D(tHistory, vUv).rgb, nmin, nmax);
        gl_FragColor = vec4(mix(c, h, uBlend), 1.0);
    }`;

const FULLSCREEN_VERT = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COPY_FRAG = /* glsl */`
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(tDiffuse, vUv); }`;

export class TAAPass extends Pass {
    constructor(width, height) {
        super();
        this._size = new THREE.Vector2(Math.max(1, width), Math.max(1, height));
        this._frame = 0;
        this._valid = false;
        const opts = {
            type: THREE.HalfFloatType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
        };
        this._history = new THREE.WebGLRenderTarget(this._size.x, this._size.y, opts);
        this._historyOut = new THREE.WebGLRenderTarget(this._size.x, this._size.y, opts);

        this._resolveMat = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tHistory: { value: null },
                uTexel: { value: new THREE.Vector2(1 / this._size.x, 1 / this._size.y) },
                uValid: { value: 0 },
                uBlend: { value: 0.9 },
            },
            vertexShader: FULLSCREEN_VERT,
            fragmentShader: RESOLVE_FRAG,
            depthTest: false,
            depthWrite: false,
        });
        this._copyMat = new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: null } },
            vertexShader: FULLSCREEN_VERT,
            fragmentShader: COPY_FRAG,
            depthTest: false,
            depthWrite: false,
        });
        this._quad = new FullScreenQuad(this._resolveMat);
    }

    /**
     * Offset the camera projection by this frame's sub-pixel jitter.
     * Returns a function that restores the projection — call it after rendering.
     */
    applyJitter(camera) {
        const [hx, hy] = HALTON[this._frame % HALTON.length];
        this._frame++;
        const e = camera.projectionMatrix.elements;
        const b8 = e[8], b9 = e[9];
        e[8] += (hx * 2) / this._size.x;
        e[9] += (hy * 2) / this._size.y;
        return () => { e[8] = b8; e[9] = b9; };
    }

    setSize(width, height) {
        this._size.set(Math.max(1, width), Math.max(1, height));
        this._history.setSize(this._size.x, this._size.y);
        this._historyOut.setSize(this._size.x, this._size.y);
        this._resolveMat.uniforms.uTexel.value.set(1 / this._size.x, 1 / this._size.y);
        this._valid = false; // discard stale-resolution history
    }

    render(renderer, writeBuffer, readBuffer) {
        // Resolve current + clamped history into _historyOut.
        this._resolveMat.uniforms.tDiffuse.value = readBuffer.texture;
        this._resolveMat.uniforms.tHistory.value = this._history.texture;
        this._resolveMat.uniforms.uValid.value = this._valid ? 1 : 0;
        this._quad.material = this._resolveMat;
        renderer.setRenderTarget(this._historyOut);
        if (this.clear) renderer.clear();
        this._quad.render(renderer);

        // Output the resolved frame to the next pass / screen.
        this._copyMat.uniforms.tDiffuse.value = this._historyOut.texture;
        this._quad.material = this._copyMat;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        if (this.clear) renderer.clear();
        this._quad.render(renderer);

        // Ping-pong: this frame's resolve becomes next frame's history.
        const tmp = this._history;
        this._history = this._historyOut;
        this._historyOut = tmp;
        this._valid = true;
    }

    dispose() {
        this._history.dispose();
        this._historyOut.dispose();
        this._resolveMat.dispose();
        this._copyMat.dispose();
        this._quad.dispose();
    }
}
