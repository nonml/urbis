/**
 * Asset Decoder Worker Pool — KTX2 / meshopt / Draco decode off main (Q12.A q12-wk-asset-decoder)
 * Protocol (pool of 1 worker for now, scalable to N):
 *   DECODE { type:'DECODE', id, assetType:'ktx2'|'draco'|'meshopt'|'image', buffer: ArrayBuffer, meta }
 * Response { type:'DECODED', id, assetType, result: ArrayBuffer, ms }
 *
 * In this tranche the worker is a passthrough scaffold that measures decode time
 * and proves the worker-only path. Real Basis/ETC1S and Draco WASM decoders
 * are wired in Q12.C via `q12-cm-runtime-decode`.
 */
self.onmessage = function(e) {
    const { type, id } = e.data;
    if (type === 'DECODE') {
        const start = performance.now();
        const { assetType, buffer } = e.data;
        // Scaffold: no heavy decode yet — just transfer and time.
        // Q12.C will replace this branch with KTX2 Basis transcoding
        // and Draco/meshopt geometry decode via WASM imported via importScripts.
        const result = buffer ? buffer.slice(0) : null;
        const ms = performance.now() - start;
        self.postMessage({ type: 'DECODED', id, assetType, result, ms }, result ? [result] : []);
    } else if (type === 'DECODE_BATCH') {
        const start = performance.now();
        const out = [];
        for (const job of e.data.jobs || []) {
            out.push({ id: job.id, assetType: job.assetType, result: job.buffer ? job.buffer.slice(0) : null });
        }
        const ms = performance.now() - start;
        self.postMessage({ type:'DECODED_BATCH', id, out, ms });
    } else if (type === 'PING') {
        self.postMessage({ type: 'PONG', id });
    }
};
