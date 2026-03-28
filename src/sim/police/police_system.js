// Police system - manages police units, spawning, and pursuit behavior

import { eventBus, EVENT_TYPES } from '../events.js';
import { createVehicle, updateVehiclePhysics, getTerrainProperties } from '../../vehicles/vehicle_state.js';

// Heat thresholds for police response
export const HEAT_THRESHOLDS = {
    ALERT: 25,
    SEARCH: 50,
    PURSUIT: 75
};

// Police unit types
export const POLICE_TYPES = {
    PATROL_CAR: { name: 'Patrol Car', speed: 18, handling: 0.8, heatCost: 5 },
    INTERCEPTOR: { name: 'Interceptor', speed: 24, handling: 0.95, heatCost: 10 },
    DRONE: { name: 'Surveillance Drone', speed: 15, handling: 0.6, heatCost: 8 }
};

export class PoliceSystem {
    constructor(game) {
        this.game = game;
        this.units = [];
        this.lastSpawnTick = 0;
        this.pursuitMode = false;
    }

    /**
     * Get police units count by type
     */
    getCountByType(type) {
        return this.units.filter(u => u.type === type).length;
    }

    /**
     * Get total active police units
     */
    getTotalCount() {
        return this.units.length;
    }

    /**
     * Check if player is wanted based on heat
     */
    isWanted() {
        const heat = this.game.state.player.heat || 0;
        return heat >= HEAT_THRESHOLDS.ALERT;
    }

    /**
     * Get police response level
     */
    getResponseLevel() {
        const heat = this.game.state.player.heat || 0;
        if (heat >= HEAT_THRESHOLDS.PURSUIT) return 'pursuit';
        if (heat >= HEAT_THRESHOLDS.SEARCH) return 'search';
        if (heat >= HEAT_THRESHOLDS.ALERT) return 'alert';
        return 'calm';
    }

    /**
     * Spawn a police unit
     */
    spawnUnit(options = {}) {
        const unit = {
            id: `police_${this.units.length}_${Date.now()}`,
            type: options.type || 'PATROL_CAR',
            name: POLICE_TYPES[options.type || 'PATROL_CAR']?.name || 'Patrol Car',
            x: options.x || 0,
            y: options.y || 0,
            heading: options.heading || 0,
            speed: 0,
            targetX: options.targetX || null,
            targetY: options.targetY || null,
            state: 'patrol', // patrol, pursuit, search
            searchRadius: options.searchRadius || 10,
            searchProgress: 0,
            lastKnownX: null,
            lastKnownY: null,
            spawnTick: this.game.state.time.tick,
            heatCost: POLICE_TYPES[options.type || 'PATROL_CAR']?.heatCost || 5,
            active: true
        };

        this.units.push(unit);
        return unit;
    }

    /**
     * Spawn police near player
     * @param {number} count - Number of units to spawn
     */
    spawnNearPlayer(count) {
        const playerX = this.game.state.player.x;
        const playerY = this.game.state.player.y;
        const districtId = this.game.map.getDistrictAt(playerX, playerY) || 0;

        // Find spawn points on roads around player
        const roadIdx = Math.floor(playerY) * this.game.map.width + Math.floor(playerX);
        const spawnX = this.game.map.roadMap?.[roadIdx] === 1 ? playerX : Math.floor(playerX);
        const spawnY = this.game.map.roadMap?.[roadIdx] === 1 ? playerY : Math.floor(playerY);

        for (let i = 0; i < count; i++) {
            // Offset spawn points around player
            const angle = (i / count) * Math.PI * 2 + (this.game.rng.int(0, 360) * Math.PI / 180);
            const distance = 15 + (this.game.rng.int(0, 20));
            const sx = spawnX + Math.cos(angle) * distance;
            const sy = spawnY + Math.sin(angle) * distance;

            this.spawnUnit({
                x: Math.round(sx),
                y: Math.round(sy),
                heading: this.game.rng.int(0, 359),
                targetX: playerX,
                targetY: playerY
            });
        }
    }

