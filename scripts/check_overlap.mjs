// Building overlap check — VGA-084 sub-slice 1, "No overlap".
//
//   npm run check:overlap
//   node scripts/check_overlap.mjs --seed N    (generated layout, meter mode)
//
// Two buildings that pass through each other are a bug (AGENTS.md, "Not a toy
// either"). This builds the real towers, silhouettes and skyline ring headless,
// reads the ground each one covers, and lists every pair that intersects —
// plus every tower that stands on a zoning lot, because the lots have to stay
// clear for the cranes. It reads what buildTowers() actually emitted, never a
// re-derivation of the tables, so a wrong placement formula cannot hide from it.
//
// The ratchet: MAX_OVERLAPS is the count on main. It fails when the count goes
// up (a new overlap) AND when it goes down (so the next commit locks in the
// gain). Lower it to the new count every time you fix pairs. Never raise it.
// The item is done at 0.
//
// Two more measurements ride along, for VGA-084 sub-slice 2 (street walls):
// - road: towers standing on a road or its walkway (half-width ROAD_BAND from
//   each way's centre-line, src/sim/world.js). Ratchet MAX_ROAD, same rules.
// - frontage: how much of each avenue row is a building wall. A row is the
//   building line BUILD_LINE m out from an avenue's centre-line, over ROW_RUNS
//   minus that row's KEEP_OUT gaps (lots, the promenade, the roof-stair yard).
//   Runs shorter than MIN_RUN are not counted. Ratchet MIN_FRONTAGE: it fails
//   if the worst row drops below it, and asks to be raised when it climbs.
//   These tables are the brief's (docs/handoff/VGA-084-2b.md), kept here on
//   purpose: the checker must not read the generator's own idea of the gaps.
//
// The stubs are the ones scripts/dump_geometry.mjs uses: canvases only paint
// atlases and the loader only returns textures, so neither moves a vertex.
import { registerHooks } from 'node:module';
import { setWorldSeed } from '../src/sim/seedstore.js';

const MAX_OVERLAPS = 0;
const MAX_ROAD = 7;
const MIN_FRONTAGE = 0.982;
// Road half-width 3.5 m plus a 3 m walkway.
const ROAD_BAND = 6.5;
const ROW_RUNS = [[-55.5, 33.5], [46.5, 97]];
const MIN_RUN = 6;
// [avenue x, side, z0, z1]: stretches of a row that must stay open.
const KEEP_OUT = [
  [0, -1, -42.4, -27],     // roof-stair yard and the promenade deck
  [0, -1, 51, 61],         // LOTS[0]
  [0, 1, 86, 96],          // LOTS[4]
  [44, -1, -40, -31.5],    // LOTS[5]
  [44, -1, 51, 61],        // LOTS[1]
  [44, 1, -55.5, -51],     // LOTS[8], LOTS[9]
  [44, 1, 57, 70.5],       // LOTS[2]
  [44, 1, 86, 97],         // LOTS[3]
  [-44, 1, -37, -27],      // the promenade deck
];
// Faces that touch are a party wall, not an overlap.
const TOUCH = 0.01;
// The seed main.js boots the city with; lot geometry does not depend on it.
const SEED = 20260916;

registerHooks({
  resolve(spec, ctx, next) {
    const r = next(spec, ctx);
    if (r.url.endsWith('.json')) r.importAttributes = { ...r.importAttributes, type: 'json' };
    return r;
  },
  load(url, ctx, next) {
    if (url.endsWith('.json')) return next(url, { ...ctx, importAttributes: { type: 'json' } });
    return next(url, ctx);
  },
});

