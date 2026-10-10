// M6.T8 (M6-4, docs/ROADMAP.md): the bollards — posts rising across a junction
// while the sim says they are up (traffic.js POSTED). One InstancedMesh for
// every post on the map (law 4): the pool is fixed at MAX_JUNCTIONS junctions,
// so a town of any size costs one draw, and a junction with no posts carries
// nothing. Render only: nothing here reads a clock it is not handed, and the
// frame loop seats this rig beside the other street kit (game/scene.js's own
// assembly, not this task's files).
import * as THREE from 'three';

// Posts round one junction: close enough together that no car squeezes
// between them, far enough out that the crossing reads as shut.
export const POST_RING = 3.4;
export const POSTS_PER_JUNCTION = 8;
// The junctions the pool can hold at once: a town wears a handful of hackable
// junctions, and this one mesh is the whole cost.
export const MAX_JUNCTIONS = 6;
// A post stands this tall out of the road when it is all the way up.
export const POST_H = 0.85;
// Seconds a post takes to rise out of the road, and to retract back into it.
export const RISE_SECS = 0.5;
// Steel with a hazard band, the colour a real city paints bollards: not neon.
const POST_COLOR = 0xb8b2a6;

// The posts of one junction ring its centre: eight compass points, on the
// carriageway a car would cross by. Rises from the road, so the geometry sits
// with its foot at y=0 and is scaled by height.
function ringOf(angle, x, z) {
  const [ox, oz] = [Math.sin(angle) * POST_RING, Math.cos(angle) * POST_RING];
  return { x: x + ox, z: z + oz };
}

export function buildBollards(scene) {
  const geo = new THREE.CylinderGeometry(0.09, 0.11, POST_H, 8);
  geo.translate(0, POST_H / 2, 0);
  const mat = new THREE.MeshStandardMaterial({ color: POST_COLOR, roughness: 0.55, metalness: 0.6 });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_JUNCTIONS * POSTS_PER_JUNCTION);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'bollards';
  if (scene) scene.add(mesh);
  return { mesh };
}

// How far the posts at (x, z) stand out of the road at `time`: 0 before they
// rise, POST_H while they are up, and 0 again once they have retracted.
export function bollardRise(post, time) {
  if (time < post.at) return 0;
  const up = Math.min(1, (time - post.at) / RISE_SECS);
  const down = time >= post.until ? Math.min(1, (time - post.until) / RISE_SECS) : 0;
  return Math.max(0, up - down);
}

// Seat the pool on the posts the sim holds right now: every live junction's
// posts stand at their rise height, and every unused instance is collapsed to
// nothing on the ground, where it draws a post nowhere.
export function updateBollards(rig, posts, time) {
  const mesh = rig.mesh;
  const m = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const height = new THREE.Vector3(1, 1, 1);
  const yaw = new THREE.Quaternion();
  for (let i = 0; i < mesh.count; i++) {
    const post = posts[Math.floor(i / POSTS_PER_JUNCTION)];
    const slot = i % POSTS_PER_JUNCTION;
    const live = post ? bollardRise(post, time) : 0;
    const spot = post ? ringOf(slot, post.x, post.z) : { x: 0, z: 0 };
    // The geometry is a full post with its foot at the road: the rise scales
    // it out of the ground, and an unused slot is scaled to nothing.
    height.y = live;
    at.set(spot.x, 0, spot.z);
    m.compose(at, yaw, height);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = posts.length > 0;
}
