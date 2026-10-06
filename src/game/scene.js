// Scene assembly (M3.T4a/T4b, criterion M3-1): every `build*`, `update*` and
// `scene.add` that main.js used to run inline. `buildScene` takes the sim state
// and returns every handle the frame loop, the probe and the city view read;
// `updateScene` runs the whole frame's visual updates against that context.
import * as THREE from 'three';
import { DISTRICTS } from '../sim/world.js';
import { ARC, arcTarget, arcSigns } from '../sim/arc.js';
import { zoneGlow, blink } from '../sim/street.js';
import { isIndoors, STREET } from '../sim/interior.js';
import { ROOF_RAIN_BELOW } from './camera.js';
import { buildGround, buildTowers, buildSkyline } from '../render/block.js';
import { buildSigns, buildPools } from '../render/signs.js';
import { buildLamps } from '../render/lamps.js';
import { buildNPCs, updateNPCs } from '../render/npcs.js';
import { buildTraffic, buildPlayerCar, updateTraffic, updateCarPools, updatePlayerCar } from '../render/traffic.js';
import { buildPolice, updatePolice } from '../render/police.js';
import { buildPlayer, updatePlayer } from '../render/player.js';
import {
  buildShops, buildPuddles, buildCityMirror, showInMirror, onlyInMirror,
  buildSteam, buildBeacons, buildStars, setPuddleGlow, requestCityMirror,
} from '../render/setdress.js';
import { buildHackFx, setSlit } from '../render/hackfx.js';
import { buildStreaks, buildCarStreaks, updateCarStreaks } from '../render/streaks.js';
import { loadPropInstances, buildTrees } from '../render/props.js';
import { buildBlobs, updateBlobs } from '../render/blobs.js';
import { buildRain, tickRain } from '../render/rain.js';
import { buildAtmosphere, updateDaylight } from '../render/atmosphere.js';
import { buildGrassGround, buildGrassTufts, buildMountains } from '../render/landscape.js';
import { createChunkManager } from '../render/chunks.js';
import { buildOutskirts } from '../render/outskirts.js';
import { worldMap } from '../sim/patrol.js';
import { drainDirty } from '../sim/map.js';
import { buildZoning } from '../render/zoning.js';
import { buildVacant } from '../render/vacant.js';
import { buildDecline } from '../render/decline.js';
import { buildCityView } from '../render/cityview.js';
import { buildInteriors, updateInteriors } from '../render/interior.js';
import { buildArcMarker, updateArcMarker } from '../render/arc.js';
import { hideFaded } from '../render/faded.js';
import { createAudioEngine } from '../audio/engine.js';

// The zone light the city mirror was last shot under, 1 lit or 0 dead.
const MIRRORED = [1, 1];

// ctx: `scene`, `renderer`, `texLoader`, `maxAniso`, and the sim state the
// builders read — `city`, `street`, `heroCar`, `cityView`.
export function buildScene(ctx) {
  const { scene, renderer, texLoader, maxAniso, city, street, heroCar, cityView } = ctx;
  // The one live map (M3.T27): the chunk manager's tiles and the road pools are
  // rewritten from it whenever an op (sim/ops.js) bumps its version.
  const map = worldMap();
  const mapState = { version: map.version };

  // Audio (M7.T1): the graph starts on the first input inside the engine and is
  // driven from updateScene. A capture run is silent unless it asks with
  // `?audio=1`, so screenshots never make noise.
  const params = new URLSearchParams(location.search);
  const audio = createAudioEngine({ silent: params.has('capture') && !params.has('audio') });

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
    interiors, puddles, mirror, blobs, steam, fx, rain, heroKey, cityRig, audio,
    roads: ground.roads, map, mapState,
  };
}

