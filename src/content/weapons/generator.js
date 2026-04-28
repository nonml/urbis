const MELEE_TEMPLATES = [
    { suffix: 'knife', dmg: [8, 15], range: [1.5, 2], rate: [400, 600], heat: [3, 6], kb: [0.5, 1.0] },
    { suffix: 'pipe', dmg: [15, 25], range: [2, 3], rate: [500, 700], heat: [6, 10], kb: [1.0, 2.0] },
    { suffix: 'machete', dmg: [20, 35], range: [2, 2.5], rate: [600, 800], heat: [8, 12], kb: [1.2, 1.8] },
];

const RANGED_TEMPLATES = [
    { suffix: 'pistol', dmg: [18, 30], range: [12, 18], rate: [250, 400], clip: [8, 15], max: [40, 80], spread: [0.3, 1.0], heat: [10, 18], sound: [10, 15], recoil: [0.8, 1.5] },
    { suffix: 'rifle', dmg: [30, 50], range: [20, 30], rate: [400, 800], clip: [5, 10], max: [30, 60], spread: [0.1, 0.4], heat: [15, 22], sound: [18, 25], recoil: [1.5, 3.0] },
    { suffix: 'smg', dmg: [8, 15], range: [10, 14], rate: [60, 120], clip: [20, 40], max: [80, 160], spread: [2, 5], heat: [5, 10], sound: [12, 16], recoil: [0.5, 1.2] },
    { suffix: 'shotgun', dmg: [8, 14], range: [6, 10], rate: [600, 1000], clip: [4, 8], max: [20, 40], spread: [5, 10], heat: [15, 25], sound: [16, 22], recoil: [2.5, 4.0], pellets: [4, 8] },
];

function rand(rng, min, max) {
    const steps = Math.round((max - min) * 10);
    return min + (rng.int(0, steps) / 10);
}

function irand(rng, min, max) {
    return rng.int(min, max);
}

function pickOne(rng, arr) {
    return arr[rng.int(0, arr.length - 1)];
}

export function generateWeapon(rng, opts = {}) {
    const type = opts.type || (rng.int(0, 3) === 0 ? 'melee' : 'ranged');

    if (type === 'melee') {
        const tmpl = pickOne(rng, MELEE_TEMPLATES);
        return {
            id: `gen_${tmpl.suffix}_${rng.int(1000, 9999)}`,
            name: `${tmpl.suffix.charAt(0).toUpperCase() + tmpl.suffix.slice(1)} ${rng.int(1, 99)}`,
            type: 'melee',
            damage: irand(rng, tmpl.dmg[0], tmpl.dmg[1]),
            range: Math.round(rand(rng, tmpl.range[0], tmpl.range[1]) * 10) / 10,
            fireRate: irand(rng, tmpl.rate[0], tmpl.rate[1]),
            ammo: Infinity,
            heatGain: irand(rng, tmpl.heat[0], tmpl.heat[1]),
            spread: 0,
            pellets: 1,
            knockback: Math.round(rand(rng, tmpl.kb[0], tmpl.kb[1]) * 10) / 10,
            recoilGain: 0,
            recoilMax: 0,
            recoilRecovery: 0,
            adsFov: 0,
            adsSpreadMul: 1,
        };
    }

    const tmpl = pickOne(rng, RANGED_TEMPLATES);
    const clip = irand(rng, tmpl.clip[0], tmpl.clip[1]);
    const maxAmmo = irand(rng, tmpl.max[0], tmpl.max[1]);
    return {
        id: `gen_${tmpl.suffix}_${rng.int(1000, 9999)}`,
        name: `${tmpl.suffix.charAt(0).toUpperCase() + tmpl.suffix.slice(1)} ${rng.int(1, 99)}`,
        type: 'ranged',
        damage: irand(rng, tmpl.dmg[0], tmpl.dmg[1]),
        range: irand(rng, tmpl.range[0], tmpl.range[1]),
        fireRate: irand(rng, tmpl.rate[0], tmpl.rate[1]),
        ammo: clip,
        maxAmmo: Math.max(maxAmmo, clip),
        heatGain: irand(rng, tmpl.heat[0], tmpl.heat[1]),
        spread: Math.round(rand(rng, tmpl.spread[0], tmpl.spread[1]) * 10) / 10,
        pellets: tmpl.pellets ? irand(rng, tmpl.pellets[0], tmpl.pellets[1]) : 1,
        soundRadius: irand(rng, tmpl.sound[0], tmpl.sound[1]),
        recoilGain: Math.round(rand(rng, tmpl.recoil[0], tmpl.recoil[1]) * 10) / 10,
        recoilMax: Math.round(rand(rng, tmpl.recoil[0] * 2, tmpl.recoil[1] * 3) * 10) / 10,
        recoilRecovery: Math.round(rand(rng, 1.5, 5.0) * 10) / 10,
        adsFov: irand(rng, 45, 60),
        adsSpreadMul: Math.round(rand(rng, 0.3, 0.7) * 100) / 100,
    };
}

export function generateBatch(rng, count, opts = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(generateWeapon(rng, opts));
    }
    return results;
}
