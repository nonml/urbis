// Third-person player controller
// Kinematic capsule movement with acceleration/deceleration
// Usage: controller.update(dt, input, cameraYaw, map, playerState)

// Movement configuration (from Ticket B-1 spec)
const MOVEMENT_CONFIG = {
    walkSpeed: 4,      // m/s
    sprintSpeed: 6,    // m/s
    acceleration: 18,  // m/s^2
    deceleration: 22,  // m/s^2
    turnSmoothing: 0.15, // slerp factor per frame
    maxSlopeAngle: Math.PI / 6, // 30 degrees max climb
};

// Current state
export class PlayerState {
    constructor() {
        this.velocity = { x: 0, z: 0 };      // m/s
        this.speed = 0;                       // current speed (magnitude)
        this.isSprinting = false;             // sprint key held
        this.forward = 0;                     // forward input (-1 to 1)
        this.right = 0;                       // right input (-1 to 1)
        this.yaw = 0;                         // camera yaw
    }
}

/**
 * Update player movement with physics-based acceleration
 * @param {number} dt - Time step in seconds (from fixed sim tick)
 * @param {Object} input - { w, a, s, d, shift } boolean flags
 * @param {number} yaw - Camera yaw angle in radians
 * @param {Map} map - Map instance for ground height lookup
 * @param {Object} player - Player state with wx, wz continuous coordinates
 * @param {PlayerState} playerState - Current movement state (mutated)
 * @returns {Object} result - { moved, newWx, newWz, velocity }
 */
export function updatePlayerMovement(dt, input, yaw, map, player, playerState) {
    // Normalize inputs to [-1, 1]
    let forwardInput = 0;
    let rightInput = 0;

    if (input.w) forwardInput -= 1;
    if (input.s) forwardInput += 1;
    // The follow camera sits behind the player looking toward +Z, so screen-right
    // is world -X. A → screen-left (+X), D → screen-right (-X).
    if (input.a) rightInput += 1;
    if (input.d) rightInput -= 1;

    // Handle sprint
    const wasSprinting = playerState.isSprinting;
    playerState.isSprinting = !!input.shift;

    // Calculate target speed based on input
    const inputMagnitude = Math.hypot(forwardInput, rightInput);
    if (inputMagnitude > 1) {
        forwardInput /= inputMagnitude;
        rightInput /= inputMagnitude;
    }

    // Target speed in m/s
    const targetSpeed = playerState.isSprinting ? MOVEMENT_CONFIG.sprintSpeed : MOVEMENT_CONFIG.walkSpeed;

    // Acceleration/deceleration along forward axis
    const currentSpeed = playerState.speed;
    const targetForwardSpeed = inputMagnitude > 0.1 ? targetSpeed : 0;

    // Apply acceleration
    const dtSeconds = dt; // dt is already in seconds from caller
    const maxChange = playerState.isSprinting
        ? MOVEMENT_CONFIG.acceleration * dtSeconds
        : MOVEMENT_CONFIG.deceleration * dtSeconds;

    // Smooth speed change
    if (targetForwardSpeed > currentSpeed) {
        playerState.speed = Math.min(targetForwardSpeed, currentSpeed + maxChange);
    } else if (targetForwardSpeed < currentSpeed) {
        playerState.speed = Math.max(targetForwardSpeed, currentSpeed - maxChange);
    }

    // Calculate velocity vector in camera space
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    // Forward in world space (negative Z is "forward" in our coord system)
    const worldForwardX = -sin * forwardInput;
    const worldForwardZ = -cos * forwardInput;

    // Right in world space
    const worldRightX = cos * rightInput;
    const worldRightZ = -sin * rightInput;

    // Combined velocity (m/s)
    const vx = (worldForwardX + worldRightX) * playerState.speed;
    const vz = (worldForwardZ + worldRightZ) * playerState.speed;

    playerState.velocity = { x: vx, z: vz };

    // If no input and speed is very low, stop completely
    if (inputMagnitude < 0.1 && playerState.speed < 0.5) {
        playerState.speed = 0;
        playerState.velocity = { x: 0, z: 0 };
    }

    // Store input for next frame's turn smoothing
    playerState.forward = forwardInput;
    playerState.right = rightInput;
    playerState.yaw = yaw;

    // Don't move if speed is zero
    if (playerState.speed <= 0) {
        return {
            moved: false,
            newWx: player.wx,
            newWz: player.wz,
            velocity: playerState.velocity,
        };
    }

    // Convert velocity from m/s to tile units (1 tile = 1 unit)
    // Assuming 1 tile ~ 1 meter for simplicity
    const dx = vx * dtSeconds;
    const dz = vz * dtSeconds;

    // Calculate new position
    const nx = player.wx + dx;
    const nz = player.wz + dz;

    // Check map bounds
    if (nx < 0 || nz < 0 || nx >= map.width || nz >= map.height) {
        return {
            moved: false,
            newWx: player.wx,
            newWz: player.wz,
            velocity: playerState.velocity,
        };
    }

    // Check collision with water tiles
    const tx = Math.floor(nx);
    const ty = Math.floor(nz);
    const tile = map.getTileAt(tx, ty);
    if (tile === 0) { // water
        return {
            moved: false,
            newWx: player.wx,
            newWz: player.wz,
            velocity: playerState.velocity,
        };
    }

    // Apply movement
    player.wx = nx;
    player.wz = nz;
    player.x = tx;
    player.y = ty;

    return {
        moved: true,
        newWx: nx,
        newWz: nz,
        velocity: playerState.velocity,
    };
}

/**
 * Smooth camera turn towards movement direction
 * @param {number} currentYaw - Current camera yaw
 * @param {number} targetYaw - Desired yaw based on movement
 * @param {number} dt - Time step
 * @returns {number} New yaw
 */
export function smoothTurn(currentYaw, targetYaw, dt) {
    // Normalize angle difference to [-PI, PI]
    let diff = targetYaw - currentYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Apply smoothing
    const newYaw = currentYaw + diff * MOVEMENT_CONFIG.turnSmoothing * (dt * 60);

    // Clamp to reasonable range
    return Math.max(-Math.PI, Math.min(Math.PI, newYaw));
}

/**
 * Get player ground height from map terrain
 * @param {number} x - Tile x coordinate
 * @param {number} z - Tile z coordinate
 * @param {Map} map - Map instance
 * @returns {number} Height above base (0 for grass, positive for mountain)
 */
export function getGroundHeight(x, z, map) {
    const tile = map.getTileAt(Math.floor(x), Math.floor(z));
    switch (tile) {
        case 0: // Water
            return -0.06;
        case 1: // Grass
            return 0;
        case 2: // Forest
            return 0.05;
        case 3: // Mountain
            return 0.3;
        default:
            return 0;
    }
}

/**
 * Create a new player movement state
 */
export function createPlayerState() {
    return new PlayerState();
}