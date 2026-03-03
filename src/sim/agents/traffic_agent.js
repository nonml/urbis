// Traffic Agent System - Milestone H-01
// Vehicle agents with routing and congestion management

import { TrafficPathfinder } from '../traffic/pathfinder.js';
import { randomId } from '../../rng.js';

// Vehicle types
export const VEHICLE_TYPES = Object.freeze({
    PASSENGER: { speed: 0.8, size: 1.0, capacity: 1 },
    COMMERCIAL: { speed: 0.6, size: 1.5, capacity: 3 },
    SERVICE: { speed: 0.7, size: 1.2, capacity: 2 },
    EMERGENCY: { speed: 1.2, size: 1.0, priority: true }
});

/**
 * Traffic agent (vehicle)
 */
export class TrafficAgent {
    constructor(id, options = {}) {
        this.id = id;
        this.type = options.type || 'PASSENGER';
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.heading = options.heading || 0;
        this.speed = options.speed || 0;
        this.maxSpeed = options.maxSpeed || 0.8;
        this.acceleration = options.acceleration || 0.05;
        this.braking = options.braking || 0.1;
        this.turnSpeed = options.turnSpeed || 0.1;

        this.driverId = options.driverId || null;
        this.isPlayer = options.isPlayer || false;

        // Path following
        this.pathFollower = null;
        this.targetWaypointIndex = -1;

        // State
        this.state = 'IDLE'; // IDLE, MOVING, WAITING, PARKED
        this.waitTimer = 0;
        this.path = null;

        // Traffic state
        this.consecutiveWaitTicks = 0;
        this.lastPos = { x: this.x, y: this.y };
        this.stuckTicks = 0;

        // Timestamps
        this.spawnTick = options.spawnTick || 0;
        this.lastUpdateTick = options.spawnTick || 0;
    }

    /**
     * Get vehicle type info
     */
    getTypeInfo() {
        return VEHICLE_TYPES[this.type] || VEHICLE_TYPES.PASSENGER;
    }

    /**
     * Update vehicle position and behavior
     * @param {Object} map - Map object
     * @param {TrafficManager} trafficManager - Traffic manager for congestion info
     * @param {number} tick - Current tick
     * @returns {Object} Update results
     */
    update(map, trafficManager, tick) {
        const typeInfo = this.getTypeInfo();
        this.lastUpdateTick = tick;

        // Handle idle/waiting state
        if (this.state === 'IDLE' || this.state === 'WAITING') {
            if (this.state === 'WAITING') {
                this.waitTimer--;
                if (this.waitTimer <= 0) {
                    this.state = 'MOVING';
                }
            }
            return { moved: false, x: this.x, y: this.y };
        }

        if (this.state === 'PARKED') {
            return { moved: false, x: this.x, y: this.y };
        }

        // MOVING state - follow path or find new one
        if (!this.path || !this.pathFollower) {
            return { moved: false, x: this.x, y: this.y };
        }

        // Get target waypoint
        const target = this.pathFollower.getNextTarget(this.x, this.y);

        if (!target) {
            // Path complete
            this.state = 'IDLE';
            this.speed = 0;
            return { moved: false, x: this.x, y: this.y, pathComplete: true };
        }

        // Calculate heading toward target
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const targetHeading = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;

        // Adjust heading
        let headingDiff = targetHeading - this.heading;
        while (headingDiff < -180) headingDiff += 360;
        while (headingDiff > 180) headingDiff -= 360;

        // Turn toward target
        if (Math.abs(headingDiff) > this.turnSpeed) {
            this.heading += Math.sign(headingDiff) * this.turnSpeed;
            this.heading = (this.heading + 360) % 360;
        } else {
            this.heading = targetHeading;
        }

        // Check for congestion ahead
        const congestion = trafficManager ? trafficManager.getEdgeCongestion(
            Math.floor(this.x), Math.floor(this.y),
            target.x, target.y
        ) : 0;

        // Adjust speed based on congestion and distance
        let desiredSpeed = this.maxSpeed;
        if (congestion > 0.5) {
            desiredSpeed *= (1 - congestion * 0.5);
        }
        if (distance < 3) {
            desiredSpeed *= (distance / 3);
        }

        // Accelerate or brake
        if (this.speed < desiredSpeed) {
            this.speed = Math.min(desiredSpeed, this.speed + this.acceleration);
        } else if (this.speed > desiredSpeed) {
            this.speed = Math.max(desiredSpeed, this.speed - this.braking);
        }

        // Move forward
        const rad = (this.heading - 90) * Math.PI / 180;
        const newX = this.x + Math.cos(rad) * this.speed;
        const newY = this.y + Math.sin(rad) * this.speed;

        // Check if we moved
        if (Math.abs(newX - this.x) < 0.01 && Math.abs(newY - this.y) < 0.01) {
            this.stuckTicks++;
        } else {
            this.stuckTicks = 0;
        }

        // If stuck for too long, wait
        if (this.stuckTicks > 15) {
            this.state = 'WAITING';
            this.waitTimer = 7 + (this.id % 3);
            this.consecutiveWaitTicks++;
            this.speed = 0;
            return { moved: false, x: this.x, y: this.y, waited: true };
        }

        this.x = newX;
        this.y = newY;
        this.stuckTicks = 0;

        // Check if reached waypoint
        const reachedWaypoint = distance < 0.5;
        if (reachedWaypoint) {
            this.targetWaypointIndex++;
        }

        return { moved: true, x: this.x, y: this.y, reachedWaypoint };
    }

