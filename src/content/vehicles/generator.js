const TEMPLATES = {
    civilian: [
        { modelKey: 'sedan', speed: [12, 18], accel: [3, 5], mass: [1200, 1800], len: [4, 5], name: 'Sedan' },
        { modelKey: 'suv', speed: [10, 16], accel: [2.5, 4], mass: [1800, 2500], len: [4.5, 5.5], name: 'SUV' },
    ],
    sport: [
        { modelKey: 'hatchback-sports', speed: [22, 32], accel: [5, 7], mass: [1100, 1500], len: [3.5, 4.5], name: 'Sports Car' },
    ],
    service: [
        { modelKey: 'taxi', speed: [12, 16], accel: [3, 4.5], mass: [1300, 1700], len: [4, 5], name: 'Taxi' },
    ],
    emergency: [
        { modelKey: 'police', speed: [18, 26], accel: [4, 6], mass: [1600, 2200], len: [4.5, 5], name: 'Police Car' },
        { modelKey: 'firetruck', speed: [8, 14], accel: [1.8, 3], mass: [4000, 6000], len: [6, 7], name: 'Firetruck' },
    ],
    commercial: [
        { modelKey: 'van', speed: [10, 14], accel: [2, 3.5], mass: [2000, 3000], len: [5, 6], name: 'Van' },
        { modelKey: 'delivery', speed: [8, 12], accel: [1.8, 3], mass: [3000, 5000], len: [5.5, 7], name: 'Truck' },
    ],
    transit: [
        { modelKey: 'bus', speed: [8, 12], accel: [1.8, 2.5], mass: [4500, 6000], len: [6, 7], name: 'Bus' },
    ],
};

function rand(rng, min, max) {
    const range = max - min;
    const steps = Math.round(range * 10);
    return min + (rng.int(0, steps) / 10);
}

function pickOne(rng, arr) {
    return arr[rng.int(0, arr.length - 1)];
}

export function generateVehicle(rng, opts = {}) {
    const category = opts.category || pickOne(rng, Object.keys(TEMPLATES));
    const pool = TEMPLATES[category] || TEMPLATES.civilian;
    const tmpl = pickOne(rng, pool);

    const speed = rand(rng, tmpl.speed[0], tmpl.speed[1]);
    const mass = Math.round(rand(rng, tmpl.mass[0], tmpl.mass[1]));
    const len = rand(rng, tmpl.len[0], tmpl.len[1]);

    return {
        id: `gen_${category.slice(0, 3)}_${tmpl.modelKey}_${rng.int(1000, 9999)}`,
        name: `${tmpl.name} ${rng.int(1, 99)}`,
        modelKey: tmpl.modelKey,
        category,
        maxSpeed: Math.round(speed * 10) / 10,
        acceleration: Math.round(rand(rng, tmpl.accel[0], tmpl.accel[1]) * 10) / 10,
        braking: Math.round(rand(rng, 5, 12) * 10) / 10,
        turningSpeed: Math.round(rand(rng, 1.0, 3.2) * 10) / 10,
        wheelbase: Math.round(rand(rng, 2.0, 4.5) * 10) / 10,
        width: Math.round(rand(rng, 1.5, 2.2) * 10) / 10,
        length: Math.round(len * 10) / 10,
        traction: Math.round(rand(rng, 0.8, 1.15) * 100) / 100,
        mass,
        maxHealth: 100,
    };
}

export function generateBatch(rng, count, opts = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(generateVehicle(rng, opts));
    }
    return results;
}