function ctx2d() {
  const grad = { addColorStop() {} };
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, globalCompositeOperation: '', shadowBlur: 0, shadowColor: '',
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, quadraticCurveTo() {}, bezierCurveTo() {},
    fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    fillText() {}, strokeText() {}, drawImage() {}, setTransform() {}, clip() {},
    measureText: () => ({ width: 10 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {},
  };
}

globalThis.document = {
  createElement() {
    return { width: 1, height: 1, getContext: () => ctx2d(), toDataURL: () => 'data:,' };
  },
};

// --seed N measures a generated layout. The ratchets are locked to the shipped
// hand layout, so here the same numbers print and the script always exits 0.
// world.js reads this on its first evaluation, so it must be set before any
// src/ module is imported.
const seedFlag = process.argv.indexOf('--seed');
const genSeed = seedFlag === -1 ? null : Number(process.argv[seedFlag + 1]);
if (genSeed !== null) setWorldSeed(genSeed, true);

const THREE = await import('three');
const { buildTowers, buildSkyline } = await import('../src/render/block.js');
const { createCity } = await import('../src/sim/zoning.js');
const { AVENUES, CROSSINGS } = await import('../src/sim/world.js');
// A generated world has a plan of its own; its runs are the referee there. The
// hand tables below measure the hand map and must not move.
const { WORLD_PLAN } = await import('../src/sim/layout.js');
// The building line is shared with the generator and the interior frames, not
// a second copy that can drift. ROW_RUNS/KEEP_OUT stay local on purpose: the
// checker must not read the generator's own idea of the gaps.
const { BUILD_LINE } = await import('../src/sim/landmarks.js');
const texLoader = { load: () => new THREE.Texture() };

const towers = buildTowers(texLoader, 1).footprints;
const buildings = [
  ...towers,
  ...buildSkyline(texLoader, 1).footprints,
];
const lots = createCity(SEED).parcels.map(({ x, z, w, d }, i) => ({ x, z, w, d, name: `LOTS[${i}]` }));

function overlaps(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - TOUCH
    && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - TOUCH;
}

const fmt = (f) => `${f.name} (x ${+f.x.toFixed(2)}, z ${+f.z.toFixed(2)}, ${+f.w.toFixed(2)} × ${+f.d.toFixed(2)})`;
const pairs = [];
for (let i = 0; i < buildings.length; i++) {
  for (let j = i + 1; j < buildings.length; j++) {
    if (overlaps(buildings[i], buildings[j])) pairs.push([buildings[i], buildings[j]]);
  }
  for (const lot of lots) if (overlaps(buildings[i], lot)) pairs.push([buildings[i], lot]);
}

for (const [a, b] of pairs) console.log(`  ${fmt(a)}  ×  ${fmt(b)}`);
console.log(`overlap: ${pairs.length} intersecting pairs among ${buildings.length} buildings and ${lots.length} lots (ratchet ${MAX_OVERLAPS})`);

if (genSeed === null) {
  if (pairs.length > MAX_OVERLAPS) {
    console.error(`overlap FAIL — ${pairs.length - MAX_OVERLAPS} new. Fix the placement; never raise MAX_OVERLAPS.`);
    process.exit(1);
  }
  if (pairs.length < MAX_OVERLAPS) {
    console.error(`overlap FAIL — good news: lower MAX_OVERLAPS in scripts/check_overlap.mjs to ${pairs.length}.`);
    process.exit(1);
  }
}

const ways = [
  ...AVENUES.map((a) => ({ x: a.x, z: (a.z0 + a.z1) / 2, w: 2 * ROAD_BAND, d: a.z1 - a.z0, name: `road ${a.id}` })),
  ...CROSSINGS.map((c) => ({ x: (c.x0 + c.x1) / 2, z: c.z, w: c.x1 - c.x0, d: 2 * ROAD_BAND, name: `road ${c.id}` })),
];
const onRoad = [];
for (const t of towers) for (const r of ways) if (overlaps(t, r)) onRoad.push([t, r]);
for (const [t, r] of onRoad) console.log(`  ${fmt(t)}  on  ${r.name}`);
console.log(`road: ${onRoad.length} towers on a road or walkway (ratchet ${MAX_ROAD})`);

function subtract(runs, [a, b]) {
  return runs.flatMap(([r0, r1]) => [[r0, Math.min(r1, a)], [Math.max(r0, b), r1]]).filter(([r0, r1]) => r1 > r0);
}
const rows = [];
for (const { x: ax } of AVENUES) {
  for (const side of [-1, 1]) {
    const planRow = WORLD_PLAN?.rows.find((r) => r.ax === ax && r.side === side);
    let runs = planRow ? planRow.runs : ROW_RUNS;
    if (!planRow) {
      for (const [kx, ks, z0, z1] of KEEP_OUT) if (kx === ax && ks === side) runs = subtract(runs, [z0, z1]);
    }
    runs = runs.filter(([r0, r1]) => r1 - r0 >= MIN_RUN);
    const lineX = ax + side * BUILD_LINE;
    const walls = towers.filter((t) => Math.abs(t.x - lineX) < t.w / 2).map((t) => [t.z - t.d / 2, t.z + t.d / 2]);
    let open = runs;
    for (const w of walls) open = subtract(open, w);
    const len = (rs) => rs.reduce((n, [r0, r1]) => n + r1 - r0, 0);
    rows.push({ name: `x=${ax} side ${side}`, built: 1 - len(open) / len(runs) });
  }
}
const worst = Math.min(...rows.map((r) => r.built));
console.log(`frontage: ${rows.map((r) => `${r.name} ${(r.built * 100).toFixed(0)}%`).join(', ')}`);
console.log(`frontage: worst row ${(worst * 100).toFixed(1)}% (ratchet ${(MIN_FRONTAGE * 100).toFixed(1)}%)`);

if (genSeed === null) {
  let failed = false;
  if (onRoad.length > MAX_ROAD) {
    console.error(`road FAIL — ${onRoad.length - MAX_ROAD} new. Fix the placement; never raise MAX_ROAD.`);
    failed = true;
  } else if (onRoad.length < MAX_ROAD) {
    console.error(`road FAIL — good news: lower MAX_ROAD in scripts/check_overlap.mjs to ${onRoad.length}.`);
    failed = true;
  }
  const floor = Math.floor(worst * 1000) / 1000;
  if (floor < MIN_FRONTAGE) {
    console.error(`frontage FAIL — worst row fell below ${MIN_FRONTAGE}. Never lower MIN_FRONTAGE.`);
    failed = true;
  } else if (floor > MIN_FRONTAGE) {
    console.error(`frontage FAIL — good news: raise MIN_FRONTAGE in scripts/check_overlap.mjs to ${floor}.`);
    failed = true;
  }
  if (failed) process.exit(1);
}
