// City-view overlays (M5.T20): the planner's lot tint. One pooled
// InstancedMesh, one instance per lot, a per-instance colour from the overlay
// the O key cycles — one draw at any lot count, zero while the overlay is off
// or the camera is on the street (law 4). Planning chrome, not world: unlit,
// outside the fog and unpickable, so a raw pick under it still names the lot it
// covers (M5.T3d).
//
// M5.T21 fills the ring (sim/cityview.js OVERLAYS): the sim's own three, plus
// demand, power, police cover, land value and traffic, plus a coverage overlay
// per service. Each is mapped here to the value behind its colour, and every
// value is read off the sim the frame loop already ticks: `overlayValue` is that
// number, and tests/accept/m5-overlays.spec.js checks it against the sim on
// five lots.
//
// M5.T29 adds the sixth data overlay, pollution: the field sim/pollution.js
// already puts out — what the works lots smoke and what the busy roads carry —
// shaded from clean air to soot on one ramp. Its value is that field at the
// lot's own centre, so the overlay and the economy's price on it are one
// number. The ring's own entry is the sim's (OVERLAYS, sim/cityview.js): the
// key that walks it is the sim's, so the tint resolves the id the moment the
// view is put on it.
//
// The land-value formula, written down:
//   base     0.30  every lot is worth something
//   wealth  +0.25  its district's wealth (economy.js d.wealth)
//   demand  +0.25  the market for its own use (economy.js demandFor)
//   service +0.20  the clinic, school and park reach covering it (ops.js)
//   police  +0.20  a station inside its 100 m catchment (SERVICES.police)
//   traffic -0.15  this hour's load on its frontage edge, over the busiest
//                  edge's (traffic.js edgeLoad). M5.T28's pollution needs no
//                  term of its own: it prices the demand above (economy.js
//                  demandFor), which is already this lot's own number, so the
//                  smoke beside a home lowers its value through it.
// Each term is the sim's own number for this parcel, so the overlay cannot
// drift from the economy. The wiring this module's files do not own is
// game/scene.js, which builds the layer into the frame.
import * as THREE from 'three';
import { OVERLAYS, lotStatus, overlayOf } from '../sim/cityview.js';
import { builtHeight } from '../sim/zoning.js';
import { demandFor } from '../sim/economy.js';
import { paintOf } from './cityview.js';
import { SERVICES, inCatchment, serviceReach, servicesOf } from '../sim/ops.js';
import { pollutionOf } from '../sim/pollution.js';
import { frontageRoad } from '../sim/map.js';
import { edgeLoad } from '../sim/traffic.js';

// The tint volume stands from the lot floor to its roofline, so the overlay
// reads over a building from the oblique view; an empty lot keeps a slab.
const TINT_FLOOR = 1.2;
// See-through enough to read the building under it; scaled by the rise so the
// layer fades in with the camera and never pops on (M5.T1).
const TINT_OPACITY = 0.42;
// The lot under the cursor lightens: the same cue the kerbs give.
const HOVER_LIGHTEN = 0.35;
// Grounded planner colours for what a lot is doing (lotStatus), the zone
// swatches' colours where a status has one: growth green, decline rust, a
// clearing site ochre, a finished building slate.
const STATUS_PAINT = {
  growing: '#6b9651', declining: '#b0553b', clearing: '#c19436', complete: '#4d7aa6',
  stalled: '#6d4a42', waiting: '#8e8b84', unzoned: '#5a5852',
};
// The land-value weights above, exported so the check reads the same numbers.
export const LAND_VALUE = {
  base: 0.3, wealth: 0.25, demand: 0.25, service: 0.2, police: 0.2, traffic: -0.15,
};
// The services whose reach is an amenity a lot's value reads.
const AMENITY = ['clinic', 'school', 'park'];

// The ramps a 0-1 value walks: rust for the wrong end, ochre in the middle,
// leaf green for the right one. No neon.
const RAMPS = {
  demand: ['#b0553b', '#c19436', '#6b9651'], cover: ['#6b9651', '#c19436', '#b0553b'],
  power: ['#8c3f2e', '#7d94a8'], value: ['#8e8b84', '#cbb168'],
  police: ['#b0553b', '#4d7aa6'], traffic: ['#9a978d', '#c19436', '#8c3f2e'],
  // The sixth (M5.T29): clean air, a haze, soot — the sky over a works block.
  pollution: ['#9a978d', '#a98b5f', '#3f3a2c'],
};
const STOPS = Object.fromEntries(Object.entries(RAMPS)
  .map(([name, hexes]) => [name, hexes.map((hex) => new THREE.Color(hex))]));

