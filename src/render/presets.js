/**
 * Quality presets for rendering pipeline.
 * Defines performance tiers: low / medium / high / ultra.
 * Each preset controls shadow quality, post-processing, SSR, volumetrics.
 */

import { shouldEnableVRS, VRS_RATE, VRS_SKY_SCALE, VRS_FAR_SCALE } from './vrs_support.js';

export const PRESETS = {
    low: {
        name: 'Low',
        shadowMapSize: 256,
        csmCascades: 1,
        ssaoKernelRadius: 2,
        bloomStrength: 0.1,
        bloomThreshold: 0.9,
        ssrEnabled: false,
        planarReflections: false,
        volumetricFog: false,
        starField: false,
        taa: false,
        gtao: false,
        particleDensity: 0.5,
        envProbeInterval: 0,
        pixelRatio: 1.0,
        antialias: false,
        decalCap: 128,
        decalPerChunkCap: 16,
        vrs: true,
        drsMinScale: 0.65,
        vrsSkyRate: '2x2',
        vrsFarRate: '2x2',
    },
    medium: {
        name: 'Medium',
        shadowMapSize: 512,
        csmCascades: 2,
        ssaoKernelRadius: 3,
        bloomStrength: 0.2,
        bloomThreshold: 0.75,
        ssrEnabled: true,
        planarReflections: false,
        volumetricFog: true,
        starField: true,
        taa: false,
        gtao: false,
        particleDensity: 1.0,
        envProbeInterval: 60,
        pixelRatio: Math.min(1.5, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
        antialias: false,
        decalCap: 256,
        decalPerChunkCap: 32,
        vrs: false,
        drsMinScale: 0.70,
        vrsSkyRate: '1x1',
        vrsFarRate: '1x1',
    },
    high: {
        name: 'High',
        shadowMapSize: 1024,
        csmCascades: 3,
        ssaoKernelRadius: 4,
        bloomStrength: 0.3,
        bloomThreshold: 0.6,
        ssrEnabled: true,
        planarReflections: true,
        volumetricFog: true,
        starField: true,
        taa: true,
        gtao: true,
        particleDensity: 4.0,
        envProbeInterval: 30,
        pixelRatio: Math.min(2.0, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
        antialias: true,
        decalCap: 512,
        decalPerChunkCap: 64,
        vrs: false,
        drsMinScale: 0.75,
        vrsSkyRate: '1x1',
        vrsFarRate: '1x1',
    },
    ultra: {
        name: 'Ultra',
        shadowMapSize: 2048,
        csmCascades: 4,
        ssaoKernelRadius: 6,
        bloomStrength: 0.4,
        bloomThreshold: 0.5,
        ssrEnabled: true,
        planarReflections: true,
        volumetricFog: true,
        starField: true,
        taa: true,
        gtao: true,
        particleDensity: 12.0,
        envProbeInterval: 15,
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        antialias: true,
        decalCap: 1024,
        decalPerChunkCap: 128,
        vrs: false,
        drsMinScale: 0.80,
        vrsSkyRate: '1x1',
        vrsFarRate: '1x1',
    },
};

/** Default preset for new games */
export const DEFAULT_PRESET = 'medium';

/**
 * Apply preset settings to renderer.
 * @param {Renderer3D} renderer - The 3D renderer instance
 * @param {string} presetName - Preset key from PRESETS
 */
export function applyPreset(renderer, presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;

    renderer._preset = presetName;

    // Pixel ratio
    if (renderer.renderer) {
        renderer.renderer.setPixelRatio(preset.pixelRatio);
    }

    // Shadow map size on CSM cascades
    if (renderer._csmLights) {
        const sizes = [preset.shadowMapSize, Math.floor(preset.shadowMapSize * 0.5), Math.floor(preset.shadowMapSize * 0.25), Math.floor(preset.shadowMapSize * 0.125)];
        renderer._csmLights.forEach((light, i) => {
            if (light && i < preset.csmCascades) {
                light.shadow.mapSize.width = sizes[i] || 256;
                light.shadow.mapSize.height = sizes[i] || 256;
            } else if (light) {
                light.shadow.mapSize.width = 0;
                light.shadow.mapSize.height = 0;
            }
        });
    }

    // Ambient occlusion: GTAO at high+, SSAO as the fallback. Never both.
    if (renderer._ssaoPass) {
        renderer._ssaoPass.kernelRadius = preset.ssaoKernelRadius;
        renderer._ssaoPass.enabled = !preset.gtao;
    }
    if (renderer._gtaoPass) {
        renderer._gtaoPass.enabled = !!preset.gtao;
    }

    // Bloom
    if (renderer._bloomPass) {
        renderer._bloomPass.strength = preset.bloomStrength;
        renderer._bloomPass.threshold = preset.bloomThreshold;
    }

    // SSR toggle
    if (renderer._ssrPass) {
        renderer._ssrPass.visible = preset.ssrEnabled;
    }

    // Planar water reflection toggle
    if (renderer._waterReflector) {
        renderer._waterReflector.visible = !!preset.planarReflections;
    }

    // Volumetric fog toggle
    if (renderer._volFogPass) {
        renderer._volFogPass.visible = preset.volumetricFog;
    }

    // Star field toggle
    if (renderer._starPass) {
        renderer._starPass.visible = preset.starField;
    }

    // TAA toggle (FXAA serves as the fallback on presets without TAA)
    if (renderer._taaPass) {
        renderer._taaPass.enabled = !!preset.taa;
    }
    // FXAA fallback — active only when TAA is off, so AA is never doubled up.
    if (renderer._fxaaPass) {
        renderer._fxaaPass.enabled = !preset.taa;
    }

    // Decal limits
    if (renderer._decalManager) {
        renderer._decalManager.setLimits(preset.decalCap, preset.decalPerChunkCap);
    }
    if (renderer._vrsSupported !== undefined) {
        renderer._vrsEnabled = shouldEnableVRS(preset, renderer._vrsSupported);
        renderer._vrsRate = preset.vrsSkyRate || VRS_RATE.X1X1;
        renderer._vrsFarRate = preset.vrsFarRate || VRS_RATE.X1X1;
        renderer._vrsSkyScale = preset.vrsSkyRate === VRS_RATE.X2X2 ? VRS_SKY_SCALE : 1;
        renderer._vrsFarScale = preset.vrsFarRate === VRS_RATE.X2X2 ? VRS_FAR_SCALE : 1;
        if (renderer._applyVRSState) renderer._applyVRSState();
    }
    if (preset.drsMinScale !== undefined) renderer._drsMinScale = preset.drsMinScale;
    renderer._presetConfig = preset;
}
