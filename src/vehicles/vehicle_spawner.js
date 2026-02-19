// Vehicle spawner - manages ambient vehicle population with chunk-based streaming

import { createVehicle } from './vehicle_state.js';
import { findRoadSpawnPoints } from './road_query.js';

export class VehicleSpawner {
    constructor(game) {
        this.game = game;
        this.vehicles = [];
        this.lastSpawnTick = 0;
        this.spawnRate = 10; // Ticks between spawn checks
    }

    /**
     * Get vehicle count by type
     */
    getCountByType(type) {
        return this.vehicles.filter(v => v.type === type).length;
    }

    /**
     * Spawn ambient vehicles in a region around center
     * @param {number} centerX - Center X
     * @param {number} centerY - Center Y
     * @param {number} radius - Spawn radius
     * @param {number} count - Number of vehicles to spawn
     */
    spawnInRegion(centerX, centerY, radius, count) {
        const spawnPoints = findRoadSpawnPoints(
            this.game.map,
            centerX, centerY,
            radius,
            count * 3 // Over-sample to get clean spots
        );

        let spawned = 0;
        for (const point of spawnPoints) {
            if (spawned >= count) break;

            // Check if already a vehicle nearby
            const existing = this.vehicles.find(v =>
                Math.abs(v.x - point.x) < 3 && Math.abs(v.y - point.y) < 3
            );
            if (existing) continue;

            this.spawnVehicle({
                x: point.x,
                y: point.y,
                heading: this.game.rng.int(0, 359)
            });
            spawned++;
        }

        return spawned;
    }

    /**
     * Spawn a single vehicle
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
     * Update vehicle population based on player position and map size
     */
    update(tick) {
        if (tick - this.lastSpawnTick < this.spawnRate) return;
        this.lastSpawnTick = tick;

        const playerX = this.game.state.player.x;
        const playerY = this.game.state.player.y;

        // Target vehicle count based on map size
        const mapSize = this.game.map.width * this.game.map.height;
        let targetCount = 20; // Default for small maps
        if (mapSize > 50000) targetCount = 200; // MEGA
        else if (mapSize > 10000) targetCount = 80; // CITY

        // Current ambient count (not in use by player)
        const ambientCount = this.vehicles.filter(v => !v.driverId).length;

        if (ambientCount < targetCount) {
            // Spawn vehicles near player
            this.spawnInRegion(playerX, playerY, 30, targetCount - ambientCount);
        }

        // Cleanup distant vehicles
        this.vehicles = this.vehicles.filter(v => {
            const dist = Math.abs(v.x - playerX) + Math.abs(v.y - playerY);
            return dist < 100;
        });
    }

    /**
     * Get vehicles in a chunk
     * @param {Object} chunkBounds - {minX, minY, maxX, maxY}
     * @returns {Array} Vehicles in chunk
     */
    getVehiclesInChunk(chunkBounds) {
        return this.vehicles.filter(v =>
            v.x >= chunkBounds.minX &&
            v.x <= chunkBounds.maxX &&
            v.y >= chunkBounds.minY &&
            v.y <= chunkBounds.maxY
        );
    }

    /**
     * Get all vehicles
     */
    getAllVehicles() {
        return this.vehicles;
    }

    /**
     * Get vehicle by ID
     */
    getVehicleById(id) {
        return this.vehicles.find(v => v.id === id);
    }

    /**
     * Remove vehicle
     */
    removeVehicle(id) {
        const idx = this.vehicles.findIndex(v => v.id === id);
        if (idx >= 0) {
            this.vehicles.splice(idx, 1);
            return true;
        }
        return false;
    }

    /**
     * Serialize vehicles
     */
    serialize() {
        return {
            vehicles: this.vehicles,
            lastSpawnTick: this.lastSpawnTick
        };
    }

    /**
     * Deserialize vehicles
     */
    deserialize(data) {
        if (!data) return;
        this.vehicles = data.vehicles || [];
        this.lastSpawnTick = data.lastSpawnTick || 0;
    }

    /**
     * Reset spawner
     */
    reset() {
        this.vehicles = [];
        this.lastSpawnTick = 0;
    }
}