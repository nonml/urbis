import { eventBus, EVENT_TYPES } from '../events.js';

function clampSeverity(v) {
    return Math.max(1, Math.min(10, Math.round(v)));
}

export class AnomalyDetectors {
    constructor(game) {
        this.game = game;
        this.lastByKey = new Map();
        this.cooldownTicks = 30;
        this.interval = 5;
    }

    run(tick) {
        if (tick % this.interval !== 0) return [];
        const anomalies = [];
        anomalies.push(...this.detectMissingPerson(tick));
        anomalies.push(...this.detectWorkplaceConflict(tick));
        anomalies.push(...this.detectBlackmail(tick));
        for (const anomaly of anomalies) this.record(anomaly, tick);
        return anomalies;
    }

    record(anomaly, tick) {
        const key = `${anomaly.type}:${anomaly.key}`;
        const last = this.lastByKey.get(key) || -Infinity;
        if (tick - last < this.cooldownTicks) return;
        this.lastByKey.set(key, tick);

        const world = this.game.state.world || (this.game.state.world = { anomalies: [] });
        world.anomalies.push(anomaly);
        if (world.anomalies.length > 200) world.anomalies.shift();

        eventBus.emit(EVENT_TYPES.ANOMALY_FOUND, anomaly);
        this.game.ui?.showMessage?.(`Anomaly: ${anomaly.type.replace('_', ' ')}`, 'crisis');
    }

    detectMissingPerson(tick) {
        const out = [];
        const citizens = this.game.citizens.citizens;
        for (const c of citizens) {
            const stuck = c._sim?.stuckTicks || 0;
            const need = c.needs || {};
            if ((need.food ?? 100) < 15 && stuck > 8) {
                out.push(this.makeAnomaly('missing_person', `c${c.id}`, [c.id], c.x, c.y, 7));
                break;
            }
        }
        return out;
    }

    detectWorkplaceConflict(tick) {
        const out = [];
        const groups = new Map();
        for (const c of this.game.citizens.citizens) {
            if (!c.workBuildingId) continue;
            if (!groups.has(c.workBuildingId)) groups.set(c.workBuildingId, []);
            groups.get(c.workBuildingId).push(c);
        }
        for (const [buildingId, workers] of groups.entries()) {
            if (workers.length < 2) continue;
            const angry = workers.filter((w) => (w.happiness ?? 100) < 35);
            if (angry.length >= 2) {
                const b = this.game.buildings.buildings.find((x) => x.id === buildingId);
                out.push(this.makeAnomaly(
                    'workplace_conflict',
                    `b${buildingId}`,
                    angry.slice(0, 3).map((w) => w.id),
                    b?.x ?? workers[0].x,
                    b?.y ?? workers[0].y,
                    5 + angry.length
                ));
                break;
            }
        }
        return out;
    }

    detectBlackmail(tick) {
        const out = [];
        const candidates = this.game.citizens.citizens
            .filter((c) => (c.job === 'official' || c.job === 'merchant') && (c.needs?.safety ?? 100) < 25)
            .sort((a, b) => a.id - b.id);
        if (candidates.length > 0) {
            const c = candidates[0];
            out.push(this.makeAnomaly('blackmail', `c${c.id}`, [c.id], c.x, c.y, 6));
        }
        return out;
    }

    makeAnomaly(type, key, citizenIds, x, y, severity) {
        const districtId = this.game.map.getDistrictAt?.(x, y) ?? -1;
        return {
            id: `${type}_${this.game.state.time.tick}_${key}`,
            type,
            key,
            citizens: citizenIds,
            districtId,
            x,
            y,
            severity: clampSeverity(severity),
            tick: this.game.state.time.tick,
        };
    }
}

