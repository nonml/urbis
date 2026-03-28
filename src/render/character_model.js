/**
 * Procedural Articulated Humanoid Character
 *
 * Builds a multi-part humanoid from geometric primitives with a full
 * skeletal hierarchy for walk/idle animation. Designed as drop-in
 * replacement — swap `createProceduralCharacter()` for a GLTF loader
 * call to use Mixamo or other rigged models.
 *
 * Bone hierarchy:
 *   root (hip pivot)
 *   ├── spine
 *   │   ├── head
 *   │   ├── armL_upper → armL_lower → handL
 *   │   └── armR_upper → armR_lower → handR
 *   ├── legL_upper → legL_lower → footL
 *   └── legR_upper → legR_lower → footR
 */

let THREE = null;

export function injectTHREE(t) { THREE = t; }

// Character proportions (world units — citizens are ~0.35 units tall)
const SCALE = 0.35;
const P = {
    headRadius:   0.085 * SCALE,
    torsoW:       0.14  * SCALE,
    torsoH:       0.18  * SCALE,
    torsoD:       0.08  * SCALE,
    upperArmLen:  0.10  * SCALE,
    lowerArmLen:  0.09  * SCALE,
    armRadius:    0.02  * SCALE,
    upperLegLen:  0.11  * SCALE,
    lowerLegLen:  0.10  * SCALE,
    legRadius:    0.025 * SCALE,
    handRadius:   0.015 * SCALE,
    footW:        0.03  * SCALE,
    footH:        0.015 * SCALE,
    footD:        0.045 * SCALE,
    neckLen:      0.03  * SCALE,
};

// Shared geometry cache (all characters share the same geometry)
let _geoCache = null;

function getGeometryCache() {
    if (_geoCache) return _geoCache;
    _geoCache = {
        head:     new THREE.SphereGeometry(P.headRadius, 8, 6),
        torso:    new THREE.BoxGeometry(P.torsoW, P.torsoH, P.torsoD),
        upperArm: new THREE.CylinderGeometry(P.armRadius, P.armRadius * 0.9, P.upperArmLen, 6),
        lowerArm: new THREE.CylinderGeometry(P.armRadius * 0.9, P.armRadius * 0.7, P.lowerArmLen, 6),
        hand:     new THREE.SphereGeometry(P.handRadius, 5, 4),
        upperLeg: new THREE.CylinderGeometry(P.legRadius, P.legRadius * 0.85, P.upperLegLen, 6),
        lowerLeg: new THREE.CylinderGeometry(P.legRadius * 0.85, P.legRadius * 0.7, P.lowerLegLen, 6),
        foot:     new THREE.BoxGeometry(P.footW, P.footH, P.footD),
    };
    return _geoCache;
}

// Skin/clothing color palettes
const SKIN_TONES = [0xf5d0a9, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xd4a574];
const SHIRT_COLORS = [
    0x2196f3, 0xe91e63, 0x4caf50, 0xff9800, 0x9c27b0,
    0x00bcd4, 0xff5722, 0x607d8b, 0x795548, 0x3f51b5,
    0xf44336, 0x009688, 0xffc107, 0x673ab7, 0x333333,
    0xffffff, 0x1a237e, 0x880e4f, 0x004d40, 0xbf360c,
];
const PANTS_COLORS = [0x263238, 0x37474f, 0x3e2723, 0x1a237e, 0x212121, 0x4e342e, 0x0d47a1];

/**
 * Create a procedural articulated humanoid character.
 * @param {number} seed - Deterministic seed for appearance variation
 * @returns {{ group: THREE.Group, bones: Object, height: number }}
 */
