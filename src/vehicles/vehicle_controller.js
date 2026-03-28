// Vehicle controller - handles player driving input and vehicle management
// Bridges with VehicleSystem (AI traffic) so the player can enter/exit traffic vehicles

import { createVehicle, updateVehiclePhysics, getVehicleBounds, getTerrainProperties, isOnRoad } from './vehicle_state.js';

export class VehicleController {
    constructor(game) {
        this.game = game;
        this.activeVehicleId = null;
        this.activeVehicleSource = null; // 'traffic' or 'spawned'
        this.vehicles = []; // player-spawned vehicles (not traffic)
        this.input = {
            throttle: 0,
            brake: 0,
            steer: 0
        };
        this._prevSpeed = 0;
    }

    /**
     * Get current active vehicle (searches both traffic and spawned)
     */
    getActiveVehicle() {
        if (!this.activeVehicleId) return null;

        if (this.activeVehicleSource === 'traffic') {
            const vs = this.game.vehicleSystem;
            if (!vs) return null;
            return vs.vehicles.find(v => v.id === this.activeVehicleId) || null;
        }

        return this.vehicles.find(v => v.id === this.activeVehicleId) || null;
    }

    /**
     * Check if the player is currently driving
     */
    get isDriving() {
        return this.activeVehicleId !== null;
    }

    /**
     * Enter a nearby vehicle. Checks traffic vehicles first, then spawned.
     * @param {number} x - Player X position (tile space)
     * @param {number} y - Player Y position (tile space)
     */
    enterVehicle(x, y) {
        const searchRadius = 3;

        // Search traffic vehicles (VehicleSystem)
        const vs = this.game.vehicleSystem;
        if (vs) {
            let bestDist = searchRadius;
            let bestVehicle = null;
            for (const v of vs.vehicles) {
                const dx = v.x - x;
                const dy = v.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestVehicle = v;
                }
            }
            if (bestVehicle) {
                // Convert traffic vehicle to drivable — stop its AI pathing
                bestVehicle._playerDriven = true;
                bestVehicle._savedPath = bestVehicle.path;
                bestVehicle._savedPathIndex = bestVehicle.pathIndex;
                bestVehicle.path = [];
                bestVehicle.pathIndex = 0;

                // Set driving properties if missing
                if (bestVehicle.heading === undefined) {
                    bestVehicle.heading = (bestVehicle.angle ?? 0) * (180 / Math.PI);
                }
                if (bestVehicle.maxSpeed === undefined) bestVehicle.maxSpeed = 22;
                if (bestVehicle.acceleration === undefined) bestVehicle.acceleration = 4;
                if (bestVehicle.braking === undefined) bestVehicle.braking = 8;
                if (bestVehicle.turningSpeed === undefined) bestVehicle.turningSpeed = 2.5;
                if (bestVehicle.traction === undefined) bestVehicle.traction = 1.0;
                if (bestVehicle.width === undefined) bestVehicle.width = 1.5;
                if (bestVehicle.length === undefined) bestVehicle.length = 3;
                if (bestVehicle.health === undefined) bestVehicle.health = 100;
                if (bestVehicle.maxHealth === undefined) bestVehicle.maxHealth = 100;
                if (bestVehicle.damage === undefined) bestVehicle.damage = 0;
                if (bestVehicle.driftFactor === undefined) bestVehicle.driftFactor = 0;
                if (bestVehicle.velocity === undefined) bestVehicle.velocity = { x: 0, y: 0 };
                if (bestVehicle.driverId === undefined) bestVehicle.driverId = null;

                bestVehicle.driverId = 'player';
                bestVehicle.speed = 0; // stop the vehicle when entering

                this.activeVehicleId = bestVehicle.id;
                this.activeVehicleSource = 'traffic';

                this.game.ui?.showMessage?.('Entered vehicle [F to exit]', 'success');
                return { ok: true, vehicle: bestVehicle };
            }
        }

        // Search spawned vehicles
        const nearby = this.vehicles.find(v =>
            Math.abs(v.x - x) < searchRadius &&
            Math.abs(v.y - y) < searchRadius &&
            v.driverId === null
        );

        if (!nearby) return { ok: false, reason: 'No vehicle nearby' };

        nearby.driverId = 'player';
        nearby.speed = 0;
        this.activeVehicleId = nearby.id;
        this.activeVehicleSource = 'spawned';

