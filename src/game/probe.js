// The game's probe surface (M3.T1). Everything window.__game exposes lives here,
// out of the frame loop: bindProbe(parts) takes the game's parts as one object
// and installs the probes. The base probes read sim state and call the same sim
// entry points play does; the capture-only ones (?capture=1) also move the
// player or the streamer to frame evidence, and never bind in play.
//
// main.js assembles the parts and calls bindProbe once, after the record/replay
// bindings exist. A probe is a test tool: it never draws except through shot()
// and frameCheck(), which a test asks for explicitly.

import * as THREE from 'three';
import { snap, setSpeed } from './loop.js';
import { hashState } from './replay.js';
import { tickZoning, STAGES, builtHeight, zoneParcel } from '../sim/zoning.js';
import { tickStreet, hackCooldownLeft, zonePhase, zoneGlow } from '../sim/street.js';
import { tickClock } from '../sim/clock.js';
import { tickPlayer } from '../sim/player.js';
import { tickPlayerCar } from '../sim/vehicle.js';
import { tickCityView } from '../sim/cityview.js';
import { tickInterior, STREET, syncInterior, frameCamera, isIndoors } from '../sim/interior.js';
import { census, describe } from '../sim/people.js';
import { liveNews } from '../sim/news.js';
import { districtReport } from '../sim/economy.js';
import { pinDemand } from '../sim/decline.js';
import { arcSnapshot, arcChoose, arcSkipStep } from '../sim/arc.js';
import { forceTier, forceSearch, createWanted } from '../sim/wanted.js';
import { WALK_BOUNDS, EDGES, node, clampToBounds, heightAt } from '../sim/world.js';
import { isFree, streetPose } from '../render/vacant.js';
import { drawLedger } from '../render/ledger.js';
import { captureFrame } from '../render/capture.js';

// Shot QC renders once into a 96 px depth target; the height follows the aspect.
const FC_WIDTH = 96;
const fcDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
let fcTarget = null;

