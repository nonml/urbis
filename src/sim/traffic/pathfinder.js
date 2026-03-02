// Traffic Pathfinder - Milestone H-01
// A* pathfinding on road graph with traffic-aware routing

/**
 * Path result from routing
 */
export class PathResult {
    constructor(path = [], totalCost = 0, success = false) {
        this.path = path; // Array of {x, y} waypoints
        this.totalCost = totalCost;
        this.success = success;
        this.length = path.length;
    }

    /**
     * Get next position in path from current index
     */
    getNextWaypoint(currentIndex) {
        if (currentIndex === undefined || currentIndex < 0) return this.path[0] || null;
        if (currentIndex + 1 >= this.path.length) return null;
        return this.path[currentIndex + 1];
    }

    /**
     * Check if path is complete
     */
    isComplete(currentIndex) {
        return currentIndex !== undefined && currentIndex >= this.path.length - 1;
    }
}

/**
 * Traffic-aware A* pathfinding on road graph
 */
export class TrafficPathfinder {
    constructor(graph, trafficManager) {
        this.graph = graph;
        this.trafficManager = trafficManager;
        this.maxPathLength = 200; // Maximum path length to prevent long searches
        this.cache = new Map();
        this.maxCacheSize = 500;
    }

    /**
     * Find path from start to end using A*
     * @param {number} startX - Start X coordinate
     * @param {number} startY - Start Y coordinate
     * @param {number} endX - End X coordinate
     * @param {number} endY - End Y coordinate
     * @param {Object} [options] - Pathfinding options
     * @param {number} [options.maxPathLength] - Override default max path length
     * @returns {PathResult} Path result
     */
    findPath(startX, startY, endX, endY, options = {}) {
        const maxPathLength = options.maxPathLength || this.maxPathLength;

        // Get nearest graph nodes
        const startNode = this.graph.getNearestNode(startX, startY);
        const endNode = this.graph.getNearestNode(endX, endY);

        if (!startNode || !endNode) {
            return new PathResult();
        }

        // Quick check if already at destination
        if (startNode.id === endNode.id) {
            return new PathResult([
                { x: Math.round(startX), y: Math.round(startY) },
                { x: endNode.x, y: endNode.y }
            ], 1, true);
        }

        // Check cache
        const cacheKey = `${startNode.id}->${endNode.id}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // A* algorithm
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = startNode.id;
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startNode, endNode));
        openSet.push({ nodeId: startKey, f: fScore.get(startKey) });

        let visitedCount = 0;

        while (openSet.length > 0) {
            // Get node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentId = current.nodeId;

            if (currentId === endNode.id) {
                const path = this.reconstructPath(cameFrom, currentId, endNode);
                const result = new PathResult(path, gScore.get(endKey), true);
                this.addToCache(cacheKey, result);
                return result;
            }

            closedSet.add(currentId);
            visitedCount++;

            if (visitedCount > maxPathLength) {
                // Path too long, no path found
                const result = new PathResult();
                this.addToCache(cacheKey, result);
                return result;
            }

            const currentNode = this.graph.getNode(currentId);
            if (!currentNode) continue;

            // Check neighbors
            for (const neighbor of currentNode.neighbors) {
                if (closedSet.has(neighbor.nodeId)) continue;

                // Calculate cost including traffic
                const moveCost = this.getMoveCost(currentNode, neighbor.nodeId);

                const tentativeG = gScore.get(currentId) + moveCost;

                if (!gScore.has(neighbor.nodeId) || tentativeG < gScore.get(neighbor.nodeId)) {
                    cameFrom.set(neighbor.nodeId, currentId);
                    gScore.set(neighbor.nodeId, tentativeG);
                    fScore.set(neighbor.nodeId, tentativeG + this.heuristic(
                        this.graph.getNode(neighbor.nodeId),
                        endNode
                    ));

                    if (!openSet.some(n => n.nodeId === neighbor.nodeId)) {
                        openSet.push({ nodeId: neighbor.nodeId, f: fScore.get(neighbor.nodeId) });
                    }
                }
            }
        }

        // No path found
        const result = new PathResult();
        this.addToCache(cacheKey, result);
        return result;
    }

    /**
     * Calculate heuristic (Euclidean distance + traffic penalty estimate)
     */
    heuristic(nodeA, nodeB) {
        const dist = Math.sqrt((nodeB.x - nodeA.x) ** 2 + (nodeB.y - nodeA.y) ** 2);
        // Add small traffic penalty estimate based on expected congestion
        const trafficPenalty = this.trafficManager ? this.trafficManager.getCongestionEstimate(nodeA, nodeB) : 0;
        return dist + trafficPenalty;
    }

    /**
     * Get movement cost between nodes
     */
    getMoveCost(fromNode, toNodeId) {
        const toNode = this.graph.getNode(toNodeId);
        if (!toNode) return 1000;

        const dist = Math.sqrt((toNode.x - fromNode.x) ** 2 + (toNode.y - fromNode.y) ** 2);

        // Base cost is distance
        let cost = dist;

        // Traffic penalty if this edge has congestion
        if (this.trafficManager) {
            const congestion = this.trafficManager.getEdgeCongestion(fromNode.id, toNodeId);
            cost *= (1 + congestion * 0.5); // 50% slower at max congestion
        }

        // Penalty for non-road connections (shortcuts)
        if (Math.abs(fromNode.x - toNode.x) > 1 || Math.abs(fromNode.y - toNode.y) > 1) {
            cost *= 1.2; // Diagonal shortcuts are slightly more expensive
        }

        return cost;
    }

    /**
     * Reconstruct path from cameFrom map
     */
    reconstructPath(cameFrom, endId, endNode) {
        const path = [];
        let currentId = endId;

        while (cameFrom.has(currentId)) {
            const node = this.graph.getNode(currentId);
            if (node) {
                path.unshift({ x: node.x, y: node.y });
            }
            currentId = cameFrom.get(currentId);
        }

        // Add start position
        const startNode = this.graph.getNode(currentId);
        if (startNode) {
            path.unshift({ x: startNode.x, y: startNode.y });
        }

        // Add final destination if not already in path
        if (path.length === 0 || path[path.length - 1].x !== endNode.x || path[path.length - 1].y !== endNode.y) {
            path.push({ x: endNode.x, y: endNode.y });
        }

        return path;
    }

    /**
     * Add path to cache with LRU eviction
     */
    addToCache(key, result) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, result);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }
}

/**
 * Simple path following helper
 */
export class PathFollower {
    constructor() {
        this.currentPath = null;
        this.currentIndex = 0;
        this.targetOffset = 0.5; // How close to get before moving to next waypoint
    }

    /**
     * Set a new path to follow
     */
    setPath(pathResult) {
        this.currentPath = pathResult;
        this.currentIndex = -1;
    }

    /**
     * Get the next target position for an agent at position
     */
    getNextTarget(x, y) {
        if (!this.currentPath || this.currentPath.length === 0) return null;

        // If we're at or past the last waypoint, we're done
        if (this.currentIndex >= this.currentPath.length - 1) {
            return null;
        }

        // Find the next waypoint
        let targetIdx = this.currentIndex + 1;
        if (targetIdx < 0) targetIdx = 0;

        const target = this.currentPath.path[targetIdx];

        // Check if we should move to next waypoint
        if (this.currentIndex >= 0) {
            const currentTarget = this.currentPath.path[this.currentIndex];
            const dist = Math.sqrt((x - currentTarget.x) ** 2 + (y - currentTarget.y) ** 2);
            if (dist < this.targetOffset) {
                this.currentIndex++;
                targetIdx = this.currentIndex + 1;
                if (targetIdx < this.currentPath.length) {
                    return this.currentPath.path[targetIdx];
                }
            }
        }

        return target;
    }

    /**
     * Check if path following is complete
     */
    isComplete(x, y) {
        if (!this.currentPath || this.currentPath.length === 0) return true;
        if (this.currentIndex >= this.currentPath.length - 1) return true;

        const last = this.currentPath.path[this.currentPath.length - 1];
        const dist = Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2);
        return dist < this.targetOffset;
    }

    /**
     * Reset path follower
     */
    reset() {
        this.currentPath = null;
        this.currentIndex = 0;
    }
}