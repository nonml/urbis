// @ts-check
/// <reference path="../../types/game.d.ts" />
// Deterministic name pool — seeded by citizen ID so names are stable across saves
const _FIRST = [
    'James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Charles',
    'Mary','Patricia','Jennifer','Linda','Barbara','Elizabeth','Susan','Jessica','Sarah','Karen',
    'Alex','Jordan','Taylor','Morgan','Casey','Riley','Quinn','Avery','Dakota','Reese',
    'Kai','Lena','Marco','Nina','Omar','Priya','Sam','Tae','Uma','Victor',
];
const _LAST = [
    'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
    'Hernandez','Lopez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee',
    'Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
    'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Rivera',
];

/** Stable name from citizen ID — no external deps, no Random() calls */
function _citizenName(id) {
    const h = (id * 2654435769) >>> 0; // FNV-like 1-round mix
    return `${_FIRST[h % _FIRST.length]} ${_LAST[(h >>> 10) % _LAST.length]}`;
}

export const CITIZEN_CAPS = {
    SMALL: 300,
    CITY: 2000,
    MEGA: 8000,
};

function clamp01(v) {
    return Math.max(0, Math.min(100, v));
}

export function getCitizenCapForPreset(preset = 'CITY') {
    return CITIZEN_CAPS[preset] || CITIZEN_CAPS.CITY;
}

export function ensureCitizenState(citizen, map = null) {
    if (!citizen.schedule) {
        citizen.schedule = {
            night: 'home',
            morning: 'work',
            day: 'work',
            evening: 'leisure',
            dusk: 'home',
        };
    }
    if (!citizen.needs) {
        citizen.needs = {
            food: 100,
            rest: 100,
            safety: 100,
        };
    }
    if (citizen.mood === undefined) {
        citizen.mood = 'content';
    }
    if (!citizen.name) {
        citizen.name = _citizenName(citizen.id ?? 0);
    }
    if (!citizen.traits) {
        const primary = citizen.personality?.primary || 'adaptive';
        const secondary = citizen.personality?.secondary || 'steady';
        citizen.traits = [primary, secondary];
    }
    if (!Array.isArray(citizen.relationshipEdges)) {
        citizen.relationshipEdges = [];
    }
    if (citizen.homeParcel === undefined || citizen.homeParcel === null) {
        citizen.homeParcel = map?.getParcelAt?.(citizen.x, citizen.y) ?? -1;
    }
    if (citizen.workBuildingId === undefined) {
        citizen.workBuildingId = null;
    }
    if (citizen.unemployedTicks === undefined) {
        citizen.unemployedTicks = 0;
    }
    if (!citizen._sim) {
        citizen._sim = {
            lastX: citizen.x,
            lastY: citizen.y,
            stuckTicks: 0,
            lodTier: 'near',
            chatTimer: 0,
            chatPartnerId: null,
        };
    }
    if (citizen._sim.chatTimer === undefined) {
        citizen._sim.chatTimer = 0;
        citizen._sim.chatPartnerId = null;
    }
    if (citizen._sim.alertState === undefined) {
        citizen._sim.alertState = null;
        citizen._sim.alertTimer = 0;
        citizen._sim.alertCooldown = 0;
        citizen._sim.alertTargetX = 0;
        citizen._sim.alertTargetY = 0;
    }
    if (citizen._sim.fleeTimer === undefined) {
        citizen._sim.fleeTimer = 0;
        citizen._sim.fleeTargetX = 0;
        citizen._sim.fleeTargetY = 0;
        citizen._sim.fleeReported = false;
    }
    if (citizen._sim.engState === undefined) {
        citizen._sim.engState = null;
        citizen._sim.engCover = null;
        citizen._sim.engThreatX = 0;
        citizen._sim.engThreatY = 0;
        citizen._sim.engFireTimer = 0;
        citizen._sim.engDuckTimer = 0;
    }
    if (citizen._sim.surrendered === undefined) {
        citizen._sim.surrendered = false;
        citizen._sim.surrenderTimer = 0;
    }
    if (!Array.isArray(citizen.incomeHistory)) {
        const base = citizen.income ?? citizen.salary ?? 0;
        citizen.incomeHistory = new Array(12).fill(base);
        citizen._lastIncomeSnap = 0;
    }
    citizen.needs.food = clamp01(citizen.needs.food);
    citizen.needs.rest = clamp01(citizen.needs.rest);
    citizen.needs.safety = clamp01(citizen.needs.safety);
    return citizen;
}

const MONTH_TICKS = 30;

export function snapshotIncomeIfDue(citizen, tick) {
    if (!Array.isArray(citizen.incomeHistory)) return;
    const last = citizen._lastIncomeSnap ?? 0;
    if (tick - last < MONTH_TICKS) return;
    citizen._lastIncomeSnap = tick;
    citizen.incomeHistory.push(citizen.income ?? citizen.salary ?? 0);
    if (citizen.incomeHistory.length > 12) {
        citizen.incomeHistory.shift();
    }
}

export function deriveMood(citizen) {
    const n = citizen.needs || { food: 100, rest: 100, safety: 100 };
    const avgNeed = (n.food + n.rest + n.safety) / 3;
    const happiness = citizen.happiness ?? 50;
    if (happiness < 20 || avgNeed < 20) return 'desperate';
    if (happiness < 40 || avgNeed < 40) return 'stressed';
    if (happiness > 80 && avgNeed > 75) return 'optimistic';
    return 'content';
}