export function bindProbe(parts) {
  const {
    seed, generate, save, camera, renderer, street, city, people, player, car: heroCar,
    mission, wanted, dispatch, interior, clock, news, arc, fixed, composer,
    getProfile, getWantedStatus, getInputLog, isReplayDone, getReplayError,
  } = parts;

  const api = {
    seed,
    generated: generate,
    saveNow: save,
    cam: () => camera.position.toArray().map((v) => +v.toFixed(2)),
    // Canvas pixels for a world point (M0.T4): a test clicks what the game drew
    // instead of hand-tuned coordinates. The raw projection, so a point behind
    // the camera comes back outside the canvas rather than clamped onto it.
    screenOf: (x, y, z) => {
      const p = new THREE.Vector3(x, y, z).project(camera);
      return {
        x: (p.x * 0.5 + 0.5) * window.innerWidth,
        y: (0.5 - p.y * 0.5) * window.innerHeight,
      };
    },
    draws: () => renderer.info.render.calls,
    hack: () => parts.fireHack(),
    dark: () => [...parts.dark],
    cooldown: () => +hackCooldownLeft(street).toFixed(1),
    player: () => ({ x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), mode: player.mode }),
    // M2.F2b: the shipped person's world bounds and where it stands. `skinned`
    // flips true once loadPersonAvatar has swapped the box figure for
    // person.glb; min/max come from Box3.setFromObject on the posed skinned
    // subtree, `player` is the drawn group, `onScreen` is the bound centre
    // inside the camera's frustum (M2.F2's failure showed a body at the player
    // nowhere in the frame, so the frame itself is part of the question).
    avatarBox: () => {
      const box = new THREE.Box3().setFromObject(parts.avatar.group, true);
      const centre = box.getCenter(new THREE.Vector3()).project(parts.camera);
      const round = (v) => +v.toFixed(3);
      const at = parts.avatar.group.position;
      return {
        skinned: !!parts.avatar.skinned,
        min: [round(box.min.x), round(box.min.y), round(box.min.z)],
        max: [round(box.max.x), round(box.max.y), round(box.max.z)],
        player: [round(at.x), round(at.y), round(at.z)],
        onScreen: centre.z <= 1 && Math.abs(centre.x) <= 1 && Math.abs(centre.y) <= 1,
      };
    },
    car: () => ({ x: +heroCar.x.toFixed(2), y: +heroCar.y.toFixed(2), z: +heroCar.z.toFixed(2), speed: +heroCar.speed.toFixed(1) }),
    enter: () => parts.toggleVehicle(),
    profile: () => getProfile(),
    heat: () => wanted.heat,
    wanted: () => ({
      tier: wanted.heat, contact: wanted.contact, status: getWantedStatus(),
      units: wanted.pursuit.filter((u) => u.active && !u.leaving).length,
      roadblock: wanted.response.roadblock.active,
      strip: wanted.response.strip.active ? { x: wanted.response.strip.x, z: wanted.response.strip.z } : null,
      heli: wanted.response.heli.active, flat: heroCar.flat ?? 0,
      search: wanted.search.active ? { x: wanted.search.x, z: wanted.search.z, r: +wanted.search.r.toFixed(1) } : null,
      radio: dispatch.lines.map((l) => `${l.speaker}: ${l.text}`),
    }),
    tod: () => +clock.nightFactor.toFixed(3),
    hour: () => clock.hour,
    census: () => census(people),
    news: () => liveNews(news, street.time),
    walkersOut: () => street.npcs.filter((n) => n.out !== false).length,
    person: (k) => {
      if (people.list.length === 0) return null;
      return describe(people.list[k % people.list.length]);
    },
    pursuit: () => wanted.pursuit.map((p) => ({ active: p.active, x: +p.x.toFixed(1), z: +p.z.toFixed(1) })),
    mission: () => ({ id: mission.id, done: [...mission.done], balance: mission.balance, status: getWantedStatus() }),
    space: () => interior.space,
    door: () => interior.near?.label ?? null,
    useDoor: () => parts.enterDoor(),
    arc: () => {
      const at = player.mode === 'drive' ? heroCar : player;
      return arcSnapshot(arc, city.parcels, at.x, at.z);
    },
    choose: (key) => arcChoose(arc, key, street.time),
    city: () => ({
      time: +city.time.toFixed(2),
      demand: { ...city.demand },
      parcels: city.parcels.map((p) => ({
        id: p.id, kind: p.kind,
        x: p.x, z: p.z, use: p.use, zone: p.powerZone, stage: STAGES[p.stage],
        progress: +p.progress.toFixed(4), height: +builtHeight(p).toFixed(2), building: p.building,
        trend: p.trend, why: p.why, vacancy: +p.vacancy.toFixed(3),
      })),
    }),
    economy: () => districtReport(city),
    // M0-1: the fixed-step count, a pause, the ?record=1 log and the state hash a
    // record/replay comparison reads — player, car, street, city (with its
    // economy), people and wanted.
    step: () => fixed.total,
    pause: () => setSpeed(fixed, 0),
    stateHash: () => hashState({ player, car: heroCar, street, city, economy: city.economy, people, wanted }),
    inputLog: () => getInputLog(),
    replayDone: () => isReplayDone(),
    replayError: () => getReplayError(),
    shot: () => {
      composer.render();
      return captureFrame(renderer);
    },
  };
  api.cityview = cityViewProbe(parts);
  if (parts.capture) bindCapture(api, parts);
  window.__game = api;
  return api;
}

function cityViewProbe(parts) {
  const { city, cityView, cityRig, camera } = parts;
  return {
    state: () => ({ ...cityView, level: undefined, trend: [...cityView.trend] }),
    lots: () => city.parcels.map((p) => ({ use: p.use, zoned: p.zoned, stage: STAGES[p.stage], building: p.building })),
    screen: (i) => cityRig.screenOf(camera, i),
    pick: (x, y) => cityRig.pick(camera, x, y),
  };
}

