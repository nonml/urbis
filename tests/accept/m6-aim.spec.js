// M6.T2 / M6-1 (docs/ROADMAP.md): aim. The nearest registered hackable thing
// inside 40 m, in the view cone and in sight (a 2D ray against the parcel
// footprints) is the one the highlight names with its cost; nothing behind a
// wall is picked, on all five seeds. Node only, a worker per seed. The oracle
// ray below is reimplemented, not imported: a shared oracle proves nothing.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const THREE = await import('three');
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet } = await import('../../src/sim/street.js');
  const { createHackables, hackablesNear, aimTarget, HACK_RANGE, AIM_COS } =
    await import('../../src/sim/hackables.js');
  const { aimLabel, aimScreen } = await import('../../src/render/aim.js');

  const map = createMap(seed);
  const city = createCity(seed, map);
  const street = createStreet(seed, map);
  const reg = createHackables({ map, city, street });
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));

  // The oracle's own ray: t-ranges of the segment inside the footprint's two
  // slabs, intersected. An empty lot is open ground; a standing building is a
  // wall. `skipId` is the target's own parcel, whose aim point is inside it.
  function wall(x0, z0, x1, z1, skipId) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    for (const p of map.parcels) {
      if (p.id === skipId) continue;
      if (p.kind === 'lot' && p.stage < STAGE.LOW) continue;
      let lo = 0;
      let hi = 1;
      for (const [min, max, s, d] of [
        [p.x - p.w / 2, p.x + p.w / 2, x0, dx],
        [p.z - p.d / 2, p.z + p.d / 2, z0, dz],
      ]) {
        if (Math.abs(d) < 1e-9) {
          if (s < min || s > max) { lo = 1; hi = 0; break; }
          continue;
        }
        const a = (min - s) / d;
        const b = (max - s) / d;
        lo = Math.max(lo, Math.min(a, b));
        hi = Math.min(hi, Math.max(a, b));
      }
      if (lo <= hi) return true;
    }
    return false;
  }
  const skipOf = (e) => e.ref?.id ?? null;
  const clear = (e, px, pz) => !wall(px, pz, e.x, e.z, skipOf(e));
  const inCone = (e, px, pz, fx, fz) => {
    const d = Math.hypot(e.x - px, e.z - pz);
    return d >= 0.5 && ((e.x - px) * fx + (e.z - pz) * fz) / d >= AIM_COS;
  };
  const nearest = (px, pz, fx, fz, sight) => hackablesNear(reg, px, pz, HACK_RANGE)
    .find(({ entry, dist }) => dist >= 0.5 && inCone(entry, px, pz, fx, fz)
      && (!sight || clear(entry, px, pz)))?.entry ?? null;
  const oracle = (px, pz, fx, fz) => nearest(px, pz, fx, fz, true)?.id ?? null;
  const aim = (r, px, pz, fx, fz) => aimTarget(r, px, pz, fx, fz)?.entry.id ?? null;

  // 8 m off a junction along its longest clear road: the road is the sight line.
  let stand = null;
  for (const e of reg.list.filter((x) => x.kind === 'junction')) {
    for (const ed of map.graph.edges) {
      if (ed.a !== e.ref.id && ed.b !== e.ref.id) continue;
      const o = byId.get(ed.a === e.ref.id ? ed.b : ed.a);
      const len = Math.hypot(o.x - e.x, o.z - e.z);
      if (stand && len <= stand.len) continue;
      const t = Math.min(8, len * 0.45);
      const px = e.x + ((o.x - e.x) / len) * t;
      const pz = e.z + ((o.z - e.z) / len) * t;
      if (clear(e, px, pz)) {
        stand = { e, px, pz, len, ux: (o.x - e.x) / len, uz: (o.z - e.z) / len };
      }
    }
  }
  const d = Math.hypot(stand.e.x - stand.px, stand.e.z - stand.pz);
  const fx = (stand.e.x - stand.px) / d;
  const fz = (stand.e.z - stand.pz) / d;
  const aimed = aimTarget(reg, stand.px, stand.pz, fx, fz);

  // An entry a wall hides that aim would otherwise pick: only the ray stops it,
  // so a missing sight check fails the test.
  let blocked = null;
  outer:
  for (const e of reg.list) {
    for (let a = 0; a < 32; a++) {
      for (const gap of [5, 8, 12, 18, 30]) {
        const bpx = e.x + Math.cos((a * Math.PI) / 16) * gap;
        const bpz = e.z + Math.sin((a * Math.PI) / 16) * gap;
        const fx0 = (e.x - bpx) / gap;
        const fz0 = (e.z - bpz) / gap;
        if (wall(bpx, bpz, e.x, e.z, skipOf(e)) && nearest(bpx, bpz, fx0, fz0, false) === e) {
          blocked = { e, px: bpx, pz: bpz, gap };
          break outer;
        }
      }
    }
  }
  const bfx = (blocked.e.x - blocked.px) / blocked.gap;
  const bfz = (blocked.e.z - blocked.pz) / blocked.gap;

  // One candidate alone on its clear road: 39.9 m aims, 40.1 m cannot.
  const solo = { map, list: [stand.e] };
  const near = aim(solo, stand.e.x + stand.ux * 39.9, stand.e.z + stand.uz * 39.9,
    -stand.ux, -stand.uz);
  const far = aim(solo, stand.e.x + stand.ux * 40.1, stand.e.z + stand.uz * 40.1,
    -stand.ux, -stand.uz);

  // The label pins over the aimed thing in front of the camera, hides behind it.
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 400);
  camera.position.set(stand.px, 1.6, stand.pz);
  camera.lookAt(aimed.entry.x, 1.6, aimed.entry.z);
  camera.updateMatrixWorld(true);
  const front = aimScreen(camera, aimed.entry, 1600, 900);
  camera.lookAt(stand.px - (aimed.entry.x - stand.px), 1.6,
    stand.pz - (aimed.entry.z - stand.pz));
  camera.updateMatrixWorld(true);
  const behind = aimScreen(camera, aimed.entry, 1600, 900);

  const aimBrief = { id: aimed.entry.id, name: aimed.entry.name, cost: aimed.entry.cost,
    dist: +aimed.dist.toFixed(2) };
  writeSync(1, `${JSON.stringify({
    seed, standEdge: +stand.len.toFixed(1), aim: aimBrief, label: aimLabel(aimed.entry),
    want: oracle(stand.px, stand.pz, fx, fz),
    wall: { target: blocked.e.id, aim: aim(reg, blocked.px, blocked.pz, bfx, bfz),
      want: oracle(blocked.px, blocked.pz, bfx, bfz),
      sightless: nearest(blocked.px, blocked.pz, bfx, bfz, false)?.id ?? null },
    cone: { target: stand.e.id, aim: aim(reg, stand.px, stand.pz, -fx, -fz),
      want: oracle(stand.px, stand.pz, -fx, -fz) },
    range: { near, far, target: stand.e.id },
    screen: { front, behind: { onScreen: behind.onScreen } },
  })}\n`);
  process.exit(0);
}

