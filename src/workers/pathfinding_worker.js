/**
 * Pathfinding Worker — A* off the main thread.
 *
 * Protocol:
 *   INIT    → { type:'INIT', sab: SharedArrayBuffer, width: number, height: number }
 *             The SAB contains a Uint8Array where 0=blocked, 1=walkable.
 *
 *   UPDATE  → { type:'UPDATE', blocked: Uint8Array }
 *             Bulk-copy new walkability data (e.g. after buildings change).
 *
 *   FIND    → { type:'FIND', id: number, sx: number, sy: number, tx: number, ty: number }
 *
 * Responses:
 *   RESULT  → { type:'RESULT', id: number, path: Array<{x,y}> | null }
 */

const ORTH  = 1;
const DIAG  = 1.4142135623730951;

const DIRS = [
    [ 1,  0, ORTH], [-1,  0, ORTH],
    [ 0,  1, ORTH], [ 0, -1, ORTH],
    [ 1,  1, DIAG], [ 1, -1, DIAG],
    [-1,  1, DIAG], [-1, -1, DIAG],
];

let walkable = null; // Uint8Array backed by SharedArrayBuffer
let WIDTH  = 0;
let HEIGHT = 0;

function isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return false;
    return walkable[y * WIDTH + x] !== 0;
}

function octile(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx + dy) + (DIAG - 2) * Math.min(dx, dy);
}

function aStar(sx, sy, tx, ty) {
    if (!isWalkable(tx, ty)) return null;

    // Encode (x,y) as a single integer for fast map keys
    const encode = (x, y) => y * WIDTH + x;

    const open     = new Float64Array(WIDTH * HEIGHT * 2); // heap: [f, node] pairs
    const gScore   = new Float32Array(WIDTH * HEIGHT).fill(Infinity);
    const parent   = new Int32Array(WIDTH * HEIGHT).fill(-1);
    const inClosed = new Uint8Array(WIDTH * HEIGHT);
    let openLen = 0;

    const startEnc = encode(sx, sy);
    const targetEnc = encode(tx, ty);

    gScore[startEnc] = 0;
    // Min-heap push
    open[openLen * 2]     = octile(sx, sy, tx, ty);
    open[openLen * 2 + 1] = startEnc;
    openLen++;

    const MAX_ITER = 4096;
    let iter = 0;

    while (openLen > 0 && iter++ < MAX_ITER) {
        // Pop minimum
        let minIdx = 0;
        for (let i = 1; i < openLen; i++) {
            if (open[i * 2] < open[minIdx * 2]) minIdx = i;
        }
        const f   = open[minIdx * 2];
        const cur = open[minIdx * 2 + 1];
        // Remove from open array (swap with last)
        open[minIdx * 2]     = open[(openLen - 1) * 2];
        open[minIdx * 2 + 1] = open[(openLen - 1) * 2 + 1];
        openLen--;

        if (cur === targetEnc) {
            // Reconstruct
            const path = [];
            let node = cur;
            while (node !== -1) {
                path.push({ x: node % WIDTH, y: Math.floor(node / WIDTH) });
                node = parent[node];
            }
            path.reverse();
            return path;
        }

        inClosed[cur] = 1;
        const cx = cur % WIDTH;
        const cy = Math.floor(cur / WIDTH);

        for (const [dx, dy, cost] of DIRS) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!isWalkable(nx, ny)) continue;
            const nc = encode(nx, ny);
            if (inClosed[nc]) continue;

            const tentG = gScore[cur] + cost;
            if (tentG < gScore[nc]) {
                gScore[nc] = tentG;
                parent[nc] = cur;
                const h = octile(nx, ny, tx, ty);
                open[openLen * 2]     = tentG + h;
                open[openLen * 2 + 1] = nc;
                openLen++;
            }
        }
    }

    return null; // no path
}

self.onmessage = function(e) {
    const { type } = e.data;

    if (type === 'INIT') {
        WIDTH  = e.data.width;
        HEIGHT = e.data.height;
        walkable = new Uint8Array(e.data.sab);
        self.postMessage({ type: 'READY' });

    } else if (type === 'UPDATE') {
        // SAB is already shared — no copy needed. Re-create the view in case
        // the buffer reference was lost (shouldn't happen, but defensive).
        if (e.data.sab) walkable = new Uint8Array(e.data.sab);

    } else if (type === 'FIND') {
        const { id, citizenId, sx, sy, tx, ty } = e.data;
        const path = aStar(sx, sy, tx, ty);
        self.postMessage({ type: 'RESULT', id, citizenId, path });
    }
};
