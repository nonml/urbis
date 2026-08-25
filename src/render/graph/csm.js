/**
 * Stable Cascaded Shadow Maps — texel-snapped, no swim (Q9.C)
 *
 * Replaces `Renderer3D._setupCSM/_updateCSM` with a module that
 * quantizes each cascade's orthographic extents to texel size
 * so shadow edges don't crawl when the camera moves.
 *
 * Shadows use PCF (radius 2) — tunable per preset later.
 */

/* eslint-disable no-magic-numbers */

export const CSM_CASCADES = [
    { near: 1, far: 22, res: 1024, extent: 26 },
    { near: 22, far: 68, res: 512, extent: 46 },
    { near: 68, far: 150, res: 256, extent: 78 },
];

function quantize(val, step) {
    return Math.round(val / step) * step;
}

export function createCSM(THREE, scene, sunLight) {
    sunLight.castShadow = false;
    sunLight.shadow.mapSize.width = 0;
    sunLight.shadow.mapSize.height = 0;

    const lights = [];
    const cams = [];

    for (let i = 0; i < CSM_CASCADES.length; i++) {
        const c = CSM_CASCADES[i];
        const light = new THREE.DirectionalLight(0xfffbe0, 1.7 / (i + 1));
        light.position.copy(sunLight.position);
        light.castShadow = true;
        light.shadow.mapSize.width = c.res;
        light.shadow.mapSize.height = c.res;
        light.shadow.camera.near = c.near;
        light.shadow.camera.far = c.far;
        light.shadow.camera.left = -c.extent;
        light.shadow.camera.right = c.extent;
        light.shadow.camera.top = c.extent;
        light.shadow.camera.bottom = -c.extent;
        light.shadow.bias = -0.0006 - i * 0.0004;
        light.shadow.normalBias = 0.02 + i * 0.015;
        light.shadow.radius = 2;
        scene.add(light);
        lights.push(light);
        cams.push(light.shadow.camera);
    }

    return { lights, cams };
}

export function updateCSM({ lights, cams }, camera, sunLight) {
    if (!lights || lights.length === 0) return;
    const sunDir = sunLight.position.clone().normalize();
    if (sunDir.lengthSq() < 1e-6) return;

    for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        const cam = cams[i];
        const cfg = CSM_CASCADES[i];

        const dist = 30 + i * 12;
        const offset = sunDir.clone().multiplyScalar(dist);
        light.position.copy(camera.position).add(offset);
        light.target.position.copy(camera.position);
        light.target.updateMatrixWorld();

        const texelSize = (cfg.extent * 2) / cfg.res;
        cam.left = quantize(-cfg.extent, texelSize);
        cam.right = quantize(cfg.extent, texelSize);
        cam.top = quantize(cfg.extent, texelSize);
        cam.bottom = quantize(-cfg.extent, texelSize);
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
    }
}