// Capture-only police probe, bound behind ?capture=1. It calls the same sim
// entry points play does (a tier, a lost suspect) and can hold the pursuit
// still, so evidence is framed at the play camera instead of chased for.
function policeProbe(parts) {
  const { wanted, player, car: heroCar, street, police, cam, toggleVehicle } = parts;
  const suspect = () => {
    const b = player.mode === 'drive' ? heroCar : player;
    return { x: b.x, z: b.z, yaw: b.yaw };
  };
  return {
    tier: (n) => forceTier(wanted, n, suspect(), street.time),
    search: (x, z, yaw = 0, age = 0) => forceSearch(wanted, x, z, yaw, street.time, age),
    hold: (on) => { parts.setPoliceHold(on); },
    flash: (t) => { police.flashFreeze = t; },
    drive: (x, z, yaw, speed = 0) => {
      Object.assign(heroCar, { x, z, yaw, speed, y: heightAt(x, z) });
      Object.assign(player, { x, z });
      snap(heroCar);
      snap(player);
      if (player.mode !== 'drive') toggleVehicle();
      cam.yaw = yaw;
    },
    unit: (i, x, z, yaw) => Object.assign(wanted.pursuit[i], { x, z, yaw, y: heightAt(x, z), speed: 0 }),
    heli: (x, z, aimX, aimZ, y = 24) => Object.assign(wanted.response.heli, { x, y, z, aimX, aimZ }),
    view: (pitch, dist) => Object.assign(cam, { pitch, dist }),
    flat: (v) => { heroCar.flat = v; },
    reset: () => Object.assign(wanted, createWanted()),
  };
}

function bindCapture(api, parts) {
  bindCityCapture(api, parts);
  bindStreamCapture(api, parts);
  bindZoningCapture(api, parts);
  bindScorecard(api, parts);
}

function bindCityCapture(api, parts) {
  const { street, city, cityView } = parts;
  // Capture-only: run the district's sim ahead by `secs`, in the frame loop's own
  // steps and functions, without drawing them. SwiftShader draws about a frame a
  // second, so the half-minute a zoned lot takes to break ground is ten minutes
  // of frames; this lets evidence show "later" without the wait.
  api.cityview.advance = (secs) => {
    for (let t = 0; t < secs; t += 0.05) {
      tickStreet(street, 0.05);
      tickZoning(city, 0.05, street);
      tickCityView(cityView, city, 0.05, new Set());
    }
  };
  // The free land the district left open, and the sim's own zoning entry the
  // city-view paint uses (sim/zoning.js zoneParcel). Capture-only: play never
  // repositions a lot behind the camera.
  api.freeLots = () => city.parcels.flatMap((p, i) => (isFree(p) ? [{
    index: i, x: +p.x.toFixed(3), z: +p.z.toFixed(3),
    pose: Object.fromEntries(Object.entries(streetPose(p)).map(([k, v]) => [k, +v.toFixed(3)])),
  }] : []));
  api.zone = (i, use) => zoneParcel(city, i, use);
  // Aim the overview at one lot for evidence: a shot or a test that has to look
  // at a thing a building hides from the district's opening heading.
  api.cityview.aim = (o) => Object.assign(cityView, o);
}

