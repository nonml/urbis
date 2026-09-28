// City view's hands and face: the pointer and wheel in the overview, the brush
// palette, and the readout for the lot under the cursor. DOM and input only —
// the state is sim/cityview.js, the camera and outlines render/cityview.js.
import { isDark } from '../sim/street.js';
import { STAGE } from '../sim/zoning.js';
import {
  BRUSH_KEYS, chooseBrush, hoverLot, lotStatus, orbitCityView, paintLot, zoomCityView,
} from '../sim/cityview.js';
import { paintOf } from '../render/cityview.js';

// Radians of orbit and tilt per pixel of drag, and zoom per wheel unit.
const ORBIT_PER_PX = 0.005;
const TILT_PER_PX = 0.003;
const ZOOM_PER_WHEEL = 0.001;
// A press that travels less than this many pixels is a click, not a drag.
const CLICK_SLOP = 6;

const USE_NAME = { res: 'residential', com: 'commercial', ind: 'industrial' };
const STAGE_NAME = ['empty lot', 'site', 'low-rise', 'mid-rise', 'tower'];
// What the lot is doing, and the one word of why when there is one.
const STATUS_LINE = {
  growing: '▲ growing',
  declining: '▼ declining',
  stalled: '■ stalled — no power',
  complete: '● complete',
  waiting: '· waiting for demand',
  unzoned: '· unzoned — nothing will be built',
};

const PANEL = [
  'position:fixed', 'left:12px', 'bottom:12px', 'z-index:5', 'display:none',
  'font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace', 'letter-spacing:0.04em',
  'color:#e4e1da', 'background:rgba(4,8,16,0.72)', 'border:1px solid rgba(255,255,255,0.16)',
  'padding:8px 10px', 'border-radius:6px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  'user-select:none',
].join(';');
const CARD = [
  'position:fixed', 'display:none', 'pointer-events:none', 'z-index:6',
  'font:11px/1.65 ui-monospace,Menlo,monospace', 'letter-spacing:0.05em',
  'color:#e4e1da', 'background:rgba(4,8,16,0.82)', 'border:1px solid rgba(255,255,255,0.16)',
  'padding:6px 10px', 'border-radius:4px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  'white-space:nowrap',
].join(';');

function swatch(use) {
  return `<span style="display:inline-block;width:9px;height:9px;margin-right:6px;`
    + `background:${paintOf(use)};border-radius:2px"></span>`;
}

function buildPalette(view) {
  const panel = document.createElement('div');
  panel.id = 'cityview';
  panel.style.cssText = PANEL;
  const title = document.createElement('div');
  title.innerHTML = '<b style="color:#fff">CITY VIEW</b> <span style="opacity:0.6">· z · street</span>';
  panel.appendChild(title);
  const rows = Object.entries(BRUSH_KEYS).map(([key, use]) => {
    const row = document.createElement('div');
    row.style.cssText = 'cursor:pointer;padding:0 8px 0 6px;border-left:3px solid transparent;border-radius:2px';
    row.innerHTML = `<b style="color:#fff">${key.toUpperCase()}</b> &nbsp;${swatch(use)}${USE_NAME[use] ?? 'unzone'}`;
    row.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      chooseBrush(view, use);
    });
    panel.appendChild(row);
    return { row, use };
  });
  document.body.appendChild(panel);
  return { panel, rows };
}

function readout(view, city, street, index) {
  const p = city.parcels[index];
  const status = lotStatus(view, city, index, isDark(street, p.powerZone));
  const standing = p.stage === STAGE.EMPTY ? 'empty lot' : `${STAGE_NAME[p.stage]} · ${USE_NAME[p.use]}`;
  const line = status === 'clearing'
    ? `◆ clearing${p.zoned ? ` for ${USE_NAME[p.zoned]}` : ' — unzoned'}`
    : STATUS_LINE[status];
  return `${swatch(p.zoned)}<b style="color:#fff">${(USE_NAME[p.zoned] ?? 'unzoned').toUpperCase()}</b>`
    + `<br>${standing}<br>${line}`;
}

