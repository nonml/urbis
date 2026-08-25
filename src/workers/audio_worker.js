/**
 * Audio Worker — off-main-thread mixing / sfx synthesis scheduling (Q12.A q12-wk-audio-worker)
 * The Web Audio graph stays on main (AudioContext not transferable), but
 * scheduling, ducking envelopes, and procedural sfx param generation run here.
 * Protocol:
 *   PLAY     { type:'PLAY', id, sfx, params }
 *   DUCK     { type:'DUCK', id, durationMs, level }
 *   MIX_TICK { type:'MIX_TICK', id, dt, duckLevel }
 * Response echoes id with computed levels so main thread just applies gains.
 */
let duckLevel = 1;
let duckRemaining = 0;

self.onmessage = function(e) {
    const { type, id } = e.data;
    if (type === 'PLAY') {
        const { sfx, params } = e.data;
        // Param synthesis is deterministic; return normalized cue
        const cue = { sfx, params: { ...params, _workerTS: Date.now() } };
        self.postMessage({ type: 'PLAY_RESULT', id, cue });
    } else if (type === 'DUCK') {
        duckLevel = e.data.level ?? 0.25;
        duckRemaining = e.data.durationMs ?? 2000;
        self.postMessage({ type: 'DUCK_RESULT', id, duckLevel, duckRemaining });
    } else if (type === 'MIX_TICK') {
        const dt = e.data.dt ?? 16;
        if (duckRemaining > 0) {
            duckRemaining = Math.max(0, duckRemaining - dt);
            if (duckRemaining === 0) duckLevel = 1;
        }
        self.postMessage({ type: 'MIX_RESULT', id, duckLevel, duckRemaining });
    } else if (type === 'PING') {
        self.postMessage({ type: 'PONG', id });
    }
};
