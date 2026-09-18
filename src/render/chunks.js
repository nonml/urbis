// Chunk streaming: the world cut into tiles, built on approach, disposed behind.
//
// UNWIRED SPIKE. Nothing calls this yet — plank 3 of
// docs/superpowers/specs/2026-09-19-world-scale-design.md lands it unattached so the
// lifecycle can be reviewed before it touches the frame loop.
//
// Two halves, deliberately separated:
//   1. residency — which tiles should exist. Pure, zero three, zero state.
//   2. the manager — build/dispose and the GPU resource accounting that goes with it.
import * as THREE from 'three';

// One superblock. The avenues sit 44 m apart (render/block.js), so a 64 m tile holds
// a block and its flanking kerbs without cutting a facade run in half.
export const TILE_SIZE = 64;
// FogExp2 at 0.012 has eaten the frame well before 200 m and the camera far plane is
// 400, so 160 m of resident world is everything the player can actually see.
export const BUILD_RADIUS = 160;
// A full tile of hysteresis. At CAR_TOP = 12 m/s (sim/vehicle.js) that is 5.3 s of
// committed driving away from a tile before it may go. Jitter on a boundary cannot
// reach it, and jitter is the only thing that makes streaming thrash.
export const DISPOSE_RADIUS = 224;
const WORLD_SEED = 0x5eed;

export function tileIndex(v, size = TILE_SIZE) {
  return Math.floor(v / size);
}

export function tileKey(tx, tz) {
  return `${tx},${tz}`;
}

export function parseTileKey(key) {
  const [tx, tz] = key.split(',');
  return { tx: Number(tx), tz: Number(tz) };
}

