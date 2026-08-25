import { getFactionPerks, getRepBand } from './perks.js';
import { eventBus, EVENT_TYPES } from '../events.js';

// Faction rivalry pairs: helping one hurts the other
const FACTION_RIVALS = {
    citizens: 'corp',
    corp: 'citizens',
    police: 'gangs',
    gangs: 'police',
};

const FACTION_IDS = ['citizens', 'police', 'gangs', 'corp'];

function clampRep(v) {
    return Math.max(-100, Math.min(100, Math.round(v)));
}

export class FactionSystem {
    constructor(game) {
        this.game = game;
        this.lastHostilityTick = -9999;
        this._repVersion = 0;
        this._pendingResult = null;
        this._pendingVersion = -1;
        this._worker = null;
        this._workerReady = false;
        this._fallback = false;
        this._inflight = false;
        this._inflightVersion = -1;
        this._nextId = 1;
        this._initWorker();
        this.ensureState();
    }

    _initWorker() {
        if (typeof Worker === 'undefined') { this._fallback = true; return; }
        try {
            this._worker = new Worker(new URL('../../workers/faction_worker.js', import.meta.url), { type: 'module' });
            this._worker.onmessage = (e) => this._onMessage(e);
            this._worker.onerror = () => { this._fallback = true; this._worker = null; };
            this._workerReady = true;
        } catch { this._fallback = true; }
    }

    _onMessage(e) {
        const { type, id, factions } = e.data || {};
        if (type === 'READY') { this._workerReady = true; return; }
        if (type !== 'TICK_RESULT') return;
        // Only accept if still inflight (ignore stale)
        if (!this._inflight) return;
        this._pendingResult = factions;
        this._pendingVersion = this._inflightVersion;
        this._inflight = false;
    }

    isWorkerActive() { return !!this._worker && this._workerReady && !this._fallback; }

    _dispatchWorker() {
        if (!this.isWorkerActive() || this._inflight) return;
        const state = this.ensureState();
        const factions = FACTION_IDS.map(id => ({ id, rep: state.reputation[id] ?? 0, influence: state.influence?.[id] ?? 50 }));
        const id = `f${this._nextId++}`;
        this._inflight = true;
        this._inflightVersion = this._repVersion;
        try { this._worker.postMessage({ type: 'TICK', id, factions, delta: 1 }); } catch { this._inflight = false; }
    }

    _applyPendingWorkerResult() {
        if (!this._pendingResult || this._pendingVersion !== this._repVersion) {
            // discard stale worker result if rep changed since dispatch
            if (this._pendingResult && this._pendingVersion !== this._repVersion) this._pendingResult = null;
            return;
        }
        const state = this.ensureState();
        state.influence = state.influence || {};
        for (const f of this._pendingResult) {
            state.reputation[f.id] = clampRep(f.rep);
            state.influence[f.id] = Math.max(0, Math.min(100, f.influence ?? 50));
        }
        this._pendingResult = null;
    }

    ensureState() {
        const f = this.game.state.factions || (this.game.state.factions = {});
        f.list = f.list || [...FACTION_IDS];
        f.reputation = f.reputation || {};
        for (const id of FACTION_IDS) {
            if (!Number.isFinite(f.reputation[id])) f.reputation[id] = 0;
            f.reputation[id] = clampRep(f.reputation[id]);
        }
        f.recentChanges = Array.isArray(f.recentChanges) ? f.recentChanges : [];
        f.influence = f.influence || {};
        for (const id of FACTION_IDS) if (!Number.isFinite(f.influence[id])) f.influence[id] = 50;
        return f;
    }

    getTuningMultiplier(category) {
        const tuning = this.game.state.meta?.devTuning?.factionMultipliers;
        const m = tuning?.[category];
        return Number.isFinite(m) ? m : 1;
    }

    getReputation(factionId) {
        const f = this.ensureState();
        return f.reputation[factionId] ?? 0;
    }

    setReputation(factionId, value, reason = 'set') {
        const f = this.ensureState();
        if (!FACTION_IDS.includes(factionId)) return 0;
        const prev = f.reputation[factionId] || 0;
        const next = clampRep(value);
        f.reputation[factionId] = next;
        const delta = next - prev;
        if (delta !== 0) {
            this._repVersion++;
            this.logChange(factionId, delta, reason, prev, next);
        }
        return next;
    }

