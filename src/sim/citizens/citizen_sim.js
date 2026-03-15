import { ensureCitizenState, deriveMood, getCitizenCapForPreset } from './citizen_state.js';
import CitizenWorkerConstructor from '../../workers/citizen_worker.js?worker';

export class CitizenSim {
    constructor(game) {
        this.game = game;
        this.lastTickMs = 0;
        this.lodCounts = { near: 0, mid: 0, far: 0 };

        // WebWorker for needs/mood/relationship calculations (3D)
        this._worker = null;
        this._workerReady = false;
        this._pendingWorkerResult = null; // results from last async tick, applied next tick
        this._workerMsgId = 0;
        this._initWorker();
    }

    _initWorker() {
        try {
            this._worker = new CitizenWorkerConstructor();
            this._worker.onmessage = (e) => {
                if (e.data?.type === 'UPDATE_RESULT') {
                    this._pendingWorkerResult = e.data.results;
                }
            };
            this._worker.onerror = (err) => {
                console.warn('[CitizenSim] Worker error, falling back to main thread:', err?.message);
                this._worker = null;
            };
            this._workerReady = true;
        } catch (err) {
            console.info('[CitizenSim] WebWorker unavailable, running sync:', err.message);
        }
    }

    enforceCitizenCap() {
        const cap = getCitizenCapForPreset(this.game.state.meta.mapPreset);
        const citizens = this.game.citizens.citizens;
        if (citizens.length <= cap) return;
        citizens.sort((a, b) => a.id - b.id);
        citizens.length = cap;
    }

    getLODTier(citizen) {
        const px = this.game.player.x;
        const py = this.game.player.y;
        const d = Math.abs(citizen.x - px) + Math.abs(citizen.y - py);
        if (d <= 20) return 'near';
        if (d <= 60) return 'mid';
        return 'far';
    }

    updateNeeds(citizen, tier) {
        const decay = tier === 'near' ? 1.0 : tier === 'mid' ? 0.6 : 0.25;
        citizen.needs.food = Math.max(0, citizen.needs.food - decay * 0.8);
        citizen.needs.rest = Math.max(0, citizen.needs.rest - decay * 0.6);
        citizen.needs.safety = Math.max(0, citizen.needs.safety - decay * 0.25);

        if (citizen.needs.food < 30) citizen.happiness = Math.max(0, citizen.happiness - 0.8);
        if (citizen.needs.rest < 30) citizen.happiness = Math.max(0, citizen.happiness - 0.6);
        if (citizen.needs.safety < 30) citizen.happiness = Math.max(0, citizen.happiness - 0.5);
        citizen.mood = deriveMood(citizen);
    }

    updateMovement(citizen, timeOfDay, tier, tick) {
        if (tier === 'far' && (tick % 4 !== 0)) return;
        if (tier === 'mid' && (tick % 2 !== 0)) return;
        const result = this.game.scheduleManager.updateCitizenSchedule(
            citizen,
            { map: this.game.map, buildings: this.game.buildings },
            timeOfDay
        );

        if (citizen.x === citizen._sim.lastX && citizen.y === citizen._sim.lastY) {
            citizen._sim.stuckTicks++;
        } else {
            citizen._sim.stuckTicks = 0;
        }
        citizen._sim.lastX = citizen.x;
        citizen._sim.lastY = citizen.y;

        // Anti-oscillation fallback.
        if (!result.moved && citizen._sim.stuckTicks > 6) {
            const dirs = [
                { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
            ];
            for (const dir of dirs) {
                const nx = citizen.x + dir.x;
                const ny = citizen.y + dir.y;
                if (this.game.scheduleManager.isWalkable(nx, ny)) {
                    citizen.x = nx;
                    citizen.y = ny;
                    citizen._sim.stuckTicks = 0;
                    break;
                }
            }
        }
    }

    updateRelationships(citizen, tier, tick) {
        if (tier === 'far') return;
        if (tick % 3 !== 0) return;
        const peers = this.game.citizens.citizens
            .filter((other) => other.id !== citizen.id)
            .filter((other) => Math.abs(other.x - citizen.x) + Math.abs(other.y - citizen.y) <= 3)
            .sort((a, b) => a.id - b.id);
        if (peers.length === 0) return;
        const target = peers[0];

        let edge = citizen.relationshipEdges.find((e) => e.id === target.id);
        if (!edge) {
            edge = { id: target.id, affinity: 0 };
            citizen.relationshipEdges.push(edge);
        }
        const moodBoost = citizen.mood === 'optimistic' ? 2 : (citizen.mood === 'stressed' ? -2 : 1);
        edge.affinity = Math.max(-100, Math.min(100, edge.affinity + moodBoost));

        citizen.relationshipEdges.sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity) || a.id - b.id);
        if (citizen.relationshipEdges.length > 8) {
            citizen.relationshipEdges.length = 8;
        }
    }

    /**
     * Apply results that arrived from the worker during the previous tick.
     * Only updates needs/mood/relationships; position stays authoritative on main thread.
     */
    _applyWorkerResults(citizens) {
        if (!this._pendingWorkerResult) return;
        const byId = new Map(citizens.map(c => [c.id, c]));
        for (const r of this._pendingWorkerResult) {
            const c = byId.get(r.id);
            if (!c) continue;
            c.needs = r.needs;
            c.happiness = r.happiness;
            c.mood = r.mood;
            c.relationshipEdges = r.relationshipEdges;
            if (c._sim) c._sim.lodTier = r.lodTier;
        }
        this._pendingWorkerResult = null;
    }

    /**
     * Dispatch citizen state snapshot to worker for async needs/mood update.
     * Only serializable fields are sent (no circular references).
     */
    _dispatchToWorker(citizens, tick) {
        if (!this._worker) return;
        const px = this.game.player.x;
        const py = this.game.player.y;
        const snapshot = citizens.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            needs: { ...c.needs },
            happiness: c.happiness,
            mood: c.mood,
            relationshipEdges: c.relationshipEdges?.map(e => ({ ...e })) ?? [],
        }));
        this._worker.postMessage({
            type: 'UPDATE_CITIZENS',
            id: ++this._workerMsgId,
            payload: { citizens: snapshot, playerX: px, playerY: py, tick },
        });
    }

    updateAll(citizens, timeOfDay, tick) {
        const t0 = performance.now();
        this.enforceCitizenCap();
        this.lodCounts = { near: 0, mid: 0, far: 0 };

        citizens.sort((a, b) => a.id - b.id);

        // Apply worker results from previous tick (double-buffered async)
        if (this._worker) {
            this._applyWorkerResults(citizens);
        }

        for (const citizen of citizens) {
            ensureCitizenState(citizen, this.game.map);
            const tier = this.getLODTier(citizen);
            if (citizen._sim) citizen._sim.lodTier = tier;
            this.lodCounts[tier]++;

            // When worker is active, skip needs/relationships on main thread
            // (worker handles them async; movement always stays here)
            if (!this._worker) {
                this.updateNeeds(citizen, tier);
                this.updateRelationships(citizen, tier, tick);
            }
            this.updateMovement(citizen, timeOfDay, tier, tick);
        }

        // Dispatch current state to worker for next tick
        if (this._worker) {
            this._dispatchToWorker(citizens, tick);
        }

        this.lastTickMs = performance.now() - t0;
    }

    destroy() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
    }
}
