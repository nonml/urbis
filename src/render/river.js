// The river (M4.T8): the water surface and the quay banks that hold it, drawn
// from the map's water rects (sim/map.js, [cx, cz, hw, hd]). The bridge decks
// and railings are road furniture and live in render/roads.js, on the road
// pools a road op rewrites the same frame; the deck width rule is shared here
// (`bridgeHalf`) so the bank gap each crossing cuts cannot drift from the deck
// that fills it.
//
// Why the water sits just under the street and not in a channel. The shipped
// ground never goes below zero (sim/terrain.js), so a sunken bed would be
// buried by the drawn ground frame exactly the way the old river was (354d937).
// The water is a sheet 2 cm under the tarmac and 6 cm above the base plane
// (which block.js drops to -0.08), held by a low quay bank at each edge; the
// depth reads from the bank, the railings and the deck fascia. When terrain
// learns to carve (M10's water), WATER_DROP is the one number that moves.
//
// Known limit: sim/terrain.js does not yet treat map.water as flat ground, so
// the relief the hills put over the corridor (0.1-6 m on today's seeds) still
// rises through the water sheet away from the roads, and the water only reads
// in the flat hold around each crossing. Adding map.water to createTerrain's
// flats in src/sim/terrain.js is the one-line fix (M4.T7's file, outside this
// task's two render files); the water below is drawn correctly for the flat
// corridor that fix leaves behind.
//
// The material is the one main had before 354d937, unchanged: metalness 0 (the
// environment is near-black on the horizon, so a mirror returned a void),
// roughness 0.18 (the one cue left is the sun and moon glinting off the
// ripple), envMapIntensity 0.06 (a constant term outlives the lights it should
// sit beside and turns the river into a glowing stripe at midnight), and an
// asphalt normal scrolled along the flow. 0x0d2030 sits at 0.0133 albedo,
// between the ground plane (0.0085) and the grass banks (0.0247) — the spec's
// window (world-scale-design.md, "What carries forward").
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_HALF_WIDTH as ROAD_HALF, WALKWAY_WIDTH } from '../sim/world.js';
import { buildInstancePools } from './buildings.js';

export const WATER_DROP = 0.02;
export const WATER_COLOR = 0x0d2030;
const WATER_TILE = 3.1;   // metres of ripple per repeat along the flow
const WATER_ACROSS = 2;   // ... and across it
const SCROLL = 0.03;      // repeats a second the normal map drifts
const NORMAL_SCALE = 0.35;

// The bank: a low quay wall in ordinary concrete. Wide enough to read as an
// edge from the street, short enough that it never hides the water behind it.
const BANK_W = 1.6;
const BANK_TOP = 0.28;
const BANK_BOTTOM = -0.5;
const BANK_MIN_RUN = 0.5;
// The width a crossing's deck needs, shared by the deck (render/roads.js) and
// the bank gap cut for it here: the carriageway plus the footways the way
// carries, plus a lip, so an avenue's footways never overhang a narrower deck.
export function bridgeHalf(map, edge) {
  const avenue = (map.district?.avenues ?? []).some((w) => w.id === edge.way);
  return ROAD_HALF + (avenue ? WALKWAY_WIDTH : 0) + 0.4;
}

// One plane per water rect, UVs baked to metres so the ripple keeps its size
// whatever the rect's size, merged into the one draw the whole river costs.
function waterGeometry(water) {
  const geos = water.map(([cx, cz, hw, hd]) => {
    const g = new THREE.PlaneGeometry(hw * 2, hd * 2);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    const ru = Math.max(1, Math.round((hw * 2) / WATER_TILE));
    const rv = Math.max(1, Math.round((hd * 2) / WATER_ACROSS));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
    return g.translate(cx, -WATER_DROP, cz);
  });
  return mergeGeometries(geos);
}

function waterMaterial(texLoader, maxAniso) {
  const normal = texLoader.load('assets/asphalt/normal.jpg');
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = maxAniso;
  return new THREE.MeshStandardMaterial({
    color: WATER_COLOR, metalness: 0, roughness: 0.18,
    normalMap: normal, normalScale: new THREE.Vector2(NORMAL_SCALE, NORMAL_SCALE),
    envMapIntensity: 0.06,
  });
}

// `from` with `cuts` (closed runs) taken out, dropping slivers a bank box
// cannot show.
function subtractRuns(from, cuts) {
  let runs = from;
  for (const [c0, c1] of cuts) {
    runs = runs.flatMap(([a, b]) => [[a, Math.min(b, c0)], [Math.max(a, c1), b]])
      .filter(([a, b]) => b - a >= BANK_MIN_RUN);
  }
  return runs;
}

// One slot per bank run: a box straddling the water's edge, top above the
// street, foot below the water. A bridge leaves a gap — the deck crosses the
// bank line, so the bank must not rise through its carriageway. Roads run
// along one axis (D2) and the arterials cross the band, so a bridge cuts at its
// own x; an east-west edge lies along the water, not across the bank.
export function bankSlots(map) {
  const water = map.water ?? [];
  if (!water.length) return [];
  const nodes = new Map((map.graph?.nodes ?? []).map((n) => [n.id, n]));
  const out = [];
  for (const [cx, cz, hw, hd] of water) {
    const cuts = [];
    for (const e of map.graph?.edges ?? []) {
      if (e.kind !== 'bridge') continue;
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      if (!a || !b || a.x !== b.x) continue;
      if (Math.max(a.z, b.z) <= cz - hd || Math.min(a.z, b.z) >= cz + hd) continue;
      const half = bridgeHalf(map, e);
      cuts.push([a.x - half, a.x + half]);
    }
    for (const [x0, x1] of subtractRuns([[cx - hw, cx + hw]], cuts)) {
      for (const edge of [-1, 1]) {
        out.push({
          kind: 0, x: (x0 + x1) / 2, z: cz + edge * hd,
          w: x1 - x0, h: BANK_TOP - BANK_BOTTOM, d: BANK_W,
          y: (BANK_TOP + BANK_BOTTOM) / 2,
        });
      }
    }
  }
  return out;
}

// The water as one mesh plus the two banks as one instanced pool: 2 draws for
// the whole river whatever a seed does. `onBeforeRender` scrolls the ripple
// along U — the flow, which is x for the east-west river — so the water stays
// alive without a tick in the frame loop.
export function buildRiver(texLoader, maxAniso, map) {
  const group = new THREE.Group();
  const water = map.water ?? [];
  let waterMesh = null;
  if (water.length) {
    const mat = waterMaterial(texLoader, maxAniso);
    waterMesh = new THREE.Mesh(waterGeometry(water), mat);
    waterMesh.receiveShadow = true;
    let last = 0;
    waterMesh.onBeforeRender = () => {
      const now = performance.now();
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      mat.normalMap.offset.x -= dt * SCROLL;
    };
    group.add(waterMesh);
  }
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x707680, roughness: 0.9, metalness: 0.05 });
  const banks = buildInstancePools([bankMat], bankSlots(map), {
    shape: 'box', castShadow: false, receiveShadow: true, slack: 32,
  });
  group.add(banks.group);
  // A road op that adds a crossing rewrites the bank gap with the road pools
  // (M3.T27), so the quay never rises through a deck laid after boot.
  const update = (next = map) => banks.update(bankSlots(next));
  return { group, water: waterMesh, banks, update };
}