// A press on the canvas in the overview is a click if it barely moves, and a
// drag — orbit sideways, tilt up and down — once it travels. The wheel zooms.
function bindPointer(ui) {
  const { canvas, view, city } = ui;
  canvas.addEventListener('pointerdown', (e) => {
    if (view.mode === 'city') ui.press = { lastX: e.clientX, lastY: e.clientY, travel: 0 };
  });
  window.addEventListener('pointermove', (e) => {
    ui.pointer = { x: e.clientX, y: e.clientY };
    const { press } = ui;
    if (!press) return;
    const dx = e.clientX - press.lastX;
    const dy = e.clientY - press.lastY;
    press.travel += Math.hypot(dx, dy);
    press.lastX = e.clientX;
    press.lastY = e.clientY;
    if (press.travel > CLICK_SLOP) orbitCityView(view, -dx * ORBIT_PER_PX, dy * TILT_PER_PX);
  });
  window.addEventListener('pointerup', () => {
    if (ui.press && ui.press.travel <= CLICK_SLOP) paintLot(view, city);
    ui.press = null;
  });
  canvas.addEventListener('wheel', (e) => {
    if (view.mode === 'city') zoomCityView(view, 1 + e.deltaY * ZOOM_PER_WHEEL);
  }, { passive: true });
}

// `cam` is main.js's street rig. While the camera is up the overview owns its
// heading and parks its tilt and dolly, so a drag or a wheel meant for the
// overview does not leave the player's camera somewhere else when it comes
// back down — and it lands facing the way the overview faced.
function holdStreetRig(ui) {
  const { cam, view } = ui;
  if (view.lift === 0) {
    ui.parked = null;
    return;
  }
  ui.parked = ui.parked ?? { pitch: cam.pitch, dist: cam.dist };
  cam.yaw = view.yaw;
  cam.pitch = ui.parked.pitch;
  cam.dist = ui.parked.dist;
}

function hover({ view, pointer, rig, camera }) {
  if (view.mode !== 'city' || view.lift < 1 || !pointer) return hoverLot(view, -1);
  const x = (pointer.x / window.innerWidth) * 2 - 1;
  const y = -(pointer.y / window.innerHeight) * 2 + 1;
  return hoverLot(view, rig.pick(camera, x, y));
}

function showPalette({ view, panel, rows }) {
  panel.style.display = view.mode === 'city' ? 'block' : 'none';
  for (const { row, use } of rows) {
    const on = use === view.brush;
    row.style.borderLeftColor = on ? paintOf(use) : 'transparent';
    row.style.background = on ? 'rgba(255,255,255,0.08)' : 'transparent';
  }
  // The street's own prompts point at things too small to see from up here.
  for (const id of ['profiler', 'prompt']) {
    const el = document.getElementById(id);
    if (el && view.lift > 0) el.style.display = 'none';
  }
}

function showCard({ view, city, street, pointer, card }) {
  if (view.hover < 0 || !pointer) {
    card.style.display = 'none';
    return;
  }
  card.innerHTML = readout(view, city, street, view.hover);
  card.style.display = 'block';
  card.style.left = `${pointer.x + 16}px`;
  card.style.top = `${pointer.y + 16}px`;
}

// Wires the overview's input and HUD. Returns the per-frame update, which runs
// after render/cityview.js has placed the camera.
export function bindCityView({ canvas, cam, camera, city, street, view, rig }) {
  const card = document.createElement('div');
  card.id = 'lotcard';
  card.style.cssText = CARD;
  document.body.appendChild(card);
  const ui = {
    canvas, cam, camera, city, street, view, rig, card, ...buildPalette(view),
    pointer: null, press: null, parked: null,
  };
  bindPointer(ui);
  function update() {
    holdStreetRig(ui);
    hover(ui);
    showPalette(ui);
    showCard(ui);
  }
  return { update };
}
