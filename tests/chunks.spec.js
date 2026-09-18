// Plank 3 spike: the chunk lifecycle, proven without a browser.
//
// This spec never opens a page. The chunk manager is duck-typed over Object3D and
// needs no GL context, so it is exercised against REAL three objects in Node — real
// BufferGeometry, real materials, real textures, with their real dispose() wrapped so
// the test can see it fire. A fake-object test would have proved nothing about the
// one thing that matters here: that the GPU resources actually get freed.
//
// It lives in tests/ and uses the @playwright/test runner so it runs under the same
// `npm test` as the gate, with no new tooling and no new package.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import {
    BUILD_RADIUS,
    DISPOSE_RADIUS,
    TILE_SIZE,
    createChunkManager,
    residency,
    tileBounds,
    tileDistance,
    tileIndex,
    tileSeed,
} from '../src/render/chunks.js';

// Small, hand-checkable numbers. The shipped constants are asserted separately.
const GRID = { tileSize: 10, buildRadius: 15, disposeRadius: 25 };

function watched(resource, log) {
    const real = resource.dispose.bind(resource);
    resource.dispose = () => {
        log.push(resource);
        real();
    };
    return resource;
}

// A builder shaped like a real one: per-tile geometry and a per-tile material with a
// per-tile texture (the things that must die), plus one module-level material handed
// out to every tile (the thing that must not).
function fixture({ sharedMaterial = null } = {}) {
    const disposed = [];
    const made = new Map();
    let builds = 0;
    const build = (bounds) => {
        builds++;
        const texture = watched(new THREE.DataTexture(new Uint8Array([9, 9, 9, 255]), 1, 1), disposed);
        const material = watched(new THREE.MeshStandardMaterial({ map: texture }), disposed);
        const geometry = watched(new THREE.BoxGeometry(1, 1, 1), disposed);
        const group = new THREE.Group();
        group.add(new THREE.Mesh(geometry, material));
        if (sharedMaterial) {
            group.add(new THREE.Mesh(watched(new THREE.PlaneGeometry(bounds.size, bounds.size), disposed), sharedMaterial));
        }
        made.set(bounds.key, { seed: bounds.seed, geometry, material, texture });
        return group;
    };
    return { build, disposed, made, calls: () => builds };
}

test('tile maths maps world positions to tiles, negative side included', () => {
    expect(tileIndex(0, 10)).toBe(0);
    expect(tileIndex(9.9, 10)).toBe(0);
    expect(tileIndex(10, 10)).toBe(1);
    // Truncation instead of floor would fold -0.1 into tile 0 and overlap two tiles.
    expect(tileIndex(-0.1, 10)).toBe(-1);
    expect(tileIndex(-10, 10)).toBe(-1);
    expect(tileIndex(-10.1, 10)).toBe(-2);

    const left = tileBounds(-1, 0, 10);
    const right = tileBounds(0, 0, 10);
    expect(left.maxX).toBe(right.minX);
    expect(right.centreX).toBe(5);
    expect(right.key).toBe('0,0');

    // Nearest-point distance, not centre distance.
    expect(tileDistance(0, 0, 5, 5, 10)).toBe(0);
    expect(tileDistance(0, 0, -3, 5, 10)).toBeCloseTo(3);
    expect(tileDistance(1, 1, 0, 0, 10)).toBeCloseTo(Math.hypot(10, 10));
});

test('residency builds what is within the build radius and nothing past it', () => {
    const { build, drop } = residency([], 0.5, 0.5, GRID);
    const keys = build.map((b) => b.key);

    expect(drop).toEqual([]);
    expect(keys).toContain('0,0');    // holds the centre
    expect(keys).toContain('-2,0');   // x -20..-10, 10.5 m away
    expect(keys).toContain('1,1');    // corner at 13.4 m
    expect(keys).not.toContain('2,0'); // x 20..30, 19.5 m away
    for (const b of build) expect(tileDistance(b.tx, b.tz, 0.5, 0.5, GRID.tileSize)).toBeLessThanOrEqual(15);
});

test('hysteresis keeps a tile that has left the build radius until it leaves the dispose radius', () => {
    const resident = ['0,0'];

    // 20.5 m out: past the 15 m build radius, inside the 25 m dispose radius.
    const between = residency(resident, 30.5, 0.5, GRID);
    expect(between.drop).toEqual([]);
    expect(between.build.map((b) => b.key)).not.toContain('0,0');

    // 30.5 m out: past both.
    const gone = residency(resident, 40.5, 0.5, GRID);
    expect(gone.drop).toEqual(['0,0']);
});

