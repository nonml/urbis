/**
 * Worker Pool Facade — Q12.A aggregates all 6 off-main workers
 * Provides lazy, headless-safe proxies so every worker has a real consumer.
 */
let factionWorker = null;
let audioWorker = null;
let saveWorker = null;
let assetWorker = null;

function isHeadless() {
    return typeof window === 'undefined' || typeof Worker === 'undefined';
}

function getFactionWorker() {
    if (factionWorker || isHeadless()) return factionWorker;
    try { factionWorker = new Worker(new URL('./faction_worker.js', import.meta.url), { type: 'module' }); } catch { factionWorker = null; }
    return factionWorker;
}
function getAudioWorker() {
    if (audioWorker || isHeadless()) return audioWorker;
    try { audioWorker = new Worker(new URL('./audio_worker.js', import.meta.url), { type: 'module' }); } catch { audioWorker = null; }
    return audioWorker;
}
function getSaveWorker() {
    if (saveWorker || isHeadless()) return saveWorker;
    try { saveWorker = new Worker(new URL('./save_worker.js', import.meta.url), { type: 'module' }); } catch { saveWorker = null; }
    return saveWorker;
}
function getAssetWorker() {
    if (assetWorker || isHeadless()) return assetWorker;
    try { assetWorker = new Worker(new URL('./asset_decoder_worker.js', import.meta.url), { type: 'module' }); } catch { assetWorker = null; }
    return assetWorker;
}

let _nextId = 1;
function nextId() { return `w${_nextId++}_${Date.now()}`; }

export function tickFactionsViaWorker(factions, delta) {
    const w = getFactionWorker();
    if (!w) return Promise.resolve(null);
    return new Promise((resolve) => {
        const id = nextId();
        const onMsg = (e) => {
            if (e.data?.type === 'TICK_RESULT' && e.data?.id === id) { w.removeEventListener('message', onMsg); resolve(e.data.factions); }
        };
        w.addEventListener('message', onMsg);
        w.postMessage({ type: 'TICK', id, factions, delta });
        setTimeout(() => { w.removeEventListener('message', onMsg); resolve(null); }, 50);
    });
}

export function playSfxViaWorker(sfx, params) {
    const w = getAudioWorker();
    if (!w) return Promise.resolve(null);
    return new Promise((resolve) => {
        const id = nextId();
        const onMsg = (e) => { if (e.data?.type === 'PLAY_RESULT' && e.data?.id === id) { w.removeEventListener('message', onMsg); resolve(e.data.cue); } };
        w.addEventListener('message', onMsg);
        w.postMessage({ type: 'PLAY', id, sfx, params });
        setTimeout(() => { w.removeEventListener('message', onMsg); resolve(null); }, 30);
    });
}

export function serializeSaveViaWorker(data) {
    const w = getSaveWorker();
    if (!w) return Promise.resolve(JSON.stringify(data));
    return new Promise((resolve) => {
        const id = nextId();
        const onMsg = (e) => { if (e.data?.type === 'SERIALIZED' && e.data?.id === id) { w.removeEventListener('message', onMsg); resolve(e.data.json); } };
        w.addEventListener('message', onMsg);
        w.postMessage({ type: 'SERIALIZE', id, data });
        setTimeout(() => { w.removeEventListener('message', onMsg); resolve(JSON.stringify(data)); }, 200);
    });
}

export function decodeAssetViaWorker(assetType, buffer, meta = {}) {
    const w = getAssetWorker();
    if (!w || !buffer) return Promise.resolve(buffer);
    return new Promise((resolve) => {
        const id = nextId();
        const onMsg = (e) => { if (e.data?.type === 'DECODED' && e.data?.id === id) { w.removeEventListener('message', onMsg); resolve(e.data.result); } };
        w.addEventListener('message', onMsg);
        w.postMessage({ type: 'DECODE', id, assetType, buffer, meta }, [buffer.slice(0)]);
        setTimeout(() => { w.removeEventListener('message', onMsg); resolve(buffer); }, 200);
    });
}

// Re-export existing workers for audit completeness
export { getFactionWorker, getAudioWorker, getSaveWorker, getAssetWorker };
export function getPathfindingWorkerRef() {
    try { return new Worker(new URL('./pathfinding_worker.js', import.meta.url), { type: 'module' }); } catch { return null; }
}
export function getCitizenWorkerRef() {
    try { return new Worker(new URL('./citizen_worker.js', import.meta.url), { type: 'module' }); } catch { return null; }
}
