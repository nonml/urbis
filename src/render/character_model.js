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
    headRadius:    0.095 * SCALE,  // slightly larger for readability at distance
    torsoW:        0.15  * SCALE,  // chest width
    torsoH:        0.17  * SCALE,
    torsoD:        0.09  * SCALE,
    shoulderW:     0.19  * SCALE,  // shoulder-cap width for tapered silhouette
    shoulderH:     0.025 * SCALE,
    shoulderD:     0.09  * SCALE,
    hipsW:         0.12  * SCALE,  // hip-belt width (narrower than chest)
    hipsH:         0.04  * SCALE,
    hipsD:         0.09  * SCALE,
    neckR:         0.022 * SCALE,  // visible neck cylinder
    neckLen:       0.035 * SCALE,
    upperArmLen:   0.10  * SCALE,
    lowerArmLen:   0.09  * SCALE,
    armRadius:     0.022 * SCALE,
    upperLegLen:   0.12  * SCALE,
    lowerLegLen:   0.10  * SCALE,
    legRadius:     0.027 * SCALE,
    handRadius:    0.017 * SCALE,
    footW:         0.036 * SCALE,  // wider foot for ground presence
    footH:         0.018 * SCALE,
    footD:         0.055 * SCALE,  // longer toe for readable shoe silhouette
};

// Shared geometry cache (all characters share the same geometry)
let _geoCache = null;

function getGeometryCache() {
    if (_geoCache) return _geoCache;
    _geoCache = {
        // Head — slightly more polygons for smooth silhouette
        head:      new THREE.SphereGeometry(P.headRadius, 10, 7),
        // Torso broken into three stacked boxes: shoulder cap > chest > hip belt
        // Gives a tapered, readable city-sim silhouette without extra draw calls
        shoulder:  new THREE.BoxGeometry(P.shoulderW, P.shoulderH, P.shoulderD),
        chest:     new THREE.BoxGeometry(P.torsoW, P.torsoH, P.torsoD),
        hips:      new THREE.BoxGeometry(P.hipsW, P.hipsH, P.hipsD),
        // Neck — small cylinder makes the head/torso separation readable
        neck:      new THREE.CylinderGeometry(P.neckR, P.neckR * 1.1, P.neckLen, 6),
        // Arms — tapered cylinders
        upperArm:  new THREE.CylinderGeometry(P.armRadius, P.armRadius * 0.9, P.upperArmLen, 6),
        lowerArm:  new THREE.CylinderGeometry(P.armRadius * 0.9, P.armRadius * 0.75, P.lowerArmLen, 6),
        hand:      new THREE.SphereGeometry(P.handRadius, 6, 5),
        // Legs — tapered for natural calf/thigh shape
        upperLeg:  new THREE.CylinderGeometry(P.legRadius, P.legRadius * 0.88, P.upperLegLen, 6),
        lowerLeg:  new THREE.CylinderGeometry(P.legRadius * 0.88, P.legRadius * 0.72, P.lowerLegLen, 6),
        // Foot — wider + longer than before for readable shoe shape
        foot:      new THREE.BoxGeometry(P.footW, P.footH, P.footD),
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
const SHOE_COLORS  = [0x1a1a1a, 0x2b1a0e, 0x0d1b2a, 0x3b2a1a, 0x111111, 0x1c2833];

// --- Private builder helpers (extracted so createProceduralCharacter stays < 60 lines) ---

/** Adds torso parts (hip belt, chest, shoulder cap, neck) to spine group. */
function _buildTorso(spine, geo, shirtMat, pantsMat, skinMat) {
    const hipsBeltMesh = new THREE.Mesh(geo.hips, pantsMat);
    hipsBeltMesh.castShadow = true;
    hipsBeltMesh.position.y = P.hipsH / 2;
    spine.add(hipsBeltMesh);

    const chestMesh = new THREE.Mesh(geo.chest, shirtMat);
    chestMesh.castShadow = true;
    chestMesh.position.y = P.hipsH + P.torsoH / 2;
    spine.add(chestMesh);

    const shoulderMesh = new THREE.Mesh(geo.shoulder, shirtMat);
    shoulderMesh.castShadow = true;
    shoulderMesh.position.y = P.hipsH + P.torsoH - P.shoulderH / 2;
    spine.add(shoulderMesh);

    const neckMesh = new THREE.Mesh(geo.neck, skinMat);
    neckMesh.castShadow = true;
    neckMesh.position.y = P.hipsH + P.torsoH + P.neckLen / 2;
    spine.add(neckMesh);
}

/** Builds head pivot group with sphere mesh; returns the Group. */
function _buildHead(geo, skinMat) {
    const headPivot = new THREE.Group();
    const headMesh = new THREE.Mesh(geo.head, skinMat);
    headMesh.castShadow = true;
    headMesh.position.y = P.headRadius;
    headPivot.add(headMesh);
    headPivot.position.y = P.hipsH + P.torsoH + P.neckLen;
    return headPivot;
}

/** Creates the four PBR materials from pre-selected color values. */
function _makeMaterials(skinColor, shirtColor, pantsColor, shoeColor) {
    return {
        skin:  new THREE.MeshPhysicalMaterial({
            color: skinColor, roughness: 0.8, metalness: 0.0,
            sheenRoughness: 0.6, sheenColor: new THREE.Color(0x332211), sheen: 0.8,
        }),
        shirt: new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75, metalness: 0.0 }),
        pants: new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.80, metalness: 0.0 }),
        shoes: new THREE.MeshStandardMaterial({ color: shoeColor,  roughness: 0.85, metalness: 0.0 }),
    };
}

