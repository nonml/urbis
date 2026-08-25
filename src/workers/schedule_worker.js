/**
 * Schedule Worker — NPC scheduling off main thread (Q12.A q12-wk-schedule-worker)
 * Computes target location per citizen per phase without blocking the tick loop.
 *
 * Protocol:
 *   INIT             { type:'INIT', width, height }
 *   UPDATE_BUILDINGS { type:'UPDATE_BUILDINGS', buildings: Array<{type,x,y}> }
 *   FIND_TARGET      { type:'FIND_TARGET', id, citizenId, x, y, job, phaseName }
 *   SCHEDULE_BATCH   { type:'SCHEDULE_BATCH', id, citizens: Array, phaseName }
 * Response:
 *   TARGET_RESULT    { type:'TARGET_RESULT', id, citizenId, target: {x,y}|null }
 *   SCHEDULE_BATCH_RESULT { type:'SCHEDULE_BATCH_RESULT', id, results: Array }
 *
 * The pure core (getTargetLocation) is exported for headless unit tests and
 * mirrors ScheduleManager.getTargetLocation semantics 1:1. The message
 * handler is guarded so the module imports cleanly in Node.
 */

const JOB_TO_BUILDING = {
    farmer: 'farm',
    lumberjack: 'lumber-mill',
    merchant: 'market',
    craftsman: 'warehouse',
    official: 'town-hall',
    soldier: 'barracks',
    teacher: 'school',
};

export function getBuildingsAt(buildings, x, y) {
    const out = [];
    for (const b of buildings) if (b.x === x && b.y === y) out.push(b);
    return out;
}

export function findNearestBuilding(buildings, width, height, citizen, type) {
    const at = getBuildingsAt(buildings, citizen.x, citizen.y);
    if (at.length) return at.find(b => b.type === type) || at[0];
    const R = 5;
    for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
            const x = citizen.x + dx;
            const y = citizen.y + dy;
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const at2 = getBuildingsAt(buildings, x, y);
            const match = at2.find(b => b.type === type);
            if (match) return match;
        }
    }
    return null;
}

export function findWorkBuilding(buildings, citizen) {
    if (citizen.job === 'unemployed' || !citizen.job) return null;
    const targetType = JOB_TO_BUILDING[citizen.job];
    if (!targetType) return null;
    for (const b of buildings) {
        if (b.type === targetType) {
            const dist = Math.abs(b.x - citizen.x) + Math.abs(b.y - citizen.y);
            if (dist <= 10) return b;
        }
    }
    return buildings.find(b => b.type === targetType) || null;
}

/**
 * Phase-based target selection — mirrors ScheduleManager.getTargetLocation.
 * @param {Array<{type:string,x:number,y:number}>} buildings
 * @param {number} width
 * @param {number} height
 * @param {{x:number,y:number,job:string}} citizen
 * @param {string} phaseName
 * @returns {{x:number,y:number}|null}
 */
export function getTargetLocation(buildings, width, height, citizen, phaseName) {
    const homeBuilding = getBuildingsAt(buildings, citizen.x, citizen.y).find(b => b.type === 'house')
        || findNearestBuilding(buildings, width, height, citizen, 'house');
    const workBuilding = findWorkBuilding(buildings, citizen);
    const leisureBuilding = findNearestBuilding(buildings, width, height, citizen, 'park')
        || findNearestBuilding(buildings, width, height, citizen, 'market')
        || findNearestBuilding(buildings, width, height, citizen, 'town-hall');

    switch (phaseName) {
        case 'Night':
            return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
        case 'Morning':
        case 'Day':
            if (workBuilding) return { x: workBuilding.x, y: workBuilding.y };
            return leisureBuilding ? { x: leisureBuilding.x, y: leisureBuilding.y } : null;
        case 'Evening':
        case 'Dusk':
            return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
        default:
            return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
    }
}

let WIDTH = 0;
let HEIGHT = 0;
let buildingList = [];

function handleMessage(e) {
    const { type, id } = e.data;
    if (type === 'INIT') {
        WIDTH = e.data.width || 0;
        HEIGHT = e.data.height || 0;
        if (e.data.buildings) buildingList = e.data.buildings.slice();
        self.postMessage({ type: 'READY', id });
    } else if (type === 'UPDATE_BUILDINGS') {
        buildingList = (e.data.buildings || []).slice();
        self.postMessage({ type: 'UPDATED', id });
    } else if (type === 'FIND_TARGET') {
        const { citizenId, x, y, job, phaseName } = e.data;
        const target = getTargetLocation(buildingList, WIDTH, HEIGHT, { x, y, job, id: citizenId }, phaseName);
        self.postMessage({ type: 'TARGET_RESULT', id, citizenId, target });
    } else if (type === 'SCHEDULE_BATCH') {
        const { citizens, phaseName } = e.data;
        const results = [];
        for (const c of citizens) {
            const target = getTargetLocation(buildingList, WIDTH, HEIGHT, { x: c.x, y: c.y, job: c.job, id: c.id }, phaseName);
            results.push({ id: c.id, target });
        }
        self.postMessage({ type: 'SCHEDULE_BATCH_RESULT', id, results });
    } else if (type === 'PING') {
        self.postMessage({ type: 'PONG', id });
    }
}

if (typeof self !== 'undefined') {
    self.onmessage = handleMessage;
}