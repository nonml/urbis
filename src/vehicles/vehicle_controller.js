// Vehicle controller - handles player driving input and vehicle management
// Bridges with VehicleSystem (AI traffic) so the player can enter/exit traffic vehicles

import { createVehicle, updateVehiclePhysics, getVehicleBounds, getTerrainProperties, isOnRoad, VEHICLE_TYPES, MODEL_TO_TYPE } from './vehicle_state.js';

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

                // Apply type-specific handling from VEHICLE_TYPES based on model key
                const modelKey = bestVehicle.modelType || bestVehicle.type || 'sedan';
                const typeKey = MODEL_TO_TYPE[modelKey] || 'PASSENGER';
                const typeCfg = VEHICLE_TYPES[typeKey] || VEHICLE_TYPES.PASSENGER;

                if (bestVehicle.heading === undefined) {
                    bestVehicle.heading = (bestVehicle.angle ?? 0) * (180 / Math.PI);
                }
                bestVehicle.maxSpeed = typeCfg.maxSpeed;
                bestVehicle.acceleration = typeCfg.acceleration;
                bestVehicle.braking = typeCfg.braking;
                bestVehicle.turningSpeed = typeCfg.turningSpeed;
                bestVehicle.wheelbase = typeCfg.wheelbase;
                bestVehicle.traction = typeCfg.traction;
                bestVehicle.width = typeCfg.width;
                bestVehicle.length = typeCfg.length;
                bestVehicle.mass = typeCfg.mass;
                bestVehicle._typeName = typeCfg.name;
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

        // Place player to the left side of the vehicle (driver door side)
        const headingRad = ((vehicle.heading ?? 0) * Math.PI) / 180;
        const sideX = exitX + Math.cos(headingRad + Math.PI / 2) * 1.5;
        const sideZ = exitY + Math.sin(headingRad + Math.PI / 2) * 1.5;
        this.game.state.player.wx = sideX;
        this.game.state.player.wz = sideZ;
        this.game.state.player.x = Math.floor(sideX);
        this.game.state.player.y = Math.floor(sideZ);

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
    honk() {
        if (!this.isDriving) return;
        this._honking = true;
        clearTimeout(this._honkTimer);
        this._honkTimer = setTimeout(() => { this._honking = false; }, 400);
    }

    get isHonking() {
        return this._honking || false;
    }

    setInput(input) {
        this.input = input;
    }

    /**
     * Build input from WASD key state
     * @param {Object} keys - { w, a, s, d, shift, space } booleans
     */
    setInputFromKeys(keys) {
        this.input = {
            throttle: keys.w ? 1 : 0,
            brake: keys.s ? 1 : 0,
            steer: (keys.a ? -1 : 0) + (keys.d ? 1 : 0),
            handbrake: keys.space ? 1 : 0,
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

        // Check building collisions — bounce away with speed-proportional damage
        const collision = this.checkBuildingCollision(vehicle);
        if (collision) {
            const impactSpeed = Math.abs(vehicle.speed);
            // Push vehicle away from building center
            const bx = collision.building.x + 0.5;
            const by = collision.building.y + 0.5;
            const dx = vehicle.x - bx;
            const dy = vehicle.y - by;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            vehicle.x += (dx / dist) * 0.3;
            vehicle.y += (dy / dist) * 0.3;
            vehicle.speed *= -0.25; // bounce
            // Damage scales with impact speed
            const dmg = Math.max(1, Math.round(impactSpeed * 1.2));
            vehicle.health -= dmg;
            vehicle.damage += dmg;
            this._lastCollision = true;
            this._lastImpactSpeed = impactSpeed;
        } else {
            this._lastCollision = false;
            this._lastImpactSpeed = 0;
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
        return Math.round(Math.abs(vehicle.speed || 0) * 3.6);
    }

    /**
     * Get vehicle type display name
     */
    getTypeName() {
        const vehicle = this.getActiveVehicle();
        if (!vehicle) return '';
        return vehicle._typeName || 'Car';
    }

    /**
     * Get damage stage: 0=pristine, 1=dented, 2=smoking, 3=burning, 4=destroyed
     */
    getDamageStage() {
        const vehicle = this.getActiveVehicle();
        if (!vehicle) return 0;
        const hp = vehicle.health ?? 100;
        if (hp > 75) return 0;
        if (hp > 50) return 1;
        if (hp > 25) return 2;
        if (hp > 0) return 3;
        return 4;
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