    modifyRep(factionId, delta, reason = 'unknown', category = 'quests') {
        const scaled = delta * this.getTuningMultiplier(category);
        const result = this.setReputation(factionId, this.getReputation(factionId) + scaled, reason);

        if (Math.abs(scaled) >= 5) {
            eventBus.emit(EVENT_TYPES.FACTION_REP_CHANGED, {
                factionId,
                delta: scaled,
                reason,
                tick: this.game.state.time?.tick || 0,
            });
        }

        // Cascade: rival faction reacts to significant rep changes
        if (!this._cascading && Math.abs(scaled) >= 10) {
            const rival = FACTION_RIVALS[factionId];
            if (rival) {
                const cascadeDelta = -(scaled * 0.4);
                this._cascading = true;
                this.modifyRep(rival, cascadeDelta, `faction_conflict:${factionId}`, 'faction_conflict');
                this._cascading = false;
                eventBus.emit(EVENT_TYPES.FACTION_CONFLICT_TRIGGERED, {
                    sourceFaction: factionId,
                    affectedFaction: rival,
                    sourceDelta: scaled,
                    cascadeDelta,
                    reason,
                    tick: this.game.state.time?.tick || 0,
                });
            }
        }

        return result;
    }

    logChange(factionId, delta, reason, prev, next) {
        const f = this.ensureState();
        const key = `${factionId}:${reason}`;
        const last = f.recentChanges[f.recentChanges.length - 1];
        if (last && last.key === key && (this.game.state.time.tick - last.tick) <= 2) {
            last.delta += delta;
            last.to = next;
            last.count = (last.count || 1) + 1;
        } else {
            f.recentChanges.push({
                key,
                factionId,
                delta,
                reason,
                from: prev,
                to: next,
                tick: this.game.state.time.tick,
                count: 1,
            });
        }
        while (f.recentChanges.length > 20) f.recentChanges.shift();
    }

    getBands() {
        const rep = this.ensureState().reputation;
        return {
            citizens: getRepBand(rep.citizens),
            police: getRepBand(rep.police),
            gangs: getRepBand(rep.gangs),
            corp: getRepBand(rep.corp),
        };
    }

    getPerkSnapshot() {
        const rep = this.ensureState().reputation;
        return getFactionPerks(rep);
    }

    update() {
        // Double-buffered worker apply (Q12.A) — apply previous tick's worker result before computing perks
        if (this.isWorkerActive()) this._applyPendingWorkerResult();
        this.ensureState();
        const perks = this.getPerkSnapshot();
        this.game.state.factions.perks = perks;
        const world = this.game.state.world || (this.game.state.world = { anomalies: [] });
        world.factionEncounters = world.factionEncounters || [];

        const tick = this.game.state.time.tick || 0;
        const policeRep = this.getReputation('police');
        const gangRep = this.getReputation('gangs');
        if (tick - this.lastHostilityTick >= 5) {
            if (policeRep < -40) {
                this.game.ui?.showMessage?.('Faction: Police hostility rising.', 'crisis');
                world.factionEncounters.push({ tick, faction: 'police', type: 'patrol_pressure' });
                this.lastHostilityTick = tick;
            } else if (gangRep < -40) {
                this.game.ui?.showMessage?.('Faction: Gang threats increasing.', 'crisis');
                world.factionEncounters.push({ tick, faction: 'gangs', type: 'street_threat' });
                this.lastHostilityTick = tick;
            }
        }
        while (world.factionEncounters.length > 50) world.factionEncounters.shift();

        // Dispatch next worker tick, or sync fallback drift when worker unavailable (headless)
        if (this.isWorkerActive()) {
            this._dispatchWorker();
        } else {
            const state = this.ensureState();
            state.influence = state.influence || {};
            for (const id of FACTION_IDS) {
                const cur = state.reputation[id];
                const drift = cur > 0 ? -0.02 : cur < 0 ? 0.02 : 0;
                if (drift !== 0) state.reputation[id] = clampRep(cur + drift);
                const inf = state.influence[id] ?? 50;
                state.influence[id] = Math.max(0, Math.min(100, inf + (state.reputation[id] > 20 ? 0.05 : state.reputation[id] < -20 ? -0.05 : 0)));
            }
        }
    }

    destroy() { try { this._worker?.terminate(); } catch {} }
}

export { FACTION_IDS };