// Where each overlay's value sits on its ramp: `at` turns the sim's own number
// into 0-1 (police cover is metres, traffic is travellers over the busiest
// edge's).
const SHADE = {
  demand: { ramp: 'demand', at: (v) => v }, power: { ramp: 'power', at: (v) => v },
  value: { ramp: 'value', at: (v) => v },
  cover: { ramp: 'cover', at: (v) => v, bare: true },
  police: { ramp: 'police', at: (v) => 1 - Math.min(1, v / SERVICES.police.radius), bare: true },
  traffic: { ramp: 'traffic', at: (v, t) => (t.busiest > 0 ? v / t.busiest : 0) },
  // Pollution is already the field itself, so its ramp is walked straight.
  pollution: { ramp: 'pollution', at: (v) => v },
};
// `bare` overlays shade a lot no station covers at the far end of its ramp,
// rather than leaving it blank: a district with no police station reads rust all
// over, so the player sees what is missing instead of an empty map. Both ramps
// end in rust, which is what "not covered" should read as.

// The ring the view's `overlay` index walks: every overlay the sim names, in its
// order (sim/cityview.js OVERLAYS), so the O key's wrap and this module's tint
// agree by construction. Indexed in the sim, not here, because the key that
// walks the ring is the sim's and sim/ never imports render/ (law 5).
export const OVERLAY_RING = OVERLAYS;

// The overlay the view is on, never undefined.
export const overlayAt = overlayOf;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// What one overlay's per-lot question needs, built once a frame: a type's
// stations and the lots they reach, and this hour's load on every edge.
function tablesOf(id, ctx) {
  const map = ctx.map ?? null;
  const street = ctx.street ?? null;
  const parcels = map?.parcels ?? [];
  const type = id.startsWith('cover:') ? id.slice(6) : null;
  const t = {
    type, def: type ? SERVICES[type] ?? null : null, stations: [], busiest: 0, served: new Map(),
  };
  if (t.def) {
    t.stations = servicesOf(parcels, type);
    for (const [p, s] of serviceReach(parcels, type)) t.served.set(s, (t.served.get(s) ?? 0) + 1);
  }
  if (id === 'police') t.stations = servicesOf(parcels, 'police');
  if (id === 'value') {
    t.stations = servicesOf(parcels, 'police');
    t.amenity = AMENITY.map((a) => serviceReach(parcels, a));
  }
  if (id === 'traffic' || id === 'value') {
    const edges = map?.graph?.edges ?? [];
    t.byId = new Map((map?.graph?.nodes ?? []).map((n) => [n.id, n]));
    t.load = new Map(edges.map((e) => [e.id, edgeLoad(street?.traffic, e.id)]));
    t.busiest = edges.reduce((busiest, e) => Math.max(busiest, t.load.get(e.id)), 0);
  }
  return t;
}

// A station's fill: the buildings it serves, over its capacity.
const fillOf = (t, station) => (t.served.get(station) ?? 0) / t.def.capacity;

// A coverage overlay's value for one lot: a station's own parcel reads its fill,
// a lot inside a catchment reads the fill of the nearest station covering it,
// and a lot outside every catchment reads nothing. A station is not another
// station's customer, so it reads nothing under another type.
function coverFill(p, t) {
  if (!t.def) return null;
  if (p.kind === 'service') return p.type === t.type ? fillOf(t, p) : null;
  const near = t.stations.find((s) => inCatchment(s, p));
  return near ? fillOf(t, near) : null;
}

// Metres to the nearest of `t`'s stations, or null where none stands.
const nearest = (t, p) => (t.stations.length
  ? Math.min(...t.stations.map((s) => Math.hypot(p.x - s.x, p.z - s.z))) : null);

// The load this hour on the edge the lot fronts, or null where it fronts none.
const roadLoad = (p, ctx, t) => {
  const road = ctx.map ? frontageRoad(ctx.map, p, t.byId) : null;
  return road ? t.load.get(road.edge.id) ?? 0 : null;
};

// The land-value formula above, on this lot's own numbers.
function landValue(p, city, ctx, t) {
  const d = city.economy?.districts?.[p.powerZone];
  const amenity = t.amenity.reduce((sum, reach) => sum + (reach.has(p) ? 1 : 0), 0) / AMENITY.length;
  const near = nearest(t, p) ?? Infinity;
  const load = roadLoad(p, ctx, t) ?? 0;
  return clamp01(LAND_VALUE.base
    + LAND_VALUE.wealth * clamp01(d?.wealth ?? 0.5)
    + LAND_VALUE.demand * clamp01(p.use ? demandFor(city, p) : 0)
    + LAND_VALUE.service * amenity
    + LAND_VALUE.police * clamp01(1 - near / SERVICES.police.radius)
    + LAND_VALUE.traffic * (t.busiest > 0 ? load / t.busiest : 0));
}

