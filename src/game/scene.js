// Scene assembly (M3.T4a, criterion M3-1): every `build*` call and `scene.add`
// that main.js used to run inline. It takes the sim state as input and returns
// every handle the frame loop, the probe and the city view read. Build only —
// the update half lands in `updateScene(ctx, frame)` (M3.T4b).
import * as THREE from 'three';
import { DISTRICTS } from '../sim/world.js';
import { ARC } from '../sim/arc.js';
import { buildGround, buildTowers, buildSkyline } from '../render/block.js';
import { buildSigns, buildPools } from '../render/signs.js';
import { buildLamps } from '../render/lamps.js';
import { buildNPCs } from '../render/npcs.js';
import { buildTraffic, buildPlayerCar } from '../render/traffic.js';
import { buildPolice } from '../render/police.js';
import { buildPlayer } from '../render/player.js';
import {
  buildShops, buildPuddles, buildCityMirror, showInMirror, onlyInMirror,
  buildSteam, buildBeacons, buildStars,
} from '../render/setdress.js';
import { buildHackFx } from '../render/hackfx.js';
import { buildStreaks, buildCarStreaks } from '../render/streaks.js';
import { loadPropInstances, buildTrees } from '../render/props.js';
import { buildBlobs } from '../render/blobs.js';
import { buildRain } from '../render/rain.js';
import { buildAtmosphere } from '../render/atmosphere.js';
import { buildGrassGround, buildGrassTufts, buildMountains } from '../render/landscape.js';
import { createChunkManager } from '../render/chunks.js';
import { buildOutskirts } from '../render/outskirts.js';
import { buildZoning } from '../render/zoning.js';
import { buildVacant } from '../render/vacant.js';
import { buildDecline } from '../render/decline.js';
import { buildCityView } from '../render/cityview.js';
import { buildInteriors } from '../render/interior.js';
import { buildArcMarker } from '../render/arc.js';