    /**
     * Update police units
     */
    update(tick) {
        const heat = this.game.state.player.heat || 0;
        const wanted = this.isWanted();

        // Spawn response based on heat
        if (wanted && tick - this.lastSpawnTick >= 30) {
            this.lastSpawnTick = tick;
            const responseLevel = this.getResponseLevel();
            let spawnCount = 0;

            if (responseLevel === 'alert') spawnCount = 1;
            else if (responseLevel === 'search') spawnCount = 3;
            else if (responseLevel === 'pursuit') spawnCount = 5;

            // Adjust for police rep
            const policeRep = this.game.factions?.reputation?.police || 0;
            if (policeRep < -40) spawnCount = Math.max(1, Math.floor(spawnCount * 1.5));
            if (policeRep > 40) spawnCount = Math.floor(spawnCount * 0.5);

            if (spawnCount > 0) {
                this.spawnNearPlayer(spawnCount);
            }
        }

        // Update each unit
        for (const unit of this.units) {
            this.updateUnit(unit, tick);
        }

        // Cleanup inactive units
        this.units = this.units.filter(u => {
            if (!u.active) {
                eventBus.emit(EVENT_TYPES.POLICE_UNIT_DESPAWNED, { unit: u });
                return false;
            }
            return true;
        });
    }

    /**
     * Update a single police unit
     */
    updateUnit(unit, tick) {
        const playerX = this.game.state.player.x;
        const playerY = this.game.state.player.y;
        const heat = this.game.state.player.heat || 0;

        // Update state based on heat and player position
        const dist = Math.abs(playerX - unit.x) + Math.abs(playerY - unit.y);

        if (unit.state === 'patrol') {
            // Patrol mode: move randomly or toward district center
            if (this.game.rng.int(0, 100) < 5) {
                unit.heading = this.game.rng.int(0, 359);
            }

            // Move toward district center if no target
            if (!unit.targetX && !unit.targetY) {
                const district = this.game.map.districts?.find(d => d.id === this.game.map.getDistrictAt(unit.x, unit.y));
                if (district) {
                    unit.targetX = district.center?.x;
                    unit.targetY = district.center?.y;
                }
            }

            // If player is close, switch to pursuit
            if (dist <= 25 && heat >= HEAT_THRESHOLDS.ALERT) {
                unit.state = 'pursuit';
                unit.targetX = playerX;
                unit.targetY = playerY;
            }
        }

        if (unit.state === 'pursuit') {
            // Chase mode: steer toward player
            unit.targetX = playerX;
            unit.targetY = playerY;

            // Increase speed toward max
            const maxSpeed = POLICE_TYPES[unit.type]?.speed || 18;
            unit.speed = Math.min(unit.speed + 1, maxSpeed);

            // If player moves far, switch to search
            if (dist > 60 && heat < HEAT_THRESHOLDS.PURSUIT) {
                unit.state = 'search';
                unit.lastKnownX = playerX;
                unit.lastKnownY = playerY;
                unit.searchProgress = 0;
            }
        }

        if (unit.state === 'search') {
            // Search mode: search around last known position
            unit.searchProgress++;
            if (unit.searchProgress > 40) {
                // Give up search
                unit.active = false;
                return;
            }

            // Move in spiral pattern
            const spiralRadius = Math.min(30, unit.searchProgress * 0.5);
            const angle = (unit.searchProgress * 0.2) % (Math.PI * 2);
            unit.targetX = unit.lastKnownX + Math.cos(angle) * spiralRadius;
            unit.targetY = unit.lastKnownY + Math.sin(angle) * spiralRadius;

            // If player returns, switch back to pursuit
            if (dist <= 25) {
                unit.state = 'pursuit';
                unit.targetX = playerX;
                unit.targetY = playerY;
            }
        }

        // Apply steering toward target
        if (unit.targetX !== null && unit.targetY !== null) {
            const dx = unit.targetX - unit.x;
            const dy = unit.targetY - unit.y;
            const targetHeading = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
            unit.heading = this.lerpAngle(unit.heading, targetHeading, unit.type === 'INTERCEPTOR' ? 3 : 2);
        }

        // Move unit
        const headingRad = (unit.heading * Math.PI) / 180;
        unit.x += Math.sin(headingRad) * unit.speed * 0.1;
        unit.y += -Math.cos(headingRad) * unit.speed * 0.1;

        // Physical enforcement
        if (dist <= 2 && unit.state === 'pursuit') {
            const vc = this.game.vehicleController;
            const ph = this.game.playerHealth;

            if (vc?.isDriving) {
                // Ram damage to player vehicle
                const playerVehicle = vc.getActiveVehicle();
                if (playerVehicle && unit.speed > 5) {
                    playerVehicle.health -= 15;
                    playerVehicle.speed *= 0.5;
                    unit.speed *= 0.3;
                    if (ph) ph.takeDamage(10, 'police_ram');
                    this.game.ui?.showMessage?.('Police ram!', 'warning');
                }
            } else if (ph && !ph.isDead) {
                // On foot: arrest the player
                this._arrestPlayer();
            }

            eventBus.emit(EVENT_TYPES.POLICE_ENCOUNTER, {
                unit,
                distance: dist,
                heat,
                tick
            });
        }
    }

