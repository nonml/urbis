#!/usr/bin/env node
import { writeFileSync } from 'fs';
import { RNG } from '../src/rng.js';
import { generateBatch as genBuildings } from '../src/content/buildings/generator.js';
import { validateBuildingDefinition } from '../src/content/buildings/schema.js';
import { generateBatch as genVehicles } from '../src/content/vehicles/generator.js';
import { validateVehicleDefinition } from '../src/content/vehicles/schema.js';
import { generateBatch as genNPCs } from '../src/content/npcs/generator.js';
import { validateNPCArchetype } from '../src/content/npcs/schema.js';
import { generateBatch as genQuests } from '../src/content/quests/generator.js';
import { validateQuestDefinition } from '../src/content/quests/schema.js';

const SEED = 20270401;
const rng = new RNG(SEED);

function generate(name, count, genFn, validateFn, opts) {
    const items = genFn(rng, count, opts);
    let valid = 0;
    for (const item of items) {
        const r = validateFn(item);
        if (r.valid) valid++;
        else console.error(`  INVALID ${item.id}: ${r.errors.join('; ')}`);
    }
    console.log(`${name}: ${valid}/${count} valid`);
    return items.filter(i => validateFn(i).valid);
}

const buildings = [
    ...generate('buildings/residential', 20, genBuildings, validateBuildingDefinition, { category: 'residential' }),
    ...generate('buildings/commercial', 18, genBuildings, validateBuildingDefinition, { category: 'commercial' }),
    ...generate('buildings/industrial', 12, genBuildings, validateBuildingDefinition, { category: 'industrial' }),
];

const vehicles = generate('vehicles', 30, genVehicles, validateVehicleDefinition, {});
const npcs = generate('npcs', 20, genNPCs, validateNPCArchetype, {});
const quests = generate('quests', 15, genQuests, validateQuestDefinition, {});

writeFileSync('src/content/buildings/generated/batch.json', JSON.stringify(buildings, null, 2));
writeFileSync('src/content/vehicles/generated/batch.json', JSON.stringify(vehicles, null, 2));
writeFileSync('src/content/npcs/generated/batch.json', JSON.stringify(npcs, null, 2));
writeFileSync('src/content/quests/generated/batch.json', JSON.stringify(quests, null, 2));

console.log(`\nGenerated: ${buildings.length} buildings, ${vehicles.length} vehicles, ${npcs.length} npcs, ${quests.length} quests`);
