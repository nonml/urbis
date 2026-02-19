import { ensureCitizenState, deriveMood, getCitizenCapForPreset } from './citizen_state.js';

export class CitizenSim {
    constructor(game) {
        this.game = game;
        this.lastTickMs = 0;
        this.lodCounts = { near: 0, mid: 0, far: 0 };
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

    updateAll(citizens, timeOfDay, tick) {
        const t0 = performance.now();
        this.enforceCitizenCap();
        this.lodCounts = { near: 0, mid: 0, far: 0 };

        citizens.sort((a, b) => a.id - b.id);
        for (const citizen of citizens) {
            ensureCitizenState(citizen, this.game.map);
            const tier = this.getLODTier(citizen);
            citizen._sim.lodTier = tier;
            this.lodCounts[tier]++;

            this.updateNeeds(citizen, tier);
            this.updateMovement(citizen, timeOfDay, tier, tick);
            this.updateRelationships(citizen, tier, tick);
        }
        this.lastTickMs = performance.now() - t0;
    }
}