// ctx: `scene`, `renderer`, `texLoader`, `maxAniso`, and the sim state the
// builders read — `city`, `street`, `heroCar`, `cityView`.
export function buildScene(ctx) {
  const { scene, renderer, texLoader, maxAniso, city, street, heroCar, cityView } = ctx;

  const env = buildAtmosphere(scene, renderer);
  const spots = env.spots;
  const ground = buildGround(texLoader, maxAniso);
  scene.add(ground.group);
  const towers = buildTowers(texLoader, maxAniso);
  scene.add(towers.group);
  const skyline = buildSkyline(texLoader, maxAniso);
  scene.add(skyline.mesh);
  const stars = buildStars();
  scene.add(stars);
  scene.add(buildGrassGround());
  scene.add(buildGrassTufts());
  scene.add(buildMountains(DISTRICTS[0]));
  // Streamed world. The outskirts own their meshes for the whole game — a tile
  // borrows instance slots in them, so residency changes cost zero draws — and
  // the manager only decides which tiles have claimed any. Two tiles a frame and
  // 1.5 ms is the whole build allowance; boot warms the spawn's ring up front so
  // frame one is not a half-built world.
  const outskirts = buildOutskirts();
  for (const m of outskirts.meshes) scene.add(m);
  const chunks = createChunkManager({ scene, budgetTiles: 2, budgetMs: 1.5 });
  chunks.register('outskirts', outskirts.build);
  const beacons = buildBeacons(towers.beacons);
  scene.add(beacons.mesh);
  scene.add(buildTrees());
  // Props resolve a frame or two after boot — the loop never touches them.
  Promise.all([
    loadPropInstances('assets/models/fire_hydrant/fire_hydrant_1k.gltf', [
      [-6.9, -50], [6.9, -15], [-6.9, 20], [6.9, 45], [37.1, -40],
      [50.9, -5], [37.1, 25], [50.9, 48], [-2, -69.5], [30, -69.5],
    ]),
    loadPropInstances('assets/models/metal_trash_can/metal_trash_can_1k.gltf', [
      [-5.9, -44], [-5.9, -26], [5.9, -8], [5.9, 10], [-5.9, 28], [-5.9, 46],
      [38.1, -44], [49.9, -8], [38.1, 28], [49.9, 46], [8, -69], [36, -69],
    ]),
  ]).then(([hydrants, trash]) => scene.add(hydrants, trash));
  const signs = buildSigns();
  scene.add(signs.group);
  const signPoolMeshes = [0, 1].map((zone) => {
    const m = buildPools([...signs.pools, ...towers.shopPools].filter((q) => q.zone === zone));
    scene.add(m);
    return m;
  });
  const lamps = buildLamps();
  scene.add(lamps.group);
  const streakMeshes = buildStreaks([
    ...signs.streakSources,
    ...lamps.heads.map((h) => ({ x: h.x, z: h.z, color: '#c98a4a', len: 9, width: 1.3 })),
  ]);
  for (const m of streakMeshes) scene.add(m);
  const carStreaks = buildCarStreaks();
  scene.add(carStreaks.mesh);
  const lampPoolMeshes = lamps.poolsByZone.map((quads) => {
    const m = buildPools(quads);
    scene.add(m);
    return m;
  });
  // Faded to nothing by day, and per zone in a blackout: skipped, not drawn clear.
  const fadedDraws = [...lampPoolMeshes, ...signPoolMeshes, ...streakMeshes, stars, lamps.cones, env.moonGlow];

  const growth = buildZoning(city, towers.kinds, towers.footprints);
  scene.add(growth.group);
  // Free land the player can zone (sim/zoning.js freeLand): its own programme, so
  // the district's growth kit is not touched by another worker's file.
  const vacant = buildVacant(city);
  scene.add(vacant.group);
  const decline = buildDecline(city, maxAniso);
  scene.add(decline.mesh);
  const arcMarker = buildArcMarker(ARC.signs);
  scene.add(arcMarker.mesh);
  const npcRig = buildNPCs(street);
  scene.add(npcRig.group);
  const traffic = buildTraffic(street);
  scene.add(traffic.group);
  const heroRig = buildPlayerCar(scene, heroCar);
  scene.add(heroRig.group);
  const police = buildPolice(scene);
  const avatar = buildPlayer();
  scene.add(avatar.group);
  const shops = buildShops(texLoader, maxAniso);
  scene.add(shops.group);
  // Verticality: the noodle bar behind the RAMEN board and the roof next door,
  // plus a street door and a room on every grown lot (sim/interior.js).
  const interiors = buildInteriors(city);
  scene.add(interiors.group);
  const puddles = buildPuddles();
  scene.add(puddles.group);
  const mirror = buildCityMirror();
  for (const m of puddles.mats) m.envMap = mirror.texture;
  // The reflection world (VGA-002): sky, skyline, the two merged tower proxies
  // and the alley washes — what a near-horizontal mirror ray off road water can
  // actually hit. Sign faces sit too high to land in a puddle; their road read is
  // the VGA-001 streaks. Lights ride along at +0 draws, or the probe renders
  // unlit facades and every mirror comes back black but for the emissive windows.
  showInMirror(env.skyMesh, skyline.mesh);
  onlyInMirror(...towers.mirrorProxies);
  for (const proxy of towers.mirrorProxies) scene.add(proxy);
  showInMirror(env.sun, env.moon, env.bounce, env.hemi, ...spots);
  signs.group.traverse((o) => { if (o.isMesh && o.userData.mirror) showInMirror(o); });
  const blobs = buildBlobs(street);
  scene.add(blobs);
  const steam = buildSteam();
  scene.add(steam.group);
  const fx = buildHackFx();
  scene.add(fx.group);
  const rain = buildRain();
  scene.add(rain);
  // Hero key: a small warm light riding the player so the closest object in
  // every frame never dissolves into the dark. Scaled by night, +0 draws.
  const heroKey = new THREE.PointLight(0xffe0c0, 0, 11, 2);
  heroKey.layers.enable(1);
  scene.add(heroKey);

  // City view (Z): the same world from above, where the player zones the lots.
  const cityRig = buildCityView(city, cityView);
  scene.add(cityRig.mesh);

  return {
    env, spots, groundMats: ground.mats, markingMats: ground.markings,
    towers, skyline, stars, outskirts, chunks, beacons, signs, signPoolMeshes,
    lamps, streakMeshes, carStreaks, lampPoolMeshes, fadedDraws, growth, vacant,
    decline, arcMarker, npcRig, traffic, heroRig, police, avatar, shops,
    interiors, puddles, mirror, blobs, steam, fx, rain, heroKey, cityRig,
  };
}
