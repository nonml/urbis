/**
 * Pathfinding Worker — A* fully off the main thread.
 *
 * The worker owns the walkability grid. The main thread only sends:
 *   INIT    → { type:'INIT', width, height, terrain: Uint8Array }
 *             terrain[i] = 1 when the tile is terrain-walkable (road/sidewalk/park).
 *             The buffer is transferred once — the worker keeps it.
 *
 *   UPDATE  → { type:'UPDATE', blocked: Array<[x, y]> }
 *             Rebuilds the grid off-main-thread after building changes.
 *
 *   FIND    → { type:'FIND', id, epoch, citizenId, sx, sy, tx, ty }
 *
 * Responses:
 *   READY   → after INIT (grid allocated)
 *   RESULT  → { type:'RESULT', id, epoch, citizenId, sx, sy, tx, ty, path|null }
 *
 * No SharedArrayBuffer: this worker runs on any host, with or without
 * cross-origin isolation headers. The pure core (buildGrid/solveWalkable)
 * is exported for headless unit tests and imported with a `self` guard.
 */

const ORTH = 1;
const DIAG = 1.4142135623730951;

const DIRS = [
    [1, 0, ORTH], [-1, 0, ORTH],
    [0, 1, ORTH], [0, -1, ORTH],
    [1, 1, DIAG], [1, -1, DIAG],
    [-1, 1, DIAG], [-1, -1, DIAG],
];

const MAX_ITER = 1 << 20;

function isWalkable(grid, w, h, x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return grid[y * w + x] === 1;
}

function octile(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx + dy) + (DIAG - 2) * Math.min(dx, dy);
}

/**
 * Build the walkability grid from terrain + blocked tiles. Pure.
 * @param {number} w
 * @param {number} h
 * @param {Uint8Array} terrain  1 = terrain-walkable
 * @param {Array<[number, number]>} blockedList  tile coords to exclude
 * @returns {Uint8Array} 1 = fully walkable
 */
export function buildGrid(w, h, terrain, blockedList) {
    const blocked = new Set();
    for (const [bx, by] of blockedList) {
        if (bx >= 0 && by >= 0 && bx < w && by < h) blocked.add(by * w + bx);
    }
    const grid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        grid[i] = terrain[i] && !blocked.has(i) ? 1 : 0;
    }
    return grid;
}

/**
 * Binary min-heap A* over a walkability grid. Pure and deterministic.
 * @param {Uint8Array} grid
 * @param {number} w
 * @param {number} h
 * @param {number} sx start x
 * @param {number} sy start y
 * @param {number} tx target x
 * @param {number} ty target y
 * @returns {Array<{x:number,y:number}> | null}
 */
export function solveWalkable(grid, w, h, sx, sy, tx, ty, maxIter = MAX_ITER) {
    if (!isWalkable(grid, w, h, tx, ty)) return null;
    if (!isWalkable(grid, w, h, sx, sy)) return null;

    const size = w * h;
    const encode = (x, y) => y * w + x;
    const start = encode(sx, sy);

    const gScore = new Float32Array(size).fill(Infinity);
    const parent = new Int32Array(size).fill(-1);
    const inClosed = new Uint8Array(size);
    const heapF = new Float64Array(size);
    const heapN = new Int32Array(size);
    let heapLen = 0;

    function swap(i, j) {
        const f = heapF[i]; heapF[i] = heapF[j]; heapF[j] = f;
        const n = heapN[i]; heapN[i] = heapN[j]; heapN[j] = n;
    }

    function push(f, node) {
        let i = heapLen++;
        heapF[i] = f;
        heapN[i] = node;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heapF[p] <= heapF[i]) break;
            swap(i, p);
            i = p;
        }
    }

    function pop() {
        const f = heapF[0];
        const n = heapN[0];
        heapLen--;
        heapF[0] = heapF[heapLen];
        heapN[0] = heapN[heapLen];
        let i = 0;
        for (;;) {
            const l = i * 2 + 1;
            const r = l + 1;
            let m = i;
            if (l < heapLen && heapF[l] < heapF[m]) m = l;
            if (r < heapLen && heapF[r] < heapF[m]) m = r;
            if (m === i) break;
            swap(i, m);
            i = m;
        }
        return [f, n];
    }

    gScore[start] = 0;
    push(octile(sx, sy, tx, ty), start);

    const target = encode(tx, ty);
    let iter = 0;

    while (heapLen > 0 && iter++ < maxIter) {
        const [f, cur] = pop();
        if (cur === target) {
            const path = [];
            let node = cur;
            while (node !== -1) {
                path.push({ x: node % w, y: Math.floor(node / w) });
                node = parent[node];
            }
            path.reverse();
            return path;
        }
        if (inClosed[cur]) continue;
        inClosed[cur] = 1;

        const cx = cur % w;
        const cy = Math.floor(cur / w);
        for (const [dx, dy, cost] of DIRS) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!isWalkable(grid, w, h, nx, ny)) continue;
            const nc = encode(nx, ny);
            if (inClosed[nc]) continue;
            const tentG = gScore[cur] + cost;
            if (tentG >= gScore[nc]) continue;
            gScore[nc] = tentG;
            parent[nc] = cur;
            push(tentG + octile(nx, ny, tx, ty), nc);
        }
    }

    return null;
}

let terrainArr = null;
let walkableGrid = null;
let gridW = 0;
let gridH = 0;

function handleMessage(e) {
    const { type } = e.data;
    if (type === 'INIT') {
        gridW = e.data.width;
        gridH = e.data.height;
        terrainArr = e.data.terrain;
        walkableGrid = buildGrid(gridW, gridH, terrainArr, []);
        self.postMessage({ type: 'READY' });
    } else if (type === 'UPDATE') {
        if (!terrainArr) return;
        walkableGrid = buildGrid(gridW, gridH, terrainArr, e.data.blocked || []);
    } else if (type === 'FIND') {
        if (!walkableGrid) return;
        const { id, epoch, citizenId, sx, sy, tx, ty } = e.data;
        const path = solveWalkable(walkableGrid, gridW, gridH, sx, sy, tx, ty);
        self.postMessage({ type: 'RESULT', id, epoch, citizenId, sx, sy, tx, ty, path });
    }
}

if (typeof self !== 'undefined') {
    self.onmessage = handleMessage;
}