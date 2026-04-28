import { BUILDING_CATEGORIES } from './schema.js';

const RESIDENTIAL_TEMPLATES = [
    { suffix: 'tenement', pop: [6, 12], gold: [1, 3], upkeep: [1, 3], tier: 'SMALL' },
    { suffix: 'condo', pop: [10, 20], gold: [2, 5], upkeep: [2, 5], tier: 'MEDIUM' },
    { suffix: 'tower', pop: [30, 50], gold: [5, 10], upkeep: [4, 8], tier: 'LARGE' },
];

const COMMERCIAL_TEMPLATES = [
    { suffix: 'kiosk', gold: [5, 10], upkeep: [1, 2], tier: 'SMALL' },
    { suffix: 'store', gold: [10, 20], upkeep: [3, 5], tier: 'MEDIUM' },
    { suffix: 'plaza', gold: [20, 40], upkeep: [5, 10], tier: 'LARGE' },
];

const INDUSTRIAL_TEMPLATES = [
    { suffix: 'workshop', food: [4, 8], wood: [4, 8], upkeep: [2, 4], tier: 'SMALL' },
    { suffix: 'factory', food: [8, 15], wood: [8, 15], upkeep: [5, 8], tier: 'MEDIUM' },
    { suffix: 'plant', food: [15, 25], wood: [15, 25], upkeep: [8, 14], tier: 'LARGE' },
];

const ICONS = {
    residential: ['🏠', '🏢', '🏗️', '🏘️'],
    commercial: ['🏪', '🏬', '💼', '🛒'],
    industrial: ['🏭', '⚙️', '🔧', '🔩'],
    infrastructure: ['🏥', '🚒', '🌳', '🏟️'],
    education: ['🎓', '📚', '🔬'],
    energy: ['⚡', '☀️', '💡'],
    culture: ['🎭', '🎨', '🎵'],
};

function randBetween(rng, min, max) {
    return min + rng.int(0, max - min);
}

function pickOne(rng, arr) {
    return arr[rng.int(0, arr.length - 1)];
}

export function generateBuilding(rng, opts = {}) {
    const category = opts.category || pickOne(rng, ['residential', 'commercial', 'industrial']);
    const prefix = opts.prefix || `gen_${category.slice(0, 3)}`;

    let templates;
    if (category === 'residential') templates = RESIDENTIAL_TEMPLATES;
    else if (category === 'commercial') templates = COMMERCIAL_TEMPLATES;
    else templates = INDUSTRIAL_TEMPLATES;

    const tmpl = opts.tier
        ? templates.find(t => t.tier === opts.tier) || pickOne(rng, templates)
        : pickOne(rng, templates);

    const id = `${prefix}_${tmpl.suffix}_${rng.int(1000, 9999)}`;
    const icon = pickOne(rng, ICONS[category] || ICONS.commercial);

    const def = {
        id,
        name: `${tmpl.suffix.charAt(0).toUpperCase() + tmpl.suffix.slice(1)} ${rng.int(1, 99)}`,
        icon,
        description: `A ${category} ${tmpl.suffix} building.`,
        category,
        cost: {
            gold: randBetween(rng, 10, 200),
            wood: randBetween(rng, 5, 100),
            food: category === 'industrial' ? randBetween(rng, 5, 50) : 0,
        },
        income: {
            gold: tmpl.gold ? randBetween(rng, tmpl.gold[0], tmpl.gold[1]) : 0,
            food: tmpl.food ? randBetween(rng, tmpl.food[0], tmpl.food[1]) : 0,
            wood: tmpl.wood ? randBetween(rng, tmpl.wood[0], tmpl.wood[1]) : 0,
        },
        upkeep: randBetween(rng, tmpl.upkeep[0], tmpl.upkeep[1]),
        population: tmpl.pop ? randBetween(rng, tmpl.pop[0], tmpl.pop[1]) : 0,
        zoneType: category === 'infrastructure' ? 'none' : category,
        growthStage: tmpl.tier,
    };

    if (opts.effects) def.effects = opts.effects;

    if (opts.unlockPopulation) {
        def.unlockRequirement = { population: opts.unlockPopulation };
    }

    return def;
}

export function generateBatch(rng, count, opts = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(generateBuilding(rng, opts));
    }
    return results;
}