test('jitter across the build boundary rebuilds nothing, and without hysteresis it would', () => {
    // Tile 3,0 spans x 30..40, so its distance from the centre straddles the 15 m
    // build radius as x oscillates between 14.5 and 15.5.
    const jitter = (manager) => {
        const churn = [];
        for (let i = 0; i < 12; i++) churn.push(manager.update(i % 2 ? 14.5 : 15.5, 5));
        // The first two updates are the fill: each extreme pulls in one tile the
        // other does not reach. Everything after that is churn, and should be none.
        return churn.slice(2);
    };

    const stable = fixture();
    const streamed = createChunkManager(GRID);
    streamed.register('fixture', stable.build);
    const settled = jitter(streamed);
    expect(streamed.resident()).toContain('3,0');
    expect(settled.every((s) => s.built === 0 && s.dropped === 0)).toBe(true);
    const buildsDuringJitter = stable.calls();

    // Same jitter, hysteresis removed: the tile thrashes. This is what the gap buys.
    const thrashy = fixture();
    const naive = createChunkManager({ ...GRID, disposeRadius: GRID.buildRadius + 1e-4 });
    naive.register('fixture', thrashy.build);
    const churned = jitter(naive);
    expect(churned.some((s) => s.built > 0 || s.dropped > 0)).toBe(true);
    expect(thrashy.calls()).toBeGreaterThan(buildsDuringJitter);
});

test('tiles build on approach, dispose behind, and free their geometries', () => {
    const scene = new THREE.Scene();
    const parts = fixture();
    const manager = createChunkManager({ ...GRID, scene });
    manager.register('fixture', parts.build);

    manager.update(5, 5);
    expect(manager.resident()).toContain('0,0');
    expect(scene.children.length).toBe(manager.stats().resident);
    const home = parts.made.get('0,0');
    expect(parts.disposed).not.toContain(home.geometry);

    // Drive away far enough that home is past the dispose radius.
    const moved = manager.update(500, 5);
    expect(moved.dropped).toBeGreaterThan(0);
    expect(manager.resident()).not.toContain('0,0');
    expect(parts.disposed).toContain(home.geometry);
    expect(parts.disposed).toContain(home.material);
    expect(parts.disposed).toContain(home.texture);
    expect(scene.getObjectByName('chunk 0,0')).toBeUndefined();

    manager.disposeAll();
    expect(manager.stats()).toEqual({ resident: 0, pending: 0, tracked: 0, builders: 1 });
    expect(scene.children.length).toBe(0);
    // Everything every tile ever made is now released — no leak left behind.
    expect(parts.disposed.length).toBe(parts.calls() * 3);
});

test('a material shared with the unchunked world outlives every tile that used it', () => {
    const shared = new THREE.MeshStandardMaterial({ color: 0x223344 });
    const log = [];
    watched(shared, log);
    const parts = fixture({ sharedMaterial: shared });
    const manager = createChunkManager({ ...GRID, shared: [shared] });
    manager.register('fixture', parts.build);

    manager.update(5, 5);
    expect(manager.holds(shared)).toBe(manager.stats().resident);

    manager.disposeAll();
    expect(log).toEqual([]);            // never disposed
    expect(manager.holds(shared)).toBe(0); // and no longer counted
    expect(shared.userData.shared).toBe(true);
});

test('a material two tiles share is disposed only when the last of them goes', () => {
    // Unmarked on purpose: a resource only tiles use needs no marking, the refcount
    // alone has to keep it alive.
    const pooled = new THREE.MeshStandardMaterial({ color: 0x884422 });
    const log = [];
    watched(pooled, log);
    const build = (bounds) => new THREE.Mesh(new THREE.BoxGeometry(bounds.size, 1, bounds.size), pooled);
    const manager = createChunkManager({ tileSize: 10, buildRadius: 4, disposeRadius: 8 });
    manager.register('pooled', build);

    // Straddling the x boundary at 10 puts exactly tiles 0,0 and 1,0 in range.
    manager.update(10, 5);
    expect(manager.resident().sort()).toEqual(['0,0', '1,0']);
    expect(manager.holds(pooled)).toBe(2);

    manager.update(25, 5); // drops 0,0, keeps 1,0, adds 2,0
    expect(manager.resident()).not.toContain('0,0');
    expect(log).toEqual([]);

    manager.disposeAll();
    expect(log).toEqual([pooled]);      // disposed exactly once, at the end
    expect(manager.stats().tracked).toBe(0);
});

test('a tile that comes back comes back the same', () => {
    const parts = fixture();
    const manager = createChunkManager(GRID);
    manager.register('fixture', parts.build);

    manager.update(5, 5);
    const first = parts.made.get('0,0').seed;
    manager.update(500, 5);
    manager.update(5, 5);

    expect(parts.made.get('0,0').seed).toBe(first);
    expect(tileSeed(0, 0)).toBe(first);
    expect(tileSeed(0, 0)).not.toBe(tileSeed(1, 0));
});

// A builder that borrows slots in a pool the whole world shares — the shape
// render/outskirts.js actually has, and the reason draws stay flat as residency
// grows. Nothing here is per-tile, so nothing here may be disposed per tile.
function poolFixture() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x334455 });
  const disposed = [];
  watched(geometry, disposed);
  watched(material, disposed);
  const held = new Map();
  // The handle carries the pool's geometry and material on purpose: if the
  // manager ever went looking for resources on a claim it would take down the
  // whole world's pool, and this is the test that would catch it.
  const build = (bounds) => {
    held.set(bounds.key, 4);
    return { release: () => held.delete(bounds.key), geometry, material };
  };
  return { build, disposed, held };
}

