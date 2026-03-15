/**
 * Citizen Simulation Worker (3D)
 * Handles CPU-intensive citizen needs/mood/relationship calculations off the main thread.
 * Movement (schedule-based pathfinding) stays on the main thread because it requires
 * full access to map and building objects that cannot be easily serialized.
 */

function deriveMood(citizen) {
    const avg = (citizen.needs.food + citizen.needs.rest + citizen.needs.safety) / 3;
    if (avg > 70) return 'happy';
    if (avg > 40) return 'neutral';
    return 'unhappy';
}

function updateNeeds(citizen, tier) {
    const decay = tier === 'near' ? 1.0 : tier === 'mid' ? 0.6 : 0.25;
    citizen.needs.food   = Math.max(0, citizen.needs.food   - decay * 0.8);
    citizen.needs.rest   = Math.max(0, citizen.needs.rest   - decay * 0.6);
    citizen.needs.safety = Math.max(0, citizen.needs.safety - decay * 0.25);

    if (citizen.needs.food   < 30) citizen.happiness = Math.max(0, citizen.happiness - 0.8);
    if (citizen.needs.rest   < 30) citizen.happiness = Math.max(0, citizen.happiness - 0.6);
    if (citizen.needs.safety < 30) citizen.happiness = Math.max(0, citizen.happiness - 0.5);
    citizen.mood = deriveMood(citizen);
}

function updateRelationships(citizen, tier, tick) {
    if (!citizen.relationshipEdges?.length) return;
    if (tick % 5 !== 0) return;
    const moodBoost = citizen.mood === 'happy' ? 1 : citizen.mood === 'unhappy' ? -2 : 0;
    for (const edge of citizen.relationshipEdges) {
        edge.affinity = Math.max(-100, Math.min(100, edge.affinity + moodBoost));
    }
    citizen.relationshipEdges.sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity) || a.id - b.id);
    if (citizen.relationshipEdges.length > 8) citizen.relationshipEdges.length = 8;
}

self.onmessage = function (e) {
    const { type, payload, id } = e.data;
    if (type !== 'UPDATE_CITIZENS') return;

    const { citizens, playerX, playerY, tick } = payload;
    const results = [];

    for (const c of citizens) {
        const d = Math.abs(c.x - playerX) + Math.abs(c.y - playerY);
        const tier = d <= 20 ? 'near' : d <= 60 ? 'mid' : 'far';

        updateNeeds(c, tier);
        updateRelationships(c, tier, tick);

        results.push({
            id: c.id,
            needs: c.needs,
            happiness: c.happiness,
            mood: c.mood,
            relationshipEdges: c.relationshipEdges,
            lodTier: tier,
        });
    }

    self.postMessage({ type: 'UPDATE_RESULT', id, results });
};
