import generatedBuildings from './buildings/generated/batch.json' with { type: 'json' };
import generatedVehicles from './vehicles/generated/batch.json' with { type: 'json' };
import generatedNPCs from './npcs/generated/batch.json' with { type: 'json' };
import generatedQuests from './quests/generated/batch.json' with { type: 'json' };

export function getGeneratedBuildings() {
    return generatedBuildings.default ?? generatedBuildings;
}

export function getGeneratedVehicles() {
    return generatedVehicles.default ?? generatedVehicles;
}

export function getGeneratedNPCs() {
    return generatedNPCs.default ?? generatedNPCs;
}

export function getGeneratedQuests() {
    return generatedQuests.default ?? generatedQuests;
}

export function getContentStats() {
    return {
        buildings: getGeneratedBuildings().length,
        vehicles: getGeneratedVehicles().length,
        npcs: getGeneratedNPCs().length,
        quests: getGeneratedQuests().length,
    };
}