test('a builder that borrows shared slots hands them back on dispose, and frees nothing', () => {
    const scene = new THREE.Scene();
    const pool = poolFixture();
    const manager = createChunkManager({ ...GRID, scene });
    manager.register('pool', pool.build);

    manager.update(5, 5);
    expect(pool.held.size).toBe(manager.stats().resident);
    // The claim is not an Object3D, so nothing of it lands in the scene graph.
    expect(scene.children.length).toBe(0);
    expect(manager.stats().tracked).toBe(0);

    manager.update(500, 5);
    expect(pool.held.has('0,0')).toBe(false);
    expect(pool.held.size).toBe(manager.stats().resident);

    manager.disposeAll();
    expect(pool.held.size).toBe(0);
    expect(pool.disposed).toEqual([]);   // the pool outlives every tile that used it
});

test('a builder may return null for a tile it has nothing in, and that tile is still resident', () => {
    // Once the world is big this is the common answer, and a manager that treated
    // it as a failed build would re-plan the same empty tile every single frame.
    const seen = [];
    const manager = createChunkManager(GRID);
    manager.register('sparse', (bounds) => {
      seen.push(bounds.key);
      return bounds.tx === 0 ? new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)) : null;
    });

    const first = manager.update(5, 5);
    expect(manager.resident()).toContain('1,0');
    expect(manager.objectAt('1,0')).toBe(null);
    const built = seen.length;
    const again = manager.update(5, 5);
    expect(again).toMatchObject({ built: 0, dropped: 0, pending: 0, resident: first.resident });
    expect(seen.length).toBe(built);      // nothing rebuilt
});

test('the build budget spreads a residency fill over frames instead of spending one on all of it', () => {
    const parts = fixture();
    const manager = createChunkManager({ ...GRID, budgetTiles: 2 });
    manager.register('fixture', parts.build);

    const wanted = residency([], 5, 5, GRID).build.length;
    expect(wanted).toBeGreaterThan(4);

    const first = manager.update(5, 5);
    expect(first.built).toBe(2);
    expect(first.pending).toBe(wanted - 2);
    expect(parts.calls()).toBe(2);

    let frames = 1;
    while (manager.stats().pending) {
      expect(manager.update(5, 5).built).toBeLessThanOrEqual(2);
      frames++;
    }
    expect(frames).toBe(Math.ceil(wanted / 2));
    expect(manager.stats().resident).toBe(wanted);
});

test('the queue is drained nearest first, so the tile ahead is never behind the tile in the fog', () => {
    const order = [];
    const manager = createChunkManager({ ...GRID, budgetTiles: 1 });
    manager.register('order', (bounds) => {
      order.push(bounds.key);
      return null;
    });

    manager.update(5, 5);
    while (manager.stats().pending) manager.update(5, 5);
    const distances = order.map((key) => {
      const [tx, tz] = key.split(',').map(Number);
      return tileDistance(tx, tz, 5, 5, GRID.tileSize);
    });
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(order[0]).toBe('0,0');
});

test('a queued tile the player leaves before it is built is never built at all', () => {
    const parts = fixture();
    const manager = createChunkManager({ ...GRID, budgetTiles: 1 });
    manager.register('fixture', parts.build);

    manager.update(5, 5);
    expect(manager.stats().pending).toBeGreaterThan(0);
    const builtNear = parts.calls();

    // Gone, before the queue ever got its turn. The work is dropped, not done.
    const away = manager.update(500, 5);
    expect(manager.pending().some((key) => key.startsWith('0,'))).toBe(false);
    expect(parts.calls()).toBe(builtNear + away.built);
    expect([...parts.made.keys()].length).toBe(parts.calls());
});

test('the ms budget stops starting builds, but always lets one through so streaming cannot stall', () => {
    // A fake clock: every now() reads 10 ms later, so the budget is spent the
    // moment the first build finishes.
    let clock = 0;
    const parts = fixture();
    const manager = createChunkManager({
      ...GRID, budgetTiles: 8, budgetMs: 1, now: () => (clock += 10),
    });
    manager.register('fixture', parts.build);

    expect(manager.update(5, 5).built).toBe(1);
    expect(manager.update(5, 5).built).toBe(1);

    // warm() ignores the budget outright — boot wants the world, not a trickle.
    manager.warm(5, 5);
    expect(manager.stats().pending).toBe(0);
    expect(manager.stats().resident).toBe(residency([], 5, 5, GRID).build.length);
});

test('the shipped radii have a whole tile of hysteresis, and a manager without it refuses to exist', () => {
    expect(DISPOSE_RADIUS - BUILD_RADIUS).toBeGreaterThanOrEqual(TILE_SIZE);
    expect(() => createChunkManager({ buildRadius: 100, disposeRadius: 100 })).toThrow(/hysteresis|thrash/);
});
