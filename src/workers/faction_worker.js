/**
 * Faction Worker — off-main-thread faction sim tick (Q12.A q12-wk-faction-worker)
 * Protocol: { type:'TICK', id, factions:[{id,rep,influence}], delta }
 * Response: { type:'TICK_RESULT', id, factions }
 */
let tickCount = 0;
function clampRep(v) { return Math.max(-100, Math.min(100, v)); }

self.onmessage = function(e) {
    const { type, id } = e.data;
    if (type === 'TICK') {
        const { factions, delta } = e.data;
        tickCount += 1;
        const out = factions.map(f => {
            // Tiny drift toward 0, scaled by delta, deterministic
            const drift = f.rep > 0 ? -0.02 * delta : f.rep < 0 ? 0.02 * delta : 0;
            const rep = clampRep((f.rep ?? 0) + drift);
            const influence = Math.max(0, Math.min(100, (f.influence ?? 50) + (rep > 20 ? 0.05 : rep < -20 ? -0.05 : 0)));
            return { id: f.id, rep, influence };
        });
        // Every 100 ticks inject a small random event (deterministic via tickCount)
        if (tickCount % 100 === 0) {
            const idx = tickCount % out.length;
            out[idx].rep = clampRep(out[idx].rep + (tickCount % 2 ? 1 : -1));
        }
        self.postMessage({ type: 'TICK_RESULT', id, factions: out });
    } else if (type === 'PING') {
        self.postMessage({ type: 'PONG', id });
    }
};
