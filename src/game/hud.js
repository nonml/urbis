// HUD (M3.T5, criterion M3-1): every DOM readout the frame loop used to build
// and drive inline — the status lines, the drive prompt, the mission panel and
// banner, the door HUD, the district panel, the lot note, the arc UI and the
// profiler. `buildHud` assembles once; `updateHud` writes the per-frame state;
// `tickHud` refreshes the measured status line on its own clock. DOM only:
// nothing here draws in WebGL and nothing here writes the sim.
import { buildEconomyPanel, updateEconomyPanel } from '../render/economy.js';
import { buildLotNote, showLotNote } from '../render/lotnote.js';
import { buildArcUI, updateArcUI } from '../render/arcui.js';
import { buildDispatchHud, updateDispatchHud } from '../ui/dispatch.js';
import { buildDoorHud, updateDoorHud, fadeThroughDoor } from '../render/doorhud.js';
import { buildProfiler, updateProfiler } from '../render/profiler.js';
import { buildAim, updateAim } from '../render/aim.js';
import { districtAt, hackCooldownLeft } from '../sim/street.js';
import { focusParcel } from '../sim/decline.js';
import { isBusted } from '../sim/wanted.js';
import { STREET, doorEnds } from '../sim/interior.js';

// Whole-frame draw budget, declared in the HUD and therefore owned here.
const DRAW_BUDGET = 175;
// The status line refreshes four times a second, on the player's clock.
const STATUS_SECS = 0.25;

// Dev pose presets for scripted verification (?spawn=east): where the player
// stands and where the follow cam looks for evidence shots (scripts/shot.mjs).
// A continued game stands where the save left it, so a load never takes one.
const SPAWNS = {
  east: { x: 49.5, z: 16 }, shop: { x: 3.5, z: 7 },
  promenade: { x: -6, z: -32, yaw: -Math.PI / 2 }, west: { x: -42, z: 0, yaw: Math.PI },
  north: { x: 2, z: 70, yaw: Math.PI }, mound: { x: 67, z: 17, yaw: -Math.PI / 2 },
  // The ground the river channel used to cut, looking across it: verge swell
  // now, no trench, nothing to fall into.
  westflank: { x: -36.5, z: -60, yaw: Math.PI / 2 },
  // Middle of the z=40 intersection, looking east down the E-W canyon.
  cross: { x: 0, z: 40, yaw: Math.PI / 2 },
  // The two corners of the walk box that look out of town, ordinary play poses
  // with the ordinary follow cam, not a staged lab angle (AGENTS.md step 5).
  edge: { x: 70, z: -66, yaw: Math.PI / 2, pitch: 0.32, dist: 8 },
  'edge-s': { x: -20, z: -66, yaw: Math.PI, pitch: 0.32, dist: 8 },
  // The west edge, wheeled out and level: the two south-west growth lots and the
  // crane above them in one frame.
  site: { x: -52, z: -60, yaw: Math.PI / 2, pitch: 0.08, dist: 14 },
};

export function applySpawn(player, cam, preset) {
  if (!preset) return;
  if (preset.startsWith('door-')) {
    // Where leaving a street door puts you (?spawn=door-ramen-front), turned
    // back to face it: frames the door wherever its tower stands.
    const end = doorEnds().find((e) => e.door === preset.slice(5) && e.space === STREET);
    if (end) {
      player.x = end.arrive.x;
      player.z = end.arrive.z;
      player.yaw = end.arrive.yaw + Math.PI;
      cam.yaw = player.yaw;
    }
    return;
  }
  const s = SPAWNS[preset];
  if (!s) return;
  player.x = s.x;
  player.z = s.z;
  if (s.yaw !== undefined) cam.yaw = s.yaw;
  if (s.pitch !== undefined) cam.pitch = s.pitch;
  if (s.dist !== undefined) cam.dist = s.dist;
}