// The sim's own number for lot `i` under overlay `id`, or null where that
// overlay has no value for it. `ctx` is what the frame hands the layer: `dark`
// is the street's power truth, `map` and `street` the graph and the flow.
export function overlayValue(id, city, view, i, ctx = {}, t = tablesOf(id, ctx)) {
  const p = city.parcels[i];
  if (!p) return null;
  if (id === 'demand') return p.use ? demandFor(city, p) : null;
  if (id === 'power') return (ctx.dark ?? (() => false))(p.powerZone) ? 0 : 1;
  if (id === 'police') return nearest(t, p);
  if (id === 'traffic') return t.load ? roadLoad(p, ctx, t) : null;
  // Pollution: the field itself at the lot's own centre. Where no street is
  // handed in the roads are silent, and the works lots still smoke.
  if (id === 'pollution') return pollutionOf(p, city, ctx.street);
  if (id === 'value') return landValue(p, city, ctx, t);
  if (t.def) return coverFill(p, t);
  return null;
}

// The colour an overlay paints lot `i`: a zone swatch or a status colour for
// the sim's two categorical overlays, otherwise the shade its value sits at on
// its ramp. Null means the overlay has nothing to say about this lot — a bare
// overlay says it anyway, at its ramp's far end.
export function lotTint(id, city, view, i, ctx = {}, t = tablesOf(id, ctx)) {
  const p = city.parcels[i];
  if (!p) return null;
  if (id === 'zone') return paintOf(p.zoned);
  if (id === 'status') {
    const status = lotStatus(view, city, i, (ctx.dark ?? (() => false))(p.powerZone));
    return STATUS_PAINT[status] ?? STATUS_PAINT.waiting;
  }
  const spec = SHADE[id.startsWith('cover:') ? 'cover' : id];
  if (!spec) return null;
  const stops = STOPS[spec.ramp];
  const v = overlayValue(id, city, view, i, ctx, t);
  if (v === null || !Number.isFinite(v)) {
    return spec.bare ? `#${stops[stops.length - 1].getHexString()}` : null;
  }
  const x = clamp01(spec.at(v, t)) * (stops.length - 1);
  const at = Math.min(stops.length - 2, Math.floor(x));
  const c = paint.copy(stops[at]).lerp(stops[at + 1], x - at);
  return `#${c.getHexString()}`;
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
  const overlay = overlayAt(rig.view);
  if (!(e > 0) || overlay.id === 'off') {
    rig.tint.visible = false;
    return;
  }
  const { city, view, ctx } = rig;
  const needed = city.parcels.length;
  if (needed > rig.tint.instanceMatrix.count) growTint(rig, needed);
  const tint = rig.tint;
  tint.count = needed;
  tint.material.opacity = TINT_OPACITY * Math.min(1, e);
  // One frame's tables for every lot: the stations, the reach and the loads
  // are the same question asked `needed` times.
  const t = tablesOf(overlay.id, ctx);
  for (let i = 0; i < needed; i++) {
    const p = city.parcels[i];
    const colour = lotTint(overlay.id, city, view, i, ctx, t);
    paint.set(colour ?? '#000000');
    if (colour && i === view.hover) paint.lerp(white, HOVER_LIGHTEN);
    // A lot this overlay has no value for is not painted at all, not black.
    const height = colour ? Math.max(builtHeight(p), TINT_FLOOR) : 0;
    tint.setMatrixAt(i, matrix.compose(pos.set(p.x, 0, p.z), quat, scale.set(p.w, height, p.d)));
    tint.setColorAt(i, paint);
  }
  tint.instanceMatrix.needsUpdate = true;
  if (tint.instanceColor) tint.instanceColor.needsUpdate = true;
  tint.visible = true;
}

// The overlay rig, ready for the city view to own. `dark(zone)` is the
// street's power truth; `map` and `street` are what the police, traffic and
// coverage overlays read, and may be left out until they are handed in.
export function buildOverlays(city, view, { dark = () => false, map = null, street = null } = {}) {
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
  const rig = { city, view, ctx: { dark, map, street }, tint, group };
  return {
    mesh: group,
    // After the city view has placed its camera; `e` is its eased lift.
    frame: (e) => update(rig, e),
    // The pool's own numbers: how many lots it is drawing, and the instances
    // it has room for. One mesh, so the whole layer's cost is `draws()`.
    pool: () => ({ count: rig.tint.count, capacity: rig.tint.instanceMatrix.count }),
    // The layer's whole draw cost while it is showing: the one pooled mesh.
    draws: () => (rig.tint.visible ? 1 : 0),
  };
}
