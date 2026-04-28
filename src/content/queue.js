import { generateBuilding } from './buildings/generator.js';
import { validateBuildingDefinition } from './buildings/schema.js';
import { generateVehicle } from './vehicles/generator.js';
import { validateVehicleDefinition } from './vehicles/schema.js';
import { generateWeapon } from './weapons/generator.js';
import { validateWeaponDefinition } from './weapons/schema.js';
import { generateQuest } from './quests/generator.js';
import { validateQuestDefinition } from './quests/schema.js';
import { generateNPCArchetype } from './npcs/generator.js';
import { validateNPCArchetype } from './npcs/schema.js';

const MAX_TASKS_PER_DAY = 5;
const QUALITY_SCORE_FLOOR = 0.5;

const CONTENT_TYPES = {
    building: { generate: generateBuilding, validate: validateBuildingDefinition },
    vehicle: { generate: generateVehicle, validate: validateVehicleDefinition },
    weapon: { generate: generateWeapon, validate: validateWeaponDefinition },
    quest: { generate: generateQuest, validate: validateQuestDefinition },
    npc: { generate: generateNPCArchetype, validate: validateNPCArchetype },
};

function scoreContent(def, validationResult) {
    if (!validationResult.valid) return 0;

    let score = 1.0;
    if (validationResult.warnings && validationResult.warnings.length > 0) {
        score -= validationResult.warnings.length * 0.15;
    }
    if (!def.description && !def.secret) score -= 0.1;
    return Math.max(0, Math.min(1, score));
}

export class ContentQueue {
    constructor() {
        this._pending = [];
        this._completed = [];
        this._rejected = [];
        this._dailyCount = 0;
        this._currentDay = null;
    }

    get pending() { return this._pending; }
    get completed() { return this._completed; }
    get rejected() { return this._rejected; }
    get dailyCount() { return this._dailyCount; }

    autofill(rng, opts = {}) {
        const milestoneEmpty = opts.milestoneEmpty !== false;
        if (!milestoneEmpty) return 0;

        const types = Object.keys(CONTENT_TYPES);
        const target = opts.target || 5;
        let added = 0;

        while (this._pending.length < target && added < target) {
            const typeKey = types[rng.int(0, types.length - 1)];
            const entry = CONTENT_TYPES[typeKey];
            const def = entry.generate(rng, opts[typeKey] || {});
            const result = entry.validate(def);
            const score = scoreContent(def, result);

            if (score < QUALITY_SCORE_FLOOR) {
                this._rejected.push({ type: typeKey, def, score, reason: 'below_quality_floor' });
                continue;
            }

            this._pending.push({
                type: typeKey,
                def,
                score,
                valid: result.valid,
                warnings: result.warnings || [],
                addedAt: Date.now(),
            });
            added++;
        }
        return added;
    }

    canProcess(day) {
        if (day !== this._currentDay) {
            this._currentDay = day;
            this._dailyCount = 0;
        }
        return this._dailyCount < MAX_TASKS_PER_DAY;
    }

    processNext(day) {
        if (!this.canProcess(day)) return null;
        if (this._pending.length === 0) return null;

        const task = this._pending.shift();
        this._dailyCount++;
        this._completed.push({ ...task, completedAt: Date.now(), day });
        return task;
    }

    getStats() {
        return {
            pending: this._pending.length,
            completed: this._completed.length,
            rejected: this._rejected.length,
            dailyCount: this._dailyCount,
            maxPerDay: MAX_TASKS_PER_DAY,
            qualityFloor: QUALITY_SCORE_FLOOR,
        };
    }

    serialize() {
        return {
            pending: this._pending,
            completed: this._completed,
            rejected: this._rejected,
            dailyCount: this._dailyCount,
            currentDay: this._currentDay,
        };
    }

    deserialize(data) {
        if (!data) return;
        this._pending = data.pending || [];
        this._completed = data.completed || [];
        this._rejected = data.rejected || [];
        this._dailyCount = data.dailyCount || 0;
        this._currentDay = data.currentDay || null;
    }
}
