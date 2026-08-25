// Road Graph Extraction - Milestone H-01
// Extracts a graph representation from the road network for routing

import { TERRAIN_ROAD, TERRAIN_SIDEWALK } from '../../constants.js';

// Node in the road graph
export class RoadGraphNode {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.neighbors = []; // Array of {nodeId, distance}
    }
}

// Road graph for pathfinding
export class RoadGraph {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.nodes = new Map(); // nodeId -> RoadGraphNode
        this.nodeGrid = new Int32Array(width * height); // x,y -> nodeId index
        this.nodeGrid.fill(-1);
        this.nextNodeId = 0;
        this.isDirty = true;
    }

    /**
     * Get node ID for coordinates, or -1 if no node exists
     */
    getNodeAt(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
        return this.nodeGrid[y * this.width + x];
    }

    /**
     * Get node by ID
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    /**
     * Add or get a node at coordinates
     */
    getOrCreateNode(x, y) {
        const idx = y * this.width + x;
        const existingId = this.nodeGrid[idx];
        if (existingId >= 0) {
            return this.nodes.get(existingId);
        }

        const node = new RoadGraphNode(x, y, this.nextNodeId++);
        this.nodes.set(node.id, node);
        this.nodeGrid[idx] = node.id;
        return node;
    }

    /**
     * Add a connection between two nodes
     */
    connectNodes(nodeA, nodeB) {
        const dist = Math.sqrt((nodeB.x - nodeA.x) ** 2 + (nodeB.y - nodeA.y) ** 2);
        // Only add if not already connected
        const existingA = nodeA.neighbors.find(n => n.nodeId === nodeB.id);
        const existingB = nodeB.neighbors.find(n => n.nodeId === nodeA.id);
        if (!existingA) nodeA.neighbors.push({ nodeId: nodeB.id, distance: dist });
        if (!existingB) nodeB.neighbors.push({ nodeId: nodeA.id, distance: dist });
    }

    /**
     * Check if a tile is connected to the road graph
     */
    isConnected(x, y) {
        return this.getNodeAt(x, y) >= 0;
    }

    /**
     * Get the nearest graph node to a position
     */
    getNearestNode(x, y) {
        let bestNode = null;
        let bestDist = Infinity;

        for (const node of this.nodes.values()) {
            const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
            if (dist < bestDist) {
                bestDist = dist;
                bestNode = node;
            }
        }

        return bestNode;
    }

    /**
     * Serialize graph for save
     */
    serialize() {
        return {
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
                id: parseInt(id),
                x: node.x,
                y: node.y,
                neighborIds: node.neighbors.map(n => n.nodeId)
            })),
            nextNodeId: this.nextNodeId
        };
    }

    /**
     * Deserialize graph from save
     */
    deserialize(data) {
        if (!data) return;
        this.nodes.clear();
        this.nodeGrid.fill(-1);
        this.nextNodeId = data.nextNodeId || 0;

        for (const nodeData of data.nodes) {
            const node = new RoadGraphNode(nodeData.x, nodeData.y, nodeData.id);
            node.neighbors = nodeData.neighborIds.map(id => ({ nodeId: id, distance: 1 }));
            this.nodes.set(node.id, node);
            this.nodeGrid[node.y * this.width + node.x] = node.id;
        }
    }

    /**
     * Clear the graph
     */
    clear() {
        this.nodes.clear();
        this.nodeGrid.fill(-1);
        this.nextNodeId = 0;
    }
}

/**
 * Extract road graph from map — intersection graph so every 4-way is one node.
 * Vehicles see a real street network (degree = 2,3,4) and pause at degree ≥3.
 * @param {Object} map - Map object with roadMap
 * @param {Object} [options] - Extraction options
 * @param {number} [options.minRoadLength=2] - Minimum consecutive road tiles
 * @returns {RoadGraph} Extracted road graph
 */