function bindStreamCapture(api, parts) {
  const { avatar, chunks, outskirts, renderer, clock, street, city, player, interior, cam, enterDoor } = parts;
  // Avatar geometry audit: mesh count and summed position-vertex count, so the
  // player-body budget is a measured number and not an estimate.
  api.avatarStats = () => {
    let meshes = 0;
    let verts = 0;
    avatar.group.traverse((o) => {
      if (!o.isMesh) return;
      meshes += 1;
      verts += o.geometry.attributes.position.count;
    });
    return { meshes, verts };
  };
  api.chunks = {
    stats: () => ({ ...chunks.stats(), ms: chunks.cost(), pools: outskirts.stats() }),
    cost: () => chunks.cost(),
    resident: () => chunks.resident(),
    origin: (x, z) => { parts.setStreamOrigin(x, z); },
    budget: (tiles, ms) => chunks.budget(tiles, ms),
    visible: (on) => { for (const m of outskirts.meshes) m.visible = on; },
  };
  // What each draw was spent on, per frame: docs/DRAWS.md is built from it.
  api.ledger = drawLedger(renderer);
  // The end of the day/night glide, reached at once: a probe measuring the day
  // frame should not have to render 140 frames of dusk to get there.
  api.night = (n) => { clock.nightFactor = n; clock.nightTarget = n; clock.rate = 0; };
  api.setHour = (h) => { clock.hour = h; clock.rate = 0; };
  // Runs the street and the city ahead by `secs` of game time in the frame loop's
  // own 50 ms steps, so evidence of a minutes-long economic swing does not need
  // minutes of a software rasteriser. Nothing else is ticked; nothing is skipped.
  api.advance = (secs) => {
    for (let t = 0; t < secs; t += 0.05) {
      tickStreet(street, 0.05);
      tickZoning(city, 0.05, street);
    }
  };
  // Stand the player somewhere inside the walk box it could have walked to, and
  // let the ordinary follow cam frame it. Clamped to WALK_BOUNDS on purpose: a
  // shot from a place the player cannot reach proves nothing (AGENTS.md step 5).
  // The camera is snapped to the pose here, not on the next frame: a pick or a
  // readout that runs in the same tick as the pose must look through the posed
  // lens, exactly as the play camera would once it eased there.
  api.pose = (x, z, yaw) => {
    ({ x: player.x, z: player.z } = clampToBounds(WALK_BOUNDS, x, z));
    snap(player);
    cam.yaw = yaw;
    if (player.mode === 'foot') placeFollowCamera(parts);
  };
  // Walk into a grown lot by use, the way the door would: pose the body on the
  // street spot, then use the door. Capture-only so nothing in play moves a
  // player behind the camera. Returns the space id, or null when no grown lot
  // of that use (or parcel index, for the scorecard) exists yet.
  api.enterLot = (use) => {
    interior.space = STREET;
    syncInterior(interior);
    const link = typeof use === 'number'
      ? interior.links.find((l) => l.id === `lot:${use}-door`)
      : interior.links.find((l) => l.parcelUse === use);
    if (!link) return null;
    const from = link.ends[0];
    player.mode = 'foot';
    avatar.group.visible = true;
    player.x = from.x;
    player.z = from.z;
    player.speed = 0;
    snap(player);
    tickInterior(interior, player);
    enterDoor();
    return interior.space === STREET ? null : interior.space;
  };
  // The door ends the sim currently offers, for a test to aim at.
  api.doorList = () => interior.links.map((l) => ({
    id: l.id, use: l.parcelUse ?? null,
    ends: l.ends.map((e) => ({ space: e.space, x: +e.x.toFixed(3), z: +e.z.toFixed(3), label: e.label })),
  }));
}

function bindZoningCapture(api, parts) {
  const { city, clock, street, lotNote, decline, growth, arc, cam } = parts;
  // Decline on demand: hold a market where it is needed and run the world on
  // ahead — clock, street and city, in the frame loop's longest step, so it is
  // the same sim — instead of waiting minutes for the swell to slump. Software
  // rendering runs a frame a second, and a blackout is nine seconds of sim.
  api.zoning = {
    pin: (use, level) => pinDemand(city, use, level),
    skip: (secs) => {
      for (let t = 0; t < secs; t += 0.05) {
        tickClock(clock, 0.05);
        tickStreet(street, 0.05);
        tickZoning(city, 0.05, street);
      }
    },
    note: () => lotNote.textContent,
    // A/B for the draw count: the same frame with and without the boards.
    dressing: (on) => { decline.mesh.visible = on; },
  };
  // Every working crane this frame: position, heading, jib length, and whether
  // its whole boom clears the surrounding rects at that heading (render/zoning.js).
  api.cranes = () => growth.cranes();
  // The mouse's drag and wheel as numbers, clamped to the ranges the mouse has:
  // a framing any player can reach by hand, not a lab angle.
  api.look = (pitch, dist = cam.dist) => {
    cam.pitch = Math.max(0.08, Math.min(1.2, pitch));
    cam.dist = Math.max(3, Math.min(14, dist));
  };
  api.arcSkip = () => arcSkipStep(arc);
}

function bindScorecard(api, parts) {
  const card = scorecardProbe(parts);
  api.police = policeProbe(parts);
  api.policeOnScreen = (w, h) => policeOnScreen(parts, w, h);
  api.frameCheck = (near) => frameCheck(parts, near);
  api.pick = (x, y, w, h) => pickPixel(parts, x, y, w, h);
  // Every drawn footprint with the parcel it belongs to (M3-3), so a pick test
  // can aim at a building instead of a coordinate.
  api.footprints = () => card.footprints();
  // The pillar scorecard's probes (scripts/scorecard.mjs), capture-only like the
  // rest of this block: they read sim state and call the frame loop's own tick
  // functions, never draw, and are invisible to a player.
  api.scorecard = card;
}

