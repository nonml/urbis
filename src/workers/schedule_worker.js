/**
 * Schedule Worker — NPC scheduling off main thread (Q12.A q12-wk-schedule-worker)
 * Computes target location per citizen per phase without blocking the tick loop.
 *
 * Protocol:
 *   INIT             { type:'INIT', width, height }
 *   UPDATE_BUILDINGS { type:'UPDATE_BUILDINGS', buildings: Array<{type,x,y}> }
 *   FIND_TARGET      { type:'FIND_TARGET', id, citizenId, x, y, job, phaseName }
 * Response:
 *   TARGET_RESULT    { type:'TARGET_RESULT', id, citizenId, target: {x,y}|null }
 *   BATCH            { type:'SCHEDULE_BATCH', id, citizens: Array, phaseName } -> { type:'SCHEDULE_BATCH_RESULT' }
 */

let WIDTH = 0;
let HEIGHT = 0;
let buildings = []; // Array<{type,x,y}>

function getBuildingsAt(x, y) {
    const out = [];
    for (const b of buildings) if (b.x === x && b.y === y) out.push(b);
    return out;
}

function findNearestBuilding(citizen, type) {
    const at = getBuildingsAt(citizen.x, citizen.y);
    if (at.length) {
        const m = at.find(b => b.type === type);
        if (m) return m;
        // fallback to first at tile (mirrors main thread's findNearestBuilding first branch)
        // main returns citizenBuildings.find(b=>b.type===type) || citizenBuildings[0]
        // but that is for nearest search radius 0 case only; we mimic.
        // If no type match at tile, continue to radius search below.
    }
    const R = 5;
    for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
            const x = citizen.x + dx;
            const y = citizen.y + dy;
            if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) continue;
            const at2 = getBuildingsAt(x, y);
            const match = at2.find(b => b.type === type);
            if (match) return match;
        }
    }
    return null;
}

const JOB_TO_BUILDING = {
    farmer: 'farm',
    lumberjack: 'lumber-mill',
    merchant: 'market',
    craftsman: 'warehouse',
    official: 'town-hall',
    soldier: 'barracks',
    teacher: 'school',
};

function findWorkBuilding(citizen) {
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

function getTargetLocation(citizen, phaseName) {
    const homeBuilding = getBuildingsAt(citizen.x, citizen.y).find(b => b.type === 'house')
        || findNearestBuilding(citizen, 'house');
    const workBuilding = findWorkBuilding(citizen);
    const leisureBuilding = findNearestBuilding(citizen, 'park')
        || findNearestBuilding(citizen, 'market')
        || findNearestBuilding(citizen, 'town-hall');

    switch (phaseName) {
        case 'Night':
            return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
        case 'Morning':
            if (workBuilding) return { x: workBuilding.x, y: workBuilding.y };
            return leisureBuilding ? { x: leisureBuilding.x, y: leisureBuilding.y } : null;
        case 'Day':
            if (workBuilding) return { x: workBuilding.x, y: workBuilding.y };
            return leisureBuilding ? { x: leisureBuilding.x, y: leisureBuilding.y } : null;
        case 'Evening':
            return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
        case 'Dusk':
            return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
        default:
            return homeBuilding ? { x: homeBuilding.x, y: homeBuilding.y } : null;
    }
}

self.onmessage = function(e) {
    const { type, id } = e.data;
    if (type === 'INIT') {
        WIDTH = e.data.width || 0;
        HEIGHT = e.data.height || 0;
        if (e.data.buildings) buildings = e.data.buildings.slice();
        self.postMessage({ type: 'READY', id });
    } else if (type === 'UPDATE_BUILDINGS') {
        buildings = (e.data.buildings || []).slice();
        self.postMessage({ type: 'UPDATED', id });
    } else if (type === 'FIND_TARGET') {
        const { citizenId, x, y, job, phaseName } = e.data;
        const citizen = { x, y, job, id: citizenId };
        const target = getTargetLocation(citizen, phaseName);
        self.postMessage({ type: 'TARGET_RESULT', id, citizenId, target });
    } else if (type === 'SCHEDULE_BATCH') {
        const { citizens, phaseName } = e.data;
        const results = [];
        for (const c of citizens) {
            const target = getTargetLocation({ x: c.x, y: c.y, job: c.job, id: c.id }, phaseName);
            results.push({ id: c.id, target });
        }
        self.postMessage({ type: 'SCHEDULE_BATCH_RESULT', id, results });
    } else if (type === 'PING') {
        self.postMessage({ type: 'PONG', id });
    }
};