    /**
     * Set a new path to follow
     */
    setPath(pathResult, pathFollower) {
        this.path = pathResult;
        this.pathFollower = pathFollower;
        this.pathFollower.setPath(pathResult);
        this.state = 'MOVING';
        this.consecutiveWaitTicks = 0;
        this.stuckTicks = 0;
    }

    /**
     * Reset to idle state
     */
    reset() {
        this.state = 'IDLE';
        this.speed = 0;
        this.path = null;
        this.pathFollower = null;
        this.targetWaypointIndex = -1;
        this.consecutiveWaitTicks = 0;
        this.stuckTicks = 0;
    }

    /**
     * Serialize agent state
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            heading: this.heading,
            speed: this.speed,
            maxSpeed: this.maxSpeed,
            driverId: this.driverId,
            isPlayer: this.isPlayer,
            state: this.state,
            waitTimer: this.waitTimer,
            pathFollower: this.pathFollower ? {
                currentIndex: this.pathFollower.currentIndex
            } : null,
            spawnTick: this.spawnTick,
            lastUpdateTick: this.lastUpdateTick
        };
    }

    /**
     * Deserialize agent state
     */
    static deserialize(data, graph) {
        const agent = new TrafficAgent(data.id, {
            type: data.type,
            x: data.x,
            y: data.y,
            heading: data.heading,
            speed: data.speed,
            maxSpeed: data.maxSpeed,
            driverId: data.driverId,
            isPlayer: data.isPlayer,
            spawnTick: data.spawnTick,
            lastUpdateTick: data.lastUpdateTick
        });

        agent.state = data.state;
        agent.waitTimer = data.waitTimer || 0;

        if (data.pathFollower && graph) {
            // Reconstruct path follower
            agent.pathFollower = new PathFollower();
            agent.pathFollower.currentIndex = data.pathFollower.currentIndex;
        }

        return agent;
    }
}

/**
 * PathFollower for traffic agents
 */
export class PathFollower {
    constructor() {
        this.currentPath = null;
        this.currentIndex = 0;
        this.targetOffset = 0.5;
    }

    setPath(pathResult) {
        this.currentPath = pathResult;
        this.currentIndex = -1;
    }

    getNextTarget(x, y) {
        if (!this.currentPath || this.currentPath.length === 0) return null;
        if (this.currentIndex >= this.currentPath.length - 1) return null;

        let targetIdx = this.currentIndex + 1;
        if (targetIdx < 0) targetIdx = 0;

        const target = this.currentPath.path[targetIdx];

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

    isComplete(x, y) {
        if (!this.currentPath || this.currentPath.length === 0) return true;
        if (this.currentIndex >= this.currentPath.length - 1) return true;

        const last = this.currentPath.path[this.currentPath.length - 1];
        const dist = Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2);
        return dist < this.targetOffset;
    }