export function extractRoadGraph(map, options = {}) {
    const { minRoadLength = 2 } = options;
    const width = map.width;
    const height = map.height;
    const roadMap = map.roadMap || new Uint8Array(width * height);
    const graph = new RoadGraph(width, height);
    const isRoad = (x, y) => x >= 0 && y >= 0 && x < width && y < height && roadMap[y * width + x] === 1;
    const cardinal = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    const degree = (x, y) => cardinal.reduce((c, d) => c + (isRoad(x + d.dx, y + d.dy) ? 1 : 0), 0);

    // 1) Collect intersection / endpoint nodes (degree != 2) — the Watch Dogs street graph
    const nodeAt = new Map(); // key -> RoadGraphNode
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (!isRoad(x, y)) continue;
        const deg = degree(x, y);
        if (deg !== 2) {
            const n = graph.getOrCreateNode(x, y);
            nodeAt.set(`${x},${y}`, n);
        }
    }
    // No intersections (single straight line) -> keep endpoints so graph not empty
    if (nodeAt.size === 0) {
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (isRoad(x, y)) {
            const first = graph.getOrCreateNode(x, y);
            nodeAt.set(`${x},${y}`, first);
            break;
        }
    }

    // 2) Walk from every node along each cardinal ray until next node, create edge
    const visitedEdge = new Set();
    for (const [key, node] of nodeAt) {
        const [sx, sy] = key.split(',').map(Number);
        for (const dir of cardinal) {
            const nx = sx + dir.dx, ny = sy + dir.dy;
            if (!isRoad(nx, ny)) continue;
            const edgeKey = `${sx},${sy}->${dir.dx},${dir.dy}`;
            if (visitedEdge.has(edgeKey)) continue;
            // Walk until next intersection or dead end
            let cx = nx, cy = ny, steps = 1;
            let targetKey = null;
            const trail = [{x: sx, y: sy}];
            while (true) {
                const deg = degree(cx, cy);
                trail.push({x: cx, y: cy});
                if (deg !== 2 || nodeAt.has(`${cx},${cy}`)) { targetKey = `${cx},${cy}`; break; }
                // Continue straight-ish: pick the neighbor that isn't the previous tile
                let next = null;
                for (const d of cardinal) {
                    const tx = cx + d.dx, ty = cy + d.dy;
                    if (!isRoad(tx, ty)) continue;
                    // avoid going back
                    const prev = trail[trail.length - 2];
                    if (prev && tx === prev.x && ty === prev.y) continue;
                    next = { x: tx, y: ty }; break;
                }
                if (!next) break;
                cx = next.x; cy = next.y;
                steps++;
                if (steps > 500) break;
            }
            if (!targetKey) continue;
            let target = nodeAt.get(targetKey);
            if (!target) { target = graph.getOrCreateNode(cx, cy); nodeAt.set(targetKey, target); }
            if (target.id === node.id) continue;
            const fwd = `${sx},${sy}->${cx},${cy}`;
            const rev = `${cx},${cy}->${sx},${sy}`;
            if (visitedEdge.has(fwd) || visitedEdge.has(rev)) continue;
            graph.connectNodes(node, target);
            visitedEdge.add(fwd); visitedEdge.add(rev);
        }
    }

    // 3) Isolated straight segments (no intersections) — keep as single edge
    if (graph.nodes.size === 0) {
        const visited = new Set();
        const dirs4 = cardinal;
        function dfs(sx, sy, seg) {
            const stack = [{x: sx, y: sy}]; visited.add(`${sx},${sy}`);
            while (stack.length) {
                const cur = stack.pop(); seg.push(cur);
                for (const d of dirs4) {
                    const nx = cur.x + d.dx, ny = cur.y + d.dy;
                    const k = `${nx},${ny}`;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    if (visited.has(k)) continue;
                    if (!isRoad(nx, ny)) continue;
                    visited.add(k); stack.push({x: nx, y: ny});
                }
            }
        }
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (!isRoad(x, y) || visited.has(`${x},${y}`)) continue;
            const seg = []; dfs(x, y, seg);
            if (seg.length < minRoadLength) continue;
            const nodes = seg.map(p => graph.getOrCreateNode(p.x, p.y));
            for (let i = 0; i < nodes.length - 1; i++) graph.connectNodes(nodes[i], nodes[i+1]);
        }
        mergeNearbyNodes(graph, 2);
    }

    graph.isDirty = false;
    return graph;
}

/**
 * Merge nodes that are very close together
 */
function mergeNearbyNodes(graph, maxDistance) {
    const nodes = Array.from(graph.nodes.values());
    const toMerge = new Map(); // nodeId -> nodeId to merge into

    for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (toMerge.has(a.id)) continue;

        for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            if (toMerge.has(b.id)) continue;

            const dist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
            if (dist <= maxDistance) {
                toMerge.set(b.id, a.id);
            }
        }
    }

    if (toMerge.size === 0) return;

    // Merge nodes
    const newNodes = new Map();
    for (const [id, node] of graph.nodes) {
        if (toMerge.has(id)) {
            // Skip - this node will be merged
        } else {
            // Update neighbors that point to merged nodes
            const mergedNeighbors = [];
            for (const neighbor of node.neighbors) {
                const targetId = toMerge.get(neighbor.nodeId) || neighbor.nodeId;
                if (targetId !== node.id) {
                    mergedNeighbors.push({ nodeId: targetId, distance: neighbor.distance });
                }
            }
            node.neighbors = mergedNeighbors;
            newNodes.set(node.id, node);
        }
    }

    // Update node grid
    graph.nodes = newNodes;
    graph.nodeGrid.fill(-1);
    for (const [id, node] of graph.nodes) {
        graph.nodeGrid[node.y * graph.width + node.x] = node.id;
    }
}

/**
 * Find nearest road tile to a position using BFS
 */
export function findNearestRoadTile(map, x, y, maxDistance = 30) {
    const width = map.width;
    const height = map.height;
    const roadMap = map.roadMap || new Uint8Array(width * height);
    const visited = new Set();
    const queue = [{ x: Math.round(x), y: Math.round(y), dist: 0 }];

    while (queue.length > 0) {
        const { x: cx, y: cy, dist } = queue.shift();

        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        if (visited.has(`${cx},${cy}`)) continue;
        visited.add(`${cx},${cy}`);

        const idx = cy * width + cx;
        if (roadMap[idx] === 1) {
            return { x: cx, y: cy, dist };
        }

        if (dist >= maxDistance) continue;

        queue.push(
            { x: cx + 1, y: cy, dist: dist + 1 },
            { x: cx - 1, y: cy, dist: dist + 1 },
            { x: cx, y: cy + 1, dist: dist + 1 },
            { x: cx, y: cy - 1, dist: dist + 1 }
        );
    }

    return null;
}