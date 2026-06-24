/**
 * Realtime GI probe grid (Q10.G).
 *
 * A 2D grid of irradiance probes spread across the map footprint. Each probe
 * holds a baked ground-bounce albedo (set at chunk-load) and an output
 * irradiance colour recomputed per frame from the current sky/sun (the dynamic
 * delta). The irradiance is packed into a small linear-filtered DataTexture so
 * any material can sample it per fragment at its world XZ and add spatially
 * varying bounce light — a park bleeds green onto nearby walls, a warm plaza
 * glows amber — without a single global ambient term flattening everything.
 *
 * The sampling is injected into materials via `applyTo()`, which composes with
 * any existing onBeforeCompile (wind, SSS, etc.) and is instancing-aware so it
 * works on terrain, instanced roads/scatter and GLTF buildings alike.
 */
import * as THREE from 'three';

export class GIProbeGrid {
    /**
     * @param {number} mapWidth  map width in tiles (world units)
     * @param {number} mapHeight map height in tiles
     * @param {number} cell      tiles between probes
     */
    constructor(mapWidth, mapHeight, cell = 4) {
        this.cell = cell;
        this.nx = Math.max(2, Math.ceil(mapWidth / cell) + 1);
        this.nz = Math.max(2, Math.ceil(mapHeight / cell) + 1);
        this.originX = -mapWidth / 2;
        this.originZ = -mapHeight / 2;
        this.sizeX = mapWidth;
        this.sizeZ = mapHeight;

        // Baked ground-bounce albedo per probe (RGB), neutral until baked.
        this._albedo = new Float32Array(this.nx * this.nz * 3).fill(0.5);
        this._baked = new Uint8Array(this.nx * this.nz); // 1 once a region bakes it

        // Output irradiance texture sampled by materials (RGBA float).
        this._data = new Float32Array(this.nx * this.nz * 4);
        this.texture = new THREE.DataTexture(this._data, this.nx, this.nz, THREE.RGBAFormat, THREE.FloatType);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.texture.needsUpdate = true;

        // Shared uniforms — one set referenced by every GI material.
        this.uniforms = {
            uGITex: { value: this.texture },
            uGIOrigin: { value: new THREE.Vector2(this.originX, this.originZ) },
            uGISize: { value: new THREE.Vector2(this.sizeX, this.sizeZ) },
            uGIStrength: { value: 0.4 },
        };
    }

    _cellIndex(wx, wz) {
        const cx = Math.round(((wx - this.originX) / this.sizeX) * (this.nx - 1));
        const cz = Math.round(((wz - this.originZ) / this.sizeZ) * (this.nz - 1));
        const ix = Math.max(0, Math.min(this.nx - 1, cx));
        const iz = Math.max(0, Math.min(this.nz - 1, cz));
        return iz * this.nx + ix;
    }

    /**
     * Bake ground-bounce albedo for the probes inside a world-space region
     * (called when a chunk's geometry is built). `sampleAlbedo(wx, wz)` returns
     * a THREE.Color for the dominant ground colour under that probe.
     */
    bakeRegion(minWX, minWZ, maxWX, maxWZ, sampleAlbedo) {
        const ix0 = Math.max(0, Math.floor(((minWX - this.originX) / this.sizeX) * (this.nx - 1)));
        const ix1 = Math.min(this.nx - 1, Math.ceil(((maxWX - this.originX) / this.sizeX) * (this.nx - 1)));
        const iz0 = Math.max(0, Math.floor(((minWZ - this.originZ) / this.sizeZ) * (this.nz - 1)));
        const iz1 = Math.min(this.nz - 1, Math.ceil(((maxWZ - this.originZ) / this.sizeZ) * (this.nz - 1)));
        for (let iz = iz0; iz <= iz1; iz++) {
            for (let ix = ix0; ix <= ix1; ix++) {
                const wx = this.originX + (ix / (this.nx - 1)) * this.sizeX;
                const wz = this.originZ + (iz / (this.nz - 1)) * this.sizeZ;
                const c = sampleAlbedo(wx, wz);
                if (!c) continue;
                const p = (iz * this.nx + ix) * 3;
                this._albedo[p] = c.r; this._albedo[p + 1] = c.g; this._albedo[p + 2] = c.b;
                this._baked[iz * this.nx + ix] = 1;
            }
        }
    }