function scorecardProbe(parts) {
  const { city, street, player, car: heroCar, interior, towers, skyline, dark: DARK } = parts;
  return {
    indoors: () => isIndoors(interior),
    zone: (i, use) => zoneParcel(city, i, use),
    npcs: () => street.npcs.map((n) => ({ x: +n.x.toFixed(2), z: +n.z.toFixed(2), out: n.out !== false })),
    cars: () => street.cars.map((c) => ({ x: +(c.x ?? c.lane).toFixed(2), z: +(c.z ?? 0).toFixed(2), parked: !!c.parked })),
    lights: () => ({
      phase: [zonePhase(street, 0), zonePhase(street, 1)],
      glow: [zoneGlow(street, 0), zoneGlow(street, 1)],
      dark: [...DARK],
    }),
    edges: () => EDGES.map((e) => {
      const a = node(e.a);
      const b = node(e.b);
      return { id: e.id, kind: e.kind, a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z } };
    }),
    footprints: () => [
      ...towers.footprints.map((f) => ({
        x: f.x, z: f.z, w: f.w, d: f.d, h: f.h, name: f.name, parcel: f.parcel ?? null,
      })),
      ...skyline.footprints.map((f) => ({ x: f.x, z: f.z, w: f.w, d: f.d, name: f.name })),
      ...city.parcels.map((p, i) => ({ x: p.x, z: p.z, w: p.w, d: p.d, name: `lot:${i}` })),
    ],
    // Walk the player along (mx, mz) for `secs` in the frame loop's own 50 ms
    // steps — the same tickPlayer the loop calls, so a fast-forwarded walk is the
    // walk. No draw: the real follow cam catches up on the next frame.
    simWalk: (secs, mx, mz) => {
      const input = { mx, mz, hurry: true };
      for (let t = 0; t < secs; t += 0.05) {
        tickPlayer(player, input, 0.05);
        tickInterior(interior, player);
      }
      snap(player);
      return { x: +player.x.toFixed(2), z: +player.z.toFixed(2) };
    },
    // The same for the hero car, so driving a loop is not minutes of rasteriser.
    simDrive: (secs, throttle, steer) => {
      let moved = 0;
      for (let t = 0; t < secs; t += 0.05) {
        const before = { x: heroCar.x, z: heroCar.z };
        tickPlayerCar(heroCar, { throttle, steer }, 0.05);
        moved += Math.hypot(heroCar.x - before.x, heroCar.z - before.z);
      }
      snap(heroCar);
      return { x: +heroCar.x.toFixed(2), z: +heroCar.z.toFixed(2), moved: +moved.toFixed(1) };
    },
    walkEdge: (i, capSecs, stepSecs, fcEvery, reach) => walkEdge(parts, i, capSecs, stepSecs, fcEvery, reach),
  };
}

// Walk one avenue edge end to end inside the page: teleport to its start, step
// the player toward its end in the loop's 50 ms steps, place the real follow
// cam, and ask frameCheck() every `fcEvery` samples. Doing the whole edge in one
// call keeps a software-cheap walk from being an hour of round-trips. Returns
// whether the end was reached and the worst numbers.
function walkEdge(parts, i, capSecs, stepSecs, fcEvery, reach) {
  const { player, avatar, interior, cam, city, towers, skyline, camera } = parts;
  const e = EDGES.filter((x) => x.kind === 'avenue')[i];
  if (!e) return null;
  const a = node(e.a);
  const b = node(e.b);
  // A previous bot may have left the player inside a lot; a walk can only be
  // walked from the street, so stand them back on it first.
  interior.space = STREET;
  syncInterior(interior);
  player.mode = 'foot';
  avatar.group.visible = true;
  ({ x: player.x, z: player.z } = clampToBounds(WALK_BOUNDS, a.x, a.z));
  player.speed = 0;
  snap(player);
  const dx = b.x - player.x;
  const dz = b.z - player.z;
  const len = Math.hypot(dx, dz) || 1;
  const input = { mx: dx / len, mz: dz / len, hurry: true };
  cam.yaw = Math.atan2(input.mx, input.mz);
  const solids = [
    ...towers.footprints,
    ...skyline.footprints,
    ...city.parcels.map((p) => ({ x: p.x, z: p.z, w: p.w, d: p.d })),
  ];
  let reached = false;
  let camInside = 0;
  let maxBlocked = 0;
  let samples = 0;
  let checks = 0;
  for (let t = 0; t < capSecs; t += stepSecs) {
    const step = Math.min(stepSecs, capSecs - t);
    for (let s = 0; s < step; s += 0.05) {
      tickPlayer(player, input, 0.05);
      tickInterior(interior, player);
    }
    placeFollowCamera(parts);
    const cx = camera.position.x;
    const cz = camera.position.z;
    if (solids.some((f) => Math.abs(cx - f.x) < f.w / 2 && Math.abs(cz - f.z) < f.d / 2)) camInside += 1;
    samples += 1;
    if (samples % fcEvery === 0) {
      maxBlocked = Math.max(maxBlocked, frameCheck(parts, 2).blocked);
      checks += 1;
    }
    if (Math.hypot(player.x - b.x, player.z - b.z) <= reach) { reached = true; break; }
  }
  snap(player);
  return {
    id: e.id, reached, camInside, samples, checks,
    maxBlocked: +maxBlocked.toFixed(3),
    gap: +Math.hypot(player.x - b.x, player.z - b.z).toFixed(1),
  };
}

