import * as THREE from 'three';

// Per-category LOD distance thresholds (world units from camera).
// Buildings: 4-tier within LOD_FULL_DIST; imposter/box between 15-55.
// Vehicles:  4-tier; LOD0 close, hidden beyond 'hide'.
// Characters: 4-tier; LOD0 articulated, LOD3 invisible.
export const LOD_DIST = {
    buildings:  { lod1: 15, lod2: 35, imposter: 55 },
    vehicles:   { lod1: 12, lod2: 25, hide: 45 },
    characters: { near: 8,  mid: 20,  far: 40 },
    props:      { lod1: 10, lod2: 20, hide: 35 },
};

/**
 * Wrap a vehicle mesh in a 4-tier THREE.LOD.
 * LOD0: detailed model  (dist < lod1 threshold)
 * LOD1: simple box      (dist lod1–lod2)
 * LOD2: tiny box        (dist lod2–hide)
 * LOD3: empty node      (dist > hide — invisible)
 *
 * @param {THREE.Object3D} lod0Mesh
 * @param {number} color  hex color for LOD1/2 boxes
 * @returns {THREE.LOD}
 */
export function createVehicleLOD(lod0Mesh, color = 0x607d8b) {
    const lod = new THREE.LOD();
    lod.addLevel(lod0Mesh, 0);

    const lod1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.18, 0.22),
        new THREE.MeshLambertMaterial({ color })
    );
    lod.addLevel(lod1, LOD_DIST.vehicles.lod1);

    const lod2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.12, 0.16),
        new THREE.MeshBasicMaterial({ color })
    );
    lod.addLevel(lod2, LOD_DIST.vehicles.lod2);

    lod.addLevel(new THREE.Object3D(), LOD_DIST.vehicles.hide);
    return lod;
}

/**
 * Build a simple billboard sprite representing a chunk's buildings at distance.
 * Uses a canvas to render a building-silhouette texture.
 *
 * @param {THREE.Vector3} center  chunk center in world space
 * @param {number} color  hex representative color
 * @param {number} size   approximate extent (width)
 * @returns {THREE.Sprite}
 */
export function createChunkImposter(center, color = 0x886644, size = 8) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const c = new THREE.Color(color);
    const hex = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
    ctx.fillStyle = hex;
    ctx.fillRect(2, 10, 28, 50);
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.25;
    for (let y = 14; y < 56; y += 8) {
        for (let x = 5; x < 28; x += 8) ctx.fillRect(x, y, 4, 5);
    }
    ctx.globalAlpha = 1.0;
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: true, transparent: true }));
    sprite.position.copy(center);
    sprite.position.y = size * 0.35;
    sprite.scale.set(size, size * 0.6, 1);
    return sprite;
}

/**
 * Build a Group of flat-material box meshes (one per building) for the LOD1 tier.
 * Much cheaper than full GLTF buildings — no shadows, no window emissives.
 *
 * @param {{ minX,minY,maxX,maxY }} bounds
 * @param {object[]} buildings  game buildings array
 * @param {number} mapHalfW
 * @param {number} mapHalfH
 * @param {(x:number,y:number) => number} elevFn  terrain Y for a tile
 * @returns {THREE.Group}
 */
export function buildChunkLOD1Proxies(bounds, buildings, mapHalfW, mapHalfH, elevFn) {
    const HEIGHTS = { house: 0.22, farm: 0.14, market: 0.32, 'town-hall': 0.55,
        warehouse: 0.30, barracks: 0.35, school: 0.30, 'bus-depot': 0.70,
        'metro-station': 0.90, skyscraper: 1.6, factory: 0.4, 'lumber-mill': 0.28 };

    const inBounds = buildings.filter(
        (b) => b.x >= bounds.minX && b.x <= bounds.maxX && b.y >= bounds.minY && b.y <= bounds.maxY
    );
    if (inBounds.length === 0) return new THREE.Group();

    // One InstancedMesh per chunk: unit-height box scaled per building type
    // (Q11.D). A 1×h×1 instance scale reproduces each per-type proxy height.
    const geo = new THREE.BoxGeometry(0.7, 1, 0.7);
    const mat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const im = new THREE.InstancedMesh(geo, mat, inBounds.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < inBounds.length; i++) {
        const b = inBounds[i];
        const h = HEIGHTS[b.type] ?? 0.25;
        const wx = b.x - mapHalfW + 0.5;
        const wz = b.y - mapHalfH + 0.5;
        dummy.position.set(wx, (elevFn ? elevFn(wx, wz) : 0) + h * 0.5, wz);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    return im;
}