    /**
     * Recompute every probe's irradiance from the current lighting and push it
     * to the GPU. `sky`/`ground`/`sun` are THREE.Color-ish {r,g,b}; `sunInt`
     * scales the sun bounce. `deltas` is an optional list of local light pulses
     * { wx, wz, radius, color:{r,g,b}, intensity } (explosions, neon, fires).
     */
    update(sky, ground, sun, sunInt, deltas) {
        const d = this._data;
        for (let iz = 0; iz < this.nz; iz++) {
            for (let ix = 0; ix < this.nx; ix++) {
                const cell = iz * this.nx + ix;
                const a = cell * 3;
                const o = cell * 4;
                // Hemisphere bounce: sky from above + ground albedo lit by sun.
                const ar = this._albedo[a], ag = this._albedo[a + 1], ab = this._albedo[a + 2];
                let r = sky.r * 0.35 + ar * (ground.r * 0.4 + sun.r * sunInt * 0.5);
                let g = sky.g * 0.35 + ag * (ground.g * 0.4 + sun.g * sunInt * 0.5);
                let b = sky.b * 0.35 + ab * (ground.b * 0.4 + sun.b * sunInt * 0.5);
                if (deltas && deltas.length) {
                    const wx = this.originX + (ix / (this.nx - 1)) * this.sizeX;
                    const wz = this.originZ + (iz / (this.nz - 1)) * this.sizeZ;
                    for (const p of deltas) {
                        const dx = wx - p.wx, dz = wz - p.wz;
                        const fall = 1 - Math.min(1, Math.sqrt(dx * dx + dz * dz) / p.radius);
                        if (fall <= 0) continue;
                        const k = fall * fall * p.intensity;
                        r += p.color.r * k; g += p.color.g * k; b += p.color.b * k;
                    }
                }
                d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 1;
            }
        }
        this.texture.needsUpdate = true;
    }

    /** Inject per-fragment GI sampling into a material (composes with existing hooks). */
    applyTo(material) {
        if (!material || material.userData.__giApplied) return;
        material.userData.__giApplied = true;
        const prevOBC = material.onBeforeCompile;
        const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
        const u = this.uniforms;
        material.onBeforeCompile = (shader, renderer) => {
            if (prevOBC) prevOBC.call(material, shader, renderer);
            shader.uniforms.uGITex = u.uGITex;
            shader.uniforms.uGIOrigin = u.uGIOrigin;
            shader.uniforms.uGISize = u.uGISize;
            shader.uniforms.uGIStrength = u.uGIStrength;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vGIWorld;')
                .replace('#include <begin_vertex>', `#include <begin_vertex>
                    #ifdef USE_INSTANCING
                        vGIWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                    #else
                        vGIWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
                    #endif`);
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', `#include <common>
                    varying vec3 vGIWorld;
                    uniform sampler2D uGITex; uniform vec2 uGIOrigin; uniform vec2 uGISize; uniform float uGIStrength;`)
                .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
                    {
                        vec2 giUv = clamp((vGIWorld.xz - uGIOrigin) / uGISize, 0.0, 1.0);
                        vec3 gi = texture2D(uGITex, giUv).rgb;
                        reflectedLight.indirectDiffuse += gi * uGIStrength * diffuseColor.rgb;
                    }`);
        };
        material.customProgramCacheKey = () => `gi_${prevKey}`;
        material.needsUpdate = true;
    }

    dispose() {
        this.texture.dispose();
    }
}
