// City view's camera and its lot outlines (the state is sim/cityview.js).
//
// The camera is never cut. Every frame main.js places the street rig as it
// always has, and this blends from that pose to the overview by the eased lift:
// the point looked at slides from the player to the overview's pivot, the tilt
// swings up, and the distance grows geometrically, so the climb from 4 m to two
// hundred reads as one steady move rather than a slow start and a lurch. At
// lift 0 it does nothing at all, so the street frame is exactly what it was.
//
// The outlines are one InstancedMesh of low kerbs, four to a lot, tinted by
// what the lot is zoned for: one draw, and only while the camera is up.
import * as THREE from 'three';
import { builtHeight } from '../sim/zoning.js';
import { edgesNear } from '../sim/map.js';
import { mapOf, roadPreview } from '../sim/cityview.js';

// Grounded paint, the colours a planning map would use: leaf green for homes,
// slate blue for shops and offices, ochre for works, grey for open land, the
// road tool's own mark, and a rust red for the bulldozer's cursor.
export const ZONE_PAINT = { res: '#6b9651', com: '#4d7aa6', ind: '#c19436', none: '#8e8b84',
  road: '#cfc9bc', bulldoze: '#b0553b' };
export const paintOf = (use) => ZONE_PAINT[use ?? 'none'];

// A kerb just outside the hoarding line and a little taller than it, so from
// any side of an oblique view the fence never hides the far edge and the kerb
// never fights the gravel for the same pixels. Its width follows the camera's
// distance, so it keeps the same few pixels zoomed in or out. The one under
// the cursor is wider and lighter.
const KERB_OUT = 0.5;
const KERB_PER_METRE = 0.009;   // metres of kerb per metre of camera distance
const KERB_RISE = 3.2;          // the hoarding stands 2.4 m
const HOVER_WIDEN = 1.8;
const HOVER_LIGHTEN = 0.4;
// The frame is exposed down at night; the paint is lifted so it survives the
// tone curve as the colour of its swatch rather than a muddy version of it.
const KERB_GAIN = 1.6;
// Picking reaches the top of a hoarding even on an empty lot.
const PICK_FLOOR = 2.4;
// Street fog is tuned to eat the frame at 200 m; from the overview that is the
// whole district. As the camera climbs the fog thins in proportion, so the
// point it looks at always stands in as much haze as the street camera sees at
// this many metres.
const FOG_REACH = 30;
// The near plane backs off with the lift. A street camera needs 0.1 m; two
// hundred metres out, that wastes the depth buffer and the road paint shimmers
// against the tarmac it lies on.
const OVERVIEW_NEAR = 4;
// The road drag's mark (M5.T3): one bar, road paint or refusal red, one draw.
const PREVIEW_RISE = 0.6;
const PREVIEW_WIDTH = 7;
const PREVIEW_REFUSE = 0xd0563f;
// The bulldoze cursor (M5.T5): a translucent shell over the whole building or a
// low band over the road under the pointer, so the thing about to go reads at
// once; one more draw, and only while the bulldozer is up. A cursor holds a
// road when its ground point is this near a centre-line.
const MARK_OPACITY = 0.34;
const ROAD_PICK_W = 6;
// How far a ground ray may travel: the camera's 400 m reach plus its distance.
const GROUND_REACH = 2000;

const ease = (t) => t * t * (3 - 2 * t);