// The whole frame's visual updates (M3.T4b): the actors, the power zones and
// their lights, the street dressing, the atmosphere, the streamed growth, the
// traffic and the pursuit. `ctx` is the sim state plus every handle `buildScene`
// returned; `frame` is what only the frame loop knows — the blended draw poses
// and the car's brake state. Nothing here touches the HUD or the sim.
export function updateScene(ctx, frame) {
  const {
    scene, renderer, camera, bloom, grade, city, street, clock, interior, wanted, arc,
    heroCar, player, cityView, spots, lampPoolMeshes, signPoolMeshes, towers, puddles,
    fx, interiors, streakMeshes, markingMats, signs, shops, rain, lamps, env, groundMats,
    skyline, stars, beacons, growth, decline, npcRig, traffic, blobs, heroKey, police,
    arcMarker, vacant, fadedDraws, heroRig, avatar, carStreaks, mirror, audio,
    chunks, roads, map, mapState,
  } = ctx;
  const { driving, braking, playerDraw, carDraw } = frame;

  // A map edit (sim/ops.js) bumps the version and marks the 64 m tiles it
  // touched. The dirty keys go to the chunk manager, which reclaims their slots
  // now and rebuilds them inside its 1.5 ms a frame (M3.T27); the road pools
  // rewrite their slots the same frame, because a new road is not a tile.
  if (map.version !== mapState.version) {
    mapState.version = map.version;
    if (map.dirty) chunks.invalidate(drainDirty(map));
    roads.update(map);
  }

  // Audio follows the lens, and the probe lists what plays. The probe surface
  // binds after buildScene and has no audio part, so the listing is hung here,
  // once, the first frame it exists.
  audio.follow(camera);
  if (window.__game && !window.__game.sounds) window.__game.sounds = () => audio.sounds();

  if (driving) updatePlayerCar(heroRig, carDraw, braking);
  else updatePlayer(avatar, playerDraw);
  const hx = driving ? carDraw.x : playerDraw.x;
  const hz = driving ? carDraw.z : playerDraw.z;
  const hy = driving ? carDraw.y : playerDraw.y;
  const glows = [zoneGlow(street, 0), zoneGlow(street, 1)];
  const nf = clock.nightFactor;
  for (let z = 0; z < 2; z++) {
    // Re-shoot the mirror once a zone has settled, dead or lit, not the instant
    // the hack lands: the collapse and the relight both flicker, and a face shot
    // mid-flicker holds a half-lit street in the water until the next re-shoot.
    if ((glows[z] === 0 || glows[z] === 1) && glows[z] !== MIRRORED[z]) {
      MIRRORED[z] = glows[z];
      requestCityMirror(mirror, street.time, camera.position.x, camera.position.z);
    }
    const b = glows[z] >= 1 ? 1 : glows[z] <= 0 ? 0 : blink(street.time, z * 3.7);
    lamps.setZoneLight(z, glows[z]);
    spots[z].visible = b > 0.02;
    lampPoolMeshes[z].material.opacity = 0.5 * nf * b;
    signPoolMeshes[z].material.opacity = 0.5 * nf * b;
    spots[z].intensity = 45 * nf * b;
    for (const m of towers.zoneMats[z]) {
      // dayFloor: a tower's windows go dark at noon, but a shop keeps its
      // lights on, and without that the glazing reads as a black hole in a
      // sunlit wall. Zero for everything that isn't a shopfront.
      const floor = m.userData.dayFloor ?? 0;
      const lit = floor + (1 - floor) * nf;
      m.emissiveIntensity = 0.75 * lit * b * (m.userData.emissiveScale ?? 1);
      m.color.copy(m.userData.baseTint).multiplyScalar(1 - 0.3 * (1 - b));
    }
    setPuddleGlow(puddles, z, b);
    setSlit(fx, z, b);
    // The grown lots' street doors: their lit fascias and glazing ride their
    // own zone, so a blackout kills one side of the street and not the other.
    interiors.parcel.views[z].emissiveIntensity = (0.3 + 0.7 * nf) * b;
    streakMeshes[z].material.opacity = 0.55 * nf * b;
    const mk = markingMats[z];
    mk.color.setScalar((0.25 + 0.75 * nf) * (0.05 + 0.95 * b));
    mk.envMapIntensity = 0.1 + 0.6 * nf * b;
    mk.emissiveIntensity = 0.015 * nf * b;
  }
  updateCarStreaks(carStreaks, carDraw, driving, wanted.pursuit, nf, street.time);
  signs.tick(signs.zoneMats, signs.zoneSprites, glows, street.time, nf);
  for (const e of shops.mats) {
    const v = glows[e.zone];
    const b = v >= 1 ? 1 : v <= 0 ? 0 : blink(street.time, e.seed);
    e.mat.color.setScalar((0.3 + 0.7 * nf) * (0.06 + 0.94 * b));
  }
  updateInteriors(interiors, interior, { glows, night: nf, time: street.time, elapsed: clock.elapsed, city });
  rain.visible = !isIndoors(interior);
  // Up on a roof it rains on the roof: the rain box rides up with the player.
  rain.position.y = interior.space === STREET ? 0 : player.y - ROOF_RAIN_BELOW;
  lamps.tick(street.time);
  tickRain(rain, clock.elapsed);
  const night = clock.nightFactor;
  updateDaylight(env, scene, bloom, night, renderer);
  grade.uniforms.uNight.value = night;
  grade.uniforms.uTime.value = clock.elapsed;
  for (const m of [...towers.facadeMats, skyline.mat]) {
    m.userData.uNight.value = night;
    m.envMapIntensity = 1.1 + 1.4 * (1 - night);
  }
  // The distant ring is lit facade by night, not a blackout target: it fades to
  // its day albedo and back with the clock, independent of the two power zones.
  skyline.mat.emissiveIntensity = 0.8 * night;
  groundMats.road.envMapIntensity = 0.85 - 0.15 * (1 - night);
  groundMats.walk.envMapIntensity = 0.5 - 0.15 * (1 - night);
  lamps.setDaylight(night);
  stars.material.opacity = 0.75 * night;
  for (const s of env.spots) s.intensity = 45 * night;
  const pulse = 0.55 + 0.45 * Math.sin(clock.elapsed * 5);
  beacons.mat.color.setRGB(0.4 + 0.6 * pulse, 0.05, 0.05);
  growth.update();
  decline.update();
  updateNPCs(npcRig, street);
  updateTraffic(traffic.rig, street, camera);
  // Hero and pursuit throws ride the traffic pool set (VGA-004): three more
  // instances, no extra draw. The hero keeps its lights on parked — the beacon
  // is the other half of finding the car again.
  updateCarPools(traffic.rig, [
    { x: carDraw.x, z: carDraw.z, yaw: carDraw.yaw, speed: heroCar.speed, on: true },
    ...wanted.pursuit.map((p) => ({ x: p.x, z: p.z, yaw: p.yaw, speed: p.speed, on: p.active })),
  ], camera);
  updateBlobs(blobs, street, playerDraw, carDraw);
  heroKey.position.set(hx, hy + 2.4, hz);
  heroKey.intensity = 14 * night;
  if (isIndoors(interior)) heroKey.intensity = interiors.key;
  updatePolice(police, wanted, {
    time: street.time, elapsed: clock.elapsed, night: clock.nightFactor, camera, heroRig, heroCar, fx,
  });
  updateArcMarker(arcMarker, arcTarget(arc, city.parcels, hx, hz), arcSigns(arc), clock.elapsed, night, glows);
  vacant.update(cityView.lift > 0);
  // Faded-to-nothing draws (light pools, streaks, stars) stop drawing entirely:
  // the last write to their opacity is above, so this is always the same frame.
  hideFaded(fadedDraws);
}
