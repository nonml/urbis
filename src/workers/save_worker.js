/**
 * Save Worker — serialization off main thread (Q12.A q12-wk-save-worker)
 * Protocol:
 *   SERIALIZE { type:'SERIALIZE', id, data }  data is plain object
 *   DESERIALIZE { type:'DESERIALIZE', id, json }  json is string
 * Response:
 *   SERIALIZED { type:'SERIALIZED', id, json, bytes, ms }
 *   DESERIALIZED { type:'DESERIALIZED', id, data }
 *
 * NOTE: For Q12.G we will upgrade to msgpack; for now the worker proves
 * the off-main-thread path. The msgpack switch is a follow-up tranche
 * and is feature-flagged here via `useMsgpack`.
 */
let useMsgpack = false;

self.onmessage = function(e) {
    const { type, id } = e.data;
    if (type === 'SERIALIZE') {
        const start = performance.now();
        const json = JSON.stringify(e.data.data);
        const bytes = json.length;
        const ms = performance.now() - start;
        self.postMessage({ type: 'SERIALIZED', id, json, bytes, ms, useMsgpack });
    } else if (type === 'DESERIALIZE') {
        const start = performance.now();
        const data = JSON.parse(e.data.json);
        const ms = performance.now() - start;
        self.postMessage({ type: 'DESERIALIZED', id, data, ms });
    } else if (type === 'SET_MSGPACK') {
        useMsgpack = !!e.data.enabled;
        self.postMessage({ type: 'MSGACK', id, useMsgpack });
    } else if (type === 'PING') {
        self.postMessage({ type: 'PONG', id });
    }
};
