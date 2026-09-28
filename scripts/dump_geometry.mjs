// Geometry fingerprint — a dev tool, not part of the gate.
//
//   npm run build && node scripts/dump_geometry.mjs before.txt
//   ...change something...
//   node scripts/dump_geometry.mjs after.txt
//   cmp before.txt after.txt
//
// Answers one question: did the shipped street move? It walks buildGround(),
// buildTowers(), buildSkyline() and buildLamps() and writes, for every mesh in
// each: object position, rotation, scale, shadow flags, the full position,
// normal, uv and color attributes (and the power-zone stamp, where a mesh
// lights both zones), the whole index array, the bounding box,
// and for instanced meshes every instance matrix and instance colour. Then it
// does the same for sim/street.js — createStreet() serialised, a blackout fired
// and 600 ticks run, serialised again. A refactor that claims to move nothing
// has to produce a byte-identical file.
//
// Three things that make the output trustworthy, each learned by needing it:
//
// - **Confirm the instrument before you use it.** Run it twice on unchanged
//   code and `cmp` the two files FIRST. If those do not match, nothing the tool
//   says about a change means anything, and you have found a source of
//   nondeterminism worth knowing about on its own. Most of the wrong
//   conclusions on this project came from skipping exactly this step.
// - Floats go through `String(n)`, which is the shortest representation that
//   round-trips exactly. Not toFixed, not toPrecision — a truncated dump hides
//   the one-ulp drift that tells you an expression was rewritten, not just
//   moved.
// - `document` and `TextureLoader` are stubbed. Neither touches a vertex: the
//   canvases only paint atlases and the loader only returns textures, so the
//   stubs change no geometry while letting the generators run headless. The
//   json import hook exists because vite imports signs.json bare and node
//   wants the attribute.
import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

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
const texLoader = { load: () => new THREE.Texture() };

const out = [];
const w = (s) => out.push(s);
const n = (v) => String(v);

function dumpAttr(label, attr) {
  if (!attr) return w(`${label}: none`);
  const a = attr.array;
  w(`${label}: items=${attr.itemSize} count=${attr.count} len=${a.length}`);
  const chunk = [];
  for (let i = 0; i < a.length; i += 1) chunk.push(n(a[i]));
  w(chunk.join(' '));
}

function dumpGeometry(geo) {
  w(`  geometry ${geo.type}`);
  dumpAttr('  position', geo.attributes.position);
  dumpAttr('  normal', geo.attributes.normal);
  dumpAttr('  uv', geo.attributes.uv);
  dumpAttr('  color', geo.attributes.color);
  // Only where it exists, so every mesh without one dumps as it always has.
  if (geo.attributes.zone) dumpAttr('  zone', geo.attributes.zone);
  if (geo.index) {
    w(`  index: len=${geo.index.array.length}`);
    w(Array.from(geo.index.array).join(' '));
  } else {
    w('  index: none');
  }
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  w(`  bbox: ${n(b.min.x)} ${n(b.min.y)} ${n(b.min.z)} / ${n(b.max.x)} ${n(b.max.y)} ${n(b.max.z)}`);
}

function dumpObject(o, path) {
  w(`OBJ ${path} type=${o.type} name=${o.name}`);
  w(`  pos ${n(o.position.x)} ${n(o.position.y)} ${n(o.position.z)}`);
  w(`  rot ${n(o.rotation.x)} ${n(o.rotation.y)} ${n(o.rotation.z)} ${o.rotation.order}`);
  w(`  scale ${n(o.scale.x)} ${n(o.scale.y)} ${n(o.scale.z)}`);
  w(`  shadow cast=${o.castShadow} receive=${o.receiveShadow} frustumCulled=${o.frustumCulled}`);
  if (o.geometry) dumpGeometry(o.geometry);
  if (o.isInstancedMesh) {
    w(`  instanceCount=${o.count}`);
    dumpAttr('  instanceMatrix', o.instanceMatrix);
    dumpAttr('  instanceColor', o.instanceColor);
  }
  if (o.material) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => w(`  mat${i} ${m.type} color=${m.color ? m.color.getHexString() : '-'}`));
  }
  o.children.forEach((c, i) => dumpObject(c, `${path}/${i}`));
}

const block = await import('../src/render/block.js');
const lamps = await import('../src/render/lamps.js');
const street = await import('../src/sim/street.js');

w('===== buildGround =====');
dumpObject(block.buildGround(texLoader, 8).group, 'ground');

w('===== buildTowers =====');
const towers = block.buildTowers(texLoader, 8);
dumpObject(towers.group, 'towers');
w(`beacons: ${JSON.stringify(towers.beacons)}`);
w(`shopPools: ${JSON.stringify(towers.shopPools)}`);
towers.mirrorProxies.forEach((m, i) => dumpObject(m, `mirror${i}`));

w('===== buildSkyline =====');
dumpObject(block.buildSkyline(texLoader, 8).mesh, 'skyline');

w('===== buildLamps =====');
const lampSet = lamps.buildLamps();
dumpObject(lampSet.group, 'lamps');
w(`poolsByZone: ${JSON.stringify(lampSet.poolsByZone)}`);
w(`heads: ${JSON.stringify(lampSet.heads)}`);
// Half-lit: the blackout path writes different instance matrices and colours
// than the lit one, so a dump of the lit street alone would not cover it.
lampSet.setDaylight(0.5);
lampSet.setZoneLight(0, 0.5);
lampSet.tick(3.25);
w('--- after tick(3.25) with zone0 at 0.5 ---');
dumpObject(lampSet.group, 'lamps');

w('===== street =====');
const state = street.createStreet(1337);
w(JSON.stringify(state));
street.hackBlackout(state, 0);
for (let i = 0; i < 600; i += 1) street.tickStreet(state, 1 / 60);
w('--- after hack + 600 ticks ---');
w(JSON.stringify(state));
w(`STREET_HALF=${n(street.STREET_HALF)} NPC_COUNT=${street.NPC_COUNT} CAR_COUNT=${street.CAR_COUNT}`);
for (let z = -110; z <= 110; z += 7) w(`zoneAt(${z})=${street.zoneAt(z)}`);

const text = out.join('\n');
writeFileSync(process.argv[2], text);
process.stdout.write(`wrote ${process.argv[2]} (${text.length} bytes)\n`);
