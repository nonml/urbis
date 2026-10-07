// City-view overlays (M5.T20): the planner's lot tint. One pooled
// InstancedMesh, one instance per lot, a per-instance colour from the overlay
// the O key cycles (sim/cityview.js OVERLAYS) — one draw at any lot count,
// zero while the overlay is off or the camera is on the street (law 4).
//
// Every colour is the sim's own value: a lot's zoning, or what it is doing
// (lotStatus). The later overlay tasks append their id to OVERLAYS and their
// mapping to `lotTint` here; the pool, the key and the one-draw cost do not
// change. The layer is planning chrome, not world: unlit, outside the fog and
// unpickable, so a raw pick under it still names the lot it covers (M5.T3d).
import * as THREE from 'three';
import { lotStatus, overlayOf } from '../sim/cityview.js';
import { builtHeight } from '../sim/zoning.js';
import { paintOf } from './cityview.js';

// The tint volume stands from the lot floor to its roofline, so the overlay
// reads over a building from the oblique view; an empty lot keeps a slab.
const TINT_FLOOR = 1.2;
// See-through enough to read the building under it; scaled by the rise so the
// layer fades in with the camera and never pops on (M5.T1).
const TINT_OPACITY = 0.42;
// The lot under the cursor lightens: the same cue the kerbs give.
const HOVER_LIGHTEN = 0.35;

// Grounded planner colours for what a lot is doing (lotStatus): the zone
// swatches' colours where a status has one, so growth reads green, decline
// rust, a clearing site ochre and a finished building slate.
const STATUS_PAINT = {
  growing: '#6b9651', declining: '#b0553b', clearing: '#c19436',
  complete: '#4d7aa6', stalled: '#6d4a42', waiting: '#8e8b84', unzoned: '#5a5852',
};

// What overlay `id` paints lot `i`, as a colour string, or null when that
// overlay has no lot value. `dark` answers whether the lot's power zone is out
// (sim/street.js isDark), so the status overlay can say 'stalled'.
export function lotTint(id, city, view, i, dark = () => false) {
  const p = city.parcels[i];
  if (id === 'zone') return paintOf(p.zoned);
  if (id === 'status') {
    const status = lotStatus(view, city, i, dark(p.powerZone));
    return STATUS_PAINT[status] ?? STATUS_PAINT.waiting;
  }
  return null;
}

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const paint = new THREE.Color();
const white = new THREE.Color(0xffffff);

// A road op can sign new lots into the live city after the mesh was built: the
// pool grows like the kerbs do, one draw at any count, unused instances gone.
function growTint(rig, needed) {
  const next = new THREE.InstancedMesh(rig.tint.geometry, rig.tint.material, needed);
  next.frustumCulled = false;
  next.visible = rig.tint.visible;
  next.raycast = () => {};
  rig.group.remove(rig.tint);
  rig.group.add(next);
  rig.tint = next;
}

// One frame, after the city view has placed its camera. `e` is the eased lift
// (render/cityview.js): 0 on the street and 1 at the overview. The tint fades
// in with the rise and draws nothing at all on the street or with the overlay
// off.
function update(rig, e) {
  const { city, view, dark } = rig;
  const overlay = overlayOf(view);
  if (!(e > 0) || overlay.id === 'off') {
    rig.tint.visible = false;
    return;
  }
  const needed = city.parcels.length;
  if (needed > rig.tint.instanceMatrix.count) growTint(rig, needed);
  const tint = rig.tint;
  tint.count = needed;
  tint.material.opacity = TINT_OPACITY * Math.min(1, e);
  for (let i = 0; i < needed; i++) {
    const p = city.parcels[i];
    paint.set(lotTint(overlay.id, city, view, i, dark) ?? '#000000');
    if (i === view.hover) paint.lerp(white, HOVER_LIGHTEN);
    const height = Math.max(builtHeight(p), TINT_FLOOR);
    tint.setMatrixAt(i, matrix.compose(pos.set(p.x, 0, p.z), quat, scale.set(p.w, height, p.d)));
    tint.setColorAt(i, paint);
  }
  tint.instanceMatrix.needsUpdate = true;
  if (tint.instanceColor) tint.instanceColor.needsUpdate = true;
  tint.visible = true;
}

// The overlay rig, ready for the city view to own. `dark(zone)` is the
// street's power truth; it may be left out until the street is handed in.
export function buildOverlays(city, view, { dark = () => false } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  // Unlit and outside the fog: the planner's overlay, not the weather. The
  // depth write stays off, so the building under the tint keeps its shape.
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, fog: false, transparent: true, opacity: 0, depthWrite: false,
  });
  const tint = new THREE.InstancedMesh(geo, mat, Math.max(1, city.parcels.length));
  tint.frustumCulled = false;
  tint.visible = false;
  // Planning chrome, not world: a raw pick under it names the lot (M5.T3d).
  tint.raycast = () => {};
  const group = new THREE.Group();
  group.add(tint);
  const rig = { city, view, dark, tint, group };
  return {
    mesh: group,
    // After the city view has placed its camera; `e` is its eased lift.
    frame: (e) => update(rig, e),
    // The layer's whole draw cost while it is showing: the one pooled mesh.
    draws: () => (rig.tint.visible ? 1 : 0),
  };
}
