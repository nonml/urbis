/**
 * Hybrid Sky — day=Skyline clean, night=Neon deep (ground-up Phase 3 stub)
 *
 * Owns the always-on gradient dome (_skyDome) and the Preetham Sky.
 * Night shifts the dome from pale horizon → deep navy so `sky.visible=false`
 * still reads as night (previously stayed pale).
 *
 * Palette lerps between LIGHTING_PRESETS so one lerp drives dome + sky.
 */

const SKY_DOME = {
    day: { top: 0x2c6bb0, horizon: 0xbcd8ea, exponent: 0.7 },
    night: { top: 0x071022, horizon: 0x1a2e44, exponent: 1.1 },
    dawn: { top: 0x6a8dc2, horizon: 0xe8c4a0, exponent: 0.82 },
    dusk: { top: 0x4a2e2a, horizon: 0xd9622a, exponent: 0.9 },
};

export function createSkyDome(THREE) {
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            topColor: { value: new THREE.Color(SKY_DOME.day.top) },
            horizonColor: { value: new THREE.Color(SKY_DOME.day.horizon) },
            exponent: { value: SKY_DOME.day.exponent },
        },
        vertexShader: 'varying vec3 vDir; void main(){ vDir=position;'
            + ' gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 topColor; uniform vec3 horizonColor; uniform float exponent;'
            + ' varying vec3 vDir; void main(){ float h=clamp(normalize(vDir).y,0.0,1.0);'
            + ' vec3 col=mix(horizonColor,topColor,pow(h,exponent)); gl_FragColor=vec4(col,1.0); }',
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), mat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    return dome;
}

export function updateSkyDomeForPhase(dome, phase, t) {
    if (!dome) return;
    const a = SKY_DOME[phase] ?? SKY_DOME.day;
    const b = phase === 'dawn' ? SKY_DOME.day : phase === 'dusk' ? SKY_DOME.night : null;
    const mix = (ca, cb, tt) => {
        const ra = ((ca >> 16) & 255) / 255;
        const ga = ((ca >> 8) & 255) / 255;
        const ba = (ca & 255) / 255;
        const rb = ((cb >> 16) & 255) / 255;
        const gb = ((cb >> 8) & 255) / 255;
        const bb = (cb & 255) / 255;
        return { r: ra + (rb - ra) * tt, g: ga + (gb - ga) * tt, b: ba + (bb - ba) * tt };
    };
    let top = a.top;
    let hor = a.horizon;
    let exp = a.exponent;
    if (b && t !== undefined) {
        const mc = mix(a.top, b.top, t);
        const hc = mix(a.horizon, b.horizon, t);
        dome.material.uniforms.topColor.value.setRGB(mc.r, mc.g, mc.b);
        dome.material.uniforms.horizonColor.value.setRGB(hc.r, hc.g, hc.b);
        dome.material.uniforms.exponent.value = a.exponent + (b.exponent - a.exponent) * t;
        return;
    }
    dome.material.uniforms.topColor.value.setHex(top);
    dome.material.uniforms.horizonColor.value.setHex(hor);
    dome.material.uniforms.exponent.value = exp;
}

export { SKY_DOME };
