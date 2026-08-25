/**
 * Faction Worker — off-main-thread faction sim tick (Q12.A q12-wk-faction-worker)
 * Protocol: { type:'TICK', id, factions:[{id,rep,influence}], delta }
 * Response: { type:'TICK_RESULT', id, factions }
 *
 * The pure core `tickFactions` mirrors FactionSystem.update()'s sync fallback
 * drift EXACTLY (drift toward 0 + influence follows rep band) so browser
 * (worker) and headless (fallback) runs produce identical results. Exported
 * for headless unit tests; the message handler is `self`-guarded.
 */

export function clampRep(v) {
    return Math.max(-100, Math.min(100, Math.round(v)));
}

/**
 * One deterministic faction drift tick — identical to the main-thread fallback.
 * @param {Array<{id:string,rep:number,influence:number}>} factions
 * @param {number} delta  tick scale (always 1 in practice)
 * @returns {Array<{id:string,rep:number,influence:number}>}
 */
export function tickFactions(factions, delta = 1) {
    return factions.map(f => {
        const cur = f.rep ?? 0;
        const drift = cur > 0 ? -0.02 * delta : cur < 0 ? 0.02 * delta : 0;
        const rep = clampRep(cur + drift);
        const inf = f.influence ?? 50;
        const influence = Math.max(0, Math.min(100,
            inf + (rep > 20 ? 0.05 : rep < -20 ? -0.05 : 0)));
        return { id: f.id, rep, influence };
    });
}

function handleMessage(e) {
    const { type, id } = e.data;
    if (type === 'TICK') {
        const { factions, delta } = e.data;
        const out = tickFactions(factions, delta);
        self.postMessage({ type: 'TICK_RESULT', id, factions: out });
    } else if (type === 'PING') {
        self.postMessage({ type: 'PONG', id });
    }
}

if (typeof self !== 'undefined') {
    self.onmessage = handleMessage;
}