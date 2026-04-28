// Vehicle state management - defines vehicle entity and physics properties

// Vehicle types — keyed to match traffic system / Kenney model names
export const VEHICLE_TYPES = {
    PASSENGER: {
        name: 'Sedan',
        modelKey: 'sedan',
        maxSpeed: 22, // m/s (80 km/h)
        acceleration: 4, // m/s^2
        braking: 8, // m/s^2
        turningSpeed: 2.5, // degrees per tick
        wheelbase: 2.2, // for bicycle steering model
        width: 1.5,
        length: 3,
        traction: 1.0,
        mass: 1500,
    },
    SPORT: {
        name: 'Sports Car',
        modelKey: 'hatchback-sports',
        maxSpeed: 32, // m/s (115 km/h)
        acceleration: 7,
        braking: 12,
        turningSpeed: 3.2,
        wheelbase: 2.0,
        width: 1.5,
        length: 3,
        traction: 1.15,
        mass: 1200,
    },
    TAXI: {
        name: 'Taxi',
        modelKey: 'taxi',
        maxSpeed: 22,
        acceleration: 4.5,
        braking: 8,
        turningSpeed: 2.6,
        wheelbase: 2.2,
        width: 1.5,
        length: 3,
        traction: 1.0,
        mass: 1500,
    },
    SUV: {
        name: 'SUV',
        modelKey: 'suv',
        maxSpeed: 20,
        acceleration: 3.5,
        braking: 7,
        turningSpeed: 2.0,
        wheelbase: 2.6,
        width: 1.8,
        length: 3.5,
        traction: 1.05,
        mass: 2000,
    },
    VAN: {
        name: 'Van',
        modelKey: 'van',
        maxSpeed: 18,
        acceleration: 3,
        braking: 6,
        turningSpeed: 1.8,
        wheelbase: 2.8,
        width: 1.8,
        length: 4,
        traction: 0.9,
        mass: 2500,
    },
    TRUCK: {
        name: 'Delivery Truck',
        modelKey: 'delivery',
        maxSpeed: 15, // m/s (54 km/h)
        acceleration: 2,
        braking: 5,
        turningSpeed: 1.5,
        wheelbase: 3.5,
        width: 2,
        length: 5,
        traction: 0.8,
        mass: 3500,
    },
    POLICE: {
        name: 'Police Car',
        modelKey: 'police',
        maxSpeed: 28,
        acceleration: 6,
        braking: 10,
        turningSpeed: 2.8,
        wheelbase: 2.3,
        width: 1.5,
        length: 3,
        traction: 1.1,
        mass: 1700,
    },
    FIRETRUCK: {
        name: 'Firetruck',
        modelKey: 'firetruck',
        maxSpeed: 16,
        acceleration: 2.5,
        braking: 6,
        turningSpeed: 1.2,
        wheelbase: 4.0,
        width: 2.2,
        length: 6,
        traction: 0.85,
        mass: 5000,
    },
    BUS: {
        name: 'City Bus',
        modelKey: 'bus',
        maxSpeed: 14,
        acceleration: 1.8,
        braking: 5,
        turningSpeed: 1.0,
        wheelbase: 4.5,
        width: 2.2,
        length: 7,
        traction: 0.85,
        mass: 6000,
    },
};

export const DAMAGE_STAGES = [
    { threshold: 1.0, label: 'pristine', meshSuffix: '' },
    { threshold: 0.7, label: 'light', meshSuffix: '_dmg1' },
    { threshold: 0.4, label: 'heavy', meshSuffix: '_dmg2' },
    { threshold: 0.0, label: 'wrecked', meshSuffix: '_wreck' },
];

export function getDamageStage(vehicle) {
    const ratio = (vehicle.health ?? 100) / (vehicle.maxHealth ?? 100);
    for (const stage of DAMAGE_STAGES) {
        if (ratio >= stage.threshold) return stage;
    }
    return DAMAGE_STAGES[DAMAGE_STAGES.length - 1];
}

export function getDamageMeshKey(vehicle) {
    const type = VEHICLE_TYPES[vehicle.type] || VEHICLE_TYPES.PASSENGER;
    const stage = getDamageStage(vehicle);
    return type.modelKey + stage.meshSuffix;
}

/** Map traffic model keys (e.g. 'sedan', 'taxi') to VEHICLE_TYPES key */
export const MODEL_TO_TYPE = {};
for (const [key, cfg] of Object.entries(VEHICLE_TYPES)) {
    MODEL_TO_TYPE[cfg.modelKey] = key;
}

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
        lastRoadTile: -1,
        driftFactor: 0,
        deformations: [],
        _tiresBlown: false,
    };
}

const MAX_DEFORMATIONS = 6;

