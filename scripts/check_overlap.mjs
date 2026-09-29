// Building overlap check — VGA-084 sub-slice 1, "No overlap".
//
//   npm run check:overlap
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
// The stubs are the ones scripts/dump_geometry.mjs uses: canvases only paint
// atlases and the loader only returns textures, so neither moves a vertex.
import { registerHooks } from 'node:module';

const MAX_OVERLAPS = 57;
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

const THREE = await import('three');
const { buildTowers, buildSkyline } = await import('../src/render/block.js');
const { createCity } = await import('../src/sim/zoning.js');
const texLoader = { load: () => new THREE.Texture() };

const buildings = [
  ...buildTowers(texLoader, 1).footprints,
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

if (pairs.length > MAX_OVERLAPS) {
  console.error(`overlap FAIL — ${pairs.length - MAX_OVERLAPS} new. Fix the placement; never raise MAX_OVERLAPS.`);
  process.exit(1);
}
if (pairs.length < MAX_OVERLAPS) {
  console.error(`overlap FAIL — good news: lower MAX_OVERLAPS in scripts/check_overlap.mjs to ${pairs.length}.`);
  process.exit(1);
}