// Shot QC: what share of the frame is something closer than `near` metres to
// the lens. A follow cam parked behind a car roof or inside a wall passes every
// draw and fps check and still shows the player a slab; this puts a number on
// it. The avatar is the subject, so it is not counted blocking its own shot.
//
// It measures by rendering the scene once through a depth material into a 96 px
// target and reading the nearest surface per pixel, not by raycasting a grid.
// The city is a handful of merged meshes plus InstancedMeshes, and a ray sweep
// tested every instance of every instanced mesh per grid cell: 3.5 s a call, 45
// calls a scorecard run. The depth read is the same nearest-surface question and
// answers in milliseconds, so a bot can ask it on every sampled frame.
function frameCheck(parts, near = 2) {
  const { scene, camera, renderer, avatar } = parts;
  const w = FC_WIDTH;
  const h = Math.max(8, Math.round(FC_WIDTH / camera.aspect));
  if (!fcTarget || fcTarget.width !== w || fcTarget.height !== h) {
    fcTarget?.dispose();
    fcTarget = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
  }
  // Points (rain, stars, grass) and the additive glow passes never hide the
  // street, and the avatar is the subject: hide all of them, exactly the set the
  // old ray sweep skipped, so only real solids contribute depth.
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) return;
    if (o.isPoints || o.isSprite || seeThrough(o)) { hidden.push(o); o.visible = false; }
  });
  const avatarWas = avatar.group.visible;
  const prevOverride = scene.overrideMaterial;
  const prevAuto = renderer.shadowMap.autoUpdate;
  avatar.group.visible = false;
  scene.overrideMaterial = fcDepth;
  renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(fcTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.shadowMap.autoUpdate = prevAuto;
  scene.overrideMaterial = prevOverride;
  avatar.group.visible = avatarWas;
  for (const o of hidden) o.visible = true;

  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(fcTarget, 0, 0, w, h, px);
  // UnpackRGBAToDepth (three's packing.glsl): v = b0/256^4 + b1/256^3 + b2/256^2
  // + b3/256, then perspectiveDepthToViewZ.
  const { near: cn, far: cf } = camera;
  let blocked = 0;
  for (let i = 0; i < w * h; i++) {
    const v = px[i * 4] / 4294967296 + px[i * 4 + 1] / 16777216 + px[i * 4 + 2] / 65536 + px[i * 4 + 3] / 256;
    const viewZ = (cn * cf) / ((cf - cn) * v - cf);
    if (-viewZ <= near) blocked += 1;
  }
  const cells = w * h;
  return {
    blocked: +(blocked / cells).toFixed(3),
    blockers: blocked ? [`${blocked}/${cells} px within ${near} m (depth pass)`] : [],
  };
}

// Where the on-foot follow cam stands, snapped (no easing step) so a probe can
// walk the sim faster than real time and still ask frameCheck() a real camera
// question. Mirrors the on-foot branch of render()'s camera block.
function placeFollowCamera(parts) {
  const { player, cam, camera, interior, camPivot } = parts;
  const ax = player.x;
  const az = player.z;
  const ay = player.y;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cx = ax - Math.sin(cam.yaw) * cam.dist * cp;
  const cz = az - Math.cos(cam.yaw) * cam.dist * cp;
  cam.ground = Math.max(ay, heightAt(cx, cz));
  camera.position.set(cx, sp * cam.dist + 0.6 + cam.ground, cz);
  camera.position.copy(frameCamera(interior, { x: ax, y: ay + camPivot, z: az }, camera.position));
  camera.lookAt(ax, ay + 1.7, az);
}