export function createProceduralCharacter(seed = 0) {
    const geo = getGeometryCache();

    // Deterministic hash for appearance
    const h = ((seed * 2654435761) >>> 0) / 4294967296;
    const h2 = (((seed + 1) * 2246822519) >>> 0) / 4294967296;
    const h3 = (((seed + 2) * 3266489917) >>> 0) / 4294967296;

    const skinColor = SKIN_TONES[Math.floor(h * SKIN_TONES.length)];
    const shirtColor = SHIRT_COLORS[Math.floor(h2 * SHIRT_COLORS.length)];
    const pantsColor = PANTS_COLORS[Math.floor(h3 * PANTS_COLORS.length)];

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8, metalness: 0.0 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7, metalness: 0.0 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.75, metalness: 0.0 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.0 });

    // Height variation: 90%-110%
    const heightScale = 0.9 + h * 0.2;

    // Build hierarchy
    const root = new THREE.Group();
    root.scale.setScalar(heightScale);

    // Spine/torso
    const spine = new THREE.Group();
    const torsoMesh = new THREE.Mesh(geo.torso, shirtMat);
    torsoMesh.castShadow = true;
    spine.add(torsoMesh);
    spine.position.y = P.upperLegLen + P.lowerLegLen + P.torsoH / 2;
    root.add(spine);

    // Head
    const headPivot = new THREE.Group();
    const headMesh = new THREE.Mesh(geo.head, skinMat);
    headMesh.castShadow = true;
    headMesh.position.y = P.headRadius;
    headPivot.add(headMesh);
    headPivot.position.y = P.torsoH / 2 + P.neckLen;
    spine.add(headPivot);

    // Arms
    function buildArm(side) {
        const shoulderPivot = new THREE.Group();
        shoulderPivot.position.set(
            side * (P.torsoW / 2 + P.armRadius),
            P.torsoH / 2 - P.armRadius * 2,
            0
        );

        const upperMesh = new THREE.Mesh(geo.upperArm, shirtMat);
        upperMesh.castShadow = true;
        upperMesh.position.y = -P.upperArmLen / 2;
        shoulderPivot.add(upperMesh);

        const elbowPivot = new THREE.Group();
        elbowPivot.position.y = -P.upperArmLen;

        const lowerMesh = new THREE.Mesh(geo.lowerArm, skinMat);
        lowerMesh.castShadow = true;
        lowerMesh.position.y = -P.lowerArmLen / 2;
        elbowPivot.add(lowerMesh);

        const handMesh = new THREE.Mesh(geo.hand, skinMat);
        handMesh.position.y = -P.lowerArmLen;
        elbowPivot.add(handMesh);

        shoulderPivot.add(elbowPivot);
        return { shoulder: shoulderPivot, elbow: elbowPivot };
    }

    const armL = buildArm(-1);
    const armR = buildArm(1);
    spine.add(armL.shoulder);
    spine.add(armR.shoulder);

    // Legs
    function buildLeg(side) {
        const hipPivot = new THREE.Group();
        hipPivot.position.set(side * P.torsoW * 0.25, 0, 0);

        const upperMesh = new THREE.Mesh(geo.upperLeg, pantsMat);
        upperMesh.castShadow = true;
        upperMesh.position.y = -P.upperLegLen / 2;
        hipPivot.add(upperMesh);

        const kneePivot = new THREE.Group();
        kneePivot.position.y = -P.upperLegLen;

        const lowerMesh = new THREE.Mesh(geo.lowerLeg, pantsMat);
        lowerMesh.castShadow = true;
        lowerMesh.position.y = -P.lowerLegLen / 2;
        kneePivot.add(lowerMesh);

        const footMesh = new THREE.Mesh(geo.foot, shoeMat);
        footMesh.position.set(0, -P.lowerLegLen, P.footD * 0.2);
        kneePivot.add(footMesh);

        hipPivot.add(kneePivot);
        return { hip: hipPivot, knee: kneePivot };
    }

    const legL = buildLeg(-1);
    const legR = buildLeg(1);

    // Legs attach at bottom of spine
    const hipAnchor = new THREE.Group();
    hipAnchor.position.y = -P.torsoH / 2;
    hipAnchor.add(legL.hip);
    hipAnchor.add(legR.hip);
    spine.add(hipAnchor);

    // Total character height
    const totalHeight = (P.upperLegLen + P.lowerLegLen + P.torsoH + P.neckLen + P.headRadius * 2) * heightScale;

    return {
        group: root,
        bones: {
            root, spine, head: headPivot,
            armL_shoulder: armL.shoulder, armL_elbow: armL.elbow,
            armR_shoulder: armR.shoulder, armR_elbow: armR.elbow,
            legL_hip: legL.hip, legL_knee: legL.knee,
            legR_hip: legR.hip, legR_knee: legR.knee,
        },
        height: totalHeight,
        materials: { skin: skinMat, shirt: shirtMat, pants: pantsMat, shoes: shoeMat },
    };
}

