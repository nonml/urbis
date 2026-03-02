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
 * Extract road graph from map
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
    const visited = new Set();
    const graph = new RoadGraph(width, height);

    // Directions: 8-connected (including diagonals)
    const directions = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
        { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ];

    /**
     * DFS to find connected road segments
     */
    function findRoadSegment(startX, startY, segment) {
        const stack = [{ x: startX, y: startY }];
        const segmentVisited = new Set();
        segmentVisited.add(`${startX},${startY}`);

        while (stack.length > 0) {
            const current = stack.pop();
            segment.push(current);

            for (const dir of directions) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const key = `${nx},${ny}`;

                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                if (segmentVisited.has(key)) continue;

                const idx = ny * width + nx;
                if (roadMap[idx] === 1) {
                    segmentVisited.add(key);
                    stack.push({ x: nx, y: ny });
                }
            }
        }

        return segment;
    }

    // Find all connected road segments
    const roadSegments = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (roadMap[idx] === 1 && !visited.has(`${x},${y}`)) {
                const segment = findRoadSegment(x, y, []);
                if (segment.length >= minRoadLength) {
                    roadSegments.push(segment);
                    for (const p of segment) {
                        visited.add(`${p.x},${p.y}`);
                    }
                }
            }
        }
    }

    // Build graph from segments
    for (const segment of roadSegments) {
        // Create nodes for each tile in segment
        const nodesInSegment = [];
        for (const pos of segment) {
            const node = graph.getOrCreateNode(pos.x, pos.y);
            nodesInSegment.push(node);
        }

        // Connect consecutive nodes
        for (let i = 0; i < nodesInSegment.length - 1; i++) {
            graph.connectNodes(nodesInSegment[i], nodesInSegment[i + 1]);
        }
    }

    // Merge nearby nodes (simplify graph)
    mergeNearbyNodes(graph, 2);

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