const WORLDS = new Map();
function world(seed) {
  if (!WORLDS.has(seed)) {
    const out = execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    WORLDS.set(seed, JSON.parse(out.trim().split('\n').pop()));
  }
  return WORLDS.get(seed);
}

test('M6.T2: the nearest thing in the cone and in sight is aimed, with its name and cost', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    expect(w.aim, `seed ${seed}: something is aimed at the stand-off`).toBeTruthy();
    expect(w.aim.id, `seed ${seed}: the pick is the oracle's nearest`).toBe(w.want);
    expect(w.aim.dist, `seed ${seed}: ${w.aim.id} is inside 40 m`).toBeLessThanOrEqual(40);
    expect(w.aim.name, `seed ${seed}: the pick carries its registry name`).toBeTruthy();
    expect(w.aim.cost, `seed ${seed}: the pick carries its default hack cost`).toBeGreaterThan(0);
    expect(w.label, `seed ${seed}: the highlight is "name · ₡cost"`).toBe(`${w.aim.name} · ₡${w.aim.cost}`);
  }
});

test('M6.T2: nothing behind a wall is aimed; the cone and the 40 m bound hold', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    expect(w.standEdge, `seed ${seed}: the stand-off's road runs past 40 m`).toBeGreaterThan(43);
    expect(w.wall.sightless, `seed ${seed}: without sight ${w.wall.target} is the pick`).toBe(w.wall.target);
    expect(w.wall.aim, `seed ${seed}: ${w.wall.target} behind the wall is not aimed`).not.toBe(w.wall.target);
    expect(w.wall.aim, `seed ${seed}: the blocked point matches the oracle`).toBe(w.wall.want);
    expect(w.cone.aim, `seed ${seed}: ${w.cone.target} outside the cone is not aimed`).not.toBe(w.cone.target);
    expect(w.cone.aim, `seed ${seed}: facing away matches the oracle`).toBe(w.cone.want);
    expect(w.range.near, `seed ${seed}: ${w.range.target} at 39.9 m is aimed`).toBe(w.range.target);
    expect(w.range.far, `seed ${seed}: nothing beyond 40 m is aimed`).toBeNull();
  }
});

test('M6.T2: the label pins on screen over the aimed thing and hides behind the lens', () => {
  for (const seed of SEEDS) {
    const { front, behind } = world(seed).screen;
    const inView = front.onScreen && front.x > 0 && front.x < 1600
      && front.y >= 0 && front.y < 900;
    expect(inView, `seed ${seed}: the label pins inside the 1600x900 viewport`).toBe(true);
    expect(behind.onScreen, `seed ${seed}: the label hides behind the lens`).toBe(false);
  }
});