    /**
     * Arrest the player — lose money, reset heat, respawn
     */
    _arrestPlayer() {
        const player = this.game.state.player;
        const resources = this.game.state.resources;

        // Fine: lose 25% of gold
        const fine = Math.floor(resources.gold * 0.25);
        resources.gold -= fine;

        // Reset heat
        player.heat = 0;
        player.heatState = 'calm';
        if (this.game.heatSystem) this.game.heatSystem.setHeat(0);

        // Respawn at map center (or police station)
        const policeStation = (this.game.buildings.buildings || []).find(b => b.type === 'police_station');
        const rx = policeStation?.x ?? Math.floor(this.game.map.width / 2);
        const ry = policeStation?.y ?? Math.floor(this.game.map.height / 2);

        player.x = rx;
        player.y = ry;
        player.wx = rx + 0.5;
        player.wz = ry + 0.5;

        // Heal to full
        player.health = player.maxHealth;

        // Despawn all police
        this.units = [];

        this.game.ui?.showMessage?.(`Busted! Fined $${fine}`, 'warning');
        this.game.ui?.renderer3d?.syncPlayer?.();
        if (this.game.ui?.renderer3d?._player) {
            this.game.ui.renderer3d._player.visible = true;
        }
    }

    /**
     * Linear interpolation for angles
     */
    lerpAngle(a, b, t) {
        const diff = b - a;
        const adjustedDiff = ((diff + 180) % 360) - 180;
        return a + adjustedDiff * t;
    }

    /**
     * Get police telemetry for UI
     */
    getTelemetry() {
        return {
            units: this.units.length,
            active: this.units.filter(u => u.active).length,
            responseLevel: this.getResponseLevel(),
            pursuitMode: this.pursuitMode,
            byType: {
                patrol: this.getCountByType('PATROL_CAR'),
                interceptor: this.getCountByType('INTERCEPTOR'),
                drone: this.getCountByType('DRONE')
            }
        };
    }

    /**
     * Serialize police state
     */
    serialize() {
        return {
            units: this.units,
            lastSpawnTick: this.lastSpawnTick,
            pursuitMode: this.pursuitMode
        };
    }

    /**
     * Deserialize police state
     */
    deserialize(data) {
        if (!data) return;
        this.units = data.units || [];
        this.lastSpawnTick = data.lastSpawnTick || 0;
        this.pursuitMode = data.pursuitMode || false;
    }

    /**
     * Reset police system
     */
    reset() {
        this.units = [];
        this.lastSpawnTick = 0;
        this.pursuitMode = false;
    }
}