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
// M4.T8b: the drawn ground frame used to follow the relief straight through
// the sheet, so from the city view the river read as the same dark grey as the
// ground and the pick named ground, not water. landscape.js now drops the
// frame's vertices inside a water rect to WATER_BED and keeps grass off the
// rects, so the sheet is the surface a camera and a pick see. sim/terrain.js
// still does not flatten map.water (M4.T7's file, outside this task), so a
// mover asking the world for the bed's height still gets the old relief.
//
// The material (M4.T8b): metalness 0 (the environment is a lit studio, not a
// horizon, so a mirror on it is a void), roughness 0.14 (the sun and moon glint
// off the ripple, and a low roughness lets the sky term land as sheen),
// envMapIntensity 0.45 (up from 0.06, which left the sheet with no reflection
// at all; the puddles' full mirror is 3.0), and an asphalt normal scrolled
// along the flow. 0x2f6b78 is a mid blue-green, brighter than the ground plane
// and the tarmac, so the river reads by day (M4.T8b; world-scale-design.md's
// "do not re-tune it before the river is somewhere with light" is now spent).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_HALF_WIDTH as ROAD_HALF, WALKWAY_WIDTH } from '../sim/world.js';
import { buildInstancePools } from './buildings.js';

export const WATER_DROP = 0.02;
// M4.T8b: the old 0x0d2030 sheet read as the same dark grey as the ground from
// the city view. 0x2f6b78 is a mid blue-green, lighter than the ground and the
// tarmac, with the env term below high enough that sky and sun land on it as
// sheen instead of a void.
export const WATER_COLOR = 0x2f6b78;
// The bed the ground frame drops to under the water sheet (M4.T8b): below the
// bank foot (-0.5), so the quay wall's inner face is the only edge a low camera
// sees and the slope the frame makes entering the rect is under the water.
export const WATER_BED = -0.9;
const WATER_TILE = 3.1;   // metres of ripple per repeat along the flow
const WATER_ACROSS = 2;   // ... and across it
const SCROLL = 0.03;      // repeats a second the normal map drifts
const NORMAL_SCALE = 0.35;

// The bank: a low quay wall in ordinary concrete. Wide enough to read as an
// edge from the street, short enough that it never hides the water behind it.
// Light enough (M4.T8b) to read against the blue-green sheet, not the old dark.
const BANK_W = 1.6;
const BANK_TOP = 0.28;
const BANK_BOTTOM = -0.5;
const BANK_COLOR = 0x8a8f98;
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
    color: WATER_COLOR, metalness: 0, roughness: 0.14,
    normalMap: normal, normalScale: new THREE.Vector2(NORMAL_SCALE, NORMAL_SCALE),
    envMapIntensity: 0.45,
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
    waterMesh.name = 'river';
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
  const bankMat = new THREE.MeshStandardMaterial({ color: BANK_COLOR, roughness: 0.85, metalness: 0.05 });
  const banks = buildInstancePools([bankMat], bankSlots(map), {
    shape: 'box', castShadow: false, receiveShadow: true, slack: 32,
  });
  group.add(banks.group);
  // A road op that adds a crossing rewrites the bank gap with the road pools
  // (M3.T27), so the quay never rises through a deck laid after boot.
  const update = (next = map) => banks.update(bankSlots(next));
  return { group, water: waterMesh, banks, update };
}