function angleTo(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const off = new THREE.Vector3();
const aim = new THREE.Vector3();
const pivot = new THREE.Vector3();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const paint = new THREE.Color();
const white = new THREE.Color(0xffffff);
const box = new THREE.Box3();
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

function kerb(kerbs, i, x, z, sx, sz, rise) {
  pos.set(x, 0, z);
  scale.set(sx, rise, sz);
  kerbs.setMatrixAt(i, matrix.compose(pos, quat, scale));
  kerbs.setColorAt(i, paint);
}

// A road op can sign new lots into the live city after the mesh was built; the
// outlines grow with it, one draw at any count, with the unused instances gone.
function growKerbs(rig, needed) {
  const next = new THREE.InstancedMesh(rig.kerbs.geometry, rig.kerbs.material, needed);
  next.setColorAt(0, white);
  next.frustumCulled = false;
  next.visible = rig.kerbs.visible;
  unpickable(next);
  rig.group.remove(rig.kerbs);
  rig.group.add(next);
  rig.kerbs = next;
}

// The zone kerbs are planning chrome, not world: a raw pick under one should
// name the land it outlines, the way the bulldozer's own picker reads parcels
// and roads and never the overlay (M5.T3d). Without this a screen shot's pick
// over open land beside a lot answers 'kerb' and the ground under it is hidden.
function unpickable(mesh) {
  mesh.raycast = () => {};
}

// Four kerbs round every lot, risen by the eased lift so they grow out of the
// ground as the camera climbs rather than popping in.
function outline(rig, e, dist) {
  const { city, view } = rig;
  const needed = city.parcels.length * 4;
  if (needed > rig.kerbs.instanceMatrix.count) growKerbs(rig, needed);
  const kerbs = rig.kerbs;
  kerbs.count = needed;
  city.parcels.forEach((p, i) => {
    const hot = i === view.hover;
    const w = dist * KERB_PER_METRE * (hot ? HOVER_WIDEN : 1);
    paint.set(paintOf(p.zoned));
    if (hot) paint.lerp(white, HOVER_LIGHTEN);
    paint.multiplyScalar(KERB_GAIN);
    const ox = p.w / 2 + KERB_OUT + w / 2;
    const oz = p.d / 2 + KERB_OUT + w / 2;
    const long = p.w + (KERB_OUT + w) * 2;
    const rise = KERB_RISE * e;
    kerb(kerbs, i * 4, p.x, p.z - oz, long, w, rise);
    kerb(kerbs, i * 4 + 1, p.x, p.z + oz, long, w, rise);
    kerb(kerbs, i * 4 + 2, p.x - ox, p.z, w, p.d + KERB_OUT * 2, rise);
    kerb(kerbs, i * 4 + 3, p.x + ox, p.z, w, p.d + KERB_OUT * 2, rise);
  });
  kerbs.instanceMatrix.needsUpdate = true;
  kerbs.instanceColor.needsUpdate = true;
}

// The drag's mark, from the sim's own preview so it cannot disagree with it.
function drawPreview(rig, show) {
  const p = roadPreview(rig.view);
  const { bar } = rig;
  if (!show || !p || p.length <= 0) {
    bar.visible = false;
    return;
  }
  bar.position.set((p.from.x + p.to.x) / 2, 0, (p.from.z + p.to.z) / 2);
  bar.scale.set(p.axis === 'x' ? p.length : PREVIEW_WIDTH, PREVIEW_RISE, p.axis === 'x' ? PREVIEW_WIDTH : p.length);
  paint.set(p.reason ? PREVIEW_REFUSE : paintOf('road'));
  bar.material.color.copy(paint);
  bar.visible = true;
}

// The bulldoze cursor's mark (M5.T5): a translucent shell over the whole
// building, so it reads over the roof from an oblique view, or a low band over
// the road. One draw, and only while there is a pick to show.
function drawMark(rig, show) {
  const { view, mark } = rig;
  const pick = view.pick;
  if (!show || !pick || view.drag) {
    mark.visible = false;
    return;
  }
  mark.material.color.set(paintOf('bulldoze'));
  if (pick.kind === 'road') {
    const map = mapOf(view);
    const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
    const a = byId.get(pick.edge.a);
    const b = byId.get(pick.edge.b);
    mark.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    mark.scale.set(Math.abs(b.x - a.x) || PREVIEW_WIDTH, PREVIEW_RISE,
      Math.abs(b.z - a.z) || PREVIEW_WIDTH);
  } else {
    const p = pick.parcel;
    mark.position.set(p.x, 0, p.z);
    mark.scale.set(p.w + KERB_OUT * 2, Math.max(builtHeight(p), PICK_FLOOR), p.d + KERB_OUT * 2);
  }
  mark.visible = true;
}

// The ground point (y = 0) under an NDC screen point: every road node stands
// at zero (ops.js), so that is the plane the road drag snaps on. `t` is how far
// down the ray it lies, so a parcel hit can be compared against it.
function ground(camera, x, y) {
  raycaster.setFromCamera(ndc.set(x, y), camera);
  const { origin, direction } = raycaster.ray;
  if (Math.abs(direction.y) < 1e-6) return null;
  const t = -origin.y / direction.y;
  if (!(t > 0 && t < GROUND_REACH)) return null;
  return { x: origin.x + direction.x * t, z: origin.z + direction.z * t, t };
}

function backOff(rig, camera, e) {
  rig.streetNear = rig.streetNear ?? camera.near;
  const near = rig.streetNear + (OVERVIEW_NEAR - rig.streetNear) * e;
  if (camera.near === near) return;
  camera.near = near;
  camera.updateProjectionMatrix();
}

// After main.js has placed the street camera and before the frame renders.
// `streetAim` is the point the street rig looks at.
function frame(rig, camera, streetAim, scene) {
  const { view, kerbs } = rig;
  const e = ease(view.lift);
  kerbs.visible = e > 0;
  drawPreview(rig, e > 0);
  drawMark(rig, e > 0);
  backOff(rig, camera, e);
  if (e === 0) return;
  off.subVectors(camera.position, streetAim);
  const near = off.length();
  const nearTilt = Math.asin(off.y / near);
  const nearYaw = Math.atan2(-off.x, -off.z);
  const yaw = nearYaw + angleTo(nearYaw, view.yaw) * e;
  const tilt = nearTilt + (view.tilt - nearTilt) * e;
  const dist = near * (view.reach / near) ** e;
  aim.lerpVectors(streetAim, pivot.set(view.x, 0, view.z), e);
  const flat = Math.cos(tilt) * dist;
  camera.position.set(aim.x - Math.sin(yaw) * flat, aim.y + Math.sin(tilt) * dist, aim.z - Math.cos(yaw) * flat);
  camera.lookAt(aim);
  // lookAt refreshes the world matrix before it turns the camera, so without
  // this the picking ray this frame leaves from here but aims the street's way.
  camera.updateMatrixWorld();
  scene.fog.density *= Math.min(1, FOG_REACH / dist);
  outline(rig, e, dist);
}

// A parcel's whole standing volume, so pointing at a tower's roof picks it; the
// renderer's crown and roof plant stand above the parcel's own height.
const PICK_CROWN = 1.35;
function parcelBox(p) {
  box.min.set(p.x - p.w / 2 - KERB_OUT, 0, p.z - p.d / 2 - KERB_OUT);
  box.max.set(p.x + p.w / 2 + KERB_OUT, Math.max(builtHeight(p) * PICK_CROWN, PICK_FLOOR),
    p.z + p.d / 2 + KERB_OUT);
  return box;
}

// The nearest lot under a screen point (normalised device coordinates), or -1.
function pick({ city }, camera, x, y) {
  raycaster.setFromCamera(ndc.set(x, y), camera);
  let best = -1;
  let bestDist = Infinity;
  city.parcels.forEach((p, i) => {
    if (!raycaster.ray.intersectBox(parcelBox(p), hit)) return;
    const d = hit.distanceTo(raycaster.ray.origin);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

// The road edge under a screen point: the ground point the ray meets and the
// nearest centre-line to it; its length is what the cost is metered on.
function roadPick(map, camera, x, y) {
  const at = ground(camera, x, y);
  if (!at) return null;
  const near = edgesNear(map, at.x, at.z, ROAD_PICK_W)[0];
  if (!near) return null;
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const a = byId.get(near.edge.a);
  const b = byId.get(near.edge.b);
  return { kind: 'road', edge: near.edge, length: Math.hypot(b.x - a.x, b.z - a.z), dist: at.t };
}

// What the bulldoze cursor holds (M5.T5): the nearest whole parcel along the
// ray, or the road when the ray meets it first. The pick is the map's parcel.
function pickTarget({ city, view }, camera, x, y) {
  raycaster.setFromCamera(ndc.set(x, y), camera);
  const map = mapOf(view);
  let best = null;
  for (const p of map?.parcels ?? city.parcels) {
    if (!raycaster.ray.intersectBox(parcelBox(p), hit)) continue;
    const d = hit.distanceTo(raycaster.ray.origin);
    if (!best || d < best.dist) best = { kind: 'parcel', parcel: p, dist: d };
  }
  const road = map ? roadPick(map, camera, x, y) : null;
  return road && (!best || road.dist < best.dist) ? road : best;
}

// Where lot `index` sits on screen, in normalised device coordinates.
function screenOf({ city }, camera, index) {
  const p = city.parcels[index];
  hit.set(p.x, Math.max(builtHeight(p), PICK_FLOOR) / 2, p.z).project(camera);
  return { x: hit.x, y: hit.y };
}

export function buildCityView(city, view) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  // Unlit, so a zone reads the same at noon and at midnight; outside the fog,
  // because it is the planner's overlay, not part of the weather.
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const kerbs = new THREE.InstancedMesh(geo, mat, city.parcels.length * 4);
  kerbs.setColorAt(0, white);
  kerbs.frustumCulled = false;
  kerbs.visible = false;
  unpickable(kerbs);
  // The scene gets the group: kerbs can grow and the mark come and go inside.
  const group = new THREE.Group();
  group.add(kerbs);
  const bar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: paintOf('road'), fog: false }));
  bar.frustumCulled = false;
  bar.visible = false;
  group.add(bar);
  // The bulldoze cursor: see-through and depth-write off, so the building it
  // shells stays readable; hidden until the cursor holds something.
  const mark = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: paintOf('bulldoze'), fog: false, transparent: true, opacity: MARK_OPACITY, depthWrite: false,
  }));
  mark.frustumCulled = false;
  mark.visible = false;
  group.add(mark);
  const rig = { city, view, kerbs, bar, mark, group, streetNear: null };
  return {
    mesh: group,
    frame: (camera, streetAim, scene) => frame(rig, camera, streetAim, scene),
    pick: (camera, x, y) => pick(rig, camera, x, y),
    pickTarget: (camera, x, y) => pickTarget(rig, camera, x, y),
    screenOf: (camera, index) => screenOf(rig, camera, index),
    ground: (camera, x, y) => ground(camera, x, y),
  };
}