export function applyImpactDeform(vehicle, impactAngle, force, rng) {
    if (vehicle.deformations.length >= MAX_DEFORMATIONS) return;
    const seed = rng ? rng.next() : 0.5;
    const bendX = Math.cos(impactAngle) * force * (0.5 + seed * 0.5);
    const bendY = Math.sin(impactAngle) * force * (0.5 + seed * 0.5);
    const twist = (seed - 0.5) * force * 0.3;
    vehicle.deformations.push({
        localX: Math.cos(impactAngle) * 0.5,
        localY: Math.sin(impactAngle) * 0.5,
        bendX,
        bendY,
        twist,
    });
}

/**
 * Updates vehicle physics state (bicycle steering model with drift)
 * @param {Object} vehicle - Vehicle state
 * @param {Object} input - Input state (throttle, brake, steer, handbrake)
 * @param {number} dt - Delta time in ticks
 * @param {Object} terrain - Terrain properties at vehicle position
 */
export function updateVehiclePhysics(vehicle, input, dt, terrain) {
    if (vehicle.health <= 0) return;

    const traction = terrain.traction || 1.0;
    const effectiveTraction = vehicle.traction * traction;

    const throttle = input.throttle || 0;
    const brake = input.brake || 0;
    const steer = input.steer || 0;
    const handbrake = input.handbrake || 0;

    // --- Acceleration / braking / reverse ---
    if (throttle > 0) {
        vehicle.speed += vehicle.acceleration * effectiveTraction * throttle * dt;
    }
    if (brake > 0) {
        if (vehicle.speed > 0.5) {
            // Normal braking while moving forward
            vehicle.speed -= vehicle.braking * effectiveTraction * brake * dt;
            if (vehicle.speed < 0) vehicle.speed = 0;
        } else {
            // Reverse gear when nearly stopped and pressing brake
            vehicle.speed -= vehicle.acceleration * 0.4 * effectiveTraction * brake * dt;
        }
    }

    // Handbrake: lock rear wheels, allow sliding
    if (handbrake > 0 && Math.abs(vehicle.speed) > 1) {
        vehicle.driftFactor = Math.min(1, vehicle.driftFactor + 0.25);
        vehicle.speed *= 0.97; // drag from locked wheels
    }

    // Clamp speed
    const maxRev = vehicle.maxSpeed * 0.25; // reverse max is 25% of forward
    vehicle.speed = Math.max(-maxRev, Math.min(vehicle.maxSpeed, vehicle.speed));

    // Natural friction
    if (throttle === 0 && brake === 0 && handbrake === 0) {
        if (Math.abs(vehicle.speed) < 0.1) vehicle.speed = 0;
        else vehicle.speed *= 0.98;
    }

    // --- Bicycle steering model ---
    const wheelbase = vehicle.wheelbase || 2.2;
    const absSpeed = Math.abs(vehicle.speed);
    if (absSpeed > 0.3 && steer !== 0) {
        // At low speed: direct heading change. At high speed: wheelbase-limited turning radius.
        const speedFactor = Math.min(1, absSpeed / 5); // 0-1 ramp over 0-5 m/s
        const maxSteerAngle = 35; // degrees
        const steerAngle = steer * maxSteerAngle * effectiveTraction;
        const steerAngleRad = (steerAngle * Math.PI) / 180;
        const turnRadius = wheelbase / Math.tan(Math.abs(steerAngleRad) + 0.001);
        const angularVelocity = (vehicle.speed / turnRadius) * (steer > 0 ? 1 : -1);
        const headingDelta = angularVelocity * (180 / Math.PI) * dt;
        // Blend between direct steer and bicycle model based on speed
        const directDelta = steer * vehicle.turningSpeed * effectiveTraction * dt;
        vehicle.heading += directDelta * (1 - speedFactor) + headingDelta * speedFactor;
    }

    // --- Drift: oversteer at high speed + turn ---
    if (absSpeed > vehicle.maxSpeed * 0.4 && Math.abs(steer) > 0.3) {
        vehicle.driftFactor = Math.min(1, vehicle.driftFactor + 0.15);
    } else if (handbrake === 0) {
        vehicle.driftFactor = Math.max(0, vehicle.driftFactor - 0.08);
    }

    // Drift adds extra heading rotation
    if (vehicle.driftFactor > 0.1) {
        vehicle.heading += steer * vehicle.driftFactor * 1.5 * dt;
    }

    // --- Position update ---
    const headingRad = (vehicle.heading * Math.PI) / 180;
    vehicle.velocity.x = Math.sin(headingRad) * vehicle.speed;
    vehicle.velocity.y = -Math.cos(headingRad) * vehicle.speed;
    vehicle.x += vehicle.velocity.x * dt;
    vehicle.y += vehicle.velocity.y * dt;

    // Clamp to map bounds
    if (vehicle.x < 0.5) vehicle.x = 0.5;
    if (vehicle.y < 0.5) vehicle.y = 0.5;
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