    reset() {
        this.currentPath = null;
        this.currentIndex = 0;
    }
}

/**
 * Traffic Manager - Handles congestion tracking and routing
 */
export class TrafficManager {
    constructor(game) {
        this.game = game;
        this.agents = [];
        this.congestionGrid = new Float32Array(game.map.width * game.map.height);
        this.edgeCongestion = new Map();
        this.lastUpdateTick = 0;
    }

    /**
     * Add an agent
     */
    addAgent(agent) {
        this.agents.push(agent);
    }

    /**
     * Remove an agent
     */
    removeAgent(agent) {
        this.agents = this.agents.filter(a => a !== agent);
    }

    /**
     * Get total agent count
     */
    getAgentCount() {
        return this.agents.length;
    }

    /**
     * Update all agents and congestion
     * @param {number} tick - Current tick
     */
    update(tick) {
        // Update agents
        for (const agent of this.agents) {
            agent.update(this.game.map, this, tick);
        }

        // Update congestion every 5 ticks
        if (tick - this.lastUpdateTick >= 5) {
            this._updateCongestionGrid();
            this.lastUpdateTick = tick;
        }
    }

    /**
     * Update congestion grid based on agent positions
     */
    _updateCongestionGrid() {
        this.congestionGrid.fill(0);

        // Mark agent positions
        for (const agent of this.agents) {
            if (agent.state !== 'IDLE' && agent.state !== 'PARKED') {
                const x = Math.floor(agent.x);
                const y = Math.floor(agent.y);
                if (x >= 0 && y >= 0 && x < this.game.map.width && y < this.game.map.height) {
                    const idx = y * this.game.map.width + x;
                    this.congestionGrid[idx] = Math.min(1, this.congestionGrid[idx] + 0.1);
                }
            }
        }
    }

    /**
     * Get congestion at position
     */
    getCongestion(x, y) {
        if (x < 0 || y < 0 || x >= this.game.map.width || y >= this.game.map.height) return 0;
        return this.congestionGrid[y * this.game.map.width + x];
    }

    /**
     * Get congestion estimate between two points
     */
    getCongestionEstimate(nodeA, nodeB) {
        const dist = Math.sqrt((nodeB.x - nodeA.x) ** 2 + (nodeB.y - nodeA.y) ** 2);
        let totalCongestion = 0;

        // Sample congestion along line
        const samples = Math.max(1, Math.floor(dist / 2));
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const x = nodeA.x + (nodeB.x - nodeA.x) * t;
            const y = nodeA.y + (nodeB.y - nodeA.y) * t;
            totalCongestion += this.getCongestion(x, y);
        }

        return totalCongestion / (samples + 1);
    }

    /**
     * Get edge congestion
     */
    getEdgeCongestion(x1, y1, x2, y2) {
        const key = `${x1},${y1}->${x2},${y2}`;
        return this.edgeCongestion.get(key) || 0;
    }

    /**
     * Set edge congestion
     */
    setEdgeCongestion(x1, y1, x2, y2, congestion) {
        const key = `${x1},${y1}->${x2},${y2}`;
        this.edgeCongestion.set(key, congestion);
    }

    /**
     * Get stats
     */
    getStats() {
        const activeAgents = this.agents.filter(a => a.state === 'MOVING').length;
        const avgCongestion = this.congestionGrid.reduce((sum, v) => sum + v, 0) / this.congestionGrid.length;
        return {
            totalAgents: this.agents.length,
            activeAgents,
            avgCongestion: avgCongestion.toFixed(3)
        };
    }

    /**
     * Serialize state
     */
    serialize() {
        return {
            agents: this.agents.map(a => a.serialize()),
            lastUpdateTick: this.lastUpdateTick
        };
    }

    /**
     * Deserialize state
     */
    deserialize(data) {
        if (!data) return;
        this.agents = [];
        this.lastUpdateTick = data.lastUpdateTick || 0;

        // Note: Path reconstruction requires graph - call after graph is loaded
        for (const agentData of data.agents) {
            const agent = TrafficAgent.deserialize(agentData, this.game.traffic?.graph);
            if (agent) {
                this.addAgent(agent);
            }
        }
    }
}