// A tile that is disposed and revisited must come back identical, or the city
// rearranges itself behind the player. Builders derive their rng from this.
export function tileSeed(tx, tz, seed = WORLD_SEED) {
  let h = Math.imul(tx | 0, 0x27d4eb2d) ^ Math.imul(tz | 0, 0x165667b1) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

// The only thing a builder is told about its tile. A road graph reads this as a
// query window: "give me the edges that intersect this rectangle".
export function tileBounds(tx, tz, size = TILE_SIZE, seed = WORLD_SEED) {
  const minX = tx * size;
  const minZ = tz * size;
  return {
    tx, tz, size,
    key: tileKey(tx, tz),
    minX, minZ,
    maxX: minX + size,
    maxZ: minZ + size,
    centreX: minX + size / 2,
    centreZ: minZ + size / 2,
    seed: tileSeed(tx, tz, seed),
  };
}

// Distance to the nearest point of the tile, not to its centre: a tile counts as
// near when any part of it is near, so big tiles do not pop late at their edges.
export function tileDistance(tx, tz, x, z, size = TILE_SIZE) {
  const minX = tx * size;
  const minZ = tz * size;
  const dx = Math.max(minX - x, 0, x - (minX + size));
  const dz = Math.max(minZ - z, 0, z - (minZ + size));
  return Math.hypot(dx, dz);
}

// The whole hysteresis rule, in one pure function: build inside buildRadius, drop
// only outside the wider disposeRadius. Between the two, whatever exists stays.
export function residency(resident, x, z, options = {}) {
  const size = options.tileSize ?? TILE_SIZE;
  const buildRadius = options.buildRadius ?? BUILD_RADIUS;
  const disposeRadius = options.disposeRadius ?? DISPOSE_RADIUS;
  const seed = options.seed ?? WORLD_SEED;
  const have = resident instanceof Set ? resident : new Set(resident);

  const build = [];
  const hiX = tileIndex(x + buildRadius, size);
  const hiZ = tileIndex(z + buildRadius, size);
  for (let tx = tileIndex(x - buildRadius, size); tx <= hiX; tx++) {
    for (let tz = tileIndex(z - buildRadius, size); tz <= hiZ; tz++) {
      if (have.has(tileKey(tx, tz))) continue;
      if (tileDistance(tx, tz, x, z, size) <= buildRadius) build.push(tileBounds(tx, tz, size, seed));
    }
  }

  const drop = [];
  for (const key of have) {
    const { tx, tz } = parseTileKey(key);
    if (tileDistance(tx, tz, x, z, size) > disposeRadius) drop.push(key);
  }
  return { build, drop };
}

// ---------------------------------------------------------------------------

// Opt a resource out of tile ownership. The default is the other way round — see
// createRegistry — so this is what you call on a module-level material that the
// unchunked world also draws with.
export function markShared(...resources) {
  for (const resource of resources) {
    if (!resource) continue;
    if (!resource.userData) resource.userData = {};
    resource.userData.shared = true;
  }
  return resources;
}

function texturesOf(material) {
  const found = [];
  for (const value of Object.values(material)) {
    if (value && value.isTexture) found.push(value);
  }
  return found;
}

// Everything a tile holds on the GPU, flattened at build time — flattened, and not
// re-walked at dispose time, because a builder is free to mutate its own subtree
// afterwards and we still have to hand back exactly what we took.
function tileResources(object) {
  const resources = [];
  object.traverse((node) => {
    if (node.geometry) resources.push(node.geometry);
    if (!node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) resources.push(material, ...texturesOf(material));
  });
  return resources;
}

// Reference counting is the answer to "who owns this material?". Two tiles sharing
// one material each hold a count; the second release frees it, the first does not.
// Nothing is guessed by re-reading the scene graph.
//
// The default is DISPOSE and shared-ness is the opt-out, because of how the two
// mistakes fail. Forget to mark a shared material and it dies under the rest of the
// city — loud, immediate, on screen inside a minute. Default to keeping instead and
// a forgotten per-tile material leaks silently until the game dies twenty minutes
// into a drive, which is the exact failure that makes streaming look like a bad
// idea. A resource used only by tiles needs no marking at all: the refcount already
// keeps it alive for exactly as long as some tile wants it.
function createRegistry() {
  const counts = new Map();
  return {
    acquire(resource) {
      counts.set(resource, (counts.get(resource) ?? 0) + 1);
    },
    release(resource) {
      const held = counts.get(resource);
      if (held === undefined) return false;
      if (held > 1) {
        counts.set(resource, held - 1);
        return false;
      }
      counts.delete(resource);
      if (resource.userData?.shared) return false;
      if (typeof resource.dispose !== 'function') return false;
      resource.dispose();
      return true;
    },
    count: (resource) => counts.get(resource) ?? 0,
    size: () => counts.size,
  };
}

function chunkConfig(options) {
  const config = {
    scene: options.scene ?? null,
    tileSize: options.tileSize ?? TILE_SIZE,
    buildRadius: options.buildRadius ?? BUILD_RADIUS,
    disposeRadius: options.disposeRadius ?? DISPOSE_RADIUS,
    seed: options.seed ?? WORLD_SEED,
  };
  if (!(config.disposeRadius > config.buildRadius)) {
    throw new Error('chunks: disposeRadius must exceed buildRadius, or tiles thrash on the boundary');
  }
  return config;
}

// A tile does not know what is inside it. Callers register builders; each builder is
// handed tileBounds() and returns an Object3D to show, or null for "nothing of mine
// lives here" — which is the common answer once the world is big.
export function createChunkManager(options = {}) {
  const { scene, tileSize, buildRadius, disposeRadius, seed } = chunkConfig(options);
  const builders = [];
  const tiles = new Map();
  const registry = createRegistry();
  markShared(...(options.shared ?? []));

  function buildTile(bounds) {
    const group = new THREE.Group();
    group.name = `chunk ${bounds.key}`;
    for (const builder of builders) {
      const object = builder.build(bounds);
      if (object) group.add(object);
    }
    const object = group.children.length ? group : null;
    const resources = object ? tileResources(object) : [];
    for (const resource of resources) registry.acquire(resource);
    if (object && scene) scene.add(object);
    tiles.set(bounds.key, { bounds, object, resources });
  }

  function dropTile(key) {
    const tile = tiles.get(key);
    if (!tile) return;
    tiles.delete(key);
    if (tile.object) {
      tile.object.removeFromParent();
      tile.object.clear();
    }
    for (const resource of tile.resources) registry.release(resource);
  }

  return {
    // Every builder must be in before the first update, or early tiles are missing
    // whatever registered late and nothing ever notices.
    register(name, build) {
      if (tiles.size) throw new Error('chunks: register every builder before the first update()');
      builders.push({ name, build });
    },
    // Drop first, then build: the peak resource count is the larger residency set,
    // never the union of the two.
    update(x, z) {
      const plan = residency(tiles.keys(), x, z, { tileSize, buildRadius, disposeRadius, seed });
      for (const key of plan.drop) dropTile(key);
      for (const bounds of plan.build) buildTile(bounds);
      return { built: plan.build.length, dropped: plan.drop.length, resident: tiles.size };
    },
    disposeAll() {
      for (const key of [...tiles.keys()]) dropTile(key);
    },
    resident: () => [...tiles.keys()],
    objectAt: (key) => tiles.get(key)?.object ?? null,
    holds: (resource) => registry.count(resource),
    stats: () => ({ resident: tiles.size, tracked: registry.size(), builders: builders.length }),
  };
}
