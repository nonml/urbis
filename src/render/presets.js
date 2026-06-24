/**
 * Quality presets for rendering pipeline.
 * Defines performance tiers: low / medium / high / ultra.
 * Each preset controls shadow quality, post-processing, SSR, volumetrics.
 */

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
        envProbeInterval: 0,
        pixelRatio: 1.0,
        antialias: false,
        decalCap: 128,
        decalPerChunkCap: 16,
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
        envProbeInterval: 60,
        pixelRatio: Math.min(1.5, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
        antialias: false,
        decalCap: 256,
        decalPerChunkCap: 32,
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
        envProbeInterval: 30,
        pixelRatio: Math.min(2.0, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
        antialias: true,
        decalCap: 512,
        decalPerChunkCap: 64,
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
        envProbeInterval: 15,
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        antialias: true,
        decalCap: 1024,
        decalPerChunkCap: 128,
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

    // SSAO kernel radius
    if (renderer._ssaoPass) {
        renderer._ssaoPass.kernelRadius = preset.ssaoKernelRadius;
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

    // Decal limits
    if (renderer._decalManager) {
        renderer._decalManager.setLimits(preset.decalCap, preset.decalPerChunkCap);
    }
    renderer._presetConfig = preset;
}