function box(id, css, text = '') {
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = css.join(';');
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

// `newsLine` is built by main (the news line states it shows come from the sim);
// it is placed here after the lot note so stacking matches the original DOM.
export function buildHud(newsLine) {
  const economyPanel = buildEconomyPanel();
  const lotNote = buildLotNote();
  if (newsLine) document.body.appendChild(newsLine);
  const arcUI = buildArcUI();
  const radio = buildDispatchHud();
  const doorHud = buildDoorHud();
  buildProfiler();
  buildAim();
  const el = document.getElementById('hud');
  const prompt = box('prompt', [
    'position:fixed', 'bottom:44px', 'left:50%', 'transform:translateX(-50%)',
    'display:none', 'font:600 13px ui-monospace,Menlo,monospace', 'letter-spacing:0.12em',
    'color:#fff', 'background:rgba(3,10,18,0.8)', 'border:1px solid rgba(84,240,255,0.6)',
    'padding:8px 18px', 'border-radius:20px', 'text-shadow:0 0 8px rgba(84,240,255,0.7)',
  ], 'F · DRIVE');
  const missionPanel = box('mission', [
    'position:fixed', 'top:12px', 'right:12px', 'pointer-events:none', 'z-index:5',
    'font:11px/1.7 ui-monospace,Menlo,monospace', 'letter-spacing:0.05em',
    'color:#ffd9a0', 'background:rgba(12,8,3,0.72)',
    'border:1px solid rgba(255,177,78,0.4)', 'border-left:3px solid #ffb14e',
    'padding:7px 12px', 'border-radius:4px',
    'text-shadow:0 0 6px rgba(255,177,78,0.5)',
  ]);
  const banner = box('banner', [
    'position:fixed', 'top:34%', 'left:50%', 'transform:translateX(-50%)',
    'display:none', 'pointer-events:none', 'z-index:6',
    'font:600 26px ui-monospace,Menlo,monospace', 'letter-spacing:0.2em',
    'color:#fff', 'text-shadow:0 0 18px rgba(84,240,255,0.9),0 0 46px rgba(84,240,255,0.5)',
  ]);
  return {
    el, prompt, missionPanel, banner, economyPanel, lotNote, radio, doorHud, arcUI, news: newsLine,
    fpsAcc: 0, fpsN: 0, fpsShown: 0, timer: 0,
    fadeDoor: () => fadeThroughDoor(doorHud),
  };
}

// The HUD shares its corners without any panel covering another's text: the
// bottom-left stack re-measures what is visible on the 4 Hz HUD tick. The sweep
// found the palette, the district table, the lot note and the story dialogue all
// anchored to one spot, so a fixed bottom per panel cannot hold.
const STACK_GAP = 8;
const STACK_BASE = 12;

function stackBottomLeft(els) {
  let bottom = STACK_BASE;
  for (const el of els) {
    if (!el || el.style.display === 'none' || el.offsetHeight === 0) continue;
    el.style.bottom = `${bottom}px`;
    bottom += el.offsetHeight + STACK_GAP;
  }
}

function hackStatus(street, player, heroCar, dark) {
  const driving = player.mode === 'drive';
  const zone = districtAt(street, driving ? heroCar.x : player.x, driving ? heroCar.z : player.z);
  // Which district is out, however many the map runs; the first dark one names
  // the countdown, as the two did before districts.
  const out = dark.findIndex((d) => d);
  if (out >= 0) {
    const s = Math.max(0, street.zones[out].darkUntil - street.time);
    return `BLACKOUT Z${out} ${s.toFixed(0)}s`;
  }
  const left = hackCooldownLeft(street, zone);
  if (left > 0) return `recharge ${left.toFixed(0)}s`;
  return 'READY';
}

// Everything in the frame that is not a measured number: the panels, the arc,
// the lot note, the door prompt, the registry aim and the walker profile.
// Returns the profile the frame reported, which main hands to the mission and
// the next step. `frame.doing` is the commuter's destination line, computed by
// main. `frame.target` is the registry pick ({ entry, dist }); the profiler is
// the person case of it.
export function updateHud(hud, ctx, frame) {
  const { city, street, dispatch, arc, interior, cam, camera } = ctx;
  const { driving, hx, hz, target, targetPerson, doing, nearHero } = frame;
  updateEconomyPanel(hud.economyPanel, city);
  updateDispatchHud(hud.radio, dispatch, street.time);
  updateArcUI(hud.arcUI, arc, hx, hz, street.time);
  const person = !driving && target?.entry.kind === 'person'
    ? { npc: target.entry.ref, dist: target.dist } : null;
  const profile = driving ? null : updateProfiler(camera, person, targetPerson, doing);
  updateAim(camera, driving ? null : target);
  showLotNote(hud.lotNote, interior.space === STREET
    ? focusParcel(city.parcels, hx, hz, Math.sin(cam.yaw), Math.cos(cam.yaw)) : null);
  updateDoorHud(hud.doorHud, driving ? null : interior.near);
  if (driving) {
    hud.prompt.textContent = 'F · EXIT CAR';
    hud.prompt.style.display = 'block';
  } else if (nearHero) {
    hud.prompt.textContent = 'F · DRIVE';
    hud.prompt.style.display = 'block';
  } else {
    hud.prompt.style.display = 'none';
  }
  return profile;
}

// The status line: draws, fps and triangles measured after the frame rendered,
// plus the mission panel and the banner. Runs on the player's clock, not the
// sim's, so a slow frame cannot starve it.
export function tickHud(hud, ctx, frame) {
  const { street, clock, wanted, mission, player, heroCar, dark } = ctx;
  const { draws, tris, dt, driving } = frame;
  hud.fpsAcc += dt;
  hud.fpsN += 1;
  hud.timer += dt;
  if (hud.timer <= STATUS_SECS) return;
  hud.fpsShown = Math.round(hud.fpsN / hud.fpsAcc);
  hud.fpsAcc = 0;
  hud.fpsN = 0;
  hud.timer = 0;
  const over = draws > DRAW_BUDGET;
  const speedLine = driving ? ` · ${Math.abs(heroCar.speed * 3.6).toFixed(0)} km/h` : '';
  const stars = '★'.repeat(wanted.heat) + '☆'.repeat(3 - wanted.heat);
  const busted = isBusted(wanted, street.time);
  const hh = String(Math.floor(clock.hour)).padStart(2, '0');
  const mm = String(Math.floor((clock.hour % 1) * 60)).padStart(2, '0');
  hud.el.innerHTML =
    `<b>URBIS</b> · ${hh}:${mm} ${clock.nightFactor > 0.5 ? '☾ night' : '☀ day'} · rain<br>` +
    `draws <b class="${over ? 'warn' : ''}">${draws}</b> / ${DRAW_BUDGET} · ` +
    `${hud.fpsShown} fps · ${tris}M tris<br>` +
    `H · blackout [${hackStatus(street, player, heroCar, dark)}]${speedLine} · N · new game<br>` +
    `<span class="${wanted.heat > 0 ? 'warn' : ''}">${stars}</span> · ₡${mission.balance}`;
  const obj = mission.phases.map((p, i) => `${mission.done[i] ? '✓' : '·'} ${p}`).join('<br>');
  hud.missionPanel.innerHTML = `<b>◈ ${mission.id}</b><br>${obj}`;
  hud.missionPanel.style.display = mission.complete && street.time > mission.bannerUntil ? 'none' : 'block';
  hud.missionPanel.style.top = `${!hud.news || hud.news.style.display === 'none' ? 12 : hud.news.offsetHeight + 20}px`;
  stackBottomLeft([
    document.getElementById('cityview'), hud.economyPanel.panel, hud.lotNote, hud.radio.el, hud.arcUI.dialogue,
  ]);
  if (busted) {
    hud.banner.textContent = 'BUSTED';
    hud.banner.style.display = 'block';
  } else if (street.time < mission.bannerUntil) {
    hud.banner.textContent = mission.bannerText;
    hud.banner.style.display = 'block';
  } else {
    hud.banner.style.display = 'none';
  }
}