        this.game.ui?.showMessage?.('Entered vehicle [F to exit]', 'success');
        return { ok: true, vehicle: nearby };
    }

    /**
     * Exit the current vehicle
     */
    exitVehicle() {
        const vehicle = this.getActiveVehicle();
        if (!vehicle) return { ok: false, reason: 'Not in a vehicle' };

        // Only allow exit at low speed
        const speed = vehicle.speed || 0;
        if (speed > 3) {
            this.game.ui?.showMessage?.('Slow down to exit!', 'warning');
            return { ok: false, reason: 'Too fast to exit' };
        }

        const exitX = vehicle.x;
        const exitY = vehicle.y;

        // Restore traffic vehicle AI
        if (this.activeVehicleSource === 'traffic') {
            vehicle._playerDriven = false;
            vehicle.path = vehicle._savedPath || [];
            vehicle.pathIndex = vehicle._savedPathIndex || 0;
            delete vehicle._savedPath;
            delete vehicle._savedPathIndex;
            vehicle.speed = 0;
        }

        vehicle.driverId = null;

        // Place player next to the vehicle
        this.game.state.player.wx = exitX + 1.5;
        this.game.state.player.wz = exitY;
        this.game.state.player.x = Math.floor(exitX + 1.5);
        this.game.state.player.y = Math.floor(exitY);

        this.activeVehicleId = null;
        this.activeVehicleSource = null;
        this.input = { throttle: 0, brake: 0, steer: 0 };
        this._prevSpeed = 0;

        this.game.ui?.showMessage?.('Exited vehicle', 'normal');
        return { ok: true, x: exitX, y: exitY };
    }

    /**
     * Set input state from WASD keys
     * @param {Object} input - { throttle: 0-1, brake: 0-1, steer: -1 to 1 }
     */
    setInput(input) {
        this.input = input;
    }

    /**
     * Build input from WASD key state
     * @param {Object} keys - { w, a, s, d, shift } booleans
     */
    setInputFromKeys(keys) {
        this.input = {
            throttle: keys.w ? 1 : 0,
            brake: keys.s ? 1 : (keys.shift ? 0.5 : 0),
            steer: (keys.a ? -1 : 0) + (keys.d ? 1 : 0)
        };
    }

    /**
     * Update vehicle physics for the driven vehicle
     * @param {number} tick - Current tick
     */
    update(tick) {
        const vehicle = this.getActiveVehicle();
        if (!vehicle) return;

        // Get terrain properties
        const terrain = getTerrainProperties(this.game.map, vehicle.x, vehicle.y);

        // Don't drive on water
        if (terrain.type === 'WATER') {
            vehicle.speed *= 0.5;
            if (vehicle.speed < 0.1) vehicle.speed = 0;
        }

        // Update physics using the full vehicle_state physics model
        updateVehiclePhysics(vehicle, this.input, 1, terrain);

        // Sync heading back to angle for renderer
        vehicle.angle = (vehicle.heading * Math.PI) / 180;

        // Check building collisions
        const collision = this.checkBuildingCollision(vehicle);
        if (collision) {
            vehicle.speed *= -0.3;
            vehicle.health -= 5;
            vehicle.damage += 5;
            this._lastCollision = true;
        } else {
            this._lastCollision = false;
        }

        // Clamp to map bounds
        vehicle.x = Math.max(0.5, Math.min(this.game.map.width - 0.5, vehicle.x));
        vehicle.y = Math.max(0.5, Math.min(this.game.map.height - 0.5, vehicle.y));

        // Sync player position to vehicle
        this.game.state.player.x = Math.floor(vehicle.x);
        this.game.state.player.y = Math.floor(vehicle.y);
        this.game.state.player.wx = vehicle.x;
        this.game.state.player.wz = vehicle.y;

        this._prevSpeed = vehicle.speed;
    }

    /**
     * Check collision with buildings
     * @param {Object} vehicle - Vehicle state
     * @returns {Object|null} Collision info or null
     */
    checkBuildingCollision(vehicle) {
        const bounds = getVehicleBounds(vehicle);

        for (const building of this.game.buildings.buildings || []) {
            const bBounds = {
                x: building.x - (building.width || 1) / 2,
                y: building.y - (building.height || 1) / 2,
                width: building.width || 1,
                height: building.height || 1
            };

            if (
                bounds.x < bBounds.x + bBounds.width &&
                bounds.x + bounds.width > bBounds.x &&
                bounds.y < bBounds.y + bBounds.height &&
                bounds.y + bounds.height > bBounds.y
            ) {
                return { building, overlap: 1 };
            }
        }

        return null;
    }

    /**
     * Spawn a vehicle at position
     */
    spawnVehicle(options = {}) {
        const vehicle = createVehicle({
            id: `vehicle_${this.vehicles.length}_${Date.now()}`,
            type: options.type || 'PASSENGER',
            x: options.x || 0,
            y: options.y || 0,
            heading: options.heading || 0,
            driverId: null,
            spawnTick: this.game.state.time.tick
        });

        this.vehicles.push(vehicle);
        return vehicle;
    }

    /**
     * Get speed in km/h for HUD display
     */
    getSpeedKmh() {
        const vehicle = this.getActiveVehicle();
        if (!vehicle) return 0;
        return Math.round((vehicle.speed || 0) * 3.6);
    }

    /**
     * Serialize vehicle state
     */
    serialize() {
        return {
            activeVehicleId: this.activeVehicleId,
            activeVehicleSource: this.activeVehicleSource,
            vehicles: this.vehicles
        };
    }

    /**
     * Deserialize vehicle state
     */
    deserialize(data) {
        if (!data) return;
        this.activeVehicleId = data.activeVehicleId;
        this.activeVehicleSource = data.activeVehicleSource || 'spawned';
        this.vehicles = data.vehicles || [];
    }

    /**
     * Reset vehicle controller
     */
    reset() {
        this.activeVehicleId = null;
        this.activeVehicleSource = null;
        this.vehicles = [];
        this.input = { throttle: 0, brake: 0, steer: 0 };
    }
}