/** Builds one arm; returns { shoulder: Group, elbow: Group }. */
function _buildArm(side, geo, shirtMat, skinMat) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(
        side * (P.shoulderW / 2),
        P.hipsH + P.torsoH - P.shoulderH * 0.5,
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
    handMesh.castShadow = true;
    handMesh.position.y = -P.lowerArmLen;
    elbowPivot.add(handMesh);

    shoulderPivot.add(elbowPivot);
    return { shoulder: shoulderPivot, elbow: elbowPivot };
}

/** Builds one leg; returns { hip: Group, knee: Group }. */
function _buildLeg(side, geo, pantsMat, shoeMat) {
    const hipPivot = new THREE.Group();
    // Stance: legs spaced at 30% of hip width for a natural, non-splayed look
    hipPivot.position.set(side * P.hipsW * 0.3, 0, 0);

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
    footMesh.castShadow = true;
    // Foot sits at bottom of lower leg; offset Z so toes extend past ankle
    footMesh.position.set(0, -(P.lowerLegLen + P.footH * 0.5), P.footD * 0.15);
    kneePivot.add(footMesh);

    hipPivot.add(kneePivot);
    return { hip: hipPivot, knee: kneePivot };
}

/**
 * Create a procedural articulated humanoid character.
 * @param {number} seed - Deterministic seed for appearance variation
 * @returns {{ group: THREE.Group, bones: Object, height: number, materials: Object }}
 */
export function createProceduralCharacter(seed = 0) {
    const geo = getGeometryCache();
    // Deterministic hashes for appearance (no Math.random — fully seed-driven)
    const h  = ((seed * 2654435761) >>> 0) / 4294967296;
    const h2 = (((seed + 1) * 2246822519) >>> 0) / 4294967296;
    const h3 = (((seed + 2) * 3266489917) >>> 0) / 4294967296;
    const h4 = (((seed + 3) * 1540483477) >>> 0) / 4294967296;
    const mats = _makeMaterials(
        SKIN_TONES[Math.floor(h  * SKIN_TONES.length)],
        SHIRT_COLORS[Math.floor(h2 * SHIRT_COLORS.length)],
        PANTS_COLORS[Math.floor(h3 * PANTS_COLORS.length)],
        SHOE_COLORS[Math.floor(h4 * SHOE_COLORS.length)]
    );
    const { skin: skinMat, shirt: shirtMat, pants: pantsMat, shoes: shoeMat } = mats;

    const root = new THREE.Group();
    root.scale.setScalar(0.9 + h * 0.2); // height variation: 90%–110%
    const spine = new THREE.Group();     // spine pivot sits at top of the legs
    spine.position.y = P.upperLegLen + P.lowerLegLen;
    root.add(spine);

    _buildTorso(spine, geo, shirtMat, pantsMat, skinMat);
    const headPivot = _buildHead(geo, skinMat); // position baked in by helper
    spine.add(headPivot);

    // Arms — upper arm in shirt, lower arm + hand in skin
    const armL = _buildArm(-1, geo, shirtMat, skinMat);
    const armR = _buildArm( 1, geo, shirtMat, skinMat);
    spine.add(armL.shoulder);
    spine.add(armR.shoulder);

    // Legs anchored at spine base (y=0 in spine space)
    const hipAnchor = new THREE.Group();
    const legL = _buildLeg(-1, geo, pantsMat, shoeMat);
    const legR = _buildLeg( 1, geo, pantsMat, shoeMat);
    hipAnchor.add(legL.hip);
    hipAnchor.add(legR.hip);
    spine.add(hipAnchor);

    const totalHeight = (
        P.upperLegLen + P.lowerLegLen + P.hipsH + P.torsoH + P.neckLen + P.headRadius * 2
    ) * root.scale.x;

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
        materials: mats, // skin/shirt/pants/shoes — character_pool._allocate reads these
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
