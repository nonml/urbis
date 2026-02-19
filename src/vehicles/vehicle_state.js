// Vehicle state management - defines vehicle entity and physics properties

// Vehicle types
export const VEHICLE_TYPES = {
    PASSENGER: {
        name: 'Passenger Car',
        maxSpeed: 22, // m/s (80 km/h)
        acceleration: 4, // m/s^2
        braking: 8, // m/s^2
        turningSpeed: 2.5, // degrees per tick
        width: 1.5, // tiles
        length: 3,
        traction: 1.0,
        mass: 1500
    },
    SPORT: {
        name: 'Sports Car',
        maxSpeed: 30, // m/s (108 km/h)
        acceleration: 6,
        braking: 10,
        turningSpeed: 3.0,
        width: 1.5,
        length: 3,
        traction: 1.1,
        mass: 1200
    },
    TRUCK: {
        name: 'Delivery Truck',
        maxSpeed: 15, // m/s (54 km/h)
        acceleration: 2,
        braking: 5,
        turningSpeed: 1.5,
        width: 2,
        length: 5,
        traction: 0.8,
        mass: 3500
    }
};

// Traction multipliers by terrain
export const TERRAIN_TRACTION = {
    ROAD: 1.0,
    GRAVEL: 0.75,
    GRASS: 0.6,
    FOREST: 0.5,
    WATER: 0 // Not drivable
};

/**
 * Creates a new vehicle entity
 * @param {Object} options - Vehicle configuration
 * @returns {Object} Vehicle state object
 */
export function createVehicle(options = {}) {
    const type = VEHICLE_TYPES[options.type || 'PASSENGER'];
    return {
        id: options.id || `vehicle_${Date.now()}`,
        type: options.type || 'PASSENGER',
        name: type.name,
        x: options.x || 0,
        y: options.y || 0,
        heading: options.heading || 0, // Degrees
        speed: 0, // m/s
        velocity: { x: 0, y: 0 },
        maxSpeed: type.maxSpeed,
        acceleration: type.acceleration,
        braking: type.braking,
        turningSpeed: type.turningSpeed,
        width: type.width,
        length: type.length,
        traction: type.traction,
        mass: type.mass,
        health: 100,
        maxHealth: 100,
        damage: 0,
        entering: false,
        exitTimer: 0,
        driverId: options.driverId || null,
        spawnTick: options.spawnTick || 0,
        last RoadTile: -1,
        driftFactor: 0
    };
}

/**
 * Updates vehicle physics state (kinematic model)
 * @param {Object} vehicle - Vehicle state
 * @param {Object} input - Input state (throttle, brake, steer)
 * @param {number} dt - Delta time in ticks
 * @param {Object} terrain - Terrain properties at vehicle position
 */
export function updateVehiclePhysics(vehicle, input, dt, terrain) {
    if (vehicle.health <= 0) return;

    // Get traction based on terrain
    const traction = terrain.traction || 1.0;
    const effectiveTraction = vehicle.traction * traction;

    // Steering
    if (vehicle.speed > 0.5) {
        const steerDir = input.steer || 0;
        vehicle.heading += steerDir * vehicle.turningSpeed * effectiveTraction * dt;
    }

    // Acceleration
    const throttle = input.throttle || 0;
    const brake = input.brake || 0;

    if (throttle > 0) {
        vehicle.speed += vehicle.acceleration * effectiveTraction * throttle * dt;
    }

    // Braking
    if (brake > 0) {
        vehicle.speed -= vehicle.braking * effectiveTraction * brake * dt;
        if (vehicle.speed < 0) {
            vehicle.speed = 0;
        }
    }

    // Clamp speed
    if (vehicle.speed > vehicle.maxSpeed) {
        vehicle.speed = vehicle.maxSpeed;
    }

    // Natural friction (coasting slowdown)
    if (throttle === 0 && brake === 0 && vehicle.speed > 0) {
        vehicle.speed *= 0.98; // Simple friction
        if (vehicle.speed < 0.1) vehicle.speed = 0;
    }

    // Calculate velocity vector from heading and speed
    const headingRad = (vehicle.heading * Math.PI) / 180;
    vehicle.velocity.x = Math.sin(headingRad) * vehicle.speed;
    vehicle.velocity.y = -Math.cos(headingRad) * vehicle.speed;

    // Position update
    vehicle.x += vehicle.velocity.x * dt;
    vehicle.y += vehicle.velocity.y * dt;

    // Drift factor when turning at speed
    if (vehicle.speed > vehicle.maxSpeed * 0.5 && Math.abs(input.steer || 0) > 0) {
        vehicle.driftFactor = Math.min(1, vehicle.driftFactor + 0.2);
    } else {
        vehicle.driftFactor = Math.max(0, vehicle.driftFactor - 0.1);
    }

    // Clamp position to reasonable bounds
    if (vehicle.x < 0) vehicle.x = 0;
    if (vehicle.y < 0) vehicle.y = 0;
}

/**
 * Check if vehicle is on road
 * @param {Object} vehicle - Vehicle state
 * @param {Object} map - Map object with roadMap
 * @returns {boolean} Is on road
 */
export function isOnRoad(vehicle, map) {
    const idx = Math.floor(vehicle.y) * map.width + Math.floor(vehicle.x);
    return (map.roadMap?.[idx] || 0) === 1;
}

/**
 * Get terrain properties at position
 * @param {Object} map - Map object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {Object} Terrain properties
 */
export function getTerrainProperties(map, x, y) {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const idx = tileY * map.width + tileX;
    const tileType = map.grid?.[tileY]?.[tileX] ?? 0;

    // Water blocks movement
    if (tileType === 0) {
        return { type: 'WATER', traction: 0, passable: false };
    }

    // Check road first
    if (map.roadMap?.[idx] === 1) {
        return { type: 'ROAD', traction: 1.0, passable: true };
    }

    // Default to grass/terrain with reduced traction
    return { type: 'GRASS', traction: 0.75, passable: true };
}

/**
 * Calculate vehicle bounding box for collision
 * @param {Object} vehicle - Vehicle state
 * @returns {Object} Bounding box {x, y, width, height}
 */
export function getVehicleBounds(vehicle) {
    const halfWidth = vehicle.width / 2;
    const halfLength = vehicle.length / 2;
    const rad = (vehicle.heading * Math.PI) / 180;

    // Calculate corner positions
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const corners = [
        { x: vehicle.x + halfWidth * cos - halfLength * sin, y: vehicle.y + halfWidth * sin + halfLength * cos },
        { x: vehicle.x - halfWidth * cos - halfLength * sin, y: vehicle.y - halfWidth * sin + halfLength * cos },
        { x: vehicle.x - halfWidth * cos + halfLength * sin, y: vehicle.y - halfWidth * sin - halfLength * cos },
        { x: vehicle.x + halfWidth * cos + halfLength * sin, y: vehicle.y + halfWidth * sin - halfLength * cos }
    ];

    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        center: { x: vehicle.x, y: vehicle.y }
    };
}