// Player Vehicle System - Milestone H-01
// Extends TrafficAgent for player-controlled vehicles with path following

import { TrafficAgent, VEHICLE_TYPES } from './traffic_agent.js';
import { PathFollower } from '../traffic/pathfinder.js';

/**
 * Player vehicle - player-controlled vehicle with routing
 */
export class PlayerVehicle extends TrafficAgent {
    constructor(id, options = {}) {
        super(id, {
            type: options.type || 'PASSENGER',
            x: options.x || 0,
            y: options.y || 0,
            heading: options.heading || 0,
            speed: options.speed || 0,
            isPlayer: true,
            driverId: options.driverId || 'player'
        });

        // Player-specific properties
        this.controlMode = 'AUTO'; // AUTO or MANUAL
        this.targetDestination = null;
        this.autoPath = null;

        // Input state
        this.input = {
            throttle: 0,
            brake: 0,
            steer: 0
        };

        // Camera follow settings
        this.cameraOffset = { x: 0, y: -20 };
        this.cameraSmoothness = 0.1;

        // Last known good position
        this.lastValidX = this.x;
        this.lastValidY = this.y;
        this.lastValidHeading = this.heading;
    }

    /**
     * Set destination and auto-route
     */
    setDestination(x, y, pathFinder) {
        this.targetDestination = { x, y };

        if (pathFinder) {
            const pathResult = pathFinder.findPath(
                Math.round(this.x), Math.round(this.y),
                x, y
            );

            if (pathResult.success && pathResult.length > 0) {
                this.autoPath = pathResult;
                this.pathFollower = new PathFollower();
                this.pathFollower.setPath(pathResult);
                this.state = 'MOVING';
                this.controlMode = 'AUTO';
                return true;
            }
        }

        return false;
    }

    /**
     * Clear destination and return to manual control
     */
    clearDestination() {
        this.targetDestination = null;
        this.autoPath = null;
        this.pathFollower = null;
        this.state = 'IDLE';
        this.controlMode = 'MANUAL';
        this.speed = 0;
    }

    /**
     * Set manual control input
     */
    setManualInput(input) {
        this.input = input;
        this.controlMode = 'MANUAL';
    }

    /**
     * Update vehicle behavior
     */
    update(map, trafficManager, tick) {
        const prevX = this.x;
        const prevY = this.y;

        if (this.state === 'PARKED') {
            return { moved: false, x: this.x, y: this.y };
        }

        // AUTO mode - follow path
        if (this.controlMode === 'AUTO' && this.pathFollower && this.autoPath) {
            const target = this.pathFollower.getNextTarget(this.x, this.y);

            if (!target) {
                // Path complete - arrived at destination
                this.state = 'IDLE';
                this.targetDestination = null;
                this.autoPath = null;
                this.pathFollower = null;
                return { moved: false, x: this.x, y: this.y, arrived: true };
            }

            // Auto-steering toward target
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const targetHeading = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;

            // Adjust heading
            let headingDiff = targetHeading - this.heading;
            while (headingDiff < -180) headingDiff += 360;
            while (headingDiff > 180) headingDiff -= 360;

            const turnSpeed = this.getTypeInfo().speed * 0.15;
            if (Math.abs(headingDiff) > turnSpeed) {
                this.heading += Math.sign(headingDiff) * turnSpeed;
                this.heading = (this.heading + 360) % 360;
            } else {
                this.heading = targetHeading;
            }

            // Auto-throttle
            let desiredSpeed = this.getTypeInfo().speed * 0.8;
            if (distance < 3) {
                desiredSpeed *= (distance / 3);
            }

            // Apply speed
            if (this.speed < desiredSpeed) {
                this.speed = Math.min(desiredSpeed, this.speed + 0.05);
            } else if (this.speed > desiredSpeed) {
                this.speed = Math.max(desiredSpeed, this.speed - 0.1);
            }

            // Move forward
            const rad = (this.heading - 90) * Math.PI / 180;
            const newX = this.x + Math.cos(rad) * this.speed;
            const newY = this.y + Math.sin(rad) * this.speed;

            // Check if moved
            if (Math.abs(newX - this.x) < 0.01 && Math.abs(newY - this.y) < 0.01) {
                this.stuckTicks++;
            } else {
                this.stuckTicks = 0;
                this.lastValidX = this.x;
                this.lastValidY = this.y;
            }

            // If stuck for too long, wait
            if (this.stuckTicks > 20) {
                this.state = 'WAITING';
                this.waitTimer = 5 + Math.random() * 5;
                this.controlMode = 'MANUAL';
                this.speed = 0;
                return { moved: false, x: this.x, y: this.y, waited: true };
            }

            this.x = newX;
            this.y = newY;

            // Check if reached waypoint
            const reachedWaypoint = distance < 0.5;
            if (reachedWaypoint) {
                this.pathFollower.currentIndex++;
            }

            return { moved: true, x: this.x, y: this.y, reachedWaypoint };

        }

        // MANUAL mode - use input
        if (this.controlMode === 'MANUAL') {
            // Steering
            const steer = this.input.steer || 0;
            if (this.speed > 0.5) {
                this.heading += steer * 2.5 * (this.speed / 10);
            }

            // Throttle/brake
            const throttle = this.input.throttle || 0;
            const brake = this.input.brake || 0;
            const maxSpeed = this.getTypeInfo().speed;

            if (throttle > 0) {
                this.speed = Math.min(maxSpeed, this.speed + 0.5 * throttle);
            }

            if (brake > 0) {
                this.speed -= 0.8 * brake;
                if (this.speed < 0) this.speed = 0;
            }

            // Coasting
            if (throttle === 0 && brake === 0 && this.speed > 0) {
                this.speed *= 0.95;
                if (this.speed < 0.1) this.speed = 0;
            }

            // Move forward
            const rad = (this.heading - 90) * Math.PI / 180;
            const newX = this.x + Math.cos(rad) * this.speed;
            const newY = this.y + Math.sin(rad) * this.speed;

            // Check validity
            const idx = Math.floor(newY) * map.width + Math.floor(newX);
            const roadTile = map.roadMap?.[idx] || 0;

            if (roadTile === 1) {
                // On road - valid position
                this.x = newX;
                this.y = newY;
                this.lastValidX = this.x;
                this.lastValidY = this.y;
                this.stuckTicks = 0;
            } else {
                // Off road - check if we were recently on road
                if (this.lastValidX !== this.x || this.lastValidY !== this.y) {
                    // We moved off-road, record but don't update position
                    // This allows player to drive back on road
                    this.speed *= 0.5; // Slow down significantly off-road
                }
            }

            if (Math.abs(this.x - prevX) < 0.01 && Math.abs(this.y - prevY) < 0.01) {
                this.stuckTicks++;
            } else {
                this.stuckTicks = 0;
            }

            return {
                moved: (this.x !== prevX || this.y !== prevY),
                x: this.x, y: this.y,
                reachedWaypoint: false,
                onRoad: roadTile === 1
            };
        }

        // IDLE state - no movement
        return { moved: false, x: this.x, y: this.y };
    }

