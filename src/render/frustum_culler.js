import * as THREE from 'three';

// Reusable scratch objects — no per-call allocation.
const _sphere = new THREE.Sphere();

/**
 * Per-mesh frustum cull for children of a visible chunk group.
 * Only tests children with `userData.kind === 'building'|'vegetation'|'prop'`.
 * Children already hidden by the chunk LOD pass are not re-evaluated.
 *
 * @param {THREE.Group} group
 * @param {THREE.Frustum} frustum
 */
export function cullChunkChildren(group, frustum) {
    for (const child of group.children) {
        const kind = child.userData?.kind;
        if (kind !== 'building' && kind !== 'vegetation' && kind !== 'prop') continue;
        if (!child.visible) continue;

        const geom = child.geometry;
        if (!geom) continue;
        if (!geom.boundingSphere) geom.computeBoundingSphere();
        if (!geom.boundingSphere) continue;

        _sphere.copy(geom.boundingSphere).applyMatrix4(child.matrixWorld);
        if (!frustum.intersectsSphere(_sphere)) child.visible = false;
    }
}

/**
 * Per-object frustum cull for a flat list of THREE.Object3D instances.
 * Sets `obj.visible = false` for objects outside the frustum.
 * Objects that were already invisible stay invisible.
 *
 * @param {THREE.Object3D[]} objects
 * @param {THREE.Frustum} frustum
 */
export function cullObjectList(objects, frustum) {
    for (const obj of objects) {
        const geom = obj.geometry;
        if (!geom) continue;
        if (!geom.boundingSphere) geom.computeBoundingSphere();
        if (!geom.boundingSphere) continue;

        _sphere.copy(geom.boundingSphere).applyMatrix4(obj.matrixWorld);
        obj.visible = frustum.intersectsSphere(_sphere);
    }
}

/**
 * Frustum cull using `obj.position` directly with a fixed radius.
 * Avoids stale-matrixWorld issues on objects that move each frame (vehicles, NPCs)
 * by using the freshly-set position rather than the propagated world matrix.
 *
 * @param {THREE.Object3D[]} objects
 * @param {THREE.Frustum} frustum
 * @param {number} radius  bounding radius in world units
 */
export function cullByPosition(objects, frustum, radius = 0.5) {
    for (const obj of objects) {
        _sphere.center.copy(obj.position);
        _sphere.radius = radius;
        obj.visible = frustum.intersectsSphere(_sphere);
    }
}