/**
 * Walk cycle animation — procedurally drives bone rotations.
 * Call every frame with current time and movement state.
 *
 * @param {Object} bones - Bone references from createProceduralCharacter()
 * @param {number} time - Current time in seconds (performance.now() / 1000)
 * @param {boolean} isMoving - Whether the character is walking
 * @param {number} speed - Walk speed multiplier (1.0 = normal)
 */
export function animateWalkCycle(bones, time, isMoving, speed = 1.0) {
    if (!isMoving) {
        // Idle animation: subtle breathing
        const breathe = Math.sin(time * 1.5) * 0.015;
        bones.spine.rotation.x = breathe;
        bones.head.rotation.x = breathe * 0.5;

        // Arms hang with slight sway
        bones.armL_shoulder.rotation.x = Math.sin(time * 0.8) * 0.03;
        bones.armR_shoulder.rotation.x = Math.sin(time * 0.8 + 0.5) * 0.03;
        bones.armL_elbow.rotation.x = -0.05;
        bones.armR_elbow.rotation.x = -0.05;

        // Legs straight
        bones.legL_hip.rotation.x = 0;
        bones.legR_hip.rotation.x = 0;
        bones.legL_knee.rotation.x = 0;
        bones.legR_knee.rotation.x = 0;
        return;
    }

    const walkFreq = 5.0 * speed; // Steps per second
    const t = time * walkFreq;

    // Stride phase: legs swing forward and back
    const strideAngle = 0.5; // Max swing angle in radians (~28 degrees)
    const legLPhase = Math.sin(t);
    const legRPhase = Math.sin(t + Math.PI); // Opposite phase

    // Hip rotation (leg swing)
    bones.legL_hip.rotation.x = legLPhase * strideAngle;
    bones.legR_hip.rotation.x = legRPhase * strideAngle;

    // Knee bend: bends when leg swings back, extends when forward
    // Natural walk: knee bends during swing phase (leg going forward)
    const kneeBendL = Math.max(0, -legLPhase) * 0.7;
    const kneeBendR = Math.max(0, -legRPhase) * 0.7;
    bones.legL_knee.rotation.x = -kneeBendL;
    bones.legR_knee.rotation.x = -kneeBendR;

    // Arm swing (opposite to legs)
    const armSwing = 0.4;
    bones.armL_shoulder.rotation.x = -legLPhase * armSwing;
    bones.armR_shoulder.rotation.x = -legRPhase * armSwing;

    // Elbow bend during backswing
    bones.armL_elbow.rotation.x = -0.15 + Math.max(0, legLPhase) * -0.3;
    bones.armR_elbow.rotation.x = -0.15 + Math.max(0, legRPhase) * -0.3;

    // Torso lean: slight forward lean + side-to-side sway
    bones.spine.rotation.x = 0.05; // Forward lean while walking
    bones.spine.rotation.z = Math.sin(t) * 0.03; // Hip sway

    // Head stabilization: counter-rotate slightly against torso movement
    bones.head.rotation.x = -0.03;
    bones.head.rotation.z = -Math.sin(t) * 0.015;
}

/**
 * Dispose all shared geometry. Call on cleanup.
 */
export function disposeCharacterGeometry() {
    if (_geoCache) {
        for (const g of Object.values(_geoCache)) g.dispose();
        _geoCache = null;
    }
}