    /**
     * Get camera target position
     */
    getCameraTarget() {
        return {
            x: this.x + this.cameraOffset.x,
            y: this.y + this.cameraOffset.y
        };
    }

    /**
     * Serialize player vehicle state
     */
    serialize() {
        const base = super.serialize();
        return {
            ...base,
            controlMode: this.controlMode,
            targetDestination: this.targetDestination,
            input: this.input,
            lastValidX: this.lastValidX,
            lastValidY: this.lastValidY,
            lastValidHeading: this.lastValidHeading
        };
    }

    /**
     * Deserialize player vehicle state
     */
    static deserialize(data, graph) {
        const vehicle = new PlayerVehicle(data.id, {
            type: data.type,
            x: data.x,
            y: data.y,
            heading: data.heading,
            speed: data.speed,
            driverId: data.driverId,
            spawnTick: data.spawnTick,
            lastUpdateTick: data.lastUpdateTick
        });

        vehicle.controlMode = data.controlMode || 'AUTO';
        vehicle.targetDestination = data.targetDestination || null;
        vehicle.input = data.input || { throttle: 0, brake: 0, steer: 0 };
        vehicle.lastValidX = data.lastValidX || vehicle.x;
        vehicle.lastValidY = data.lastValidY || vehicle.y;
        vehicle.lastValidHeading = data.lastValidHeading || vehicle.heading;

        vehicle.state = data.state;
        vehicle.waitTimer = data.waitTimer || 0;

        if (data.pathFollower && graph) {
            vehicle.pathFollower = new PathFollower();
            vehicle.pathFollower.currentIndex = data.pathFollower.currentIndex;
        }

        return vehicle;
    }
}

/**
 * Vehicle spawner for player and ambient vehicles
 */
export class VehicleSpawner {
    constructor(game) {
        this.game = game;
        this.nextId = 1;
    }

    /**
     * Spawn a player vehicle
     */
    spawnPlayerVehicle(x, y, heading = 0) {
        const id = `player_vehicle_${this.nextId++}`;
        return new PlayerVehicle(id, {
            x,
            y,
            heading,
            driverId: 'player'
        });
    }

    /**
     * Spawn an ambient vehicle
     */
    spawnAmbientVehicle(x, y, heading = 0, type = 'PASSENGER') {
        const id = `ambient_${this.nextId++}`;
        return new TrafficAgent(id, {
            type,
            x,
            y,
            heading,
            maxSpeed: this.getAmbientMaxSpeed(type)
        });
    }

    /**
     * Spawn a service vehicle (police, emergency, etc.)
     */
    spawnServiceVehicle(x, y, type = 'SERVICE') {
        const id = `service_${this.nextId++}`;
        return new TrafficAgent(id, {
            type,
            x,
            y,
            maxSpeed: 1.2 // Service vehicles are faster
        });
    }

    /**
     * Get max speed for ambient vehicle type
     */
    getAmbientMaxSpeed(type) {
        const typeInfo = VEHICLE_TYPES[type];
        return typeInfo ? typeInfo.speed * 0.6 : 0.5;
    }

    /**
     * Find a valid spawn position on road
     */
    findRoadSpawnPosition(map, centerX, centerY, radius = 20) {
        const startX = Math.floor(centerX);
        const startY = Math.floor(centerY);

        for (let dist = 1; dist <= radius; dist++) {
            for (let dx = -dist; dx <= dist; dx++) {
                for (let dy = -dist; dy <= dist; dy++) {
                    if (Math.abs(dx) !== dist && Math.abs(dy) !== dist) continue;

                    const nx = startX + dx;
                    const ny = startY + dy;

                    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;

                    const idx = ny * map.width + nx;
                    if (map.roadMap?.[idx] === 1) {
                        return { x: nx, y: ny };
                    }
                }
            }
        }

        return null;
    }
}