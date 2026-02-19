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
        };
    }
    citizen.needs.food = clamp01(citizen.needs.food);
    citizen.needs.rest = clamp01(citizen.needs.rest);
    citizen.needs.safety = clamp01(citizen.needs.safety);
    return citizen;
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