// Shot QC: what is under one pixel of a 1280x720 shot, so a reviewer can name
// the thing a screenshot shows instead of guessing at it.
function pickPixel(parts, px, py, w = 1280, h = 720) {
  const { camera, scene, avatar } = parts;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, 1 - (py / h) * 2), camera);
  // The follow cam frames the player at the centre: a pick asks about the world
  // behind them, so the avatar never answers it.
  return ray.intersectObjects(scene.children, true).filter((hit) => hit.object.visible && !isAvatar(hit.object, avatar)).slice(0, 6).map((hit) => {
    const mat = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
    const path = [];
    for (let o = hit.object; o.parent; o = o.parent) path.unshift(o.name || o.type);
    return {
      path: path.join('/'), mat: mat?.type, color: mat?.color?.getHexString(), see: seeThrough(hit.object),
      dist: +hit.distance.toFixed(1), at: hit.point.toArray().map((v) => +v.toFixed(1)),
      geo: hit.object.geometry?.type, inst: hit.object.isInstancedMesh ? hit.instanceId : undefined,
      parcel: parcelOf(parts, hit),
    };
  });
}

// The parcel id a picked surface was drawn as (M3-3): a grown lot's shell and
// every piece of its kit carry the parcel index per instance (render/zoning.js),
// a street-wall building carries its id on the footprint it was emitted with
// (render/block.js). Ground, roads and the skyline ring are nobody's parcel.
// Trim, posters and pilasters stand up to half a metre off the podium face the
// footprint measures; a pick on any of them still names the building.
const WALL_SLACK = 0.6;
function parcelOf(parts, hit) {
  if (inGroup(hit.object, parts.growth?.group)) {
    const attr = hit.object.geometry?.attributes?.parcel;
    if (!attr || hit.instanceId === undefined) return null;
    return parts.city?.parcels[attr.getX(hit.instanceId)]?.id ?? null;
  }
  if (!inGroup(hit.object, parts.towers?.group)) return null;
  const f = parts.towers.footprints.find((f) => f.parcel
    && Math.abs(hit.point.x - f.x) <= f.w / 2 + WALL_SLACK
    && Math.abs(hit.point.z - f.z) <= f.d / 2 + WALL_SLACK);
  return f?.parcel ?? null;
}

function inGroup(object, group) {
  if (!group) return false;
  for (let o = object; o; o = o.parent) if (o === group) return true;
  return false;
}

// Glows, light pools and rain are drawn see-through; they never hide the street.
function seeThrough(object) {
  const mat = Array.isArray(object.material) ? object.material[0] : object.material;
  return object.isPoints || !mat || (mat.transparent && mat.opacity < 0.9) || mat.blending === THREE.AdditiveBlending;
}

function isAvatar(object, avatar) {
  for (let o = object; o; o = o.parent) if (o === avatar.group) return true;
  return false;
}

// Capture-only: where each live pursuit unit stands relative to the lens. `dist`
// is to the player (the car while driving); `inFrame` is whether the unit's
// centre projects inside the canvas; `visible` is whether the nearest solid
// pixel there is the unit itself — nothing between the lens and it.
function policeOnScreen(parts, w = 1280, h = 720) {
  const { wanted, player, car: heroCar, camera } = parts;
  const hero = player.mode === 'drive' ? heroCar : player;
  const centre = new THREE.Vector3();
  const eye = camera.position;
  const cars = [
    ...wanted.pursuit.filter((u) => u.active && !u.leaving),
    ...wanted.response.roadblock.cars,
  ];
  return cars.map((u) => {
    const dist = +Math.hypot(u.x - hero.x, u.z - hero.z).toFixed(1);
    centre.set(u.x, u.y + 0.9, u.z);
    const projected = centre.clone().project(camera);
    const inFrame = projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
    const hits = pickPixel(parts, (projected.x * 0.5 + 0.5) * w, (0.5 - projected.y * 0.5) * h, w, h)
      .filter((t) => !t.see);
    const visible = inFrame && hits.length > 0
      && Math.abs(hits[0].dist - eye.distanceTo(centre)) < 1.6;
    return { dist, inFrame, visible };
  });
}
