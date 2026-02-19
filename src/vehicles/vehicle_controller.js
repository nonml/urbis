// Vehicle controller - handles driving input and vehicle management

import { createVehicle, updateVehiclePhysics, getVehicleBounds, getTerrainProperties, isOnRoad } from './vehicle_state.js';

export class VehicleController {
    constructor(game) {
        this.game = game;
        this.activeVehicleId = null;
        this.vehicles = [];
        this.input = {
            throttle: 0,
            brake: 0,
            steer: 0
        };
    }

    /**
     * Get current active vehicle
     */
    getActiveVehicle() {
        if (!this.activeVehicleId) return null;
        return this.vehicles.find(v => v.id === this.activeVehicleId);
    }

    /**
     * Enter a vehicle at position
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    enterVehicle(x, y) {
        const nearby = this.vehicles.find(v =>
            Math.abs(v.x - x) < 3 &&
            Math.abs(v.y - y) < 3 &&
            !v.entering &&
            v.driverId === null
        );

        if (!nearby) return { ok: false, reason: 'No vehicle nearby' };

        nearby.driverId = this.game.state.player.id;
        nearby.entering = true;
        nearby.exitTimer = 10; // 10 ticks to enter

        this.activeVehicleId = nearby.id;

        // Notify UI
        this.game.ui?.showMessage?.('Entered vehicle', 'normal');

        return { ok: true, vehicle: nearby };
    }

    /**
     * Exit the current vehicle
     */
    exitVehicle() {
        const vehicle = this.getActiveVehicle();
        if (!vehicle) return { ok: false, reason: 'Not in a vehicle' };

        vehicle.driverId = null;
        vehicle.entering = false;
        vehicle.exitTimer = 0;
        vehicle.x = Math.round(vehicle.x);
        vehicle.y = Math.round(vehicle.y);
        vehicle.speed = 0;

        this.activeVehicleId = null;

        this.game.ui?.showMessage?.('Exited vehicle', 'normal');

        return { ok: true, x: vehicle.x, y: vehicle.y };
    }

    /**
     * Set input state
     * @param {Object} input - Input state
     */
    setInput(input) {
        this.input = input;
    }

    /**
     * Update vehicle physics
     * @param {number} tick - Current tick
     */
    update(tick) {
        const vehicle = this.getActiveVehicle();
        if (!vehicle) return;

        // Handle entering/exiting
        if (vehicle.entering) {
            vehicle.exitTimer--;
            if (vehicle.exitTimer <= 0) {
                vehicle.entering = false;
                // Snap to grid when fully entered
                vehicle.x = Math.round(vehicle.x);
                vehicle.y = Math.round(vehicle.y);
                this.game.ui?.showMessage?.('Vehicle ready', 'success');
            }
            return;
        }

        // Get terrain properties
        const terrain = getTerrainProperties(this.game.map, vehicle.x, vehicle.y);

        // Check if on road (for traction bonus)
        const onRoad = isOnRoad(vehicle, this.game.map);

        // Update physics
        updateVehiclePhysics(vehicle, this.input, 1, terrain);

        // Check collisions
        const collision = this.checkBuildingCollision(vehicle);
        if (collision) {
            vehicle.speed *= -0.3; // Bounce
            vehicle.health -= 5;
            vehicle.damage += 5;
            this.game.ui?.showMessage?.('Vehicle damage: ' + vehicle.damage, 'warning');
        }

        // Update state
        this.game.state.player.x = vehicle.x;
        this.game.state.player.y = vehicle.y;
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
     * @param {Object} options - Vehicle options
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
     * Spawn ambient vehicles around player
     * @param {number} count - Number of vehicles to spawn
     */
    spawnAmbientVehicles(count) {
        const playerX = this.game.state.player.x;
        const playerY = this.game.state.player.y;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 10 + (Math.random() * 20);
            const x = Math.round(playerX + Math.cos(angle) * radius);
            const y = Math.round(playerY + Math.sin(angle) * radius);

            // Spawn on road if possible
            const roadIdx = y * this.game.map.width + x;
            if (this.game.map.roadMap?.[roadIdx] === 1) {
                this.spawnVehicle({
                    x,
                    y,
                    heading: Math.random() * 360
                });
            }
        }
    }

    /**
     * Update ambient vehicle spawner
     */
    updateSpawner(tick) {
        // Only spawn when not in vehicle and near player
        if (this.activeVehicleId) return;

        const playerX = this.game.state.player.x;
        const playerY = this.game.state.player.y;

        // Count nearby ambient vehicles
        const nearbyCount = this.vehicles.filter(v =>
            v.driverId === null &&
            Math.abs(v.x - playerX) < 50 &&
            Math.abs(v.y - playerY) < 50
        ).length;

        // Target count based on map size
        const targetCount = Math.floor((this.game.map.width * this.game.map.height) / 2000);

        if (nearbyCount < targetCount && tick % 10 === 0) {
            this.spawnAmbientVehicles(1);
        }

        // Clean up old vehicles
        this.vehicles = this.vehicles.filter(v =>
            Math.abs(v.x - playerX) < 100 &&
            Math.abs(v.y - playerY) < 100
        );
    }

    /**
     * Serialize vehicle state
     */
    serialize() {
        return {
            activeVehicleId: this.activeVehicleId,
            vehicles: this.vehicles
        };
    }

    /**
     * Deserialize vehicle state
     */
    deserialize(data) {
        if (!data) return;
        this.activeVehicleId = data.activeVehicleId;
        this.vehicles = data.vehicles || [];
    }

    /**
     * Reset vehicle controller
     */
    reset() {
        this.activeVehicleId = null;
        this.vehicles = [];
    }
}